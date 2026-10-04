// Квартира №42 «Дом»: прихожая, коридор, ванная, кухня, спальня.

import * as THREE from "three";
import { Scene } from "../scene.js";
import { makeBox, makeHitbox, solidBox, glow, makeTextSprite } from "../utils.js";
import { Interactable } from "../interactable.js";
import { APARTMENT_ORIGIN } from "./hallway.js";
import { COLORS } from "../settings.js";
import { NOTE_FRIDGE } from "../data/notes.js";
import {
  WALL_H, buildApartmentShell, EntryDoor, buildEntryCasing, buildWindowFrame,
} from "./apartment_layout.js";
import {
  furnishHall, furnishCorridor, furnishBath, furnishKitchen,
  rug, frame, curtains, radiator, plantPot, floorLamp, bookshelf, chair,
  vase, calendar, pictureWall, plantCorner, clutterShelf, outsideView,
} from "./decor.js";

const APT_HALF  = 3.1;
const HALL_HALF = 1.6;
const CORR_HALF = 0.8;

export class ApartmentScene extends Scene {
  constructor(game) {
    super(game);
    this.name = "Кв. 42 — «Дом»";
    this.spawn = [0, 1.7, 3.4];
    this.spawnYaw = Math.PI;

    this._cityBuildings = [];
    this._rooms = [];
    this._lastRoom = null;
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
    });
    this._rooms = shell.rooms;
    this._entryZ = shell.entryZ;
    this.region = shell.region;

    // ================== ВХОДНАЯ ДВЕРЬ ==================
    this.entryDoor = new EntryDoor(this, R, {
      entryZ: this._entryZ,
      label: "42",
      onFirstOpen: () => gm.hud.showMessage(
          "Ты отпираешь дверь и тянешь её на себя. В лицо пахнуло\n" +
          "затхлым бетоном. Лестничная клетка. Тишина.", 5000),
    });
    buildEntryCasing(R, { entryZ: this._entryZ });

    this._buildHall(R);
    this._buildCorridor(R);
    this._buildBath(R);
    this._buildKitchen(R);
    this._buildBedroom(R);

    // ================== ОКНА ==================
    for (const w of shell.windows) {
      buildWindowFrame(R, w);
      outsideView(R, w);
    }

    // ================== СВЕТ ==================
    R.add(new THREE.AmbientLight(0x7a7268, 0.35));
    const pc = new THREE.PointLight(0xffe8b4, 0.55, 7);
    pc.position.set(0.0, 2.5, 0.4); R.add(pc);
    const pb = new THREE.PointLight(0xffe8b4, 0.5, 7);
    pb.position.set(0.5, 2.5, 3.9); R.add(pb);
    const pa = new THREE.PointLight(0xffe8b4, 0.4, 6);
    pa.position.set(0.0, 2.5, -2.8); R.add(pa);
    const wl = new THREE.PointLight(0x8088a0, 0.25, 6);
    wl.position.set(0.3, 1.7, 5.0); R.add(wl);
    const sl = new THREE.PointLight(0x3a8a5a, 0.15, 4);
    sl.position.set(2.0, 0.9, 4.4); R.add(sl);
    

    for (const [lx, lz] of [[0, -2], [0, 0.6], [-1.9, 0.6], [2.0, 0.6], [0.5, 3.9]]) {
      glow(makeBox(R, 0.14, 0.14, 0.14, lx, 2.7, lz, COLORS.LAMP), 0xf0dca0, 0.8);
      makeBox(R, 0.02, 0.1, 0.02, lx, 2.76, lz, 0x1a1a1a);
    }

    this.place(...APARTMENT_ORIGIN);
  }

  // ── ПРИХОЖАЯ ──────────────────────────────────────────────────
  _buildHall(R) {
    const gm = this.game;
    const z0 = this._entryZ;

    const wt = makeTextSprite("НЕ ВЫХОДИ. ОНА ЗАМКНУТА.", { fontSize: 44, color: "#782828" });
    wt.scale.setScalar(0.8);
    wt.position.set(0, 2.4, z0 + 0.13);
    R.add(wt);

    furnishHall(R, this.solids, {
      hhw: HALL_HALF, entryZ: z0,
      onMirror: () => {
        gm.audio.play("glitch");
        gm.hud.showMessage("В зеркале — ты. Только отражение моргнуло на секунду позже.", 5000);
      },
    });
  }

  // ── КОРИДОР ───────────────────────────────────────────────────
  _buildCorridor(R) {
    const gm = this.game;
    const { tableTop } = furnishCorridor(R, this.solids, {
      cw: CORR_HALF,
      onPhoto: () => gm.hud.showMessage(
          "Групповой снимок сотрудников ВЦ «Прибор». Все смотрят в камеру.\n" +
          "Твоё лицо чуть смазано, будто ты шевельнулся.", 6000),
    });

    const phone = makeBox(R, 0.2, 0.1, 0.22, tableTop.x, tableTop.y + 0.05, tableTop.z, 0x141414);
    const handset = makeBox(R, 0.22, 0.04, 0.06, tableTop.x, tableTop.y + 0.12, tableTop.z, 0x141414);
    new Interactable([phone, handset], "Телефон", () => {
      gm.audio.play("click");
      gm.hud.showMessage(
          "Тяжёлая чёрная трубка. В ней — ровный гудок, потом чьё-то дыхание.\n" +
          "Ты кладёшь её на место.", 5500);
    });
  }

  // ── ВАННАЯ ────────────────────────────────────────────────────
  _buildBath(R) {
    const gm = this.game;
    furnishBath(R, this.solids, {
      hw: APT_HALF, cw: CORR_HALF,
      hooks: {
        tub: () => {
          gm.audio.play("glitch");
          gm.hud.showMessage(
              "На эмали — рыжая дорожка от крана. Из слива тянет холодом,\n" +
              "будто внизу тоже подъезд.", 6000);
        },
        mirror: () => {
          gm.audio.play("glitch");
          gm.hud.showMessage("Зеркало запотело изнутри. Кто-то вывел пальцем на стекле: 04:12.", 6000);
        },
      },
    });
    plantPot(R, this.solids, -2.7, 1.05, { s: 0.9 });
  }

  // ── КУХНЯ ─────────────────────────────────────────────────────
  _buildKitchen(R) {
    const gm = this.game;
    const k = furnishKitchen(R, this.solids, { hw: APT_HALF, cw: CORR_HALF });

    new Interactable(k.fridgeParts, "Открыть холодильник «Минск»", () => {
      if (!gm.notesRead.has("fridge")) {
        gm.showNote("fridge", "Записка на дверце холодильника", NOTE_FRIDGE);
      } else {
        gm.hud.showMessage("Внутри только пустая банка и запах старого железа.");
      }
      gm.audio.play("click");
    });
    new Interactable(k.stoveParts, "Осмотреть плиту", () => {
      gm.hud.showMessage("Конфорки холодные. Но чайник на плите ещё тёплый.", 5000);
    });
    new Interactable(k.kettleParts, "Потрогать чайник", () => {
      gm.audio.play("click");
      gm.hud.showMessage("Тёплый. Кто-то вскипятил воду минуту назад.", 5000);
    });
  }

  // ── СПАЛЬНЯ ───────────────────────────────────────────────────
  _buildBedroom(R) {
    const gm = this.game;
    const S = this.solids;

    // кровать
    const bed = solidBox(R, S, 1.6, 0.6, 2.4, -1.7, 0.3, 4.2, COLORS.BED);
    const bedParts = [bed,
      makeBox(R, 1.6, 0.9, 0.1, -1.7, 0.8, 5.45, 0x3c322e),
      makeBox(R, 1.2, 0.15, 0.4, -1.7, 0.675, 5.0, 0x8a7a68),
      makeBox(R, 1.5, 0.15, 1.5, -1.7, 0.675, 3.8, 0x5a4a3a)];
    new Interactable(bedParts, "Лечь спать", () => {
      gm.audio.play("glitch");
      gm.hud.showMessage(
          gm.loopCount === 0
              ? "Ты лежишь. Панцирная сетка скрипит под весом.\nСон не приходит."
              : "Кровать стала чужой. Пружины звенят на другой ноте.",
          5000);
    });

    // тумбочка
    solidBox(R, S, 0.4, 0.5, 0.4, -0.65, 0.25, 5.25, 0x4a3a2c);
    makeBox(R, 0.12, 0.2, 0.12, -0.7, 0.6, 5.3, 0x3a3a36);
    glow(makeBox(R, 0.22, 0.16, 0.22, -0.7, 0.78, 5.3, 0xd8c890), 0xf0dca0, 0.8);
    glow(makeBox(R, 0.12, 0.08, 0.06, -0.6, 0.54, 5.1, 0x2a2622), 0x8a2a2a, 0.9);

    plantPot(R, S, -2.75, 5.2, { s: 1.2 });

    const clk = makeTextSprite("04:12", { fontSize: 60, color: "#5a4a3a" });
    clk.position.set(-2.97, 2.0, 3.6);
    clk.rotation.y = Math.PI / 2;
    R.add(clk);

    // шкаф
    const wardrobe = solidBox(R, S, 1.2, 2.2, 0.6, 2.3, 1.1, 2.6, 0x5a4535);
    const wParts = [wardrobe,
      makeBox(R, 0.015, 2.0, 0.02, 2.3, 1.1, 2.905, 0x2a1e14),
      makeBox(R, 0.04, 0.2, 0.03, 2.25, 1.1, 2.915, 0x8a8060),
      makeBox(R, 0.04, 0.2, 0.03, 2.35, 1.1, 2.915, 0x8a8060)];
    new Interactable(wParts, "Открыть шкаф", () => {
      gm.audio.play("click");
      gm.hud.showMessage("Три одинаковых пиджака на плечиках. Все — на твой размер.", 5000);
    });

    // рабочий стол с ЭВМ
    const dx = 2.0, dz = 4.9;
    const deskParts = [
      makeBox(R, 2.0, 0.05, 1.1, dx, 0.725, dz, COLORS.DESK),
      makeBox(R, 0.05, 0.7, 1.0, dx - 0.95, 0.35, dz, COLORS.DESK),
      makeBox(R, 0.5, 0.7, 0.95, dx + 0.7, 0.35, dz, COLORS.DESK),
    ];
    S.push({ min: [dx - 1.0, 0, dz - 0.55], max: [dx + 1.0, 0.75, dz + 0.55] });
    const monitor = makeBox(R, 0.55, 0.45, 0.55, dx + 0.1, 0.975, dz, COLORS.MONITOR);
    const screen = glow(makeBox(R, 0.42, 0.32, 0.02, dx + 0.1, 1.0, dz - 0.286, COLORS.SCREEN), 0x2a5a2a, 0.6);
    const unit = makeBox(R, 0.5, 0.5, 0.5, dx + 0.65, 1.0, dz + 0.05, 0x46403a);
    const kbd = makeBox(R, 0.55, 0.03, 0.2, dx - 0.25, 0.765, dz - 0.3, 0x2a2a2a);
    deskParts.push(monitor, screen, unit, kbd);
    makeBox(R, 0.18, 0.02, 0.26, dx - 0.75, 0.76, dz - 0.15, 0xd8cfae);
    makeBox(R, 0.08, 0.1, 0.08, dx - 0.7, 0.8, dz + 0.25, 0x6a3a2a);

    const hot = makeHitbox(R, 1.4, 1.4, 1.2, dx + 0.2, 1.0, dz - 0.1);
    new Interactable([hot, ...deskParts], "Сесть за ЭВМ «Искра»", () => this.game.openComputer());
    chair(R, S, dx, 3.85, "s");

    // уют
    rug(R, 0.5, 3.8, 2.6, 1.8, 0x5a3a2a, 0x3a2418);
    bookshelf(R, S, -2.825, 2.8, 0.35, 0.9, 1.9, "w");
    floorLamp(R, S, 2.7, 3.2);

    // Стена с картинами (южная)
      // Окно на северной стене: x ∈ [-0.9, 1.5]. Старые картины были
// прямо в оконном проёме (x=-0.9 и x=-0.3). Двигаем к западной стене.
      pictureWall(R, -2.4, 1.75, 5.5, "s", [
          { u: -0.2, w: 0.55, h: 0.45, art: "landscape" },
          { u:  0.4, w: 0.35, h: 0.45, art: "portrait" },
      ]);
      
      
    frame(R, 3.0, 1.55, 3.5, "w", 0.5, 0.65, "abstract");
    calendar(R, 3.0, 1.75, 4.9, "w");

      // Постер был прямо в дверном проёме спальни (x=0.4, z=2.3 при проёме
// x∈[-0.55,0.55]). Переехал на восток.
      frame(R, 1.0, 1.8, 2.3, "n", 0.45, 0.6, "poster");

    // Дополнительный декор
    plantCorner(R, S, -2.75, 2.6, { s: 0.9 });
    clutterShelf(R, 3.0, 1.85, 4.2, "w", 0.55);

    curtains(R, 0.3, 5.5, "s", { w: 2.4 + 0.3, sides: [-1] });
    radiator(R, 0.3, 5.5, "s", 1.2);
    vase(R, 0.9, 0.0, 5.25, { color: 0x6a5a3a });
  }

  // ── Апдейт ────────────────────────────────────────────────────
  onUpdate(dt) {
    for (const b of this._cityBuildings) {
      b.flickerT += dt;
      if (b.flickerT > 0.7 + Math.random() * 0.6) {
        b.flickerT = 0;
        for (let i = 0; i < 2; i++) {
          const w = b.windows[(Math.random() * b.windows.length) | 0];
          if (!w) continue;
          w.lit = Math.random() < 0.5 ? !w.lit : w.lit;
          b.ctx.fillStyle = w.lit ? "#e0c078" : "#232228";
          b.ctx.fillRect(w.x, w.y, 7, 5);
        }
        b.texture.needsUpdate = true;
      }
    }

    this.updateDoors(dt);

    const gm = this.game;
    if (gm.current !== this) return;
    const l = this.toLocal(gm.player.position);
    const room = this._rooms.find(
        r => l.x >= r.x0 && l.x <= r.x1 && l.z >= r.z0 && l.z <= r.z1);
    if (room && room.id !== this._lastRoom) {
      this._lastRoom = room.id;
      gm.hud.setLocation(`Кв. 42 — ${room.name}`);
    }
  }

  // ── Сюжетные реплики ──────────────────────────────────────────
  onEnter() {
    const gm = this.game;
    this._lastRoom = null;

    if (!gm.flags.intro_shown) {
      gm.flags.intro_shown = true;
      gm.dialogue.show(
          "Ты открываешь глаза на панцирной кровати.\n" +
          "За окном — вечный ноябрь. На столе гудит ЭВМ «Искра».\n" +
          "Ты — Морозов Алексей Владимирович, младший инженер ВЦ «Прибор».\n" +
          "Ты не помнишь, как здесь оказался.",
          "СИСТЕМА", 9);
      return;
    }
    if (!gm.flags.quest_hint_shown) {
      gm.flags.quest_hint_shown = true;
      gm.dialogue.show(
          "На экране ЭВМ горит приглашение к сеансу.\n" +
          "В разделе «Журнал_задач.log» можно проверить,\n" +
          "что ещё предстоит сделать.",
          "", 6);
      return;
    }
    if (gm.loopCount >= 1 && !gm.flags.post_loop_1_shown) {
      gm.flags.post_loop_1_shown = true;
      gm.dialogue.show(
          "Что-то в квартире стало другим.\n" +
          "В сорок первой квартире сам включился радиоприёмник «ВЭФ».",
          "", 5);
      return;
    }
    if (gm.loopCount >= 2 && !gm.flags.post_loop_2_shown) {
      gm.flags.post_loop_2_shown = true;
      gm.dialogue.show(
          "Часы на стене показывают 04:12. Они стоят.\n" +
          "Пыль на ковре стала темнее.",
          "", 5);
      return;
    }
    if (gm.loopCount >= 3 && !gm.flags.post_loop_3_shown) {
      gm.flags.post_loop_3_shown = true;
      gm.dialogue.show(
          "Голос из-за стены:\n" +
          "«Морозов… ты ещё здесь? Мы теряем несущую.\n" +
          " Найди узел синхронизации. Слышишь? Узел.»",
          "ОПЕРАТОР", 7);
      return;
    }
  }
}