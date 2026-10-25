import { companyUnits, advice } from '../sim/index.js';

// Пошаговое обучение для первой игры. Шаг засчитывается автоматически, когда выполнено условие.
const KEY = 'magnat-tutorial';

const STEPS = [
  {
    text: 'Выберите город на карте и нажмите на его значок. Для начала подойдёт любой крупный город — например, Берлин или Нью-Йорк.',
    done: (app) => Boolean(app.selection),
  },
  {
    text: 'Нажмите на район. Деловой центр и студенческий квартал хороши для кофеен и фастфуда, спальный район — для магазинов и пекарен.',
    done: (app) => ['district', 'lot', 'unit'].includes(app.selection?.kind),
  },
  {
    text: 'Приблизьтесь и нажмите на свободный участок 🏬. Справа появится прогноз: клиенты, выручка, расходы и окупаемость.',
    done: (app) => ['lot', 'unit'].includes(app.selection?.kind),
  },
  {
    text: 'Откройте бизнес с лучшим прогнозом прибыли. Если денег не хватает — выберите участок поменьше или фастфуд-киоск.',
    done: (app) => companyUnits(app.state, app.companyId).length > 0,
  },
  {
    text: 'Это панель вашего бизнеса. Следите за очередью (не хватает персонала) и складом. Нажмите ⏩, чтобы ускорить время, и дождитесь конца месяца.',
    done: (app) => app.company.history.length > 0,
  },
  {
    text: 'Пришёл первый месячный отчёт. Откройте вкладку «Финансы» слева — там прибыль, касса и кредиты.',
    done: (app) => app.tab === 'finance',
  },
  {
    text: 'Дальше — расширяйтесь и стройте цепочки: обжарка 🔥 в промзоне снабжает кофейни дешевле рынка, мельница — пекарни и фастфуд. Откройте вкладку «Цели».',
    done: (app) => app.tab === 'goals',
  },
];

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null') || { step: 0, done: false };
  } catch {
    return { step: 0, done: false };
  }
}

function persist(t) {
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
  } catch {
    // без хранилища обучение просто начнётся заново
  }
}

let tut = load();

export function restartTutorial() {
  tut = { step: 0, done: false };
  persist(tut);
}

export function skipTutorial() {
  tut = { step: STEPS.length, done: true };
  persist(tut);
}

export function renderTutorial(app) {
  const el = document.getElementById('tutorial');
  if (!app.started) {
    el.hidden = true;
    return;
  }
  if (tut.done) {
    renderAdvisor(app, el);
    return;
  }
  while (tut.step < STEPS.length && STEPS[tut.step].done(app)) tut.step++;
  if (tut.step >= STEPS.length) {
    tut.done = true;
    persist(tut);
    renderAdvisor(app, el);
    return;
  }
  persist(tut);
  el.hidden = false;
  el.innerHTML = `<div class="tut-head"><b>🎓 Обучение · шаг ${tut.step + 1} из ${STEPS.length}</b>
    <button class="link" data-tutorial="skip">Пропустить</button></div>
    <div>${STEPS[tut.step].text}</div>
    <div class="tut-bar"><span style="width:${(tut.step / STEPS.length) * 100}%"></span></div>`;
}

// ---------- советник ----------
// После обучения в углу живёт советник: самый важный совет и кнопка, которая ведёт куда надо.
const ADV_KEY = 'magnat-advisor';
let adv = (() => {
  try {
    return JSON.parse(localStorage.getItem(ADV_KEY) || 'null') || { open: true };
  } catch {
    return { open: true };
  }
})();
let advIndex = 0;

function saveAdv() {
  try {
    localStorage.setItem(ADV_KEY, JSON.stringify(adv));
  } catch {
    // не страшно
  }
}

export function advisorAction(app, what) {
  if (what === 'toggle') {
    adv.open = !adv.open;
    saveAdv();
  } else if (what === 'next') {
    advIndex++;
  }
  renderTutorial(app);
}

function renderAdvisor(app, el) {
  el.hidden = false;
  el.classList.add('advisor');
  if (!adv.open) {
    el.innerHTML = '<button class="link" data-advisor="toggle">💡 Советник</button>';
    return;
  }
  const tips = advice(app.state, app.companyId);
  const tip = tips[advIndex % tips.length];
  el.innerHTML = `<div class="tut-head"><b>💡 Советник${tips.length > 1 ? ` · ${(advIndex % tips.length) + 1} из ${tips.length}` : ''}</b>
    <button class="link" data-advisor="toggle">Свернуть</button></div>
    <div>${tip.icon} ${tip.text}</div>
    <div class="btn-row">${tip.tab ? `<button class="mini wide" data-advisor="open" data-tab="${tip.tab}">Открыть</button>` : ''}
    ${tips.length > 1 ? '<button class="mini wide" data-advisor="next">Следующий совет</button>' : ''}</div>`;
}

// ---------- подсказки к вкладкам ----------
const HINT_KEY = 'magnat-hints';
const HINTS = {
  tasks: 'Здесь всё, что прямо сейчас теряет вам деньги: износ, цены ниже нормы, очереди, убыточные точки. Исправляйте по одной или всё сразу.',
  market: 'Цены товаров по регионам мира. Где товар дешевле — там выгодно его производить; ваши бизнесы закупаются на рынке своего региона.',
  brands: 'Сеть — это точки одного типа с общими ценами (в % от местной нормы), рекламой и узнаваемостью. С 3 своих точек можно продавать франшизу.',
  countries: 'Налоги, пошлины, инфляция и стабильность стран. Внизу — региональные директора (автопилот по стране) и лоббирование.',
  stocks: 'Акции корпораций приносят дивиденды. Своё IPO даёт деньги, но больше 50% акций у чужих — и вашу компанию могут поглотить.',
  rivals: 'ИИ-корпорации со своим характером. Их точки можно выкупить, с ними — заключить перемирие, а их предложения — принять или отклонить.',
  research: 'Одно исследование за раз. Технологии дают бонус всей компании навсегда и открывают тир IV: банк, электронику, облако.',
  finance: 'Касса, кредиты и отчёт по месяцам. Расходы штаба растут быстрее числа бизнесов — следите за прибылью на точку.',
};
let seen = (() => {
  try {
    return JSON.parse(localStorage.getItem(HINT_KEY) || '{}');
  } catch {
    return {};
  }
})();

export function tabHint(tab) {
  if (!HINTS[tab] || seen[tab]) return '';
  return `<div class="hint">💡 ${HINTS[tab]} <button class="link" data-action="hintOk" data-tab="${tab}">Понятно</button></div>`;
}

export function hideHint(tab) {
  seen[tab] = 1;
  try {
    localStorage.setItem(HINT_KEY, JSON.stringify(seen));
  } catch {
    // не страшно
  }
}

export function resetHints() {
  seen = {};
  hideHint('__');
}
