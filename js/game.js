// Центральный менеджер игры.
//
// Все сцены активны одновременно. Переключение текущей — по региону:
// смотрим, в чьём AABB лежит мировая позиция игрока, и меняем current.

import * as THREE from "three";
import { SETTINGS } from "./settings.js";
import { AudioManager } from "./audio.js";
import { Player } from "./player.js";
import { HUD } from "./ui/hud.js";
import { OSShell } from "./os/os.js";
import { DialogueBox } from "./ui/dialogue.js";
import { LetterUI } from "./ui/letter.js";
import { ApartmentScene } from "./world/apartment.js";
import { HallwayScene } from "./world/hallway.js";
import {
  Neighbor20Scene, Neighbor30Scene,
  Neighbor40Scene, Neighbor41Scene,
  Neighbor43Scene, Neighbor44Scene,
  Neighbor50Scene,
} from "./world/neighbors.js";
import { ENDING_TEXT } from "./data/terminal.js";

import { TouchControls } from "./ui/touch.js";
import { GamepadInput } from "./ui/gamepad.js";

export class Game {
  constructor(canvas) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x25211d);

    this.scene = new THREE.Scene();
    // Туман: чуть дальше оригинала, но всё ещё «глухой».
    this.scene.fog = new THREE.Fog(0x2e2a26, 5, 26);

    // Только лёгкий подсвет, чтобы совсем уж в чёрное не уходило.
    this.scene.add(new THREE.HemisphereLight(0x6a6358, 0x2a2620, 0.35));

    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);

    this.audio = new AudioManager();
    this.player = new Player(this);
    this.hud = new HUD(this);
    this.os = new OSShell(this);
    this.dialogue = new DialogueBox();
    this.letter = new LetterUI();

      this.letter.onClose = () => this.closeLetter();

      this.touch = new TouchControls(this);
      this.gamepad = new GamepadInput(this);

    this.flags = {};
    this.inventory = [];
    this.notesRead = new Set();
    this.noteLog = [];
    this.loopCount = 0;
    this.locked = false;
    this.current = null;
    this.scenes = {};
    this.activeScenes = [];
    this.solids = [];
    this._pickables = [];

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = SETTINGS.INTERACT_DISTANCE;
    this.lookedAt = null;

    this.clock = new THREE.Clock();
    this.keys = this.player.keys;

    this._bindEvents();
    this._resize();
  }

  start() {
    this.scenes = {
      apartment:   new ApartmentScene(this),
      hallway:     new HallwayScene(this),
      neighbor_20: new Neighbor20Scene(this),
      neighbor_30: new Neighbor30Scene(this),
      neighbor_40: new Neighbor40Scene(this),
      neighbor_41: new Neighbor41Scene(this),
      neighbor_43: new Neighbor43Scene(this),
      neighbor_44: new Neighbor44Scene(this),
      neighbor_50: new Neighbor50Scene(this),
    };

    for (const key in this.scenes) {
      const s = this.scenes[key];
      if (s._built) continue;
      try { s.build(); s._built = true; }
      catch (e) { console.error(`Scene build failed: ${key}`, e); }
    }

    this.activeScenes = Object.values(this.scenes).filter(Boolean);
    for (const s of this.activeScenes) s.activate();

    this.solids = [];
    this._pickables = [];
    for (const s of this.activeScenes) {
      this.solids.push(...s.solids);
      s.group.traverse(o => { if (o.isMesh) this._pickables.push(o); });
    }

    const start = this.scenes.apartment;
    this.current = start;
    this._placePlayerAtSceneSpawn(start);
    try { start.onEnter(); } catch (e) { console.error(e); }
    this.hud.show();
    this.hud.setLocation(start.name);
    this.audio.startAmbient();
  }

  changeScene(name) {
    const scene = this.scenes[name];
    if (!scene) { console.warn("unknown scene", name); return; }
    if (this.current && this.current !== scene) {
      try { this.current.onExit(); } catch (e) { console.error(e); }
    }
    this.current = scene;
    this._placePlayerAtSceneSpawn(scene);
    try { scene.onEnter(); } catch (e) { console.error(e); }
    this.hud.setLocation(scene.name);
  }

  _placePlayerAtSceneSpawn(scene) {
    const [lx, ly, lz] = scene.spawn;
    const gx = scene.group.position.x;
    const gy = scene.group.position.y;
    const gz = scene.group.position.z;
    const rotY = scene.group.rotation.y || 0;
    const cos = Math.cos(rotY), sin = Math.sin(rotY);
    this.player.setPosition(
        gx + lx * cos + lz * sin,
        gy + ly,
        gz - lx * sin + lz * cos);
    this.player.yaw = (scene.spawnYaw || 0) + rotY;
    this.player.pitch = 0;
  }

  _syncRegion() {
    const p = this.player.position;
    let target = null;

    for (const s of this.activeScenes) {
      if (s === this.scenes.hallway) continue;
      if (s.region && s.containsPoint(p)) { target = s; break; }
    }
    if (!target && this.scenes.hallway && this.scenes.hallway.containsPoint(p)) {
      target = this.scenes.hallway;
    }
    if (!target || target === this.current) return;

    try { this.current.onExit(); } catch (e) { console.error(e); }
    this.current = target;
    try { target.onEnter(); } catch (e) { console.error(e); }
    this._refreshPickables();
    this.hud.setLocation(target.name);
  }

  _refreshPickables() {
    this._pickables = [];
    for (const s of this.activeScenes) {
      s.group.traverse(o => { if (o.isMesh) this._pickables.push(o); });
    }
  }

  fadeTransition(callback) { try { callback(); } catch (e) { console.error(e); } }

  openComputer() {
    this.locked = true;
    document.exitPointerLock?.();
    this.os.open();
  }

  closeComputer() {
    this.locked = false;
    this.os.close();
    this.canvas.requestPointerLock();
  }

  showNote(id, title, text) {
    if (!this.notesRead.has(id)) {
      this.notesRead.add(id);
      this.noteLog.push({ id, title, text });
    }
    this.audio.play("click");
    this.locked = true;
    document.exitPointerLock?.();
    this.letter.show(title, text);
  }

  closeLetter() {
    this.letter.hide();
    this.locked = false;
    this.canvas.requestPointerLock();
  }

  update() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
      this.gamepad.poll(dt);
      
    this.dialogue.update(dt);

    if (!this.locked && this.current) {
      this.player.update(dt, this.camera, this.solids);
      this._syncRegion();
      this._checkInteraction();
    }

    for (const s of this.activeScenes) {
      if (typeof s.onUpdate !== "function") continue;
      try { s.onUpdate(dt); } catch (e) { console.error(e); }
    }

    this.hud.update();
    this.renderer.render(this.scene, this.camera);
  }

  _checkInteraction() {
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    this._pickTick = (this._pickTick || 0) + 1;
    if (this._pickTick % 30 === 0) this._refreshPickables();

    const hits = this.raycaster.intersectObjects(this._pickables, false);
    let target = null;
    for (const h of hits) {
      const obj = h.object;
      // Двери квартир и подъезда стоят физически врозь, но взаимодействие
      // одно на обе стороны — фильтр «объект в текущей сцене» убран.
      if (obj.userData.interactable) {
        target = obj.userData.interactable;
        break;
      }
    }
    this.lookedAt = target;
    this.hud.setPrompt(target ? `[E] ${target.prompt}` : "");
  }

  _bindEvents() {
    window.addEventListener("resize", () => this._resize());

    window.addEventListener("keydown", e => {
      this.keys[e.code] = true;

      // Письмо/записка перекрывает всё
        if (this.letter.visible) {
            if (e.code === "KeyE" || e.code === "Space"
                || e.code === "Enter" || e.code === "Escape") this.closeLetter();
            return;
        }

      // Открыта ИСКРА-ОС — игровой ввод заблокирован, работают только
      // Escape (закрыть меню Пуск или саму ОС) и обычный ввод в элементах.
      if (this.os.isOpen()) {
        if (e.key === "Escape") {
          if (!this.os.handleEsc()) this.closeComputer();
        }
        // не вызываем preventDefault — пусть работают поля ввода, стрелки и т.д.
        return;
      }

      // Диалог — пропустить печать
      if (this.dialogue.visible && (e.code === "KeyE" || e.code === "Space")) {
        this.dialogue.skip();
        return;
      }

      // Взаимодействие в мире
      if (e.code === "KeyE" && this.lookedAt) {
        this.audio.play("click");
        this.lookedAt.interact();
        return;
      }

      if (e.code === "KeyF") location.reload();
    });

    window.addEventListener("keyup", e => { this.keys[e.code] = false; });


      this.canvas.addEventListener("click", () => {
          if (this.touch?.enabled) return;   // на тач-устройстве нет pointer lock
          if (this.locked || this.os.isOpen()) return;
          if (document.pointerLockElement !== this.canvas) {
              this.canvas.requestPointerLock();
          }
      });

    document.addEventListener("mousemove", e => {
      if (document.pointerLockElement === this.canvas) {
        this.player.onMouseMove(e.movementX, e.movementY);
      }
    });
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  restartLoop() {
    this.fadeTransition(() => {
      this.notesRead.clear();
      this.noteLog = [];
      this.inventory = [];
      this.flags = { intro_shown: true, cycled_once: true };
      this.loopCount = 0;
      this.hud.refreshInventory([]);
      this.changeScene("apartment");
      this.locked = false;
      this.os.close();
      this.canvas.requestPointerLock();
      this.dialogue.show(
          "Ты снова здесь. На столе — записка, написанная твоей рукой:\n" +
          "«Ты снова здесь. Не ходи в сорок первую.»\n" +
          "Ты её не писал. Пока.",
          "СИСТЕМА", 8);
    }, 250);
  }

  triggerEnding() {
    this.locked = true;
    this.os.close();
    document.exitPointerLock?.();
    const el = document.getElementById("ending");
    el.classList.remove("hidden");
    const textEl = document.getElementById("ending-text");
    const text = ENDING_TEXT;
    textEl.textContent = "";
    let i = 0;
    const tick = () => {
      if (i >= text.length) return;
      textEl.textContent += text[i++];
      setTimeout(tick, 35);
    };
    tick();
  }
}