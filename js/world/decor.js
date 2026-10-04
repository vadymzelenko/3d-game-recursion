// Декор и типовая меблировка.

import * as THREE from "three";
import { makeBox, makeHitbox, solidBox, glow, makeTextSprite } from "../utils.js";
import { Interactable } from "../interactable.js";
import { COLORS } from "../settings.js";

export const FACE = { n: 0, s: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };
const DIR = { n: [0, 1], s: [0, -1], e: [1, 0], w: [-1, 0] };

function wallGroup(R, x, y, z, face) {
    const G = new THREE.Group();
    G.position.set(x, y, z);
    G.rotation.y = FACE[face];
    R.add(G);
    return G;
}

function flat(parent, w, h, x, y, z, mat) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
}

// ----------------------------------------------------------------
// Процедурные «картины».
// ----------------------------------------------------------------
const _artCache = new Map();
const ART_W = 96, ART_H = 128;

function drawArt(ctx, kind) {
    const W = ART_W, H = ART_H;
    const rect = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    const circ = (c, x, y, r) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
    switch (kind) {
        case "landscape":
            rect("#8a8c80", 0, 0, W, H * 0.55);
            circ("#d8c890", W * 0.7, H * 0.28, 11);
            rect("#4a5a3a", 0, H * 0.55, W, H * 0.45);
            ctx.fillStyle = "#3a4a2e";
            ctx.beginPath(); ctx.moveTo(0, H * 0.6); ctx.lineTo(W * 0.35, H * 0.42); ctx.lineTo(W * 0.7, H * 0.6); ctx.fill();
            rect("#5a4a3a", W * 0.2, H * 0.78, W * 0.6, 4);
            break;
        case "forest":
            rect("#7a7a6a", 0, 0, W, H);
            for (let i = 0; i < 9; i++) {
                rect(i % 2 ? "#cfcdc0" : "#e0ddd0", 6 + i * 10, 0, 5, H);
                for (let j = 0; j < 5; j++) rect("#2a2a24", 6 + i * 10, 14 + j * 24 + (i * 7) % 11, 5, 3);
            }
            rect("#5a6a3a", 0, H * 0.82, W, H * 0.18);
            break;
        case "portrait":
            rect("#5a4636", 0, 0, W, H);
            circ("#a88a6a", W / 2, H * 0.38, 20);
            ctx.fillStyle = "#2a2622";
            ctx.beginPath(); ctx.ellipse(W / 2, H * 0.95, 34, 36, 0, Math.PI, 0); ctx.fill();
            rect("#2a2622", W / 2 - 22, H * 0.28, 44, 9);
            rect("#d8d0c0", W / 2 - 6, H * 0.62, 12, 14);
            break;
        case "stilllife":
            rect("#6a5a46", 0, 0, W, H);
            rect("#4a3a2a", 0, H * 0.62, W, H * 0.38);
            circ("#a43a2a", W * 0.38, H * 0.56, 9);
            circ("#c8a43a", W * 0.58, H * 0.58, 8);
            rect("#3a4a5a", W * 0.2, H * 0.62, W * 0.6, 7);
            rect("#7a8a6a", W * 0.72, H * 0.28, 6, H * 0.34);
            circ("#8a2a2a", W * 0.75, H * 0.26, 8);
            break;
        case "abstract":
            rect("#d8d0b8", 0, 0, W, H);
            circ("#a82a22", W * 0.4, H * 0.38, 22);
            rect("#1e1e1e", W * 0.1, H * 0.7, W * 0.8, 6);
            rect("#1e1e1e", W * 0.62, H * 0.1, 6, H * 0.6);
            ctx.fillStyle = "#2a3a5a";
            ctx.beginPath(); ctx.moveTo(W * 0.1, H * 0.1); ctx.lineTo(W * 0.5, H * 0.1); ctx.lineTo(W * 0.1, H * 0.35); ctx.fill();
            break;
        case "poster":
            rect("#a82a22", 0, 0, W, H);
            rect("#e0c060", 0, H * 0.62, W, H * 0.38);
            circ("#e0c060", W / 2, H * 0.3, 18);
            ctx.fillStyle = "#1e1e1e";
            ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center";
            ctx.fillText("СЛАВА", W / 2, H * 0.78);
            ctx.fillText("ТРУДУ", W / 2, H * 0.9);
            break;
        case "stars":
            rect("#0a1020", 0, 0, W, H);
            for (let i = 0; i < 70; i++) rect("#dcdcb4", (i * 37) % W, (i * 53) % H, 1, 1);
            circ("#dcdcb4", W * 0.7, H * 0.25, 7);
            circ("#0a1020", W * 0.74, H * 0.23, 6);
            break;
        case "propaganda":
            rect("#c8b060", 0, 0, W, H);
            rect("#a82a22", 0, 0, W, H * 0.28);
            ctx.fillStyle = "#f0e8d0";
            ctx.font = "bold 18px sans-serif"; ctx.textAlign = "center";
            ctx.fillText("СССР", W / 2, H * 0.20);
            ctx.fillStyle = "#2a2018";
            ctx.font = "bold 11px sans-serif";
            ctx.fillText("ВПЕРЁД К", W / 2, H * 0.52);
            ctx.fillText("ПОБЕДЕ", W / 2, H * 0.62);
            ctx.fillText("КОММУНИЗМА", W / 2, H * 0.78);
            circ("#a82a22", W / 2, H * 0.88, 10);
            break;
        case "cityscape":
            rect("#3a3a44", 0, 0, W, H);
            rect("#1e1e26", 0, H * 0.7, W, H * 0.3);
            rect("#2a2a34", W*0.1, H*0.35, 12, H*0.5);
            rect("#2a2a34", W*0.3, H*0.25, 14, H*0.6);
            rect("#2a2a34", W*0.55, H*0.4, 10, H*0.45);
            rect("#2a2a34", W*0.75, H*0.3, 16, H*0.55);
            for (let i = 0; i < 20; i++) rect("#c8aa68", (i*17)%W, 40+(i*13)%80, 2, 2);
            break;
        default:
            rect("#6a6a60", 0, 0, W, H);
    }
}

