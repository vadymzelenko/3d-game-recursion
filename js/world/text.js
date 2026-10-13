// Надписи в мире. Никаких «парящих» спрайтов: каждая надпись — это
// предмет, у которого есть носитель и техника исполнения. Мел на
// штукатурке, трафаретная краска, ржаво-бурые чернила, эмалевая табличка.
// Шрифты подгружаются в main.js до постройки мира.

import * as THREE from "three";
import { FACE_ROT } from "../utils.js";

export const FONTS = {
  hand:  '"Caveat", "Segoe Script", cursive',
  mono:  '"PT Mono", "Courier New", monospace',
  serif: '"PT Serif", Georgia, serif',
  sans:  '"Oswald", "Arial Narrow", sans-serif',
};

const STYLES = {
  chalk:   { font: FONTS.hand,  weight: 600, color: "rgba(232,230,214,0.92)", rough: 0.55 },
  paint:   { font: FONTS.sans,  weight: 600, color: "rgba(206,196,160,0.95)", rough: 0.35 },
  rust:    { font: FONTS.hand,  weight: 700, color: "rgba(104,40,24,0.92)",   rough: 0.25 },
  ink:     { font: FONTS.hand,  weight: 500, color: "rgba(30,30,44,0.95)",    rough: 0 },
  pencil:  { font: FONTS.hand,  weight: 500, color: "rgba(70,70,70,0.85)",    rough: 0.1 },
  typed:   { font: FONTS.mono,  weight: 400, color: "rgba(28,26,24,0.95)",    rough: 0.05 },
  label:   { font: FONTS.sans,  weight: 500, color: "rgba(40,40,40,0.95)",    rough: 0 },
};

function noiseErase(ctx, w, h, amount) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  const n = Math.floor(w * h * 0.004 * amount);
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = 0.3 + Math.random() * 0.7;
    const r = 0.6 + Math.random() * 1.8 * amount;
    ctx.beginPath();
    ctx.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function measureLines(ctx, lines, px) {
  let maxW = 0;
  for (const l of lines) maxW = Math.max(maxW, ctx.measureText(l).width);
  return { w: maxW, h: lines.length * px * 1.15 };
}

// Надпись прямо на поверхности.
//   width — ширина надписи в метрах (высота считается по пропорции);
//   face  — куда смотрит лицевая сторона (n/s/e/w), как у картин в decor.js.
export function decal(parent, text, { x = 0, y = 0, z = 0, face = "n", width = 1, style = "chalk", tilt = 0, align = "center", px = 96, color = null } = {}) {
  const st = STYLES[style] || STYLES.chalk;
  const lines = String(text).split("\n");
  const font = `${st.weight} ${px}px ${st.font}`;

  const probe = document.createElement("canvas").getContext("2d");
  probe.font = font;
  const m = measureLines(probe, lines, px);
  const pad = px * 0.35;
  const cw = Math.ceil(m.w + pad * 2), ch = Math.ceil(m.h + pad * 2);

  const cv = document.createElement("canvas");
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext("2d");
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.textAlign = align;
  const ax = align === "left" ? pad : align === "right" ? cw - pad : cw / 2;
  const fill = color || st.color;

  lines.forEach((line, i) => {
    const ly = pad + px * 1.15 * (i + 0.5);
    if (style === "chalk") {
      // Мел: несколько проходов с дрожью — штрих неровный, «пыльный».
      for (let k = 0; k < 4; k++) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = fill;
        ctx.fillText(line, ax + (Math.random() - 0.5) * 3, ly + (Math.random() - 0.5) * 3);
      }
      ctx.globalAlpha = 1;
    } else if (style === "rust") {
      ctx.fillStyle = fill;
      ctx.fillText(line, ax, ly);
      // потёки
      ctx.globalAlpha = 0.5;
      for (let k = 0; k < line.length / 2; k++) {
        const dx = ax - m.w / 2 + Math.random() * m.w;
        ctx.fillRect(dx, ly + px * 0.25, 2 + Math.random() * 2, px * (0.2 + Math.random() * 0.6));
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = fill;
      ctx.fillText(line, ax, ly);
    }
  });
  noiseErase(ctx, cw, ch, st.rough);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshLambertMaterial({
    map: tex, transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const h = width * ch / cw;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, h), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = FACE_ROT[face] ?? 0;
  mesh.rotation.z = tilt;
  mesh.userData.noPick = true;
  mesh.renderOrder = 2;
  parent.add(mesh);
  return mesh;
}

// Табличка: фон, рамка, текст. Это отдельный тонкий предмет на стене/двери.
export function plate(parent, text, { x = 0, y = 0, z = 0, face = "n", w = 0.3, h = 0.2, bg = "#1f2a3a", fg = "#e8e2c8", border = "#c9bf9a", font = FONTS.sans, weight = 600, scale = 0.62 } = {}) {
  const px = 256;
  const cw = Math.round(px * w / h), ch = px;
  const cv = document.createElement("canvas");
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext("2d");

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cw, ch);
  // глянец эмали
  const g = ctx.createLinearGradient(0, 0, 0, ch);
  g.addColorStop(0, "rgba(255,255,255,0.10)"); g.addColorStop(0.5, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cw, ch);

  ctx.strokeStyle = border; ctx.lineWidth = ch * 0.05;
  ctx.strokeRect(ch * 0.07, ch * 0.07, cw - ch * 0.14, ch - ch * 0.14);

  const lines = String(text).split("\n");
  const fpx = Math.floor(ch * scale / lines.length);
  ctx.fillStyle = fg;
  ctx.font = `${weight} ${fpx}px ${font}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, cw / 2, ch / 2 + (i - (lines.length - 1) / 2) * fpx * 1.05));
  noiseErase(ctx, cw, ch, 0.08);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshLambertMaterial({ map: tex });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012), [
    new THREE.MeshLambertMaterial({ color: 0x2a2a2a }), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }),
    new THREE.MeshLambertMaterial({ color: 0x2a2a2a }), new THREE.MeshLambertMaterial({ color: 0x2a2a2a }),
    mat, new THREE.MeshLambertMaterial({ color: 0x2a2a2a }),
  ]);
  mesh.position.set(x, y, z);
  mesh.rotation.y = FACE_ROT[face] ?? 0;
  parent.add(mesh);
  return mesh;
}
