// Соседние квартиры: 20, 30, 40, 41, 43, 44, 50.
// Все стоят физически в мире за своими дверьми — переход бесшовный.
// Что открыто и что видно — решают флаги состояния (см. sync()).

import * as THREE from "three";
import { Scene } from "../scene.js";
import { makeBox, makeHitbox, solidBox, glow, makePanel } from "../utils.js";
import { Interactable } from "../interactable.js";
import { COLORS } from "../settings.js";
import { apartmentOrigin } from "./hallway.js";
import { buildApartmentShell, buildWindowFrame, buildEntryCasing, EntryDoor, NORTH_Z } from "./apartment_layout.js";
import {
  furnishHall, furnishCorridor, furnishBath, furnishKitchen, rug, frame, curtains, radiator,
  floorLamp, bookshelf, chair, table, sofa, calendar, wallClock, outsideView, clutterShelf,
} from "./decor.js";
import { decal, plate, FONTS } from "./text.js";

const NEIGHBOR_WIDTH    = 4.8;
const NEIGHBOR_CORRIDOR = 1.6;

class BaseApartmentScene extends Scene {
  constructor(game, num) {
    super(game);
    this.num = num;
    this.name = `Кв. ${num}`;
    this.spawn = [0, 1.7, 3.4];
    this.spawnYaw = Math.PI;

    this.mainRoomName = "Комната";
    this.wallColor3D = null;
    this.floorOverrides = null;
    this.sharedEast = false;
    this.balcony = false;
    this.blindNorth = false;
    this.curtainSides = [-1, 1];
    this.lockedText = null;     // () => текст отказа или null
    this.ajar = () => true;
    this._lastRoom = null;
  }

  build() {
    const R = this.group;
    const gm = this.game;
    gm.scene.add(R);

    const shell = buildApartmentShell(R, this.solids, {
      hallDepth: 2.6,
      apartmentWidth: NEIGHBOR_WIDTH,
      corridorWidth: NEIGHBOR_CORRIDOR,
      wallColor: this.wallColor3D || COLORS.WALL,
      floorOverrides: this.floorOverrides || {},
      sharedEast: this.sharedEast,
      mainRoomName: this.mainRoomName,
      balcony: this.balcony,
      blindNorth: this.blindNorth,
    });
    this._rooms = shell.rooms;
    this._entryZ = shell.entryZ;
    this.region = shell.region;
    this.dims = shell.dims;

    this.entryDoor = new EntryDoor(this, R, {
      entryZ: shell.entryZ, label: this.num,
      locked: () => this.lockedText ? this.lockedText() : null,
      ajar: () => this.ajar(),
    });
    buildEntryCasing(R, { entryZ: shell.entryZ });

    for (const [lx, lz] of [[0, -2.3], [0, 0.6], [-1.6, 0.6], [1.6, 0.6], [0, 3.9]]) {
      glow(makeBox(R, 0.18, 0.1, 0.18, lx, 2.74, lz, COLORS.LAMP), 0xf0dca0, 0.8);
    }
    this.light(0, 2.5, -2.3, { intensity: 3.0, distance: 6 });
    this.light(0, 2.5, 0.6, { intensity: 2.2, distance: 5 });
    this.light(-1.6, 2.5, 0.6, { intensity: 1.6, distance: 4 });
    this.light(1.6, 2.5, 0.6, { intensity: 1.6, distance: 4 });
    this.light(0, 2.5, 3.9, { intensity: 4.0, distance: 7 });

    for (const w of shell.windows) {
      buildWindowFrame(R, w);
      if (!w.noView) outsideView(R, w);
    }

    this._furnishCommon(R, shell.dims);
    this._buildProps(R);

    const o = apartmentOrigin(this.num);
    if (o) this.place(o.x, o.y, o.z, o.rotY);
    else console.warn(`apartmentOrigin(${this.num}) не найден`);
  }

  _furnishCommon(R, d) {
    const gm = this.game, S = this.solids;
    const say = (t, snd = null) => () => { if (snd) gm.audio.play(snd); gm.hud.say(t); };

    furnishHall(R, S, {
      hhw: d.hhw, entryZ: d.entryZ,
      onMirror: say("Мутное зеркало. Моё лицо в нём кажется чужим.", "glitch"),
    });
    furnishCorridor(R, S, { cw: d.cw });
    furnishBath(R, S, {
      hw: d.hw, cw: d.cw,
      hooks: {
        tub: say("Ванна сухая. На дне — ржавый след от капель, которых давно нет."),
        mirror: say("Зеркало запотело. На стекле — отпечаток ладони. Моей.", "glitch"),
      },
    });
    const k = furnishKitchen(R, S, { hw: d.hw, cw: d.cw, hasWindow: !this.sharedEast });
    new Interactable(k.fridgeParts, "Холодильник",
      say("Холодильник гудит, но внутри пусто. Лампочка мигает в такт чему-то далёкому.", "click"));
    new Interactable(k.stoveParts, "Плита", say("Плита холодная. На конфорке — кольцо от давно снятого чайника."));

    if (!this.balcony && !this.blindNorth) {
      radiator(R, 0.3, 5.5, "s", 1.2);
      curtains(R, 0.3, 5.5, "s", { w: 2.4 + 0.3, sides: this.curtainSides });
    }
  }

  _buildProps(R) { /* override */ }

  // Бумага на тумбочке/столе → документ.
  _paper(R, x, y, z, docId, prompt = "Прочитать", { w = 0.22, d = 0.3, color = COLORS.NOTE, rot = 0, enabled = null } = {}) {
    const m = makeBox(R, w, 0.012, d, x, y + 0.006, z, color);
    m.rotation.y = rot;
    new Interactable(m, prompt, () => this.game.readDoc(docId), { enabled });
    return m;
  }

  onUpdate(dt) {
    this.updateDoors(dt);
    const gm = this.game;
    if (gm.current !== this) return;
    const l = this.toLocal(gm.player.position);
    const room = this._rooms.find(r => l.x >= r.x0 && l.x <= r.x1 && l.z >= r.z0 && l.z <= r.z1);
    const id = room ? room.id : (l.z > NORTH_Z ? "balcony" : null);
    if (id && id !== this._lastRoom) {
      this._lastRoom = id;
      gm.hud.setLocation(`${this.name} · ${room ? room.name : "Балкон"}`);
    }
  }

  onEnter() {
    this._lastRoom = null;
    this.game.state.set("visited_" + this.num);
  }
}