function artMaterial(kind) {
    if (_artCache.has(kind)) return _artCache.get(kind);
    const cv = document.createElement("canvas");
    cv.width = ART_W; cv.height = ART_H;
    drawArt(cv.getContext("2d"), kind);
    const tex = new THREE.CanvasTexture(cv);
    const mat = new THREE.MeshLambertMaterial({
        map: tex, emissive: new THREE.Color(0xffffff), emissiveMap: tex, emissiveIntensity: 0.28,
    });
    _artCache.set(kind, mat);
    return mat;
}

export function frame(R, x, y, z, face, w, h, art = "landscape", onLook = null) {
    const G = wallGroup(R, x, y, z, face);
    const parts = [];
    parts.push(makeBox(G, w, h, 0.03, 0, 0, 0.015, 0x3a2a1c));
    parts.push(flat(G, w - 0.1, h - 0.1, 0, 0, 0.032, artMaterial(art)));
    if (onLook) new Interactable(parts, "Рассмотреть", onLook);
    return G;
}

export function wallClock(R, x, y, z, face, { r = 0.17, time = "04:12" } = {}) {
    const G = wallGroup(R, x, y, z, face);
    makeBox(G, r * 2, r * 2, 0.04, 0, 0, 0.02, 0x2a2622);
    makeBox(G, r * 1.7, r * 1.7, 0.02, 0, 0, 0.045, 0xd0c8b0);
    makeBox(G, 0.014, r * 0.7, 0.012, 0, r * 0.3, 0.06, 0x1a1a1a);
    const h2 = makeBox(G, 0.014, r * 0.5, 0.012, -r * 0.2, -r * 0.05, 0.062, 0x1a1a1a);
    h2.rotation.z = -1.1;
    return G;
}

export function calendar(R, x, y, z, face) {
    const G = wallGroup(R, x, y, z, face);
    makeBox(G, 0.26, 0.38, 0.01, 0, 0, 0.005, 0xd8d0b8);
    makeBox(G, 0.26, 0.1, 0.012, 0, 0.14, 0.006, 0xa82a22);
    const t = makeTextSprite("1988", { fontSize: 36, color: "#f0e8d0" });
    t.scale.setScalar(0.3);
    t.position.set(0, 0.14, 0.014);
    G.add(t);
    return G;
}

export function curtains(R, x, z, face, { w, top = 2.45, bottom = 0.5, color = 0x6a4a3a, sides = [-1, 1] } = {}) {
    const G = wallGroup(R, x, 0, z, face);
    const h = top - bottom, pw = 0.32;
    for (const s of sides) {
        makeBox(G, pw, h, 0.07, s * (w / 2 + pw / 2 + 0.08), bottom + h / 2, 0.06, color);
        makeBox(G, pw * 0.4, h, 0.075, s * (w / 2 + pw / 2 + 0.08) - s * 0.07, bottom + h / 2, 0.062, 0x50382c);
    }
    makeBox(G, w + 2 * pw + 0.3, 0.03, 0.03, 0, top + 0.04, 0.06, 0x2a2018);
    return G;
}

export function radiator(R, x, z, face, w = 1.0) {
    const G = wallGroup(R, x, 0, z, face);
    const y0 = 0.15, h = 0.5;
    makeBox(G, w, 0.04, 0.1, 0, y0 + h, 0.06, 0x8a8a82);
    makeBox(G, w, 0.04, 0.1, 0, y0, 0.06, 0x8a8a82);
    const n = Math.max(4, Math.round(w / 0.1));
    for (let i = 0; i < n; i++)
        makeBox(G, 0.05, h, 0.09, -w / 2 + 0.05 + i * ((w - 0.1) / (n - 1)), y0 + h / 2, 0.06, 0xb4b4aa);
    return G;
}

export function wallShelf(R, x, y, z, face, w, items = []) {
    const G = wallGroup(R, x, y, z, face);
    makeBox(G, w, 0.03, 0.2, 0, 0, 0.1, 0x5a4535);
    makeBox(G, 0.03, 0.1, 0.05, -w / 2 + 0.06, -0.06, 0.03, 0x3a2a1c);
    makeBox(G, 0.03, 0.1, 0.05,  w / 2 - 0.06, -0.06, 0.03, 0x3a2a1c);
    let cx = -w / 2 + 0.1;
    for (const it of items) {
        const iw = it.w ?? 0.08, ih = it.h ?? 0.14;
        if (cx + iw > w / 2 - 0.04) break;
        makeBox(G, iw, ih, it.d ?? 0.1, cx + iw / 2, 0.015 + ih / 2, 0.1, it.c ?? 0x8a7a5a);
        cx += iw + 0.02;
    }
    return G;
}

export function wallLamp(R, x, y, z, face) {
    const G = wallGroup(R, x, y, z, face);
    makeBox(G, 0.08, 0.14, 0.04, 0, 0, 0.02, 0x2a2622);
    glow(makeBox(G, 0.14, 0.2, 0.1, 0, 0.04, 0.09, 0xe8d8a8), 0xf0dca0, 0.9);
    return G;
}

