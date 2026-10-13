// Просмотр документов. У каждого вида свой носитель и шрифт:
//   hand  — тетрадный лист, почерк;
//   typed — машинопись на желтоватой бумаге;
//   form  — казённый бланк;
//   print — книжный текст, описание увиденного.

import { Overlay, h } from "./overlay.js";

export class DocView extends Overlay {
  constructor(game) {
    super(game, "docview");
    this.paper = h("div", "paper");
    this.title = h("div", "paper-title");
    this.body = h("div", "paper-body");
    this.hint = h("div", "paper-hint", "E · Esc — отложить");
    this.paper.append(this.title, this.body);
    this.el.append(this.paper, this.hint);
    this.el.addEventListener("click", () => { if (!this.fresh) this.close(); });
    this._onClose = null;
  }

  show(doc, onClose = null) {
    this.paper.className = "paper kind-" + (doc.kind || "print");
    this.title.textContent = doc.title || "";
    this.body.textContent = doc.body || "";
    this._onClose = onClose;
    this.open();
    this.paper.scrollTop = 0;
    this.game.audio.play("paper");
  }

  onClose() {
    const cb = this._onClose;
    this._onClose = null;
    cb?.();
  }

  onKeyDown(e) {
    if (e.repeat || this.fresh) return;
    if (["Escape", "KeyE", "Space", "Enter", "Tab"].includes(e.code)) {
      e.preventDefault();
      this.close();
    } else if (e.code === "ArrowDown" || e.code === "KeyS") this.paper.scrollTop += 60;
    else if (e.code === "ArrowUp" || e.code === "KeyW") this.paper.scrollTop -= 60;
  }
}
