// Обитаемые квартиры: 20, 30, 40, 41, 43, 44, 50.
// Все стоят физически в мире за своими дверьми — переход бесшовный.

import * as THREE from "three";
import { Scene } from "../scene.js";
import { makeBox, solidBox, glow, makeTextSprite } from "../utils.js";
import { Interactable } from "../interactable.js";
import { COLORS } from "../settings.js";
import { apartmentOrigin } from "./hallway.js";
import {
  buildApartmentShell, buildWindowFrame, buildEntryCasing, EntryDoor,
} from "./apartment_layout.js";
import {
  furnishHall, furnishCorridor, furnishBath, furnishKitchen,
  rug, frame, curtains, radiator, plantPot, floorLamp, bookshelf, chair, table,
  armchair, sofa, vase, calendar, wallClock, outsideView,
  pictureWall, plantCorner, clutterShelf,
} from "./decor.js";
import {
  NOTE_20, NOTE_30, NOTE_40, NOTE_41, NOTE_43, NOTE_44, NOTE_50,
  NOTE_ARCHIVE_HINT,
} from "../data/notes.js";

const NEIGHBOR_WIDTH    = 4.8;
const NEIGHBOR_CORRIDOR = 1.6;

class BaseApartmentScene extends Scene {
  constructor(game, num) {
    super(game);
    this.num = num;
    this.name = `Кв. ${num}`;
    this.spawn = [0, 1.7, 3.4];
    this.spawnYaw = Math.PI;

    this.noteId = "?";
    this.noteTitle = "Записка";
    this.noteText = "";
    this.itemReward = null;
    this.wallText = "";
    this.wallColor = "#782828";
    this.wallColor3D = null;
    this.floorOverrides = null;
    this.sharedEast = false;
    this.curtainSides = [-1, 1];

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
    });
    this._rooms = shell.rooms;
    this._entryZ = shell.entryZ;
    this.region = shell.region;
    this.dims = shell.dims;

    this.entryDoor = new EntryDoor(this, R, { entryZ: shell.entryZ, label: this.num });
    buildEntryCasing(R, { entryZ: shell.entryZ });

    if (this.wallText) {
      const t = makeTextSprite(this.wallText, { fontSize: 44, color: this.wallColor });
      t.scale.setScalar(0.8);
      t.position.set(0, 2.4, shell.entryZ + 0.13);
      R.add(t);
    }

    R.add(new THREE.AmbientLight(0x7a7268, 0.4));
    const pt1 = new THREE.PointLight(0xffe8b4, 0.5, 8);
    pt1.position.set(0, 2.5, 1.4); R.add(pt1);
    const pt2 = new THREE.PointLight(0xffe8b4, 0.45, 8);
    pt2.position.set(0, 2.5, -2.2); R.add(pt2);
    const pt3 = new THREE.PointLight(0xffe8b4, 0.45, 8);
    pt3.position.set(0, 2.5, 4.0); R.add(pt3);
    
    
    for (const [lx, lz] of [[0, -2], [0, 0.6], [-1.9, 0.6], [1.9, 0.6], [0, 3.9]]) {
      glow(makeBox(R, 0.14, 0.14, 0.14, lx, 2.7, lz, COLORS.LAMP), 0xf0dca0, 0.8);
    }

    for (const w of shell.windows) {
      buildWindowFrame(R, w);
      outsideView(R, w);
    }

    this._furnishCommon(R, shell.dims);
    this._buildProps(R);

    const o = apartmentOrigin(this.num);
    if (o) this.place(o.x, o.y, o.z, o.rotY);
    else console.warn(`apartmentOrigin(${this.num}) not found`);
  }

  _furnishCommon(R, d) {
    const gm = this.game, S = this.solids;
    const say = (t, ms = 5000, snd = null) => () => { if (snd) gm.audio.play(snd); gm.hud.showMessage(t, ms); };

    furnishHall(R, S, {
      hhw: d.hhw, entryZ: d.entryZ,
      onMirror: say("Мутное зеркало. Твоё лицо в нём кажется чужим.", 4500, "glitch"),
    });
    furnishCorridor(R, S, { cw: d.cw });
    furnishBath(R, S, {
      hw: d.hw, cw: d.cw,
      hooks: {
        tub: say("Ванна сухая. На дне — ржавый след от капель, которых давно нет.", 5000),
        mirror: say("Зеркало запотело. На стекле — отпечаток ладони. Не твоей.", 5000, "glitch"),
      },
    });
    const k = furnishKitchen(R, S, { hw: d.hw, cw: d.cw, hasWindow: !this.sharedEast });
    new Interactable(k.fridgeParts, "Открыть холодильник",
        say("Холодильник гудит, но внутри пусто. Лампочка мигает в такт чему-то далёкому.", 5000, "click"));
    new Interactable(k.stoveParts, "Осмотреть плиту",
        say("Плита холодная. На конфорке — кольцо от давно снятого чайника.", 4500));

    radiator(R, 0.3, 5.5, "s", 1.2);
    curtains(R, 0.3, 5.5, "s", { w: 2.4 + 0.3, sides: this.curtainSides });
  }

  _buildProps(R) { /* override */ }

  _nightstandWithNote(R, x, z, prompt = "Прочитать записку") {
    const t = solidBox(R, this.solids, 0.5, 0.55, 0.4, x, 0.275, z, 0x4a3a2c);
    const note = makeBox(R, 0.3, 0.02, 0.4, x, 0.565, z, COLORS.NOTE);
    new Interactable([note], prompt, () => this._readNote());
    return t;
  }

  _readNote() {
    const gm = this.game;
    gm.showNote(this.noteId, this.noteTitle, this.noteText);
    if (this.itemReward && !gm.inventory.includes(this.itemReward)) {
      gm.inventory.push(this.itemReward);
      gm.hud.refreshInventory(gm.inventory);
    }
  }

  onUpdate(dt) {
    this.updateDoors(dt);

    const gm = this.game;
    if (gm.current !== this) return;
    const l = this.toLocal(gm.player.position);
    const room = this._rooms.find(
        r => l.x >= r.x0 && l.x <= r.x1 && l.z >= r.z0 && l.z <= r.z1);
    if (room && room.id !== this._lastRoom) {
      this._lastRoom = room.id;
      gm.hud.setLocation(`${this.name} — ${room.name}`);
    }
  }

    onEnter() { this._lastRoom = null; }
