// Квартира №42 «Дом»: прихожая, коридор, ванная, кухня, комната с ЭВМ.

import * as THREE from "three";
import { Scene } from "../scene.js";
import { makeBox, makeHitbox, solidBox, glow, makePanel } from "../utils.js";
import { Interactable } from "../interactable.js";
import { APARTMENT_ORIGIN } from "./hallway.js";
import { COLORS } from "../settings.js";
import { buildApartmentShell, EntryDoor, buildEntryCasing, buildWindowFrame } from "./apartment_layout.js";
import {
  furnishHall, furnishCorridor, furnishBath, furnishKitchen, rug, frame, curtains, radiator, plantPot,
  floorLamp, bookshelf, chair, vase, calendar, pictureWall, plantCorner, outsideView, wallClock,
} from "./decor.js";
import { decal, FONTS } from "./text.js";

const APT_HALF  = 3.1;
const HALL_HALF = 1.6;
const CORR_HALF = 0.8;

// Точка пробуждения — на кровати (локальные координаты).
export const BED_SPOT = { x: -1.7, z: 3.9 };

export class ApartmentScene extends Scene {
  constructor(game) {
    super(game);
    this.name = "Кв. 42";
    this.spawn = [BED_SPOT.x + 0.9, 1.7, BED_SPOT.z];
    this.spawnYaw = Math.PI / 2;
    this._rooms = [];
    this._lastRoom = null;
    this._clockT = 0;
  }

  build() {
    const R = this.group;
    this.game.scene.add(R);
    const gm = this.game;

    const shell = buildApartmentShell(R, this.solids, {
      hallDepth: 2.6,
      apartmentWidth: APT_HALF * 2,
      hallWidth: HALL_HALF * 2,
      corridorWidth: CORR_HALF * 2,
      mainRoomName: "Комната",
    });
    this._rooms = shell.rooms;
    this._entryZ = shell.entryZ;
    this.region = shell.region;

    this.entryDoor = new EntryDoor(this, R, {
      entryZ: this._entryZ,
      label: "42",
      onFirstOpen: () => gm.hud.say(
        "Лестничная клетка. Сквозняк. Запах мокрого мела и перегретой изоляции."),
    });
    buildEntryCasing(R, { entryZ: this._entryZ });

    this._buildHall(R);
    this._buildCorridor(R);
    this._buildBath(R);
    this._buildKitchen(R);
    this._buildRoom(R);

    for (const w of shell.windows) {
      buildWindowFrame(R, w);
      outsideView(R, w);
    }

    for (const [lx, lz] of [[0, -2.3], [0, 0.6], [-1.9, 0.6], [2.0, 0.6], [0.5, 3.9]]) {
      glow(makeBox(R, 0.18, 0.1, 0.18, lx, 2.74, lz, COLORS.LAMP), 0xf0dca0, 0.8);
      makeBox(R, 0.02, 0.06, 0.02, lx, 2.78, lz, 0x1a1a1a);
    }
    this.light(0, 2.5, -2.3, { intensity: 3.2, distance: 6 });
    this.light(0, 2.5, 0.6, { intensity: 2.6, distance: 5 });
    this.light(-1.9, 2.5, 0.6, { intensity: 2.2, distance: 4 });
    this.light(2.0, 2.5, 0.6, { intensity: 2.2, distance: 4 });
    this.light(0.5, 2.5, 3.9, { intensity: 4.0, distance: 7 });
    this.light(2.0, 1.1, 4.5, { intensity: 0.8, distance: 3, color: 0x4adf7a });   // экран ЭВМ

    this.place(...APARTMENT_ORIGIN);
  }

  _look(text, sound = null) {
    const gm = this.game;
    return () => {
      if (sound) gm.audio.play(sound);
      gm.hud.say(text);
      if (gm.state.inc("home_looks") >= 3) gm.state.set("looked_home");
    };
  }

  // ── ПРИХОЖАЯ ──────────────────────────────────────────────────
  _buildHall(R) {
    const gm = this.game;
    const z0 = this._entryZ;

    furnishHall(R, this.solids, {
      hhw: HALL_HALF, entryZ: z0,
      onMirror: this._look("В зеркале — я. Только отражение моргнуло на секунду позже.", "glitch"),
    });

    // Бурая надпись на наличнике. Появляется после звонка.
    this._writing = decal(R, "НЕ ВЫХОДИ.\nОНА ЗАМКНУТА.", {
      x: 0.98, y: 1.55, z: z0 + 0.112, face: "n", width: 0.62, style: "rust", px: 110, tilt: -0.04,
    });

    // Глазок — отдельно от двери, чтобы его можно было «найти взглядом».
    const peep = makeHitbox(R, 0.14, 0.14, 0.14, -0.5 + 0.52, 1.62, z0 + 0.06);
    new Interactable(peep, "Посмотреть в глазок", () => {
      gm.audio.play("glitch");
      gm.hud.sequence([
        "За дверью — тишина. Не темнота. Тишина.",
        "Как будто там ничего нет. Как будто там — пустота, которая ждёт.",
      ]);
      gm.state.set("peephole");
    }, { enabled: () => !this.entryDoor.isOpen });
  }