// ----------------------------------------------------------------
// Напольные предметы
// ----------------------------------------------------------------
export function rug(R, x, z, w, d, color = 0x5a3a2a, border = 0x3a2418) {
    const a = makeBox(R, w, 0.012, d, x, 0.006, z, border);
    const b = makeBox(R, w - 0.14, 0.014, d - 0.14, x, 0.007, z, color);
    a.userData.noPick = true; b.userData.noPick = true;
    return [a, b];
}

export function vase(R, x, y, z, { color = 0x4a6a7a, flowers = true } = {}) {
    makeBox(R, 0.1, 0.2, 0.1, x, y + 0.1, z, color);
    makeBox(R, 0.06, 0.04, 0.06, x, y + 0.22, z, color);
    if (flowers) {
        const cols = [0xc8a43a, 0xa43a2a, 0xd8d0b8];
        for (let i = 0; i < 3; i++) {
            const st = makeBox(R, 0.01, 0.22, 0.01, x + (i - 1) * 0.025, y + 0.34, z, 0x3a5a2a);
            st.rotation.z = (i - 1) * 0.25;
            makeBox(R, 0.045, 0.045, 0.045, x + (i - 1) * 0.05, y + 0.46, z, cols[i]);
        }
    }
}

const LEAF = [0x3f5f36, 0x4d6e3e, 0x35522f];
export function plantPot(R, solids, x, z, { y = 0, s = 1, solid = true } = {}) {
    const pw = 0.26 * s, ph = 0.26 * s;
    makeBox(R, pw, ph, pw, x, y + ph / 2, z, 0x8a4a32);
    makeBox(R, pw + 0.03, 0.04 * s, pw + 0.03, x, y + ph, z, 0x7a3e2a);
    makeBox(R, pw - 0.04, 0.02, pw - 0.04, x, y + ph + 0.025 * s, z, 0x2a2018);
    makeBox(R, 0.02 * s, 0.3 * s, 0.02 * s, x, y + ph + 0.17 * s, z, 0x3a5230);
    for (let i = 0; i < 7; i++) {
        const a = i * 0.9;
        const lf = makeBox(R, 0.22 * s, 0.03 * s, 0.1 * s,
            x + Math.cos(a) * 0.09 * s, y + ph + (0.22 + (i % 3) * 0.08) * s, z + Math.sin(a) * 0.09 * s,
            LEAF[i % 3], { rotY: -a });
        lf.rotation.z = 0.45;
    }
    if (solid && y === 0) solids.push({ min: [x - pw / 2, 0, z - pw / 2], max: [x + pw / 2, ph, z + pw / 2] });
}

export function floorLamp(R, solids, x, z) {
    makeBox(R, 0.26, 0.04, 0.26, x, 0.02, z, 0x2a2622);
    makeBox(R, 0.03, 1.4, 0.03, x, 0.74, z, 0x2a2622);
    glow(makeBox(R, 0.32, 0.26, 0.32, x, 1.55, z, 0xd8c890), 0xf0dca0, 0.85);
    solids.push({ min: [x - 0.13, 0, z - 0.13], max: [x + 0.13, 1.7, z + 0.13] });
}

export function sofa(R, solids, x, z, w, d, back, color = 0x6a4a3a) {
    makeBox(R, w, 0.38, d, x, 0.19, z, 0x3a2a22);
    const [bx, bz] = DIR[back];
    const alongX = bz !== 0;
    makeBox(R, alongX ? w - 0.2 : w - 0.22, 0.12, alongX ? d - 0.24 : d - 0.2,
        x - bx * 0.0, 0.44, z - bz * 0.0, color);
    if (alongX) {
        makeBox(R, w, 0.5, 0.2, x, 0.63, z + bz * (d / 2 - 0.1), color);
        for (const s of [-1, 1]) makeBox(R, 0.18, 0.28, d - 0.2, x + s * (w / 2 - 0.09), 0.52, z - bz * 0.1, color);
    } else {
        makeBox(R, 0.2, 0.5, d, x + bx * (w / 2 - 0.1), 0.63, z, color);
        for (const s of [-1, 1]) makeBox(R, w - 0.2, 0.28, 0.18, x - bx * 0.1, 0.52, z + s * (d / 2 - 0.09), color);
    }
    solids.push({ min: [x - w / 2, 0, z - d / 2], max: [x + w / 2, 0.85, z + d / 2] });
}

export function armchair(R, solids, x, z, back, color = 0x5a4a3a) {
    sofa(R, solids, x, z, 0.8, 0.8, back, color);
}

export function table(R, solids, x, z, w, d, h = 0.72, color = 0x6a5238) {
    makeBox(R, w, 0.05, d, x, h - 0.025, z, color);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
        makeBox(R, 0.05, h - 0.05, 0.05, x + sx * (w / 2 - 0.05), (h - 0.05) / 2, z + sz * (d / 2 - 0.05), 0x3a2a1c);
    solids.push({ min: [x - w / 2, 0, z - d / 2], max: [x + w / 2, h, z + d / 2] });
}

export function chair(R, solids, x, z, back = "s", color = 0x5a4530) {
    makeBox(R, 0.4, 0.04, 0.4, x, 0.45, z, color);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
        makeBox(R, 0.04, 0.43, 0.04, x + sx * 0.17, 0.215, z + sz * 0.17, 0x3a2a1c);
    const [bx, bz] = DIR[back];
    if (bz !== 0) makeBox(R, 0.4, 0.45, 0.04, x, 0.7, z + bz * 0.18, color);
    else          makeBox(R, 0.04, 0.45, 0.4, x + bx * 0.18, 0.7, z, color);
    solids.push({ min: [x - 0.2, 0, z - 0.2], max: [x + 0.2, 0.95, z + 0.2] });
}

