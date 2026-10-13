// ЗАГАДКА №1. Шахматный этюд «Обоюдный цугцванг 1988».
// Белые: Кр g7, п. h6. Чёрные: Кр g5, п. h7. Ход чёрных.
// Любой ход по правилам — мат и откат со звуком аналогового сбоя.
// Решение: вынести чёрного короля за пределы сетки — на формуляр.
//
// Управление: щёлкнуть по чёрной фигуре и затем по клетке (или по
// формуляру) — либо просто перетащить фигуру.

import { Overlay, h } from "../ui/overlay.js";

const FILES = "abcdefgh";
const START = {
  g7: { t: "K", w: true }, h6: { t: "P", w: true },
  g5: { t: "K", w: false }, h7: { t: "P", w: false },
};
// Куда фигура может «пойти» по правилам (всё равно ведёт к мату).
const MOVES = {
  g5: ["f4", "g4", "h4", "f5", "h5", "f6", "g6", "h6"],
  h7: ["h6", "h5"],
};
const MATE_LINES = {
  f5: "Король на f5. Белая пешка бьёт на g6. Шах. Мат.",
  h5: "Король на h5. Белая пешка бьёт на g6. Шах. Мат.",
  h6: "Пешка h7–h6. Белая пешка проходит в ферзи. Мат.",
  h5p: "Пешка h7–h5. Белая пешка проходит в ферзи. Мат.",
};
const HINTS = [
  "Фигура возвращается на место. Скрежет плёнки, которую резко остановили.",
  "Снова мат. Правила не работают. Правила — это ловушка.",
  "Рукопись: «Спасение лежит за пределами сетки». Формуляр лежит рядом с доской.",
];

// Фигуры нарисованы вектором — никаких символов шрифта.
function pieceSVG(type, white) {
  const fill = white ? "#efe6d2" : "#1d1915";
  const line = white ? "#2a2016" : "#b89e70";
  const body = type === "K"
    ? `<path d="M28 82 Q30 61 38 47 L62 47 Q70 61 72 82 Z"/>
       <rect x="33" y="39" width="34" height="9" rx="3"/>
       <path d="M35 40 Q50 22 65 40 Z"/>
       <rect x="47" y="6" width="6" height="22" rx="1.5"/>
       <rect x="40" y="12" width="20" height="6" rx="1.5"/>`
    : `<path d="M31 82 Q34 60 44 51 L56 51 Q66 60 69 82 Z"/>
       <rect x="36" y="44" width="28" height="8" rx="3"/>
       <circle cx="50" cy="31" r="13"/>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <g fill="${fill}" stroke="${line}" stroke-width="2.4" stroke-linejoin="round">
      <ellipse cx="50" cy="90" rx="31" ry="4" fill="rgba(0,0,0,0.25)" stroke="none"/>
      <rect x="20" y="81" width="60" height="9" rx="3"/>
      ${body}
    </g></svg>`;
}

export class ChessPuzzle extends Overlay {
  constructor(game) {
    super(game, "puzzle chess");
    this.tries = 0;
    this.sel = null;
    this.busy = false;
  }

  get solved() { return this.game.state.has("punchcard"); }

  onOpen() {
    this.sel = null;
    this.busy = false;
    this.render();
    if (this.solved) {
      this.say("Король лежит на формуляре, за пределами сетки. Тайник в торце столика пуст.");
    } else if (!this.game.state.is("chess_seen")) {
      this.game.state.set("chess_seen");
      this.say("Я узнаю позицию. Обоюдный цугцванг. Ход чёрных — мой ход. Любой ход ведёт к мату.");
    } else {
      this.say(this.tries ? HINTS[Math.min(this.tries, HINTS.length) - 1] : "Ход чёрных.");
    }
  }

  say(t) { if (this.log) this.log.textContent = t; }

