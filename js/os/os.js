// ИСКРА-ОС — рабочий стол, окна, ПУСК, контекстные меню, панель задач.

import { VFS } from "./vfs.js";
import { APPS } from "./apps.js";

const SETTINGS_KEY = "iskra_os_settings_v3";

export class OSShell {
    constructor(game) {
        this.game = game;
        this.vfs = new VFS();
        this.windows = new Map();
        this.zTop = 5;
        this.settings = this._loadSettings();

        this.root = document.getElementById("os");
        if (!this.root) { console.error("OS: #os не найден"); return; }
        this.desktopEl   = this.root.querySelector("#os-desktop");
        this.taskbarEl   = this.root.querySelector("#os-taskbar");
        this.startMenuEl = this.root.querySelector("#os-start-menu");
        this.clockEl     = this.root.querySelector("#os-clock");
        this.startBtn    = this.root.querySelector("#os-start-btn");

        this._bindGlobal();
        this.vfs.on(() => this._refreshDesktop());
        this._renderStartMenu();
        this._refreshDesktop();
        this.applySettings();
        this._startClock();
    }

    // ── Управление из Game ────────────────────────────────────
    open()  { this.root?.classList.remove("hidden"); this._refreshDesktop(); }
    close() { this.root?.classList.add("hidden"); this._hideContextMenu(); this._closeStart(); }
    isOpen() { return this.root && !this.root.classList.contains("hidden"); }

