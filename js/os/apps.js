// Приложения ИСКРА-ОС.

import {
    notepadText, archiveText, personalText, nodeText, shutdownText,
    mailText, lateMailText, notesArchiveText,
} from "../data/terminal.js";
import { mountBrowser } from "./browser.js";

function joinPath(dir, name) { return (dir === "/" ? "" : dir) + "/" + name; }

// ─────────────────────────────────────────────────────────────
// ПРОВОДНИК
// ─────────────────────────────────────────────────────────────
function mountFinder(c, startPath = "/") {
    let path = startPath;
    const body = c.body;

    const toolbar = document.createElement("div");
    toolbar.className = "os-finder-toolbar";
    toolbar.innerHTML = ''
        + '<button data-act="up" title="Вверх">↑</button>'
        + '<button data-act="mkdir">+ Папка</button>'
        + '<button data-act="mkfile">+ Файл</button>'
        + '<div class="os-finder-crumb"></div>';
    const grid = document.createElement("div");
    grid.className = "os-finder-grid";
    body.appendChild(toolbar);
    body.appendChild(grid);
    const crumb = toolbar.querySelector(".os-finder-crumb");

    function openItem(it) {
        const full = joinPath(path, it.name);
        if (it.type === "dir") { path = full; refresh(); return; }
        const content = c.vfs.read(full) || "";
        if (content.startsWith("app:")) {
            c.os.launch(content.slice(4));
        } else {
            c.os.launch("notepad", { path: full });
        }
    }

    function refresh() {
        crumb.textContent = path;
        grid.innerHTML = "";
        const items = c.vfs.ls(path) || [];
        for (const it of items) {
            const el = document.createElement("div");
            el.className = "os-finder-item";
            const ico = document.createElement("span");
            ico.className = "ico";
            ico.textContent = it.type === "dir" ? "📁" : "📄";
            el.appendChild(ico);
            el.appendChild(document.createTextNode(it.name));
            el.addEventListener("dblclick", () => openItem(it));
            el.addEventListener("contextmenu", (e) => {
                e.preventDefault(); e.stopPropagation();
                c.os.showContextMenu(e.clientX, e.clientY, [
                    { label: "Открыть",    action: () => openItem(it) },
                    { label: "Переименовать", action: () => {
                            const nn = prompt("Новое имя:", it.name);
                            if (nn && nn !== it.name) c.vfs.rename(joinPath(path, it.name), nn);
                            refresh();
                        }},
                    { sep: true },
                    { label: "Удалить", danger: true, action: () => {
                            if (confirm(`Удалить «${it.name}»?`)) {
                                c.vfs.rm(joinPath(path, it.name));
                                refresh();
                            }
                        }},
                ]);
            });
            grid.appendChild(el);
        }
        if (!items.length) {
            const empty = document.createElement("div");
            empty.style.cssText = "color:#4a8a5a;padding:16px;font-size:13px";
            empty.textContent = "пусто";
            grid.appendChild(empty);
        }
    }

    toolbar.querySelector('[data-act="up"]').onclick = () => {
        if (path === "/" || path === "") return;
        const parts = path.split("/").filter(Boolean); parts.pop();
        path = "/" + parts.join("/"); refresh();
    };
    toolbar.querySelector('[data-act="mkdir"]').onclick = () => {
        const name = prompt("Имя папки:"); if (!name) return;
        const r = c.vfs.mkdir(joinPath(path, name));
        if (!r.ok) alert(r.err); refresh();
    };
    toolbar.querySelector('[data-act="mkfile"]').onclick = () => {
        const name = prompt("Имя файла:"); if (!name) return;
        const r = c.vfs.writeFile(joinPath(path, name), "");
        if (!r.ok) alert(r.err); refresh();
    };

    refresh();
}

