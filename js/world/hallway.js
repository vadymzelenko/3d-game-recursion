// Лестничная клетка. Квартиры физически стоят за дверьми (см. apartment.js
// и neighbors.js). Переходы — через регионы, без телепорта.

import * as THREE from "three";
import { Scene } from "../scene.js";
import { makeBox, aabb, glow } from "../utils.js";
import { Interactable } from "../interactable.js";
import { COLORS } from "../settings.js";
import { decal, plate } from "./text.js";

const FLOOR_H = 3.0;
const SLAB_T  = 0.3;
const WALL_T  = 0.2;

const HZ         = 1.2;              // половина ширины подъезда по z
const LANDING_X0 = -8.5;             // западная стена площадки
const DOOR_W     = 1.1;
const DOOR_H     = 2.1;

const TREADS   = 8;
const RUN      = 0.27;
const RISE     = FLOOR_H / (2 * (TREADS + 1));
const X_MID    = TREADS * RUN;
const MID_DEPTH = 1.2;
const X_EAST   = X_MID + MID_DEPTH;
const MID_Y    = FLOOR_H / 2;
const STEP_T   = 0.3;
const DIV_T    = 0.2;
const LANE_W   = HZ - DIV_T / 2;
const LANE_A_Z = -(DIV_T / 2 + LANE_W / 2);
const LANE_B_Z = +(DIV_T / 2 + LANE_W / 2);

const NUM_FLOORS  = 4;
const SPAWN_FLOOR = 2;
// Подписи этажей. Дом замкнут: под вторым этажом снова пятый,
// над пятым — снова второй. Квартира 42 — на пятом.
const FLOOR_LABELS = ["3", "4", "5", "2"];
const LOOP_H      = NUM_FLOORS * FLOOR_H;

const FIRST_FLOOR = -2;
const LAST_FLOOR  = NUM_FLOORS + 1;

const WRAP_TOP    = (NUM_FLOORS - 1) * FLOOR_H + MID_Y + RISE / 2;
const WRAP_BOTTOM = -MID_Y - RISE / 2;

const wrapIdx = (i) => ((i % NUM_FLOORS) + NUM_FLOORS) % NUM_FLOORS;

const FLOOR_PLAN = [
  [{ num: "20" }, { num: "21" }, { num: "22" }, { num: "23" }],
  [{ num: "30" }, { num: "31" }, { num: "32" }, { num: "33" }],
  [{ num: "40" }, { num: "41" }, { num: "42" }, { num: "43" }],
  [{ num: "44" }, { num: "50" }, { num: "51" }, { num: "52" }],
];

// Обитаемые (с комнатами в мире) и необитаемые (запертые двери).
export const INTERACTIVE_APARTMENTS = {
  "20": "neighbor_20", "30": "neighbor_30",
  "40": "neighbor_40", "41": "neighbor_41", "42": "apartment",
  "43": "neighbor_43", "44": "neighbor_44", "50": "neighbor_50",
};

// Дверные проёмы. side: +1 — северная стена, -1 — южная.
const DOORS = [
  { side: +1, x: -1.0, idx: 2 },   // 42 / 22 / 32 / 51
  { side: +1, x: -6.5, idx: 3 },   // 43 / 23 / 33 / 52
  { side: -1, x: -6.5, idx: 0 },   // 40 / 20 / 30 / 44
  { side: -1, x: -1.0, idx: 1 },   // 41 / 21 / 31 / 50
];

// Смещение входной стены квартиры от центра подъезда. Формула даёт z, при
// котором входная стена квартиры стыкуется с внешней стеной подъезда.
const ENTRY_OFFSET = HZ + WALL_T + 3.7;

// Origin квартиры игрока (#42) — для apartment.js.
export const APARTMENT_ORIGIN = [-1.0, SPAWN_FLOOR * FLOOR_H, ENTRY_OFFSET];

// Origin любой квартиры — для neighbors.js.
export function apartmentOrigin(num) {
  for (let f = 0; f < NUM_FLOORS; f++) {
    const plan = FLOOR_PLAN[f];
    for (const d of DOORS) {
      if (plan[d.idx].num === num) {
        const y = f * FLOOR_H;
        const z = d.side === +1 ? ENTRY_OFFSET : -ENTRY_OFFSET;
        const rotY = d.side === +1 ? 0 : Math.PI;
        return { x: d.x, y, z, rotY, floor: f, side: d.side };
      }
    }
  }
  return null;
}

const COL_RAIL   = 0x3a3833;
const COL_CASING = 0x3e3328;