// Двери НЕ сбрасываются при входе — раньше из-за resetDoors()
// дверь визуально «захлопывалась» сразу после того, как игрок
// проходил через неё в соседнюю сцену.
}

// ================== №20 — «Библиотека» ==================
export class Neighbor20Scene extends BaseApartmentScene {
  constructor(game) {
    super(game, "20");
    this.name = "Кв. 20 — «Библиотека»";
    this.noteId = "note_20";
    this.noteTitle = "Библиотечный формуляр";
    this.noteText = NOTE_20;
    this.wallText = "ТИШИНА";
    this.wallColor = "#8a7a5a";
    this.wallColor3D = 0x6a5a4a;
  }
  _buildProps(R) {
    const gm = this.game, S = this.solids;
    for (let i = 0; i < 5; i++)
      makeBox(R, 0.22, 0.06, 0.16, -1.1, 0.03 + i * 0.06, -1.8, 0x3a2a1a);

    const shelves = bookshelf(R, S, -2.05, 3.9, 0.4, 2.4, 2.2, "w");
    new Interactable(shelves, "Осмотреть полки", () => {
      gm.hud.showMessage("Корешки выцвели. На одной — «ОБЕРЕГ-88. Техдок». Внутри — пусто.", 6000);
    });

    table(R, S, 1.2, 4.7, 1.6, 0.9, 0.76, COLORS.DESK);
    makeBox(R, 0.4, 0.05, 0.3, 1.0, 0.8, 4.7, 0xd8cfae);
    vase(R, 1.75, 0.76, 4.45, { color: 0x6a5a3a });
    chair(R, S, 1.2, 3.8, "s");

    this._nightstandWithNote(R, -1.4, 3.6, "Прочитать формуляр");
    armchair(R, S, 1.85, 3.1, "e", 0x5a4a30);
    floorLamp(R, S, 2.1, 2.5);
    rug(R, 0, 3.8, 2.0, 1.4, 0x5a3a2a, 0x3a2418);

    pictureWall(R, 2.3, 1.7, 4.3, "w", [
      { u: 0, w: 0.5, h: 0.4, art: "landscape" },
    ]);
    frame(R, 2.3, 1.6, 3.2, "w", 0.35, 0.45, "portrait");
    plantCorner(R, S, -0.9, 5.1, { s: 1.0 });
    clutterShelf(R, -2.3, 1.85, 2.4, "e", 0.7);
  }
}

