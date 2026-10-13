// HUD: подпись локации, подсказка «[E] …», субтитры-мысли, всплывающие
// уведомления о предметах и записях, карточки актов, затемнение.

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(game) {
    this.game = game;
    this.root = $("hud");
    this.elLoc = this.root.querySelector(".loc-room");
    this.elPrompt = $("prompt");
    this.elCap = $("caption");
    this.elWho = this.elCap.querySelector(".cap-who");
    this.elText = this.elCap.querySelector(".cap-text");
    this.elToasts = $("toasts");
    this.elClick = $("click-hint");
    this.elAct = $("act-card");
    this.elFade = $("fade");

    this._queue = [];
    this._capUntil = 0;
    this._capTimer = 0;
    this._lastLoc = "";
  }

  show() { this.root.classList.remove("hidden"); }
  hide() { this.root.classList.add("hidden"); }

  setLocation(text) {
    if (text === this._lastLoc) return;
    this._lastLoc = text;
    this.elLoc.textContent = text;
    this.elLoc.classList.remove("flash");
    void this.elLoc.offsetWidth;
    this.elLoc.classList.add("flash");
  }

  setPrompt(text) {
    if (this._prompt === text) return;
    this._prompt = text;
    if (!text) { this.elPrompt.textContent = ""; this.elPrompt.classList.remove("on"); return; }
    this.elPrompt.innerHTML = "";
    const k = document.createElement("span");
    k.className = "key"; k.textContent = "E";
    const t = document.createElement("span");
    t.textContent = text;
    this.elPrompt.append(k, t);
    this.elPrompt.classList.add("on");
  }

  setClickHint(on) { this.elClick.classList.toggle("hidden", !on); }

  // ── Субтитры ──────────────────────────────────────────────
  // style: thought (мысль Морозова), voice (чужой голос), system
  say(text, { who = "", ms = 0, style = "thought", queue = false } = {}) {
    const item = { text, who, style, ms: ms || Math.min(9000, 2200 + text.length * 48) };
    if (queue && (this._capUntil > performance.now() || this._queue.length)) {
      this._queue.push(item);
      return;
    }
    this._queue = [];
    this._showCaption(item);
  }

  // Несколько реплик подряд.
  sequence(lines) {
    this._queue = [];
    lines.forEach((l, i) => {
      const [text, opts = {}] = Array.isArray(l) ? l : [l];
      if (i === 0) this.say(text, opts);
      else this.say(text, { ...opts, queue: true });
    });
  }

  clearCaptions() {
    this._queue = [];
    this._capUntil = 0;
    this.elCap.classList.remove("on");
  }

  _showCaption({ text, who, style, ms }) {
    this.elCap.className = "on " + style;
    this.elWho.textContent = who;
    this.elWho.style.display = who ? "" : "none";
    this.elText.textContent = text;
    this._capUntil = performance.now() + ms;
  }

  // ── Уведомления ───────────────────────────────────────────
  toast(title, text, kind = "item") {
    const el = document.createElement("div");
    el.className = "toast " + kind;
    const h = document.createElement("div"); h.className = "toast-title"; h.textContent = title;
    const b = document.createElement("div"); b.className = "toast-text"; b.textContent = text;
    el.append(h, b);
    this.elToasts.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 600); }, 4200);
  }

  // ── Карточка акта ─────────────────────────────────────────
  actCard(act, onDone) {
    const el = this.elAct;
    el.querySelector(".act-num").textContent = "АКТ " + act.roman;
    el.querySelector(".act-title").textContent = act.title;
    el.querySelector(".act-epigraph").textContent = act.epigraph || "";
    el.classList.remove("hidden", "out");
    void el.offsetWidth;
    el.classList.add("in");
    this.game.audio.play("actCard");
    clearTimeout(this._actT);
    this._actT = setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => { el.classList.add("hidden"); el.classList.remove("in", "out"); onDone?.(); }, 1200);
    }, 5200);
  }

  // ── Затемнение ────────────────────────────────────────────
  fade(toBlack, ms = 600, color = "#000") {
    const el = this.elFade;
    el.style.background = color;
    el.style.transitionDuration = ms + "ms";
    el.classList.toggle("on", toBlack);
    return new Promise(r => setTimeout(r, ms));
  }

  update() {
    const now = performance.now();
    if (this._capUntil && now > this._capUntil) {
      this._capUntil = 0;
      if (this._queue.length) this._showCaption(this._queue.shift());
      else this.elCap.classList.remove("on");
    }
  }
}
