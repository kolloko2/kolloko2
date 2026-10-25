import { BUSINESSES } from '../data/businesses.js';
import { companyUnits, loanLimit } from './state.js';
import { attention } from './staff.js';
import { companyAlerts } from './management.js';
import { ipoCheck, listingOf, controllerOf } from './stocks.js';
import { franchiseCount, FRANCHISE_MIN_UNITS } from './franchise.js';
import { brandUnits } from './brands.js';

// Советник: что разумно сделать прямо сейчас. Возвращает советы по важности:
//   { id, icon, text, tab?, unitId? } — tab/unitId: куда ведёт кнопка.
export function advice(state, companyId) {
  const co = state.companies[companyId];
  const units = companyUnits(state, companyId);
  const out = [];
  const h = co.history.at(-1);
  const costs = h ? Math.max(0, h.revenue - h.profit) : 0;

  if (!units.length) {
    out.push({ id: 'first', icon: '🚀', text: 'Откройте первый бизнес: нажмите на город, затем «🏗 Построить» и выберите клетку. Фастфуд-киоск — самый дешёвый старт.' });
    return out;
  }
  if (co.cash < 0) out.push({ id: 'cash', icon: '🆘', text: 'Касса в минусе! Возьмите кредит или закройте убыточные точки, иначе через 45 дней — банкротство.', tab: 'finance' });
  else if (h && co.cash < costs * 0.5 && co.loan < loanLimit(state, companyId) * 0.8) {
    out.push({ id: 'cushion', icon: '💸', text: 'Денег меньше чем на полмесяца расходов. Небольшой кредит — подушка на случай кризиса.', tab: 'finance' });
  }
  const alerts = companyAlerts(state, companyId);
  const count = (k) => alerts.filter((a) => a.kind === k).length;
  if (count('loss')) out.push({ id: 'loss', icon: '📉', text: `${count('loss')} бизнес(ов) в минусе три месяца подряд. Поднимите цены, сократите штат — или закройте.`, tab: 'tasks' });
  if (count('worn')) out.push({ id: 'worn', icon: '🛠', text: `${count('worn')} точек сильно изношены и теряют клиентов. Обновите их во вкладке «Задачи».`, tab: 'tasks' });
  if (count('cheap')) out.push({ id: 'cheap', icon: '🏷️', text: `Инфляция «съела» наценку в ${count('cheap')} точках: цены ниже нормы. Поднимите их в один клик.`, tab: 'tasks' });
  if (count('queue')) out.push({ id: 'queue', icon: '👥', text: `В ${count('queue')} точках очереди — клиенты уходят. Добавьте персонал.`, tab: 'tasks' });
  const att = attention(state, companyId);
  if (att.excess > 0) out.push({ id: 'attention', icon: '👔', text: `Вы не успеваете за всеми точками (${att.used} из ${att.limit}). Наймите управляющих, объедините точки в сеть или возьмите регионального директора.`, tab: 'tasks' });
  // сеть из одинаковых точек
  const byType = {};
  for (const u of units) if (BUSINESSES[u.type].retail && !u.brandId) byType[u.type] = (byType[u.type] || 0) + 1;
  const loose = Object.entries(byType).find(([, n]) => n >= 2);
  if (loose) out.push({ id: 'brand', icon: '🏷️', text: `У вас ${loose[1]} точки «${BUSINESSES[loose[0]].name}» без сети. Сеть даст общую узнаваемость, цены по инфляции и меньше забот.`, tab: 'brands' });
  for (const b of Object.values(state.brands)) {
    if (b.companyId !== companyId) continue;
    if (brandUnits(state, b).length >= FRANCHISE_MIN_UNITS && !Object.keys(b.franchise || {}).length && !franchiseCount(b)) {
      out.push({ id: `fr-${b.id}`, icon: '🤝', text: `Сеть «${b.name}» готова к франшизе: франчайзи откроют точки под вашей маркой в других странах и будут платить роялти.`, tab: 'brands' });
      break;
    }
  }
  // цепочки: много покупного сырья одного вида
  const internal = units.some((u) => Object.values(u.supplied || {}).includes('internal'));
  if (!internal && units.length >= 6) out.push({ id: 'chain', icon: '🔗', text: 'Все ваши бизнесы покупают сырьё на рынке. Своё производство (обжарка, мельница, ферма) снизит расходы и защитит от скачков цен.', tab: 'market' });
  if (!co.research && units.length >= 8 && co.cash > 400000) out.push({ id: 'research', icon: '🔬', text: 'Есть свободные деньги — запустите исследование: технологии дают бонус всей компании навсегда.', tab: 'research' });
  if (!ipoCheck(state, companyId)) out.push({ id: 'ipo', icon: '🔔', text: 'Компания готова к IPO: можно продать часть акций и привлечь деньги на рост. Оставьте себе больше 50%!', tab: 'stocks' });
  const me = listingOf(state, companyId);
  if (me && controllerOf(state, me)) out.push({ id: 'control', icon: '🦈', text: 'Кто-то получил контрольный пакет вашей компании! Выкупите акции у публики, пока вас не поглотили.', tab: 'stocks' });
  const offers = (state.offers || []).filter((o) => o.to === companyId && o.until > state.day);
  if (offers.length) out.push({ id: 'offers', icon: '📨', text: `Корпорации прислали предложения (${offers.length}). Посмотрите во вкладке «Соперники».`, tab: 'rivals' });
  if (!out.length) out.push({ id: 'ok', icon: '✅', text: 'Всё идёт хорошо. Ищите новые районы с высоким прогнозом и следите за новостями.' });
  return out;
}