// Книжная полка. Переписана: теперь внутри есть НАСТОЯЩИЕ горизонтальные
// полки, книги стоят НА них, и в 3 раза меньше мешей (было ~120 на полку).
export function bookshelf(R, solids, x, z, w, d, h, back, { books = true } = {}) {
    // Для back="n"/"s" стенка — по Z, полка тянется по X (alongLen = w).
    // Для back="e"/"w" стенка — по X, полка тянется по Z (alongLen = d),
    //   а "w" в этом вызове фактически глубина (глубина=X, длина=Z).
    const [bx, bz] = DIR[back];
    const alongX  = bz !== 0;
    const alongLen = alongX ? w : d;
    const depthLen = alongX ? d : w;

    const parts = [];
    const backTh = 0.05;
    const sideTh = 0.05;

    // Задняя стенка (у самой стены)
    const backOffset = depthLen / 2 - backTh / 2;
    parts.push(alongX
        ? makeBox(R, alongLen, h, backTh, x, h / 2, z + bz * backOffset, 0x4a3a2a)
        : makeBox(R, backTh, h, alongLen, x + bx * backOffset, h / 2, z, 0x4a3a2a));

    // Боковины
    if (alongX) {
        parts.push(makeBox(R, sideTh, h, depthLen, x - alongLen / 2 + sideTh / 2, h / 2, z, 0x4a3a2a));
        parts.push(makeBox(R, sideTh, h, depthLen, x + alongLen / 2 - sideTh / 2, h / 2, z, 0x4a3a2a));
    } else {
        parts.push(makeBox(R, depthLen, h, sideTh, x, h / 2, z - alongLen / 2 + sideTh / 2, 0x4a3a2a));
        parts.push(makeBox(R, depthLen, h, sideTh, x, h / 2, z + alongLen / 2 - sideTh / 2, 0x4a3a2a));
    }

    // Горизонтальные полки — их не было, поэтому книги "висели в воздухе"
    const shelfCount = 3;
    const shelfSpacing = (h - 0.05) / shelfCount;
    const planeAlong = alongLen - 0.1;
    const planeDeep  = depthLen - 0.05;

    for (let r = 0; r <= shelfCount; r++) {
        const y = 0.02 + r * shelfSpacing;
        parts.push(alongX
            ? makeBox(R, planeAlong, 0.03, planeDeep, x, y, z, 0x3a2a1c)
            : makeBox(R, planeDeep, 0.03, planeAlong, x, y, z, 0x3a2a1c));
    }

    // Книги на полках
    if (books) {
        const cols = [0x8a2a2a, 0x2a4a2a, 0x3a3a5a, 0x7a6a3a, 0x5a3a2a, 0x4a2a4a];
        const bookSpacing = 0.14;
        const n = Math.floor(planeAlong / bookSpacing);
        const bookD = Math.min(0.16, planeDeep * 0.7);
        const bookW = 0.08;

        for (let r = 0; r < shelfCount; r++) {
            const baseY = 0.02 + r * shelfSpacing + 0.015;
            const bookH = shelfSpacing - 0.06;
            for (let i = 0; i < n; i++) {
                // пропуски, чтобы не было монолитного ряда
                if ((i * 5 + r * 3) % 7 === 0) continue;
                const u = -planeAlong / 2 + bookSpacing / 2 + i * bookSpacing;
                const c = cols[(i + r * 2) % cols.length];
                // книги ставим ближе к переднему краю (напротив задней стенки)
                const frontOffset = depthLen / 2 - bookD / 2 - 0.02;
                parts.push(alongX
                    ? makeBox(R, bookW, bookH, bookD, x + u, baseY + bookH / 2, z - bz * frontOffset, c)
                    : makeBox(R, bookD, bookH, bookW, x - bx * frontOffset, baseY + bookH / 2, z + u, c));
            }
        }
    }

    solids.push({ min: [x - w / 2, 0, z - d / 2], max: [x + w / 2, h, z + d / 2] });
    return parts;
}

export function tvSet(R, solids, x, z, face) {
    const [fx, fz] = DIR[face];
    const alongX = fz !== 0;
    makeBox(R, alongX ? 0.9 : 0.5, 0.5, alongX ? 0.5 : 0.9, x, 0.25, z, 0x4a3a2a);
    solids.push({ min: [x - (alongX ? 0.45 : 0.25), 0, z - (alongX ? 0.25 : 0.45)],
        max: [x + (alongX ? 0.45 : 0.25), 0.5, z + (alongX ? 0.25 : 0.45)] });
    const body = makeBox(R, alongX ? 0.6 : 0.45, 0.45, alongX ? 0.45 : 0.6, x, 0.725, z, COLORS.TV);
    const sx = x + fx * 0.23, sz = z + fz * 0.23;
    const scr = alongX ? makeBox(R, 0.46, 0.34, 0.02, sx, 0.73, z + fz * 0.225, 0x4a5a56)
        : makeBox(R, 0.02, 0.34, 0.46, x + fx * 0.225, 0.73, sz, 0x4a5a56);
    glow(scr, 0x3a4a46, 0.35);
    return [body, scr];
}

