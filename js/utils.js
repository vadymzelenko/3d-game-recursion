// Утилиты: построение геометрии и материалов.

import * as THREE from "three";

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

// Максимальная анизотропная фильтрация видеокарты — надписи под углом
// остаются чёткими. Задаётся игрой после создания рендерера.
let _aniso = 4;
export function setMaxAniso(n) { _aniso = Math.max(1, n | 0); }
export function maxAniso() { return _aniso; }

// Все общие материалы (для эффектов распада мира).
export function cachedMaterials() { return _matCache; }

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

// AABB { min:[x,y,z], max:[x,y,z] } для BoxGeometry-меша.
export function aabb(mesh) {
  const p = mesh.position;
  const s = mesh.geometry.parameters;
  return {
    min: [p.x - s.width / 2, p.y - s.height / 2, p.z - s.depth / 2],
    max: [p.x + s.width / 2, p.y + s.height / 2, p.z + s.depth / 2],
  };
}

// Плоская панель с текстурой, нарисованной на canvas (экраны, доски, карты).
// draw(ctx, w, h) рисует содержимое; возвращается меш, у которого в
// userData.redraw() можно перерисовать текстуру.
export function makePanel(parent, w, h, pxW, pxH, draw, { emissive = 0, basic = false } = {}) {
  const cv = document.createElement("canvas");
  cv.width = pxW; cv.height = pxH;
  const ctx = cv.getContext("2d");
  draw(ctx, pxW, pxH);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso();
  const mat = basic
    ? new THREE.MeshBasicMaterial({ map: tex })
    : new THREE.MeshLambertMaterial({
        map: tex,
        emissive: emissive ? new THREE.Color(0xffffff) : new THREE.Color(0),
        emissiveMap: emissive ? tex : null,
        emissiveIntensity: emissive,
      });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.userData.redraw = (fn = draw) => { ctx.clearRect(0, 0, pxW, pxH); fn(ctx, pxW, pxH); tex.needsUpdate = true; };
  mesh.userData.ctx = ctx;
  parent.add(mesh);
  return mesh;
}

// Поворот «лицом» в сторону света: n — смотрит на +z, s — на −z, e — на +x, w — на −x.
export const FACE_ROT = { n: 0, s: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };
