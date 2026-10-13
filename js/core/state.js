// Состояние сюжета: флаги, предметы, записи, прочитанные документы, витки.
// Любое изменение уходит событием в шину и (с задержкой) в сохранение.

import { ITEMS, CLUES } from "../data/catalog.js";

export const SAVE_KEY = "recursion1988_save_v2";
const META_KEY = "recursion1988_meta_v1";

export class GameState {
  constructor(bus) {
    this.bus = bus;
    this._saveTimer = 0;
    this.extraSave = null;   // () => объект, который игра добавит в сохранение
    this.reset();
  }

  reset() {
    this.flags = {};
    this.counters = {};
    this.items = [];
    this.clues = [];
    this.docs = [];          // [{id, title, kind, body}]
    this.files = {};         // файлы, созданные игроком на ЭВМ: {путь: текст}
    this.act = 1;
    this.loop = 0;
    this.deaths = 0;
  }

  // ── Флаги ────────────────────────────────────────────────
  is(flag) { return !!this.flags[flag]; }

  set(flag, value = true) {
    if (this.flags[flag] === value) return;
    this.flags[flag] = value;
    this.bus.emit("flag", { flag, value });
    this.bus.emit("flag:" + flag, value);
    this.changed();
  }

  // ── Счётчики (сколько раз смотрел в зеркало и т. п.) ──────
  count(name) { return this.counters[name] || 0; }
  inc(name) {
    this.counters[name] = this.count(name) + 1;
    this.bus.emit("counter", { name, value: this.counters[name] });
    this.changed();
    return this.counters[name];
  }
  setCount(name, v) { this.counters[name] = v; this.changed(); }

  // ── Предметы ─────────────────────────────────────────────
  has(id) { return this.items.includes(id); }

  give(id) {
    if (this.has(id)) return false;
    this.items.push(id);
    this.bus.emit("item:add", { id, item: ITEMS[id] });
    this.changed();
    return true;
  }

  take(id) {
    const i = this.items.indexOf(id);
    if (i < 0) return false;
    this.items.splice(i, 1);
    this.bus.emit("item:remove", { id });
    this.changed();
    return true;
  }

  // ── Записи в тетради ─────────────────────────────────────
  knows(id) { return this.clues.includes(id); }

  learn(id) {
    if (this.knows(id) || !CLUES[id]) return false;
    this.clues.push(id);
    this.bus.emit("clue:add", { id, clue: CLUES[id] });
    this.changed();
    return true;
  }

  // ── Прочитанные документы (для повторного чтения) ────────
  readDoc(doc) {
    if (this.docs.some(d => d.id === doc.id)) return false;
    this.docs.push({ id: doc.id, title: doc.title, kind: doc.kind, body: doc.body });
    this.bus.emit("doc:read", { id: doc.id });
    this.changed();
    return true;
  }
  hasRead(id) { return this.docs.some(d => d.id === id); }

  // ── Сохранение ───────────────────────────────────────────
  changed() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.save(), 400);
  }

  serialize() {
    return {
      v: 2,
      flags: this.flags, counters: this.counters, items: this.items,
      clues: this.clues, docs: this.docs, files: this.files,
      act: this.act, loop: this.loop, deaths: this.deaths,
      extra: this.extraSave ? this.extraSave() : null,
    };
  }

  save() {
    if (this.is("ending_final")) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.serialize())); }
    catch (_) { /* приватный режим — играем без сохранений */ }
  }

  static loadRaw() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && data.v === 2 ? data : null;
    } catch (_) { return null; }
  }

  static clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (_) {}
  }

  load(data) {
    this.reset();
    Object.assign(this.flags, data.flags || {});
    Object.assign(this.counters, data.counters || {});
    this.items = (data.items || []).filter(id => ITEMS[id]);
    this.clues = (data.clues || []).filter(id => CLUES[id]);
    this.docs = data.docs || [];
    this.files = data.files || {};
    this.act = data.act || 1;
    this.loop = data.loop || 0;
    this.deaths = data.deaths || 0;
  }

  // Мета-данные между прохождениями: сколько раз игрок уже выбирал финалы.
  static meta() {
    try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; }
    catch (_) { return {}; }
  }
  static setMeta(patch) {
    try { localStorage.setItem(META_KEY, JSON.stringify({ ...GameState.meta(), ...patch })); }
    catch (_) {}
  }
}