// ----------------------------------------------------------------
// Вид «за окном» для соседей
// ----------------------------------------------------------------
// Вид «за окном»: настоящие 3D-дома с окнами вместо плоской картинки.
let _foggyMat = null;
function foggyMat() {
    if (_foggyMat) return _foggyMat;
    const cv = document.createElement("canvas");
    cv.width = 128; cv.height = 64;
    const c = cv.getContext("2d");
    c.fillStyle = "#2a2832"; c.fillRect(0, 0, 128, 64);
    const tex = new THREE.CanvasTexture(cv);
    _foggyMat = new THREE.MeshBasicMaterial({ map: tex, fog: false });
    return _foggyMat;
}

export function outsideView(R, { x, z, rotY, w, h, sillY }) {
    const G = new THREE.Group();
    G.position.set(x, 0, z);
    G.rotation.y = rotY;
    R.add(G);

    // Дальний «туман» — плоскость позади домов
    const fogPlane = flat(G, w + 8, h + 8, 0, sillY + h / 2, 22, foggyMat());
    fogPlane.rotation.y = Math.PI;

    // 3D-дома. Z-координата — насколько глубоко за окном.
    const buildingColors = [0x2a2830, 0x33303a, 0x28252e];
    const winColors = [0xc8a860, 0xd8b870, 0xb89850];

    const buildings = [
        { x: -3.5, z: 6,  w: 3.0, h: 5.5, d: 3.0 },
        { x:  1.5, z: 8,  w: 3.5, h: 7.0, d: 3.5 },
        { x:  5.0, z: 7,  w: 3.0, h: 5.0, d: 3.0 },
        { x: -6.0, z: 10, w: 4.0, h: 8.0, d: 4.0 },
        { x:  4.0, z: 12, w: 4.5, h: 9.0, d: 4.5 },
    ];

    for (const b of buildings) {
        const color = buildingColors[(Math.random() * buildingColors.length) | 0];
        makeBox(G, b.w, b.h, b.d, b.x, b.h / 2, b.z, color);

        // Светящиеся окна на «лицевой» стороне (-z)
        const cols = Math.max(1, Math.floor(b.w / 0.9));
        const rows = Math.max(1, Math.floor(b.h / 1.1));
        for (let ry = 0; ry < rows; ry++) {
            for (let cx2 = 0; cx2 < cols; cx2++) {
                if (Math.random() > 0.4) continue;   // часть окон тёмная
                const wx = b.x - b.w / 2 + 0.55 + cx2 * 0.9;
                const wy = 0.9 + ry * 1.1;
                if (wx > b.x + b.w / 2 - 0.25) continue;
                const wc = winColors[(Math.random() * winColors.length) | 0];
                const wm = makeBox(G, 0.34, 0.48, 0.02, wx, wy, b.z - b.d / 2 - 0.005, wc);
                glow(wm, wc, 0.85);
            }
        }
    }

    return G;
}
// ----------------------------------------------------------------
// Новые декоративные хелперы
// ----------------------------------------------------------------

// Стена из 2–3 картин. u — смещение вдоль стены.
export function pictureWall(R, x, y, z, face, items) {
    for (const it of items) {
        const ux = (face === 'n' || face === 's') ? (it.u || 0) : 0;
        const uz = (face === 'e' || face === 'w') ? (it.u || 0) : 0;
        frame(R, x + ux, y + (it.y || 0), z + uz, face,
            it.w || 0.4, it.h || 0.5, it.art || 'landscape');
    }
}

// Уголок с 2–3 растениями.
export function plantCorner(R, solids, x, z, { s = 1, spread = 0.3 } = {}) {
    plantPot(R, solids, x, z, { s: s * 1.0, solid: true });
    plantPot(R, solids, x + spread, z - spread * 0.5, { s: s * 0.75, solid: false });
    plantPot(R, solids, x - spread * 0.4, z + spread, { s: s * 0.6, solid: false });
}

// Полка с хламом: книги, банки, чашки.
// Полка с хламом: книги, банки, чашки. Навесная.
export function clutterShelf(R, x, y, z, face, w = 0.9) {
    const items = [
        { c: 0x8a5a3a, h: 0.16, w: 0.07 },
        { c: 0x3a5a7a, h: 0.14, w: 0.07 },
        { c: 0x6a4a3a, h: 0.13, w: 0.07 },
        { c: 0xb4a888, h: 0.12, w: 0.08 },
        { c: 0x8a6a4a, h: 0.10, w: 0.08 },
        { c: 0xa43a2a, h: 0.16, w: 0.07 },
    ];
    return wallShelf(R, x, y, z, face, w, items);
}

// ================================================================
// Типовые помещения
// ================================================================

