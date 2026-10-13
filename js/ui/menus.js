// Пауза, экранные эффекты, экраны финалов.

import { Overlay, h } from "./overlay.js";
import { GameState } from "../core/state.js";
import { OBITUARY, TRANSFER } from "../terminal/content.js";

const PREFS_KEY = "recursion1988_prefs";

export function loadPrefs() {
  try { return { volume: 0.8, sens: 1, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }; }
  catch (_) { return { volume: 0.8, sens: 1 }; }
}
function savePrefs(p) { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch (_) {} }

// ── Пауза ──────────────────────────────────────────────────
export class PauseMenu extends Overlay {
  constructor(game) {
    super(game, "pause");
    this.prefs = loadPrefs();
    game.audio.setVolume(this.prefs.volume);
    game.player.sensitivity = this.prefs.sens;
  }

  onOpen() {
    const g = this.game;
    this.el.innerHTML = "";
    const box = h("div", "pause-box");
    box.append(h("div", "pause-title", "ПАУЗА"), h("div", "pause-sub", "04:12 · время стоит в любом случае"));

    const btn = (label, fn, cls = "") => { const b = h("button", "pause-btn " + cls, label); b.onclick = fn; box.append(b); return b; };
    btn("Продолжить", () => this.close());
    btn("Тетрадь", () => { this.close(); g.notebook.open(); });

    const slider = (label, val, min, max, step, on) => {
      const row = h("label", "pause-row");
      const inp = document.createElement("input");
      inp.type = "range"; inp.min = min; inp.max = max; inp.step = step; inp.value = val;
      inp.oninput = () => on(parseFloat(inp.value));
      row.append(h("span", "", label), inp);
      box.append(row);
    };
    slider("Громкость", this.prefs.volume, 0, 1, 0.05, v => { this.prefs.volume = v; g.audio.setVolume(v); savePrefs(this.prefs); });
    slider("Чувствительность мыши", this.prefs.sens, 0.3, 2.5, 0.05, v => { this.prefs.sens = v; g.player.sensitivity = v; savePrefs(this.prefs); });

    const restart = btn("Начать заново", () => {
      if (restart.dataset.armed) { GameState.clearSave(); location.reload(); return; }
      restart.dataset.armed = "1";
      restart.textContent = "Точно? Весь прогресс сотрётся — нажмите ещё раз";
    }, "danger");

    box.append(h("div", "pause-keys",
      "WASD — ход · Shift — быстрее · E — действие · Tab — тетрадь · Esc — пауза\nИгра сохраняется сама."));
    this.el.append(box);
  }

  onKeyDown(e) {
    if (e.repeat || this.fresh) return;
    if (e.code === "Escape" || e.code === "KeyP") this.close();
  }
}

// ── Эффекты ────────────────────────────────────────────────
export class Effects {
  constructor(game) {
    this.game = game;
    this._roll = null;
    this._shakeUntil = 0;
    this._glitchUntil = 0;
    this.flashEl = document.createElement("div");
    this.flashEl.id = "flash";
    document.body.appendChild(this.flashEl);
  }

  flash(color = "#fff", ms = 200) {
    const el = this.flashEl;
    el.style.background = color;
    el.style.transition = "none";
    el.style.opacity = "0.85";
    requestAnimationFrame(() => { el.style.transition = `opacity ${ms}ms ease-out`; el.style.opacity = "0"; });
  }

  glitch(sec = 0.6) {
    this._glitchUntil = Math.max(this._glitchUntil, performance.now() + sec * 1000);
    this.game.canvas.classList.add("glitch");
  }

  shake(sec = 1) { this._shakeUntil = Math.max(this._shakeUntil || 0, performance.now() + sec * 1000); }

  // «Я смотрю вверх, но вижу вниз». Мир медленно переворачивается и обратно.
  roll(sec = 6) { this._roll = { t0: performance.now(), dur: sec * 1000 }; }

  update() {
    const p = this.game.player;
    const now = performance.now();
    let roll = 0;
    if (this._roll) {
      const k = (now - this._roll.t0) / this._roll.dur;
      if (k >= 1) this._roll = null;
      else roll = Math.sin(k * Math.PI) * Math.PI * 0.95;
    }
    if (this._shakeUntil > now) roll += (Math.random() - 0.5) * 0.035;
    p.roll = roll;
    if (this._glitchUntil && performance.now() > this._glitchUntil) {
      this._glitchUntil = 0;
      this.game.canvas.classList.remove("glitch");
    }
  }