// ================== №30 — «Лазарет» ==================
export class Neighbor30Scene extends BaseApartmentScene {
  constructor(game) {
    super(game, "30");
    this.name = "Кв. 30 — «Лазарет»";
    this.noteId = "note_30";
    this.noteTitle = "Выписка из истории болезни";
    this.noteText = NOTE_30;
    this.wallText = "ПАЛАТА 4";
    this.wallColor = "#b8c0a8";
    this.wallColor3D = 0x8a9080;
    this.floorOverrides = { hall: 0x707a70, bath: 0x889888 };
  }
  _buildProps(R) {
    const gm = this.game, S = this.solids;

    const medkit = makeBox(R, 0.12, 0.5, 0.35, -2.24, 1.5, -1.5, 0xdcd2c0);
    const cross = makeBox(R, 0.02, 0.2, 0.06, -2.17, 1.5, -1.5, 0xa82a22);
    const cross2 = makeBox(R, 0.02, 0.06, 0.2, -2.17, 1.5, -1.5, 0xa82a22);
    new Interactable([medkit, cross, cross2], "Открыть аптечку", () => {
      gm.audio.play("click");
      gm.hud.showMessage("Йод, бинты, шприц-тюбик с мутной жидкостью. Всё просрочено в ноябре 1988-го.", 6000);
    });

    const gurney = [
      makeBox(R, 0.6, 0.1, 1.4, 1.8, 0.7, 3.3, 0xb0b0a8),
      makeBox(R, 0.5, 0.06, 0.4, 1.8, 0.78, 2.85, 0xdcdcd0),
    ];
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      gurney.push(makeBox(R, 0.04, 0.65, 0.04, 1.8 + sx * 0.26, 0.325, 3.3 + sz * 0.62, 0x8a8a84));
    S.push({ min: [1.5, 0, 2.6], max: [2.1, 0.8, 4.0] });
    new Interactable(gurney, "Осмотреть каталку", () => {
      gm.hud.showMessage("Простыня ещё хранит вмятину. Кто-то лежал здесь минуту назад.", 5000);
    });

    solidBox(R, S, 0.9, 0.5, 2.0, -1.4, 0.25, 3.8, 0xc4c4ba);
    makeBox(R, 0.8, 0.06, 0.5, -1.4, 0.53, 3.1, 0xe8e4d8);
    makeBox(R, 0.02, 1.8, 0.02, -1.95, 1.3, 3.8, 0x8a8a84);
    makeBox(R, 0.3, 0.02, 0.02, -1.95, 2.18, 3.8, 0x8a8a84);
    const pouch = glow(makeBox(R, 0.1, 0.2, 0.06, -1.95, 2.05, 3.8, 0xc8e0d0), 0x2a3a2a, 0.8);
    new Interactable(pouch, "Посмотреть капельницу", () => {
      gm.audio.play("glitch");
      gm.hud.showMessage("Раствор мутный. В трубке — ни единой капли движения,\nбудто время внутри застыло.", 6000);
    });

    table(R, S, 1.4, 4.6, 1.0, 0.6, 0.78, 0x8a8a80);
    for (let i = 0; i < 4; i++) makeBox(R, 0.1, 0.04 + (i % 2) * 0.04, 0.16, 1.1 + i * 0.13, 0.82, 4.6, i % 2 ? 0xdcd2c0 : 0x8a9a9a);

    this._nightstandWithNote(R, -1.4, 5.1, "Прочитать выписку");
    rug(R, 0.2, 4.2, 1.6, 1.2, 0x6a7a70, 0x4a5a50);
    frame(R, 2.3, 1.6, 4.6, "w", 0.45, 0.6, "abstract");
    wallClock(R, -2.3, 2.0, 2.9, "e");
    plantPot(R, S, 0.3, 5.15, { s: 1.0 });
  }
}