// ================== №20 — «Библиотека» ==================
export class Neighbor20Scene extends BaseApartmentScene {
  constructor(game) {
    super(game, "20");
    this.name = "Кв. 20";
    this.mainRoomName = "Читальный зал";
    this.wallColor3D = 0x6a5a4a;
    this.lockedText = () => game.state.is("unlock_20") ? null
      : "Заперто. Из-под двери пахнет пылью и старой бумагой. Здесь нет света.";
    this.ajar = () => game.state.is("unlock_20");
  }

  _buildProps(R) {
    const gm = this.game, S = this.solids;

    // Полки уходят под потолок — вдоль трёх стен.
    const sh1 = bookshelf(R, S, -2.15, 3.3, 0.4, 2.0, 2.6, "w");
    const sh2 = bookshelf(R, S, 2.15, 3.3, 0.4, 2.0, 2.6, "e");
    const sh3 = bookshelf(R, S, -1.6, 5.35, 1.2, 0.4, 2.6, "n");
    new Interactable([...sh1, ...sh2, ...sh3].filter(Boolean), "Полки", () => {
      gm.hud.say("«Кибернетика и сознание». «Дискретные автоматы». «Шахматные этюды». Я знаю эти книги. Я читал их. Когда-то.");
    });

    // Резной дубовый столик с шахматами.
    const tx = 0.6, tz = 4.3;
    const tParts = [
      makeBox(R, 0.9, 0.06, 0.9, tx, 0.72, tz, 0x5a3a20),
      makeBox(R, 0.7, 0.66, 0.7, tx, 0.36, tz, 0x4a2e18),
    ];
    S.push({ min: [tx - 0.45, 0, tz - 0.45], max: [tx + 0.45, 0.75, tz + 0.45] });
    const board = makePanel(R, 0.5, 0.5, 256, 256, (c, w, h) => {
      const q = w / 8;
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
        c.fillStyle = (i + j) % 2 ? "#5a3a22" : "#d8c4a0";
        c.fillRect(i * q, j * q, q, q);
      }
      const piece = (file, rank, col) => {
        c.fillStyle = col; c.beginPath();
        c.arc((file + 0.5) * q, (7 - rank + 0.5) * q, q * 0.32, 0, Math.PI * 2); c.fill();
      };
      piece(6, 6, "#f4f0e4"); piece(7, 5, "#f4f0e4");   // Кр g7, п h6
      piece(6, 4, "#1a1a1a"); piece(7, 6, "#1a1a1a");   // Кр g5, п h7
    });
    board.rotation.x = -Math.PI / 2;
    board.position.set(tx, 0.752, tz);
    this._kingPiece = makeBox(R, 0.04, 0.09, 0.04, tx + (6 - 3.5) * 0.0625, 0.8, tz - (4 - 3.5) * 0.0625, 0x141414);
    new Interactable([board, this._kingPiece, ...tParts], "Шахматный этюд", () => gm.puzzles.chess.open());

    // Тайник в торце столика — открывается после решения.
    this._stash = makeBox(R, 0.3, 0.1, 0.04, tx, 0.62, tz - 0.47, 0x2a1a0e);

    chair(R, S, tx, 3.6, "s");
    // Формуляр и рукопись — на соседнем столе.
    table(R, S, -1.0, 4.6, 1.2, 0.7, 0.76, COLORS.DESK);
    glow(makeBox(R, 0.16, 0.22, 0.16, -1.45, 0.87, 4.75, 0x2a6a3a), 0xa0e0b0, 0.5);   // зелёная лампа
    this._paper(R, -0.8, 0.76, 4.5, "formular20", "Библиотечный формуляр", { color: 0xe8dcb8, rot: 0.15 });
    this._paper(R, -1.15, 0.76, 4.45, "manuscript20", "Рукопись", { w: 0.24, d: 0.32, color: 0xd8d0b8, rot: -0.1 });

    floorLamp(R, S, 1.9, 5.2);
    rug(R, 0.2, 3.9, 2.4, 1.6, 0x4a2a22, 0x2e1a14);
  }

  sync() {
    const s = this.game.state;
    this._kingPiece.visible = !s.has("punchcard");
    this._stash.scale.x = s.has("punchcard") ? 0.2 : 1;
  }
}

// ================== №30 — «Лазарет» ==================
export class Neighbor30Scene extends BaseApartmentScene {
  constructor(game) {
    super(game, "30");
    this.name = "Кв. 30";
    this.mainRoomName = "Палата";
    this.wallColor3D = 0x8a9080;
    this.floorOverrides = { hall: 0x707a70, bath: 0x889888, bedroom: 0x8a9488 };
    this.lockedText = () => game.state.is("unlock_30") ? null : "Заперто. Пахнет хлоркой и страхом.";
    this.ajar = () => game.state.is("unlock_30");
  }

  _buildProps(R) {
    const gm = this.game, S = this.solids;

    // Белый кафель до середины стены.
    for (const [x, face] of [[-2.29, "e"], [2.29, "w"]]) {
      makePanel(R, 3.3, 1.5, 256, 128, (c, w, h) => {
        c.fillStyle = "#d8dcd0"; c.fillRect(0, 0, w, h);
        c.strokeStyle = "#a8aca0"; c.lineWidth = 1;
        for (let i = 0; i <= w; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); }
        for (let j = 0; j <= h; j += 16) { c.beginPath(); c.moveTo(0, j); c.lineTo(w, j); c.stroke(); }
      }).position.set(x, 0.75, 3.9);
      R.children[R.children.length - 1].rotation.y = face === "e" ? Math.PI / 2 : -Math.PI / 2;
    }

    // Металлическая койка.
    const bed = [
      makeBox(R, 0.9, 0.08, 2.0, -1.6, 0.55, 4.3, 0xb8b8b0),
      makeBox(R, 0.8, 0.1, 1.9, -1.6, 0.64, 4.3, 0xe8e4d8),
      makeBox(R, 0.6, 0.1, 0.35, -1.6, 0.72, 5.05, 0xf0ece0),
      makeBox(R, 0.9, 0.6, 0.04, -1.6, 0.85, 5.3, 0x9a9a92),
    ];
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      bed.push(makeBox(R, 0.04, 0.55, 0.04, -1.6 + sx * 0.42, 0.275, 4.3 + sz * 0.95, 0x8a8a84));
    S.push({ min: [-2.05, 0, 3.3], max: [-1.15, 0.7, 5.3] });
    new Interactable(bed, "Койка", () => gm.hud.say("Простыня хранит вмятину. Кто-то лежал здесь минуту назад. Может быть, я."));

