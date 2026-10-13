// ЗАГАДКА №6. Наведение телескопа в квартире №50.
// Лимбы: азимут 0–359°, угол места −5…+60°. На 312 / +14 небо исчезает:
// крыша лабораторного корпуса ВЦ «Прибор», человек в халате, «БЛОК-В-88».
// Не смотри слишком долго: изображение начинает искажаться.

import { Overlay, h } from "../ui/overlay.js";
import { FONTS } from "../world/text.js";

const AZ = 312, EL = 14;

// Детерминированное звёздное небо.
function rand(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
const STARS = Array.from({ length: 1400 }, (_, i) => ({ az: rand(i) * 360, el: -5 + rand(i + 9000) * 75, m: rand(i + 3000) }));

export class TelescopePuzzle extends Overlay {
  constructor(game) {
    super(game, "puzzle telescope");
    this.az = 20; this.elev = 30;
    this._raf = 0;
  }

  onOpen() {
    const root = this.el;
    root.innerHTML = "";
    root.append(h("div", "pz-title", "Телескоп. Лимбы монтировки."));
    const cv = document.createElement("canvas");
    cv.width = 520; cv.height = 520; cv.className = "ts-canvas";
    this.cv = cv; this.ctx = cv.getContext("2d");

    const limbs = h("div", "ts-limbs");
    const mk = (label, get, set, step) => {
      const box = h("div", "ts-limb");
      box.append(h("div", "ts-limb-l", label));
      const val = h("div", "ts-limb-v");
      const minus = h("button", "ts-b", "−"), plus = h("button", "ts-b", "+");
      const hold = (btn, d) => {
        let t = 0;
        const go = () => { set(get() + d); t = setTimeout(go, 70); };
        btn.onpointerdown = () => { set(get() + d); t = setTimeout(go, 350); };
        btn.onpointerup = btn.onpointerleave = () => clearTimeout(t);
      };
      hold(minus, -step); hold(plus, step);
      box.append(minus, val, plus);
      limbs.append(box);
      return val;
    };
    this.vAz = mk("АЗИМУТ", () => this.az, v => { this.az = (v + 360) % 360; }, 1);
    this.vEl = mk("МЕСТО", () => this.elev, v => { this.elev = Math.max(-5, Math.min(60, v)); }, 1);
    this.sub = h("div", "rd-sub");
    const row = h("div", "ts-row");
    row.append(cv, limbs);
    root.append(row, this.sub, h("div", "paper-hint", "стрелки влево-вправо — азимут, вверх-вниз — место (Shift — по 10°) · Esc — оторваться"));
    this.lookT = 0;
    this.lockT = 0;
    this._last = performance.now();
    this.sub.textContent = this.game.state.is("telescope_done")
      ? "Крыша блока В. Человек машет мне рукой."
      : "Сначала — ничего. Только звёзды.";
    const loop = () => { if (!this.isOpen) return; this._tick(); this._raf = requestAnimationFrame(loop); };
    loop();
  }

  onClose() { cancelAnimationFrame(this._raf); this.game.audio.drone(0); }

  onKeyDown(e) {
    if (e.code === "Escape" && !e.repeat && !this.fresh) { this.close(); return; }
    const st = e.shiftKey ? 10 : 1;
    if (e.code === "ArrowRight" || e.code === "KeyD") this.az = (this.az + st) % 360;
    if (e.code === "ArrowLeft" || e.code === "KeyA") this.az = (this.az - st + 360) % 360;
    if (e.code === "ArrowUp" || e.code === "KeyW") this.elev = Math.min(60, this.elev + st);
    if (e.code === "ArrowDown" || e.code === "KeyS") this.elev = Math.max(-5, this.elev - st);
    if (e.code.startsWith("Arrow")) e.preventDefault();
  }

  _tick() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this.lookT += dt;
    this.vAz.textContent = String(Math.round(this.az)).padStart(3, "0") + "°";
    this.vEl.textContent = (this.elev >= 0 ? "+" : "") + Math.round(this.elev) + "°";

    const dAz = Math.abs(((this.az - AZ + 540) % 360) - 180);
    const dEl = Math.abs(this.elev - EL);
    const on = dAz < 0.5 && dEl < 0.5;
    const s = this.game.state;
    if (on && !s.is("telescope_done")) {
      this.lockT += dt;
      if (this.lockT > 1.5) this._found();
    } else this.lockT = 0;

    // Слишком долгое наблюдение.
    const dist = Math.max(0, this.lookT - 50) / 70;
    this.game.audio.drone(Math.min(1, dist));
    if (this.lookT > 60 && this.lookT - dt <= 60) this.sub.textContent = "Изображение начинает искажаться.";
    if (this.lookT > 95 && this.lookT - dt <= 95) this.sub.textContent = "Я вижу не крышу. Я вижу себя.";
    if (this.lookT > 120 && this.lookT - dt <= 120) this.sub.textContent = "Я не могу оторваться.";
    if (this.lookT > 135) {
      this.close();
      this.game.die("Через пять минут ты уже не смотришь. Ты — смотришься.");
      return;
    }
    this._draw(on, dAz, dEl, dist);
  }

  _found() {
    const gm = this.game, s = gm.state;
    s.set("telescope_done");
    s.learn("block_v");
    gm.audio.play("glitch");
    this.sub.textContent = "Небо исчезает. Крыша лабораторного корпуса ВЦ «Прибор». На краю — человек в лабораторном халате.";
    setTimeout(() => {
      if (this.isOpen) this.sub.textContent = "В руках — радиозонд. Он смотрит прямо на меня. И машет рукой. Это — я. На парапете: «БЛОК-В-88».";
    }, 4200);
    setTimeout(() => gm.hud.say("Я — не единственный «я». Источник — не небо. Источник — под нами."), 8000);
  }

  _draw(on, dAz, dEl, dist) {
    const c = this.ctx, W = this.cv.width, H = this.cv.height;
    c.save();
    c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
    c.beginPath(); c.arc(W / 2, H / 2, W / 2 - 8, 0, Math.PI * 2); c.clip();

    const FOV = 8;   // градусов на окуляр
    const showRoof = this.game.state.is("telescope_done") ? on : (on && this.lockT > 0.4);
    if (!showRoof) {
      const g = c.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W / 2);
      g.addColorStop(0, "#0c1426"); g.addColorStop(1, "#04060c");
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (const st of STARS) {
        let da = ((st.az - this.az + 540) % 360) - 180;
        const de = st.el - this.elev;
        if (Math.abs(da) > FOV || Math.abs(de) > FOV) continue;
        const x = W / 2 + da / FOV * W / 2, y = H / 2 - de / FOV * H / 2;
        c.fillStyle = `rgba(235,230,200,${0.3 + st.m * 0.7})`;
        c.fillRect(x, y, st.m > 0.93 ? 3 : 1.5, st.m > 0.93 ? 3 : 1.5);
      }
      // «не звезда» — чуть мерцающая точка в нужном секторе
      let da = ((AZ - this.az + 540) % 360) - 180, de = EL - this.elev;
      if (Math.abs(da) < FOV && Math.abs(de) < FOV) {
        const x = W / 2 + da / FOV * W / 2, y = H / 2 - de / FOV * H / 2;
        c.fillStyle = `rgba(255,120,90,${0.6 + Math.sin(performance.now() / 150) * 0.4})`;
        c.beginPath(); c.arc(x, y, 3, 0, Math.PI * 2); c.fill();
      }
      if (this.elev < 2) { c.fillStyle = "rgba(20,18,26,0.95)"; c.fillRect(0, H / 2 + (this.elev - 2) / FOV * -H / 2 + H * 0.1, W, H); }
    } else {
      this._roof(c, W, H, dist);
    }
    // сетка окуляра
    c.strokeStyle = "rgba(200,200,180,0.25)"; c.lineWidth = 1;
    c.beginPath(); c.moveTo(W / 2, 0); c.lineTo(W / 2, H); c.moveTo(0, H / 2); c.lineTo(W, H / 2); c.stroke();
    // искажение
    if (dist > 0) {
      for (let i = 0; i < 60 * dist; i++) {
        c.fillStyle = `rgba(255,255,255,${Math.random() * 0.15})`;
        c.fillRect(0, Math.random() * H, W, 1 + Math.random() * 3);
      }
    }
    c.restore();
    c.strokeStyle = "#1a1a1a"; c.lineWidth = 16; c.beginPath(); c.arc(W / 2, H / 2, W / 2 - 8, 0, Math.PI * 2); c.stroke();
  }

  _roof(c, W, H, dist) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1a1e2a"); g.addColorStop(1, "#2e3038");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // корпус и парапет
    c.fillStyle = "#3a3a3e"; c.fillRect(0, H * 0.62, W, H * 0.38);
    c.fillStyle = "#56565a"; c.fillRect(0, H * 0.58, W, H * 0.06);
    c.fillStyle = "#d8d8d0"; for (let x = 0; x < W; x += 9) c.fillRect(x, H * 0.575, 6, 3);   // снег
    // антенна и вентшахта
    c.strokeStyle = "#6a6a6e"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(W * 0.2, H * 0.58); c.lineTo(W * 0.2, H * 0.2); c.moveTo(W * 0.12, H * 0.28); c.lineTo(W * 0.28, H * 0.28); c.stroke();
    c.fillStyle = "#4a4a4e"; c.fillRect(W * 0.72, H * 0.44, W * 0.1, H * 0.14);
    // маркировка
    c.fillStyle = "#c8c0a0"; c.font = `600 26px ${FONTS.sans}`; c.textAlign = "center";
    c.fillText("БЛОК-В-88", W * 0.5, H * 0.75);
    // человек в халате, машет
    const t = performance.now() / 300;
    const px = W * 0.52, py = H * 0.58;
    const dead = dist > 0.35;
    c.fillStyle = dead ? "#9a9a9e" : "#e8e8e0";
    c.fillRect(px - 12, py - 70, 24, 46);
    c.fillStyle = dead ? "#6a6c6a" : "#c8a888";
    c.beginPath(); c.arc(px, py - 82, 11, 0, Math.PI * 2); c.fill();
    c.strokeStyle = dead ? "#9a9a9e" : "#e8e8e0"; c.lineWidth = 6;
    c.beginPath(); c.moveTo(px + 10, py - 64); c.lineTo(px + 26 + Math.sin(t) * 6, py - 92 - Math.cos(t) * 4); c.stroke();
    c.beginPath(); c.moveTo(px - 10, py - 60); c.lineTo(px - 20, py - 36); c.stroke();
    c.fillStyle = "#2a2a30"; c.fillRect(px - 10, py - 24, 8, 24); c.fillRect(px + 2, py - 24, 8, 24);
    c.fillStyle = "#8a8a7a"; c.fillRect(px - 30, py - 44, 12, 16);   // радиозонд
  }
}