// ================== №40 — «Вахтёрская» ==================
export class Neighbor40Scene extends BaseApartmentScene {
  constructor(game) {
    super(game, "40");
    this.name = "Кв. 40 — «Вахтёрская»";
    this.noteId = "note_40";
    this.noteTitle = "Расписание дежурств (кв. 40)";
    this.noteText = NOTE_40;
    this.wallText = "ДЕЖУРСТВО";
    this.wallColor = "#8a8a70";
    this.wallColor3D = 0x6a6a60;
    this.curtainSides = [-1];
  }
  _buildProps(R) {
    const gm = this.game, S = this.solids;

    const mat = makeBox(R, 0.7, 0.04, 0.5, 0, 0.035, -3.1, 0x3a2a1a);
    let taken = gm.inventory.includes("Ключ от щитовой");
    const matI = new Interactable(mat, taken ? "Коврик (пусто)" : "Заглянуть под коврик", () => {
      gm.audio.play("click");
      if (taken) { gm.hud.showMessage("Под ковриком пусто. Ты уже забрал ключ."); return; }
      taken = true;
      matI.prompt = "Коврик (пусто)";
      gm.inventory.push("Ключ от щитовой");
      gm.hud.refreshInventory(gm.inventory);
      gm.hud.showMessage("Под ковриком — маленький ржавый ключ с биркой «ЩИТ. ЭТ.5».\nПолучено: Ключ от щитовой", 5000);
    });

    const intercom = makeBox(R, 0.3, 0.4, 0.08, -1.75, 1.4, -1.14, 0x2a2a28);
    const grille = makeBox(R, 0.18, 0.18, 0.02, -1.75, 1.45, -1.19, 0x141414);
    new Interactable([intercom, grille], "Включить связь", () => {
      gm.audio.play("glitch");
      gm.hud.showMessage("В динамике — только шум. Потом голос, женский, усталый:\n«...смена не закончится, пока в 42-й горит свет...»", 6000);
    });

    const shelf = bookshelf(R, S, 1.95, 5.3, 0.7, 0.4, 1.8, "n");
    new Interactable(shelf, "Осмотреть стеллаж", () => {
      gm.hud.showMessage("Папки с личными делами жильцов. Все датированы 1988 годом.\nТвоей папки среди них нет — она в архиве НИИ.", 5000);
    });

    table(R, S, 0, 4.4, 1.4, 0.7, 0.76, COLORS.DESK);
    makeBox(R, 0.35, 0.04, 0.5, -0.4, 0.78, 4.4, 0xd8cfae);
    glow(makeBox(R, 0.18, 0.2, 0.18, -0.65, 0.86, 4.2, 0xd8c890), 0xf0dca0, 0.7);
    const note = makeBox(R, 0.3, 0.02, 0.4, 0.5, 0.77, 4.4, COLORS.NOTE);
    new Interactable(note, "Прочитать расписание", () => this._readNote());
    chair(R, S, 0, 3.55, "s");

    sofa(R, S, -1.85, 3.2, 0.8, 1.8, "w", 0x4a5a4a);
    rug(R, 0, 3.2, 1.8, 1.2, 0x5a3a2a, 0x3a2418);
    frame(R, 2.3, 1.7, 3.6, "w", 0.5, 0.4, "forest");
    calendar(R, 2.3, 1.7, 4.4, "w");
    wallClock(R, -2.3, 2.0, 4.6, "e");
    plantCorner(R, S, -1.9, 5.1, { s: 1.0 });
    clutterShelf(R, -2.3, 1.6, 2.0, "e", 0.55);
  }
}

