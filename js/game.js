// Центральный объект игры: мир, игрок, ввод, сюжет, интерфейс.
//
// Все квартиры стоят в мире одновременно. Текущая сцена определяется по
// региону, в котором стоит игрок. Квартиры на других этажах скрываются —
// их всё равно не видно, а рисовать их дорого.

import * as THREE from "three";
import { SETTINGS, COLORS } from "./settings.js";
import { EventBus } from "./core/events.js";
import { GameState, SAVE_KEY } from "./core/state.js";
import { Input } from "./core/input.js";
import { LightPool } from "./core/lights.js";
import { StoryDirector, ACTS } from "./core/story.js";
import { AudioManager } from "./audio.js";
import { Player } from "./player.js";
import { HUD } from "./ui/hud.js";
import { DocView } from "./ui/docview.js";
import { Notebook } from "./ui/notebook.js";
import { PauseMenu, Effects, EndingScreen } from "./ui/menus.js";
import { TouchControls } from "./ui/touch.js";
import { GamepadInput } from "./ui/gamepad.js";
import { Terminal } from "./terminal/terminal.js";
import { FuseboxPuzzle } from "./puzzles/fusebox.js";
import { ChessPuzzle } from "./puzzles/chess.js";
import { RadioPuzzle } from "./puzzles/radio.js";
import { TapePuzzle } from "./puzzles/tape.js";
import { TelescopePuzzle } from "./puzzles/telescope.js";
import { StampsPuzzle } from "./puzzles/stamps.js";
import { ChoicePuzzle } from "./puzzles/choice.js";
import { CodeLock } from "./puzzles/codelock.js";
import { ApartmentScene, BED_SPOT } from "./world/apartment.js";
import { HallwayScene } from "./world/hallway.js";
import {
  Neighbor20Scene, Neighbor30Scene, Neighbor40Scene, Neighbor41Scene,
  Neighbor43Scene, Neighbor44Scene, Neighbor50Scene,
} from "./world/neighbors.js";
import { DOCS } from "./data/docs.js";
import { cachedMaterials, setMaxAniso } from "./utils.js";
import { buildCity } from "./world/city.js";

