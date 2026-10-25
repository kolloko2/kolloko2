// Фоновые конкуренты как настоящие здания: у каждого своё место в квартале, название, цена, качество и известность.
// Состояния не хранят: всё выводится из сида района и числа конкурентов (district.ai) — одинаково на сервере и у клиентов.
import { districtSlots, strHash, hash } from './layout.js';
import { offsetLatLng, isLand } from './world.js';

const NAMES = {
  coffee: ['Кофе Хаус', 'Бодрое утро', 'Арабика', 'Зерно', 'Капучино', 'Кофейня №1', 'Две чашки', 'Эспрессо-бар'],
  fastfood: ['Бургер Сити', 'Хот-дог экспресс', 'Шаурма у дома', 'Быстрый перекус', 'Гриль-Бокс', 'Вок и Ролл'],
  grocery: ['Продукты 24', 'У дома', 'Копейка', 'Свежий день', 'Магазинчик', 'Мини-маркет «Ромашка»'],
  bakery: ['Хлебный дом', 'Булочная', 'Пекарня у вокзала', 'Тёплый хлеб', 'Каравай'],
  restaurant: ['Траттория', 'Старый город', 'Гастробар', 'Ресторан «Набережная»', 'Бистро'],
  fuel: ['Нефтемаркет', 'АЗС «Трасса»', 'Топливо+', 'Бензин 24'],
  electronics: ['Техносила', 'Гаджет-центр', 'Цифра'],
  hotel: ['Гранд-отель', 'Отель «Центральный»', 'Хостел', 'Бутик-отель'],
  fitness: ['Фитнес-клуб «Пульс»', 'Атлет', 'Фитнес 24'],
  beauty: ['Салон «Шарм»', 'Барбершоп', 'Студия красоты'],
  pharmacy: ['Аптека 36,6', 'Здоровье', 'Аптека у дома'],
  cars: ['Автосалон «Мотор»', 'Автоцентр'],
  autoservice: ['Автосервис «Гайка»', 'Шиномонтаж 24'],
  clothing: ['Модный дом', 'Стиль', 'Одежда для всех'],
  home: ['Мебель-Холл', 'Уютный дом'],
  diy: ['Строймаркет', 'Всё для ремонта'],
  kids: ['Детский мир', 'Игрушки'],
  sports: ['Спортмастер', 'Чемпион'],
  luxury: ['Ювелирный дом', 'Золотой век'],
  bar: ['Пивной бар', 'Паб «Якорь»', 'Винный бар', 'Бар у моста'],
};

// Места района под здания конкурентов: кварталы, где нет участков игроков, на суше
const slotCache = new Map();
export function shopSlots(state, d) {
  const key = `${state.seed}|${d.id}`;
  let slots = slotCache.get(key);
  if (slots) return slots;
  const place = state.world.places[d.placeId];
  const busy = new Set(d.lotIds.map((id) => {
    const l = state.world.lots[id];
    return `${l.lat.toFixed(5)}|${l.lng.toFixed(5)}`;
  }));
  slots = [];
  for (const sl of districtSlots(d)) {
    const p = offsetLatLng(d.lat, d.lng, sl.x, sl.y);
    if (busy.has(`${p.lat.toFixed(5)}|${p.lng.toFixed(5)}`) || !isLand(place, p.lat, p.lng)) continue;
    slots.push({ lat: p.lat, lng: p.lng, w: sl.w, h: sl.h });
  }
  slotCache.set(key, slots);
  return slots;
}

// Конкурент «взрослеет»: через 30 лет средний — 3.5★ и известность 60%
function maturity(state) {
  const years = state.day / 365;
  return { q: Math.min(0.5, years * 0.015), a: Math.min(0.1, years * 0.004) };
}

/**
 * Здания фоновых конкурентов района (все категории или одна).
 * p — цена к местной норме, q — рейтинг 1–5, a — известность 0–1.
 * @param {any} state @param {any} d @param {string|null} [cat]
 * @returns {{ id: string, districtId: string, cat: string, name: string, p: number, q: number, a: number, lat: number, lng: number, w: number, h: number }[]}
 */
export function shopsIn(state, d, cat = null) {
  const key = `${d.id}|${JSON.stringify(d.ai)}|${Math.floor(state.day / 30)}|${d.aiPrice ? JSON.stringify(d.aiPrice) : ''}`;
  let all = shopCache.get(d);
  if (!all || all.key !== key) {
    all = { key, list: buildShops(state, d) };
    shopCache.set(d, all);
  }
  return cat ? all.list.filter((s) => s.cat === cat) : all.list;
}
const shopCache = new WeakMap();

function buildShops(state, d) {
  const slots = shopSlots(state, d);
  const used = new Set();
  const m = maturity(state);
  const seed = strHash(d.id);
  const list = [];
  for (const cat of Object.keys(d.ai).sort()) {
    const names = NAMES[cat] || ['Конкурент'];
    for (let i = 0; i < (d.ai[cat] || 0); i++) {
      const h1 = hash(seed, strHash(cat), i * 3 + 1);
      const h2 = hash(seed, strHash(cat), i * 3 + 2);
      const h3 = hash(seed, strHash(cat), i * 3 + 3);
      // место: от «своего» номера по кругу до свободного
      let k = slots.length ? Math.floor(h1 * slots.length) : -1;
      for (let t = 0; t < slots.length && used.has(k); t++) k = (k + 1) % slots.length;
      if (k >= 0) used.add(k);
      const slot = slots[k] || { lat: d.lat, lng: d.lng, w: 30, h: 30 };
      list.push({
        id: `${d.id}|${cat}|${i}`,
        districtId: d.id,
        cat,
        name: names[Math.floor(h2 * names.length)],
        p: Math.round((0.85 + 0.35 * h2) * (d.aiPrice?.[cat] ?? 1) * 100) / 100,
        q: Math.round(Math.min(5, 2.3 + 1.4 * h3 + m.q) * 10) / 10,
        a: Math.round((0.3 + 0.4 * h1 + m.a) * 100) / 100,
        lat: slot.lat,
        lng: slot.lng,
        w: slot.w,
        h: slot.h,
      });
    }
  }
  return list;
}
