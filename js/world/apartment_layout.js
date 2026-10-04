// Общая планировка квартиры: прихожая → коридор → ванная/кухня → спальня.
// Используется и квартирой №42 (узкая прихожая), и всеми соседями.

import * as THREE from "three";
import { makeBox, aabb, makeTextSprite } from "../utils.js";
import { Interactable } from "../interactable.js";
import { COLORS } from "../settings.js";

export const WALL_H = 2.8;
export const WALL_T = 0.2;
export const FLOOR_T = 0.1;
export const DOOR_H = 2.1;
export const COL_CASING = 0x3e3328;

export const NORTH_Z = 5.6;
export const HALL_Z1 = -1.0;
export const BED_Z0  = 2.2;

export const DEFAULT_HALL_DEPTH = 2.6;
export const DEFAULT_APT_WIDTH  = 6.2;
export const DEFAULT_CORR_WIDTH = 1.6;

export function buildApartmentShell(R, solids, opts = {}) {
    const hallDepth      = opts.hallDepth      ?? DEFAULT_HALL_DEPTH;
    const apartmentWidth = opts.apartmentWidth ?? DEFAULT_APT_WIDTH;
    const corridorWidth  = opts.corridorWidth  ?? DEFAULT_CORR_WIDTH;
    const hallWidth      = opts.hallWidth      ?? apartmentWidth;
    const wallColor      = opts.wallColor      ?? COLORS.WALL;
    const ceilColor      = opts.ceilColor      ?? COLORS.CEIL;
    const floorOverrides = opts.floorOverrides ?? {};
    const sharedEast     = !!opts.sharedEast;

    const hw  = apartmentWidth / 2;
    const hhw = hallWidth / 2;
    const cw  = corridorWidth / 2;
    const entryZ = HALL_Z1 - hallDepth;

    const rooms = [
        { id: "hall",    name: "Прихожая", x0: -hhw, x1: hhw, z0: entryZ,  z1: HALL_Z1, floor: 0x3a342c },
        { id: "corr",    name: "Коридор",  x0: -cw,  x1: cw,  z0: HALL_Z1, z1: BED_Z0,  floor: COLORS.FLOOR },
        { id: "bath",    name: "Ванная",   x0: -hw,  x1: -cw, z0: HALL_Z1, z1: BED_Z0,  floor: 0x68706a },
        { id: "kitchen", name: "Кухня",    x0: cw,   x1: hw,  z0: HALL_Z1, z1: BED_Z0,  floor: 0x4a4a3e },
        { id: "bedroom", name: "Спальня",  x0: -hw,  x1: hw,  z0: BED_Z0,  z1: NORTH_Z, floor: COLORS.FLOOR },
    ];

    for (const r of rooms) {
        const w = r.x1 - r.x0, d = r.z1 - r.z0;
        const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
        const fc = floorOverrides[r.id] ?? r.floor;
        solids.push(aabb(makeBox(R, w, FLOOR_T, d, cx, -FLOOR_T / 2, cz, fc)));
        solids.push(aabb(makeBox(R, w, FLOOR_T, d, cx, WALL_H + FLOOR_T / 2, cz, ceilColor)));
    }

    const wall = (axis, fixed, a0, a1, openings = []) => {
        const ops = [...openings].sort((p, q) => p.c - q.c);
        const mk = (u0, u1, y0, y1) => {
            if (u1 - u0 <= 0.01 || y1 - y0 <= 0.01) return;
            const uc = (u0 + u1) / 2, yc = (y0 + y1) / 2;
            const m = axis === "x"
                ? makeBox(R, u1 - u0, y1 - y0, WALL_T, uc, yc, fixed, wallColor)
                : makeBox(R, WALL_T, y1 - y0, u1 - u0, fixed, yc, uc, wallColor);
            solids.push(aabb(m));
        };
        let cur = a0;
        for (const o of ops) {
            const lo = o.c - o.w / 2, hi = o.c + o.w / 2;
            const bottom = o.bottom || 0, top = o.top || DOOR_H;
            mk(cur, lo, 0, WALL_H);
            if (bottom > 0) mk(lo, hi, 0, bottom);
            mk(lo, hi, top, WALL_H);
            cur = hi;
            if (o.casing) _casing(R, axis, fixed, o.c, o.w, top);
        }
        mk(cur, a1, 0, WALL_H);
    };

    const T2   = WALL_T / 2;
    const xIn  = -hw - T2,  xOut  =  hw + T2;
    const hIn  = -hhw - T2, hOut  =  hhw + T2;
    const corrGap = Math.min(corridorWidth - 0.2, 1.4);
    const winW    = Math.min(2.4, apartmentWidth - 1.2);
    const winKitW = Math.min(1.1, apartmentWidth * 0.28);

    wall("x", entryZ,  hIn, hOut, [{ c: 0, w: 1.1 }]);
    wall("x", HALL_Z1, xIn, xOut, [{ c: 0, w: corrGap, casing: true }]);
    wall("x", BED_Z0,  xIn, xOut, [{ c: 0, w: 1.1, casing: true }]);
    wall("x", NORTH_Z, xIn, xOut, [{ c: 0.3, w: winW, bottom: 1.0, top: 2.6 }]);

    const zA = entryZ + T2, zB = HALL_Z1 - T2;
    wall("z", -hhw, zA, zB);
    wall("z",  hhw, zA, zB);

    const zS = HALL_Z1 + T2;
    const zE = BED_Z0 - T2;
    const zN = NORTH_Z - T2;
    wall("z", -cw, zS, zE, [{ c: 0.4, w: Math.min(0.9, corridorWidth - 0.1), casing: true }]);
    wall("z",  cw, zS, zE, [{ c: 0.5, w: Math.min(1.0, corridorWidth - 0.1), casing: true }]);
    wall("z", -hw, zS, zE);
    wall("z", -hw, BED_Z0 + T2, zN);
    if (!sharedEast) {
        wall("z", hw, zS, zE, [{ c: 0.9, w: winKitW, bottom: 1.0, top: 2.4 }]);
        wall("z", hw, BED_Z0 + T2, zN);
    }

    const windows = [
        { x: 0.3, z: NORTH_Z, rotY: 0, w: winW, h: 1.6, sillY: 1.0 },
    ];
    if (!sharedEast) windows.push({ x: hw, z: 0.9, rotY: Math.PI / 2, w: winKitW, h: 1.4, sillY: 1.0 });

    const region = {
        x0: -hw,          x1:  hw,
        z0: entryZ - 0.2, z1: zN,
        y0: 0,            y1: WALL_H,
    };

    solids.shellEnd = solids.length;
    return { rooms, entryZ, region, windows, dims: { hw, hhw, cw, entryZ } };
}

