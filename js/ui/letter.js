export class LetterUI {
  constructor() {
    this.root    = document.getElementById("letter");
    this.elTitle = document.getElementById("letter-title");
    this.elBody  = document.getElementById("letter-body");
    this.visible = false;
    this.onClose = null;
    this._openedAt = 0;

    // На тач-устройствах письмо закрывается тапом по любому месту.
    // Клавиатурное закрытие остаётся в Game._bindEvents().
    this.root.addEventListener("click", () => this._tapClose());
    this.root.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this._tapClose();
    }, { passive: false });
  }

  _tapClose() {
    if (!this.visible) return;
    if (performance.now() - this._openedAt < 250) return;   // защита от «двойного» тапа
    if (this.onClose) this.onClose();
  }

  show(title, text) {
    this.elTitle.textContent = title;
    this.elBody.textContent = text;
    this.root.classList.remove("hidden");
    this.visible = true;
    this._openedAt = performance.now();
  }

  hide() {
    this.root.classList.add("hidden");
    this.visible = false;
  }
}