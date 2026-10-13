// Файловая система ЭВМ. Сюжетные файлы — только для чтения и могут
// появляться/меняться по ходу игры; файлы игрока (edit, echo) хранятся
// в состоянии игры и попадают в сохранение.

import { T } from "./content.js";

const F = (content, o = {}) => ({ type: "file", content, ...o });
const D = (children, o = {}) => ({ type: "dir", children, ...o });

// perm: "op" — нужен ключ оператора; "archive" — нужна перемычка ПР-1.
function buildTree() {
  return D({
    "Документы": D({
      "Инструкция_Искра-1030.txt": F(T.instr_iskra),
      "Приказ_41-к.doc": F(T.prikaz),
      "ТБ_инструкция_7.txt": F(T.tb),
    }),
    "Мои_документы": D({
      "Отчёт_ОБ-88.doc": F(null, { special: "report" }),
      "Личное_дело_42.doc": F(null, { special: "dossier" }),
      "Дневник_1988.txt": F(T.diary),
      "Заметки_по_ОБЕРЕГ-88.txt": F(T.notes_obereg),
    }, { writable: true }),
    "Дневники": D({
      "дневник_снов.txt": F(T.dream),
      "витки.log": F(s => {
        const out = ["ЖУРНАЛ ВИТКОВ (ведётся автоматически)", ""];
        for (let i = 1; i <= Math.min(s.loop, 40); i++) out.push(`виток ${String(i).padStart(3, "0")}  14.11.1988 04:12  выход на пятый`);
        if (!s.loop) out.push("пусто. ты ещё не спускался.");
        if (s.deaths) out.push("", `пробуждений после обрыва: ${s.deaths}`);
        return out.join("\n");
      }),
    }),
    "Письма": D({
      "Письмо_Тане.txt": F(T.letter_tanya),
      "От_Тани.txt": F(T.letter_from_tanya),
      "Никитину.txt": F(T.letter_nikitin),
    }),
    "Фото": D({
      "таня.img": F(T.photo_tanya),
      "группа_ВЦ.img": F(T.photo_group),
      "крыша_блок_В.img": F(
`[ФОТО: крыша_блок_В.img — снято через окуляр]

Крыша лабораторного корпуса. Снег на парапете. Антенна.
Человек в лабораторном халате машет рукой. На парапете: БЛОК-В-88.
Лица не разобрать. Но я знаю, чьё оно.`, { show: s => s.is("telescope_done") }),
    }),
    "Радиоперехваты": D({
      "перехват_250.txt": F("250.00 кГц: шум. Старый вальс. Голосов нет."),
      "перехват_404.txt": F(
`404.00 кГц. ГОЛОС: мужской, усталый, с одышкой (Никитин В.П.)

«…азимут 312… место +14… повторяю… азимут 312… место +14…
 …Алексей, если ты слышишь — смотри в небо. Сектор Б-В-88…»`, { show: s => s.is("radio_tuned") }),
      "перехват_маяк.txt": F(
`ИСТОЧНИК: магнитофон «Маяк-205», кв. 43. Задержка 1,5 с.

«Запомни цифры. Это дверь. 19880414. Это пароль архива.
 Лёша, если ты это слышишь — ты уже мёртв.
 Но это не значит, что ты не можешь выбрать.»`, { show: s => s.is("tape_code") }),
    }, { perm: "op" }),
    "Сеть": D({
      "hosts": F(T.hosts),
      "readme.txt": F(T.net_readme),
      "порт_архива.key": F(null, { special: "portkey" }),
    }, { perm: "op" }),
    "Система": D({
      "config.sys": F(T.config),
      "autoexec.bat": F(T.autoexec),
      "obereg88.sys": F("[ДВОИЧНЫЙ ФАЙЛ. 512 КБ. Запущен. Не трогать.]"),
      "shutdown.sys": F(null, { special: "shutdown" }),
    }, { perm: "op" }),
    "Архив": D({
      "протокол_14-11-88.txt": F(T.protocol),
      "сессии.log": F(T.sessions_log),
    }, { perm: "archive" }),
    "tmp": D({}, { writable: true }),
    "dev": D({
      "radio_vef": F(null, { special: "dev" }),
      "tape0": F(null, { special: "dev" }),
      "mem": F(T.mem_dump),
      "crt0": F(null, { special: "dev" }),
      "null": F(""),
    }, { perm: "op" }),
  });
}

