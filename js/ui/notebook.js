// Тетрадь Морозова (Tab). «Память здесь ненадёжна» — всё, что найдено,
// записывается сюда: текущая задача, записи-улики, вещи, документы.

import { Overlay, h } from "./overlay.js";
import { ITEMS, CLUES, CLUE_ORDER } from "../data/catalog.js";
import { ACTS } from "../core/story.js";

const TABS = [
  { id: "task",  label: "Задача" },
  { id: "clues", label: "Записи" },
  { id: "items", label: "Карманы" },
  { id: "docs",  label: "Бумаги" },
];

export class Notebook extends Overlay {
  constructor(game) {
    super(game, "notebook");
    this.tab = "task";
    this.viewAct = null;   // какой акт смотрим на странице «Задача» (null — текущий)
    this.book = h("div", "nb-book");
    this.tabsEl = h("div", "nb-tabs");
    this.page = h("div", "nb-page");
    this.book.append(this.tabsEl, this.page);
    this.el.append(this.book, h("div", "paper-hint", "Tab, Esc — закрыть · A, D — страницы · W, S — акты"));
    for (const t of TABS) {
      const b = h("button", "nb-tab", t.label);
      b.dataset.tab = t.id;
      b.onclick = () => { this.tab = t.id; this.render(); };
      this.tabsEl.appendChild(b);
    }
    this.el.addEventListener("click", (e) => { if (e.target === this.el && !this.fresh) this.close(); });
  }

  onOpen() { this.viewAct = null; this.render(); this.game.audio.play("paper"); }

  onKeyDown(e) {
    if (e.repeat || this.fresh) return;
    if (e.code === "Tab" || e.code === "Escape" || e.code === "KeyJ") { e.preventDefault(); this.close(); return; }
    const i = TABS.findIndex(t => t.id === this.tab);
    if (e.code === "ArrowRight" || e.code === "KeyD") { this.tab = TABS[(i + 1) % TABS.length].id; this.render(); }
    if (e.code === "ArrowLeft" || e.code === "KeyA") { this.tab = TABS[(i + TABS.length - 1) % TABS.length].id; this.render(); }
    if (this.tab === "task" && (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "ArrowDown" || e.code === "KeyS")) {
      e.preventDefault();
      const cur = this.viewAct ?? this.game.state.act;
      const next = cur + (e.code === "ArrowUp" || e.code === "KeyW" ? -1 : 1);
      if (next >= 1 && next <= this.game.state.act) { this.viewAct = next; this.render(); }
    }
  }

  render() {
    const s = this.game.state;
    for (const b of this.tabsEl.children) b.classList.toggle("on", b.dataset.tab === this.tab);
    const p = this.page;
    p.innerHTML = "";

    if (this.tab === "task") {
      const viewN = this.viewAct ?? s.act;
      const wrap = h("div", "nb-task");
      // Оглавление: все акты, до которых дошёл Морозов.
      const toc = h("div", "nb-toc");
      for (const a of ACTS) {
        if (a.n > s.act) break;
        const left = a.steps.filter(st => !(st.hidden && st.hidden(s)) && !st.done(s)).length;
        const b = h("button", "nb-toc-item" + (a.n === viewN ? " on" : "") + (a.n < s.act ? " past" : ""));
        b.append(h("span", "nb-toc-n", a.roman), h("span", "nb-toc-t", a.n === s.act ? "сейчас" : left ? `осталось ${left}` : "пройден"));
        b.onclick = () => { this.viewAct = a.n; this.render(); };
        toc.append(b);
      }
      const act = ACTS.find(a => a.n === viewN) || ACTS[0];
      const page = h("div", "nb-actpage");
      page.append(h("div", "nb-head", `Акт ${act.roman}. ${act.title}`));
      if (act.n < s.act) page.append(h("div", "nb-past", "Акт пройден. Незачёркнутое ещё можно найти."));
      const ul = h("ul", "nb-steps");
      for (const st of act.steps) {
        if (st.hidden && st.hidden(s)) continue;
        const li = h("li", st.done(s) ? "done" : "");
        li.append(h("span", "nb-box"), h("span", "nb-step-t", st.text));
        ul.appendChild(li);
      }
      page.append(ul);
      page.append(h("div", "nb-meta", `Виток: ${s.loop}   ·   04:12   ·   14.11.1988`));
      page.append(h("div", "nb-rules", "Если ты видишь другое время — ты ошибся дверью."));
      wrap.append(toc, page);
      p.append(wrap);
    }

    if (this.tab === "clues") {
      const known = CLUE_ORDER.filter(id => s.knows(id));
      if (!known.length) p.append(h("div", "nb-empty", "Пусто. Я ничего не записал."));
      for (const id of known) {
        const c = CLUES[id];
        const row = h("div", "nb-clue");
        row.append(h("div", "nb-clue-t", c.title), h("div", "nb-clue-b", c.text));
        p.append(row);
      }
    }

    if (this.tab === "items") {
      if (!s.items.length) p.append(h("div", "nb-empty", "В карманах пусто."));
      for (const id of s.items) {
        const it = ITEMS[id];
        const row = h("div", "nb-clue");
        row.append(h("div", "nb-clue-t", it.name), h("div", "nb-clue-b", it.desc));
        p.append(row);
      }
    }

    if (this.tab === "docs") {
      if (!s.docs.length) p.append(h("div", "nb-empty", "Я ещё ничего не прочитал."));
      for (const d of s.docs) {
        const row = h("button", "nb-doc", d.title);
        row.onclick = () => {
          this.close();
          this.game.docs.show(d, () => this.open());
        };
        p.append(row);
      }
    }
  }
}
