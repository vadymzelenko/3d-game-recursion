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
  }

  build() { /* override */ }

  place(x, y, z, rotY = 0) {
    this.group.position.set(x, y, z);
    this.group.rotation.y = rotY;

    if (Math.abs(rotY) < 1e-6) {
      for (const s of this.solids) {
        s.min[0] += x; s.min[1] += y; s.min[2] += z;
        s.max[0] += x; s.max[1] += y; s.max[2] += z;
      }
    } else if (Math.abs(Math.abs(rotY) - Math.PI) < 1e-6) {
      for (const s of this.solids) {
        const [minX, minY, minZ] = s.min;
        const [maxX, maxY, maxZ] = s.max;
        s.min[0] = x - maxX; s.max[0] = x - minX;
        s.min[1] = y + minY; s.max[1] = y + maxY;
        s.min[2] = z - maxZ; s.max[2] = z - minZ;
      }
    }
    this.group.updateMatrixWorld(true);
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

  onEnter() { /* override */ }
  onExit() { /* override */ }
  onUpdate(dt) { /* override */ }
}