// ПРИХОЖАЯ
export function furnishHall(R, solids, { hhw, entryZ, onMirror = null }) {
    const xw = -(hhw - 0.1), xe = hhw - 0.1;
    const z0 = entryZ + 0.1;

    makeBox(R, 0.04, 0.12, 1.0, xw + 0.02, 1.75, entryZ + 1.1, 0x3a3025);
    makeBox(R, 0.14, 0.95, 0.32, xw + 0.1, 1.2, entryZ + 0.85, 0x2c2a30);
    makeBox(R, 0.14, 0.85, 0.30, xw + 0.1, 1.25, entryZ + 1.35, 0x4a3a2c);

    solidBox(R, solids, 0.22, 0.5, 0.22, xw + 0.2, 0.25, entryZ + 0.35, 0x3a3a36);
    makeBox(R, 0.03, 0.3, 0.03, xw + 0.17, 0.62, entryZ + 0.35, 0x1e1e1e);
    makeBox(R, 0.12, 0.03, 0.03, xw + 0.2, 0.78, entryZ + 0.35, 0x1e1e1e);

    const shoes = solidBox(R, solids, 0.3, 0.4, 0.9, xe - 0.15, 0.2, entryZ + 1.4, 0x4a3c30);
    for (let i = 0; i < 3; i++) makeBox(R, 0.12, 0.08, 0.24, xe - 0.15, 0.44, entryZ + 1.1 + i * 0.3, 0x1e1a18);

    const mir = makeBox(R, 0.03, 0.9, 0.5, xe - 0.015, 1.5, entryZ + 1.4, 0x8a9a9a);
    const mframe = makeBox(R, 0.025, 0.98, 0.58, xe - 0.0125, 1.5, entryZ + 1.4, 0x3a2a1c);
    glow(mir, 0x202828, 1);
    if (onMirror) new Interactable([mir, mframe], "Посмотреть в зеркало", onMirror);

    solidBox(R, solids, 0.5, 0.45, 0.6, xe - 0.25, 0.225, entryZ + 0.5, 0x5a4530);
    makeBox(R, 0.5, 0.05, 0.6, xe - 0.25, 0.47, entryZ + 0.5, 0x6a5538);

    rug(R, 0, entryZ + 1.4, 1.1, 1.9, 0x4a3a30, 0x2e2420);

    // Часы — над дверью справа, привязаны к xe, а не к «-1.15» из 42-й.
    wallClock(R, Math.min(1.1, xe - 0.4), 1.95, z0, "n");

    // Две картины по бокам от входа — на стене прихожая↔коридор (z=-1.1).
    // u отсчитывается от 0 (центр стены по x), так что ставим картинки
    // в узких местах слева и справа от проёма в коридор.
    const leftU  = xw + 0.55;
    const rightU = xe - 0.55;
    pictureWall(R, 0, 1.55, -1.1, "s", [
        { u: leftU,  w: 0.32, h: 0.42, art: "forest" },
        { u: rightU, w: 0.28, h: 0.36, art: "portrait" },
    ]);

    // Небольшая полка у входа (у западной стены)
    clutterShelf(R, xw - 0.02, 1.55, entryZ + 2, "e", 0.55);

    if (hhw > 2) plantCorner(R, solids, xe - 0.35, entryZ + 0.45, { s: 1.0 });

    return { shoes };
}

// КОРИДОР
// КОРИДОР
export function furnishCorridor(R, solids, { cw, onPhoto = null }) {
    const xi = cw - 0.1;
    rug(R, 0, 0.6, Math.min(0.7, cw), 2.6, 0x5a3a2a, 0x3a2418);

    const tx = xi - 0.15, tz = 1.55;
    solidBox(R, solids, 0.3, 0.75, 0.7, tx, 0.375, tz, 0x4a3a2c);
    makeBox(R, 0.34, 0.03, 0.74, tx, 0.765, tz, 0x5a4a38);
    vase(R, tx, 0.78, tz + 0.22, { color: 0x6a5a3a });

    pictureWall(R, -xi, 1.6, 1.5, "e", [
        { u: 0, w: 0.30, h: 0.40, art: "landscape" },
    ]);
    frame(R, xi, 1.65, tz, "w", 0.32, 0.42, "stilllife");
    wallLamp(R, -xi, 1.8, 1.95, "e");

    // Календарь раньше стоял на z=0.7 — прямо в проёме ванной
    // (проём: z ∈ [0, 0.85]). Переехал на z=1.4 (южнее столика).
    calendar(R, -xi, 1.55, 1.1, "e");

    // Полка уезжает с z=0.5 (это ровно створ кухонной двери z∈[0,1.0])
    // на z=1.75 — в южную часть коридора, ближе к спальне.
    // Коридор тут тянется z∈[-1.0, 2.2], так что 1.75 с запасом влезает.
    clutterShelf(R, xi, 1.5, -0.5, "w", 0.5);
    
    return { tableTop: { x: tx, y: 0.78, z: tz - 0.2 } };
}

