// Диалоговое окно с эффектом печатной машинки.

export class DialogueBox {
  constructor() {
    this.root     = document.getElementById("dialogue");
    this.elSpeaker = document.getElementById("dialogue-speaker");
    this.elBody    = document.getElementById("dialogue-body");
    this.fullText = "";
    this.typed = "";
    this.charTimer = 0;
    this.charDelay = 0.022;
    this.autoHideAt = 0;
    this.duration = 0;
    this.visible = false;
  }

  show(text, speaker = "", duration = 5) {
    this.root.classList.remove("hidden");
    this.visible = true;
    this.elSpeaker.textContent = speaker;
    this.fullText = text;
    this.typed = "";
    this.charTimer = 0;
    this.duration = duration;
    this.autoHideAt = 0;
    this.elBody.textContent = "";
  }

  hide() {
    this.root.classList.add("hidden");
    this.visible = false;
    this.fullText = "";
    this.typed = "";
  }

  skip() {
    if (this.typed !== this.fullText) {
      this.typed = this.fullText;
      this.elBody.textContent = this.typed;
      this.autoHideAt = performance.now() + this.duration * 1000;
    }
  }

  update(dt) {
    if (!this.visible) return;

    if (this.typed !== this.fullText) {
      this.charTimer -= dt;
      if (this.charTimer <= 0) {
        this.typed = this.fullText.slice(0, this.typed.length + 1);
        this.elBody.textContent = this.typed;
        this.charTimer = this.charDelay;
      }
    } else {
      if (this.autoHideAt === 0) {
        this.autoHideAt = performance.now() + this.duration * 1000;
      } else if (performance.now() > this.autoHideAt) {
        this.hide();
      }
    }
  }
}