  render() {
    const el = this.el;
    el.innerHTML = "";
    el.append(
      h("div", "pz-title", "Резной дубовый столик · ход чёрных"),
      h("div", "ch-howto", this.solved ? "Этюд решён." : "Щёлкните по чёрной фигуре, затем — куда её поставить. Или перетащите."),
    );

    const wrap = h("div", "ch-wrap");
    const frame = h("div", "ch-frame");
    const board = h("div", "ch-board");
    this.board = board;
    for (let r = 7; r >= 0; r--) {
      for (let f = 0; f < 8; f++) {
        const id = FILES[f] + (r + 1);
        const sq = h("div", "ch-sq " + ((r + f) % 2 ? "light" : "dark"));
        sq.dataset.sq = id;
        const pc = START[id];
        const removed = this.solved && id === "g5";
        if (pc && !removed) sq.append(this._piece(pc.t, pc.w, id));
        sq.addEventListener("click", () => this._clickSquare(id));
        board.append(sq);
      }
    }
    // Координаты по краям рамки.
    const files = (cls) => { const d = h("div", "ch-coord " + cls); for (const c of FILES) d.append(h("span", "", c)); return d; };
    const ranks = (cls) => { const d = h("div", "ch-coord " + cls); for (let r = 8; r >= 1; r--) d.append(h("span", "", String(r))); return d; };
    frame.append(files("top"), ranks("left"), board, ranks("right"), files("bottom"));

    // Формуляр — лежит на столике рядом с доской.
    const card = h("div", "ch-card" + (this.solved ? " solved" : "") + (this.tries >= 3 && !this.solved ? " hint" : ""));
    card.append(
      h("div", "ch-card-title", "Читательский формуляр № 1988-042"),
      h("div", "ch-card-body", "Морозов А. В.\nВЦ «Прибор»\nВсе книги возвращены\n14.11.1988"),
      h("div", "ch-card-stamp", "ВОЗВРАЩЕНО"),
    );
    const drop = h("div", "ch-card-drop");
    if (this.solved) drop.innerHTML = pieceSVG("K", false);
    card.append(drop);
    card.addEventListener("click", () => this._clickCard());
    this.card = card;

    const side = h("div", "ch-side");
    side.append(card, h("div", "ch-manuscript" + (this.tries >= 2 ? " lit" : ""),
      "«…любой ход чёрных ведёт к немедленному мату после вскрытия диагонали. Спасение лежит за пределами сетки»."),
      h("div", "ch-manuscript-sig", "из рукописи А. В. Морозова"));

    wrap.append(frame, side);
    this.log = h("div", "ch-log");
    el.append(wrap, this.log, h("div", "paper-hint", "Esc — встать из-за столика"));
  }

  _piece(type, white, id) {
    const p = h("div", "ch-pc " + (white ? "w" : "b"));
    p.innerHTML = pieceSVG(type, white);
    if (!white && !this.solved) {
      p.classList.add("own");
      this._drag(p, id, type);
    }
    return p;
  }

  _select(id) {
    this.sel = id;
    for (const sq of this.board.children) {
      sq.classList.toggle("sel", sq.dataset.sq === id);
      sq.classList.toggle("move", !!id && (MOVES[id] || []).includes(sq.dataset.sq));
    }
    this.card.classList.toggle("target", id === "g5");
    if (id) this.game.audio.play("click");
  }

  _clickSquare(id) {
    if (this.busy || this.solved) return;
    if (START[id] && !START[id].w) { this._select(this.sel === id ? null : id); return; }
    if (!this.sel) { this.say("Ход чёрных. Сначала выберите чёрную фигуру."); return; }
    const from = this.sel;
    this._select(null);
    this._move(from, id);
  }

  _clickCard() {
    if (this.busy || this.solved) return;
    if (!this.sel) { this.say("Формуляр. Мои книги, все возвращены в один день."); return; }
    const from = this.sel;
    this._select(null);
    this._toCard(from);
  }

