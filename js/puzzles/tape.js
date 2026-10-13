// ЗАГАДКА №3. Троекратное включение магнитофона «Маяк-205».
// Play — ничего. Play — ничего. На третий раз лента доходит до ракорда,
// счётчик замирает на 19880414, звучит мой голос с задержкой 1,5 с.
// Четвёртый раз — плёнка рвётся. И тогда — новый цикл.

import { Overlay, h } from "../ui/overlay.js";
import { FONTS } from "../world/text.js";

export class TapePuzzle extends Overlay {
  constructor(game) {
    super(game, "puzzle tape");
    this.spinning = false;
    this._raf = 0;
    this.counter = 0;
    this.angle = 0;
  }

  onOpen() {
    const el = this.el;
    el.innerHTML = "";
    el.append(h("div", "pz-title", "«Маяк-205». Плёнка намотана. Лента крутится — звука нет."));
    const cv = document.createElement("canvas");
    cv.width = 760; cv.height = 360; cv.className = "tp-canvas";
    this.cv = cv; this.ctx = cv.getContext("2d");
    const btns = h("div", "tp-btns");
    const mk = (label, fn, cls = "") => { const b = h("button", "tp-btn " + cls, label); b.onclick = fn; btns.append(b); return b; };
    mk("ПЕРЕМОТКА", () => this._rewind());
    mk("ПУСК", () => this._play(), "play");
    mk("СТОП", () => this._stop());
    this.sub = h("div", "rd-sub");
    el.append(cv, btns, this.sub, h("div", "paper-hint", "Esc — отойти"));
    const plays = this.game.state.count("tape_plays");
    this.counter = plays >= 3 ? 19880414 : plays * 137;
    this.sub.textContent = plays >= 3
      ? "Лента на ракорде. Счётчик стоит на 19880414. «Не включай больше трёх раз»."
      : "Только шорох плёнки по головке.";
    const loop = () => { if (!this.isOpen) return; this._draw(); this._raf = requestAnimationFrame(loop); };
    loop();
  }

  onClose() { cancelAnimationFrame(this._raf); this._stop(true); }

  _rewind() {
    if (this.spinning) return;
    this.game.audio.play("click");
    this.sub.textContent = "Перемотка не работает. Лента всегда там, где её остановили.";
  }

  _stop(silent = false) {
    if (!this.spinning) return;
    this.spinning = false;
    clearTimeout(this._t);
    this.game.audio.tapeMotor(false);
    if (!silent) this.game.audio.play("click");
  }

  _play() {
    if (this.spinning) return;
    const gm = this.game, s = gm.state;
    const n = s.inc("tape_plays");
    this.spinning = true;
    gm.audio.play("click");
    gm.audio.tapeMotor(true);

    if (n === 1 || n === 2) {
      this.sub.textContent = n === 1 ? "Я нажимаю «Пуск». Ничего. Только шорох." : "Стоп. Снова «Пуск». Ничего.";
      this._roll(1800, () => { this._stop(true); });
      return;
    }
    if (n === 3) {
      this.sub.textContent = "Третий раз. Лента доходит до ракорда…";
      this._roll(2600, () => {
        this._stop(true);
        this.counter = 19880414;
        gm.audio.play("voiceTape");
        const lines = [
          "«Запомни цифры. Это дверь. 1-9-8-8-0-4-1-4. Это пароль архива.»",
          "«Лёша, если ты это слышишь — ты уже мёртв. Но это не значит, что ты не можешь выбрать.»",
        ];
        this.sub.textContent = lines[0];
        setTimeout(() => { if (this.isOpen) this.sub.textContent = lines[1]; }, 4200);
        setTimeout(() => {
          s.set("tape_code");
          s.learn("code");
          gm.hud.say("Мой голос. Но не мой. С задержкой в полторы секунды. 19880414. Дата. Моя смерть. Мой пароль.");
        }, 4600);
      }, true);
      return;
    }
    // Четвёртый раз.
    this.sub.textContent = "Плёнка натягивается…";
    this._roll(1200, () => {
      this._stop(true);
      gm.audio.play("tapeTear");
      this.sub.textContent = "Хлопок. Плёнка рвётся. Тишина.";
      setTimeout(() => {
        this.close();
        s.setCount("tape_plays", 0);
        gm.die("Плёнка рвётся. И тогда — тишина. И тогда — новый цикл. А начало — это больно.");
      }, 1200);
    });
  }

  _roll(ms, done, toCode = false) {
    const start = performance.now(), from = this.counter;
    const step = () => {
      if (!this.spinning) return;
      const k = Math.min(1, (performance.now() - start) / ms);
      this.counter = toCode ? Math.floor(from + (19880414 - from) * (k * k)) : Math.floor(from + k * 137);
      if (k < 1) this._t = setTimeout(step, 30);
      else done();
    };
    step();
  }

  _draw() {
    const c = this.ctx, W = this.cv.width, H = this.cv.height;
    c.fillStyle = "#2e2e2c"; c.fillRect(0, 0, W, H);
    c.fillStyle = "#3c3c3a"; c.fillRect(16, 16, W - 32, H - 32);
    if (this.spinning) this.angle += 0.12;
    const reel = (x, y, r) => {
      c.save(); c.translate(x, y); c.rotate(this.angle);
      c.fillStyle = "#a8a8a0"; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#4a3a2a"; c.beginPath(); c.arc(0, 0, r * 0.82, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#3c3c3a";
      for (let i = 0; i < 3; i++) { c.rotate(Math.PI * 2 / 3); c.beginPath(); c.arc(r * 0.45, 0, r * 0.18, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = "#1a1a1a"; c.beginPath(); c.arc(0, 0, 10, 0, Math.PI * 2); c.fill();
      c.restore();
    };
    reel(190, 150, 105);
    reel(570, 150, 105);
    c.strokeStyle = "#5a4030"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(190, 255); c.lineTo(380, 290); c.lineTo(570, 255); c.stroke();
    c.fillStyle = "#1a1a1a"; c.fillRect(350, 278, 60, 24);
    // механический счётчик
    const digits = String(this.counter).padStart(8, "0").slice(-8);
    c.fillStyle = "#101010"; c.fillRect(W / 2 - 132, 26, 264, 54);
    c.font = `600 38px ${FONTS.mono}`; c.textAlign = "center"; c.textBaseline = "middle";
    for (let i = 0; i < 8; i++) {
      c.fillStyle = "#e8e2d0"; c.fillRect(W / 2 - 126 + i * 32, 32, 28, 42);
      c.fillStyle = "#1a1a1a"; c.fillText(digits[i], W / 2 - 112 + i * 32, 54);
    }
    c.fillStyle = "#c8c0a8"; c.font = `500 20px ${FONTS.sans}`;
    c.fillText("МАЯК-205 · СТЕРЕО", W / 2, H - 30);
  }
}