    // Капельница.
    makeBox(R, 0.02, 1.8, 0.02, -0.95, 0.9, 3.6, 0x9a9a92);
    makeBox(R, 0.3, 0.02, 0.02, -0.95, 1.8, 3.6, 0x9a9a92);
    makeBox(R, 0.3, 0.02, 0.3, -0.95, 0.01, 3.6, 0x6a6a64);
    const pouch = glow(makeBox(R, 0.12, 0.22, 0.06, -0.95, 1.62, 3.6, 0xb8c8b0), 0x2a3a2a, 0.6);
    const tube = makeBox(R, 0.008, 0.9, 0.008, -1.05, 1.05, 3.6, 0xc8d8c8);
    const drop = glow(makeBox(R, 0.012, 0.02, 0.012, -0.95, 1.49, 3.6, 0xe0f0e0), 0xc0e0c0, 0.8);
    new Interactable([pouch, tube, drop, makeHitbox(R, 0.4, 1.2, 0.4, -0.95, 1.2, 3.6)], "Капельница", () => {
      gm.audio.play("glitch");
      gm.hud.sequence([
        "Раствор мутный, непрозрачный. Как будто в нём что-то плавает.",
        "Капля застыла на кончике иглы. Время здесь тоже остановилось.",
        "Это моя кровь? Это моя жизнь? Это то, что утекает из меня?",
      ]);
      gm.state.set("saw_drip");
    });

    // Кардиомонитор с прямой линией.
    table(R, S, 1.6, 5.1, 0.8, 0.5, 0.8, 0x8a8a80);
    const mon = makeBox(R, 0.5, 0.4, 0.36, 1.6, 1.02, 5.15, 0xc8c4b4);
    this._ecg = makePanel(R, 0.42, 0.3, 256, 184, (c, w, h) => this._drawEcg(c, w, h, 0), { emissive: 1 });
    this._ecg.position.set(1.6, 1.03, 4.965);
    this._ecg.rotation.y = Math.PI;
    this._ecgT = 0;
    new Interactable([mon, this._ecg], "Кардиомонитор", () => {
      gm.audio.play("flatline");
      gm.hud.sequence([
        "Лента ЭКГ. Последняя линия — прямая.",
        "Время: 04:12. Дата: 14.11.1988.",
      ]);
      gm.state.set("saw_ecg");
      gm.state.learn("ecg");
    });
    this.light(1.6, 1.1, 4.7, { intensity: 0.7, distance: 2.5, color: 0x60ff90 });

    // Аптечка на стене.
    const medkit = makeBox(R, 0.12, 0.5, 0.36, -2.24, 1.5, 2.9, 0xdcd2c0);
    const c1 = makeBox(R, 0.02, 0.2, 0.06, -2.17, 1.5, 2.9, 0xa82a22);
    const c2 = makeBox(R, 0.02, 0.06, 0.2, -2.17, 1.5, 2.9, 0xa82a22);
    new Interactable([medkit, c1, c2], "Аптечка", () => {
      gm.audio.play("click");
      gm.hud.say("Йод, бинты, шприц-тюбик с мутной жидкостью. Всё просрочено в ноябре 1988-го. Лечить здесь некого.");
      gm.state.set("saw_medkit");
    });

    // Окно — за ним не двор.
    const winHit = makeHitbox(R, 2.4, 1.6, 0.2, 0.3, 1.8, 5.45);
    new Interactable(winHit, "Окно", () => {
      gm.hud.sequence([
        "За окном — не двор. За окном — белая стена.",
        "Я прижимаюсь к стеклу. Это не стена. Это потолок. Я смотрю вверх, но вижу вниз.",
        "Я поднимаю руку. Она поднимается. Я трогаю лицо. Я чувствую пальцы. Но не чувствую себя.",
        "Это не сон. Это агония. Медленная, зацикленная агония мозга, который думает, что он жив.",
      ]);
      gm.effects.roll(7);
      gm.state.set("saw_window");
    });
    this._whiteout = makeBox(R, 3.0, 2.0, 0.05, 0.3, 1.8, 5.75, 0xf0f0ea);
    glow(this._whiteout, 0xffffff, 0.9);

    this._paper(R, 1.35, 0.8, 5.05, "ward30", "Выписка", { color: 0xe0e4d8 });
    wallClock(R, -2.29, 2.1, 4.2, "e");
  }

  _drawEcg(c, w, h, t) {
    c.fillStyle = "#031008"; c.fillRect(0, 0, w, h);
    c.strokeStyle = "rgba(60,140,80,0.25)";
    for (let x = 0; x < w; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 0; y < h; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.strokeStyle = "#6aff98"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, h * 0.55);
    for (let x = 0; x < w; x += 4) c.lineTo(x, h * 0.55 + (Math.random() - 0.5) * 1.2);
    c.stroke();
    c.fillStyle = "#6aff98"; c.font = `16px ${FONTS.mono}`;
    c.fillText("ЧСС  ---", 10, 22);
    c.fillText("04:12  14.11.1988", 10, h - 12);
    const sx = (t * 60) % w;
    c.fillStyle = "rgba(3,16,8,0.9)"; c.fillRect(sx, 30, 10, h - 60);
  }

  onUpdate(dt) {
    super.onUpdate(dt);
    // «За окном — белая стена» — только для того, кто внутри палаты.
    this._whiteout.visible = this.game.current === this;
    if (this.game.current !== this) return;
    this._ecgT += dt;
    if ((this._ecgT * 10 | 0) % 2 === 0) this._ecg.userData.redraw((c, w, h) => this._drawEcg(c, w, h, this._ecgT));
  }
}

// ================== №40 — «Вахтёрская» ==================
export class Neighbor40Scene extends BaseApartmentScene {
  constructor(game) {
    super(game, "40");
    this.name = "Кв. 40";
    this.mainRoomName = "Вахтёрская";
    this.wallColor3D = 0x6a6a60;
    this.curtainSides = [-1];
    this.ajar = () => true;
  }