  _drag(p, from, type) {
    p.addEventListener("pointerdown", (e) => {
      if (this.busy) return;
      e.preventDefault();
      const r0 = p.getBoundingClientRect();
      const sx = e.clientX, sy = e.clientY;
      let ghost = null;
      const move = (ev) => {
        if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        if (!ghost) {
          ghost = p.cloneNode(true);
          ghost.className = "ch-pc b ghost";
          ghost.style.width = r0.width + "px";
          ghost.style.height = r0.height + "px";
          document.body.appendChild(ghost);
          p.classList.add("lifted");
          this._select(from);
        }
        ghost.style.left = (ev.clientX - r0.width / 2) + "px";
        ghost.style.top = (ev.clientY - r0.height * 0.6) + "px";
      };
      const up = (ev) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (!ghost) return;   // это был щелчок — его обработает клетка
        ghost.remove();
        p.classList.remove("lifted");
        const t = document.elementFromPoint(ev.clientX, ev.clientY);
        this._select(null);
        const sq = t && t.closest(".ch-sq");
        if (t && t.closest(".ch-card")) this._toCard(from);
        else if (sq && sq.dataset.sq !== from) this._move(from, sq.dataset.sq);
        else if (!sq && !t?.closest(".ch-frame")) this._toCard(from, true);   // за край — тоже за пределы
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  }

  // Вне доски.
  _toCard(from, offBoard = false) {
    const gm = this.game;
    if (START[from].t !== "K") {
      gm.audio.play("glitch");
      this.say("Пешка — не я. Пешка возвращается на h7.");
      return;
    }
    if (offBoard) {
      this.say("Король повисает над краем стола… Его нужно куда-то положить. Рядом лежит формуляр.");
      this.card.classList.add("target");
      setTimeout(() => this.card?.classList.remove("target"), 1600);
      return;
    }
    this.busy = true;
    gm.audio.play("relay");
    this.board.querySelector(`[data-sq="${from}"]`)?.replaceChildren();
    this.card.classList.add("solved");
    this.card.querySelector(".ch-card-drop").innerHTML = pieceSVG("K", false);
    this.say("Сухой щелчок. В торце столика открывается тайник. Внутри — перфокарта.");
    setTimeout(() => {
      this.close();
      gm.state.give("punchcard");
      gm.state.learn("outside");
      gm.state.learn("freq");
      gm.hud.sequence([
        "На перфокарте — расчёт несущей волны: 404 кГц.",
        "Я сломал правило. Я вышел за пределы сетки. Я не выиграл. Я не проиграл.",
        "404. Граффити в сорок первой: «4·0·4». Это не совпадение. Это код. Это дверь.",
      ]);
    }, 1900);
  }

  // Ход по доске — всегда мат и откат.
  _move(from, to) {
    const gm = this.game;
    const type = START[from].t;
    if (START[to]?.t && !START[to].w) return;
    this.busy = true;
    this.tries += 1;
    const sq = this.board.querySelector(`[data-sq="${to}"]`);
    const origin = this.board.querySelector(`[data-sq="${from}"]`);
    sq.replaceChildren(this._piece(type, false, to));
    origin.replaceChildren();
    const key = type === "P" && to === "h5" ? "h5p" : to;
    this.say(MATE_LINES[key] || `${type === "K" ? "Король" : "Пешка"} ${from}–${to}. Диагональ вскрыта. Мат.`);
    const mate = h("div", "ch-mate", "МАТ");
    this.board.append(mate);
    gm.audio.play("tapeScrape");
    gm.effects.glitch(0.5);
    this.board.classList.add("glitch");
    setTimeout(() => {
      if (!this.isOpen) return;
      const line = this.log.textContent;
      this.render();
      this.say(line + "  " + HINTS[Math.min(this.tries, HINTS.length) - 1]);
      this.busy = false;
    }, 1400);
  }
}