// ================== №41 — «Физик» ==================
export class Neighbor41Scene extends BaseApartmentScene {
  constructor(game) {
    super(game, "41");
    this.name = "Кв. 41 — «Физик»";
    this.noteId = "note_41";
    this.noteTitle = "Страница из тетради (кв. 41)";
    this.noteText = NOTE_41;
    this.itemReward = "Ржавый лабораторный ключ №3";
    this.wallText = "4·0·4";
    this.wallColor = "#b4b4a0";
  }
  _buildProps(R) {
    const gm = this.game, S = this.solids;

    for (let i = 0; i < 3; i++)
      makeBox(R, 0.3, 0.04, 0.4, -1.4, 0.03 + i * 0.04, -1.8, 0x8a6a4a);

    table(R, S, 1.9, 3.2, 0.5, 0.5, 0.8, 0x4a3a2a);
    const radio = glow(makeBox(R, 0.25, 0.3, 0.45, 1.9, 0.95, 3.2, 0x5a4a30), 0x1a2a1a, 1);
    const dial = makeBox(R, 0.02, 0.08, 0.22, 1.9 - 0.135, 0.97, 3.2, 0x96c896);
    new Interactable([radio, dial], "Включить «ВЭФ»", () => {
      gm.audio.play("glitch");
      gm.hud.showMessage("Голос диктора, зацикленный:\n«Четыре-ноль-четыре... несущая частота стабильна...\nсубъект демонстрирует сопротивление фазе сжатия...»", 8000);
    });

    const wt = makeTextSprite("f(x) = Ψ(t) ⇌ λ·σ", { fontSize: 44, color: "#c8c8a8" });
    wt.position.set(-2.27, 2.05, 3.9);
    wt.rotation.y = Math.PI / 2;
    R.add(wt);

    table(R, S, 1.1, 4.6, 1.8, 0.9, 0.8, COLORS.DESK);
    for (const [x, z, c] of [[0.8, 4.6, 0xd8cfae], [1.1, 4.55, 0xc8bf9e], [1.5, 4.65, 0xe0d7b8]])
      makeBox(R, 0.3, 0.04, 0.45, x, 0.82, z, c);
    const drawer = makeBox(R, 0.5, 0.15, 0.8, 1.1, 0.62, 4.6, 0x4a3a2a);
    new Interactable(drawer, "Открыть верхний ящик", () => {
      gm.audio.play("click");
      if (!gm.inventory.includes("Ржавый лабораторный ключ №3")) {
        gm.inventory.push("Ржавый лабораторный ключ №3");
        gm.hud.refreshInventory(gm.inventory);
        gm.hud.showMessage("В ящике — ржавый лабораторный ключ №3 с биркой «АРХИВ / ОБ-88».\nПолучено: Ржавый лабораторный ключ №3", 5000);
      } else gm.hud.showMessage("Ящик пуст. Ключ уже у тебя.");
    });
    chair(R, S, 1.1, 3.7, "s");

    sofa(R, S, -1.85, 3.4, 0.8, 1.8, "w", 0x5a5a4a);
    this._nightstandWithNote(R, -1.4, 4.9, "Прочитать страницу из тетради");
    rug(R, 0, 3.9, 1.8, 1.4, 0x4a4a3a, 0x30302a);
    pictureWall(R, 2.3, 1.7, 4.1, "w", [
      { u: 0, w: 0.5, h: 0.5, art: "stars" },
    ]);
    frame(R, 2.3, 1.65, 2.9, "w", 0.35, 0.45, "abstract");
    plantPot(R, S, 2.0, 5.1, { s: 1.0 });
    floorLamp(R, S, -2.1, 5.2);
    clutterShelf(R, -2.3, 1.65, 2.5, "e", 0.6);
  }
}