  _buildProps(R) {
    const gm = this.game, S = this.solids;

    // Коврик у входа, под ним — ключ.
    const mat = makeBox(R, 0.7, 0.03, 0.5, 0, 0.02, this.dims.entryZ + 0.5, 0x5a2a1a);
    mat.userData.noPick = false;
    new Interactable(mat, () => gm.state.has("key_shield") || gm.state.is("power_on") ? "Коврик" : "Заглянуть под коврик", () => {
      gm.audio.play("click");
      if (gm.state.has("key_shield") || gm.state.is("power_on")) { gm.hud.say("Под ковриком пусто."); return; }
      gm.state.give("key_shield");
      gm.hud.say("Под ковриком — ключ. Большой, ржавый. На бирке: «ЩИТ. ЭТ.5». Он холодный. Я кладу его в карман.");
    });

    // Стол вахты: журнал, лампа.
    table(R, S, 0.2, 4.6, 1.4, 0.7, 0.76, COLORS.DESK);
    glow(makeBox(R, 0.16, 0.2, 0.16, -0.4, 0.86, 4.8, 0xd8c890), 0xf0dca0, 0.7);
    const book = makeBox(R, 0.32, 0.03, 0.44, 0.3, 0.775, 4.55, 0x2a3a5a);
    new Interactable(book, "Журнал дежурств", () => {
      gm.readDoc("journal40", () => {
        if (gm.state.learn("journal40")) {
          gm.hud.sequence([
            "Я читаю это. Потом читаю снова. Потом закрываю журнал.",
            "Я знал это. Но теперь я это вижу. Чёрным по белому. Мёртвым по живому.",
          ]);
        }
      });
    });
    chair(R, S, 0.2, 3.75, "s");

    // Домофон.
    const intercom = makeBox(R, 0.3, 0.4, 0.08, -1.75, 1.4, -1.14, 0x2a2a28);
    const grille = makeBox(R, 0.18, 0.18, 0.02, -1.75, 1.45, -1.19, 0x141414);
    new Interactable([intercom, grille], "Домофон", () => {
      gm.audio.play("static");
      gm.hud.say("В динамике — шум. Потом голос, женский, усталый: «…смена не закончится, пока в сорок второй горит свет…»", { who: "ДОМОФОН", style: "voice" });
    });

    // Стеллажи с делами.
    const shelf = bookshelf(R, S, 1.95, 3.0, 0.7, 0.4, 2.0, "w");
    new Interactable(shelf, "Стеллаж с делами", () => {
      gm.hud.say(gm.state.is("bureau")
        ? "Полки уходят вглубь. Дальше, чем позволяет комната. На каждой папке — моя фамилия."
        : "Папки с личными делами жильцов. Все датированы 1988 годом.");
    });
    sofa(R, S, -1.85, 3.2, 0.8, 1.6, "w", 0x4a5a4a);
    calendar(R, 2.3, 1.7, 4.4, "w");
    wallClock(R, -2.3, 2.0, 4.6, "e");

    // ── Акт IV: бюрократический кошмар ─────────────────────
    const B = new THREE.Group();
    R.add(B);
    this._bureau = B;
    this._bureauSolids = [];
    // Бесконечные полки: ряды стеллажей уходят в туман.
    for (const x of [-1.6, -0.4, 0.8]) bookshelf(B, this._bureauSolids, x, 5.3, 1.1, 0.3, 2.75, "n");
    // Печатная машинка на столе вахты.
    const tw = [
      makeBox(B, 0.36, 0.12, 0.3, -0.12, 0.84, 4.5, 0x2a2a2a),
      makeBox(B, 0.4, 0.04, 0.06, -0.12, 0.92, 4.62, 0x3a3a3a),
      makeBox(B, 0.26, 0.2, 0.01, -0.12, 1.0, 4.66, 0xe8e0c8),
    ];
    new Interactable(tw, "Печатная машинка", () => {
      gm.readDoc("typewriter40", () => gm.hud.say("Машинка работает сама. Лист за листом. Ровным шрифтом приказа."));
    }, { enabled: () => gm.state.is("bureau") });
    // Штампы и личное дело.
    const stamps = [
      makeBox(B, 0.06, 0.1, 0.06, 0.62, 0.81, 4.82, 0x5a2a1a),
      makeBox(B, 0.06, 0.1, 0.06, 0.76, 0.81, 4.82, 0x1a2a5a),
      makeBox(B, 0.24, 0.02, 0.32, 0.72, 0.77, 4.42, 0xc8b890),
    ];
    new Interactable(stamps, () => gm.state.is("stamped") ? "Личное дело" : "Штампы и личное дело",
      () => gm.puzzles.stamps.open(), { enabled: () => gm.state.is("bureau") });
    // Зеркало в углу.
    const mf = makeBox(B, 0.5, 1.5, 0.05, 1.9, 1.3, 5.45, 0x2a2622);
    const mg = glow(makeBox(B, 0.42, 1.4, 0.02, 1.9, 1.3, 5.42, 0x8a96a0), 0x2a3038, 0.5);
    new Interactable([mf, mg], "Зеркало", () => {
      gm.audio.play("glitch");
      gm.hud.sequence([
        "В зеркале — я. Но не я. Лицо старше. Глаза устали.",
        "На груди — табличка: «ОБЪЕКТ-1988».",
        "Я поднимаю руку — отражение не поднимает. Я дышу. Отражение не дышит.",
        "Это уже не отражение. Это — объект. Эксперимент. Запись в журнале.",
      ]);
      gm.effects.glitch(1.2);
      gm.state.set("mirror40");
      gm.state.learn("object");
    }, { enabled: () => gm.state.is("bureau") });
  }

  sync() {
    const on = this.game.state.is("bureau");
    this._bureau.visible = on;
    // Твёрдые тела рядов полок добавляются в мир только в акте IV
    // (и выключаются, если цикл начался заново).
    if (on && !this._bureauAdded) {
      this._bureauAdded = this._addLocalSolids(this._bureauSolids);
    }
    if (this._bureauAdded) for (const s of this._bureauAdded) s.off = !on;
  }

  // Перевод локальных AABB в мировые (квартира повёрнута на 0 или π).
  _addLocalSolids(list) {
    const added = [];
    const o = this.group.position, rot = this.group.rotation.y;
    for (const s of list) {
      let w;
      if (Math.abs(rot) < 1e-6) {
        w = { min: [s.min[0] + o.x, s.min[1] + o.y, s.min[2] + o.z], max: [s.max[0] + o.x, s.max[1] + o.y, s.max[2] + o.z] };
      } else {
        w = { min: [o.x - s.max[0], o.y + s.min[1], o.z - s.max[2]], max: [o.x - s.min[0], o.y + s.max[1], o.z - s.min[2]] };
      }
      this.solids.push(w);
      this.game.solids.push(w);
      added.push(w);
    }
    return added;
  }

  onEnter() {
    super.onEnter();
    const gm = this.game;
    if (gm.state.is("bureau") && !gm.state.is("visited_40_iv")) {
      gm.state.set("visited_40_iv");
      gm.audio.play("typewriter");
      gm.hud.sequence([
        "Вахтёрская. Но теперь она другая. Бесконечная.",
        "Полки уходят вглубь — дальше, чем позволяет комната. Где-то стучит печатная машинка.",
      ]);
    }
  }
}