  // ── КОРИДОР ───────────────────────────────────────────────────
  _buildCorridor(R) {
    const gm = this.game;
    const { tableTop } = furnishCorridor(R, this.solids, {
      cw: CORR_HALF,
    });

    const phone = makeBox(R, 0.2, 0.1, 0.22, tableTop.x, tableTop.y + 0.05, tableTop.z, 0x141414);
    const handset = makeBox(R, 0.22, 0.04, 0.06, tableTop.x, tableTop.y + 0.12, tableTop.z, 0x141414);
    const dial = makeBox(R, 0.12, 0.012, 0.12, tableTop.x - 0.04, tableTop.y + 0.105, tableTop.z, 0xb8b0a0);
    new Interactable([phone, handset, dial], "Снять трубку", () => {
      if (this._calling) return;
      this._calling = true;
      gm.audio.play("phone");
      gm.hud.sequence([
        "Я беру трубку. Набираю ноль. Ровный гудок.",
        ["Потом — щелчок. Потом — дыхание. Медленное. Влажное.", { ms: 4200 }],
        "Я слушаю его. Долго. Потом кладу трубку.",
      ]);
      setTimeout(() => gm.audio.play("breath"), 3500);
      setTimeout(() => {
        this._calling = false;
        if (!gm.state.is("phone_heard")) {
          gm.state.set("phone_heard");
          gm.state.learn("dont_exit");
          gm.audio.play("glitch");
          gm.hud.say("На наличнике у входа — бурая надпись. Почерк мой. Я не помню, чтобы писал.", { queue: true });
        }
        if (gm.state.inc("home_looks") >= 3) gm.state.set("looked_home");
      }, 9000);
    });
  }

  // ── ВАННАЯ ────────────────────────────────────────────────────
  _buildBath(R) {
    furnishBath(R, this.solids, {
      hw: APT_HALF, cw: CORR_HALF,
      hooks: {
        tub: this._look("Эмаль. Ржавый след от воды. Свежий. Провожу пальцем — палец буреет. Кто-то мылся здесь минуту назад."),
        mirror: this._look("Зеркало запотело изнутри. Кто-то вывел пальцем на стекле: 04:12.", "glitch"),
      },
    });
    plantPot(R, this.solids, -2.7, 1.05, { s: 0.9 });
  }

  // ── КУХНЯ ─────────────────────────────────────────────────────
  _buildKitchen(R) {
    const gm = this.game;
    const k = furnishKitchen(R, this.solids, { hw: APT_HALF, cw: CORR_HALF });

    new Interactable(k.fridgeParts, "Записка на холодильнике", () => {
      gm.readDoc("fridge");
      if (gm.state.inc("home_looks") >= 3) gm.state.set("looked_home");
    });
    new Interactable(k.stoveParts, "Плита", this._look("Конфорки холодные. А чайник на ней — тёплый."));
    new Interactable(k.kettleParts, "Чайник", this._look(
      "Чайник тёплый. Внутри вода — чистая. Я пью. Тёплая, как будто её вскипятили минуту назад. Кто вскипятил? Я не помню."));
  }