// ─────────────────────────────────────────────────────────────
// БЛОКНОТ
// ─────────────────────────────────────────────────────────────
function mountNotepad(c, { path = null } = {}) {
    const body = c.body;
    const defPath = "/Мои_документы/новый.txt";

    const bar = document.createElement("div");
    bar.style.cssText = "display:flex;gap:8px;padding:0 0 8px;border-bottom:1px dashed #2a5a3a;margin-bottom:8px";
    const inp = document.createElement("input");
    inp.className = "os-np-path"; inp.style.flex = "1";
    inp.value = path || defPath;
    const btn = document.createElement("button");
    btn.className = "os-np-save"; btn.textContent = "Сохранить";
    bar.appendChild(inp); bar.appendChild(btn);

    const ta = document.createElement("textarea");
    ta.className = "os-np-text";
    ta.value = (path && c.vfs.read(path)) || "";

    body.appendChild(bar); body.appendChild(ta);
    btn.onclick = () => {
        const p = inp.value.trim(); if (!p) return;
        const r = c.vfs.writeFile(p, ta.value);
        if (!r.ok) alert(r.err); else c.os.toast("Сохранено: " + p);
    };
}

// ─────────────────────────────────────────────────────────────
// ТЕРМИНАЛ
// ─────────────────────────────────────────────────────────────
function mountTerminal(c) {
    const body = c.body;
    const out = document.createElement("div"); out.className = "os-term-out";
    const line = document.createElement("div"); line.className = "os-term-line";
    const pr = document.createElement("span"); pr.className = "os-term-prompt";
    const inp = document.createElement("input"); inp.className = "os-term-in";
    inp.autocomplete = "off"; inp.spellcheck = false;
    line.appendChild(pr); line.appendChild(inp);
    body.appendChild(out); body.appendChild(line);

    let cwd = ["/"]; const history = []; let hIdx = 0;
    const promptStr = () => "/" + cwd.slice(1).join("/") + ">";
    const refreshPrompt = () => { pr.textContent = promptStr() + " "; };
    function println(s = "") { out.textContent += s + "\n"; body.scrollTop = body.scrollHeight; }

    println("ИСКРА-ОС :: ТЕРМИНАЛ v1.42");
    println("Введите «help» для списка команд.");
    println("");
    refreshPrompt();
    setTimeout(() => inp.focus(), 0);

    function absPath(p) {
        if (!p) return cwd.slice();
        if (p.startsWith("/")) return p.split("/").filter(Boolean);
        const parts = cwd.slice();
        for (const seg of p.split("/").filter(Boolean)) {
            if (seg === ".") continue;
            if (seg === "..") { if (parts.length > 1) parts.pop(); continue; }
            parts.push(seg);
        }
        return parts;
    }

    const CMDS = {
        help() {
            println("Команды:");
            println("  help  ls  cd  pwd  cat  mkdir  touch");
            println("  echo текст > файл   rm   notes");
            println("  whoami  date  clear  exit");
        },
        ls(a) { const it = c.vfs.ls(absPath(a[0]));
            if (!it) { println("путь не найден"); return; }
            for (const x of it) println("  " + (x.type === "dir" ? "[D]" : "   ") + " " + x.name);
        },
        cd(a) { if (!a[0]) { cwd = ["/"]; refreshPrompt(); return; }
            const t = absPath(a[0]); if (!c.vfs.isDir(t)) { println("не каталог"); return; }
            cwd = t.length ? t : ["/"]; refreshPrompt(); },
        pwd() { println("/" + cwd.slice(1).join("/")); },
        cat(a) { if (!a[0]) { println("укажите файл"); return; }
            const t = c.vfs.read(absPath(a[0])); if (t == null) { println("не найден"); return; } println(t); },
        mkdir(a) { if (!a[0]) return; const r = c.vfs.mkdir(absPath(a[0])); if (!r.ok) println(r.err); },
        touch(a) { if (!a[0]) return; const r = c.vfs.writeFile(absPath(a[0]), ""); if (!r.ok) println(r.err); },
        rm(a) { if (!a[0]) return; const r = c.vfs.rm(absPath(a[0])); if (!r.ok) println(r.err); },
        echo(a, raw) {
            const m = raw.match(/^echo\s+(.*?)\s*>\s*(\S+)$/);
            if (!m) { println("формат: echo текст > файл"); return; }
            const r = c.vfs.writeFile(absPath(m[2]), m[1].replace(/^"(.*)"$/, "$1"));
            if (!r.ok) println(r.err);
        },
        clear() { out.textContent = ""; },
        whoami() { println("МОРОЗОВ А.В. (user-1)"); },
        date()   { println("14 ноября 1988 г.  04:12"); },
        notes() {
            const gm = c.game;
            if (!gm.noteLog || !gm.noteLog.length) { println("записок нет."); return; }
            for (const n of gm.noteLog) println("  — " + n.title);
            println("Всего: " + gm.noteLog.length);
        },
        exit() { c.os.closeWindow(c.window.id); },
    };

    function run(raw) {
        const t = raw.trim(); if (!t) return;
        println(promptStr() + " " + t);
        const parts = t.split(/\s+/); const cmd = parts[0]; const rest = parts.slice(1);
        const fn = CMDS[cmd];
        if (!fn) { println("команда не найдена: " + cmd); return; }
        try { fn(rest, t); } catch (e) { println("ошибка: " + e.message); }
    }

    inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { history.push(inp.value); hIdx = history.length; run(inp.value); inp.value = ""; }
        else if (e.key === "ArrowUp") { if (hIdx > 0) inp.value = history[--hIdx] || ""; e.preventDefault(); }
        else if (e.key === "ArrowDown") { if (hIdx < history.length - 1) inp.value = history[++hIdx] || ""; else { hIdx = history.length; inp.value = ""; } e.preventDefault(); }
    });
    body.addEventListener("click", (e) => { if (e.target === body || e.target === out) inp.focus(); });
}

