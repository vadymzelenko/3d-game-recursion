// Лестничная клетка. Квартиры физически стоят за дверьми (см. apartment.js
// и neighbors.js). Переходы — через регионы, без телепорта.

import * as THREE from "three";
import { Scene } from "../scene.js";
import { makeBox, aabb, makeTextSprite } from "../utils.js";
import { Interactable } from "../interactable.js";
import { COLORS } from "../settings.js";
import { NOTE_FUSEBOX } from "../data/notes.js";

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
    this.name = "Лестничная клетка";
    this.spawn = [-1.0, SPAWN_FLOOR * FLOOR_H + 1.7, -0.2];
    this.spawnYaw = Math.PI;
  }

  build() {
    const R = this.group;
    this.game.scene.add(R);

    R.add(new THREE.AmbientLight(0x807565, 0.45));

    for (let i = FIRST_FLOOR; i <= LAST_FLOOR + 1; i++) this._buildSlab(R, i * FLOOR_H);
    for (let i = FIRST_FLOOR; i <= LAST_FLOOR; i++) {
      const y = i * FLOOR_H;
      this._buildWalls(R, y);
      this._buildDoors(R, i, y);
      this._buildLight(R, y);
      this._buildFloorNumber(R, i, y);
    }
    for (let i = FIRST_FLOOR - 1; i <= LAST_FLOOR; i++) this._buildMarch(R, i * FLOOR_H);
    this._buildInteractables(R);

    // Регион подъезда — вся площадка + лестница.
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

    for (const d of DOORS) {
      const info = plan[d.idx];
      const s = d.side;
      const toward = -s;
      const zc = s * (HZ + WALL_T / 2);
      const zIn = s * HZ;

      // Наличник
      const casingD = WALL_T + 0.04;
      for (const sx of [-1, 1]) {
        makeBox(R, 0.06, DOOR_H - 0.06, casingD,
            d.x + sx * (DOOR_W / 2 - 0.03), y + (DOOR_H - 0.06) / 2, zc, COL_CASING);
      }
      makeBox(R, DOOR_W, 0.06, casingD, d.x, y + DOOR_H - 0.03, zc, COL_CASING);

      // Табличка
      makeBox(R, 0.36, 0.3, 0.02, d.x, y + DOOR_H + 0.28, zIn + toward * 0.01, 0x2a2820);
      const tag = makeTextSprite(info.num, { fontSize: 56, color: "#c8c8b4" });
      tag.scale.setScalar(0.7);
      tag.position.set(d.x, y + DOOR_H + 0.28, zIn + toward * 0.03);
      tag.rotation.y = toward < 0 ? Math.PI : 0;
      R.add(tag);

      const sceneKey = INTERACTIVE_APARTMENTS[info.num];

      if (sceneKey) {
        // Обитаемая — проём ПУСТ, квартира стоит за ним физически.
        // Игрок просто проходит, никаких кликов и телепортов.
      } else {
        // Необитаемая — запертая створка.
        const leafW = DOOR_W - 0.12 - 0.02;
        const leafH = DOOR_H - 0.06 - 0.03;
        const leafT = 0.06;
        const door = makeBox(R, leafW, leafH, leafT, d.x, y + 0.02 + leafH / 2, zc, COLORS.DOOR);
        this.solids.push({
          min: [d.x - DOOR_W / 2, y,          zc - WALL_T / 2],
          max: [d.x + DOOR_W / 2, y + DOOR_H, zc + WALL_T / 2],
        });
        const pz = zc + toward * (leafT / 2 + 0.01);
        makeBox(R, 0.66, 0.78, 0.02, d.x, y + 1.45, pz, 0x4a2f1e);
        makeBox(R, 0.66, 0.55, 0.02, d.x, y + 0.60, pz, 0x4a2f1e);
        makeBox(R, 0.04, 0.10, 0.07, d.x + 0.36, y + 1.0,
            zc + toward * (leafT / 2 + 0.035), 0x8a8060);

        new Interactable(door, `Кв. ${info.num} (заперто)`, () => {
          gm.audio.play("click");
          gm.hud.showMessage(
              `Дверь квартиры ${info.num} заперта. За ней — тишина.`,
              3500);
        });
      }
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
    const pt = new THREE.PointLight(0xffe8b4, 0.7, 14);
    pt.position.set(-3.0, y + 2.4, 0);
    R.add(pt);
    const pt2 = new THREE.PointLight(0xffe8b4, 0.5, 10);
    pt2.position.set(-6.5, y + 2.4, 0);
    R.add(pt2);
  }

  _buildFloorNumber(R, i, y) {
    const num = (wrapIdx(i) + 2).toString();
    const x = LANDING_X0;
    makeBox(R, 0.04, 0.4, 0.5, x + 0.02, y + 2.1, 0, 0x2a2820);
    const tag = makeTextSprite(num, { fontSize: 60, color: "#d8d0a0" });
    tag.position.set(x + 0.05, y + 2.1, 0);
    tag.rotation.y = Math.PI / 2;
    R.add(tag);
  }

  _buildInteractables(R) {
    const gm = this.game;
    const y = SPAWN_FLOOR * FLOOR_H;

    const box = makeBox(R, 0.15, 0.7, 0.5,
        LANDING_X0 + 0.075, y + 1.4, 0.5, 0x3a3a38);
    this.solids.push(aabb(box));

    let fuseInserted = gm.flags.fuse_fixed === true;

    new Interactable(box,
        gm.flags.fuse_fixed ? "Щиток (свет исправен)" : "Открыть электрощит",
        () => {
          if (gm.flags.fuse_fixed) {
            gm.hud.showMessage("Щиток гудит ровно. Свет в порядке.");
            return;
          }
          if (!gm.inventory.includes("Ключ от щитовой")) {
            gm.audio.play("click");
            gm.hud.showMessage(
                "Щиток заперт на замок. Нужен ключ от щитовой —\n" +
                "спроси в квартире №40.",
                5000);
            return;
          }
          gm.audio.play("click");
          gm.hud.showMessage(NOTE_FUSEBOX, 6000);
          if (!fuseInserted) {
            fuseInserted = true;
            setTimeout(() => {
              gm.audio.play("glitch");
              gm.flags.fuse_fixed = true;
              gm.hud.showMessage(
                  "Ты вставляешь синий предохранитель, затем поднимаешь\n" +
                  "красный рубильник. Свет вспыхивает ровно.",
                  6000);
            }, 1200);
          }
        });
  }

  onUpdate() {
    const gm = this.game;
    const p = gm.player;
    const feetY = p.position.y - p.height;
    if (feetY > WRAP_TOP) this._wrap(-LOOP_H);
    else if (feetY < WRAP_BOTTOM) this._wrap(+LOOP_H);
  }

  _wrap(dy) {
    const gm = this.game;
    gm.player.position.y += dy;
    gm.camera.position.y += dy;
    gm.loopCount += 1;
    const down = dy > 0;
    const flag = down ? "loop_down_shown" : "loop_up_shown";
    const text = gm.flags[flag]
        ? `Виток ${gm.loopCount}.`
        : down
            ? "Ты спускаешься всё ниже, ступени не кончаются…\n" +
            `И выходишь не на первый, а снова на пятый. Виток ${gm.loopCount}.`
            : "Ты поднимаешься всё выше, а лестница всё не кончается…\n" +
            `И выходишь не на шестой, а снова на второй. Виток ${gm.loopCount}.`;
    gm.flags[flag] = true;
    setTimeout(() => gm.hud.showMessage(text, 6000), 1800);
  }

  onEnter() { this.game.flags.been_hallway = true; }
}