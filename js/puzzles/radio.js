// ЗАГАДКА №2. Настройка радиоприёмника «ВЭФ-202».
// Шкала 200–600 кГц. Шум стихает к 404 кГц. Если проскочить несущую
// слишком быстро — голос теряется. На 404 ± 0,5, удержав стрелку,
// слышен Никитин: «…азимут 312… место +14…».

import { Overlay, h } from "../ui/overlay.js";
import { FONTS } from "../world/text.js";

const F_MIN = 200, F_MAX = 600, TARGET = 404;

export class RadioPuzzle extends Overlay {
  constructor(game) {
    super(game, "puzzle radio");
    this.freq = 250;
    this.vel = 0;
    this.lockT = 0;
    this.heard = false;
    this._raf = 0;
  }

  onOpen() {
    const el = this.el;
    el.innerHTML = "";
    el.append(h("div", "pz-title", "«ВЭФ-202». Верньер."));
    const cv = document.createElement("canvas");
    cv.width = 900; cv.height = 300;
    cv.className = "rd-canvas";
    this.cv = cv; this.ctx = cv.getContext("2d");
    el.append(cv);
    this.sub = h("div", "rd-sub");
    el.append(this.sub, h("div", "paper-hint", "тяните шкалу мышью · колесо · ← → (Shift — точнее) · Esc — отойти"));

    let dragging = false, lastX = 0;
    cv.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const r = cv.getBoundingClientRect();
      const dx = (e.clientX - lastX) * (cv.width / r.width);
      lastX = e.clientX;
      this._turn(dx * 0.16);
    });
    cv.addEventListener("pointerup", () => { dragging = false; });
    cv.addEventListener("wheel", (e) => { e.preventDefault(); this._turn(Math.sign(e.deltaY) * (e.shiftKey ? 0.5 : 2)); }, { passive: false });

    this.heard = this.game.state.is("radio_tuned");
    this.lockT = 0;
    this._last = performance.now();
    this.game.audio.radioStart();
    const loop = () => {
      if (!this.isOpen) return;
      this._tick();
      this._raf = requestAnimationFrame(loop);
    };
    loop();
    if (!this.heard) this.sub.textContent = "Шум. Помехи. Голосов нет.";
  }

  onClose() {
    cancelAnimationFrame(this._raf);
    this.game.audio.radioStop();
  }

  onKeyDown(e) {
    if (e.repeat && (e.code === "Escape")) return;
    if (e.code === "Escape" && !this.fresh) { this.close(); return; }
    const step = e.shiftKey ? 0.5 : 2;
    if (e.code === "ArrowRight" || e.code === "KeyD") { this._turn(step); e.preventDefault(); }
    if (e.code === "ArrowLeft" || e.code === "KeyA") { this._turn(-step); e.preventDefault(); }
  }

  _turn(df) {
    const prev = this.freq;
    this.freq = Math.max(F_MIN, Math.min(F_MAX, this.freq + df));
    this.vel = this.vel * 0.6 + Math.abs(this.freq - prev) * 0.4;
    // Проскочил несущую на большой скорости — сигнал срывается.
    if (!this.heard && (prev - TARGET) * (this.freq - TARGET) < 0 && Math.abs(df) > 3) {
      this.sub.textContent = "Щелчок — и снова шум. Проскочил. Медленнее.";
    }
  }

  _tick() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this.vel *= 0.85;
    const d = Math.abs(this.freq - TARGET);
    const signal = Math.max(0, 1 - d / 4);
    const noise = 0.15 + 0.85 * Math.min(1, d / 6);
    this.game.audio.radioSet(noise, signal);

    if (!this.heard) {
      if (d <= 0.5 && this.vel < 0.6) {
        this.lockT += dt;
        if (this.lockT > 0.3 && this.lockT - dt <= 0.3) this.sub.textContent = "404. Щелчок. Тишина.";
        if (this.lockT > 1.3) this._voice();
      } else {
        if (this.lockT > 0) this.sub.textContent = "Шум возвращается.";
        this.lockT = 0;
      }
    }
    this._draw(signal);
  }

  _voice() {
    const gm = this.game;
    this.heard = true;
    gm.audio.play("voiceRadio");
    const lines = [
      "…сквозь шум пробивается голос. Мужской. Усталый. Прокуренный. С одышкой.",
      "«…азимут 312… место +14… повторяю… азимут 312… место +14…»",
      "Виктор Петрович Никитин. Мой наставник. Человек, который, возможно, виноват. Или пытается спасти.",
    ];
    let i = 0;
    const next = () => {
      if (!this.isOpen || i >= lines.length) {
        gm.state.set("radio_tuned");
        gm.state.learn("coords");
        gm.state.give("notebook_page");
        if (this.isOpen) this.sub.textContent = "Записываю на тетрадном листе: «АЗИМУТ 312 / МЕСТО +14. СМОТРЕТЬ В НЕБО. СЕКТОР БЛОК-В-88».";
        gm.hud.say("Азимут — угол по горизонту. Место — угол возвышения. Координаты. Не в себя. Не в пол. В небо.");
        return;
      }
      this.sub.textContent = lines[i++];
      setTimeout(next, 3600);
    };
    next();
  }

  _draw(signal) {
    const c = this.ctx, W = this.cv.width, H = this.cv.height;
    // корпус
    c.fillStyle = "#3a2618"; c.fillRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 30, 0, 200);
    g.addColorStop(0, "#e8d8a8"); g.addColorStop(1, "#c8b07a");
    c.fillStyle = g; c.fillRect(40, 40, W - 80, 150);
    // свет шкалы
    c.fillStyle = `rgba(255,190,80,${0.12 + signal * 0.25})`; c.fillRect(40, 40, W - 80, 150);

    const x0 = 70, x1 = W - 70;
    const fx = (f) => x0 + (f - F_MIN) / (F_MAX - F_MIN) * (x1 - x0);
    c.strokeStyle = "#2a1a10"; c.fillStyle = "#2a1a10";
    c.font = `500 22px ${FONTS.sans}`; c.textAlign = "center";
    for (let f = F_MIN; f <= F_MAX; f += 10) {
      const big = f % 50 === 0;
      c.lineWidth = big ? 2 : 1;
      c.beginPath(); c.moveTo(fx(f), 70); c.lineTo(fx(f), big ? 108 : 92); c.stroke();
      if (f % 100 === 0) c.fillText(String(f), fx(f), 136);
    }
    c.font = `400 16px ${FONTS.sans}`;
    c.fillText("кГц    СВ · СРЕДНИЕ ВОЛНЫ", W / 2, 172);
    c.fillText("ВЭФ-202", 120, 172);
    // стрелка
    const nx = fx(this.freq);
    c.strokeStyle = "#b8281a"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(nx, 50); c.lineTo(nx, 160); c.stroke();
    // индикатор настройки
    c.fillStyle = "#101010"; c.fillRect(W - 240, 210, 170, 50);
    c.fillStyle = `rgba(90,255,140,${0.15 + signal * 0.85})`;
    c.fillRect(W - 232, 220, 154 * (0.1 + signal * 0.9), 30);
    // ручка-верньер
    c.save(); c.translate(140, 238);
    c.rotate(this.freq / 20);
    c.fillStyle = "#1a1a1a"; c.beginPath(); c.arc(0, 0, 34, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#4a4a4a"; c.fillRect(-3, -30, 6, 18);
    c.restore();
    // частота цифрами — как карандашная пометка
    c.fillStyle = "#e8d8a8"; c.font = `600 30px ${FONTS.hand}`; c.textAlign = "left";
    c.fillText(`≈ ${this.freq.toFixed(1)} кГц`, 210, 250);
  }
}
