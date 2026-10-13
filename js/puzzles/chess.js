// ЗАГАДКА №1. Шахматный этюд «Обоюдный цугцванг 1988».
// Белые: Кр g7, п. h6. Чёрные: Кр g5, п. h7. Ход чёрных.
// Любой ход по правилам — мат и откат со звуком аналогового сбоя.
// Решение: вынести чёрного короля за пределы сетки — на формуляр.

import { Overlay, h } from "../ui/overlay.js";

const FILES = "abcdefgh";
const START = {
  g7: { t: "K", w: true }, h6: { t: "P", w: true },
  g5: { t: "K", w: false }, h7: { t: "P", w: false },
};
const GLYPH = { Kw: "♔", Pw: "♙", Kb: "♚", Pb: "♟" };

const MATE_LINES = {
  f5: "Чёрный король на f5. Белая пешка бьёт на g6. Шах. Мат.",
  h5: "Чёрный король на h5. Белая пешка бьёт на g6. Шах. Мат.",
  h6: "Пешка h7–h6. Белая пешка проходит в ферзи. Мат.",
};

export class ChessPuzzle extends Overlay {
  constructor(game) {
    super(game, "puzzle chess");
    this.tries = 0;
  }

  open() {
    if (this.game.state.has("punchcard")) {
      this.game.hud.say("Король стоит на формуляре, за пределами сетки. Тайник пуст.");
      return;
    }
    super.open();
    this.render();
    if (!this.game.state.is("chess_seen")) {
      this.game.state.set("chess_seen");
      this.say("Я узнаю позицию. Обоюдный цугцванг. Ход чёрных. Любой ход ведёт к мату.");
    }
  }

  say(t) { if (this.log) this.log.textContent = t; }

  render() {
    const el = this.el;
    el.innerHTML = "";
    const wrap = h("div", "ch-wrap");
    const boardWrap = h("div", "ch-board-wrap");
    const board = h("div", "ch-board");
    this.board = board;
    for (let r = 7; r >= 0; r--) {
      for (let f = 0; f < 8; f++) {
        const sq = h("div", "ch-sq " + ((r + f) % 2 ? "light" : "dark"));
        sq.dataset.sq = FILES[f] + (r + 1);
        const pc = START[sq.dataset.sq];
        if (pc) {
          const p = h("div", "ch-pc " + (pc.w ? "w" : "b"), GLYPH[pc.t + (pc.w ? "w" : "b")]);
          if (!pc.w) this._draggable(p, sq.dataset.sq, pc.t);
          sq.append(p);
        }
        board.append(sq);
      }
    }
    const coordsF = h("div", "ch-files");
    for (const f of FILES) coordsF.append(h("span", "", f));
    boardWrap.append(board, coordsF);

    const card = h("div", "ch-card");
    card.append(
      h("div", "ch-card-title", "ЧИТАТЕЛЬСКИЙ ФОРМУЛЯР № 1988-042"),
      h("div", "ch-card-body", "Морозов А.В.\nВсе книги возвращены\n14.11.1988"),
      h("div", "ch-card-drop", ""),
    );
    this.card = card;

    const side = h("div", "ch-side");
    side.append(card, h("div", "ch-manuscript hand",
      "«…любой ход чёрных ведёт к немедленному мату после вскрытия диагонали.\nСпасение лежит за пределами сетки»."));

    wrap.append(boardWrap, side);
    this.log = h("div", "ch-log");
    el.append(h("div", "pz-title", "Резной дубовый столик. Ход чёрных."), wrap, this.log,
      h("div", "paper-hint", "перетащите чёрную фигуру · Esc — встать из-за столика"));
  }

  _draggable(p, from, type) {
    p.classList.add("drag");
    p.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      p.setPointerCapture(e.pointerId);
      const r0 = p.getBoundingClientRect();
      const ox = e.clientX - r0.left, oy = e.clientY - r0.top;
      p.classList.add("lift");
      const move = (ev) => {
        p.style.position = "fixed";
        p.style.left = (ev.clientX - ox) + "px";
        p.style.top = (ev.clientY - oy) + "px";
        p.style.width = r0.width + "px";
      };
      move(e);
      const up = (ev) => {
        p.removeEventListener("pointermove", move);
        p.removeEventListener("pointerup", up);
        p.style.visibility = "hidden";
        const target = document.elementFromPoint(ev.clientX, ev.clientY);
        p.style.visibility = "";
        this._drop(type, from, target);
      };
      p.addEventListener("pointermove", move);
      p.addEventListener("pointerup", up);
    });
  }

  _drop(type, from, target) {
    const gm = this.game;
    const sq = target && target.closest && target.closest(".ch-sq");
    const onCard = target && target.closest && target.closest(".ch-card");

    if (onCard && type === "K") {
      gm.audio.play("relay");
      this.card.classList.add("solved");
      this.card.querySelector(".ch-card-drop").textContent = "♚";
      this.board.querySelector(`[data-sq="${from}"]`)?.replaceChildren();
      this.say("Раздаётся сухой щелчок. В торце столика открывается тайник. Внутри — перфокарта.");
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
      }, 1800);
      return;
    }
    if (onCard) {
      gm.audio.play("glitch");
      this.say("Пешка — не я. Пешка возвращается на h7.");
      this.render();
      return;
    }
    if (!sq || sq.dataset.sq === from) { this.render(); return; }

    // Любой ход внутри сетки — мат и откат.
    this.tries += 1;
    const to = sq.dataset.sq;
    const piece = sq.querySelector(".ch-pc");
    if (piece && piece.classList.contains("w")) piece.remove();
    sq.append(h("div", "ch-pc b", type === "K" ? GLYPH.Kb : GLYPH.Pb));
    this.board.querySelector(`[data-sq="${from}"]`)?.replaceChildren();
    this.say(MATE_LINES[to] || `${type === "K" ? "Кр" : "п."} ${from}–${to}. Диагональ вскрыта. Мат.`);
    gm.audio.play("tapeScrape");
    gm.effects.glitch(0.5);
    this.board.classList.add("glitch");
    setTimeout(() => {
      if (!this.isOpen) return;
      const keep = this.log.textContent;
      this.render();
      this.say(keep + (this.tries >= 3 ? "  Правила не работают. Правила — это ловушка." : "  Фигура возвращается на место."));
    }, 900);
  }
}
