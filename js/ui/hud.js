// Экранный интерфейс. Любой отсутствующий DOM-элемент не роняет игру.

export class HUD {
  constructor(game) {
    this.game = game;
    this.elHud       = document.getElementById("hud");
    this.elLocation  = document.getElementById("location");
    this.elInventory = document.getElementById("inventory");
    this.elPrompt    = document.getElementById("prompt");
    this.elMessage   = document.getElementById("message");
    this._msgEnd = 0;

    if (!this.elHud) console.warn("HUD: #hud не найден — интерфейс отключён.");
  }

  show() { this.elHud?.classList.remove("hidden"); }
  hide() { this.elHud?.classList.add("hidden"); }

  setLocation(text)   { if (this.elLocation)  this.elLocation.textContent = text; }
  setPrompt(text)     { if (this.elPrompt)    this.elPrompt.textContent = text; }

  showMessage(text, duration = 4000) {
    if (!this.elMessage) return;
    this.elMessage.textContent = text;
    this._msgEnd = performance.now() + duration;
  }

  refreshInventory(items) {
    if (!this.elInventory) return;
    this.elInventory.textContent = items.length === 0
        ? ""
        : "ИНВЕНТАРЬ:\n" + items.map(i => `• ${i}`).join("\n");
  }

  update() {
    if (!this.elMessage) return;
    if (this._msgEnd && performance.now() > this._msgEnd) {
      this.elMessage.textContent = "";
      this._msgEnd = 0;
    }
  }
}