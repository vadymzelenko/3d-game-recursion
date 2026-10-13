// FPS-контроллер с AABB-коллизиями + автоматическим подъёмом на ступени.

import * as THREE from "three";
import { SETTINGS } from "./settings.js";

const STEP_UP_HEIGHT = 0.4;
const GROUND_SNAP   = 0.7;

export class Player {
  constructor(game) {
    this.game = game;
    this.position = new THREE.Vector3(0, SETTINGS.PLAYER_HEIGHT, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.velocityY = 0;
    this.grounded = true;
    this.radius = SETTINGS.PLAYER_RADIUS;
    this.height = SETTINGS.PLAYER_HEIGHT;


    this._stepTimer = 0;
    this.sensitivity = 1;
    // Аналоговый ввод (тач-джойстик, стик геймпада). Диапазон [-1..1],
    // складывается с клавиатурой и обрезается по длине.
    this.analogX = 0;
    this.analogZ = 0;
  }

  setPosition(x, y, z) {
    this.position.set(x, y, z);
    this.velocityY = 0;
    this.grounded = false;
  }

  update(dt, camera, solids, keys) {
    const run = keys["ShiftLeft"] || keys["ShiftRight"];
    const speed = SETTINGS.PLAYER_SPEED * (run ? 1.55 : 1);
    let mx = 0, mz = 0;
    if (keys["KeyW"] || keys["ArrowUp"]) mz -= 1;
    if (keys["KeyS"] || keys["ArrowDown"]) mz += 1;
    if (keys["KeyA"] || keys["ArrowLeft"]) mx -= 1;
    if (keys["KeyD"] || keys["ArrowRight"]) mx += 1;

    // Аналоговый ввод от тача/геймпада складывается с клавиатурой.
    mx += this.analogX;
    mz += this.analogZ;

    // Обрезаем длину до 1, но не нормализуем — иначе теряется аналоговость.
    const inLen = Math.hypot(mx, mz);
    if (inLen > 1) { mx /= inLen; mz /= inLen; }

    if (inLen > 0.05) {
      const cos = Math.cos(this.yaw);
      const sin = Math.sin(this.yaw);
      const dx = (mx * cos + mz * sin) * speed * dt;
      const dz = (mx * -sin + mz * cos) * speed * dt;

      if (Math.abs(dx) > 1e-5) this._tryMoveAxis("x", this.position.x + dx, solids);
      if (Math.abs(dz) > 1e-5) this._tryMoveAxis("z", this.position.z + dz, solids);

      if (this.grounded) {
        this._stepTimer -= dt;
        if (this._stepTimer <= 0) {
          this.game.audio.play("step");
          this._stepTimer = run ? 0.32 : 0.45;
        }
      }
    }

    if (keys["Space"] && this.grounded) {
      this.velocityY = SETTINGS.JUMP_SPEED;
      this.grounded = false;
    }

    if (!this.grounded) {
      this.velocityY -= SETTINGS.GRAVITY * dt;
      this.position.y += this.velocityY * dt;
    }

    const groundY = this._groundHeight(solids);
    const feetY = this.position.y - this.height;

    if (this.grounded) {
      if (feetY > groundY + 0.001 && feetY - groundY <= GROUND_SNAP) {
        this.position.y = groundY + this.height;
        this.velocityY = 0;
      } else if (feetY - groundY > GROUND_SNAP) {
        this.grounded = false;
      } else if (feetY < groundY) {
        this.position.y = groundY + this.height;
        this.velocityY = 0;
      }
    } else {
      if (feetY <= groundY + 0.01 && this.velocityY <= 0) {
        this.position.y = groundY + this.height;
        this.velocityY = 0;
        this.grounded = true;
      }
    }

    this.applyCamera(camera);
  }

  applyCamera(camera) {
    camera.position.copy(this.position);
    camera.rotation.order = "YXZ";
    camera.rotation.y = this.yaw;
    camera.rotation.x = this.pitch;
    camera.rotation.z = this.roll || 0;
  }

  _tryMoveAxis(axis, value, solids) {
    const r = this.radius;
    const feet = this.position.y - this.height;
    const head = this.position.y - 0.1;

    const nx = axis === "x" ? value : this.position.x;
    const nz = axis === "z" ? value : this.position.z;

    let climbTop = -Infinity;
    let blocked = false;

    for (const s of solids) {
      if (s.off) continue;                 // ← открытая дверь не мешает
      const [minX, minY, minZ] = s.min;
      const [maxX, maxY, maxZ] = s.max;

      if (head < minY) continue;
      if (feet >= maxY - 0.02) continue;

      if (nx + r > minX && nx - r < maxX && nz + r > minZ && nz - r < maxZ) {
        const rise = maxY - feet;
        if (rise > 0.02 && rise <= STEP_UP_HEIGHT) {
          if (maxY > climbTop) climbTop = maxY;
        } else {
          blocked = true;
          break;
        }
      }
    }

    if (blocked) return;

    if (climbTop > -Infinity) {
      const newFeet = climbTop;
      const newHead = newFeet + this.height - 0.1;
      for (const s of solids) {
        if (s.off) continue;               // ← то же
        const [minX, minY, minZ] = s.min;
        const [maxX, maxY, maxZ] = s.max;
        if (newHead < minY) continue;
        if (newFeet >= maxY - 0.02) continue;
        if (nx + r > minX && nx - r < maxX && nz + r > minZ && nz - r < maxZ) {
          return;
        }
      }
      this.position.y = climbTop + this.height;
      this.velocityY = 0;
      this.grounded = true;
    }

    if (axis === "x") this.position.x = nx;
    else this.position.z = nz;
  }

  _groundHeight(solids) {
    const r = this.radius;
    let best = -Infinity;
    const x = this.position.x, z = this.position.z;
    const feet = this.position.y - this.height;

    for (const s of solids) {
      if (s.off) continue;                 // ← то же
      const [minX, minY, minZ] = s.min;
      const [maxX, maxY, maxZ] = s.max;
      if (x + r > minX && x - r < maxX && z + r > minZ && z - r < maxZ) {
        if (maxY <= feet + GROUND_SNAP && maxY > best) {
          best = maxY;
        }
      }
    }
    return best === -Infinity ? 0 : best;
  }

  onMouseMove(dx, dy) {
    const k = SETTINGS.MOUSE_SENSITIVITY * this.sensitivity;
    this.yaw -= dx * k;
    this.pitch -= dy * k;
    const lim = Math.PI / 2 - 0.01;
    if (this.pitch > lim) this.pitch = lim;
    if (this.pitch < -lim) this.pitch = -lim;
  }

  // Прямой поворот на радианы (для геймпада).

  lookByRadians(yawDelta, pitchDelta) {
    this.yaw += yawDelta;
    this.pitch += pitchDelta;
    const lim = Math.PI / 2 - 0.01;
    if (this.pitch > lim) this.pitch = lim;
    if (this.pitch < -lim) this.pitch = -lim;
  }
}