export class HallwayScene extends Scene {
  constructor(game) {
    super(game);
    this.name = "Подъезд";
    this.spawn = [-1.0, SPAWN_FLOOR * FLOOR_H + 1.7, -0.2];
    this.spawnYaw = Math.PI;
  }

  build() {
    const R = this.group;
    this.game.scene.add(R);

    for (let i = FIRST_FLOOR; i <= LAST_FLOOR + 1; i++) this._buildSlab(R, i * FLOOR_H);
    for (let i = FIRST_FLOOR; i <= LAST_FLOOR; i++) {
      const y = i * FLOOR_H;
      this._buildWalls(R, y);
      this._buildDoors(R, i, y);
      this._buildLight(R, y);
      this._buildFloorNumber(R, i, y);
    }
    for (let i = FIRST_FLOOR - 1; i <= LAST_FLOOR; i++) this._buildMarch(R, i * FLOOR_H);
    this._buildFusebox(R);

    this.region = {
      x0: LANDING_X0,
      x1: X_EAST + WALL_T,
      z0: -HZ - WALL_T,
      z1:  HZ + WALL_T,
      y0: FIRST_FLOOR * FLOOR_H - 1,
      y1: (LAST_FLOOR + 1) * FLOOR_H + 1,
    };
  }

  _buildSlab(R, yTop) {
    const w = -LANDING_X0;
    const m = makeBox(R, w, SLAB_T, 2 * HZ, LANDING_X0 + w / 2, yTop - SLAB_T / 2, 0, COLORS.FLOOR);
    this.solids.push(aabb(m));
  }

  _buildWalls(R, y) {
    const cy = y + FLOOR_H / 2;
    const west = makeBox(R, WALL_T, FLOOR_H, 2 * HZ, LANDING_X0 - WALL_T / 2, cy, 0, COLORS.WALL);
    this.solids.push(aabb(west));
    const east = makeBox(R, WALL_T, FLOOR_H, 2 * HZ, X_EAST + WALL_T / 2, cy, 0, COLORS.WALL);
    this.solids.push(aabb(east));
    // Панель масляной краской — до 1.4 м, как в каждом советском подъезде.
    makeBox(R, 0.01, 1.4, 2 * HZ, LANDING_X0 + 0.005, y + 0.7, 0, 0x3e4a44).userData.noPick = true;

    const x0 = LANDING_X0 - WALL_T;
    const x1 = X_EAST + WALL_T;

    for (const side of [+1, -1]) {
      const zc = side * (HZ + WALL_T / 2);
      const ops = DOORS.filter(d => d.side === side).sort((a, b) => a.x - b.x);
      const seg = (a, b) => {
        if (b - a <= 0.01) return;
        const m = makeBox(R, b - a, FLOOR_H, WALL_T, (a + b) / 2, cy, zc, COLORS.WALL);
        this.solids.push(aabb(m));
      };
      let cursor = x0;
      for (const d of ops) {
        seg(cursor, d.x - DOOR_W / 2);
        cursor = d.x + DOOR_W / 2;
        const lh = FLOOR_H - DOOR_H;
        const lintel = makeBox(R, DOOR_W, lh, WALL_T, d.x, y + DOOR_H + lh / 2, zc, COLORS.WALL);
        this.solids.push(aabb(lintel));
      }
      seg(cursor, x1);
    }
  }