// ================== №43 — «Пустота» ==================
export class Neighbor43Scene extends BaseApartmentScene {
  constructor(game) {
    super(game, "43");
    this.name = "Кв. 43 — «Пустота»";
    this.noteId = "note_43";
    this.noteTitle = "Запись на перфоленте (кв. 43)";
    this.noteText = NOTE_43;
    this.wallText = "";
    this.wallColor3D = 0x4a4438;
    this.floorOverrides = { bath: 0x404040, corr: 0x3a342c, bedroom: 0x3a342c };
    this.sharedEast = true;
    this.curtainSides = [-1];
  }
  _buildProps(R) {
    const gm = this.game, S = this.solids;

    const cv = document.createElement("canvas");
    cv.width = 512; cv.height = 512;
    const bx = cv.getContext("2d");
    bx.fillStyle = "#2a2622"; bx.fillRect(0, 0, 512, 512);
    bx.strokeStyle = "#c8c8a0"; bx.lineWidth = 2;
    for (let i = 0; i < 40; i++) {
      const x1 = 100 + Math.random() * 300, y1 = 100 + Math.random() * 300;
      const x2 = 100 + Math.random() * 300, y2 = 100 + Math.random() * 300;
      bx.beginPath(); bx.moveTo(x1, y1); bx.lineTo(x2, y2); bx.stroke();
      bx.beginPath(); bx.arc(x1, y1, 3, 0, Math.PI * 2);
      bx.fillStyle = "#d0c890"; bx.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.8),
        new THREE.MeshLambertMaterial({ map: tex }));
    panel.position.set(-2.29, 1.6, 3.9);
    panel.rotation.y = Math.PI / 2;
    panel.userData.noPick = true;
    R.add(panel);

    solidBox(R, S, 0.5, 0.5, 0.5, 0, 0.25, 3.9, 0x4a3a2a);
    const mag = makeBox(R, 0.6, 0.3, 0.4, 0, 0.65, 3.9, 0x3a3a3a);
    const r1 = glow(makeBox(R, 0.18, 0.18, 0.02, -0.15, 0.66, 3.69, 0x707070), 0x2a2a2a, 1);
    const r2 = glow(makeBox(R, 0.18, 0.18, 0.02,  0.15, 0.66, 3.69, 0x707070), 0x2a2a2a, 1);

    let playing = false, playCount = 0;
    new Interactable([mag, r1, r2], "Включить «Маяк-205»", () => {
      if (playing) return;
      playing = true; playCount += 1;
      gm.audio.play("glitch");
      if (playCount < 3) {
        gm.hud.showMessage(
            "Плёнка крутится. Из динамика — твой собственный голос,\n" +
            "но с задержкой в полторы секунды:\n" +
            "«…я не помню, как попал сюда…» (эхо)\n" +
            `Счётчик оборотов: ${playCount}...`, 6000);
        setTimeout(() => { playing = false; }, 5000);
      } else {
        gm.hud.showMessage(
            "Плёнка доходит до конца. Механический счётчик щёлкает\n" +
            "и замирает на числе: 19880414.\n" +
            "Голос произносит: «Запомни цифры. Это дверь.»", 8000);
        gm.flags.archive_code_known = true;
        setTimeout(() => { playing = false; }, 6000);
      }
    });

    table(R, S, 0.9, 4.4, 0.5, 0.5, 0.6, 0x4a3a2a);
    const hint = makeBox(R, 0.25, 0.01, 0.3, 0.9, 0.61, 4.4, 0xe0d7b8);
    new Interactable(hint, "Прочитать обрывок бумаги", () => {
      gm.showNote("archive_hint", "Обрывок бумаги: код архива", NOTE_ARCHIVE_HINT);
    });

    this._nightstandWithNote(R, -1.4, 4.9, "Прочитать перфоленту");
    chair(R, S, 1.7, 3.0, "e");
    plantPot(R, S, 1.9, 5.1, { s: 1.1 });
    wallClock(R, 2.3, 2.1, 3.6, "w", { time: "stopped" });
  }
}