// ================== №41 — «Физик» ==================
export class Neighbor41Scene extends BaseApartmentScene {
  constructor(game) {
    super(game, "41");
    this.name = "Кв. 41";
    this.mainRoomName = "Кабинет";
    this.ajar = () => false;
  }

  _buildProps(R) {
    const gm = this.game, S = this.solids;

    // Стены исписаны формулами; в центре — «4·0·4».
    const board = makePanel(R, 3.2, 1.9, 1024, 608, (c, w, h) => {
      c.fillStyle = "rgba(0,0,0,0)"; c.clearRect(0, 0, w, h);
      c.fillStyle = "rgba(230,228,210,0.55)";
      const f = [
        "ψ(t+1) = Ŝ·ψ(t)", "∮ E·dl = −dΦ/dt", "640K = 655 360", "λ = c / f",
        "f₀ = 404 ± 0,5 кГц", "Ŝ = e^{−iHt/ħ}", "det|A − λE| = 0", "ОБЕРЕГ → ∞", "U = 12 кВ",
        "τ ≈ 04:12", "∂ψ/∂t = −Γψ", "N → 3 ?", "DO 10 I=1,640",
      ];
      for (let i = 0; i < 40; i++) {
        c.font = `${500} ${26 + Math.random() * 16}px ${FONTS.hand}`;
        c.save();
        c.translate(Math.random() * w, Math.random() * h);
        c.rotate((Math.random() - 0.5) * 0.25);
        c.fillText(f[i % f.length], -60, 0);
        c.restore();
      }
    });
    board.material.transparent = true;
    board.position.set(-2.29, 1.55, 3.9);
    board.rotation.y = Math.PI / 2;
    board.userData.noPick = true;
    this._graffiti = decal(R, "4·0·4", { x: -2.285, y: 1.75, z: 3.9, face: "e", width: 1.7, style: "chalk", px: 200 });
    new Interactable(makeHitbox(R, 0.1, 1.8, 3.0, -2.25, 1.55, 3.9), "Формулы на стене", () => {
      gm.readDoc("formulas41", () => {
        gm.state.learn("graffiti");
        gm.hud.say("Мел свежий. Я провожу пальцем — палец белеет. Я писал это. Но когда?");
      });
    });

    // Рабочий стол: ящик с ключом №3, тетрадь.
    table(R, S, 1.2, 4.9, 1.6, 0.8, 0.8, COLORS.DESK);
    for (const [x, z, c] of [[0.9, 4.9, 0xd8cfae], [1.2, 4.85, 0xc8bf9e]])
      makeBox(R, 0.3, 0.02, 0.42, x, 0.81, z, c);
    const drawer = makeBox(R, 0.5, 0.15, 0.06, 1.55, 0.62, 4.5, 0x4a3a2a);
    new Interactable(drawer, () => gm.state.has("key_lab3") ? "Ящик (пусто)" : "Открыть ящик стола", () => {
      gm.audio.play("drawer");
      if (gm.state.has("key_lab3")) { gm.hud.say("Ящик пуст."); return; }
      gm.state.give("key_lab3");
      gm.hud.say("В ящике — ржавый лабораторный ключ №3. Бирка: «ОБЕРЕГ-88. БЛОК-В». Руки дрожат. Но я беру.");
    });
    this._paper(R, 0.85, 0.8, 4.75, "note41", "Тетрадь", { w: 0.24, d: 0.3, color: 0xd8d0c0 });
    chair(R, S, 1.2, 4.1, "s");

    // Радиоприёмник «ВЭФ-202».
    table(R, S, 1.75, 3.0, 0.6, 0.5, 0.75, 0x4a3a2a);
    const radio = makeBox(R, 0.42, 0.26, 0.14, 1.75, 0.89, 3.0, 0x6a4a2a);
    this._radioScale = glow(makeBox(R, 0.3, 0.06, 0.01, 1.75, 0.94, 2.925, 0x3a3a2a), 0x000000, 0);
    const knob = makeBox(R, 0.04, 0.04, 0.03, 1.92, 0.84, 2.92, 0x2a2a2a);
    plate(R, "ВЭФ-202", { x: 1.75, y: 0.83, z: 2.929, face: "s", w: 0.1, h: 0.025, bg: "#c8b88a", fg: "#2a2a2a", border: "#c8b88a" });
    new Interactable([radio, this._radioScale, knob], () => gm.state.is("radio_tuned") ? "«ВЭФ-202»" : "Радиоприёмник «ВЭФ-202»", () => {
      const s = gm.state;
      if (!s.is("power_on")) { gm.audio.play("click"); gm.hud.say("Щёлкаю тумблером. Тишина. Нет напряжения. Свет — в щитке."); return; }
      if (s.act < 5) {
        gm.hud.say("Приёмник поёт сам — старый вальс сквозь шум. Стрелка прилипла к 250. Я не трогаю верньер. Пока.");
        return;
      }
      gm.puzzles.radio.open();
    });

    sofa(R, S, -1.85, 3.0, 0.8, 1.4, "w", 0x5a5a4a);
    rug(R, 0, 3.9, 1.8, 1.4, 0x4a4a3a, 0x30302a);
    floorLamp(R, S, 2.0, 5.25);
    clutterShelf(R, 2.3, 1.65, 4.0, "w", 0.6);
  }

  sync() {
    const s = this.game.state;
    const on = s.is("power_on");
    this._radioScale.material.emissive.setHex(on ? 0xffc060 : 0);
    this._radioScale.material.emissiveIntensity = on ? 0.6 : 0;
  }

  onUpdate(dt) {
    super.onUpdate(dt);
    // Радио «поёт само» — звук зависит от расстояния.
    const gm = this.game;
    const s = gm.state;
    let vol = 0;
    if (s.is("power_on") && !gm.puzzles.radio.isOpen) {
      const p = this.toLocal(gm.player.position);
      const d = Math.hypot(p.x - 1.75, p.z - 3.0) + Math.abs(gm.player.position.y - this.group.position.y - 1.6);
      vol = Math.max(0, 1 - d / 9) * (s.act < 5 ? 0.6 : 0.25);
    }
    gm.audio.setRadioIdle(vol);
  }
}

// ================== №43 — «Пустота» ==================
export class Neighbor43Scene extends BaseApartmentScene {
  constructor(game) {
    super(game, "43");
    this.name = "Кв. 43";
    this.mainRoomName = "Пустая комната";
    this.wallColor3D = 0x4a4438;
    this.floorOverrides = { bath: 0x404040, corr: 0x3a342c, bedroom: 0x3a342c };
    this.sharedEast = true;
    this.curtainSides = [-1];
    this.lockedText = () => game.state.is("unlock_43") ? null : "Заперто. За дверью — шорох. Как плёнка по головке магнитофона.";
    this.ajar = () => game.state.is("unlock_43");
  }

