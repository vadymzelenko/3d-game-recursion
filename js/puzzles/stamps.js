// Акт IV. Штампы «УВОЛЕН» и «ПОСМЕРТНО» на фотографии из личного дела.
// Порядок важен даже здесь: сначала — увольнение, потом — смерть.

import { Overlay, h } from "../ui/overlay.js";

export class StampsPuzzle extends Overlay {
  constructor(game) {
    super(game, "puzzle stamps");
    this.sel = null;
  }

  onOpen() { this.render(); }

  render() {
    const s = this.game.state;
    const el = this.el;
    el.innerHTML = "";
    const file = h("div", "st-file");
    file.append(h("div", "st-head", "ЛИЧНОЕ ДЕЛО № 42\nМОРОЗОВ Алексей Владимирович\nмладший инженер ВЦ «Прибор»"));
    const photo = h("div", "st-photo");
    photo.append(h("div", "st-face"));
    if (s.is("stamp_fired")) photo.append(h("div", "st-mark red", "УВОЛЕН"));
    if (s.is("stamp_dead")) photo.append(h("div", "st-mark blue", "ПОСМЕРТНО"));
    photo.onclick = () => this._apply();
    file.append(photo, h("div", "st-note", "Фото 3×4. Я, молодой, улыбаюсь. Я не помню, чтобы улыбался."));

    const tools = h("div", "st-tools");
    for (const [id, label] of [["fired", "УВОЛЕН"], ["dead", "ПОСМЕРТНО"]]) {
      const b = h("button", "st-stamp " + id + (this.sel === id ? " on" : ""), label);
      b.onclick = () => { this.sel = this.sel === id ? null : id; this.game.audio.play("click"); this.render(); };
      tools.append(b);
    }
    this.sub = h("div", "rd-sub", this._msg || "Металл холодный, как лёд. Что мне с ними делать?");
    el.append(h("div", "pz-title", "Личное дело и штампы"), file, tools, this.sub,
      h("div", "paper-hint", "выберите штамп и щёлкните по фотографии · Esc — закрыть папку"));
  }

  _apply() {
    const gm = this.game, s = gm.state;
    if (!this.sel) { this._msg = "Сначала — штамп."; this.render(); return; }
    if (this.sel === "dead" && !s.is("stamp_fired")) {
      gm.audio.play("stamp");
      this._msg = "Чернила не берут. Нельзя умереть, пока не уволен. Порядок важен даже здесь.";
      this.sel = null; this.render(); return;
    }
    gm.audio.play("stamp");
    s.set(this.sel === "fired" ? "stamp_fired" : "stamp_dead");
    this.sel = null;
    if (s.is("stamp_fired") && s.is("stamp_dead")) {
      this._msg = "Чернила расплываются. Это я? Это то, чем я стал?";
      s.set("stamped");
      gm.hud.say("Я смотрю на то, что получилось. Уволен. Посмертно. Запись в журнале.");
    } else {
      this._msg = "УВОЛЕН. Чернила ложатся на улыбку.";
    }
    this.render();
  }
}
