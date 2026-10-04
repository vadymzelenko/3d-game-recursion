// Браузер ИСКРА-ОС. Настоящий iframe + список проверенных сайтов.
//
// Большинство сайтов запрещают встраивание через X-Frame-Options / CSP,
// поэтому к каждому адресу есть кнопка «Открыть в новой вкладке».

const BOOKMARKS = [
    { group: "Поиск", items: [
            { name: "DuckDuckGo Lite",  url: "https://lite.duckduckgo.com/lite/" },
            { name: "DuckDuckGo HTML",  url: "https://html.duckduckgo.com/html/" },
            { name: "Searx.be",         url: "https://searx.be/" },
            { name: "Wikipedia Search", url: "https://ru.m.wikipedia.org/wiki/Служебная:Поиск" },
        ]},
    { group: "Знания", items: [
            { name: "Википедия RU",     url: "https://ru.m.wikipedia.org/" },
            { name: "Wikipedia EN",     url: "https://en.m.wikipedia.org/" },
            { name: "Викисловарь",      url: "https://ru.m.wiktionary.org/" },
            { name: "Викицитатник",     url: "https://ru.m.wikiquote.org/" },
        ]},
    { group: "Архивы и книги", items: [
            { name: "Project Gutenberg",url: "https://www.gutenberg.org/" },
            { name: "Internet Archive", url: "https://archive.org/" },
            { name: "Open Library",     url: "https://openlibrary.org/" },
            { name: "Standard Ebooks",  url: "https://standardebooks.org/" },
        ]},
    { group: "Разработка", items: [
            { name: "MDN",              url: "https://developer.mozilla.org/ru/" },
            { name: "DevDocs",          url: "https://devdocs.io/" },
            { name: "Can I Use",        url: "https://caniuse.com/" },
            { name: "Hacker News",      url: "https://news.ycombinator.com/" },
        ]},
    { group: "Инструменты", items: [
            { name: "httpbin",          url: "https://httpbin.org/" },
            { name: "JSONPlaceholder",  url: "https://jsonplaceholder.typicode.com/" },
            { name: "Example.com",      url: "https://example.com/" },
            { name: "Time.is",          url: "https://time.is/" },
        ]},
    { group: "Погода / Мир", items: [
            { name: "Open-Meteo",       url: "https://open-meteo.com/" },
            { name: "SunCalc",          url: "https://www.suncalc.org/" },
        ]},
];

export function mountBrowser(c) {
    const body = c.body;
    body.style.display = "flex";
    body.style.flexDirection = "column";
    body.style.padding = "0";
    body.style.overflow = "hidden";

    body.innerHTML = `
    <div class="br-toolbar">
      <button class="br-btn" data-a="back" title="Назад">◀</button>
      <button class="br-btn" data-a="fwd"  title="Вперёд">▶</button>
      <button class="br-btn" data-a="reload" title="Обновить">⟳</button>
      <input class="br-url" placeholder="Адрес или поиск…" spellcheck="false" autocomplete="off" />
      <button class="br-btn" data-a="go">Открыть</button>
      <button class="br-btn br-ext" data-a="external" title="Открыть в новой вкладке">↗</button>
    </div>
    <div class="br-hint">
      <span class="br-hint-txt">Часть сайтов запрещает встраивание. Если страница пустая — нажмите «↗».</span>
    </div>
    <div class="br-main">
      <div class="br-side">
        <div class="br-side-title">ЗАКЛАДКИ</div>
        <div class="br-side-list"></div>
      </div>
      <div class="br-view">
        <div class="br-home">
          <div class="br-home-title">ИСКРА-NET · v1.0</div>
          <div class="br-home-sub">Список доступных ресурсов сети</div>
          <div class="br-home-grid"></div>
        </div>
        <iframe class="br-frame" style="display:none"></iframe>
      </div>
    </div>`;

    const $url  = body.querySelector(".br-url");
    const $side = body.querySelector(".br-side-list");
    const $home = body.querySelector(".br-home");
    const $homeGrid = body.querySelector(".br-home-grid");
    const $frame = body.querySelector(".br-frame");
    const $hint = body.querySelector(".br-hint");

    let history = [];
    let hIdx = -1;

    function normalize(input) {
        const s = input.trim();
        if (!s) return "";
        if (/^https?:\/\//i.test(s)) return s;
        if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(s)) return "https://" + s;
        return "https://lite.duckduckgo.com/lite/?q=" + encodeURIComponent(s);
    }

    function navigate(url, push = true) {
        url = normalize(url);
        if (!url) return;
        if (push) {
            history = history.slice(0, hIdx + 1);
            history.push(url);
            hIdx = history.length - 1;
        }
        $url.value = url;
        $home.style.display = "none";
        $frame.style.display = "block";
        $frame.src = url;
        $hint.classList.add("show");
        setTimeout(() => $hint.classList.remove("show"), 4000);
    }

    function goHome() {
        $frame.src = "about:blank";
        $frame.style.display = "none";
        $home.style.display = "block";
        $url.value = "";
    }

    // ── Боковая панель закладок ────────────────────────────────
    for (const grp of BOOKMARKS) {
        const g = document.createElement("div");
        g.className = "br-side-group";
        g.textContent = grp.group;
        $side.appendChild(g);
        for (const bm of grp.items) {
            const it = document.createElement("div");
            it.className = "br-side-item";
            it.textContent = bm.name;
            it.title = bm.url;
            it.onclick = () => navigate(bm.url);
            $side.appendChild(it);
        }
    }

    // ── Домашняя страница ──────────────────────────────────────
    $homeGrid.innerHTML = "";
    for (const grp of BOOKMARKS) {
        const card = document.createElement("div");
        card.className = "br-home-group";
        const h = document.createElement("div");
        h.className = "br-home-group-title";
        h.textContent = grp.group;
        card.appendChild(h);
        for (const bm of grp.items) {
            const a = document.createElement("div");
            a.className = "br-home-link";
            a.textContent = bm.name;
            a.title = bm.url;
            a.onclick = () => navigate(bm.url);
            card.appendChild(a);
        }
        $homeGrid.appendChild(card);
    }

    // ── Тулбар ─────────────────────────────────────────────────
    body.querySelector('[data-a="back"]').onclick = () => {
        if (hIdx > 0) { hIdx--; navigate(history[hIdx], false); }
    };
    body.querySelector('[data-a="fwd"]').onclick = () => {
        if (hIdx < history.length - 1) { hIdx++; navigate(history[hIdx], false); }
    };
    body.querySelector('[data-a="reload"]').onclick = () => {
        if ($frame.style.display === "none") return;
        $frame.src = $frame.src;
    };
    body.querySelector('[data-a="go"]').onclick = () => {
        const v = $url.value.trim();
        if (!v) { goHome(); return; }
        navigate(v);
    };
    body.querySelector('[data-a="external"]').onclick = () => {
        const url = $url.value || $frame.src;
        if (url && url !== "about:blank") window.open(url, "_blank", "noopener");
    };
    $url.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const v = $url.value.trim();
            if (!v) { goHome(); return; }
            navigate(v);
        } else if (e.key === "Backspace" && (e.ctrlKey || e.metaKey)) {
            goHome();
        }
    });

    goHome();
    setTimeout(() => $url.focus(), 0);
}