// ─────────────────────────────────────────────────────────────
// НАСТРОЙКИ
// ─────────────────────────────────────────────────────────────
function mountSettings(c) {
    const body = c.body; const st = c.os.settings;
    body.innerHTML = "";

    const makeRow = (label, control) => {
        const w = document.createElement("div");
        w.className = "os-settings-row";
        const l = document.createElement("label"); l.textContent = label;
        w.appendChild(l); w.appendChild(control);
        body.appendChild(w); return w;
    };

    // Обои
    const selWall = document.createElement("select");
    [["grid","Зелёная сетка"],["plain","Пустота"],["stars","Звёзды"],["grid_blue","Синяя сетка"]]
        .forEach(([v, t]) => { const o = document.createElement("option"); o.value = v; o.textContent = t; selWall.appendChild(o); });
    selWall.value = st.wallpaper;
    selWall.onchange = () => { st.wallpaper = selWall.value; c.os.saveSettings(); c.os.applySettings(); };
    makeRow("Обои", selWall);

    // Масштаб
    const selScale = document.createElement("select");
    [["1",  "100%"],["1.2","120%"],["1.4","140%"],["1.6","160%"],["1.8","180%"]]
        .forEach(([v, t]) => { const o = document.createElement("option"); o.value = v; o.textContent = t; selScale.appendChild(o); });
    selScale.value = String(st.scale);
    selScale.onchange = () => { st.scale = parseFloat(selScale.value); c.os.saveSettings(); c.os.applySettings(); };
    makeRow("Масштаб интерфейса", selScale);

    // Сканлайны
    const cbScan = document.createElement("input"); cbScan.type = "checkbox"; cbScan.checked = !!st.scanlines;
    cbScan.onchange = () => { st.scanlines = cbScan.checked; c.os.saveSettings(); c.os.applySettings(); };
    makeRow("Сканлайны CRT", cbScan);

    // Звук
    const cbSnd = document.createElement("input"); cbSnd.type = "checkbox"; cbSnd.checked = !!st.sound;
    cbSnd.onchange = () => { st.sound = cbSnd.checked; c.os.saveSettings(); c.os.applySettings(); };
    makeRow("Звук системы", cbSnd);

    // Сброс ФС
    const dangerRow = document.createElement("div");
    dangerRow.className = "os-settings-row";
    dangerRow.style.cssText = "border-top:1px dashed #2a5a3a;margin-top:14px;padding-top:14px";
    const lbl = document.createElement("label"); lbl.style.color = "#c08080";
    lbl.textContent = "Сбросить файловую систему";
    const btn = document.createElement("button"); btn.textContent = "СБРОС";
    btn.onclick = () => {
        if (confirm("Сбросить всю файловую систему? Необратимо.")) {
            c.vfs.reset(); c.os.toast("Файловая система сброшена.");
        }
    };
    dangerRow.appendChild(lbl); dangerRow.appendChild(btn);
    body.appendChild(dangerRow);

    const ft = document.createElement("div");
    ft.style.cssText = "margin-top:24px;color:#4a8a5a;font-size:12px";
    ft.textContent = "ИСКРА-ОС v1.42 · 1988 · ВЦ «Прибор»";
    body.appendChild(ft);
}

