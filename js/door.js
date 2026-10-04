// Дверь-аномалия. Первые 2 открытия всегда зацикливают.
// С 3-го — 50% на возврат в комнату, 50% на проход.
// Используется ТОЛЬКО для главного выхода из квартиры (петля времени).
// Обычные двери соседей — простые Interactable с переходом сцены (см. hallway.js).

import { Interactable } from "./interactable.js";

export class AnomalyDoor extends Interactable {
  constructor(game, mesh, { label = "Дверь", targetScene = null, onLoop = null } = {}) {
    super(mesh, `Открыть: ${label}`, () => this.interact());
    this.game = game;
    this.label = label;
    this.targetScene = targetScene;
    this.onLoop = onLoop;   // () => void  — вызывается при «возврате в ту же комнату»
    this.attempts = 0;
  }

  interact() {
    this.attempts += 1;
    const gm = this.game;

    // Первое открытие — «пустота» (атмосферная реплика)
    if (this.attempts === 1) {
      gm.hud.showMessage(
        "За дверью — абсолютная пустота. Ни стен, ни пола. Только серый шум.",
        5000,
      );
      gm.audio.play("glitch");
      this._nudge();
      return;
    }

    // Второе — гарантированный «возврат в ту же комнату»
    if (this.attempts === 2) {
      gm.hud.showMessage(
        "Ты открываешь дверь… и снова оказываешься в этой же комнате.\n" +
        "Только часы на стене теперь показывают 04:13.",
        6000,
      );
      gm.audio.play("glitch");
      this._nudge();
      if (this.onLoop) this.onLoop();
      return;
    }

    // С третьего открытия — 50/50
    const roll = Math.random();
    if (roll < 0.5) {
      gm.hud.showMessage(
        "Дверь снова захлопнулась перед тобой. Ты в той же комнате.",
        5000,
      );
      gm.audio.play("glitch");
      this._nudge();
      if (this.onLoop) this.onLoop();
    } else {
      gm.hud.showMessage("На этот раз дверь поддаётся. Путь в подъезд открыт.");
      gm.audio.play("door");
      if (this.targetScene) {
        gm.fadeTransition(() => gm.changeScene(this.targetScene));
      }
    }
  }

  _nudge() {
    const startZ = this.mesh.position.z;
    this.mesh.position.z -= 0.04;
    setTimeout(() => { this.mesh.position.z = startZ; }, 100);
  }
}
