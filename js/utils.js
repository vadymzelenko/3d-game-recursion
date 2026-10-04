// Утилиты: построение геометрии и материалов.

import * as THREE from "three";
import { COLORS } from "./settings.js";

// Кэш геометрий (одна BoxGeometry на каждый уникальный размер).
const _boxGeoCache = new Map();
function getBoxGeo(w, h, d) {
  const key = `${w}|${h}|${d}`;
  if (!_boxGeoCache.has(key)) {
    _boxGeoCache.set(key, new THREE.BoxGeometry(w, h, d));
  }
  return _boxGeoCache.get(key);
}

// Кэш материалов по цвету: сотни коробок — один материал на цвет.
// Для меш, которому нужен уникальный материал (подсветка, прозрачность),
// используй opts.unique или функцию glow().
const _matCache = new Map();
function getMat(color) {
  if (!_matCache.has(color)) {
    _matCache.set(color, new THREE.MeshLambertMaterial({ color }));
  }
  return _matCache.get(color);
}

export function makeBox(parent, w, h, d, x, y, z, color, opts = {}) {
  const mat = opts.unique ? new THREE.MeshLambertMaterial({ color }) : getMat(color);
  const mesh = new THREE.Mesh(getBoxGeo(w, h, d), mat);
  mesh.position.set(x, y, z);
  if (opts.rotY) mesh.rotation.y = opts.rotY;
  parent.add(mesh);
  if (opts.solid) mesh.userData.solid = { w, h, d, x, y, z };
  return mesh;
}

// Подсветка меша. Клонирует материал, чтобы не светились все коробки
// того же цвета.
export function glow(mesh, color, intensity = 0.8) {
  mesh.material = mesh.material.clone();
  mesh.material.emissive = new THREE.Color(color);
  mesh.material.emissiveIntensity = intensity;
  return mesh;
}

// Невидимая зона для луча взаимодействия.
let _hitMat = null;
export function makeHitbox(parent, w, h, d, x, y, z) {
  if (!_hitMat) _hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const mesh = new THREE.Mesh(getBoxGeo(w, h, d), _hitMat);
  mesh.position.set(x, y, z);
  mesh.userData.noPick = false;   // ловится лучом
  parent.add(mesh);
  return mesh;
}

// Коробка + AABB-коллизия в solids.
export function solidBox(parent, solids, w, h, d, x, y, z, color) {
  const m = makeBox(parent, w, h, d, x, y, z, color);
  solids.push(aabb(m));
  return m;
}

export function makeTextSprite(text, opts = {}) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const fontSize = opts.fontSize || 48;
  ctx.font = `${fontSize}px "Courier New", monospace`;
  const metrics = ctx.measureText(text);
  const w = Math.ceil(metrics.width) + 20;
  const h = fontSize + 20;

  canvas.width = w;
  canvas.height = h;

  ctx.font = `${fontSize}px "Courier New", monospace`;
  ctx.fillStyle = opts.bg || "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = opts.color || "#d8d4b8";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(text, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    alphaTest: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const geo = new THREE.PlaneGeometry(w / 200, h / 200);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 5;
  mesh.userData.noPick = true;   // надпись не перекрывает луч взаимодействия
  return mesh;
}

// AABB { min:[x,y,z], max:[x,y,z] } для BoxGeometry-меша.
export function aabb(mesh) {
  const p = mesh.position;
  const s = mesh.geometry.parameters;
  return {
    min: [p.x - s.width / 2, p.y - s.height / 2, p.z - s.depth / 2],
    max: [p.x + s.width / 2, p.y + s.height / 2, p.z + s.depth / 2],
  };
}

// Универсальная комната (используется редко, основные сцены строят вручную).
export function buildRoom(parent, opts, solids) {
  const {
    width, depth, height,
    wallColor, floorColor, ceilColor,
    doorSide = null, doorWidth = 1.1, doorHeight = 2.1, doorOffset = 0,
    windowSide = null, windowWidth = 2.4, windowHeight = 1.6,
    windowSillY = 1.0, windowOffset = 0,
    floorHole = null,
  } = opts;

  const t = 0.2;

  if (floorHole) {
    const halfW = width / 2, halfD = depth / 2;
    const hMinX = floorHole.x - floorHole.width / 2;
    const hMaxX = floorHole.x + floorHole.width / 2;
    const hMinZ = floorHole.z - floorHole.depth / 2;
    const hMaxZ = floorHole.z + floorHole.depth / 2;

    const addFloorSeg = (minX, maxX, minZ, maxZ) => {
      const w = maxX - minX, d = maxZ - minZ;
      if (w <= 0.01 || d <= 0.01) return;
      const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
      const m = makeBox(parent, w, t, d, cx, -t / 2, cz, floorColor);
      solids.push(aabb(m));
    };

    addFloorSeg(-halfW, hMinX, -halfD, halfD);
    addFloorSeg(hMaxX, halfW, -halfD, halfD);
    addFloorSeg(hMinX, hMaxX, -halfD, hMinZ);
    addFloorSeg(hMinX, hMaxX, hMaxZ, halfD);
  } else {
    const floor = makeBox(parent, width, t, depth, 0, -t / 2, 0, floorColor);
    solids.push(aabb(floor));
  }

  const ceil = makeBox(parent, width, t, depth, 0, height + t / 2, 0, ceilColor);
  solids.push(aabb(ceil));

  const walls = [
    { side: "north", along:  depth / 2, axis: "x", len: width },
    { side: "south", along: -depth / 2, axis: "x", len: width },
    { side: "east",  along:  width / 2, axis: "z", len: depth },
    { side: "west",  along: -width / 2, axis: "z", len: depth },
  ];

  for (const w of walls) {
    const isDoor = w.side === doorSide;
    const isWindow = w.side === windowSide;

    if (!isDoor && !isWindow) {
      let m;
      if (w.axis === "x") {
        m = makeBox(parent, w.len, height, t, 0, height / 2, w.along, wallColor);
      } else {
        m = makeBox(parent, t, height, w.len, w.along, height / 2, 0, wallColor);
      }
      solids.push(aabb(m));
      continue;
    }

    const openings = [];
    if (isDoor)   openings.push({ offset: doorOffset,   width: doorWidth,   bottom: 0,           top: doorHeight });
    if (isWindow) openings.push({ offset: windowOffset, width: windowWidth, bottom: windowSillY, top: windowSillY + windowHeight });

    const half = w.len / 2;
    const mk = (localCenter, localLen, yCenter, h) => {
      if (localLen <= 0.01 || h <= 0.01) return;
      let m;
      if (w.axis === "x") {
        m = makeBox(parent, localLen, h, t, localCenter, yCenter, w.along, wallColor);
      } else {
        m = makeBox(parent, t, h, localLen, w.along, yCenter, localCenter, wallColor);
      }
      solids.push(aabb(m));
    };

    const op = openings[0];
    const a0 = op.offset - op.width / 2;
    const a1 = op.offset + op.width / 2;

    const leftLen = a0 + half;
    if (leftLen > 0.01) mk(-half + leftLen / 2, leftLen, height / 2, height);

    const rightLen = half - a1;
    if (rightLen > 0.01) mk(a1 + rightLen / 2, rightLen, height / 2, height);

    if (op.bottom > 0.01) mk(op.offset, op.width, op.bottom / 2, op.bottom);

    const topH = height - op.top;
    if (topH > 0.01) mk(op.offset, op.width, op.top + topH / 2, topH);
  }
}