// ─────────────────────────────────────────────────────────────
// САПЁР
// ─────────────────────────────────────────────────────────────
function mountMinesweeper(c) {
    const W = 9, H = 9, MINES = 10;
    let grid, reveal, flag, dead, win, flags;
    const body = c.body;
    body.innerHTML = ''
        + '<div class="os-game">'
        + '  <div class="info"><span class="os-min-info">Игра началась.</span></div>'
        + '  <div class="os-min-grid"></div>'
        + '  <div class="info"><button class="os-min-reset">Заново</button></div>'
        + '</div>';
    const gridEl = body.querySelector(".os-min-grid");
    const infoEl = body.querySelector(".os-min-info");

    function init() {
        grid = Array.from({length:H}, () => Array.from({length:W}, () => 0));
        reveal = Array.from({length:H}, () => Array.from({length:W}, () => false));
        flag   = Array.from({length:H}, () => Array.from({length:W}, () => false));
        dead = false; win = false; flags = 0;
        let placed = 0;
        while (placed < MINES) {
            const x = (Math.random()*W)|0, y = (Math.random()*H)|0;
            if (grid[y][x] === -1) continue;
            grid[y][x] = -1; placed++;
        }
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            if (grid[y][x] === -1) continue;
            let n = 0;
            for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) {
                const ny=y+dy, nx=x+dx;
                if (ny>=0 && ny<H && nx>=0 && nx<W && grid[ny][nx]===-1) n++;
            }
            grid[y][x] = n;
        }
        render(); infoEl.textContent = "Мин: " + (MINES-flags) + "   Флажков: " + flags;
    }
    function revealCell(x, y) {
        if (dead || win || reveal[y][x] || flag[y][x]) return;
        reveal[y][x] = true;
        if (grid[y][x] === -1) { dead = true; return; }
        if (grid[y][x] === 0)
            for (let dy=-1; dy<=1; dy++) for (let dx=-1; dx<=1; dx++) {
                const ny=y+dy, nx=x+dx;
                if (ny>=0 && ny<H && nx>=0 && nx<W && !reveal[ny][nx] && !flag[ny][nx]) revealCell(nx, ny);
            }
    }
    function checkWin() {
        let h = 0; for (let y=0; y<H; y++) for (let x=0; x<W; x++) if (!reveal[y][x]) h++;
        if (h === MINES) win = true;
    }
    function render() {
        gridEl.innerHTML = "";
        gridEl.style.display = "grid";
        gridEl.style.gridTemplateColumns = "repeat(" + W + ", 26px)";
        gridEl.style.gap = "2px";
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const b = document.createElement("button");
            b.style.cssText = "width:26px;height:26px;background:#0e2018;border:1px solid #2a5a3a;color:#d0ffd0;font-family:inherit;font-size:13px;cursor:pointer;padding:0";
            if (reveal[y][x]) {
                b.style.background = "#050b09";
                if (grid[y][x] === -1) { b.textContent = "✸"; b.style.color = "#ff8080"; }
                else if (grid[y][x] > 0) {
                    b.textContent = String(grid[y][x]);
                    const col = ["","#9effc0","#a0d0ff","#ffd090","#ff8080","#ff6060","#ff4040","#ff2020","#ff0000"][grid[y][x]];
                    b.style.color = col;
                }
            } else if (flag[y][x]) { b.textContent = "⚑"; b.style.color = "#ffd090"; }
            b.onclick = () => {
                if (dead || win) return;
                revealCell(x, y); checkWin(); render();
                if (dead) {
                    infoEl.textContent = "ВЗРЫВ.";
                    for (let yy=0; yy<H; yy++) for (let xx=0; xx<W; xx++) if (grid[yy][xx]===-1) reveal[yy][xx]=true;
                    render();
                } else if (win) infoEl.textContent = "Поле разминировано.";
                else infoEl.textContent = "Мин: " + (MINES-flags) + "   Флажков: " + flags;
            };
            b.oncontextmenu = (e) => {
                e.preventDefault();
                if (dead || win || reveal[y][x]) return;
                flag[y][x] = !flag[y][x];
                flags += flag[y][x] ? 1 : -1;
                render(); infoEl.textContent = "Мин: " + (MINES-flags) + "   Флажков: " + flags;
            };
            gridEl.appendChild(b);
        }
    }
    body.querySelector(".os-min-reset").onclick = () => init();
    init();
}