export class StoryFS {
  constructor(game) {
    this.game = game;
    this.root = buildTree();
  }

  get s() { return this.game.state; }

  // Разбор пути относительно cwd (массив сегментов).
  parts(cwd, p) {
    if (!p) return cwd.slice();
    let base = p.startsWith("/") || p.startsWith("\\") ? [] : cwd.slice();
    for (const seg of p.split(/[\\/]+/).filter(Boolean)) {
      if (seg === ".") continue;
      if (seg === "..") { base.pop(); continue; }
      base.push(seg);
    }
    return base;
  }

  toString(parts) { return "/" + parts.join("/"); }

  _visible(node) { return !node.show || node.show(this.s); }

  // Найти узел без учёта регистра. Возвращает { node, parts (настоящие имена) }.
  get(parts) {
    let node = this.root;
    const real = [];
    for (const seg of parts) {
      if (node.type !== "dir") return null;
      const kids = this._children(node, real);
      const key = Object.keys(kids).find(k => k.toLowerCase() === seg.toLowerCase());
      if (!key) return null;
      node = kids[key];
      real.push(key);
    }
    return { node, parts: real };
  }

  _children(dirNode, dirParts) {
    const kids = {};
    for (const [k, v] of Object.entries(dirNode.children || {})) if (this._visible(v)) kids[k] = v;
    if (dirNode.writable) {
      const prefix = this.toString(dirParts) + "/";
      for (const [path, text] of Object.entries(this.s.files)) {
        if (!path.startsWith(prefix)) continue;
        const name = path.slice(prefix.length);
        if (name && !name.includes("/")) kids[name] = { type: "file", content: text, user: true };
      }
    }
    return kids;
  }

  list(parts) {
    const r = this.get(parts);
    if (!r || r.node.type !== "dir") return null;
    return Object.entries(this._children(r.node, r.parts))
      .map(([name, n]) => ({ name, node: n }))
      .sort((a, b) => a.node.type === b.node.type ? a.name.localeCompare(b.name, "ru") : (a.node.type === "dir" ? -1 : 1));
  }

  // Проверка доступа ко всем узлам на пути. null — можно.
  denied(parts) {
    let node = this.root;
    const real = [];
    for (const seg of parts) {
      const kids = this._children(node, real);
      const key = Object.keys(kids).find(k => k.toLowerCase() === seg.toLowerCase());
      if (!key) return null;
      node = kids[key];
      real.push(key);
      if (node.perm === "op" && !this.s.is("key_inserted"))
        return "ДОСТУП ЗАПРЕЩЁН: требуется ключ оператора (положение замка «ОПЕРАТОР»).";
      if (node.perm === "archive" && !this.s.is("jumper_set"))
        return "СЕКТОР ЗАЩИЩЁН АППАРАТНО. Перемычка ПР-1 в этажном щите не установлена.";
    }
    return null;
  }

  text(node) {
    return typeof node.content === "function" ? node.content(this.s) : (node.content ?? "");
  }

  canWrite(parts) {
    const dir = this.get(parts.slice(0, -1));
    if (!dir || dir.node.type !== "dir" || !dir.node.writable) return false;
    const r = this.get(parts);
    return !r || r.node.user;
  }

  write(parts, text) {
    const dir = this.get(parts.slice(0, -1));
    const path = this.toString(dir.parts) + "/" + parts[parts.length - 1];
    this.s.files[path] = text;
    this.s.changed();
  }

  remove(parts) {
    const r = this.get(parts);
    if (!r || !r.node.user) return false;
    delete this.s.files[this.toString(r.parts)];
    this.s.changed();
    return true;
  }

  // Все файлы (для find): [{path, node}]
  walk() {
    const out = [];
    const rec = (node, parts) => {
      for (const [name, n] of Object.entries(this._children(node, parts))) {
        const p = [...parts, name];
        if (this.denied(p)) continue;
        out.push({ path: this.toString(p), node: n });
        if (n.type === "dir") rec(n, p);
      }
    };
    rec(this.root, []);
    return out;
  }
}
