import { companyUnits } from '../sim/index.js';

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
  if (!app.started || tut.done) {
    el.hidden = true;
    return;
  }
  while (tut.step < STEPS.length && STEPS[tut.step].done(app)) tut.step++;
  if (tut.step >= STEPS.length) {
    tut.done = true;
    persist(tut);
    el.hidden = true;
    return;
  }
  persist(tut);
  el.hidden = false;
  el.innerHTML = `<div class="tut-head"><b>🎓 Обучение · шаг ${tut.step + 1} из ${STEPS.length}</b>
    <button class="link" data-tutorial="skip">Пропустить</button></div>
    <div>${STEPS[tut.step].text}</div>
    <div class="tut-bar"><span style="width:${(tut.step / STEPS.length) * 100}%"></span></div>`;
}