// ─────────────────────────────────────────────────────────────
// ЗМЕЙКА
// ─────────────────────────────────────────────────────────────
function mountSnake(c) {
    const COLS = 22, ROWS = 16, CELL = 18;
    const body = c.body;
    body.innerHTML = ''
        + '<div class="os-game">'
        + '  <div class="info"><span class="os-snk-score">Очки: 0</span></div>'
        + '  <canvas width="' + (COLS*CELL) + '" height="' + (ROWS*CELL) + '"></canvas>'
        + '  <div class="info">Стрелки — движение · Пробел — рестарт</div>'
        + '</div>';
    const cv = body.querySelector("canvas");
    const g = cv.getContext("2d");
    const scoreEl = body.querySelector(".os-snk-score");
    let snake, dir, next, food, dead, score, lastTick, interval;

    function reset() {
        snake = [{x:5,y:7},{x:4,y:7},{x:3,y:7}];
        dir = {x:1,y:0}; next = {x:1,y:0};
        food = {x:12,y:7};
        dead = false; score = 0; lastTick = 0; interval = 120;
        scoreEl.textContent = "Очки: 0";
    }
    function step() {
        dir = next;
        const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};
        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) { dead = true; return; }
        for (const s of snake) if (s.x === head.x && s.y === head.y) { dead = true; return; }
        snake.unshift(head);
        if (head.x === food.x && head.y === food.y) {
            score += 10; scoreEl.textContent = "Очки: " + score;
            do { food = {x:(Math.random()*COLS)|0, y:(Math.random()*ROWS)|0}; }
            while (snake.some(s => s.x===food.x && s.y===food.y));
        } else snake.pop();
    }
    function draw() {
        g.fillStyle = "#050b09"; g.fillRect(0,0,cv.width,cv.height);
        g.strokeStyle = "#0e2a1a";
        for (let x=0; x<=COLS; x++){ g.beginPath(); g.moveTo(x*CELL,0); g.lineTo(x*CELL,cv.height); g.stroke(); }
        for (let y=0; y<=ROWS; y++){ g.beginPath(); g.moveTo(0,y*CELL); g.lineTo(cv.width,y*CELL); g.stroke(); }
        g.fillStyle = "#a0d0ff";
        g.fillRect(food.x*CELL+2, food.y*CELL+2, CELL-4, CELL-4);
        g.fillStyle = dead ? "#ff6060" : "#6ee68e";
        for (const s of snake) g.fillRect(s.x*CELL+1, s.y*CELL+1, CELL-2, CELL-2);
        if (dead) {
            g.fillStyle = "rgba(0,0,0,0.65)"; g.fillRect(0,0,cv.width,cv.height);
            g.fillStyle = "#ff8080"; g.font = "24px Courier New"; g.textAlign = "center";
            g.fillText("ИГРА ОКОНЧЕНА", cv.width/2, cv.height/2);
            g.fillStyle = "#d0ffd0"; g.font = "13px Courier New";
            g.fillText("ПРОБЕЛ — рестарт", cv.width/2, cv.height/2 + 26);
        }
    }
    function loop(t) {
        if (!cv.isConnected) return;
        if (!dead && t - lastTick > interval) { step(); lastTick = t; draw(); }
        else if (dead) draw();
        else if (t - lastTick > 40) { draw(); lastTick = t; }
        requestAnimationFrame(loop);
    }
    cv.tabIndex = 0;
    cv.addEventListener("keydown", (e) => {
        if (e.key === " " && dead) { reset(); e.preventDefault(); return; }
        if (e.key === "ArrowUp"    && dir.y === 0) next = {x:0,y:-1};
        else if (e.key === "ArrowDown"  && dir.y === 0) next = {x:0,y:1};
        else if (e.key === "ArrowLeft"  && dir.x === 0) next = {x:-1,y:0};
        else if (e.key === "ArrowRight" && dir.x === 0) next = {x:1,y:0};
        else return;
        e.preventDefault();
    });
    setTimeout(() => cv.focus(), 0);
    reset(); requestAnimationFrame(loop);
}