  _buildDoors(R, i, y) {
    const gm = this.game;
    const plan = FLOOR_PLAN[wrapIdx(i)];
    // Этажи-«копии» сверху и снизу видны только в пролёт лестницы:
    // за их дверьми нет квартир, поэтому все створки там закрыты.
    const real = i >= 0 && i < NUM_FLOORS;

    for (const d of DOORS) {
      const info = plan[d.idx];
      const s = d.side;
      const toward = -s;
      const zc = s * (HZ + WALL_T / 2);
      const zIn = s * HZ;

      const casingD = WALL_T + 0.04;
      for (const sx of [-1, 1]) {
        makeBox(R, 0.06, DOOR_H - 0.06, casingD,
            d.x + sx * (DOOR_W / 2 - 0.03), y + (DOOR_H - 0.06) / 2, zc, COL_CASING);
      }
      makeBox(R, DOOR_W, 0.06, casingD, d.x, y + DOOR_H - 0.03, zc, COL_CASING);

      // Эмалированная табличка с номером над дверью.
      plate(R, info.num, {
        x: d.x, y: y + DOOR_H + 0.26, z: zIn + toward * 0.008,
        face: toward > 0 ? "n" : "s", w: 0.24, h: 0.17,
        bg: "#203048", fg: "#ece4c8", border: "#d8cfa8",
      });

      const sceneKey = INTERACTIVE_APARTMENTS[info.num];
      if (sceneKey && real) continue;   // квартира стоит за проёмом физически

      const leafW = DOOR_W - 0.12 - 0.02;
      const leafH = DOOR_H - 0.06 - 0.03;
      const leafT = 0.06;
      const door = makeBox(R, leafW, leafH, leafT, d.x, y + 0.02 + leafH / 2, zc, COLORS.DOOR);
      this.solids.push({
        min: [d.x - DOOR_W / 2, y,          zc - WALL_T / 2],
        max: [d.x + DOOR_W / 2, y + DOOR_H, zc + WALL_T / 2],
      });
      const pz = zc + toward * (leafT / 2 + 0.01);
      const p1 = makeBox(R, 0.66, 0.78, 0.02, d.x, y + 1.45, pz, 0x4a2f1e);
      const p2 = makeBox(R, 0.66, 0.55, 0.02, d.x, y + 0.60, pz, 0x4a2f1e);
      const knob = makeBox(R, 0.04, 0.10, 0.07, d.x + 0.36, y + 1.0,
          zc + toward * (leafT / 2 + 0.035), 0x8a8060);

      const LINES = [
        "Заперто. За дверью — тишина. Не темнота. Тишина.",
        "Заперто. Я стучу. Никто не отвечает. Никто и не должен.",
        "Заперто. Из-под двери тянет холодом, как из погреба.",
        "Заперто. На коврике — пыль без следов.",
      ];
      new Interactable([door, p1, p2, knob], `Кв. ${info.num}`, () => {
        gm.audio.play("locked");
        const n = (+info.num) % LINES.length;
        gm.hud.say(LINES[n]);
      });
    }
  }

  _buildMarch(R, y) {
    for (let k = 1; k <= TREADS; k++) this._tread(R, (k - 0.5) * RUN, y + k * RISE, LANE_A_Z);
    for (let j = 1; j <= TREADS; j++) this._tread(R, X_MID - (j - 0.5) * RUN, y + MID_Y + j * RISE, LANE_B_Z);

    const mid = makeBox(R, MID_DEPTH, STEP_T, 2 * HZ,
        X_MID + MID_DEPTH / 2, y + MID_Y - STEP_T / 2, 0, COLORS.STAIRS);
    this.solids.push(aabb(mid));

    makeBox(R, X_MID, FLOOR_H, DIV_T, X_MID / 2, y + FLOOR_H / 2, 0, COLORS.WALL_DARK);
    this.solids.push({
      min: [0,     y - STEP_T,        -DIV_T / 2],
      max: [X_MID, y + FLOOR_H + 1.0, +DIV_T / 2],
    });

    const dy  = TREADS * RISE;
    const len = Math.hypot(X_MID, dy);
    const ang = Math.atan2(dy, X_MID);
    const cyA = y + 5 * RISE + 0.9;
    const cyB = y + MID_Y + 5 * RISE + 0.9;
    for (const z of [-HZ + 0.05, -DIV_T / 2 - 0.05]) {
      const r = makeBox(R, len, 0.05, 0.05, X_MID / 2, cyA, z, COL_RAIL);
      r.rotation.z = ang;
    }
    for (const z of [HZ - 0.05, DIV_T / 2 + 0.05]) {
      const r = makeBox(R, len, 0.05, 0.05, X_MID / 2, cyB, z, COL_RAIL);
      r.rotation.z = -ang;
    }
  }

  _tread(R, cx, topY, cz) {
    const m = makeBox(R, RUN, STEP_T, LANE_W, cx, topY - STEP_T / 2, cz, COLORS.STAIRS);
    this.solids.push(aabb(m));
  }

  _buildLight(R, y) {
    // Плафоны под потолком площадки и над промежуточной площадкой.
    for (const [lx, ly] of [[-3.4, y + FLOOR_H - 0.1], [X_MID + 0.6, y + MID_Y + FLOOR_H - 0.4]]) {
      const lamp = glow(makeBox(R, 0.22, 0.12, 0.22, lx, ly - 0.06, 0, 0xe8dcb0), 0xf0dca0, 0.9);
      this._lamps = this._lamps || [];
      this._lamps.push(lamp);
      this.light(lx, ly - 0.25, 0, { intensity: 5, distance: 9, group: "hall", flicker: 0.3 });
    }
  }

