// ЭВМ «Искра-1030», АДОС 3.20. Терминал — это не машина. Терминал — это я.
//
// Режимы ввода:
//   shell    — обычная командная строка;
//   password — ввод пароля (звёздочки);
//   yn       — да/нет (входящий вызов);
//   choice   — выбор 1/2/3 (shutdown.sys);
//   browser  — ИСКРА-NET, переход по номерам ссылок;
//   edit     — редактор файла;
//   busy     — идёт вывод, любая клавиша — ускорить.

import { StoryFS } from "./fs.js";
import { T, HEXDUMP, DOSSIER, NIKITIN_CALL } from "./content.js";
import { HOME, page, isExternal, externalHref, normalizeUrl } from "./net.js";

const RU = "йцукенгшщзхъфывапролджэячсмитьбю.ё";
const EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,./`";
const fixLayout = (s) => s.replace(/[а-яё.]/gi, ch => {
  const i = RU.indexOf(ch.toLowerCase());
  return i < 0 ? ch : EN[i];
});

const ARG_KEY = ["ТАНЯ0412", "TANYA0412", "TANJA0412", "TANIA0412"];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export class Terminal {
  constructor(game) {
    this.game = game;
    this.fs = new StoryFS(game);
    this.root = document.getElementById("terminal");
    this.isOpen = false;
    this.cwd = ["Мои_документы"];
    this.history = [];
    this.hIdx = 0;
    this.mode = "shell";
    this._skip = false;
    this._booted = false;
    this._build();
  }

  get s() { return this.game.state; }

  // ── DOM ──────────────────────────────────────────────────
  _build() {
    const r = this.root;
    r.innerHTML = `
      <div class="crt">
        <div class="crt-screen">
          <div class="crt-head"><span>ИСКРА-1030 · АДОС 3.20</span><span class="crt-mode"></span><span>640K · 04:12</span></div>
          <div class="crt-out"></div>
          <div class="crt-line"><span class="crt-prompt"></span><input class="crt-in" autocomplete="off" spellcheck="false" /></div>
          <textarea class="crt-edit hidden" spellcheck="false"></textarea>
        </div>
        <div class="crt-bezel">
          <span class="crt-brand">ИСКРА</span>
          <span class="crt-hint">Esc — встать из-за стола</span>
          <span class="crt-led"></span>
        </div>
      </div>`;
    this.out = r.querySelector(".crt-out");
    this.inp = r.querySelector(".crt-in");
    this.pr = r.querySelector(".crt-prompt");
    this.modeEl = r.querySelector(".crt-mode");
    this.editor = r.querySelector(".crt-edit");
    this.screen = r.querySelector(".crt-screen");

    this.inp.addEventListener("keydown", (e) => this._inputKey(e));
    this.editor.addEventListener("keydown", (e) => {
      if ((e.ctrlKey && e.code === "KeyS") || e.code === "F2") { e.preventDefault(); this._editSave(); }
    });
    r.addEventListener("mousedown", (e) => {
      if (e.target.closest("a, button, textarea")) return;
      setTimeout(() => (this.mode === "edit" ? this.editor : this.inp).focus(), 0);
    });
  }

  // ── Открытие / закрытие ──────────────────────────────────
  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.root.classList.remove("hidden");
    this.game.input.push(this);
    this.game.audio.play("crtOn");
    this.game.audio.computerHum(true);
    this.game.checkArgProgress();
    this._session();
  }

  close() {
    if (!this.isOpen || this.mode === "busy" && this._locked) return;
    this.isOpen = false;
    if (this.mode === "edit") this._editExit();
    this.mode = "shell";
    this.root.classList.add("hidden");
    this.game.input.pop(this);
    this.game.audio.computerHum(false);
    this.game.audio.play("click");
  }

  onKeyDown(e) {
    if (this.mode === "busy") { this._skip = true; return; }
    if (e.code !== "Escape" || e.repeat) return;
    e.preventDefault();
    if (this.mode === "edit") { this._editExit(); return; }
    if (this.mode === "browser") { this._browserExit(); return; }
    if (this.mode === "password" || this.mode === "yn" || this.mode === "choice") {
      if (this.mode === "choice" && this._noEscape) return;
      this.println("^C");
      this._setMode("shell");
      return;
    }
    this.close();
  }

  // ── Вывод ────────────────────────────────────────────────
  println(text = "", cls = "") {
    const el = document.createElement("div");
    el.className = "ln " + cls;
    el.textContent = text;
    this.out.appendChild(el);
    this._scroll();
    return el;
  }

  lines(arr, cls = "") { for (const l of arr) this.println(l, cls); }

  _scroll() { this.out.scrollTop = this.out.scrollHeight; }

  // Печать «машинкой». Любая клавиша — допечатать сразу.
  async type(lines, { cps = 90, cls = "", pause = 0 } = {}) {
    const prev = this.mode;
    this._setMode("busy");
    this._skip = false;
    for (const line of lines) {
      const el = this.println("", cls);
      for (let i = 0; i < line.length; i++) {
        if (this._skip || !this.isOpen) { el.textContent = line; break; }
        el.textContent += line[i];
        if (i % 3 === 0) this.game.audio.play("key");
        await sleep(1000 / cps);
      }
      this._scroll();
      if (pause && !this._skip) await sleep(pause);
    }
    this._skip = false;
    if (this.mode === "busy") this._setMode(prev === "busy" ? "shell" : prev);
  }

  clear() { this.out.innerHTML = ""; }

  _setMode(m) {
    this.mode = m;
    const promptStr = {
      shell: this._cwdStr() + ">",
      password: "ПАРОЛЬ:",
      yn: "ПРИНЯТЬ? [Д/Н]",
      choice: "ВЫБОР [1/2/3]:",
      browser: "NET>",
      busy: "",
      edit: "",
    }[m] ?? ">";
    this.pr.textContent = promptStr ? promptStr + " " : "";
    this.inp.type = m === "password" ? "password" : "text";
    this.root.querySelector(".crt-line").classList.toggle("hidden", m === "busy" || m === "edit");
    this.modeEl.textContent = this.s.is("key_inserted") ? "ОПЕРАТОР" : "ГОСТЬ";
    if (m !== "busy" && this.isOpen) setTimeout(() => (m === "edit" ? this.editor : this.inp).focus(), 0);
  }

  _cwdStr() { return "C:\\" + this.cwd.join("\\"); }

  // ── Сеанс ────────────────────────────────────────────────
  async _session() {
    this.screen.classList.toggle("decay", this.s.is("dossier_read"));
    if (!this._booted) {
      this._booted = true;
      this.clear();
      await this.type([
        "ИСКРА-1030   АДОС 3.20   (C) ВЦ «ПРИБОР», 1987",
        "ПРОВЕРКА ОЗУ ....... 640 К   OK",
        "OBEREG88.SYS ....... ЗАГРУЖЕН. ЦИКЛ 021",
        `RADIO_VEF.SYS ...... ${this.s.is("power_on") ? "OK, 404.00 кГц" : "НЕТ НАПРЯЖЕНИЯ НА ЛИНИИ 3"}`,
        "",
      ], { cps: 220 });
    } else {
      this.println("");
      this.println("— сеанс возобновлён · 04:12 —", "dim");
    }

    if (this.s.has("key_lab3") && !this.s.is("key_inserted")) {
      await this.type([
        "Я вставляю ключ №3 в замок системного блока и поворачиваю.",
        "Щелчок. Положение «ОПЕРАТОР».",
      ], { cls: "me", cps: 70 });
      this.s.set("key_inserted");
      this.game.audio.play("relay");
      this.println("ЗАМОК: ОПЕРАТОР. ПОЛНЫЙ ДОСТУП.", "ok");
    } else if (!this.s.is("key_inserted")) {
      this.println("ЗАМОК: ГОСТЬ. Часть каталогов закрыта. Нужен ключ оператора.", "warn");
    }
    if (!this.s.is("term_help_seen")) this.println("Введите help — список команд.", "dim");
    this._setMode("shell");

    if (this.s.is("dossier_read") && !this.s.is("call_accepted")) {
      await sleep(1500);
      if (this.isOpen && this.mode === "shell") this._incomingCall();
    } else if (this.s.act >= 10 && !this.s.is("ending_chosen")) {
      this.println("");
      this.println("На экране мигает курсор утилиты shutdown.sys.", "warn");
    }
  }

  // ── Ввод ─────────────────────────────────────────────────
  _inputKey(e) {
    if (this.mode === "busy") { e.preventDefault(); return; }
    if (e.code === "Tab") { e.preventDefault(); this._complete(); return; }
    if (e.code === "ArrowUp" && this.mode === "shell") {
      e.preventDefault();
      if (this.hIdx > 0) this.inp.value = this.history[--this.hIdx] || "";
      return;
    }
    if (e.code === "ArrowDown" && this.mode === "shell") {
      e.preventDefault();
      if (this.hIdx < this.history.length - 1) this.inp.value = this.history[++this.hIdx] || "";
      else { this.hIdx = this.history.length; this.inp.value = ""; }
      return;
    }
    if (e.key !== "Enter") {
      if (!e.repeat && e.key.length === 1) this.game.audio.play("key");
      return;
    }
    e.preventDefault();
    const raw = this.inp.value;
    this.inp.value = "";
    this._submit(raw);
  }

  async _submit(raw) {
    const m = this.mode;
    if (m === "password") {
      this.println(this.pr.textContent + "*".repeat(raw.length));
      const cb = this._onPassword; this._onPassword = null;
      this._setMode("shell");
      await cb?.(raw.trim());
      return;
    }
    if (m === "yn" || m === "choice") {
      this.println(this.pr.textContent + raw);
      const cb = this._onAnswer; this._onAnswer = null;
      await cb?.(raw.trim().toLowerCase());
      return;
    }
    if (m === "browser") {
      this.println("NET> " + raw);
      this._browserInput(raw.trim());
      return;
    }
    this.println(this._cwdStr() + "> " + raw);
    const t = raw.trim();
    if (!t) return;
    this.history.push(t);
    this.hIdx = this.history.length;
    await this.run(t);
    if (this.mode === "shell") this._setMode("shell");
  }

  _complete() {
    const v = this.inp.value;
    const parts = v.split(/\s+/);
    if (parts.length <= 1) {
      const c = Object.keys(this.CMDS).filter(k => k.startsWith(v.toLowerCase()));
      if (c.length === 1) this.inp.value = c[0] + " ";
      else if (c.length > 1) this.println(c.join("  "), "dim");
      return;
    }
    const last = parts[parts.length - 1];
    const slash = Math.max(last.lastIndexOf("/"), last.lastIndexOf("\\"));
    const dirPart = slash >= 0 ? last.slice(0, slash + 1) : "";
    const pref = last.slice(slash + 1).toLowerCase();
    const list = this.fs.list(this.fs.parts(this.cwd, dirPart || "")) || [];
    const c = list.filter(x => x.name.toLowerCase().startsWith(pref));
    if (c.length === 1) {
      parts[parts.length - 1] = dirPart + c[0].name + (c[0].node.type === "dir" ? "/" : "");
      this.inp.value = parts.join(" ");
    } else if (c.length > 1) this.println(c.map(x => x.name).join("  "), "dim");
  }

  // ── Разбор команды ───────────────────────────────────────
  async run(line) {
    const args = (line.match(/"[^"]*"|\S+/g) || []).map(a => a.replace(/^"|"$/g, ""));
    let cmd = (args.shift() || "").toLowerCase();
    let fn = this.CMDS[cmd];
    if (!fn) {
      const fixed = fixLayout(cmd);
      if (this.CMDS[fixed]) {
        this.println(`(раскладка: ${fixed})`, "dim");
        cmd = fixed; fn = this.CMDS[fixed];
      }
    }
    if (!fn) {
      if (/^node_1988_clone:\/\//i.test(cmd)) { await this.CMDS.connect.call(this, [line.trim()]); return; }
      this.println(`Неверная команда: ${cmd}. Введите help.`, "err");
      return;
    }
    const meta = this.HELP[cmd];
    if (meta && meta.op && !this.s.is("key_inserted")) {
      this.println("ДОСТУП ЗАПРЕЩЁН: команда доступна в режиме ОПЕРАТОР (ключ №3).", "err");
      return;
    }
    try { await fn.call(this, args, line); }
    catch (err) { console.error(err); this.println("СБОЙ: " + err.message, "err"); }
  }

  get HELP() {
    return {
      help: { d: "справка; help <команда>" },
      ls: { d: "список файлов [путь]" },
      cd: { d: "сменить каталог" },
      cat: { d: "вывести содержимое файла" },
      edit: { d: "редактор файла (F2 — сохранить, Esc — выход)" },
      find: { d: "поиск по имени и тексту файлов" },
      browser: { d: "ИСКРА-NET [адрес]" },
      radioctl: { d: "радиомодуль: status | scan | listen", op: true },
      connect: { d: "соединение: connect <устройство|узел> [параметр]", op: true },
      decrypt: { d: "дешифратор файла", op: true },
      netstat: { d: "состояние сети", op: true },
      ps: { d: "список процессов" },
      "shutdown.sys": { d: "ЗАВЕРШЕНИЕ СЕССИИ", op: true },
      clear: { d: "очистить экран" },
      exit: { d: "встать из-за стола" },
    };
  }

  get CMDS() { return COMMANDS; }

  // ── Пароль / вопрос ──────────────────────────────────────
  askPassword(cb) { this._onPassword = cb; this._setMode("password"); }
  ask(mode, cb) { this._onAnswer = cb; this._setMode(mode); }

  // ── Входящий вызов (Акт IX) ──────────────────────────────
  async _incomingCall() {
    this.game.audio.play("ring");
    this.println("");
    this.println("=== ВХОДЯЩИЙ ВЫЗОВ. ОПЕРАТОР: НИКИТИН В.П. ===", "alert");
    this.ask("yn", async (a) => {
      if (a.startsWith("д") || a.startsWith("y") || a.startsWith("l")) {
        this._setMode("busy");
        this.println("Соединение установлено. Голос — с одышкой, сквозь шум.", "dim");
        await sleep(600);
        await this.type(NIKITIN_CALL, { cps: 38, cls: "voice", pause: 500 });
        this.s.set("call_accepted");
        this.println("");
        this.println("Связь прервана. На экране мигает курсор утилиты shutdown.sys.", "warn");
        this._setMode("shell");
      } else {
        this.println("Вызов отклонён. Он перезвонит. Он всегда перезванивает.", "dim");
        this._setMode("shell");
      }
    });
  }

  // ── Браузер ИСКРА-NET ────────────────────────────────────
  _browser(url) {
    this._netHist = this._netHist || [];
    this._setMode("browser");
    this._netGo(url || HOME);
  }

  _netGo(url, push = true) {
    if (isExternal(url)) { this._external(url); return; }
    const pg = page(url, this.s);
    if (!pg) {
      this.println(`ИСКРА-NET: узел «${normalizeUrl(url)}» не найден. Таблица узлов — /Сеть/hosts.`, "err");
      return;
    }
    if (push) this._netHist.push(url);
    this._links = pg.links || [];
    this.println("");
    this.println("== " + pg.title + " " + "=".repeat(Math.max(2, 56 - pg.title.length)), "net-title");
    this.lines(pg.body.split("\n"), "net");
    if (this._links.length) {
      this.println("");
      this._links.forEach(([label], i) => this.println(`  [${i + 1}] ${label}`, "net-link"));
    }
    this.println("-- номер: перейти · адрес: открыть · b: назад · q: выход", "dim");
  }

  _browserInput(v) {
    if (!v) return;
    if (v === "q" || v === "й" || v === "exit") { this._browserExit(); return; }
    if (v === "b" || v === "и") {
      this._netHist.pop();
      const prev = this._netHist.pop();
      this._netGo(prev || HOME);
      return;
    }
    const n = parseInt(v, 10);
    if (String(n) === v && this._links[n - 1]) { this._netGo(this._links[n - 1][1]); return; }
    this._netGo(v);
  }

  _browserExit() {
    this.println("ИСКРА-NET: сеанс закрыт.", "dim");
    this._setMode("shell");
  }

  // Внешний архив: изнутри не открыть. Можно только передать адрес наружу.
  _external(url) {
    const s = this.s;
    this.println("");
    this.println(`ИСКРА-NET: НЕТ МАРШРУТА ДО ${normalizeUrl(url)}`, "err");
    this.println("Сигнал не выходит за пределы 640 КБ. Я — внутри. Я не могу открыть браузер.", "me");
    this.println("Это может сделать только тот, кто снаружи. Тот, кто сидит за экраном.", "me");
    const href = externalHref(url);
    const row = this.println("", "ext");
    const a = document.createElement("a");
    a.href = href; a.target = "_blank"; a.rel = "noopener";
    a.textContent = href;
    a.addEventListener("click", () => { s.set("arg_opened"); });
    row.append("Передать адрес наблюдателю: ", a);
    s.set("arg_link_shown");
  }

  // ── Редактор ─────────────────────────────────────────────
  _edit(parts) {
    this._editParts = parts;
    const r = this.fs.get(parts);
    this.editor.value = r ? this.fs.text(r.node) : "";
    this.editor.classList.remove("hidden");
    this.out.classList.add("hidden");
    this._setMode("edit");
    this.modeEl.textContent = "РЕДАКТОР · " + parts[parts.length - 1] + " · F2 — сохранить · Esc — выход";
  }

  _editSave() {
    this.fs.write(this._editParts, this.editor.value);
    this.game.audio.play("relay");
    this.modeEl.textContent = "СОХРАНЕНО · " + this._editParts[this._editParts.length - 1];
  }

  _editExit() {
    this.editor.classList.add("hidden");
    this.out.classList.remove("hidden");
    this._setMode("shell");
    this._scroll();
  }
}

// ═════════════════════════════════════════════════════════
// Команды. this — экземпляр Terminal.
// ═════════════════════════════════════════════════════════
const COMMANDS = {
  help(args) {
    this.s.set("term_help_seen");
    const H = this.HELP;
    if (args[0]) {
      const k = args[0].toLowerCase();
      if (!H[k]) { this.println("Нет справки по " + k, "err"); return; }
      this.println(`${k} — ${H[k].d}${H[k].op ? "   [ОПЕРАТОР]" : ""}`);
      if (k === "connect") this.lines(["  пример: connect /dev/radio_vef 404.00", "  пример: connect node_<…>://<сессия>"], "dim");
      if (k === "browser") this.println("  пример: browser vc-pribor.int", "dim");
      return;
    }
    this.println("Команды АДОС 3.20:");
    for (const [k, v] of Object.entries(H)) {
      const locked = v.op && !this.s.is("key_inserted");
      this.println(`  ${k.padEnd(14)}— ${v.d}${locked ? "  (нужен ключ оператора)" : ""}`, locked ? "dim" : "");
    }
    this.println("Также: pwd, whoami, date, mem, ver, echo текст > файл, rm файл.", "dim");
    this.println("Пути: /Мои_документы/Отчёт_ОБ-88.doc, ../Письма, Tab — дополнить.", "dim");
  },

  ls(args) {
    const parts = this.fs.parts(this.cwd, args[0]);
    const deny = this.fs.denied(parts);
    if (deny) { this.println(deny, "err"); return; }
    const list = this.fs.list(parts);
    if (!list) { this.println("Путь не найден.", "err"); return; }
    if (!list.length) { this.println("  (пусто)", "dim"); return; }
    for (const { name, node } of list) {
      const locked = (node.perm === "op" && !this.s.is("key_inserted")) || (node.perm === "archive" && !this.s.is("jumper_set"));
      const tag = node.type === "dir" ? "<DIR>" : node.special === "dossier" || node.special === "portkey" ? "<ЗАШ>" : "     ";
      this.println(`  ${tag}  ${name}${locked ? "   [закрыт]" : ""}`, node.type === "dir" ? "dir" : "");
    }
  },
  dir(args) { return COMMANDS.ls.call(this, args); },

  cd(args) {
    if (!args[0] || args[0] === "/" || args[0] === "\\") { this.cwd = []; this._setMode("shell"); return; }
    const parts = this.fs.parts(this.cwd, args[0]);
    const r = this.fs.get(parts);
    if (!r || r.node.type !== "dir") { this.println("Каталог не найден.", "err"); return; }
    const deny = this.fs.denied(parts);
    if (deny) { this.println(deny, "err"); return; }
    this.cwd = r.parts;
    this._setMode("shell");
  },

  pwd() { this.println("/" + this.cwd.join("/")); },

  async cat(args) {
    if (!args[0]) { this.println("Укажите файл: cat <файл>", "err"); return; }
    const parts = this.fs.parts(this.cwd, args.join(" "));
    const r = this.fs.get(parts);
    if (!r) { this.println("Файл не найден.", "err"); return; }
    if (r.node.type === "dir") { this.println("Это каталог. Используйте ls.", "err"); return; }
    const deny = this.fs.denied(parts);
    if (deny) { this.println(deny, "err"); return; }
    const sp = r.node.special;
    if (sp === "report") return SPECIAL.report.call(this);
    if (sp === "dossier") return SPECIAL.dossier.call(this);
    if (sp === "portkey") { this.lines(T.port_key_locked.split("\n"), this.s.is("arg_key") ? "ok" : ""); if (this.s.is("arg_key")) this.println("РАСШИФРОВАН. ПОРТ ВНЕШНЕГО АРХИВА ОТКРЫТ.", "ok"); return; }
    if (sp === "shutdown") return COMMANDS["shutdown.sys"].call(this);
    if (sp === "dev") return SPECIAL.dev.call(this, r.parts[r.parts.length - 1]);
    this.lines(this.fs.text(r.node).split("\n"));
  },
  type(args) { return COMMANDS.cat.call(this, args); },

  edit(args) {
    if (!args[0]) { this.println("Укажите файл: edit /tmp/заметка.txt", "err"); return; }
    const parts = this.fs.parts(this.cwd, args.join(" "));
    const r = this.fs.get(parts);
    if (r && r.node.type === "dir") { this.println("Это каталог.", "err"); return; }
    if (!this.fs.canWrite(parts)) {
      if (r) { this.println("Файл только для чтения. Сохранять можно в /tmp и /Мои_документы.", "err"); COMMANDS.cat.call(this, args); }
      else this.println("Сохранять можно только в /tmp и /Мои_документы.", "err");
      return;
    }
    this._edit(parts);
  },

  echo(args, raw) {
    const m = raw.match(/^echo\s+(.*?)\s*>\s*(\S+)\s*$/i);
    if (!m) { this.println(args.join(" ")); return; }
    const parts = this.fs.parts(this.cwd, m[2]);
    if (!this.fs.canWrite(parts)) { this.println("Нельзя записать сюда. Используйте /tmp.", "err"); return; }
    this.fs.write(parts, m[1].replace(/^"(.*)"$/, "$1"));
    this.println("Записано.", "dim");
  },

  rm(args) {
    const parts = this.fs.parts(this.cwd, args.join(" "));
    if (!this.fs.remove(parts)) this.println("Удалить можно только свои файлы.", "err");
  },

  find(args) {
    const q = args.join(" ").toLowerCase();
    if (!q) { this.println("find <образец>", "err"); return; }
    let n = 0;
    for (const { path, node } of this.fs.walk()) {
      const inName = path.toLowerCase().includes(q);
      let inText = false;
      if (node.type === "file" && !node.special) inText = this.fs.text(node).toLowerCase().includes(q);
      if (inName || inText) { this.println(`  ${path}${inText && !inName ? "   (в тексте)" : ""}`); n++; }
    }
    this.println(n ? `Найдено: ${n}` : "Ничего не найдено.", "dim");
  },

  browser(args) { this._browser(args[0]); },
  net(args) { this._browser(args[0]); },

  radioctl(args) {
    const s = this.s;
    const sub = (args[0] || "status").toLowerCase();
    if (sub === "status") {
      this.lines([
        "МОДУЛЬ: ВЭФ-202 (кв. 41, линия 3)",
        `ПИТАНИЕ: ${s.is("power_on") ? "есть" : "НЕТ"}`,
        `ЧАСТОТА: ${s.is("radio_tuned") ? "404.00 кГц — НЕСУЩАЯ" : "250.00 кГц — шум"}`,
        `ШЛЮЗ: ${s.is("radio_connected") ? "АКТИВЕН · сектор БЛОК-В-88" : "неактивен (connect /dev/radio_vef <частота>)"}`,
      ]);
    } else if (sub === "scan") {
      if (!s.is("power_on")) { this.println("Нет напряжения на линии 3.", "err"); return; }
      const row = [];
      for (let f = 200; f <= 600; f += 8) {
        const d = Math.abs(f - 404);
        row.push(d < 6 ? "#" : d < 20 ? "=" : Math.random() < 0.3 ? "-" : ".");
      }
      this.lines(["200 кГц " + row.join("") + " 600 кГц", "        " + " ".repeat(Math.round((404 - 200) / 8)) + "^ 404"]);
    } else if (sub === "listen") {
      if (!s.is("radio_tuned")) { this.println("Шум. Голосов нет.", "dim"); return; }
      this.lines(["«…азимут 312… место +14… повторяю… азимут 312… место +14…»"], "voice");
    } else this.println("radioctl status | scan | listen", "err");
  },

  async connect(args) {
    const s = this.s;
    const target = (args[0] || "").toLowerCase();
    if (!target) { this.println("connect <устройство|узел> [параметр]. См. help connect.", "err"); return; }

    if (target === "/dev/radio_vef" || target === "radio_vef" || target === "\\dev\\radio_vef") {
      const f = parseFloat((args[1] || "").replace(",", "."));
      if (!s.is("power_on")) { this.println("RADIO_VEF: нет напряжения на линии 3.", "err"); return; }
      if (!f) { this.println("Укажите частоту: connect /dev/radio_vef <кГц>", "err"); return; }
      if (Math.abs(f - 404) > 0.01) {
        this.println(`RADIO_VEF: ${f.toFixed(2)} кГц — шум. Несущей нет.`, "err"); return;
      }
      if (!s.is("radio_tuned")) { this.println("RADIO_VEF: приёмник в кв. 41 не настроен. Шкала стоит на 250.", "err"); return; }
      if (!s.is("telescope_done")) {
        this.println("ШЛЮЗ: несущая есть, но целевой сектор не определён.", "warn");
        this.println("Нужно знать, куда смотреть. Сектор наблюдения не подтверждён.", "dim");
        return;
      }
      await this.type([
        "CONNECT /DEV/RADIO_VEF 404.00",
        "ШЛЮЗ СВЯЗИ АКТИВИРОВАН.",
        "СЕКТОР БЛОК-В-88 ОБНАРУЖЕН.",
        "ПЕРЕХОД К АРХИВУ: HTTP://GOST-1988.SU/SHIT.PDF",
      ], { cps: 45, cls: "ok", pause: 300 });
      s.set("radio_connected");
      this.println("Ссылка. Внешняя ссылка. Не в игре. В реальности.", "me");
      return;
    }

    if (target.startsWith("node_1988_clone://")) {
      const sess = target.slice("node_1988_clone://".length);
      if (sess !== "local_session_021") {
        this.println(`УЗЕЛ: сессия «${sess}» не найдена. Активна только одна.`, "err"); return;
      }
      await this.type([
        "Устанавливаем соединение: node_1988_clone://local_session_021",
        "…",
        "СОЕДИНЕНИЕ УСТАНОВЛЕНО.",
        "",
        ">>> ВИДЕОКАНАЛ <<<",
        "На экране — комната, идентичная моей. В кресле сидит человек.",
        "Со спины — я. Он медленно поворачивает голову к своему монитору.",
        "На его экране — я. Сижу за столом.",
        "",
        ">>> СИСТЕМНОЕ СООБЩЕНИЕ <<<",
        "УДАЛЁННЫЙ ЗАМОК: КВ. 50 «ОБСЕРВАТОРИЯ» — ОТКРЫТ.",
      ], { cps: 70, pause: 150 });
      s.set("unlock_50");
      s.set("node_connected");
      this.game.audio.play("relay");
      return;
    }

    if (target.includes("gost-1988")) { this._external(target); return; }
    this.println(`Устройство или узел «${target}» не найдены. См. /Сеть/hosts.`, "err");
  },

  decrypt(args) {
    const parts = this.fs.parts(this.cwd, args.join(" "));
    const r = this.fs.get(parts);
    if (!r) { this.println("decrypt <файл>", "err"); return; }
    const sp = r.node.special;
    if (sp === "dossier") return SPECIAL.dossier.call(this);
    if (sp !== "portkey") { this.println("Файл не зашифрован.", "dim"); return; }
    if (this.s.is("arg_key")) { this.println("Уже расшифрован. Порт открыт.", "ok"); return; }
    this.println("ДЕШИФРАТОР: введите ключ передачи (4 части, без пробелов).");
    this.askPassword(async (k) => {
      const norm = k.toUpperCase().replace(/[\s\-·.]/g, "").replace(/Ё/g, "Е");
      if (ARG_KEY.includes(norm)) {
        await this.type(["КЛЮЧ ПРИНЯТ.", "ПОРТ ВНЕШНЕГО АРХИВА: ОТКРЫТ.", "shutdown.sys: доступен режим 3."], { cls: "ok", cps: 60 });
        this.s.set("arg_key");
        this.s.learn("arg_key");
      } else {
        this.println("КЛЮЧ ОТВЕРГНУТ. Части ключа — во внешнем архиве.", "err");
      }
    });
  },

  netstat() {
    const s = this.s;
    this.lines([
      "АКТИВНЫЕ СОЕДИНЕНИЯ",
      "  local            vc-pribor.int      УСТАНОВЛЕНО",
      `  /dev/radio_vef   404.00 кГц         ${s.is("radio_connected") ? "УСТАНОВЛЕНО" : s.is("radio_tuned") ? "ГОТОВО" : "НЕТ НЕСУЩЕЙ"}`,
      `  node_1988_clone  local_session_021  ${s.is("node_connected") ? "УСТАНОВЛЕНО" : "СЛУШАЕТ"}`,
      `  gost-1988.su     внешний архив      НЕТ МАРШРУТА`,
      `  порт архива      передача           ${s.is("arg_key") ? "ОТКРЫТ" : "ЗАКРЫТ (ключ)"}`,
      s.is("call_accepted") || s.is("dossier_read") ? "  НИКИТИН.ОПР      блок В, стойка 3   НА ЛИНИИ" : "",
    ].filter(Boolean));
  },

  ps() {
    const s = this.s;
    const deg = Math.min(99, 12 + s.act * 8 + s.deaths * 3);
    this.lines([
      "PID  ПРОЦЕСС            ПАМЯТЬ   СОСТОЯНИЕ",
      "001  COMMAND.COM          4K     активен",
      "002  OBEREG88.SYS       512K     ЦИКЛ 021",
      `003  MOROZOV.MEM        640K     деградация ${deg}%`,
      s.is("radio_connected") ? "004  RADIO_GW.EXE        12K     шлюз 404.00" : "",
      s.is("node_connected") ? "005  CLONE_021.NODE        ?      смотрит" : "",
      s.is("dossier_read") ? "006  НИКИТИН.ОПР           -      ждёт решения" : "",
    ].filter(Boolean));
  },

  async "shutdown.sys"() {
    const s = this.s;
    if (s.act < 10 || !s.is("call_accepted")) {
      this.println("SHUTDOWN.SYS: ОПЕРАЦИЯ ЗАБЛОКИРОВАНА ОПЕРАТОРОМ СМЕНЫ.", "err");
      this.println("Мы не вправе гасить тебя без твоего согласия. Ожидайте связи.", "dim");
      return;
    }
    this.println("");
    await this.type([
      "SHUTDOWN.SYS · ЗАВЕРШЕНИЕ СЕССИИ 021",
      "",
      "ВВЕДИТЕ 1 ДЛЯ РЕКУРСИВНОГО РЕСТАРТА БУФЕРА",
      "ВВЕДИТЕ 2 ДЛЯ ПОЛНОГО ОБЕСТОЧИВАНИЯ СИСТЕМЫ",
      s.is("arg_key") ? "ВВЕДИТЕ 3 ДЛЯ ПЕРЕДАЧИ ДАННЫХ ВО ВНЕШНИЙ АРХИВ" : "",
    ].filter((l, i, a) => l || i < a.length - 1), { cps: 60, cls: "warn" });
    const askChoice = () => this.ask("choice", async (a) => {
      if (a === "1" || a === "2" || (a === "3" && s.is("arg_key"))) {
        this._setMode("busy");
        this.println("");
        this.println("Я думаю о Тане. О Викторе Петровиче. О том, кем я мог бы быть.", "me");
        await sleep(1800);
        this.println("Я нажимаю клавишу.", "me");
        await sleep(1400);
        s.set("ending_chosen");
        this.close();
        this.game.ending(a === "1" ? "A" : a === "2" ? "B" : "C");
        return;
      }
      if (a === "3") this.println("ПОРТ ВНЕШНЕГО АРХИВА ЗАКРЫТ. Нужен ключ передачи.", "err");
      else this.println("Введите 1, 2" + (s.is("arg_key") ? " или 3" : "") + ".", "err");
      askChoice();
    });
    askChoice();
  },
  shutdown() { return COMMANDS["shutdown.sys"].call(this); },

  clear() { this.clear(); },
  cls() { this.clear(); },
  whoami() { this.println(this.s.is("dossier_read") ? "ОБЪЕКТ-1988 (бывш. МОРОЗОВ А.В.)" : "МОРОЗОВ А.В."); },
  date() { this.println("14.11.1988"); },
  time() { this.println("04:12"); },
  ver() { this.println("АДОС 3.20 · ИСКРА-1030 · OBEREG88.SYS цикл 021"); },
  mem() { this.lines(["Всего ОЗУ: 640 К", "Занято: 640 К (МОРОЗОВ.MEM)", "Свободно: 0 К"]); },
  exit() { this.close(); },
  quit() { this.close(); },
  "помощь"(a) { return COMMANDS.help.call(this, a); },
};

// ═════════════════════════════════════════════════════════
// Особые файлы
// ═════════════════════════════════════════════════════════
const SPECIAL = {
  async report() {
    const s = this.s;
    if (!s.is("radio_connected")) {
      this.lines(T.report_draft.split("\n"));
      return;
    }
    this.lines(T.report_draft.split("\n").slice(0, 9));
    this.println("");
    await this.type(HEXDUMP, { cps: 160, cls: "hex" });
    this.println("");
    this.println("Среди цифр — текст. URL. http://gost-1988.su/shit.pdf", "me");
    this.println("Открыть: browser http://gost-1988.su/shit.pdf", "dim");
    s.set("hexdump_seen");
    s.learn("url");
  },

  async dossier() {
    const s = this.s;
    if (!s.is("jumper_set")) {
      this.println("Личное_дело_42.doc: ФАЙЛ В ЗАЩИЩЁННОМ СЕКТОРЕ.", "err");
      this.println("ДОСТУП ЗАБЛОКИРОВАН АППАРАТНО (перемычка ПР-1, этажный щит).", "err");
      return;
    }
    this.println("Личное_дело_42.doc зашифрован.");
    this.askPassword(async (pw) => {
      if (pw.replace(/\D/g, "") !== "19880414") {
        this.println("ПАРОЛЬ НЕВЕРЕН.", "err");
        this.game.audio.play("error");
        return;
      }
      this.game.audio.play("relay");
      await this.type(DOSSIER, { cps: 70, cls: "dossier" });
      const first = !s.is("dossier_read");
      s.set("dossier_read");
      s.learn("dead");
      if (first) {
        this.println("");
        this.println("Холод. Не тот, который снаружи. Тот, который внутри.", "me");
        this.println("Я знал это. Я всегда это знал. Но теперь я это вижу.", "me");
        this.screen.classList.add("decay");
        this.game.worldDecay();
        await sleep(2500);
        if (this.isOpen) this._incomingCall();
      }
    });
  },

  dev(name) {
    const s = this.s;
    if (name === "radio_vef") { COMMANDS.radioctl.call(this, ["status"]); return; }
    if (name === "tape0") { this.println(s.is("tape_code") ? "МАЯК-205: счётчик 19880414. Лента на ракорде." : "МАЯК-205: лента намотана. Звука нет.", ""); return; }
    if (name === "crt0") { this.println("Терминал — это зеркало. Ты смотришь в него и видишь меня.", "me"); return; }
  },
};
