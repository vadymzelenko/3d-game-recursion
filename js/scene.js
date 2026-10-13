// Базовый класс сцены. Сцена строится один раз при старте игры.

import * as THREE from "three";

export class Scene {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.solids = [];
    this.spawn = [0, 1.7, -1.5];
    this.spawnYaw = 0;
    this.name = "scene";
    this._built = false;
    this.region = null;
    this.doors = [];   // входные двери (EntryDoor) — обновляются в updateDoors
    this._lightDefs = [];
  }

  // Якорь света в локальных координатах сцены. В мир он попадает после
  // place() — см. registerLights().
  light(x, y, z, opts = {}) { this._lightDefs.push({ x, y, z, opts }); }

  registerLights(pool) {
    this.group.updateMatrixWorld(true);
    for (const d of this._lightDefs) {
      const pos = new THREE.Vector3(d.x, d.y, d.z);
      this.group.localToWorld(pos);
      pool.add({ pos, ...d.opts });
    }
  }

  // Привести внешний вид сцены в соответствие с состоянием сюжета.
  // Вызывается после постройки и после каждого изменения флагов.
  sync() {}

  build() { /* override */ }

  place(x, y, z, rotY = 0) {
    this.group.position.set(x, y, z);
    this.group.rotation.y = rotY;
    // Коробки остаются теми же объектами (на них ссылаются двери).
    for (const s of this.solids) {
      const w = this.worldAABB(s);
      s.min = w.min; s.max = w.max;
    }
    this.group.updateMatrixWorld(true);
  }

  // Локальный AABB → мировой. Поворот кратен 90°, поэтому коробка
  // остаётся коробкой: достаточно повернуть углы.
  worldAABB(s) {
    const { x, y, z } = this.group.position;
    const r = this.group.rotation.y;
    const c = Math.round(Math.cos(r)), sn = Math.round(Math.sin(r));
    const xs = [], zs = [];
    for (const lx of [s.min[0], s.max[0]]) for (const lz of [s.min[2], s.max[2]]) {
      xs.push(x + lx * c + lz * sn);
      zs.push(z - lx * sn + lz * c);
    }
    return {
      min: [Math.min(...xs), y + s.min[1], Math.min(...zs)],
      max: [Math.max(...xs), y + s.max[1], Math.max(...zs)],
    };
  }

  // Мировая точка → локальные (x, z) этой сцены.
  toLocal(p) {
    const pos = this.group.position;
    const rotY = this.group.rotation.y;
    const dx = p.x - pos.x, dz = p.z - pos.z;
    const cos = Math.cos(rotY), sin = Math.sin(rotY);
    return { x: dx * cos - dz * sin, z: dx * sin + dz * cos };
  }

  containsPoint(p) {
    if (!this.region) return false;
    const pos = this.group.position;
    const rotY = this.group.rotation.y;
    const dx = p.x - pos.x;
    const dz = p.z - pos.z;
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    const r = this.region;
    return lx >= r.x0 && lx <= r.x1 && lz >= r.z0 && lz <= r.z1
        && p.y >= pos.y + r.y0 && p.y <= pos.y + r.y1;
  }

  resetDoors() { for (const d of this.doors) d.reset(); }
  updateDoors(dt) { for (const d of this.doors) d.update(dt); }

  activate() { this.group.visible = true; }
  deactivate() { this.group.visible = false; }

  // Этаж (мировая высота пола) — для отсечения невидимых квартир.
  get floorY() { return this.group.position.y; }

  onEnter() { /* override */ }
  onExit() { /* override */ }
  onUpdate(dt) { /* override */ }
}