const FOG_NEAR = 4, FOG_FAR = 24;
const ARG_KEY = "recursion1988_arg";

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.running = false;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setClearColor(0x1a1816);
    setMaxAniso(Math.min(16, this.renderer.capabilities.getMaxAnisotropy()));

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x24211e, FOG_NEAR, FOG_FAR);
    this.hemi = new THREE.HemisphereLight(0x8a8274, 0x2a2620, 0.55);
    this.scene.add(this.hemi);
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 140);
    this.scene.add(this.camera);

    this.bus = new EventBus();
    this.state = new GameState(this.bus);
    this.state.extraSave = () => this._extraSave();

    this.audio = new AudioManager();
    this.player = new Player(this);
    this.hud = new HUD(this);
    this.input = new Input(this);
    this.lights = new LightPool(this.scene);
    this.effects = new Effects(this);
    this.docs = new DocView(this);
    this.notebook = new Notebook(this);
    this.pauseMenu = new PauseMenu(this);
    this.endingScreen = new EndingScreen(this);
    this.terminal = new Terminal(this);
    this.puzzles = {
      fusebox: new FuseboxPuzzle(this),
      chess: new ChessPuzzle(this),
      radio: new RadioPuzzle(this),
      tape: new TapePuzzle(this),
      telescope: new TelescopePuzzle(this),
      stamps: new StampsPuzzle(this),
      choice: new ChoicePuzzle(this),
      codelock: new CodeLock(this),
    };
    this.touch = new TouchControls(this);
    this.gamepad = new GamepadInput(this);

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = SETTINGS.INTERACT_DISTANCE;
    this.lookedAt = null;
    this.clock = new THREE.Clock();
    this.scenes = {};
    this.solids = [];
    this.current = null;

    window.addEventListener("resize", () => this._resize());
    window.addEventListener("focus", () => this.checkArgProgress());
    window.addEventListener("storage", (e) => { if (e.key === ARG_KEY) this.checkArgProgress(); });
    this._resize();
    this._bindStory();
  }

  // ── Мир ──────────────────────────────────────────────────
  build() {
    buildCity(this.scene);
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
    this.solids = [];
    for (const [key, s] of Object.entries(this.scenes)) {
      try { s.build(); s._built = true; }
      catch (e) { console.error(`Сцена «${key}» не построилась:`, e); continue; }
      s.activate();
      s.registerLights(this.lights);
      this.solids.push(...s.solids);
      s._pick = [];
      s.group.traverse(o => { if (o.isMesh && !o.userData.noPick) s._pick.push(o); });
    }
    this.director = new StoryDirector(this);
  }

  syncWorld() {
    for (const s of Object.values(this.scenes)) {
      try { s.sync(); } catch (e) { console.error(e); }
    }
  }

  _bindStory() {
    const bus = this.bus;
    bus.on("flag", () => this.syncWorld());
    bus.on("item:add", ({ item }) => {
      this.audio.play("item");
      this.hud.toast("В карман", item.name, "item");
    });
    bus.on("clue:add", ({ clue }) => {
      this.audio.play("pencil");
      this.hud.toast("Записано в тетрадь", clue.title, "clue");
    });
  }

  // ── Запуск ───────────────────────────────────────────────
  async start({ load = null } = {}) {
    this.audio.ensure();
    if (load) this.state.load(load);
    else { this.state.reset(); GameState.clearSave(); }

    this.director.restore();
    this.syncWorld();
    this.running = true;
    this.hud.show();
    this.audio.startAmbient();

    const apt = this.scenes.apartment;
    this.current = apt;
    const ex = load && load.extra;
    if (ex && ex.pos) {
      this.player.setPosition(ex.pos[0], ex.pos[1], ex.pos[2]);
      this.player.yaw = ex.yaw || 0;
      this._syncRegion(true);
      this.input.lock();
      this.hud.fade(false, 1400);
      this.hud.say("…04:12. Я снова здесь.");
    } else {
      await this.wakeUp({ intro: true });
    }
    this.state.save();
  }

  _extraSave() {
    const p = this.player.position;
    return { pos: [p.x, p.y, p.z], yaw: this.player.yaw };
  }

  // Пробуждение на кровати. Используется в начале, после смерти и в финале А.
  async wakeUp({ intro = false, deathText = null } = {}) {
    const apt = this.scenes.apartment;
    const gate = { onKeyDown: () => {}, keepLock: true };   // на время сцены — никакого ввода
    this.input.push(gate);
    for (const sc of Object.values(this.scenes)) sc.resetDoors?.();

    const local = new THREE.Vector3(BED_SPOT.x, 0.85, BED_SPOT.z);
    apt.group.localToWorld(local);
    const stand = new THREE.Vector3(BED_SPOT.x + 1.3, SETTINGS.PLAYER_HEIGHT, BED_SPOT.z - 0.2);
    apt.group.localToWorld(stand);
    stand.y = apt.group.position.y + SETTINGS.PLAYER_HEIGHT;

    this.current = apt;
    this.player.setPosition(local.x, local.y, local.z);
    this.player.yaw = Math.PI / 2 + apt.group.rotation.y;
    this.player.pitch = 1.35;
    this._cinematic = { from: local.clone(), to: stand, t: 0, dur: 3.2, pitch0: 1.35 };
    this._syncRegion(true);

    await this.hud.fade(false, 2200);
    if (intro) {
      this.hud.sequence([
        "Я открываю глаза. Сетка кровати продавлена в форме моего тела.",
        "Потолок серый, с трещинами в форме реки. На столе гудит ЭВМ «Искра-1030».",
        "Настенные часы стоят на 04:12. Я не помню, как здесь оказался.",
      ]);
    } else if (deathText !== null) {
      this.hud.sequence([
        "Темнота. А потом — снова свет. И я снова здесь. На этой кровати.",
        `04:12. Виток ${this.state.loop}.`,
      ]);
    }
    await new Promise(r => setTimeout(r, intro ? 3600 : 2600));
    this._cinematic.go = performance.now();
    await new Promise(r => setTimeout(r, this._cinematic.dur * 1000 + 150));
    this.player.setPosition(stand.x, stand.y, stand.z);
    this.player.pitch = 0;
    this.player.grounded = true;
    this._cinematic = null;
    this.input.pop(gate);
    if (intro && !this.state.is("intro_hint")) {
      this.state.set("intro_hint");
      this.hud.toast("Тетрадь", "Tab — задачи, записи, найденное", "clue");
    }
  }

  // «Смерть — это не конец. Смерть — это интерфейс.»
  async die(text) {
    if (this._dying) return;
    this._dying = true;
    for (const o of [...this.input.layers]) o.close?.();
    this.audio.silenceLoops();
    this.audio.play("death");
    this.effects.glitch(1.5);
    await this.hud.fade(true, 900);
    this.hud.clearCaptions();
    await this.effects.deathCard(text);
    this.state.deaths += 1;
    this.state.loop += 1;
    this.state.changed();
    this._dying = false;
    await this.wakeUp({ deathText: text });
  }

  // ── События сюжета, затрагивающие весь мир ───────────────
  powerOn() {
    const s = this.state;
    s.set("power_on");
    this.audio.play("powerOn");
    this.effects.shake(1.6);
    let k = 0;
    const iv = setInterval(() => {
      k += 1;
      this.lights.setGroupLevel("hall", k > 8 ? 1 : (Math.random() < 0.5 ? 0.15 : 0.9));
      if (k > 8) clearInterval(iv);
    }, 140);
    this.hud.sequence([
      "Синий предохранитель. Красный рубильник — вверх.",
      "Здание содрогается. Где-то внизу воет трансформатор. Свет заливает коридоры.",
      "Я слушаю, как оживает дом. Как оживает то, что должно было умереть.",
      "В сорок первой квартире сам собой поёт радиоприёмник.",
    ]);
  }

  // После досье мир начинает распадаться.
  worldDecay() {
    if (this._decayed) return;
    this._decayed = true;
    this.canvas.classList.add("decay");
    document.body.classList.add("decay");
    const walls = [COLORS.WALL, COLORS.WALL_DARK, 0x6a5a4a, 0x8a9080, 0x6a6a60, 0x4a4438, 0x707880, 0x505870];
    for (const [color, m] of cachedMaterials()) {
      if (!walls.includes(color)) continue;
      m.transparent = true;
      m.opacity = 0.55;
      m.depthWrite = false;
      m.needsUpdate = true;
    }
    this.audio.decay();
  }

  checkArgProgress() {
    try {
      const d = JSON.parse(localStorage.getItem(ARG_KEY) || "{}");
      if (d.visited && d.visited.includes("shit")) this.state.set("arg_opened");
    } catch (_) { /* нет данных — ничего */ }
  }

  // ── Финалы ───────────────────────────────────────────────
  async ending(kind) {
    this.running = false;
    for (const o of [...this.input.layers]) o.close?.();
    this.audio.silenceLoops();
    this.hud.clearCaptions();
    GameState.setMeta({ ["ending_" + kind]: (GameState.meta()["ending_" + kind] || 0) + 1 });

    if (kind === "A") {
      // Рекурсивный виток: вспышка, всё заново, но с запиской на столе.
      this.audio.play("whiteFlash");
      await this.hud.fade(true, 900, "#fff");
      await this.endingScreen.show("A");
      this.state.reset();
      this.state.loop = 0;
      this.state.set("cycle_note");
      this.state.set("intro_hint");
      this.state.flags.cycles = (GameState.meta().ending_A || 1);
      this._decayed = false;
      this.canvas.classList.remove("decay");
      document.body.classList.remove("decay");
      for (const [, m] of cachedMaterials()) if (m.transparent && m.opacity < 1) { m.transparent = false; m.opacity = 1; m.depthWrite = true; m.needsUpdate = true; }
      this.terminal._booted = false;
      this.director.restore();
      this.syncWorld();
      this.running = true;
      await this.hud.fade(true, 30, "#000");
      await this.wakeUp({});
      this.hud.sequence([
        "На столе — свежая записка, выведенная моей собственной рукой.",
        "Цикл начинается заново.",
      ]);
      this.state.save();
      return;
    }

    if (kind === "B") {
      GameState.clearSave();
      this.state.set("ending_final");
      // Камера плавно отдаляется от стола, геометрия растворяется в темноте.
      this._pullback = { t: 0 };
      this.audio.fadeOut(5);
      await new Promise(r => setTimeout(r, 5500));
      this.audio.play("relay");
      await this.hud.fade(true, 1200);
      await this.endingScreen.show("B");
      return;
    }

    if (kind === "C") {
      GameState.clearSave();
      this.state.set("ending_final");
      this.audio.play("whiteFlash");
      await this.hud.fade(true, 2500, "#f4f4ee");
      await this.endingScreen.show("C");
    }
  }

  showActCard(act) {
    if (this.state.is("ending_chosen") || !this.running) return;
    // Не перебиваем открытое окно: ждём, пока игрок вернётся в мир.
    if (this.input.layers.length || this._cinematic || this._dying) {
      setTimeout(() => this.showActCard(act), 600);
      return;
    }
    this.hud.actCard(act, () => {
      if (act.n > 1) this.hud.toast("Тетрадь обновлена", "Tab — новая задача", "clue");
    });
  }

  // ── Документы, ЭВМ, пауза ────────────────────────────────
  readDoc(id, after = null) {
    const d = DOCS[id];
    if (!d) return;
    this.state.readDoc({ id, ...d });
    this.docs.show(d, after);
  }

  openTerminal() { this.terminal.open(); }

  pause() {
    if (!this.running || this.pauseMenu.isOpen) return;
    this.pauseMenu.open();
  }

  // ── Кадр ─────────────────────────────────────────────────
  update() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.gamepad.poll(dt);

    if (this._cinematic) this._updateCinematic(dt);
    else if (this.running && this.input.gameplay) {
      this.player.update(dt, this.camera, this.solids, this.input.keys);
      this._fallGuard(dt);
      this._syncRegion();
      this._checkInteraction();
    } else {
      this.player.applyCamera(this.camera);
      this.hud.setPrompt("");
    }
    if (this._pullback) this._updatePullback(dt);

    for (const s of Object.values(this.scenes)) {
      if (!s._built) continue;
      try { s.onUpdate(dt); } catch (e) { console.error(e); }
    }
    this._cull();
    this.lights.update(dt, this.player.position);
    this.effects.update(dt);
    this.hud.update();
    this.renderer.render(this.scene, this.camera);
  }

  // Страховка от провала сквозь пол: запоминаем последнюю твёрдую точку.
  _fallGuard(dt) {
    const p = this.player;
    if (p.grounded) {
      this._safeT = (this._safeT || 0) - dt;
      if (this._safeT <= 0) { this._safeT = 0.5; this._safe = p.position.clone(); }
    } else if (p.velocityY < -14 && this._safe) {
      p.setPosition(this._safe.x, this._safe.y + 0.05, this._safe.z);
    }
  }

  _updateCinematic(dt) {
    const c = this._cinematic;
    if (c.go) {
      // по реальному времени: на слабой машине сцена не растягивается
      c.t = Math.min(c.dur, (performance.now() - c.go) / 1000);
      const k = c.t / c.dur;
      const e = k * k * (3 - 2 * k);
      this.player.position.lerpVectors(c.from, c.to, e);
      this.player.pitch = c.pitch0 * (1 - e) - 0.05 * Math.sin(e * Math.PI);
    }
    this.player.applyCamera(this.camera);
  }

  _updatePullback(dt) {
    const p = this._pullback;
    p.t += dt;
    // отъезд назад и вверх + гаснущий свет
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(this.camera.quaternion);
    this.camera.position.addScaledVector(back, dt * 0.6);
    this.camera.position.y += dt * 0.15;
    const k = Math.max(0, 1 - p.t / 5);
    this.hemi.intensity = 0.55 * k;
    this.lights.setGroupLevel("default", k);
    this.lights.setGroupLevel("hall", k);
    this.scene.fog.far = Math.max(0.5, FOG_FAR * k);
    this.scene.fog.near = Math.min(this.scene.fog.near, this.scene.fog.far * 0.2);
  }

  _syncRegion(force = false) {
    const p = this.player.position;
    let target = null;
    for (const s of Object.values(this.scenes)) {
      if (s === this.scenes.hallway || !s.region) continue;
      if (s.containsPoint(p)) { target = s; break; }
    }
    if (!target && this.scenes.hallway?.containsPoint(p)) target = this.scenes.hallway;
    if (!target || (target === this.current && !force)) return;
    if (this.current && this.current !== target) { try { this.current.onExit(); } catch (e) { console.error(e); } }
    this.current = target;
    this.lights.force();
    try { target.onEnter(); } catch (e) { console.error(e); }
    this.hud.setLocation(target.name);
    // В бюрократическом кошмаре вахтёрская уходит в туман.
    const dense = target === this.scenes.neighbor_40 && this.state.is("bureau");
    this.scene.fog.near = dense ? 1.5 : FOG_NEAR;
    this.scene.fog.far = dense ? 9 : FOG_FAR;
  }

  // Квартиры с других этажей не рисуем.
  _cull() {
    const feet = this.player.position.y - this.player.height;
    this._pickList = [];
    for (const s of Object.values(this.scenes)) {
      if (!s._built) continue;
      const vis = s === this.scenes.hallway || Math.abs(s.floorY - feet) < 3.2;
      s.group.visible = vis;
      if (vis) for (const m of s._pick) this._pickList.push(m);
    }
  }

  _checkInteraction() {
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    const hits = this.raycaster.intersectObjects(this._pickList || [], false);
    let target = null;
    for (const h of hits) {
      const o = h.object;
      if (!isShown(o)) continue;
      const it = o.userData.interactable;
      if (it && it.active) target = it;
      break;   // первое видимое препятствие закрывает всё, что за ним
    }
    this.lookedAt = target;
    this.hud.setPrompt(target ? target.getPrompt() : "");
  }

  interact() {
    const t = this.lookedAt;
    if (!t) return;
    this.audio.play("click");
    t.interact();
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}

function isShown(o) {
  for (let n = o; n; n = n.parent) if (!n.visible) return false;
  return true;
}

export { ACTS, SAVE_KEY };