  _buildProps(R) {
    const gm = this.game, S = this.solids;

    // Стена, зашитая перфолентами.
    const tapes = makePanel(R, 3.3, 2.6, 512, 400, (c, w, h) => {
      c.fillStyle = "#2a2620"; c.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 22) {
        c.fillStyle = Math.random() < 0.5 ? "#d8cfa8" : "#c8bc90";
        c.fillRect(x + 2, 0, 18, h);
        c.fillStyle = "#2a2620";
        for (let y = 4; y < h; y += 7) {
          if (Math.random() < 0.45) { c.beginPath(); c.arc(x + 6 + (Math.random() * 3 | 0) * 4, y, 1.6, 0, Math.PI * 2); c.fill(); }
        }
        c.fillStyle = "#555"; for (let y = 3; y < h; y += 7) c.fillRect(x + 10, y, 1, 1);
      }
    });
    tapes.position.set(-2.29, 1.3, 3.9);
    tapes.rotation.y = Math.PI / 2;
    new Interactable(tapes, "Перфоленты", () => {
      gm.readDoc("tape43", () => gm.hud.say("Я трогаю ленту. Холодная, шершавая. Она — я. Я — лента. Я — данные."));
    });

    // «Маяк-205» на тумбе.
    solidBox(R, S, 0.6, 0.5, 0.5, 0, 0.25, 4.6, 0x4a3a2a);
    const mag = makeBox(R, 0.56, 0.18, 0.42, 0, 0.59, 4.6, 0x3a3a3a);
    this._reel1 = makeBox(R, 0.2, 0.02, 0.2, -0.13, 0.69, 4.6, 0x8a8a80);
    this._reel2 = makeBox(R, 0.2, 0.02, 0.2, 0.13, 0.69, 4.6, 0x8a8a80);
    plate(R, "МАЯК-205", { x: 0, y: 0.56, z: 4.389, face: "s", w: 0.14, h: 0.03, bg: "#b8b0a0", fg: "#1a1a1a", border: "#b8b0a0" });
    new Interactable([mag, this._reel1, this._reel2], "Магнитофон «Маяк-205»", () => gm.puzzles.tape.open());

    // Наушники на стуле.
    chair(R, S, 1.5, 3.4, "e");
    const hp = [
      makeBox(R, 0.08, 0.1, 0.06, 1.4, 0.52, 3.4, 0x1a1a1a),
      makeBox(R, 0.08, 0.1, 0.06, 1.6, 0.52, 3.4, 0x1a1a1a),
      makeBox(R, 0.22, 0.02, 0.02, 1.5, 0.6, 3.4, 0x2a2a2a),
    ];
    new Interactable(hp, "Наушники", () => {
      gm.audio.play("whisper");
      gm.hud.sequence([
        ["…не ходи… в сорок первую… не ходи в сорок первую… не ходи…", { who: "МОЙ ГОЛОС", style: "voice", ms: 4500 }],
        "Почему? Что там? Что я забыл? Что я не хочу вспоминать?",
        "Это предупреждение. От меня. Для меня. Обо мне.",
      ]);
      gm.state.set("headphones");
      gm.state.learn("dont41");
    });

    // Обрывок на столике.
    table(R, S, 1.6, 5.0, 0.5, 0.5, 0.6, 0x4a3a2a);
    this._paper(R, 1.6, 0.6, 5.0, "scrap43", "Обрывок", { w: 0.16, d: 0.12, color: 0xe0d7b8, rot: 0.4 });

    wallClock(R, 2.3, 2.1, 3.6, "w");
    this.light(0, 2.4, 4.4, { intensity: 1.2, distance: 3, color: 0xffd090, flicker: 0.6 });
  }

  onUpdate(dt) {
    super.onUpdate(dt);
    if (this.game.puzzles.tape.spinning) {
      this._reel1.rotation.y += dt * 4;
      this._reel2.rotation.y += dt * 4;
    }
  }
}

// ================== №44 — «Отражение» ==================
export class Neighbor44Scene extends BaseApartmentScene {
  constructor(game) {
    super(game, "44");
    this.name = "Кв. 44";
    this.mainRoomName = "Гостиная";
    this.wallColor3D = 0x707880;
    this.blindNorth = true;
    this.lockedText = () => game.state.is("unlock_44") ? null : "Заперто. В щели под дверью мелькает свет — как от телевизора.";
    this.ajar = () => game.state.is("unlock_44");
  }

