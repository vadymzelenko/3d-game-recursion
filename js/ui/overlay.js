// Базовое окно поверх мира. Открытое окно забирает ввод (см. core/input.js),
// отпускает курсор мыши и закрывается по Esc.

const root = () => document.getElementById("overlay-root");

export class Overlay {
  constructor(game, cls = "") {
    this.game = game;
    this.el = document.createElement("div");
    this.el.className = "overlay " + cls;
    this.isOpen = false;
    this._openedAt = 0;
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this._openedAt = performance.now();
    root().appendChild(this.el);
    requestAnimationFrame(() => this.el.classList.add("show"));
    this.game.input.push(this);
    this.game.hud.setPrompt("");
    this.onOpen?.();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.remove("show");
    const el = this.el;
    setTimeout(() => { if (!this.isOpen) el.remove(); }, 260);
    this.game.input.pop(this);
    this.onClose?.();
  }

  // Защита от того, что та же нажатая клавиша, которая открыла окно,
  // тут же его и закроет.
  get fresh() { return performance.now() - this._openedAt < 220; }

  onKeyDown(e) {
    if (e.repeat || this.fresh) return;
    if (e.code === "Escape") this.close();
  }
}

export function h(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}