// ================== №44 — «Отражение» ==================
export class Neighbor44Scene extends BaseApartmentScene {
  constructor(game) {
    super(game, "44");
    this.name = "Кв. 44 — «Отражение»";
    this.noteId = "note_44";
    this.noteTitle = "Записка на полу (кв. 44)";
    this.noteText = NOTE_44;
    this.wallText = "ЭТО ТЫ?";
    this.wallColor = "#b4b4b4";
    this.wallColor3D = 0x707880;
    this._mirrorLooks = 0;
  }
  _buildProps(R) {
    const gm = this.game, S = this.solids;
    this._mirrorLooks = gm.flags.mirror_looks || 0;
    let vanished = gm.flags.mirror_solved === true;

    const chairBox = solidBox(R, S, 0.9, 0.9, 0.9, -1.4, 0.45, 4.5, 0x2a2622);
    const chairBack = makeBox(R, 0.9, 0.9, 0.15, -1.4, 1.4, 4.85, 0x1e1c1a);
    const figure = [
      makeBox(R, 0.4, 0.6, 0.25, -1.4, 1.2, 4.6, 0x141414),
      makeBox(R, 0.22, 0.24, 0.22, -1.4, 1.62, 4.62, 0x141414),
    ];
    this._figure = figure;
    const seatI = new Interactable([chairBox, chairBack, ...figure],
        vanished ? "Кресло пусто" : "Подойти к сидящему", () => {
          if (vanished) { gm.hud.showMessage("Кресло пусто. На полу — записка."); return; }
          if (this._mirrorLooks < 3) {
            gm.hud.showMessage("Силуэт не двигается. Кажется, он ждёт, пока ты\nсначала посмотришь в зеркало — достаточно раз.", 5000);
            return;
          }
          vanished = true;
          gm.flags.mirror_solved = true;
          for (const f of figure) f.visible = false;
          seatI.prompt = "Кресло пусто";
          gm.audio.play("glitch");
          gm.hud.showMessage("Силуэт оборачивается… и растворяется в воздухе.\nНа полу остаётся записка.", 6000);
        });
    if (vanished) for (const f of figure) f.visible = false;

    const mframe = makeBox(R, 0.06, 1.8, 1.0, 2.27, 1.4, 4.0, 0x28282c);
    this.mirrorGlass = glow(makeBox(R, 0.02, 1.7, 0.9, 2.235, 1.4, 4.0, 0x96a0aa), 0x3a4048, 0.5);
    this._mirrorBaseEmissive = 0.5;
    this._mirrorPulseT = 0;
    new Interactable([this.mirrorGlass, mframe], "Посмотреть в зеркало", () => this._lookInMirror());

    this._nightstandWithNote(R, 0.5, 3.6, "Прочитать записку");
    rug(R, 0.3, 4.2, 2.2, 1.6, 0x3a3a44, 0x24242c);
    sofa(R, S, 1.6, 2.95, 1.6, 0.8, "s", 0x4a4a52);
    frame(R, -2.3, 1.7, 3.0, "e", 0.4, 0.5, "portrait");
    frame(R, -2.3, 1.7, 3.8, "e", 0.4, 0.5, "portrait");
    plantPot(R, S, -0.2, 5.15, { s: 1.0 });
  }

  _lookInMirror() {
    const gm = this.game;
    this._mirrorLooks += 1;
    gm.flags.mirror_looks = this._mirrorLooks;
    gm.audio.play("glitch");
    const msgs = [
      "Отражение задерживается на долю секунды.\nВ отражении ты стоишь у кресла.\nВ комнате — ты стоишь у зеркала.",
      "Задержка растёт. Отражение моргает не в такт с тобой.\nНа миг тебе кажется, что оно смотрит мимо — на кресло.",
      "Отражение перестаёт повторять твои движения вовсе.\nОно медленно поворачивает голову к креслу за твоей спиной.\nКто из вас отражение?",
    ];
    gm.hud.showMessage(msgs[Math.min(this._mirrorLooks - 1, 2)], 6000);
    if (this.mirrorGlass) {
      const m = this.mirrorGlass.material;
      m.emissiveIntensity = 1.4;
      const sz = this.mirrorGlass.scale.z;
      this.mirrorGlass.scale.z = 1.08;
      setTimeout(() => { m.emissiveIntensity = this._mirrorBaseEmissive; this.mirrorGlass.scale.z = sz; }, 220);
    }
  }