// ─────────────────────────────────────────────────────────────
// ЗАДАЧИ
// ─────────────────────────────────────────────────────────────
function mountQuest(c) {
    const gm = c.game; const body = c.body;
    const sections = [
        { k: "notepad",  label: "1. Блокнот.exe",              fn: notepadText },
        { k: "notes",    label: "2. Записки.arc",              fn: notesArchiveText },
        { k: "mail",     label: "3. Почта.mbx",                fn: (g) => g.loopCount >= 3 ? lateMailText(g) : mailText(g) },
        { k: "archive",  label: "4. Архив_НИИ.url",            fn: archiveText },
        { k: "personal", label: "5. Личное_дело_42.doc",       fn: personalText },
        { k: "node",     label: "6. node_1988_clone://",       fn: (g) => g.notesRead.size < 3
                ? "// УЗЕЛ 1988 //\n\nДОСТУП ЗАКРЫТ.\n\nТребуется минимум 3 записки.\nНайдено: " + g.notesRead.size + "/3"
                : nodeText(g) },
    ];
    if (gm.flags.node_visited) sections.push({ k: "shutdown", label: "shutdown.sys", fn: shutdownText, danger: true });

    const wrap = document.createElement("div"); wrap.className = "os-quest";
    const menu = document.createElement("ul");   menu.className = "os-quest-menu";
    const pre  = document.createElement("pre");  pre.className = "os-quest-content";
    wrap.appendChild(menu); wrap.appendChild(pre); body.appendChild(wrap);

    let cur = "notepad";
    function render() {
        const sec = sections.find(s => s.k === cur);
        pre.textContent = sec ? sec.fn(gm) : "";
        menu.querySelectorAll("li").forEach(li => li.classList.toggle("active", li.dataset.k === cur));
    }
    for (const s of sections) {
        const li = document.createElement("li");
        li.dataset.k = s.k; li.textContent = s.label;
        if (s.danger) li.classList.add("danger");
        li.onclick = () => { cur = s.k; render(); };
        menu.appendChild(li);
    }
    render();
    pre.tabIndex = 0;
    pre.addEventListener("keydown", (e) => {
        if (cur === "shutdown") {
            if (e.key === "1") { c.os.closeWindow(c.window.id); gm.restartLoop(); }
            else if (e.key === "2") { c.os.closeWindow(c.window.id); gm.triggerEnding(); }
        }
    });
    setTimeout(() => pre.focus(), 0);
    menu.addEventListener("click", () => pre.focus());
}

// ─────────────────────────────────────────────────────────────
// Реестр приложений
// ─────────────────────────────────────────────────────────────
export const APPS = {
    browser:     { title: "Браузер",       icon: "🌐", w: 900, h: 620, cat: "net",  mount: mountBrowser },
    finder:      { title: "Проводник",     icon: "🗂", w: 660, h: 460, cat: "sys",  mount: (c) => mountFinder(c, "/") },
    documents:   { title: "Документы",     icon: "📂", w: 620, h: 420, cat: "sys",  mount: (c) => mountFinder(c, "/Мои_документы") },
    notepad:     { title: "Блокнот",       icon: "✎", w: 620, h: 480, cat: "sys",  mount: mountNotepad },
    terminal:    { title: "Терминал",      icon: "▮", w: 720, h: 460, cat: "sys",  mount: mountTerminal },
    quest:       { title: "Задачи",        icon: "⌘", w: 740, h: 520, cat: "sys",  mount: mountQuest },
    settings:    { title: "Настройки",     icon: "⚙", w: 540, h: 400, cat: "sys",  mount: mountSettings },
    minesweeper: { title: "Сапёр",         icon: "💣", w: 320, h: 400, cat: "game", mount: mountMinesweeper },
    snake:       { title: "Змейка",        icon: "🐍", w: 500, h: 430, cat: "game", mount: mountSnake },
};