  _buildProps(R) {
    const gm = this.game, S = this.solids;

    // Трюмо на северной стене.
    const fr = makeBox(R, 1.3, 2.2, 0.08, 0.3, 1.3, 5.46, 0x2a2018);
    makeBox(R, 1.5, 0.5, 0.45, 0.3, 0.25, 5.3, 0x3a2a1c);
    S.push({ min: [-0.45, 0, 5.07], max: [1.05, 0.5, 5.6] });
    this._glass = makePanel(R, 1.1, 1.9, 220, 380, (c, w, h) => this._drawMirror(c, w, h, 0), { emissive: 0.55 });
    this._glass.position.set(0.3, 1.4, 5.415);
    this._glass.rotation.y = Math.PI;
    this._mirrorT = 0;
    new Interactable([fr, this._glass], "Трюмо", () => this._look());

    // Кресло, спиной ко входу, лицом к трюмо.
    const cx = 0.3, cz = 3.7;
    const ch = new THREE.Group();
    ch.position.set(cx, 0, cz);
    R.add(ch);
    const seat = makeBox(ch, 0.9, 0.45, 0.85, 0, 0.225, 0, 0x2a2622);
    const back = makeBox(ch, 0.9, 1.0, 0.18, 0, 0.75, -0.38, 0x1e1c1a);
    const arms = [makeBox(ch, 0.12, 0.25, 0.8, -0.4, 0.55, 0, 0x1e1c1a), makeBox(ch, 0.12, 0.25, 0.8, 0.4, 0.55, 0, 0x1e1c1a)];
    S.push({ min: [cx - 0.45, 0, cz - 0.47], max: [cx + 0.45, 1.25, cz + 0.43] });

    // Силуэт. Лицо смотрит в зеркало — от игрока.
    const fig = new THREE.Group();
    fig.position.set(0, 0, 0.02);
    ch.add(fig);
    makeBox(fig, 0.42, 0.62, 0.26, 0, 0.78, 0, 0x121212);
    makeBox(fig, 0.22, 0.26, 0.22, 0, 1.24, 0.02, 0x161616);
    this._face = makePanel(fig, 0.2, 0.24, 128, 160, (c, w, h) => {
      c.fillStyle = "#7a7c78"; c.fillRect(0, 0, w, h);
      c.fillStyle = "#c8ccc8"; for (const ex of [40, 88]) { c.beginPath(); c.ellipse(ex, 62, 13, 9, 0, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = "#2a2a2a"; for (const ex of [40, 88]) { c.beginPath(); c.arc(ex, 63, 4, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = "#1a1416"; c.beginPath(); c.ellipse(64, 118, 16, 20, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "#4a5068"; c.lineWidth = 3; c.beginPath(); c.moveTo(48, 100); c.quadraticCurveTo(64, 96, 80, 100); c.stroke();
    });
    this._face.position.set(0, 1.24, 0.135);
    this._figure = fig;
    this._chair = ch;

    new Interactable([seat, back, ...arms, ...fig.children], () =>
      gm.state.is("mirror44_solved") ? "Пустое кресло" : "Подойти к сидящему", () => {
        if (gm.state.is("mirror44_solved")) { gm.hud.say("Кресло пусто. Сиденье ещё тёплое."); return; }
        gm.audio.play("glitch");
        gm.effects.glitch(0.6);
        gm.hud.say("Экран заливают помехи. Он не двигается. Он смотрит в трюмо. Он ждёт, когда туда посмотрю я.");
      });

    // Записка на сиденье — появляется, когда силуэт исчезнет.
    this._seatNote = makeBox(ch, 0.2, 0.012, 0.26, 0, 0.456, 0.05, COLORS.NOTE);
    new Interactable(this._seatNote, "Записка на сиденье", () => {
      gm.readDoc("note44", () => {
        gm.state.learn("node");
        gm.state.set("node_note");
        gm.hud.sequence([
          "Это адрес. Системный адрес. Адрес клона. Той копии, которая сидела в кресле.",
          "Я не знаю, кто за этой дверью. Но я знаю, что должен идти.",
        ]);
      });
    }, { enabled: () => this._seatNote.visible });

    // Диван со второй запиской.
    sofa(R, S, -1.85, 3.6, 0.8, 1.8, "w", 0x4a4a52);
    this._paper(R, -1.75, 0.46, 3.3, "sofa44", "Записка на диване", { color: 0xd8d0b8, rot: 0.3 });

    rug(R, 0.3, 3.9, 2.4, 1.8, 0x3a3a44, 0x24242c);
    frame(R, 2.3, 1.7, 3.0, "w", 0.4, 0.5, "portrait");
    frame(R, 2.3, 1.7, 4.0, "w", 0.4, 0.5, "portrait");
    floorLamp(R, S, 2.0, 5.2);
    this.light(0.3, 1.6, 4.9, { intensity: 1.0, distance: 3, color: 0xa0b8d0 });
  }

  _drawMirror(c, w, h, k) {
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#5a6470"); g.addColorStop(0.5, "#8a96a2"); g.addColorStop(1, "#4a525c");
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // смутное отражение: тёмная фигура в кресле и фигура стоящего
    c.fillStyle = "rgba(20,20,24,0.55)";
    c.fillRect(w * 0.38, h * 0.55, w * 0.24, h * 0.3);
    c.beginPath(); c.arc(w * 0.5, h * 0.5, w * 0.07, 0, Math.PI * 2); c.fill();
    c.fillStyle = `rgba(30,30,36,${0.35 + k * 0.15})`;
    const off = k * 14;
    c.fillRect(w * 0.66 + off, h * 0.3, w * 0.14, h * 0.5);
    c.beginPath(); c.arc(w * 0.73 + off, h * 0.25, w * 0.06, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 30; i++) { c.fillStyle = "rgba(255,255,255,0.05)"; c.fillRect(Math.random() * w, Math.random() * h, 2, 30); }
  }

  _look() {
    const gm = this.game, s = gm.state;
    if (s.is("mirror44_solved")) {
      // «Не смотри в зеркало больше трёх раз».
      gm.audio.play("scream");
      gm.hud.say("Отражение делает шаг. Из зеркала.", { style: "voice" });
      gm.effects.glitch(2);
      setTimeout(() => gm.die("Отражение вышло из зеркала. Я больше не помню, кто из нас стоял у трюмо."), 900);
      return;
    }
    const n = s.inc("mirror44");
    gm.audio.play("glitch");
    this._glass.userData.redraw((c, w, h) => this._drawMirror(c, w, h, n));
    if (n === 1) {
      gm.hud.say("Отражение повторяет мои движения. Всё правильно. Всё обычно. Но что-то в глазах. Они — не мои.");
    } else if (n === 2) {
      gm.hud.say("Отражение повторяет движения — с задержкой. На полсекунды. На секунду. Это уже не отражение. Это копия.");
    } else {
      s.set("mirror44_solved");
      gm.hud.sequence([
        "Отражение смотрит на меня — и не мигает. Тогда силуэт в кресле оборачивается.",
        ["Я вижу собственное мёртвое лицо. Остекленевший взор. Открытый рот.", { ms: 4200 }],
        "Силуэт исчезает с резким звуком аналогового сбоя. На сиденье остаётся записка.",
      ]);
      this._turning = 0.0001;
    }
  }

  sync() {
    const s = this.game.state;
    const solved = s.is("mirror44_solved");
    if (!this._turning) this._figure.visible = !solved;
    this._seatNote.visible = solved && !this._turning;
    if (!solved) this._figure.rotation.y = Math.PI;   // лицом к трюмо
  }

  onUpdate(dt) {
    super.onUpdate(dt);
    this._mirrorT += dt;
    this._glass.material.emissiveIntensity = 0.5 + Math.sin(this._mirrorT * (1.4 + this.game.state.count("mirror44"))) * 0.08;
    if (this._turning) {
      this._turning += dt;
      // Поворачивается к игроку за 1.2 с, держит взгляд, исчезает.
      const k = Math.min(1, this._turning / 1.2);
      this._figure.rotation.y = Math.PI * (1 - k * k * (3 - 2 * k));
      if (this._turning > 4.2) {
        this._turning = 0;
        this.game.audio.play("glitch");
        this.game.effects.glitch(0.8);
        this._figure.visible = false;
        this.sync();
      }
    }
  }
}

// ================== №50 — «Обсерватория» ==================
export class Neighbor50Scene extends BaseApartmentScene {
  constructor(game) {
    super(game, "50");
    this.name = "Кв. 50";
    this.mainRoomName = "Обсерватория";
    this.wallColor3D = 0x505870;
    this.floorOverrides = { bedroom: 0x3a4050 };
    this.balcony = true;
    this.lockedText = () => game.state.is("unlock_50") ? null
      : "Электрический замок. На табло мигает: «УДАЛЁННЫЙ ДОСТУП. УЗЕЛ НЕ ПОДКЛЮЧЁН».";
    this.ajar = () => game.state.is("unlock_50");
  }

  _buildProps(R) {
    const gm = this.game, S = this.solids;

    // Табло замка у двери (видно из подъезда).
    this._lockLamp = glow(makeBox(R, 0.08, 0.05, 0.02, 0.75, 1.45, this.dims.entryZ - 0.11, 0x3a1010), 0xff3020, 0.9);

    // Звёздная карта.
    const map = makePanel(R, 1.2, 0.9, 480, 360, (c, w, h) => {
      c.fillStyle = "#0c1428"; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 260; i++) {
        c.fillStyle = `rgba(230,226,190,${0.3 + Math.random() * 0.7})`;
        const r = Math.random() < 0.08 ? 2 : 1;
        c.fillRect(Math.random() * w, Math.random() * h, r, r);
      }
      c.strokeStyle = "rgba(200,200,170,0.35)";
      for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(Math.random() * w, Math.random() * h); for (let j = 0; j < 4; j++) c.lineTo(Math.random() * w, Math.random() * h); c.stroke(); }
      c.strokeStyle = "#c83a2a"; c.lineWidth = 3;
      c.beginPath(); c.moveTo(w * 0.72, h * 0.28); c.lineTo(w * 0.8, h * 0.36); c.moveTo(w * 0.8, h * 0.28); c.lineTo(w * 0.72, h * 0.36); c.stroke();
      c.fillStyle = "#e8d8b0"; c.font = `600 22px ${FONTS.hand}`;
      c.fillText("не звезда. 312° +14°", w * 0.48, h * 0.46);
    });
    map.position.set(-2.29, 1.7, 3.9);
    map.rotation.y = Math.PI / 2;
    new Interactable(map, "Звёздная карта", () => gm.readDoc("starmap50"));

    // Тумба с астрономическим журналом.
    table(R, S, -1.6, 5.1, 0.7, 0.5, 0.75, 0x4a3a2a);
    this._paper(R, -1.6, 0.75, 5.1, "journal50", "Астрономический журнал", { w: 0.26, d: 0.34, color: 0x2a3a4a, enabled: null });
    sofa(R, S, 1.85, 3.3, 0.8, 1.6, "e", 0x3a4050);
    rug(R, 0, 3.9, 2.0, 1.4, 0x3a4058, 0x242838);

    // ── Балкон ──────────────────────────────────────────────
    const z0 = NORTH_Z + 0.1, z1 = NORTH_Z + 1.5;
    const slab = makeBox(R, 3.4, 0.12, z1 - z0, 0.3, -0.06, (z0 + z1) / 2, 0x5a5a58);
    S.push({ min: [-1.4, -0.12, z0], max: [2.0, 0, z1] });
    for (const [w, x, z, d] of [[3.4, 0.3, z1, 0.06], [0.06, -1.4, (z0 + z1) / 2, z1 - z0], [0.06, 2.0, (z0 + z1) / 2, z1 - z0]]) {
      makeBox(R, w, 0.05, d, x, 1.05, z, 0x3a3a38);
      makeBox(R, w, 0.9, d * 0.3 + 0.01, x, 0.5, z, 0x4a4a46);
      S.push({ min: [x - w / 2, 0, z - d / 2 - 0.02], max: [x + w / 2, 1.1, z + d / 2 + 0.02] });
    }
    slab.userData.noPick = true;

    // Самодельный телескоп на треноге.
    const tx = 0.6, tz = NORTH_Z + 0.9;
    const tri = [];
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2;
      const leg = makeBox(R, 0.03, 1.2, 0.03, tx + Math.cos(a) * 0.2, 0.58, tz + Math.sin(a) * 0.2, 0x2a2a2a);
      leg.rotation.z = Math.cos(a) * 0.18; leg.rotation.x = -Math.sin(a) * 0.18;
      tri.push(leg);
    }
    const tube = makeBox(R, 0.14, 0.14, 0.9, tx, 1.3, tz, 0x8a8a90);
    tube.rotation.x = 0.35;
    this._tube = tube;
    const eyepiece = makeBox(R, 0.06, 0.06, 0.12, tx, 1.18, tz - 0.42, 0x1a1a1a);
    S.push({ min: [tx - 0.25, 0, tz - 0.25], max: [tx + 0.25, 1.5, tz + 0.25] });
    new Interactable([...tri, tube, eyepiece], "Телескоп", () => gm.puzzles.telescope.open());

    // Пиксельный снег.
    const N = 500;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = -5 + Math.random() * 11;
      pos[i * 3 + 1] = -4 + Math.random() * 10;
      pos[i * 3 + 2] = NORTH_Z + 0.2 + Math.random() * 7;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this._snow = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xe8ecf0, size: 3, sizeAttenuation: false, fog: true }));
    this._snow.userData.noPick = true;
    R.add(this._snow);