    // ── Настройки ─────────────────────────────────────────────
    _loadSettings() {
        try { const r = localStorage.getItem(SETTINGS_KEY); if (r) return JSON.parse(r); } catch (e) {}
        return { wallpaper: "grid", scanlines: true, sound: true, scale: 1.4 };
    }
    saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch (e) {} }
    applySettings() {
        if (!this.root) return;
        this.root.dataset.wallpaper = this.settings.wallpaper;
        this.root.classList.toggle("no-scanlines", !this.settings.scanlines);
        this.root.style.zoom = String(this.settings.scale || 1);
    }

    // ── ПКМ-меню ──────────────────────────────────────────────
    showContextMenu(x, y, items) {
        this._hideContextMenu();
        const menu = document.createElement("div");
        menu.className = "os-ctx";
        for (const it of items) {
            if (it.sep) {
                const s = document.createElement("div"); s.className = "os-ctx-sep";
                menu.appendChild(s); continue;
            }
            const el = document.createElement("div");
            el.className = "os-ctx-item" + (it.danger ? " danger" : "");
            el.textContent = it.label;
            el.onclick = (e) => { e.stopPropagation(); this._hideContextMenu(); it.action && it.action(); };
            menu.appendChild(el);
        }
        menu.style.left = Math.min(x, window.innerWidth - 220) + "px";
        menu.style.top  = Math.min(y, window.innerHeight - 40) + "px";
        this.root.appendChild(menu);
        this._ctxMenu = menu;
    }
    _hideContextMenu() { if (this._ctxMenu) { this._ctxMenu.remove(); this._ctxMenu = null; } }

    _bindGlobal() {
        this.startBtn.addEventListener("click", (e) => { e.stopPropagation(); this._toggleStart(); });

        this.root.addEventListener("mousedown", (e) => {
            if (!this.startMenuEl.contains(e.target) && e.target !== this.startBtn) this._closeStart();
            if (!this._ctxMenu) return;
            if (!this._ctxMenu.contains(e.target)) this._hideContextMenu();
        });

        // ПКМ по пустому месту рабочего стола
        this.desktopEl.addEventListener("contextmenu", (e) => {
            if (e.target.closest(".os-icon")) return;
            e.preventDefault();
            this.showContextMenu(e.clientX, e.clientY, [
                { label: "Создать папку",        action: () => this._desktopCreate("dir") },
                { label: "Создать текстовый файл", action: () => this._desktopCreate("file") },
                { sep: true },
                { label: "Обновить", action: () => this._refreshDesktop() },
                { label: "Настройки", action: () => this.launch("settings") },
            ]);
        });
    }

    // ── Рабочий стол ──────────────────────────────────────────
    _refreshDesktop() {
        if (!this.desktopEl) return;
        this.desktopEl.querySelectorAll(".os-icon").forEach(el => el.remove());
        const items = this.vfs.ls("/Desktop") || [];
        const rows = Math.max(3, Math.floor((this.desktopEl.clientHeight - 40) / 108));
        let i = 0;
        for (const it of items) {
            const el = document.createElement("div");
            el.className = "os-icon";
            const col = Math.floor(i / rows), row = i % rows;
            el.style.left = (16 + col * 108) + "px";
            el.style.top  = (16 + row * 108) + "px";

            let ico = it.type === "dir" ? "📁" : "📄";
            let launch = null;
            if (it.type === "file") {
                const content = this.vfs.read("/Desktop/" + it.name) || "";
                if (content.startsWith("app:")) {
                    const id = content.slice(4);
                    if (APPS[id]) { ico = APPS[id].icon; launch = () => this.launch(id); }
                }
                if (!launch) launch = () => this.launch("notepad", { path: "/Desktop/" + it.name });
            } else {
                launch = () => this.launch("finder", { path: "/Desktop/" + it.name });
            }

            const icoEl = document.createElement("span");
            icoEl.className = "ico"; icoEl.textContent = ico;
            el.appendChild(icoEl);
            el.appendChild(document.createTextNode(it.name));

            el.ondblclick = launch;
            el.addEventListener("contextmenu", (e) => {
                e.preventDefault(); e.stopPropagation();
                this.showContextMenu(e.clientX, e.clientY, [
                    { label: "Открыть", action: launch },
                    { label: "Переименовать", action: () => {
                            const nn = prompt("Новое имя:", it.name);
                            if (nn && nn !== it.name) this.vfs.rename("/Desktop/" + it.name, nn);
                        }},
                    { sep: true },
                    { label: "Удалить", danger: true, action: () => {
                            if (confirm(`Удалить «${it.name}»?`)) this.vfs.rm("/Desktop/" + it.name);
                        }},
                ]);
            });
            this.desktopEl.appendChild(el);
            i++;
        }
    }

    _desktopCreate(kind) {
        const def = kind === "dir" ? "Новая папка" : "Новый файл.txt";
        const name = prompt(kind === "dir" ? "Имя папки:" : "Имя файла:", def);
        if (!name) return;
        if (kind === "dir") this.vfs.mkdir("/Desktop/" + name);
        else                this.vfs.writeFile("/Desktop/" + name, "");
    }

    // ── ПУСК ──────────────────────────────────────────────────
    _renderStartMenu() {
        const menu = this.startMenuEl;
        menu.innerHTML = "";

        const head = document.createElement("div");
        head.className = "os-start-head";
        head.textContent = "ИСКРА-ОС";
        menu.appendChild(head);

        const groups = [
            { title: "ПРОГРАММЫ", cat: "net"  },
            { title: "СИСТЕМА",   cat: "sys"  },
            { title: "ИГРЫ",      cat: "game" },
        ];

        for (const g of groups) {
            const t = document.createElement("div");
            t.className = "os-start-group-title";
            t.textContent = g.title;
            menu.appendChild(t);

            const entries = Object.entries(APPS).filter(([, a]) => a.cat === g.cat);
            for (const [id, app] of entries) {
                const el = document.createElement("div");
                el.className = "os-start-item";
                const si = document.createElement("span"); si.className = "si"; si.textContent = app.icon;
                const lab = document.createElement("span"); lab.textContent = app.title;
                el.appendChild(si); el.appendChild(lab);
                el.onclick = () => { this._closeStart(); this.launch(id); };
                menu.appendChild(el);
            }
        }

        const sep = document.createElement("div");
        sep.className = "os-start-sep";
        menu.appendChild(sep);

        const shutdown = document.createElement("div");
        shutdown.className = "os-start-item danger";
        const si = document.createElement("span"); si.className = "si"; si.textContent = "⏻";
        const lab = document.createElement("span"); lab.textContent = "Завершить сеанс";
        shutdown.appendChild(si); shutdown.appendChild(lab);
        shutdown.onclick = () => { this._closeStart(); this.game.closeComputer(); };
        menu.appendChild(shutdown);
    }
    _toggleStart() { this.startMenuEl.classList.toggle("hidden"); }
    _closeStart()  { this.startMenuEl.classList.add("hidden"); }

    // ── Окна ──────────────────────────────────────────────────
    launch(id, args = {}) {
        const app = APPS[id];
        if (!app) { console.warn("unknown app:", id); return; }
        const wid = id + ":" + Date.now().toString(36);
        this._openWindow({ id: wid, appId: id, title: app.title, icon: app.icon, w: app.w, h: app.h, mount: app.mount, args });
    }

    _openWindow({ id, appId, title, icon, w, h, mount, args }) {
        const el = document.createElement("div");
        el.className = "os-window";
        el.style.width  = w + "px";
        el.style.height = h + "px";
        const idx = this.windows.size;
        el.style.left = (60 + (idx % 6) * 30) + "px";
        el.style.top  = (40 + (idx % 6) * 30) + "px";
        el.innerHTML = ''
            + '<div class="os-title">'
            +   '<span class="os-title-ico"></span>'
            +   '<span class="os-title-name"></span>'
            +   '<button class="os-tb-btn os-min" title="Свернуть">—</button>'
            +   '<button class="os-tb-btn os-close" title="Закрыть">×</button>'
            + '</div>'
            + '<div class="os-body"></div>';
        el.querySelector(".os-title-ico").textContent = icon;
        el.querySelector(".os-title-name").textContent = title;
        this.desktopEl.appendChild(el);

        const body = el.querySelector(".os-body");
        const win = { id, appId, title, icon, el, body, args, minimized: false };

        el.querySelector(".os-close").onclick = () => this.closeWindow(id);
        el.querySelector(".os-min").onclick   = () => this._toggleMinimize(id);
        el.addEventListener("mousedown", () => this._focus(id), true);
        this._draggable(el, el.querySelector(".os-title"));

        this.windows.set(id, win);
        this._focus(id);
        this._refreshTaskbar();

        try { mount({ os: this, vfs: this.vfs, game: this.game, window: win, body }); }
        catch (e) {
            console.error("app crash:", appId, e);
            body.innerHTML = '<div style="color:#ff8080;padding:12px">Приложение завершилось с ошибкой.</div>';
        }
    }

    closeWindow(id) {
        const win = this.windows.get(id);
        if (!win) return;
        win.el.remove();
        this.windows.delete(id);
        this._refreshTaskbar();
        const last = [...this.windows.keys()].pop();
        if (last) this._focus(last);
    }

    _toggleMinimize(id) {
        const win = this.windows.get(id);
        if (!win) return;
        win.minimized = !win.minimized;
        win.el.style.display = win.minimized ? "none" : "flex";
        this._refreshTaskbar();
    }

    _focus(id) {
        const win = this.windows.get(id);
        if (!win) return;
        if (win.minimized) { win.minimized = false; win.el.style.display = "flex"; }
        win.el.style.zIndex = ++this.zTop;
        for (const [k, w] of this.windows) w.el.classList.toggle("focused", k === id);
        this._refreshTaskbar();
    }

    _refreshTaskbar() {
        this.taskbarEl.querySelectorAll(".os-win-btn").forEach(b => b.remove());
        for (const [id, w] of this.windows) {
            const btn = document.createElement("button");
            btn.className = "os-win-btn";
            btn.textContent = w.icon + " " + w.title;
            btn.classList.toggle("active", w.el.classList.contains("focused"));
            btn.onclick = () => this._toggleMinimize(id);
            this.taskbarEl.appendChild(btn);
        }
    }

    _draggable(el, handle) {
        let dx = 0, dy = 0, dragging = false;
        handle.addEventListener("mousedown", (e) => {
            if (e.target.closest(".os-tb-btn")) return;
            dragging = true;
            dx = e.clientX - el.offsetLeft;
            dy = e.clientY - el.offsetTop;
            e.preventDefault();
        });
        window.addEventListener("mousemove", (e) => {
            if (!dragging) return;
            el.style.left = Math.max(0, Math.min(window.innerWidth - 60, e.clientX - dx)) + "px";
            el.style.top  = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dy)) + "px";
        });
        window.addEventListener("mouseup", () => { dragging = false; });
    }

    // ── Утилиты ───────────────────────────────────────────────
    toast(msg, ms = 2400) {
        const el = document.createElement("div");
        el.className = "os-toast";
        el.textContent = msg;
        this.root.appendChild(el);
        setTimeout(() => el.classList.add("show"), 10);
        setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 320); }, ms);
    }

    _startClock() {
        const tick = () => {
            if (!this.clockEl) return;
            const d = new Date();
            const hh = String(d.getHours()).padStart(2, "0");
            const mm = String(d.getMinutes()).padStart(2, "0");
            this.clockEl.textContent = "04:12  ·  " + hh + ":" + mm;
            setTimeout(tick, 10000);
        };
        tick();
    }

    handleEsc() {
        if (this._ctxMenu) { this._hideContextMenu(); return true; }
        if (!this.startMenuEl.classList.contains("hidden")) { this._closeStart(); return true; }
        return false;
    }
}