// ВАННАЯ
export function furnishBath(R, solids, { hw, cw, hooks = {} }) {
    const x0 = -(hw - 0.1), x1 = -(cw + 0.1), z0 = -0.9, z1 = 2.1;
    const tile = 0x7a8a86, th = 1.6;
    const pan = (w, d, x, z) => { if (w > 0.01 && d > 0.01) makeBox(R, w, th, d, x, th / 2, z, tile); };
    pan(0.02, z1 - z0, x0 + 0.01, (z0 + z1) / 2);
    pan(x1 - x0, 0.02, (x0 + x1) / 2, z0 + 0.01);
    pan(x1 - x0, 0.02, (x0 + x1) / 2, z1 - 0.01);
    pan(0.02, -0.05 - z0, x1 - 0.01, (z0 - 0.05) / 2);
    pan(0.02, z1 - 0.85,  x1 - 0.01, (0.85 + z1) / 2);

    const tw = Math.min(1.4, x1 - x0 - 0.06);
    const tcx = x0 + 0.02 + tw / 2;
    const tub = solidBox(R, solids, tw, 0.55, 0.7, tcx, 0.275, 1.73, 0xa0a096);
    const basin = makeBox(R, tw - 0.2, 0.02, 0.5, tcx, 0.56, 1.73, 0x6a726e);
    const tap = makeBox(R, 0.06, 0.15, 0.3, tcx + tw / 2 - 0.12, 0.65, 1.95, 0x8a8a84);
    if (hooks.tub) new Interactable([tub, basin, tap], "Осмотреть ванну", hooks.tub);

    solidBox(R, solids, 0.2, 0.45, 0.4, x0 + 0.12, 0.625, 0.55, 0xb4b4aa);
    solidBox(R, solids, 0.5, 0.4, 0.4, x0 + 0.47, 0.2, 0.55, 0xb4b4aa);
    makeBox(R, 0.5, 0.03, 0.4, x0 + 0.47, 0.415, 0.55, 0x9a9a90);

    solidBox(R, solids, 0.4, 0.8, 0.5, x0 + 0.22, 0.4, -0.45, 0xb4b4aa);
    makeBox(R, 0.44, 0.08, 0.54, x0 + 0.23, 0.84, -0.45, 0xc4c4ba);
    makeBox(R, 0.05, 0.12, 0.05, x0 + 0.1, 0.94, -0.45, 0x8a8a84);

    const bm = makeBox(R, 0.03, 0.6, 0.5, x0 + 0.035, 1.65, -0.45, 0x8a9a9a);
    const bmf = makeBox(R, 0.025, 0.68, 0.58, x0 + 0.0325, 1.65, -0.45, 0x3a2a1c);
    glow(bm, 0x182020, 1);
    if (hooks.mirror) new Interactable([bm, bmf], "Посмотреть в зеркало", hooks.mirror);

    const wmx = x1 - 0.35;
    solidBox(R, solids, 0.5, 0.85, 0.55, wmx, 0.425, -0.6, 0xc8c4b8);
    makeBox(R, 0.02, 0.3, 0.3, wmx - 0.26, 0.45, -0.6, 0x2e3238);
    makeBox(R, 0.02, 0.06, 0.3, wmx - 0.26, 0.78, -0.6, 0x8a2a2a);

    makeBox(R, 0.04, 0.04, 0.5, x1 - 0.06, 1.2, -0.5, 0x8a8a84);
    makeBox(R, 0.03, 0.5, 0.4, x1 - 0.05, 0.95, -0.5, 0x8a4a3a);
    clutterShelf(R, x0 + 0.02, 1.45, 0.55, "e", 0.6);
    rug(R, x0 + 0.02 + 0.65, 1.02, 0.8, 0.5, 0x4a5a6a, 0x34404c);
    return { tub };
}

