// Виртуальная ФС ИСКРА-ОС. Дерево: { type:'dir', children:{} } | { type:'file', content:'' }

const STORAGE_KEY = "iskra_os_vfs_v3";

function d(children = {}) { return { type: "dir", children }; }
function f(content = "") { return { type: "file", content }; }

function defaultTree() {
    return d({
        "Desktop": d({
            "Браузер.lnk":   f("app:browser"),
            "Проводник.lnk": f("app:finder"),
            "Блокнот.lnk":   f("app:notepad"),
            "Терминал.lnk":  f("app:terminal"),
            "Задачи.lnk":    f("app:quest"),
            "readme.txt":    f(
                "ИСКРА-ОС v1.42\n" +
                "ОЗУ: 640 КБ\n\n" +
                "ПКМ по рабочему столу — создать файл или папку.\n" +
                "ПКМ по иконке — переименовать или удалить.\n" +
                "ПУСК → Программы / Игры / Система.\n"
            ),
        }),
        "Мои_документы": d({
            "Отчёт_ОБ-88.doc":    f("ПРОЕКТ «ОБЕРЕГ-88». ЧЕРНОВИК.\n\nНе выключай питание до 04:12.\nЕсли увидишь себя — не отвечай.\n\n— А.В.М."),
            "Дневник.txt":        f("14.11.1988\n\nСнова 04:12. Я уже не уверен, что это тот же день.\nСтены помнят больше, чем я."),
            "Черновик_письма.txt":f("Товарищ Никитин В.П.,\nпрошу продлить сеанс ещё на один виток.\nУ меня почти получилось."),
        }),
        "Игры": d({}),
        "readme.txt": f(
            "ИСКРА-ОС v1.42 · 1988 · ВЦ «Прибор»\n\n" +
            "Рабочий стол — это каталог /Desktop.\n" +
            "Правый клик на пустом месте — создать папку или файл.\n" +
            "Правый клик на иконке — переименовать или удалить.\n"
        ),
    });
}

export class VFS {
    constructor() {
        this.root = this._load();
        this._subs = [];
    }
    _load() {
        try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
        return defaultTree();
    }
    _save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.root)); } catch (e) {} }
    _emit() { for (const fn of this._subs) fn(); }
    on(fn) { this._subs.push(fn); }
    reset() { this.root = defaultTree(); this._save(); this._emit(); }

    _split(p) { return Array.isArray(p) ? p.filter(Boolean) : String(p).split("/").filter(Boolean); }

    _walk(parts, make = false) {
        let node = this.root;
        for (const name of parts) {
            if (node.type !== "dir") return null;
            node.children = node.children || {};
            if (!node.children[name]) {
                if (!make) return null;
                node.children[name] = d();
            }
            node = node.children[name];
        }
        return node;
    }

    exists(p) { return this._walk(this._split(p)) != null; }
    isDir(p)  { const n = this._walk(this._split(p)); return !!n && n.type === "dir"; }

    ls(p) {
        const node = this._walk(this._split(p));
        if (!node || node.type !== "dir") return null;
        return Object.entries(node.children || {}).map(([name, n]) => ({
            name, type: n.type,
            size: n.type === "file" ? (n.content || "").length : 0,
        })).sort((a, b) =>
            a.type === b.type ? a.name.localeCompare(b.name, "ru") : (a.type === "dir" ? -1 : 1));
    }

    mkdir(p) {
        const parts = this._split(p);
        if (!parts.length) return { ok: false, err: "недопустимый путь" };
        const parent = this._walk(parts.slice(0, -1), true);
        const name = parts[parts.length - 1];
        if (parent.children[name]) return { ok: false, err: "уже существует" };
        parent.children[name] = d();
        this._save(); this._emit();
        return { ok: true };
    }

    writeFile(p, content = "") {
        const parts = this._split(p);
        if (!parts.length) return { ok: false, err: "недопустимый путь" };
        const parent = this._walk(parts.slice(0, -1), true);
        const name = parts[parts.length - 1];
        if (parent.children[name] && parent.children[name].type === "dir")
            return { ok: false, err: "это каталог" };
        parent.children[name] = f(String(content));
        this._save(); this._emit();
        return { ok: true };
    }

    read(p) { const n = this._walk(this._split(p)); return n && n.type === "file" ? (n.content || "") : null; }

    rm(p) {
        const parts = this._split(p);
        if (!parts.length) return { ok: false, err: "нельзя удалить корень" };
        const parent = this._walk(parts.slice(0, -1));
        const name = parts[parts.length - 1];
        if (!parent || !parent.children[name]) return { ok: false, err: "не найдено" };
        delete parent.children[name];
        this._save(); this._emit();
        return { ok: true };
    }

    rename(oldPath, newName) {
        const parts = this._split(oldPath);
        if (!parts.length) return { ok: false, err: "недопустимый путь" };
        const parent = this._walk(parts.slice(0, -1));
        const name = parts[parts.length - 1];
        const node = parent && parent.children[name];
        if (!node) return { ok: false, err: "не найдено" };
        if (parent.children[newName]) return { ok: false, err: "имя занято" };
        node && (parent.children[newName] = node);
        delete parent.children[name];
        this._save(); this._emit();
        return { ok: true };
    }
}