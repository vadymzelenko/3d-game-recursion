// Пул точечных источников света.
//
// Раньше каждая квартира и каждый этаж добавляли свои PointLight — их
// набиралось под пятьдесят, и каждый материал считал их все. Теперь сцены
// регистрируют «якоря» света, а в мире живут только POOL_SIZE настоящих
// ламп, которые каждые несколько кадров переезжают к ближайшим якорям.
// Число ламп постоянно — шейдеры не перекомпилируются.

import * as THREE from "three";

const POOL_SIZE = 8;
const REASSIGN_EVERY = 0.2;   // сек

export class LightPool {
  constructor(scene) {
    this.anchors = [];
    this.groupLevel = Object.create(null);
    this.slots = [];
    this._t = 0;
    this._time = 0;
    for (let i = 0; i < POOL_SIZE; i++) {
      const l = new THREE.PointLight(0xffe8b4, 0, 8, 2);
      scene.add(l);
      this.slots.push({ light: l, anchor: null });
    }
  }

  // pos — мировые координаты (THREE.Vector3)
  add({ pos, color = 0xffe8b4, intensity = 4, distance = 8, group = "default", flicker = 0 }) {
    const a = { pos: pos.clone(), color: new THREE.Color(color), intensity, distance, group, flicker, phase: Math.random() * 100 };
    this.anchors.push(a);
    return a;
  }

  setGroupLevel(group, level) { this.groupLevel[group] = level; }

  // Немедленно пересадить лампы (после телепорта, пробуждения).
  force() { this._t = 0; }
  level(group) { return this.groupLevel[group] ?? 1; }

  update(dt, playerPos) {
    this._time += dt;
    this._t -= dt;
    if (this._t <= 0) {
      this._t = REASSIGN_EVERY;
      this._reassign(playerPos);
    }
    for (const s of this.slots) {
      const a = s.anchor;
      if (!a) { s.light.intensity = 0; continue; }
      let k = this.level(a.group);
      if (a.flicker > 0) {
        const n = Math.sin(this._time * 13 + a.phase) * Math.sin(this._time * 7.3 + a.phase * 2);
        if (n > 0.85 - a.flicker * 0.4) k *= 0.25;
      }
      s.light.intensity = a.intensity * k;
    }
  }

  _reassign(p) {
    const scored = [];
    for (const a of this.anchors) {
      if (this.level(a.group) <= 0.001) continue;
      const d = a.pos.distanceTo(p);
      if (d > a.distance + 6) continue;
      scored.push({ a, d });
    }
    scored.sort((x, y) => x.d - y.d);
    const want = new Set(scored.slice(0, POOL_SIZE).map(s => s.a));

    // Якоря, которые уже горят, остаются в своих слотах.
    for (const s of this.slots) if (s.anchor && !want.has(s.anchor)) s.anchor = null;
    const placed = new Set(this.slots.map(s => s.anchor).filter(Boolean));
    for (const a of want) {
      if (placed.has(a)) continue;
      const free = this.slots.find(s => !s.anchor);
      if (!free) break;
      free.anchor = a;
      free.light.position.copy(a.pos);
      free.light.color.copy(a.color);
      free.light.distance = a.distance;
    }
  }
}
