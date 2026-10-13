// Десять актов. Каждый акт — список шагов (видны в тетради), условие
// завершения и действия при старте. Режиссёр слушает шину событий и
// переводит игру от акта к акту; сами сцены ничего об актах не знают —
// они смотрят только на флаги состояния.

export const ACTS = [
  {
    n: 1, roman: "I", title: "ДЕКОМПИЛЯЦИЯ РЕАЛЬНОСТИ",
    epigraph: "Я открываю глаза. Настенные часы стоят на 04:12.",
    steps: [
      { text: "Посмотреть на часы", done: s => s.knows("date") },
      { text: "Осмотреть квартиру (кухня, ванная, шкаф…)", done: s => s.is("looked_home") },
      { text: "Снять трубку телефона в коридоре", done: s => s.is("phone_heard") },
      { text: "Выйти на лестничную клетку", done: s => s.is("been_hallway") },
      { text: "Спуститься по лестнице до самого низа", done: s => s.is("looped") },
      { text: "Вахтёрская (кв. 40): журнал дежурств", done: s => s.knows("journal40") },
      { text: "Найти ключ от щитовой", done: s => s.has("key_shield") || s.is("power_on") },
      { text: "Найти запасной синий предохранитель", done: s => s.has("fuse_blue") || s.is("power_on") },
      { text: "Квартира 41: доска с формулами", done: s => s.knows("graffiti") },
      { text: "Квартира 41: ящик рабочего стола", done: s => s.has("key_lab3") },
      { text: "Дать свет в подъезд", done: s => s.is("power_on") },
    ],
  },
  {
    n: 2, roman: "II", title: "ИНФОРМАЦИОННАЯ ЭНТРОПИЯ",
    epigraph: "Свет открыл двери, которые раньше были заперты.",
    steps: [
      { text: "Квартира 20 приоткрыта. Библиотека", done: s => s.is("visited_20") },
      { text: "Библиотечный формуляр", done: s => s.hasRead("formular20") },
      { text: "Найти на полках мою рукопись", done: s => s.is("manuscript_found") },
      { text: "Прочитать рукопись", done: s => s.hasRead("manuscript20") },
      { text: "Разобраться с шахматным этюдом", done: s => s.has("punchcard") },
    ],
    start: s => s.set("unlock_20"),
  },
  {
    n: 3, roman: "III", title: "СОМАТИЧЕСКИЙ РАСПАД",
    epigraph: "Коридор пахнет карболкой. Дверь квартиры 30 приоткрыта.",
    steps: [
      { text: "Лазарет: капельница", done: s => s.is("saw_drip") },
      { text: "Лазарет: кардиомонитор", done: s => s.is("saw_ecg") },
      { text: "Лазарет: аптечка", done: s => s.is("saw_medkit") },
      { text: "Лазарет: выписка из истории болезни", done: s => s.hasRead("ward30") },
      { text: "Лазарет: окно", done: s => s.is("saw_window") },
    ],
    start: s => s.set("unlock_30"),
  },
  {
    n: 4, roman: "IV", title: "БЮРОКРАТИЧЕСКИЙ КОШМАР",
    epigraph: "Я возвращаюсь в квартиру 40. Но теперь она другая.",
    steps: [
      { text: "Вернуться в вахтёрскую (кв. 40)", done: s => s.is("visited_40_iv") },
      { text: "Прочитать, что печатает машинка", done: s => s.hasRead("typewriter40") },
      { text: "Найти своё личное дело на стеллажах", done: s => s.is("file_found") },
      { text: "Штампы на фотографии", done: s => s.is("stamped") },
      { text: "Зеркало в углу", done: s => s.is("mirror40") },
    ],
    start: s => s.set("bureau"),
  },
  {
    n: 5, roman: "V", title: "РАЦИОНАЛЬНОЕ ЯДРО",
    epigraph: "Дверь квартиры 41 открыта. Физик. Рациональное ядро.",
    steps: [
      { text: "Тетрадь физика", done: s => s.hasRead("note41") },
      { text: "Настроить «ВЭФ-202» на частоту с перфокарты", done: s => s.is("radio_tuned") },
      { text: "Записать координаты", done: s => s.knows("coords") },
    ],
  },
  {
    n: 6, roman: "VI", title: "АКУСТИЧЕСКАЯ БЕЗДНА",
    epigraph: "Квартира 43. Стена, зашитая перфолентами.",
    steps: [
      { text: "Перфоленты на стене", done: s => s.hasRead("tape43") },
      { text: "Магнитофон «Маяк-205»", done: s => s.is("tape_code") },
      { text: "Наушники", done: s => s.is("headphones") },
      { text: "Обрывок на столике", done: s => s.hasRead("scrap43") },
    ],
    start: s => s.set("unlock_43"),
  },
  {
    n: 7, roman: "VII", title: "ДИССОЦИАЦИЯ",
    epigraph: "В центре комнаты — кресло. В кресле — силуэт.",
    steps: [
      { text: "Квартира 44: подойти к сидящему", done: s => s.is("figure_seen") },
      { text: "Посмотреть в трюмо (трижды)", done: s => s.count("mirror44") >= 3 },
      { text: "Записка на сиденье", done: s => s.is("node_note") },
      { text: "Записка на диване", done: s => s.hasRead("sofa44") },
    ],
    start: s => s.set("unlock_44"),
  },
  {
    n: 8, roman: "VIII", title: "ПОГРАНИЧНАЯ ЗОНА",
    epigraph: "Этот адрес — ключ к квартире 50. К обсерватории. К небу.",
    steps: [
      { text: "Ключ оператора для ЭВМ — лабораторный ключ №3 (кв. 41)", done: s => s.has("key_lab3"), hidden: s => s.has("key_lab3") },
      { text: "Открыть узел с ЭВМ: connect node_1988_clone://…", done: s => s.is("unlock_50") },
      { text: "Обсерватория: звёздная карта", done: s => s.hasRead("starmap50") },
      { text: "Обсерватория: астрономический журнал", done: s => s.hasRead("journal50") },
      { text: "Выйти на балкон", done: s => s.is("on_balcony") },
      { text: "Навести телескоп", done: s => s.is("telescope_done") },
    ],
  },
  {
    n: 9, roman: "IX", title: "ПРОРЫВ ЧЕТВЁРТОЙ СТЕНЫ",
    epigraph: "Это может сделать только тот, кто снаружи.",
    steps: [
      { text: "ЭВМ: CONNECT /DEV/RADIO_VEF 404.00", done: s => s.is("radio_connected") },
      { text: "ЭВМ: cat /Мои_документы/Отчёт_ОБ-88.doc", done: s => s.is("hexdump_seen") },
      { text: "Открыть адрес из дампа — снаружи, на своём устройстве", done: s => s.is("arg_opened") || s.is("jumper_set") },
      { text: "Щиток: перемычка ПР-1", done: s => s.is("jumper_set") },
      { text: "ЭВМ: Личное_дело_42.doc", done: s => s.is("dossier_read") },
      { text: "Ответить на вызов", done: s => s.is("call_accepted"), hidden: s => !s.is("dossier_read") },
    ],
    done: s => s.is("call_accepted"),
  },
  {
    n: 10, roman: "X", title: "ТЕРМИНАЛЬНЫЙ КРИЗИС",
    epigraph: "У нас осталось не более двух минут машинного времени.",
    steps: [
      { text: "ЭВМ: shutdown.sys", done: s => s.is("ending_chosen") },
    ],
    done: () => false,
  },
];

