// Кодовый замок с тремя колёсиками (ящик стола вахты).

import { Overlay, h } from "../ui/overlay.js";

export class CodeLock extends Overlay {
  constructor(game) {
    super(game, "puzzle codelock");
    this.cfg = null;
    this.digits = [0, 0, 0];
  }

  // cfg: { title, plate, code: "042", onSolve, hint }
  show(cfg) {
    this.cfg = cfg;
    this.digits = [0, 0, 0];
    this.open();
  }

  onOpen() { this.render(); }

  render() {
    const c = this.cfg;
    this.el.innerHTML = "";
    const panel = h("div", "pz-panel lock-panel");
    panel.append(h("div", "pz-title", c.title));
    const plate = h("div", "lock-plate", c.plate || "");
    const wheels = h("div", "lock-wheels");
    this.digits.forEach((d, i) => {
      const col = h("div", "lock-wheel");
      const up = h("button", "btn lock-btn", "+");
      const dn = h("button", "btn lock-btn", "−");
      const win = h("div", "lock-digit");
      win.append(h("span", "lock-prev", String((d + 9) % 10)), h("span", "lock-cur", String(d)), h("span", "lock-next", String((d + 1) % 10)));
      up.onclick = () => this._turn(i, 1);
      dn.onclick = () => this._turn(i, -1);
      col.append(up, win, dn);
      wheels.append(col);
    });
    const open = h("button", "btn lock-open", "Потянуть ящик");
    open.onclick = () => this._try();
    panel.append(plate, wheels, open);
    this.status = h("div", "pz-status", this._msg || c.hint || "");
    this.el.append(panel, this.status, h("div", "paper-hint", "Esc — отойти"));
  }

  _turn(i, d) {
    this.digits[i] = (this.digits[i] + d + 10) % 10;
    this.game.audio.play("click");
    this._msg = "";
    this.render();
  }

  _try() {
    const c = this.cfg, gm = this.game;
    if (this.digits.join("") === c.code) {
      gm.audio.play("drawer");
      this.close();
      c.onSolve?.();
      return;
    }
    gm.audio.play("locked");
    this._msg = "Ящик не поддаётся. Замок щёлкает впустую.";
    this.render();
  }

  onKeyDown(e) {
    super.onKeyDown(e);
    if (/^Digit\d$/.test(e.code) && !this.fresh) {
      this.digits.shift(); this.digits.push(+e.code.slice(5));
      this.game.audio.play("click");
      this.render();
    }
    if (e.code === "Enter" && !this.fresh) this._try();
  }
}