  onUpdate(dt) {
    super.onUpdate(dt);
    if (!this.mirrorGlass) return;
    this._mirrorPulseT += dt;
    const amp = 0.03 + this._mirrorLooks * 0.02;
    const wobble = Math.sin(this._mirrorPulseT * (1.5 + this._mirrorLooks)) * amp;
    this.mirrorGlass.material.emissiveIntensity = this._mirrorBaseEmissive + wobble;
  }
}

// ================== №50 — «Обсерватория» ==================
export class Neighbor50Scene extends BaseApartmentScene {
  constructor(game) {
    super(game, "50");
    this.name = "Кв. 50 — «Обсерватория»";
    this.noteId = "note_50";
    this.noteTitle = "Последнее наблюдение";
    this.noteText = NOTE_50;
    this.wallText = "04:12 = 04:12";
    this.wallColor = "#a0b0c8";
    this.wallColor3D = 0x505870;
    this.floorOverrides = { bedroom: 0x3a4050 };
  }
  _buildProps(R) {
    const gm = this.game, S = this.solids;

    const cv = document.createElement("canvas");
    cv.width = 400; cv.height = 300;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#0a1020"; ctx.fillRect(0, 0, 400, 300);
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = `rgba(220,220,180,${0.3 + Math.random() * 0.7})`;
      ctx.fillRect(Math.random() * 400, Math.random() * 300, 1, 1);
    }
    const tex = new THREE.CanvasTexture(cv);
    const map = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7),
        new THREE.MeshLambertMaterial({ map: tex, emissive: new THREE.Color(0xffffff), emissiveMap: tex, emissiveIntensity: 0.3 }));
    map.position.set(-2.29, 1.95, -1.6);
    map.rotation.y = Math.PI / 2;
    R.add(map);

    const mount = solidBox(R, S, 0.15, 1.2, 0.15, 1.5, 0.6, 3.2, 0x2a2a2a);
    const tube = makeBox(R, 0.15, 0.15, 1.0, 1.5, 1.35, 3.2, 0x303038);
    tube.rotation.x = -0.4;
    makeBox(R, 0.4, 0.04, 0.4, 1.5, 0.02, 3.2, 0x1e1e1e);
    new Interactable([mount, tube], "Посмотреть в телескоп", () => {
      gm.audio.play("glitch");
      gm.hud.showMessage("Окуляр смотрит на север. Там — только туман.\nИ в тумане кто-то стоит. Возможно, ты. Возможно, нет.", 7000);
    });

    table(R, S, -1.4, 4.9, 0.4, 0.4, 0.55, 0x4a3a2a);
    makeBox(R, 0.2, 0.1, 0.2, -1.4, 0.6, 4.9, 0x8a8a70);

    solidBox(R, S, 0.08, 1.1, 0.08, 1.9, 0.55, 4.6, 0x2a2a2a);
    makeBox(R, 0.1, 0.1, 1.2, 1.9, 1.2, 4.6, 0x383840).rotation.x = -0.6;

    this._nightstandWithNote(R, 0.5, 4.9, "Прочитать последнее наблюдение");
    sofa(R, S, -1.85, 3.4, 0.8, 1.8, "w", 0x3a4050);
    rug(R, 0, 3.9, 2.0, 1.4, 0x3a4058, 0x242838);
    pictureWall(R, 2.3, 1.75, 3.9, "w", [
      { u: 0, w: 0.5, h: 0.5, art: "stars" },
    ]);
    frame(R, 2.3, 1.65, 2.8, "w", 0.35, 0.45, "abstract");
    plantCorner(R, S, -1.9, 5.1, { s: 0.95 });
  }
}