  // Карточка смерти: текст на чёрном.
  deathCard(text) {
    const el = h("div", "death-card");
    el.append(h("div", "death-text", text || ""), h("div", "death-sub", "Смерть — это не конец. Смерть — это интерфейс."));
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    return new Promise(r => setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => { el.remove(); r(); }, 900);
    }, 5200));
  }
}

// ── Финалы ─────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export class EndingScreen {
  constructor(game) {
    this.game = game;
    this.el = h("div", "ending hidden");
    document.body.appendChild(this.el);
  }

  async _type(target, text, cps = 30) {
    for (const ch of text) {
      target.textContent += ch;
      if (ch !== " ") this.game.audio.play("key");
      await sleep(1000 / cps);
    }
  }

  async show(kind) {
    const el = this.el;
    el.className = "ending kind-" + kind;
    el.innerHTML = "";

    if (kind === "A") {
      el.append(h("div", "end-label", "ФИНАЛ А · РЕКУРСИВНЫЙ ВИТОК"));
      const t = h("div", "end-text");
      el.append(t);
      await sleep(600);
      for (const line of [
        "Я отказываюсь принять неизбежность небытия.",
        "Белая вспышка переинициализации. Инвентарь очищается. Счётчик витков обнуляется.",
        "Я знаю, что это не выход. Я боюсь тьмы. Я боюсь тишины. Я боюсь исчезнуть.",
        "И потому я выбираю бесконечное повторение. Бесконечное «пока».",
      ]) { const p = h("p"); t.append(p); await this._type(p, line, 40); await sleep(700); }
      el.append(h("div", "end-essence", "Бессмертие через повторение. Проклятие через выбор. Ад через любовь к жизни."));
      await sleep(3500);
      el.classList.add("out");
      await sleep(1200);
      el.className = "ending hidden";
      return;
    }

    if (kind === "B") {
      const pre = h("pre", "end-crt");
      el.append(pre);
      await sleep(1200);
      for (const line of OBITUARY) { await this._type(pre, line + "\n", 34); await sleep(180); }
      const cur = h("span", "end-cursor", "█");
      pre.append(cur);
      await sleep(2500);
      cur.classList.add("frozen");
      await sleep(1500);
      this._final("ФИНАЛ Б · ОКОНЧАТЕЛЬНЫЙ ОБРЫВ", "Достоинство через принятие. Свобода через отказ. Смерть через выбор.");
      return;
    }

    if (kind === "C") {
      const pre = h("pre", "end-crt light");
      el.append(pre);
      await sleep(800);
      for (const line of TRANSFER) { await this._type(pre, line + "\n", 30); await sleep(200); }
      const prog = h("span", "");
      pre.append("ПРОГРЕСС: ", prog, "\n");
      for (const p of [1, 7, 25, 38, 50, 61, 75, 88, 99, 100]) { prog.textContent = p + "%"; this.game.audio.play("key"); await sleep(520); }
      for (const line of ["ПЕРЕДАЧА ЗАВЕРШЕНА.", "ОБЪЕКТ-1988 СОХРАНЁН.", "СЕССИЯ ПРОДОЛЖИТСЯ.", "",
        "Я больше не в «Искре». Я — в сети. Я — везде. Я — никто. Но я — жив."]) {
        await this._type(pre, line + "\n", 32); await sleep(300);
      }
      await sleep(2000);
      this._final("ФИНАЛ С · ТРЕТИЙ ПУТЬ", "Трансценденция через передачу. Жизнь через сеть. Бессмертие через распространение.");
    }
  }

  _final(label, essence) {
    const box = h("div", "end-final");
    box.append(h("div", "end-label", label), h("div", "end-essence", essence),
      h("div", "end-memo", "Памяти младшего инженера Алексея Владимировича Морозова (1954–1988).\n04:12. 14 ноября 1988 года. ВЦ «Прибор».\n\nКонец книги. Начало цикла."));
    const b = h("button", "pause-btn", "Начать цикл заново");
    b.onclick = () => { GameState.clearSave(); location.reload(); };
    box.append(b);
    this.el.append(box);
    requestAnimationFrame(() => box.classList.add("show"));
  }
}