  _buildFloorNumber(R, i, y) {
    const label = FLOOR_LABELS[wrapIdx(i)];
    // Трафарет краской по стене — тот самый «5 ЭТАЖ».
    decal(R, `${label} ЭТАЖ`, {
      x: LANDING_X0 + 0.012, y: y + 1.9, z: -0.15, face: "e",
      width: 0.9, style: "paint", px: 120,
    });
  }

  _buildFusebox(R) {
    const gm = this.game;
    const y = SPAWN_FLOOR * FLOOR_H;
    const x = LANDING_X0 + 0.09, z = 0.75;

    const box = makeBox(R, 0.16, 0.72, 0.52, x, y + 1.4, z, 0x4a4c48);
    this.solids.push(aabb(box));
    const lid = makeBox(R, 0.02, 0.66, 0.46, x + 0.09, y + 1.4, z, 0x5a5c56);
    const handle = makeBox(R, 0.03, 0.08, 0.03, x + 0.11, y + 1.4, z + 0.18, 0x8a8a80);
    const lamp = glow(makeBox(R, 0.02, 0.04, 0.04, x + 0.1, y + 1.82, z - 0.15, 0x6a2a20), 0x000000, 0);
    this._fuseLamp = lamp;
    plate(R, "ЩИТ. ЭТ.5", { x: x + 0.101, y: y + 1.62, z, face: "e", w: 0.22, h: 0.07, bg: "#d8cfb0", fg: "#1a1a1a", border: "#1a1a1a" });
    decal(R, "⚡", { x: x + 0.101, y: y + 1.25, z, face: "e", width: 0.12, style: "label", color: "rgba(200,40,30,0.95)" });

    new Interactable([box, lid, handle, lamp], () =>
      gm.state.is("jumper_set") ? "Щиток" : gm.state.is("power_on") ? "Открыть щиток" : "Электрощит",
      () => gm.puzzles.fusebox.open());
  }

  sync() {
    const s = this.game.state;
    const on = s.is("power_on");
    this.game.lights.setGroupLevel("hall", on ? 1 : 0.1);
    if (this._lamps) for (const l of this._lamps) l.material.emissiveIntensity = on ? 0.9 : 0.06;
    if (this._fuseLamp) {
      this._fuseLamp.material.emissive.setHex(on ? 0x40ff60 : 0x000000);
      this._fuseLamp.material.emissiveIntensity = on ? 0.9 : 0;
    }
  }

  onUpdate() {
    const gm = this.game;
    const p = gm.player;
    const feetY = p.position.y - p.height;
    if (feetY > WRAP_TOP) this._wrap(-LOOP_H);
    else if (feetY < WRAP_BOTTOM) this._wrap(+LOOP_H);

    if (gm.current === this) {
      const label = FLOOR_LABELS[wrapIdx(Math.round(feetY / FLOOR_H))];
      gm.hud.setLocation(`Подъезд · ${label} этаж`);
    }

    // Сообщение о витке — когда игрок действительно ступил на «пятый».
    if (this._wrapPending && gm.current === this
        && Math.abs(feetY - SPAWN_FLOOR * FLOOR_H) < 0.2 && p.position.x < -0.2) {
      this._wrapPending = false;
      this._announceLoop();
    }
  }

  _wrap(dy) {
    const gm = this.game;
    gm.player.position.y += dy;
    gm.camera.position.y += dy;
    gm.audio.play("loopWhoosh");
    if (dy > 0) {
      // Спуск: виток засчитывается, когда игрок выйдет на пятый.
      this._wrapPending = true;
    } else {
      gm.state.loop += 1;
      gm.state.changed();
      setTimeout(() => gm.hud.say("Выше пятого — второй. Лестница не кончается. Она замкнута."), 600);
    }
  }

  _announceLoop() {
    const gm = this.game;
    gm.state.loop += 1;
    gm.state.changed();
    const first = !gm.state.is("looped");
    gm.state.set("looped");
    gm.state.learn("loop");
    gm.audio.play("glitch");
    if (first) {
      gm.hud.sequence([
        "Пятый этаж. Четвёртый. Третий. Второй. Я считаю ступени. Считаю площадки.",
        "Я дохожу до первого этажа — и выхожу на пятый.",
        "На стене — трафарет: «5 ЭТАЖ». Краска свежая. Первый виток рекурсии.",
      ]);
    } else {
      gm.hud.say(`Снова пятый. Виток ${gm.state.loop}.`);
    }
  }

  onEnter() { this.game.state.set("been_hallway"); }
}