  // ── КОМНАТА ───────────────────────────────────────────────────
  _buildRoom(R) {
    const gm = this.game;
    const S = this.solids;

    // Панцирная кровать, продавленная в форме тела.
    const bed = solidBox(R, S, 1.6, 0.5, 2.4, -1.7, 0.25, 4.2, 0x5a5a58);
    const bedParts = [bed,
      makeBox(R, 1.6, 0.9, 0.08, -1.7, 0.8, 5.42, 0x3c3a36),
      makeBox(R, 1.0, 0.12, 0.4, -1.7, 0.56, 5.05, 0xb0a890),
      makeBox(R, 1.5, 0.08, 1.7, -1.7, 0.54, 3.95, 0x6a5444)];
    new Interactable(bedParts, "Кровать", () => {
      gm.audio.play("creak");
      gm.hud.say(gm.state.loop === 0
        ? "Сетка продавлена в форме моего тела. Я лежал здесь очень давно."
        : "Пружины звенят на другой ноте. Сколько раз я уже просыпался?");
    });
    // Трещины на потолке — «в форме реки».
    const crack = makePanel(R, 2.2, 1.6, 512, 384, (c, w, h) => {
      c.strokeStyle = "rgba(40,36,30,0.75)"; c.lineCap = "round";
      const river = (x, y, a, len, wd) => {
        c.lineWidth = wd; c.beginPath(); c.moveTo(x, y);
        for (let i = 0; i < len; i++) {
          a += (Math.random() - 0.5) * 0.7; x += Math.cos(a) * 9; y += Math.sin(a) * 9;
          c.lineTo(x, y);
          if (Math.random() < 0.06 && wd > 1) { c.stroke(); river(x, y, a + (Math.random() - 0.5) * 2, len / 3, wd * 0.6); c.beginPath(); c.moveTo(x, y); }
        }
        c.stroke();
      };
      river(10, h * 0.6, -0.2, 60, 3.5);
    });
    crack.material.transparent = true;
    crack.rotation.x = Math.PI / 2;
    crack.position.set(-1.6, 2.795, 4.0);
    crack.userData.noPick = true;

    // Тумбочка, лампа, фото Тани.
    solidBox(R, S, 0.4, 0.5, 0.4, -0.65, 0.25, 5.25, 0x4a3a2c);
    glow(makeBox(R, 0.22, 0.16, 0.22, -0.7, 0.62, 5.3, 0xd8c890), 0xf0dca0, 0.8);
    const photo = makePanel(R, 0.13, 0.17, 130, 170, (c, w, h) => {
      c.fillStyle = "#e8e0c8"; c.fillRect(0, 0, w, h);
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#8a7a62"); g.addColorStop(1, "#4a3e30");
      c.fillStyle = g; c.fillRect(8, 8, w - 16, h - 34);
      c.fillStyle = "#c8b49a"; c.beginPath(); c.ellipse(w / 2, 62, 22, 28, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#3a2a1e"; c.beginPath(); c.ellipse(w / 2, 48, 28, 22, 0, Math.PI, 0); c.fill();
      c.fillStyle = "#2a2a3a"; c.fillRect(w / 2 - 30, 92, 60, 44);
      c.fillStyle = "#3a3026"; c.font = `600 18px ${FONTS.hand}`; c.textAlign = "center";
      c.fillText("Таня, 1987", w / 2, h - 10);
    });
    photo.position.set(-0.55, 0.58, 5.18);
    photo.rotation.y = Math.PI + 0.35;
    photo.rotation.x = -0.15;
    new Interactable(photo, "Фотография", () => {
      gm.hud.sequence([
        "Таня. На обороте: «Лёше. Не забывай ужинать».",
        "Она ушла к маме, потому что я не ночевал дома. Может быть, она всё ещё ждёт.",
      ]);
      gm.state.set("saw_tanya");
    });

    plantPot(R, S, -2.75, 5.2, { s: 1.2 });

    // Настенные часы — на 04:12. Секундная стрелка дрожит.
    this._clock = wallClock(R, -3.0, 1.95, 3.6, "e", { r: 0.2 });
    const clockHit = makeHitbox(R, 0.12, 0.44, 0.44, -2.9, 1.95, 3.6);
    new Interactable(clockHit, "Часы", () => {
      gm.hud.sequence([
        "Секундная стрелка дрожит, но не двигается. Я смотрю на неё минуту. Две.",
        "Она стоит. 04:12. Сегодня — 14 ноября 1988 года.",
      ]);
      gm.state.learn("date");
      gm.state.set("looked_home");
    });

    // Шкаф
    const wardrobe = solidBox(R, S, 1.2, 2.2, 0.6, 2.3, 1.1, 2.6, 0x5a4535);
    const wParts = [wardrobe,
      makeBox(R, 0.015, 2.0, 0.02, 2.3, 1.1, 2.905, 0x2a1e14),
      makeBox(R, 0.04, 0.2, 0.03, 2.25, 1.1, 2.915, 0x8a8060),
      makeBox(R, 0.04, 0.2, 0.03, 2.35, 1.1, 2.915, 0x8a8060)];
    new Interactable(wParts, "Шкаф", this._look(
      "Три одинаковых пиджака на плечиках. Все — на мой размер. На одном — пропуск ВЦ «Прибор»."));

    // Рабочий стол с ЭВМ «Искра-1030»
    const dx = 2.0, dz = 4.9;
    const deskParts = [
      makeBox(R, 2.0, 0.05, 1.1, dx, 0.725, dz, COLORS.DESK),
      makeBox(R, 0.05, 0.7, 1.0, dx - 0.95, 0.35, dz, COLORS.DESK),
      makeBox(R, 0.5, 0.7, 0.95, dx + 0.7, 0.35, dz, COLORS.DESK),
    ];
    S.push({ min: [dx - 1.0, 0, dz - 0.55], max: [dx + 1.0, 0.75, dz + 0.55] });
    const monitor = makeBox(R, 0.55, 0.45, 0.55, dx + 0.1, 0.975, dz, 0xb8b2a0);
    this._screen = makePanel(R, 0.42, 0.32, 256, 192, (c, w, h) => this._drawScreen(c, w, h), { emissive: 1.0 });
    this._screen.position.set(dx + 0.1, 1.0, dz - 0.281);
    this._screen.rotation.y = Math.PI;
    const unit = makeBox(R, 0.5, 0.18, 0.5, dx + 0.65, 0.84, dz + 0.05, 0xb8b2a0);
    const lockKey = makeBox(R, 0.03, 0.03, 0.02, dx + 0.5, 0.84, dz - 0.2, 0x2a2a2a);
    const kbd = makeBox(R, 0.55, 0.03, 0.2, dx - 0.25, 0.765, dz - 0.3, 0x8a8478);
    deskParts.push(monitor, this._screen, unit, kbd, lockKey);
    makeBox(R, 0.08, 0.1, 0.08, dx - 0.7, 0.8, dz + 0.25, 0x6a3a2a);

    // Записка на столе (после финала А — «Ты снова здесь»)
    this._tableNote = makeBox(R, 0.2, 0.012, 0.26, dx - 0.72, 0.756, dz - 0.15, COLORS.NOTE);
    new Interactable(this._tableNote, "Записка", () => gm.readDoc("tablenote42"),
      { enabled: () => this._tableNote.visible });

    const hot = makeHitbox(R, 1.4, 1.4, 1.2, dx + 0.2, 1.0, dz - 0.1);
    new Interactable([hot, ...deskParts], "Сесть за ЭВМ «Искра-1030»", () => gm.openTerminal());
    chair(R, S, dx, 3.85, "s");

    rug(R, 0.5, 3.8, 2.6, 1.8, 0x5a3a2a, 0x3a2418);
    bookshelf(R, S, -2.825, 2.8, 0.35, 0.9, 1.9, "w");
    floorLamp(R, S, 2.7, 3.2);
    pictureWall(R, -2.4, 1.75, 5.5, "s", [
      { u: -0.2, w: 0.55, h: 0.45, art: "landscape" },
    ]);
    frame(R, 3.0, 1.55, 3.5, "w", 0.5, 0.65, "abstract");
    calendar(R, 3.0, 1.75, 4.9, "w");
    frame(R, 1.0, 1.8, 2.3, "n", 0.45, 0.6, "poster");
    plantCorner(R, S, -2.75, 2.6, { s: 0.9 });
    curtains(R, 0.3, 5.5, "s", { w: 2.4 + 0.3, sides: [-1] });
    radiator(R, 0.3, 5.5, "s", 1.2);
    vase(R, 0.9, 0.0, 5.25, { color: 0x6a5a3a });
  }

  _drawScreen(c, w, h) {
    c.fillStyle = "#04140a"; c.fillRect(0, 0, w, h);
    c.fillStyle = "#5af08a";
    c.font = `15px ${FONTS.mono}`;
    const lines = ["ИСКРА-1030  640K", "", "C:\\> _", "", "", "", "", "04:12"];
    lines.forEach((l, i) => c.fillText(l, 12, 22 + i * 20));
    for (let y = 0; y < h; y += 3) { c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(0, y, w, 1); }
  }

  sync() {
    const s = this.game.state;
    this._writing.visible = s.is("phone_heard");
    this._tableNote.visible = s.is("cycle_note");
  }

  onUpdate(dt) {
    this.updateDoors(dt);
    // Секундная стрелка дрожит, но не двигается.
    this._clockT += dt;
    const sh = this._clock?.userData.secondHand;
    if (sh) sh.rotation.z = -0.37 + Math.sin(this._clockT * 40) * 0.015 * (Math.sin(this._clockT * 1.3) > 0.6 ? 1 : 0);

    const gm = this.game;
    if (gm.current !== this) return;
    const l = this.toLocal(gm.player.position);
    const room = this._rooms.find(r => l.x >= r.x0 && l.x <= r.x1 && l.z >= r.z0 && l.z <= r.z1);
    if (room && room.id !== this._lastRoom) {
      this._lastRoom = room.id;
      gm.hud.setLocation(`Кв. 42 · ${room.name}`);
    }
  }

  onEnter() { this._lastRoom = null; }
}