// Акт пройден, когда выполнены все видимые шаги (если не задано иное).
export function actDone(a, s) {
  if (a.done) return a.done(s);
  return a.steps.every(st => (st.hidden && st.hidden(s)) || st.done(s));
}

export class StoryDirector {
  constructor(game) {
    this.game = game;
    this.state = game.state;
    this._pending = false;
    const recheck = () => this.check();
    for (const ev of ["flag", "item:add", "clue:add", "doc:read", "counter"]) game.bus.on(ev, recheck);
  }

  get act() { return ACTS.find(a => a.n === this.state.act) || ACTS[0]; }

  // После загрузки сохранения — повторить стартовые эффекты пройденных актов.
  restore() {
    for (const a of ACTS) if (a.n <= this.state.act) a.start?.(this.state);
  }

  check() {
    if (this._pending) return;
    const a = this.act;
    if (!actDone(a, this.state)) return;
    const next = ACTS.find(x => x.n === a.n + 1);
    if (!next) return;
    this._pending = true;
    // Даём договорить текущей сцене, потом — карточка акта.
    setTimeout(() => {
      this._pending = false;
      this.state.act = next.n;
      next.start?.(this.state);
      this.state.changed();
      this.game.bus.emit("act:start", { act: next });
      this.game.showActCard(next);
      this.check();
    }, 2600);
  }
}