// КУХНЯ — исправлено: холодильник и столешница больше не пересекаются,
// верхний шкафчик переехал подальше от холодильника,
// картина и полка убраны из зоны дверного проёма.
export function furnishKitchen(R, solids, { hw, cw, hasWindow = true }) {
    const x0 = cw + 0.1, x1 = hw - 0.1, z0 = -0.9, z1 = 2.1;
    const D = 0.6, cx = x1 - D / 2;

    // ── холодильник ────────────────────────────────────────────────
    const fW = 0.62, fD = 0.68;
    const fx = x1 - fW / 2 - 0.02, fz = z0 + fD / 2 + 0.02;   // z ∈ [-0.88, -0.20]
    const fridge = solidBox(R, solids, fW, 1.7, fD, fx, 0.85, fz, COLORS.FRIDGE);
    const fridgeParts = [fridge,
        makeBox(R, 0.01, 0.02, fD - 0.04, fx - fW / 2 - 0.005, 1.1, fz, 0x707070),
        makeBox(R, 0.04, 0.4, 0.04, fx - fW / 2 - 0.02, 1.45, fz + 0.24, 0x707070),
        makeBox(R, 0.04, 0.4, 0.04, fx - fW / 2 - 0.02, 0.8, fz + 0.24, 0x707070)];
    const lbl = makeTextSprite("МИНСК", { fontSize: 32, color: "#606060" });
    lbl.position.set(fx - fW / 2 - 0.013, 1.62, fz);
    lbl.rotation.y = -Math.PI / 2;
    R.add(lbl);

    // ── секции гарнитура ──────────────────────────────────────────
    // ВАЖНО: zA0 сдвинут на -0.15, чтобы тумба с мойкой НЕ начиналась
    // внутри холодильника (раньше -0.45 давал наложение по z).
    const zA0 = -0.15, zA1 = 0.45;                 // тумба с мойкой
    const zB0 = 0.55,  zB1 = 1.25;                 // рабочая тумба
    const stoveZ = 1.70, stoveLen = 0.55;          // плита

    solidBox(R, solids, D, 0.84, zA1 - zA0, cx, 0.42, (zA0 + zA1) / 2, 0x6a5a48);
    solidBox(R, solids, D, 0.84, zB1 - zB0, cx, 0.42, (zB0 + zB1) / 2, 0x6a5a48);

    // Столешница — двумя кусками, чтобы не накрывать плиту
    makeBox(R, D + 0.02, 0.04, (zA1 - zA0) + 0.04, cx, 0.86, (zA0 + zA1) / 2, 0x8a8478);
    makeBox(R, D + 0.02, 0.04, (zB1 - zB0) + 0.04, cx, 0.86, (zB0 + zB1) / 2, 0x8a8478);

    // мойка
    makeBox(R, 0.4, 0.02, 0.46, cx - 0.03, 0.885, (zA0 + zA1) / 2, 0x2a2a2a);
    makeBox(R, 0.04, 0.1, 0.04, cx + 0.2, 0.93, (zA0 + zA1) / 2, 0x909090);
    makeBox(R, 0.04, 0.03, 0.14, cx + 0.15, 0.98, (zA0 + zA1) / 2, 0x909090);

    // ручки
    makeBox(R, 0.01, 0.12, 0.3, cx - D / 2 - 0.005, 0.5, (zA0 + zA1) / 2, 0x4a3c2c);
    makeBox(R, 0.01, 0.12, 0.3, cx - D / 2 - 0.005, 0.5, (zB0 + zB1) / 2, 0x4a3c2c);

    // ── плита ─────────────────────────────────────────────────────
    const stove = solidBox(R, solids, D - 0.02, 0.86, stoveLen, cx, 0.43, stoveZ, 0xc4beb0);
    const stoveParts = [stove,
        makeBox(R, 0.02, 0.28, 0.4, cx - D / 2 + 0.0, 0.38, stoveZ, 0x2a2a2a),
        makeBox(R, 0.03, 0.03, 0.46, cx - D / 2 - 0.005, 0.62, stoveZ, 0x707070)];
    for (const [dx, dz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]])
        stoveParts.push(makeBox(R, 0.14, 0.02, 0.14, cx + dx, 0.87, stoveZ + dz, 0x1a1a1a));
    const kettle = makeBox(R, 0.2, 0.22, 0.2, cx + 0.12, 0.99, stoveZ + 0.12, 0x8a8a90);
    const kettleParts = [kettle, makeBox(R, 0.08, 0.04, 0.04, cx + 0.12, 1.0, stoveZ + 0.25, 0x8a8a90)];

    // вытяжка — строго над плитой
    makeBox(R, 0.4, 0.14, 0.55, x1 - 0.2, 1.62, stoveZ, 0x9a9a90);
    makeBox(R, 0.14, 1.11, 0.14, x1 - 0.1, 2.245, stoveZ, 0x9a9a90);


    // Верхний шкафчик — СТОИТ на холодильнике (раньше висел рядом).
    // Холодильник: центр (fx, fz), верх на y = 1.7. Шкафчик — чуть уже и
    // мельче по глубине, чтобы не свисал с боков и не вылезал вперёд.
    const cabW = fW - 0.04;             // 0.58 — чуть уже холодильника (0.62)
    const cabD = fD - 0.06;             // 0.62 — чуть меньше по глубине (0.68)
    const cabH = 0.7;                   // высота навесного шкафа
    const cabY = 1.7 + cabH / 2;        // низ стоит ровно на верхней крышке
    const cab = makeBox(R, cabW, cabH, cabD, fx, cabY, fz, 0x5a4a38);

    // Ручки-«фасады» и вертикальная щель посередине — как у остальных шкафов
    makeBox(R, 0.01, 0.02, cabD - 0.08, fx - cabW / 2 - 0.005, cabY, fz, 0x3a2c1c);
    makeBox(R, 0.012, cabH - 0.08, 0.02, fx, cabY, fz - cabD / 2 - 0.005, 0x3a2c1c);
    for (const sz of [-1, 1]) {
        makeBox(R, 0.04, 0.04, 0.04, fx - cabW / 2 - 0.02, cabY - 0.15, fz + sz * 0.18, 0x707070);
    }
    

    // ── обеденная зона ────────────────────────────────────────────
    const aisle = (cx - D / 2) - x0;
    if (aisle >= 1.2) {
        const tx = x0 + aisle * 0.5, tz = -0.55;
        table(R, solids, tx, tz, 0.8, 0.6, 0.75, 0x7a6a50);
        makeBox(R, 0.82, 0.012, 0.62, tx, 0.756, tz, 0xc8c0a8);
        vase(R, tx + 0.15, 0.762, tz, { color: 0x5a7a6a });
        makeBox(R, 0.18, 0.015, 0.18, tx - 0.2, 0.765, tz, 0xd8d0c0);
        solidBox(R, solids, 0.32, 0.45, 0.32, x0 + 0.22, 0.225, tz, 0x6a5a3a);
        solidBox(R, solids, 0.32, 0.45, 0.32, tx, 0.225, tz + 0.55, 0x6a5a3a);

        wallClock(R, tx, 1.9, z0, "n", { time: "kitchen" });
        // Картина — СБОКУ от полки, не над ней. Полка занимает z∈[1.65,2.25],
        // поэтому ставим картину на z=1.35 (габарит 1.175..1.525) —
        // зазор до полки ≈0.13, до края дверного проёма (z=1.0) ≈0.175.
        pictureWall(R, x0 + 0.1, 1.7, 1.35, "e", [
            { u: 0, w: 0.35, h: 0.45, art: "stilllife" },
        ]);
        
    } else {
        solidBox(R, solids, 0.32, 0.45, 0.32, x0 + 0.25, 0.225, z0 + 0.3, 0x6a5a3a);
        wallClock(R, (x0 + cx - D / 2) / 2, 1.9, z0, "n");
    }
    solidBox(R, solids, 0.25, 0.35, 0.25, x0 + 0.2, 0.175, z1 - 0.2, 0x4a5a4a);
    rug(R, x1 - D - 0.3, 1.0, 0.5, 0.9, 0x6a4a3a, 0x442e22);
    // Полка переехала с z=1.6 (у двери) на z=1.95 (у дальнего северного угла)
    clutterShelf(R, x0, 1.5, 1.95, "e", 0.6);

    // ── подоконник / глухая стена ─────────────────────────────────
    if (hasWindow) {
        plantPot(R, solids, x1 - 0.12, 0.85, { y: 1.04, s: 0.55, solid: false });
        vase(R, x1 - 0.12, 1.04, 1.25, { color: 0x8a6a4a, flowers: false });
    } else {
        frame(R, x1, 1.55, 0.9, "w", 0.5, 0.65, "stilllife");
        wallShelf(R, x1, 1.85, 1.5, "w", 0.5,
            [{ c: 0xb4a888, h: 0.13 }, { c: 0x4a6a7a, h: 0.11 }]);
    }

    return { fridgeParts, stoveParts, kettleParts, fridge };
}