function _casing(R, axis, fixed, c, w, top) {
    const D = WALL_T + 0.04, jh = top - 0.06;
    for (const s of [-1, 1]) {
        const u = c + s * (w / 2 - 0.03);
        if (axis === "x") makeBox(R, 0.06, jh, D, u, jh / 2, fixed, COL_CASING);
        else              makeBox(R, D, jh, 0.06, fixed, jh / 2, u, COL_CASING);
    }
    if (axis === "x") makeBox(R, w, 0.06, D, c, top - 0.03, fixed, COL_CASING);
    else              makeBox(R, D, 0.06, w, fixed, top - 0.03, c, COL_CASING);
}

export function buildWindowFrame(R, { x, z, rotY, w, h, sillY }) {
    const G = new THREE.Group();
    G.position.set(x, 0, z);
    G.rotation.y = rotY;
    R.add(G);
    const cy = sillY + h / 2;
    const fT = 0.07, fD = 0.06, fC = 0x4a3a2a;
    makeBox(G, w, fT, fD, 0, sillY + fT / 2, -0.03, fC);
    makeBox(G, w, fT, fD, 0, sillY + h - fT / 2, -0.03, fC);
    makeBox(G, fT, h - 2 * fT, fD, -w / 2 + fT / 2, cy, -0.03, fC);
    makeBox(G, fT, h - 2 * fT, fD,  w / 2 - fT / 2, cy, -0.03, fC);
    makeBox(G, fT * 0.6, h - 2 * fT, fD * 0.7, 0, cy, -0.03, fC);
    makeBox(G, w - 2 * fT, fT * 0.6, fD * 0.7, 0, cy, -0.03, fC);
    makeBox(G, w + 0.4, 0.04, 0.32, 0, sillY + 0.02, -0.16, 0x6a5a48);
    return G;
}

export function buildEntryCasing(R, { entryZ, doorW = 1.1, doorH = DOOR_H }) {
    const D = WALL_T + 0.04, jh = doorH - 0.06;
    const z = entryZ + WALL_T / 2 + 0.01;
    for (const sx of [-1, 1]) {
        makeBox(R, 0.06, jh, D, sx * (doorW / 2 - 0.03), jh / 2, z, COL_CASING);
    }
    makeBox(R, doorW, 0.06, D, 0, doorH - 0.03, z, COL_CASING);
}

const DOOR_MAX_ANGLE = Math.PI * 0.55;
const DOOR_DURATION  = 0.5;

