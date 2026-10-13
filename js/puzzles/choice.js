// Поиск среди одинаковых вещей: полки библиотеки, стеллажи с делами.
// Игрок выбирает один из вариантов; верный открывает находку, неверные
// отвечают своей репликой. Общая заготовка для нескольких актов.

import { Overlay, h } from "../ui/overlay.js";

export class ChoicePuzzle extends Overlay {
  constructor(game) {
    super(game, "puzzle choice");
    this.cfg = null;
  }

  // cfg: { title, intro, note, options: [{id, label, sub, reply}], answer, onSolve, solvedText }
  show(cfg) {
    this.cfg = cfg;
    this.open();
  }

  onOpen() { this.render(); }

  render(msg) {
    const c = this.cfg;
    this.el.innerHTML = "";
    const panel = h("div", "pz-panel choice-panel");
    panel.append(h("div", "pz-title", c.title));
    if (c.note) panel.append(h("div", "choice-note", c.note));
    const grid = h("div", "choice-grid");
    for (const o of c.options) {
      const b = h("button", "choice-item");
      b.append(h("span", "choice-label", o.label));
      if (o.sub) b.append(h("span", "choice-sub", o.sub));
      b.onclick = () => this._pick(o, b);
      grid.append(b);
    }
    panel.append(grid);
    this.status = h("div", "pz-status", msg || c.intro || "");
    this.el.append(panel, this.status, h("div", "paper-hint", "Esc — отойти"));
  }

  _pick(o, btn) {
    const c = this.cfg, gm = this.game;
    if (o.id === c.answer) {
      gm.audio.play("drawer");
      btn.classList.add("right");
      this.status.textContent = c.solvedText || "Нашёл.";
      setTimeout(() => { this.close(); c.onSolve?.(); }, 1100);
      return;
    }
    gm.audio.play("paper");
    btn.classList.add("wrong");
    this.status.textContent = o.reply || "Не то.";
  }
}
