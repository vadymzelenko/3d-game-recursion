// ЗАГАДКА №5 (и вторая половина №7). Электрощит ЩЭ-3201.
//   Акт I: СНАЧАЛА синий предохранитель, ПОТОМ красный рубильник вверх.
//   Акт IX: перемычка ПР-1 между нулевой шиной N и клеммой 3 (по чертежу с gost-1988.su).

import { Overlay, h } from "../ui/overlay.js";

const TERMINALS = ["N", "1", "2", "3"];

export class FuseboxPuzzle extends Overlay {
  constructor(game) {
    super(game, "puzzle fusebox");
    this.fuseIn = false;
    this.pick = null;
    this.shocks = 0;
    this.el.addEventListener("click", (e) => { if (e.target === this.el && !this.fresh) this.close(); });
  }

  open() {
    const s = this.game.state;
    if (!s.has("key_shield") && !s.is("power_on")) {
      this.game.audio.play("locked");
      this.game.hud.say("Щиток ЩЭ-3201 заперт на замок. На бирке: «ЩИТ. ЭТ.4». Нужен ключ от щитовой.");
      return;
    }
    if (!s.is("fusebox_opened")) {
      s.set("fusebox_opened");
      this.game.audio.play("drawer");
    }
    this.fuseIn = s.is("power_on") || s.is("fuse_in");
    this.pick = null;
    super.open();
    this.render();
  }

  render() {
    const s = this.game.state;
    const el = this.el;
    el.innerHTML = "";
    const box = h("div", "fb-box");
    const door = h("div", "fb-door");
    const instr = h("div", "fb-instr hand",
      "ЩИТ. ЭТ.4   ЩЭ-3201\n\nСНАЧАЛА синий предохранитель,\nПОТОМ красный рубильник вверх.");
    instr.title = "Инструкция, приклеенная скотчем";
    door.append(instr);
    instr.onclick = () => {
      s.learn("fuse_order");
      this.game.readDoc("fusebox", () => this.open());
      this.close();
    };
    if (!s.knows("fuse_order")) s.learn("fuse_order");

    const panel = h("div", "fb-panel");

    // Гнездо предохранителя и сам предохранитель.
    const socket = h("div", "fb-socket" + (this.fuseIn ? " full" : ""));
    socket.append(h("span", "fb-cap", "F1"));
    if (this.fuseIn) socket.append(h("div", "fb-fuse in"));
    const tray = h("div", "fb-tray");
    tray.append(h("span", "fb-cap", "в кармане"));
    if (!this.fuseIn && s.has("fuse_blue")) {
      const fuse = h("div", "fb-fuse" + (this.pick === "fuse" ? " picked" : ""));
      fuse.title = "Синий предохранитель";
      fuse.onclick = (e) => { e.stopPropagation(); this.pick = this.pick === "fuse" ? null : "fuse"; this.game.audio.play("click"); this.render(); };
      tray.append(fuse);
    }
    socket.onclick = () => {
      if (this.fuseIn) return;
      if (this.pick !== "fuse") {
        this.status(s.has("fuse_blue")
          ? "Гнездо F1 пустое. Сначала взять предохранитель."
          : "Гнездо F1 пустое: старая пробка сгорела. Нужен запасной синий предохранитель.");
        return;
      }
      this.fuseIn = true; this.pick = null;
      s.take("fuse_blue");
      s.set("fuse_in");
      this.game.audio.play("fuse");
      this.status("Предохранитель входит с сухим щелчком. Лампочка на щитке мигает.");
      this.render();
    };

    // Рубильник.
    const on = s.is("power_on");
    const lever = h("div", "fb-lever" + (on ? " up" : ""));
    lever.append(h("div", "fb-lever-handle"));
    lever.append(h("span", "fb-cap", on ? "ВКЛ" : "ОТКЛ"));
    lever.onclick = () => this._lever();

    const row = h("div", "fb-row");
    row.append(socket, tray, lever);
    panel.append(row);

    // Клеммник с перемычкой ПР-1.
    const block = h("div", "fb-block");
    block.append(h("div", "fb-cap wide", "КЛЕММНИК ВВОДА · ПР-1"));
    const tr = h("div", "fb-terms");
    for (const t of TERMINALS) {
      const b = h("button", "fb-term" + (this.pick === t ? " picked" : ""), t);
      b.onclick = () => this._terminal(t);
      tr.append(b);
    }
    if (s.is("jumper_set")) tr.classList.add("jumped");
    block.append(tr);
    panel.append(block);

    this.statusEl = h("div", "fb-status");
    box.append(door, panel);
    el.append(box, this.statusEl, h("div", "paper-hint", "мышь — действовать · Esc — закрыть щиток"));
    if (this._lastStatus) this.statusEl.textContent = this._lastStatus;
  }

  status(t) { this._lastStatus = t; if (this.statusEl) this.statusEl.textContent = t; }

  _lever() {
    const gm = this.game, s = gm.state;
    if (s.is("power_on")) { this.status("Рубильник поднят. Щиток гудит ровно."); return; }
    if (!this.fuseIn) {
      gm.audio.play("spark");
      gm.effects.flash("#fff6d0", 180);
      this.status("Искры. Дым. Запах горелой изоляции. Свет не зажигается. Рубильник падает обратно. Порядок важен.");
      gm.hud.say("Порядок важен. Если сделать неправильно — не сработает. И более того — сломается.");
      return;
    }
    this.close();
    gm.powerOn();
  }

  _terminal(t) {
    const gm = this.game, s = gm.state;
    if (!s.is("power_on")) { this.status("Клеммник мёртвый. Напряжения нет."); return; }
    if (s.is("jumper_set")) { this.status("Перемычка ПР-1 стоит между N и клеммой 3. Архив открыт."); return; }
    if (s.act < 9) { this.status("Клеммы под напряжением. Без схемы я сюда не полезу."); return; }
    if (!this.pick) { this.pick = t; this.game.audio.play("click"); this.render(); this.status(`Конец перемычки ПР-1 — на клемме «${t}». Куда второй?`); return; }
    const a = this.pick; this.pick = null;
    if (a === t) { this.render(); return; }
    const pair = [a, t].sort().join("-");
    if (pair === "3-N") {
      gm.audio.play("relay");
      s.set("jumper_set");
      s.learn("jumper");
      this.render();
      this.status("Щелчок. Где-то в глубине дома отходит реле. Аппаратная защита снята.");
      gm.hud.sequence([
        ["Он возвращается. Он вводит перемычку. Он разблокирует архив.", { who: "КТО-ТО ВО МНЕ", style: "voice" }],
        "Архив открыт. Личное_дело_42.doc ждёт пароль.",
      ]);
      return;
    }
    this.shocks += 1;
    gm.audio.play("spark");
    gm.effects.flash("#ffffff", 260);
    if (this.shocks >= 2) {
      this.close();
      gm.die("Напряжение ударило в тело. Я знаю это напряжение. Я уже умирал от него.");
      this.shocks = 0;
      return;
    }
    this.render();
    this.status(`Удар током: ${a}–${t}. Пальцы немеют. Это напряжение — не то, к которому я привык. Нужна схема.`);
  }
}
