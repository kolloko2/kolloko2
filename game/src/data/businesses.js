// Типы бизнесов прототипа (тир I + первые производства).
//
// retail     — продажи людям: perStaff (клиентов в день на сотрудника), cap (лимит по уровню оборудования),
//              products: первый продукт — основной (attach = 1), остальные докупаются с вероятностью attach.
//              ref — базовая цена в стране с доходом 1 (меняется по уровню доходов города).
// production — выпуск товаров: perStaff (единиц в день на сотрудника), cap (по уровню) либо capPerArea,
//              recipe — входы на 1 единицу выхода.
// capex      — базовые вложения при индексе цен 1; renovPerM2 — ремонт за м².
// upkeep     — коммунальные/обслуживание в месяц: base + perArea × площадь (м² или га).
export const BUSINESSES = {
  coffee_shop: {
    name: 'Кофейня', icon: '☕', zoning: 'commercial', category: 'coffee', tier: 1,
    description: 'Кофе и выпечка навынос. Лучше всего — деловой центр и студенческие кварталы.',
    capex: 40000, renovPerM2: 110,
    upkeep: { base: 300, perArea: 8 },
    staff: { role: 'Бариста', wage: 2600, min: 1, max: 12, def: 3 },
    marketing: 600,
    retail: {
      perStaff: 100, cap: [450, 800, 1300],
      products: [
        { id: 'coffee', name: 'Кофе', ref: 3.5, attach: 1, recipe: { coffee_roasted: 0.018, milk: 0.12, cups: 1 } },
        { id: 'pastry', name: 'Выпечка', ref: 2.4, attach: 0.3, recipe: { pastry: 1 } },
      ],
    },
  },
  bakery: {
    name: 'Пекарня', icon: '🥐', zoning: 'commercial', category: 'bakery', tier: 1,
    description: 'Печёт хлеб и выпечку. Выпечку можно поставлять в свои кофейни.',
    capex: 60000, renovPerM2: 130,
    upkeep: { base: 600, perArea: 10 },
    staff: { role: 'Пекарь', wage: 2800, min: 1, max: 15, def: 4 },
    marketing: 400,
    retail: {
      perStaff: 80, cap: [300, 550, 900],
      products: [
        { id: 'bread', name: 'Хлеб', ref: 2.2, attach: 1, recipe: { flour: 0.35, sugar: 0.01 } },
        { id: 'pastry', name: 'Выпечка', ref: 1.8, attach: 0.6, recipe: { pastry: 1 } },
      ],
    },
    production: {
      perStaff: 110, cap: [500, 1000, 1800],
      recipe: { output: 'pastry', inputs: { flour: 0.06, sugar: 0.015, milk: 0.02 } },
    },
  },
  fastfood: {
    name: 'Фастфуд-киоск', icon: '🌭', zoning: 'commercial', category: 'fastfood', tier: 1,
    description: 'Хот-доги и напитки. Дёшево открыть, любит студентов и торговые центры.',
    capex: 22000, renovPerM2: 80,
    upkeep: { base: 250, perArea: 6 },
    staff: { role: 'Повар', wage: 2500, min: 1, max: 10, def: 2 },
    marketing: 400,
    retail: {
      perStaff: 120, cap: [350, 650, 1000],
      products: [
        { id: 'hotdog', name: 'Хот-дог', ref: 3.0, attach: 1, recipe: { meat: 0.08, flour: 0.06 } },
        { id: 'drink', name: 'Напиток', ref: 1.4, attach: 0.5, recipe: { cups: 1, sugar: 0.03 } },
      ],
    },
  },
  minimarket: {
    name: 'Мини-маркет', icon: '🏪', zoning: 'commercial', category: 'grocery', tier: 1,
    description: 'Магазин у дома. Низкая маржа, стабильный спрос в спальных районах.',
    capex: 50000, renovPerM2: 90,
    upkeep: { base: 500, perArea: 9 },
    staff: { role: 'Продавец', wage: 2400, min: 1, max: 15, def: 3 },
    marketing: 400,
    retail: {
      perStaff: 90, cap: [400, 700, 1100],
      products: [
        { id: 'basket', name: 'Покупка', ref: 10.0, attach: 1, recipe: { groceries: 4 } },
        { id: 'milk', name: 'Молоко', ref: 1.3, attach: 0.3, recipe: { milk: 1 } },
      ],
    },
  },
  coffee_roastery: {
    name: 'Обжарка кофе', icon: '🔥', zoning: 'industrial', category: 'industry', tier: 2,
    description: 'Превращает зелёное зерно в обжаренный кофе для кофеен (своих и чужих).',
    capex: 160000, renovPerM2: 40,
    upkeep: { base: 1500, perArea: 2 },
    staff: { role: 'Обжарщик', wage: 3200, min: 1, max: 20, def: 3 },
    marketing: 0,
    production: {
      perStaff: 70, cap: [250, 500, 900],
      recipe: { output: 'coffee_roasted', inputs: { coffee_green: 1.2 } },
    },
  },
  mill: {
    name: 'Мельница', icon: '⚙️', zoning: 'industrial', category: 'industry', tier: 2,
    description: 'Мелет пшеницу в муку для пекарен и фастфуда.',
    capex: 140000, renovPerM2: 40,
    upkeep: { base: 1500, perArea: 2 },
    staff: { role: 'Мельник', wage: 3000, min: 1, max: 20, def: 3 },
    marketing: 0,
    production: {
      perStaff: 2000, cap: [6000, 12000, 20000],
      recipe: { output: 'flour', inputs: { wheat: 1.35 } },
    },
  },
  coffee_plantation: {
    name: 'Кофейная плантация', icon: '🌳', zoning: 'farmland', category: 'farm', tier: 2,
    description: 'Выращивает кофейное зерно. Только в кофейном поясе.',
    capex: 110000, renovPerM2: 0,
    upkeep: { base: 500, perArea: 2 },
    staff: { role: 'Сборщик', wage: 1600, min: 2, max: 120, def: 15 },
    marketing: 0,
    production: {
      perStaff: 8, capPerArea: 3,
      recipe: { output: 'coffee_green', inputs: {} },
    },
  },
  wheat_farm: {
    name: 'Зерновая ферма', icon: '🌾', zoning: 'farmland', category: 'farm', tier: 2,
    description: 'Выращивает пшеницу для мельниц и молочных ферм.',
    capex: 140000, renovPerM2: 0,
    upkeep: { base: 800, perArea: 3 },
    staff: { role: 'Механизатор', wage: 2200, min: 1, max: 40, def: 6 },
    marketing: 0,
    production: {
      perStaff: 450, capPerArea: 40,
      recipe: { output: 'wheat', inputs: {} },
    },
  },
  dairy_farm: {
    name: 'Молочная ферма', icon: '🐄', zoning: 'farmland', category: 'farm', tier: 2,
    description: 'Даёт молоко для кофеен, пекарен и магазинов. Коровам нужна пшеница на корм.',
    capex: 180000, renovPerM2: 0,
    upkeep: { base: 1000, perArea: 3 },
    staff: { role: 'Работник фермы', wage: 1900, min: 1, max: 40, def: 6 },
    marketing: 0,
    production: {
      perStaff: 120, capPerArea: 25,
      recipe: { output: 'milk', inputs: { wheat: 0.4 } },
    },
  },
};

// Улучшения оборудования: уровень 1..3.
export const MAX_LEVEL = 3;
export const UPGRADE_COST_FACTOR = 0.5; // × capex × текущий уровень
export const QUALITY_PER_LEVEL = 0.4;
