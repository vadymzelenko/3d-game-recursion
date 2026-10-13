// Менеджер ввода со стеком слоёв.
//
// Пока стек пуст — ввод получает игровой мир (движение, взаимодействие).
// Любое окно (записка, терминал, головоломка, пауза) кладёт себя в стек
// и получает клавиши первым; миру в это время ничего не достаётся, а
// зажатые клавиши движения сбрасываются, чтобы персонаж не «уезжал».

export class Input {
  constructor(game) {
    this.game = game;
    this.layers = [];
    this.keys = Object.create(null);
    this._wantLock = false;

    window.addEventListener("keydown", (e) => this._down(e));
    window.addEventListener("keyup", (e) => { this.keys[e.code] = false; });
    window.addEventListener("blur", () => this.releaseAll());

    document.addEventListener("pointerlockchange", () => this._lockChanged());
    document.addEventListener("mousemove", (e) => {
      if (this.locked && this.gameplay) this.game.player.onMouseMove(e.movementX, e.movementY);
    });
    game.canvas.addEventListener("click", () => {
      if (this.gameplay && !this.locked && !this.game.touch?.enabled) this.lock();
    });
  }

  get top() { return this.layers[this.layers.length - 1] || null; }
  get gameplay() { return this.layers.length === 0 && this.game.running; }
  get locked() { return document.pointerLockElement === this.game.canvas; }

  push(layer) {
    if (this.layers.includes(layer)) return;
    this.layers.push(layer);
    this.releaseAll();
    if (!layer.keepLock) this.unlock();
  }

  pop(layer) {
    const i = this.layers.indexOf(layer);
    if (i < 0) return;
    this.layers.splice(i, 1);
    if (this.gameplay) this.lock();
  }

  releaseAll() {
    for (const k in this.keys) this.keys[k] = false;
  }

  lock() {
    if (this.game.touch?.enabled) return;
    this._wantLock = true;
    try {
      const p = this.game.canvas.requestPointerLock?.();
      if (p && p.catch) p.catch(() => {});
    } catch (_) { /* браузер может отказать без жеста пользователя */ }
  }

  unlock() {
    this._wantLock = false;
    if (document.pointerLockElement) document.exitPointerLock?.();
  }

  _lockChanged() {
    // Курсор отпустили не мы (Esc в браузере) — ставим игру на паузу.
    if (!this.locked && this._wantLock && this.gameplay) {
      this._wantLock = false;
      this.game.pause();
    }
    this.game.hud?.setClickHint(this.gameplay && !this.locked && !this.game.touch?.enabled);
  }

  _down(e) {
    const top = this.top;
    if (top) {
      if (top.onKeyDown) top.onKeyDown(e);
      return;
    }
    if (!this.game.running) return;

    // Tab по умолчанию уводит фокус — нам он нужен для тетради.
    if (e.code === "Tab") e.preventDefault();
    this.keys[e.code] = true;
    if (e.repeat) return;

    switch (e.code) {
      case "KeyE":
      case "Enter":
        this.game.interact();
        break;
      case "Tab":
      case "KeyJ":
        this.game.notebook.open();
        break;
      case "Escape":
      case "KeyP":
        this.game.pause();
        break;
    }
  }
}
