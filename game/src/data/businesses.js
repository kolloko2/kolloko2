// Типы бизнесов прототипа (тир I + первые производства).
//
// retail     — продажи людям: perStaff (клиентов в день на сотрудника), cap (лимит по уровню оборудования),
//              products: первый продукт — основной (attach = 1), остальные докупаются с вероятностью attach.
//              ref — базовая цена в стране с доходом 1 (меняется по уровню доходов города).
// production — выпуск товаров: perStaff (единиц в день на сотрудника), cap (по уровню) либо capPerArea,
//              recipe — входы на 1 единицу выхода.
//              tradable — доля цены, не зависящая от доходов города (топливо стоит почти везде одинаково).
// capex      — базовые вложения при индексе цен 1; renovPerM2 — ремонт за м².
// license    — нужна лицензия (см. data/laws.js): платится один раз в каждой стране.
// upkeep     — коммунальные/обслуживание в месяц: base + perArea × площадь (м² или га).
export const BUSINESSES = {
  coffee_shop: {
    name: 'Кофейня', icon: '☕', zoning: 'commercial', category: 'coffee', tier: 1,
    description: 'Кофе и выпечка навынос. Лучше всего — деловой центр и студенческие кварталы.',
    capex: 64000, renovPerM2: 110,
    upkeep: { base: 750, perArea: 8 },
    staff: { role: 'Бариста', wage: 2600, min: 2, max: 12, def: 3 },
    marketing: 600,
    retail: {
      perStaff: 40, cap: [450, 800, 1300],
      products: [
        { id: 'coffee', name: 'Кофе', ref: 4.2, attach: 1, recipe: { coffee_roasted: 0.018, milk: 0.12, cups: 1 } },
        { id: 'pastry', name: 'Выпечка', ref: 2.6, attach: 0.3, recipe: { pastry: 1 } },
      ],
    },
  },
  bakery: {
    name: 'Пекарня', icon: '🥐', zoning: 'commercial', category: 'bakery', tier: 1,
    description: 'Печёт хлеб и выпечку. Выпечку можно поставлять в свои кофейни.',
    capex: 72000, renovPerM2: 130,
    upkeep: { base: 900, perArea: 10 },
    staff: { role: 'Пекарь', wage: 2800, min: 2, max: 15, def: 4 },
    marketing: 400,
    retail: {
      perStaff: 35, cap: [300, 550, 900],
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
    capex: 29000, renovPerM2: 80,
    upkeep: { base: 250, perArea: 6 },
    staff: { role: 'Повар', wage: 2500, min: 1, max: 10, def: 2 },
    marketing: 400,
    retail: {
      perStaff: 50, cap: [350, 650, 1000],
      products: [
        { id: 'hotdog', name: 'Хот-дог', ref: 3.8, attach: 1, recipe: { meat: 0.08, flour: 0.06 } },
        { id: 'drink', name: 'Напиток', ref: 1.6, attach: 0.5, recipe: { cups: 1, sugar: 0.03 } },
      ],
    },
  },
  minimarket: {
    name: 'Мини-маркет', icon: '🏪', zoning: 'commercial', category: 'grocery', tier: 1,
    description: 'Магазин у дома. Низкая маржа, стабильный спрос в спальных районах.',
    capex: 70000, renovPerM2: 90,
    upkeep: { base: 600, perArea: 9 },
    staff: { role: 'Продавец', wage: 2400, min: 2, max: 15, def: 3 },
    marketing: 400,
    retail: {
      perStaff: 40, cap: [400, 700, 1100],
      products: [
        { id: 'basket', name: 'Покупка', ref: 11.0, attach: 1, recipe: { groceries: 4 } },
        { id: 'milk', name: 'Молоко', ref: 1.3, attach: 0.3, recipe: { milk: 1 } },
      ],
    },
  },
  coffee_roastery: {
    name: 'Обжарка кофе', icon: '🔥', zoning: 'industrial', category: 'industry', tier: 2,
    description: 'Превращает зелёное зерно в обжаренный кофе для кофеен (своих и чужих).',
    capex: 563000, renovPerM2: 40,
    upkeep: { base: 4500, perArea: 2 },
    staff: { role: 'Обжарщик', wage: 3200, min: 1, max: 20, def: 3 },
    marketing: 0,
    production: {
      perStaff: 110, cap: [250, 500, 900],
      recipe: { output: 'coffee_roasted', inputs: { coffee_green: 1.2 } },
    },
  },
  mill: {
    name: 'Мельница', icon: '⚙️', zoning: 'industrial', category: 'industry', tier: 2,
    description: 'Мелет пшеницу в муку для пекарен и фастфуда.',
    capex: 493000, renovPerM2: 40,
    upkeep: { base: 4500, perArea: 2 },
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
    capex: 704000, renovPerM2: 0,
    upkeep: { base: 1000, perArea: 2 },
    staff: { role: 'Сборщик', wage: 1600, min: 2, max: 120, def: 15 },
    marketing: 0,
    production: {
      perStaff: 4.0, capPerArea: 3,
      recipe: { output: 'coffee_green', inputs: {} },
    },
  },
  wheat_farm: {
    name: 'Зерновая ферма', icon: '🌾', zoning: 'farmland', category: 'farm', tier: 2,
    description: 'Выращивает пшеницу для мельниц и молочных ферм.',
    capex: 420000, renovPerM2: 0,
    upkeep: { base: 1600, perArea: 3 },
    staff: { role: 'Механизатор', wage: 2200, min: 1, max: 40, def: 6 },
    marketing: 0,
    production: {
      perStaff: 225, capPerArea: 40,
      recipe: { output: 'wheat', inputs: {} },
    },
  },
  dairy_farm: {
    name: 'Молочная ферма', icon: '🐄', zoning: 'farmland', category: 'farm', tier: 2,
    description: 'Даёт молоко для кофеен, пекарен и магазинов. Коровам нужна пшеница на корм.',
    capex: 1152000, renovPerM2: 0,
    upkeep: { base: 2000, perArea: 3 },
    staff: { role: 'Работник фермы', wage: 1900, min: 1, max: 40, def: 6 },
    marketing: 0,
    production: {
      perStaff: 60, capPerArea: 25,
      recipe: { output: 'milk', inputs: { wheat: 0.4 } },
    },
  },
  restaurant: {
    name: 'Ресторан', icon: '🍽️', zoning: 'commercial', category: 'restaurant', tier: 2, minArea: 80, license: 'alcohol',
    description: 'Обеды и ужины с высоким чеком. Нужно много персонала и продуктов: мясо, сыр, мука, молоко.',
    capex: 351000, renovPerM2: 260,
    upkeep: { base: 1950, perArea: 14 },
    staff: { role: 'Повар/официант', wage: 2500, min: 4, max: 40, def: 8 },
    marketing: 1200,
    retail: {
      perStaff: 6, cap: [160, 300, 480],
      products: [
        { id: 'meal', name: 'Блюдо', ref: 20, attach: 1, recipe: { meat: 0.18, flour: 0.08, milk: 0.08, cheese: 0.04, sugar: 0.02 } },
        { id: 'drinks', name: 'Напитки', ref: 7, attach: 0.6, recipe: { groceries: 1 } },
      ],
    },
  },
  supermarket: {
    name: 'Супермаркет', icon: '🛒', zoning: 'commercial', category: 'grocery', tier: 2, minArea: 120, baseQuality: 3.4,
    description: 'Большой магазин: забирает покупателей у мини-маркетов широким ассортиментом. Продаёт сыр, выпечку и молоко.',
    capex: 286000, renovPerM2: 150,
    upkeep: { base: 2000, perArea: 12 },
    staff: { role: 'Кассир/продавец', wage: 2300, min: 6, max: 60, def: 8 },
    marketing: 1500,
    retail: {
      perStaff: 30, cap: [600, 1100, 1800],
      products: [
        { id: 'basket', name: 'Покупка', ref: 24, attach: 1, recipe: { groceries: 10 } },
        { id: 'dairy', name: 'Молоко и сыр', ref: 4.5, attach: 0.5, recipe: { milk: 1, cheese: 0.15 } },
        { id: 'bakery', name: 'Выпечка', ref: 1.4, attach: 0.4, recipe: { pastry: 1 } },
      ],
    },
  },
  livestock_farm: {
    name: 'Скотоводческая ферма', icon: '🐂', zoning: 'farmland', category: 'farm', tier: 2,
    description: 'Выращивает скот для мясокомбинатов. Скот ест пшеницу.',
    capex: 600000, renovPerM2: 0,
    upkeep: { base: 2000, perArea: 3 },
    staff: { role: 'Скотник', wage: 2000, min: 1, max: 40, def: 6 },
    marketing: 0,
    production: {
      perStaff: 32, capPerArea: 2.5,
      recipe: { output: 'cattle', inputs: { wheat: 2.5 } },
    },
  },
  meat_plant: {
    name: 'Мясокомбинат', icon: '🥩', zoning: 'industrial', category: 'industry', tier: 2, license: 'food',
    description: 'Перерабатывает скот в мясо для фастфуда и ресторанов.',
    capex: 774000, renovPerM2: 50,
    upkeep: { base: 7500, perArea: 3 },
    staff: { role: 'Работник цеха', wage: 2600, min: 2, max: 40, def: 5 },
    marketing: 0,
    production: {
      perStaff: 150, cap: [1000, 2000, 3400],
      recipe: { output: 'meat', inputs: { cattle: 2.0 } },
    },
  },
  dairy_plant: {
    name: 'Молокозавод', icon: '🧀', zoning: 'industrial', category: 'industry', tier: 2, license: 'food',
    description: 'Делает сыр из молока. Ставьте рядом с молочными фермами — молоко быстро портится в дороге.',
    capex: 634000, renovPerM2: 50,
    upkeep: { base: 6000, perArea: 3 },
    staff: { role: 'Технолог', wage: 2700, min: 2, max: 30, def: 4 },
    marketing: 0,
    production: {
      perStaff: 75, cap: [300, 600, 1000],
      recipe: { output: 'cheese', inputs: { milk: 9 } },
    },
  },
  packaging_plant: {
    name: 'Завод упаковки', icon: '🥤', zoning: 'industrial', category: 'industry', tier: 2,
    description: 'Делает стаканы и упаковку из пластика для кофеен и фастфуда.',
    capex: 563000, renovPerM2: 40,
    upkeep: { base: 5400, perArea: 2.5 },
    staff: { role: 'Оператор линии', wage: 2500, min: 1, max: 20, def: 3 },
    marketing: 0,
    production: {
      perStaff: 8000, cap: [20000, 40000, 70000],
      recipe: { output: 'cups', inputs: { plastic: 0.012 } },
    },
  },
  trucking: {
    name: 'Грузоперевозки', icon: '🚚', zoning: 'industrial', category: 'service', tier: 2,
    description: 'Возит грузы ИИ-клиентам за деньги, а вашим бизнесам в этом регионе доставка обходится на 40% дешевле.',
    capex: 528000, renovPerM2: 20,
    upkeep: { base: 3000, perArea: 1.5 },
    staff: { role: 'Водитель', wage: 2700, min: 1, max: 60, def: 6 },
    marketing: 0,
    service: { revenuePerStaff: 260, inputs: { fuel: 80 }, bonus: 'Доставка для ваших бизнесов в этом регионе дешевле на 40%' },
  },
  ad_agency: {
    name: 'Рекламное агентство', icon: '📣', zoning: 'commercial', category: 'service', tier: 2,
    description: 'Ведёт рекламу ИИ-клиентов, а реклама ваших точек в этой стране работает на 30% эффективнее.',
    capex: 120000, renovPerM2: 120,
    upkeep: { base: 1200, perArea: 8 },
    staff: { role: 'Креативщик', wage: 3800, min: 1, max: 30, def: 4 },
    marketing: 0,
    service: { revenuePerStaff: 210, inputs: {}, talent: true, bonus: 'Реклама ваших точек в этой стране эффективнее на 30%' },
  },
  it_studio: {
    name: 'IT-студия', icon: '💻', zoning: 'commercial', category: 'service', tier: 2,
    description: 'Разрабатывает ПО на заказ, а её кассовая система ускоряет все ваши точки (+10% мощности), если в студии 3+ программиста.',
    capex: 100000, renovPerM2: 120,
    upkeep: { base: 1000, perArea: 8 },
    staff: { role: 'Программист', wage: 5000, min: 1, max: 40, def: 4 },
    marketing: 0,
    service: { revenuePerStaff: 240, inputs: {}, talent: true, bonus: '+10% мощности всех ваших точек продаж (нужно 3+ программиста)' },
  },
  warehouse: {
    name: 'Склад', icon: '🏗️', zoning: 'industrial', category: 'logistics', tier: 2,
    description: 'Держит запас для ваших точек в радиусе 1500 км: оптом дешевле, дальние поставки едут по оптовому тарифу, а точки получают товар за день.',
    capex: 70000, renovPerM2: 30,
    upkeep: { base: 600, perArea: 1.5 },
    staff: { role: 'Кладовщик', wage: 2200, min: 1, max: 20, def: 2 },
    marketing: 0,
    // perArea — кг хранения на м², radiusKm — кого обслуживает, defaultCover — дней запаса
    storage: { perArea: 400, radiusKm: 1500, defaultCover: 14 },
  },
  // ---------- тир III ----------
  food_factory: {
    name: 'Пищевая фабрика', icon: '🥫', zoning: 'industrial', category: 'industry', tier: 3, license: 'food',
    description: 'Выпускает товары для магазинов из муки, сахара, молока, мяса и пластика. Снабжает ваши мини-маркеты, супермаркеты и рестораны.',
    capex: 1478000, renovPerM2: 50,
    upkeep: { base: 10500, perArea: 3 },
    staff: { role: 'Работник линии', wage: 2600, min: 4, max: 60, def: 10 },
    marketing: 0,
    production: {
      perStaff: 500, cap: [4000, 8000, 14000],
      recipe: { output: 'groceries', inputs: { flour: 0.3, sugar: 0.1, milk: 0.35, meat: 0.06, plastic: 0.03 } },
    },
  },
  gas_station: {
    name: 'АЗС', icon: '⛽', zoning: 'commercial', category: 'fuel', tier: 3, minArea: 60, license: 'fuel',
    description: 'Заправка с магазином. Топливо стоит почти одинаково в любой стране, поэтому АЗС выгодны и в небогатых городах. Свой НПЗ делает их ещё выгоднее.',
    capex: 360000, renovPerM2: 60,
    upkeep: { base: 2250, perArea: 6 },
    staff: { role: 'Оператор АЗС', wage: 2300, min: 3, max: 20, def: 4 },
    marketing: 800,
    retail: {
      perStaff: 25, cap: [400, 700, 1100],
      products: [
        { id: 'refuel', name: 'Заправка (35 л)', ref: 30, attach: 1, tradable: 0.5, recipe: { fuel: 35 } },
        { id: 'snack', name: 'Кофе и снеки', ref: 3, attach: 0.35, recipe: { groceries: 0.6, cups: 1, coffee_roasted: 0.01 } },
      ],
    },
  },
  oil_well: {
    name: 'Нефтяная скважина', icon: '🛢️', zoning: 'farmland', category: 'oil', tier: 3, license: 'subsoil',
    description: 'Добывает нефть. Только в нефтеносных регионах. Нефть идёт на НПЗ (топливо) и нефтехимию (пластик).',
    capex: 2250000, renovPerM2: 0,
    upkeep: { base: 8000, perArea: 10 },
    staff: { role: 'Нефтяник', wage: 4000, min: 3, max: 60, def: 12 },
    marketing: 0,
    production: {
      perStaff: 500, capPerArea: 60,
      recipe: { output: 'oil', inputs: {} },
    },
  },
  refinery: {
    name: 'НПЗ', icon: '🏭', zoning: 'industrial', category: 'industry', tier: 3, license: 'eco',
    description: 'Перерабатывает нефть в топливо для АЗС и грузоперевозок.',
    capex: 4224000, renovPerM2: 40,
    upkeep: { base: 24000, perArea: 4 },
    staff: { role: 'Технолог НПЗ', wage: 3800, min: 5, max: 80, def: 10 },
    marketing: 0,
    production: {
      perStaff: 2500, cap: [30000, 60000, 100000],
      recipe: { output: 'fuel', inputs: { oil: 1.15 } },
    },
  },
  chemical_plant: {
    name: 'Нефтехимический завод', icon: '🧪', zoning: 'industrial', category: 'industry', tier: 3, license: 'eco',
    description: 'Делает пластик из нефти — для заводов упаковки и пищевых фабрик.',
    capex: 2464000, renovPerM2: 40,
    upkeep: { base: 15000, perArea: 3 },
    staff: { role: 'Химик-технолог', wage: 3600, min: 3, max: 50, def: 8 },
    marketing: 0,
    production: {
      perStaff: 800, cap: [4000, 8000, 14000],
      recipe: { output: 'plastic', inputs: { oil: 1.6 } },
    },
  },
  // ---------- тир IV (нужны исследования) ----------
  bank: {
    name: 'Банк', icon: '🏦', zoning: 'commercial', category: 'service', tier: 4, minArea: 100, license: 'bank', requiresTech: 'banking',
    description: 'Кредиты и вклады ИИ-клиентов. Свой банк снижает ставку по вашим кредитам на 3 п.п. и поднимает кредитный лимит на 30%.',
    capex: 2500000, renovPerM2: 400,
    upkeep: { base: 15000, perArea: 20 },
    staff: { role: 'Банкир', wage: 6000, min: 10, max: 80, def: 20 },
    marketing: 0,
    service: { revenuePerStaff: 380, inputs: {}, talent: true, bonus: 'Ставка по вашим кредитам −3 п.п., кредитный лимит +30%' },
  },
  saas: {
    name: 'Облачный сервис', icon: '☁️', zoning: 'commercial', category: 'service', tier: 4, requiresTech: 'cloud',
    description: 'Софт по подписке для ИИ-компаний. Нужны дорогие программисты, зато сырья нет вообще.',
    capex: 1500000, renovPerM2: 200,
    upkeep: { base: 8000, perArea: 10 },
    staff: { role: 'Инженер', wage: 7000, min: 10, max: 100, def: 25 },
    marketing: 0,
    service: { revenuePerStaff: 300, inputs: {}, talent: true, bonus: 'Подписки ИИ-клиентов' },
  },
  electronics_plant: {
    name: 'Завод электроники', icon: '🏭', zoning: 'industrial', category: 'industry', tier: 4, requiresTech: 'electronics', license: 'eco',
    description: 'Собирает электронику из микросхем и пластика — для своих магазинов техники и на мировой рынок.',
    capex: 9600000, renovPerM2: 80,
    upkeep: { base: 30000, perArea: 6 },
    staff: { role: 'Сборщик', wage: 3500, min: 20, max: 200, def: 75 },
    marketing: 0,
    production: {
      perStaff: 8, cap: [300, 600, 1000],
      recipe: { output: 'electronics', inputs: { chips: 3, plastic: 1.5 } },
    },
  },
  electronics_store: {
    name: 'Магазин техники', icon: '📱', zoning: 'commercial', category: 'electronics', tier: 4, minArea: 80, requiresTech: 'electronics',
    description: 'Смартфоны и гаджеты. Дорогой чек, лучше всего в торговых центрах. Свой завод электроники — главное преимущество.',
    capex: 450000, renovPerM2: 300,
    upkeep: { base: 2000, perArea: 12 },
    staff: { role: 'Консультант', wage: 3000, min: 3, max: 30, def: 6 },
    marketing: 1200,
    retail: {
      perStaff: 6, cap: [60, 120, 200],
      products: [
        { id: 'device', name: 'Гаджет', ref: 215, attach: 1, tradable: 0.6, recipe: { electronics: 1 } },
        { id: 'accessory', name: 'Аксессуары', ref: 25, attach: 0.6, recipe: { electronics: 0.1, plastic: 0.2 } },
      ],
    },
  },
};

// Улучшения оборудования: уровень 1..3.
export const MAX_LEVEL = 3;
export const UPGRADE_COST_FACTOR = 0.5; // × capex × текущий уровень
export const QUALITY_PER_LEVEL = 0.4;