export class EntryDoor {
    constructor(scene, R, { entryZ, doorW = 1.1, doorH = DOOR_H, label = "", onFirstOpen = null }) {
        this.scene = scene;
        this.game = scene.game;
        this.entryZ = entryZ;
        this.doorW = doorW;
        this.onFirstOpen = onFirstOpen;
        this.target = 0;
        this.angle = 0;
        this._opened = false;

        const hx = -doorW / 2;
        const pivot = new THREE.Group();
        pivot.position.set(hx, 0, entryZ);
        R.add(pivot);
        this.pivot = pivot;

        const leafW = doorW - 0.06, leafH = doorH - 0.05, leafT = 0.08, y0 = 0.02;
        const parts = [];
        parts.push(makeBox(pivot, leafW, leafH, leafT, leafW / 2, y0 + leafH / 2, 0, COLORS.DOOR));
        for (const s of [-1, 1]) {
            parts.push(makeBox(pivot, leafW * 0.66, leafH * 0.30, 0.02, leafW / 2, y0 + 1.42, s * 0.045, 0x4a2f1e));
            parts.push(makeBox(pivot, leafW * 0.66, leafH * 0.20, 0.02, leafW / 2, y0 + 0.58, s * 0.045, 0x4a2f1e));
            parts.push(makeBox(pivot, 0.05, 0.10, 0.06, leafW - 0.08, y0 + 1.03, s * 0.07, 0x8a8060));
        }
        parts.push(makeBox(pivot, 0.03, 0.03, 0.1, leafW / 2, y0 + 1.60, 0, 0x202020));
        if (label) {
            const tag = makeTextSprite(label, { fontSize: 48, color: "#c8c8b4" });
            tag.scale.setScalar(0.45);
            tag.position.set(leafW / 2, y0 + 1.82, -0.07);
            tag.rotation.y = Math.PI;
            pivot.add(tag);
        }

        // ─── ПОРОГ-МОСТ ─────────────────────────────────────────────
        // Пол квартиры заканчивается на entryZ, пол подъезда — на HZ.
        // Между ними щель ~0.3 м. Кладём тонкую плиту ровно под проёмом,
        // чтобы игрок мог перейти без провала.

        // Порог: чуть приподнят (y_top=0.008) и другого цвета — иначе он
// z-fighting'ил с полом квартиры/подъезда и давал «глитч-текстуры».
        const threshold = makeBox(R, doorW + 0.9, FLOOR_T, 0.7, 0, -FLOOR_T / 2 + 0.008, entryZ, 0x3a3028);
        threshold.userData.noPick = true;
        scene.solids.push(aabb(threshold));

        this.solid = {
            min: [hx, 0, entryZ - WALL_T / 2],
            max: [hx + doorW, doorH, entryZ + WALL_T / 2],
            off: false,
        };
        scene.solids.push(this.solid);

        this.interactable = new Interactable(parts, "Открыть входную дверь", () => this.toggle());
        scene.doors.push(this);
    }

    get isOpen() { return this.target === 1; }

    _playerInDoorway() {
        const l = this.scene.toLocal(this.game.player.position);
        return Math.abs(l.x) < this.doorW / 2 + 0.45 && Math.abs(l.z - this.entryZ) < WALL_T / 2 + 0.45;
    }

    toggle() {
        const gm = this.game;
        if (this.target === 1) {
            if (this._playerInDoorway()) {
                gm.hud.showMessage("Что-то мешает закрыть дверь — ты стоишь в проёме.", 2500);
                return;
            }
            this.target = 0;
            gm.audio.play("door");
            this.interactable.prompt = "Открыть входную дверь";
            return;
        }
        this.target = 1;
        this.solid.off = true;
        gm.audio.play("door");
        this.interactable.prompt = "Закрыть входную дверь";
        if (!this._opened) {
            this._opened = true;
            if (this.onFirstOpen) this.onFirstOpen();
        }
    }

    update(dt) {
        const goal = this.target ? DOOR_MAX_ANGLE : 0;
        const diff = goal - this.angle;
        if (Math.abs(diff) < 1e-5) return;
        const step = (dt / DOOR_DURATION) * DOOR_MAX_ANGLE;
        this.angle += Math.sign(diff) * Math.min(Math.abs(diff), step);
        this.pivot.rotation.y = -this.angle;
        if (this.target === 0 && this.angle <= 1e-5) {
            this.angle = 0;
            this.pivot.rotation.y = 0;
            if (this._playerInDoorway()) {
                this.target = 1;
                this.interactable.prompt = "Закрыть входную дверь";
            } else {
                this.solid.off = false;
            }
        }
    }

    reset() {
        this.target = 0;
        this.angle = 0;
        this.pivot.rotation.y = 0;
        this.solid.off = false;
        this.interactable.prompt = "Открыть входную дверь";
    }
}