    // Небо за балконом.
    const sky = makePanel(R, 40, 24, 512, 300, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#05070e"); g.addColorStop(0.7, "#141826"); g.addColorStop(1, "#262632");
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 300; i++) { c.fillStyle = `rgba(230,230,200,${Math.random() * 0.8})`; c.fillRect(Math.random() * w, Math.random() * h * 0.7, 1, 1); }
    }, { basic: true });
    sky.material.fog = false;
    sky.position.set(0.3, 4, NORTH_Z + 20);
    sky.rotation.y = Math.PI;
    sky.userData.noPick = true;
    this.light(0.3, 2.2, NORTH_Z + 0.8, { intensity: 1.5, distance: 4, color: 0x8090c0 });

    // Балконная дверь (проём) — без створки, сквозняк.
  }

  sync() {
    const open = this.game.state.is("unlock_50");
    this._lockLamp.material.emissive.setHex(open ? 0x30ff50 : 0xff3020);
  }

  onUpdate(dt) {
    super.onUpdate(dt);
    if (!this._snow) return;
    const a = this._snow.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      let y = a.getY(i) - dt * 0.6;
      if (y < -4) y = 6;
      a.setY(i, y);
    }
    a.needsUpdate = true;
  }

  onEnter() {
    super.onEnter();
    const gm = this.game;
    if (!gm.state.is("first_50")) {
      gm.state.set("first_50");
      gm.hud.say("Обсерватория. С балкона тянет холодом. Снег. Он не тает.");
    }
  }
}
