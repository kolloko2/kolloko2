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
// service.volatility — насколько «гуляет» выручка услуги от месяца к месяцу (риск);
// service.cycle — чувствительность к экономике страны (кризис бьёт по застройщику и банку, но не по электростанции);
// service.realEstate — доход от сдачи площадей (торговый и бизнес-центр); service.onlyPort — только в портовых городах.
// Профили: розница — средний риск; недвижимость и энергетика — дорого, но стабильно;
// застройщик, фарма, автосалоны — дорого и рискованно, зато могут принести очень много.
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
    description: 'Мелет пшеницу в муку для пекарен и фастфуда или делает комбикорм для ферм.',
    capex: 493000, renovPerM2: 40,
    upkeep: { base: 4500, perArea: 2 },
    staff: { role: 'Мельник', wage: 3000, min: 1, max: 20, def: 3 },
    marketing: 0,
    production: {
      perStaff: 2000, cap: [6000, 12000, 20000],
      variants: {
        flour: { inputs: { wheat: 1.35 } },
        feed: { inputs: { corn: 0.6, soybeans: 0.3 }, rate: 0.9 },
      },
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
    description: 'Делает сыр или сливочное масло из молока. Ставьте рядом с молочными фермами — молоко быстро портится в дороге.',
    capex: 634000, renovPerM2: 50,
    upkeep: { base: 6000, perArea: 3 },
    staff: { role: 'Технолог', wage: 2700, min: 2, max: 30, def: 4 },
    marketing: 0,
    production: {
      perStaff: 75, cap: [300, 600, 1000],
      variants: {
        cheese: { inputs: { milk: 9 } },
        butter: { inputs: { milk: 9 }, rate: 1.6 },
      },
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
    service: { revenuePerStaff: 260, volatility: 0.08, cycle: 1, inputs: { fuel: 80 }, bonus: 'Доставка для ваших бизнесов в этом регионе дешевле на 40%' },
  },
  ad_agency: {
    name: 'Рекламное агентство', icon: '📣', zoning: 'commercial', category: 'service', tier: 2,
    description: 'Ведёт рекламу ИИ-клиентов, а реклама ваших точек в этой стране работает на 30% эффективнее.',
    capex: 120000, renovPerM2: 120,
    upkeep: { base: 1200, perArea: 8 },
    staff: { role: 'Креативщик', wage: 3800, min: 1, max: 30, def: 4 },
    marketing: 0,
    service: { revenuePerStaff: 210, volatility: 0.12, cycle: 1.5, inputs: {}, talent: true, bonus: 'Реклама ваших точек в этой стране эффективнее на 30%' },
  },
  it_studio: {
    name: 'IT-студия', icon: '💻', zoning: 'commercial', category: 'service', tier: 2,
    description: 'Разрабатывает ПО на заказ, а её кассовая система ускоряет все ваши точки (+10% мощности), если в студии 3+ программиста.',
    capex: 100000, renovPerM2: 120,
    upkeep: { base: 1000, perArea: 8 },
    staff: { role: 'Программист', wage: 5000, min: 1, max: 40, def: 4 },
    marketing: 0,
    service: { revenuePerStaff: 240, volatility: 0.15, cycle: 0.5, inputs: {}, talent: true, bonus: '+10% мощности всех ваших точек продаж (нужно 3+ программиста)' },
  },
  billboards: {
    name: 'Рекламные щиты', icon: '🪧', zoning: 'commercial', category: 'service', tier: 2,
    description: 'Свои щиты по городу: сдаёте их рекламодателям, а ваши точки в этом городе рекламируются на них бесплатно.',
    capex: 160000, renovPerM2: 20,
    upkeep: { base: 1200, perArea: 2 },
    staff: { role: 'Монтажник', wage: 2600, min: 1, max: 15, def: 3 },
    marketing: 0,
    service: { revenuePerStaff: 110, volatility: 0.08, cycle: 1, inputs: {}, bonus: 'Ваши точки в этом городе бесплатно висят на билбордах (как $1500/мес рекламы каждой)' },
  },
  // ---------- туризм, здоровье, авто ----------
  hotel: {
    name: 'Отель', icon: '🏨', zoning: 'commercial', category: 'hotel', tier: 3, minArea: 120,
    description: 'Номера для туристов: чем туристичнее город, тем больше гостей. Летом аншлаг, зимой пусто. Дорого, но надолго.',
    capex: 2400000, renovPerM2: 500,
    upkeep: { base: 7000, perArea: 25 },
    staff: { role: 'Персонал отеля', wage: 2400, min: 8, max: 80, def: 20 },
    marketing: 3000,
    retail: {
      perStaff: 3, cap: [60, 120, 200],
      products: [
        { id: 'room', name: 'Номер на ночь', ref: 90, attach: 1, tradable: 0.3, recipe: { groceries: 1.5 } },
        { id: 'hmeal', name: 'Ресторан отеля', ref: 25, attach: 0.5, recipe: { groceries: 3, meat: 0.1 } },
      ],
    },
  },
  fitness: {
    name: 'Фитнес-клуб', icon: '🏋️', zoning: 'commercial', category: 'fitness', tier: 2, minArea: 100,
    description: 'Абонементы: сырья почти нет, доход стабильный, но большие площади и зарплаты тренеров. Пик — в январе.',
    capex: 380000, renovPerM2: 250,
    upkeep: { base: 1500, perArea: 12 },
    staff: { role: 'Тренер', wage: 2700, min: 3, max: 30, def: 6 },
    marketing: 1500,
    retail: {
      perStaff: 45, cap: [300, 500, 800],
      products: [
        { id: 'visit', name: 'Посещение', ref: 7, attach: 1, recipe: {} },
        { id: 'shake', name: 'Протеиновый коктейль', ref: 4, attach: 0.2, recipe: { milk: 0.3, sugar: 0.03 } },
      ],
    },
  },
  beauty_salon: {
    name: 'Салон красоты', icon: '💇', zoning: 'commercial', category: 'beauty', tier: 1,
    description: 'Стрижки и уход: дорогой труд мастеров, дешёвая косметика. Любит престижные районы.',
    capex: 140000, renovPerM2: 200,
    upkeep: { base: 800, perArea: 10 },
    staff: { role: 'Мастер', wage: 3200, min: 2, max: 20, def: 4 },
    marketing: 800,
    retail: {
      perStaff: 7, cap: [50, 90, 140],
      products: [
        { id: 'haircut', name: 'Услуга', ref: 30, attach: 1, recipe: { cosmetics: 0.15 } },
        { id: 'beautyshop', name: 'Косметика', ref: 12, attach: 0.25, recipe: { cosmetics: 1 } },
      ],
    },
  },
  pharmacy: {
    name: 'Аптека', icon: '💊', zoning: 'commercial', category: 'pharmacy', tier: 2, license: 'pharma_retail',
    description: 'Лекарства нужны всегда: спрос почти не зависит от кризисов. Невысокая, но стабильная маржа.',
    capex: 130000, renovPerM2: 150,
    upkeep: { base: 700, perArea: 9 },
    staff: { role: 'Фармацевт', wage: 2700, min: 2, max: 15, def: 3 },
    marketing: 500,
    retail: {
      perStaff: 35, cap: [250, 450, 700],
      products: [
        { id: 'meds', name: 'Лекарства', ref: 15, attach: 1, recipe: { medicine: 1.4 } },
        { id: 'pcosm', name: 'Косметика', ref: 9, attach: 0.3, recipe: { cosmetics: 1 } },
      ],
    },
  },
  pharma_plant: {
    name: 'Фармзавод', icon: '🧬', zoning: 'industrial', category: 'industry', tier: 4, license: 'pharma', requiresTech: 'pharma',
    description: 'Огромная маржа на лекарствах, но очень дорогой вход, лицензия и риск отзыва партии. Снабжает ваши аптеки.',
    capex: 12000000, renovPerM2: 200,
    upkeep: { base: 40000, perArea: 10 },
    staff: { role: 'Технолог', wage: 4500, min: 10, max: 120, def: 50 },
    marketing: 0,
    production: {
      perStaff: 60, cap: [3000, 6000, 10000],
      recipe: { output: 'medicine', inputs: { sugar: 0.05, plastic: 0.08 } },
    },
  },
  car_dealer: {
    name: 'Автосалон', icon: '🚗', zoning: 'commercial', category: 'cars', tier: 3, minArea: 120,
    description: 'Дорогие покупки: несколько машин в день дают большие деньги, но в кризис продажи падают вдвое.',
    capex: 650000, renovPerM2: 200,
    upkeep: { base: 3000, perArea: 12 },
    staff: { role: 'Менеджер продаж', wage: 3200, min: 4, max: 30, def: 8 },
    marketing: 4000,
    retail: {
      perStaff: 0.6, cap: [5, 9, 15],
      products: [
        { id: 'car', name: 'Автомобиль', ref: 23700, attach: 1, tradable: 0.75, recipe: { cars: 1 } },
        { id: 'carservice', name: 'Допы и сервис', ref: 900, attach: 0.6, recipe: { parts: 5 } },
      ],
    },
  },
  auto_service: {
    name: 'Автосервис', icon: '🔧', zoning: 'commercial', category: 'autoservice', tier: 2,
    description: 'Ремонт и шиномонтаж: машины ломаются всегда — скромно, но стабильно. Хорошая пара к АЗС и автосалону.',
    capex: 250000, renovPerM2: 120,
    upkeep: { base: 1000, perArea: 8 },
    staff: { role: 'Автомеханик', wage: 3000, min: 2, max: 25, def: 5 },
    marketing: 600,
    retail: {
      perStaff: 6, cap: [40, 70, 110],
      products: [
        { id: 'repair', name: 'Ремонт', ref: 110, attach: 1, recipe: { parts: 1.5 } },
        { id: 'tires', name: 'Шиномонтаж', ref: 50, attach: 0.3, recipe: { parts: 0.3 } },
      ],
    },
  },
  cosmetics_factory: {
    name: 'Косметическая фабрика', icon: '🧴', zoning: 'industrial', category: 'industry', tier: 3, license: 'eco',
    description: 'Кремы и шампуни из пластика, сахара и молока — для ваших салонов красоты и аптек.',
    capex: 7000000, renovPerM2: 60,
    upkeep: { base: 15000, perArea: 4 },
    staff: { role: 'Технолог', wage: 3000, min: 5, max: 80, def: 30 },
    marketing: 0,
    production: {
      perStaff: 100, cap: [3000, 6000, 10000],
      recipe: { output: 'cosmetics', inputs: { plastic: 0.8, sugar: 0.2, milk: 0.5 } },
    },
  },
  parts_factory: {
    name: 'Завод автозапчастей', icon: '⚙️', zoning: 'industrial', category: 'industry', tier: 3,
    description: 'Запчасти из пластика и микросхем — для автосервисов, автосалонов и автозавода.',
    capex: 5000000, renovPerM2: 60,
    upkeep: { base: 12000, perArea: 4 },
    staff: { role: 'Станочник', wage: 3200, min: 5, max: 120, def: 50 },
    marketing: 0,
    production: {
      perStaff: 10, cap: [500, 1000, 1800],
      recipe: { output: 'parts', inputs: { plastic: 5, chips: 0.4 } },
    },
  },
  car_plant: {
    name: 'Автозавод', icon: '🏭', zoning: 'industrial', category: 'industry', tier: 4, requiresTech: 'electronics', license: 'eco',
    description: 'Вершина цепочки: машины из запчастей, электроники и пластика. Огромные вложения и обороты; без своего завода запчастей почти не окупается.',
    capex: 80000000, renovPerM2: 500,
    upkeep: { base: 150000, perArea: 20 },
    staff: { role: 'Сборщик', wage: 4000, min: 50, max: 400, def: 200 },
    marketing: 0,
    production: {
      perStaff: 0.1, cap: [20, 40, 70],
      recipe: { output: 'cars', inputs: { parts: 550, electronics: 2, plastic: 150 } },
    },
  },
  // ---------- недвижимость, стройка, инфраструктура ----------
  shopping_mall: {
    name: 'Торговый центр', icon: '🏬', zoning: 'commercial', category: 'service', tier: 3, minArea: 120,
    description: 'Многоэтажный ТЦ: сдаёте площади арендаторам. Дорого, окупается долго, зато доход как часы. Ваши точки в районе платят на 30% меньше аренды.',
    capex: 3200000, renovPerM2: 600,
    upkeep: { base: 12000, perArea: 30 },
    staff: { role: 'Управляющий площадями', wage: 3000, min: 4, max: 30, def: 8 },
    marketing: 0,
    service: { realEstate: 32, volatility: 0.04, cycle: 0.5, inputs: {}, bonus: 'Ваши точки в этом районе платят на 30% меньше аренды' },
  },
  business_center: {
    name: 'Бизнес-центр', icon: '🏢', zoning: 'commercial', category: 'service', tier: 3, minArea: 100,
    description: 'Офисы в аренду: самый спокойный доход в игре, если район деловой. Окупается 4–6 лет.',
    capex: 2600000, renovPerM2: 500,
    upkeep: { base: 8000, perArea: 25 },
    staff: { role: 'Администратор', wage: 3000, min: 3, max: 20, def: 6 },
    marketing: 0,
    service: { realEstate: 30, volatility: 0.03, cycle: 0.7, inputs: {}, bonus: 'Стабильная аренда офисов' },
  },
  developer: {
    name: 'Застройщик', icon: '🏗️', zoning: 'industrial', category: 'service', tier: 3,
    description: 'Строит жильё: в хорошие годы — огромные деньги, в кризис — убытки. Каждый год делает свой город на 2% многолюднее.',
    capex: 900000, renovPerM2: 30,
    upkeep: { base: 8000, perArea: 3 },
    staff: { role: 'Строитель', wage: 3200, min: 10, max: 120, def: 25 },
    marketing: 0,
    service: { revenuePerStaff: 90, volatility: 0.3, cycle: 2.5, inputs: {}, bonus: 'Каждый год +2% потока людей во всех районах города (до +20%)' },
  },
  power_plant: {
    name: 'Электростанция', icon: '⚡', zoning: 'industrial', category: 'service', tier: 4, license: 'energy',
    description: 'Газовая электростанция: продаёт энергию по регулируемому тарифу — очень дорого, очень стабильно. Ваши бизнесы в регионе платят на 15% меньше за коммунальные.',
    capex: 5000000, renovPerM2: 60,
    upkeep: { base: 30000, perArea: 5 },
    staff: { role: 'Энергетик', wage: 4000, min: 10, max: 60, def: 20 },
    marketing: 0,
    service: { revenuePerStaff: 520, volatility: 0.02, cycle: 0, inputs: { fuel: 350 }, bonus: 'Коммунальные ваших бизнесов в регионе −15%' },
  },
  port: {
    name: 'Морской порт', icon: '⚓', zoning: 'industrial', category: 'service', tier: 4,
    description: 'Только в портовых городах. Перевалка грузов ИИ-клиентов; ваши межконтинентальные грузы из региона идут без задержки в портах и дешевле.',
    capex: 3500000, renovPerM2: 60,
    upkeep: { base: 25000, perArea: 5 },
    staff: { role: 'Докер', wage: 3200, min: 15, max: 150, def: 40 },
    marketing: 0,
    service: { revenuePerStaff: 140, volatility: 0.1, cycle: 1.2, inputs: { fuel: 20 }, onlyPort: true, bonus: 'Ваши грузы из этого региона: без 3 дней в портах и на 30% дешевле' },
  },
  courier: {
    name: 'Служба доставки', icon: '🛵', zoning: 'commercial', category: 'service', tier: 2,
    description: 'Свои курьеры: ваши кафе и рестораны в городе доставляют еду сами — комиссия 8% вместо 25% у агрегатора. Плюс заказы ИИ-клиентов.',
    capex: 120000, renovPerM2: 60,
    upkeep: { base: 900, perArea: 5 },
    staff: { role: 'Курьер', wage: 2200, min: 3, max: 80, def: 10 },
    marketing: 0,
    service: { revenuePerStaff: 55, volatility: 0.06, cycle: 0.8, inputs: { fuel: 6 }, bonus: 'Своя доставка для ваших кафе и ресторанов в городе (комиссия 8%)' },
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
      variants: {
        fuel: { inputs: { oil: 1.15 } },
        jet_fuel: { inputs: { oil: 1.2 }, rate: 0.7 },
      },
    },
  },
  chemical_plant: {
    name: 'Нефтехимический завод', icon: '🧪', zoning: 'industrial', category: 'industry', tier: 3, license: 'eco',
    description: 'Пластик из нефти, а также химикаты, удобрения, краски и бытовая химия. Продукцию можно сменить (перенастройка — неделя).',
    capex: 2464000, renovPerM2: 40,
    upkeep: { base: 15000, perArea: 3 },
    staff: { role: 'Химик-технолог', wage: 3600, min: 3, max: 50, def: 8 },
    marketing: 0,
    production: {
      perStaff: 800, cap: [4000, 8000, 14000],
      variants: {
        plastic: { inputs: { oil: 1.6 } },
        chemicals: { inputs: { natural_gas: 1.2, salt: 0.5 }, rate: 1.2 },
        fertilizer: { inputs: { natural_gas: 0.6, phosphate: 0.5, potash: 0.4 }, rate: 3 },
        paint: { inputs: { chemicals: 0.6, oil: 0.3 }, rate: 0.15 },
        detergents: { inputs: { chemicals: 0.5, plastic: 0.08 }, rate: 0.3 },
      },
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
    service: { revenuePerStaff: 380, volatility: 0.1, cycle: 2, inputs: {}, talent: true, bonus: 'Ставка по вашим кредитам −3 п.п., кредитный лимит +30%' },
  },
  saas: {
    name: 'Облачный сервис', icon: '☁️', zoning: 'commercial', category: 'service', tier: 4, requiresTech: 'cloud',
    description: 'Софт по подписке для ИИ-компаний. Нужны дорогие программисты, зато сырья нет вообще.',
    capex: 1500000, renovPerM2: 200,
    upkeep: { base: 8000, perArea: 10 },
    staff: { role: 'Инженер', wage: 7000, min: 10, max: 100, def: 25 },
    marketing: 0,
    service: { revenuePerStaff: 300, volatility: 0.2, cycle: 0.5, inputs: {}, talent: true, bonus: 'Подписки ИИ-клиентов' },
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
      variants: {
        electronics: { inputs: { chips: 3, plastic: 1.5 } },
        computers: { inputs: { chips: 6, plastic: 2, aluminum: 1.5, cables: 3 }, rate: 0.12 },
      },
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

  // ---------- добыча: шахты, карьеры, прииски, месторождения ----------
  mine: {
    name: 'Шахта / рудник', icon: '⛏️', zoning: 'farmland', category: 'mining', tier: 3, license: 'subsoil',
    description: 'Добывает то, что есть в недрах региона: руду, уголь, соли, литий, уран. Дорого и тяжело, зато сырьё нужно всем заводам мира.',
    capex: 3600000, renovPerM2: 0,
    upkeep: { base: 22000, perArea: 10 },
    staff: { role: 'Горняк', wage: 3600, min: 10, max: 150, def: 40 },
    marketing: 0,
    production: {
      perStaff: 900, cap: [60000, 120000, 200000],
      variants: {
        iron_ore: { res: true }, coal: { res: true, rate: 0.95 }, copper_ore: { res: true, rate: 0.13 },
        bauxite: { res: true, rate: 1.8 }, nickel_ore: { res: true, rate: 0.075 }, phosphate: { res: true, rate: 0.9 },
        potash: { res: true, rate: 0.4 }, salt: { res: true, rate: 1.4 }, lithium: { res: true, rate: 0.008 },
        uranium: { res: true, rate: 0.001 },
      },
    },
  },
  gold_mine: {
    name: 'Золотой прииск', icon: '🥇', zoning: 'farmland', category: 'mining', tier: 3, license: 'subsoil',
    description: 'Золото и серебро: цена металлов скачет — то сказочная прибыль, то работа в ноль.',
    capex: 4000000, renovPerM2: 0,
    upkeep: { base: 20000, perArea: 8 },
    staff: { role: 'Старатель', wage: 3400, min: 8, max: 120, def: 30 },
    marketing: 0,
    production: {
      perStaff: 2, cap: [100, 200, 340],
      variants: { gold: { res: true }, silver: { res: true, rate: 70 } },
    },
  },
  gas_field: {
    name: 'Газовое месторождение', icon: '🔥', zoning: 'farmland', category: 'oil', tier: 3, license: 'subsoil',
    description: 'Добывает природный газ — сырьё для химии, удобрений, стекла и алюминия.',
    capex: 2100000, renovPerM2: 0,
    upkeep: { base: 7000, perArea: 10 },
    staff: { role: 'Газовик', wage: 4000, min: 3, max: 60, def: 12 },
    marketing: 0,
    production: {
      perStaff: 520, capPerArea: 60,
      variants: { natural_gas: { res: true } },
    },
  },
  quarry: {
    name: 'Карьер', icon: '🪨', zoning: 'industrial', category: 'mining', tier: 2,
    description: 'Известняк, песок или глина на окраине города — дёшево, скромно, но стройка и стекольщики берут всегда.',
    capex: 700000, renovPerM2: 10,
    upkeep: { base: 5000, perArea: 1 },
    staff: { role: 'Машинист экскаватора', wage: 2800, min: 2, max: 30, def: 8 },
    marketing: 0,
    production: {
      perStaff: 4000, cap: [40000, 80000, 130000],
      variants: { limestone: {}, sand: { rate: 0.75 }, clay: {} },
    },
  },
  logging: {
    name: 'Лесозаготовка', icon: '🪵', zoning: 'farmland', category: 'farm', tier: 2,
    description: 'Валит лес для лесопилок: пиломатериалы, бумага, картон.',
    capex: 520000, renovPerM2: 0,
    upkeep: { base: 2500, perArea: 2 },
    staff: { role: 'Лесоруб', wage: 2600, min: 2, max: 60, def: 12 },
    marketing: 0,
    production: {
      perStaff: 1.1, capPerArea: 0.07,
      variants: { timber: { res: true } },
    },
  },
  // ---------- поля, сады, птица, море ----------
  crop_farm: {
    name: 'Растениеводство', icon: '🌽', zoning: 'farmland', category: 'farm', tier: 2,
    description: 'Кукуруза, рис, соя, картофель, овощи, ячмень, свёкла или хлопок — что растёт в этом регионе.',
    capex: 450000, renovPerM2: 0,
    upkeep: { base: 1600, perArea: 3 },
    staff: { role: 'Механизатор', wage: 2200, min: 1, max: 40, def: 6 },
    marketing: 0,
    production: {
      perStaff: 160, capPerArea: 40,
      variants: {
        corn: { res: true, rate: 0.7 }, rice: { res: true, rate: 0.35 }, soybeans: { res: true, rate: 0.3 },
        potatoes: { res: true, rate: 0.7 }, vegetables: { res: true, rate: 0.25 }, barley: { res: true, rate: 0.75 },
        sugar_beet: { res: true, rate: 2.8 }, cotton: { res: true, rate: 0.085 },
      },
    },
  },
  orchard: {
    name: 'Сад / плантация', icon: '🍇', zoning: 'farmland', category: 'farm', tier: 2,
    description: 'Фрукты, виноград, какао, чай или каучук. Много ручного труда — выгоднее там, где он дешёвый.',
    capex: 620000, renovPerM2: 0,
    upkeep: { base: 1200, perArea: 2 },
    staff: { role: 'Сборщик', wage: 1700, min: 2, max: 120, def: 15 },
    marketing: 0,
    production: {
      perStaff: 20, capPerArea: 6,
      variants: {
        fruits: { res: true }, grapes: { res: true }, cocoa: { res: true, rate: 0.2 },
        tea_leaf: { res: true, rate: 0.3 }, rubber: { res: true, rate: 0.55 },
      },
    },
  },
  poultry_farm: {
    name: 'Птицефабрика', icon: '🐔', zoning: 'industrial', category: 'industry', tier: 2, license: 'food',
    description: 'Яйца или курица из комбикорма — для фастфуда, ресторанов и консервных заводов.',
    capex: 1000000, renovPerM2: 30,
    upkeep: { base: 5000, perArea: 2 },
    staff: { role: 'Птичник', wage: 2400, min: 2, max: 40, def: 10 },
    marketing: 0,
    production: {
      perStaff: 1500, cap: [15000, 30000, 50000],
      variants: { eggs: { inputs: { feed: 0.13 } }, chicken: { inputs: { feed: 2.0 }, rate: 0.05 } },
    },
  },
  fishery: {
    name: 'Рыболовецкая компания', icon: '🐟', zoning: 'industrial', category: 'industry', tier: 2, onlyPort: true,
    description: 'Только в портовых городах. Свой флот ловит рыбу: улов и цены гуляют, топливо — главная статья расходов.',
    capex: 2500000, renovPerM2: 20,
    upkeep: { base: 12000, perArea: 2 },
    staff: { role: 'Рыбак', wage: 3000, min: 6, max: 80, def: 30 },
    marketing: 0,
    production: {
      perStaff: 21, cap: [1200, 2400, 4000],
      recipe: { output: 'fish', inputs: { fuel: 0.3 } },
    },
  },
  // ---------- переработка: металлы, стройматериалы, лес ----------
  steel_mill: {
    name: 'Металлургический комбинат', icon: '🔥', zoning: 'industrial', category: 'industry', tier: 3, license: 'eco', requiresTech: 'metallurgy',
    description: 'Сталь из железной руды и угля. Огромные объёмы — свои шахты рядом решают всё.',
    capex: 10400000, renovPerM2: 60,
    upkeep: { base: 40000, perArea: 5 },
    staff: { role: 'Сталевар', wage: 3600, min: 20, max: 200, def: 80 },
    marketing: 0,
    production: {
      perStaff: 500, cap: [40000, 80000, 140000],
      recipe: { output: 'steel', inputs: { iron_ore: 1.6, coal: 0.8 } },
    },
  },
  smelter: {
    name: 'Завод цветных металлов', icon: '🏭', zoning: 'industrial', category: 'industry', tier: 3, license: 'eco', requiresTech: 'metallurgy',
    description: 'Алюминий из бокситов (нужно много газа), медь или никель из руды — для кабелей, батарей и техники.',
    capex: 7500000, renovPerM2: 60,
    upkeep: { base: 35000, perArea: 5 },
    staff: { role: 'Металлург', wage: 3600, min: 15, max: 150, def: 60 },
    marketing: 0,
    production: {
      perStaff: 170, cap: [10000, 20000, 35000],
      variants: {
        aluminum: { inputs: { bauxite: 4.5, natural_gas: 4 } },
        copper: { inputs: { copper_ore: 4 }, rate: 0.2 },
        nickel: { inputs: { nickel_ore: 8 }, rate: 0.45 },
      },
    },
  },
  building_materials: {
    name: 'Завод стройматериалов', icon: '🧱', zoning: 'industrial', category: 'industry', tier: 2, license: 'eco',
    description: 'Цемент, кирпич или стекло из карьерного сырья. Стройка любит местное: возить цемент далеко невыгодно.',
    capex: 2500000, renovPerM2: 40,
    upkeep: { base: 14000, perArea: 3 },
    staff: { role: 'Технолог', wage: 3000, min: 6, max: 80, def: 25 },
    marketing: 0,
    production: {
      perStaff: 1600, cap: [60000, 120000, 200000],
      variants: {
        cement: { inputs: { limestone: 1.3, clay: 0.3, coal: 0.12 } },
        bricks: { inputs: { clay: 2.5, coal: 0.15 }, rate: 0.2 },
        glass: { inputs: { sand: 0.75, limestone: 0.2, natural_gas: 0.6 }, rate: 0.08 },
      },
    },
  },
  sawmill: {
    name: 'Лесопильный комбинат', icon: '🪚', zoning: 'industrial', category: 'industry', tier: 2,
    description: 'Пиломатериалы для мебели и стройки, бумага для типографий или картон для упаковки.',
    capex: 2300000, renovPerM2: 30,
    upkeep: { base: 10000, perArea: 3 },
    staff: { role: 'Станочник', wage: 2800, min: 4, max: 60, def: 20 },
    marketing: 0,
    production: {
      perStaff: 1.5, cap: [30, 60, 100],
      variants: {
        lumber: { inputs: { timber: 1.6 } },
        paper: { inputs: { timber: 0.004, chemicals: 0.1 }, rate: 190 },
        cardboard: { inputs: { timber: 0.0028, chemicals: 0.03 }, rate: 250 },
      },
    },
  },
  // ---------- пищевая промышленность ----------
  oil_mill: {
    name: 'Маслозавод', icon: '🫒', zoning: 'industrial', category: 'industry', tier: 2, license: 'food',
    description: 'Давит соевое масло для пищевых фабрик и ресторанов.',
    capex: 1600000, renovPerM2: 40,
    upkeep: { base: 7000, perArea: 3 },
    staff: { role: 'Оператор', wage: 2700, min: 3, max: 40, def: 10 },
    marketing: 0,
    production: {
      perStaff: 500, cap: [5000, 10000, 17000],
      recipe: { output: 'vegetable_oil', inputs: { soybeans: 2.2 } },
    },
  },
  beverage_plant: {
    name: 'Завод напитков', icon: '🍺', zoning: 'industrial', category: 'industry', tier: 2, license: 'alcohol',
    description: 'Пиво, газировка, вода, соки или чай — для баров, магазинов и мирового рынка.',
    capex: 2600000, renovPerM2: 40,
    upkeep: { base: 11000, perArea: 3 },
    staff: { role: 'Технолог', wage: 2800, min: 4, max: 60, def: 15 },
    marketing: 0,
    production: {
      perStaff: 175, cap: [5000, 10000, 17500],
      variants: {
        beer: { inputs: { barley: 0.18, glass: 0.3 } },
        soda: { inputs: { sugar: 0.1, plastic: 0.03 }, rate: 1.6 },
        water: { inputs: { plastic: 0.03 }, rate: 3.5 },
        juice: { inputs: { fruits: 1.2, cardboard: 0.05 }, rate: 1.1 },
        tea: { inputs: { tea_leaf: 1.1, cardboard: 0.1 }, rate: 0.12 },
      },
    },
  },
  winery: {
    name: 'Винодельня', icon: '🍷', zoning: 'industrial', category: 'industry', tier: 2, license: 'alcohol',
    description: 'Вино из винограда: дорогой продукт, хорошая маржа, свои виноградники делают её ещё лучше.',
    capex: 2600000, renovPerM2: 60,
    upkeep: { base: 8000, perArea: 3 },
    staff: { role: 'Винодел', wage: 3000, min: 3, max: 40, def: 12 },
    marketing: 0,
    production: {
      perStaff: 90, cap: [1000, 2000, 3500],
      recipe: { output: 'wine', inputs: { grapes: 1.5, glass: 0.6 } },
    },
  },
  confectionery: {
    name: 'Кондитерская фабрика', icon: '🍫', zoning: 'industrial', category: 'industry', tier: 2, license: 'food',
    description: 'Шоколад, мороженое или макароны. Шоколад зависит от капризных цен на какао.',
    capex: 2700000, renovPerM2: 50,
    upkeep: { base: 10000, perArea: 3 },
    staff: { role: 'Кондитер', wage: 2700, min: 4, max: 60, def: 15 },
    marketing: 0,
    production: {
      perStaff: 40, cap: [600, 1200, 2000],
      variants: {
        chocolate: { inputs: { cocoa: 0.5, sugar: 0.4, milk: 0.3 } },
        ice_cream: { inputs: { milk: 1.5, sugar: 0.2, cardboard: 0.05 }, rate: 2.2 },
        pasta: { inputs: { flour: 1.05 }, rate: 9 },
      },
    },
  },
  cannery: {
    name: 'Консервный завод', icon: '🥫', zoning: 'industrial', category: 'industry', tier: 2, license: 'food',
    description: 'Консервы, заморозка или колбасы: долго хранятся, легко возить через океан.',
    capex: 2000000, renovPerM2: 40,
    upkeep: { base: 10000, perArea: 3 },
    staff: { role: 'Работник линии', wage: 2600, min: 4, max: 60, def: 15 },
    marketing: 0,
    production: {
      perStaff: 200, cap: [3000, 6000, 10000],
      variants: {
        canned_food: { inputs: { vegetables: 0.3, fish: 0.05, steel: 0.08 } },
        frozen_food: { inputs: { vegetables: 0.6, chicken: 0.2, plastic: 0.05 }, rate: 0.55 },
        sausages: { inputs: { meat: 0.7, chicken: 0.3 }, rate: 0.6 },
      },
    },
  },
  // ---------- лёгкая промышленность и товары для людей ----------
  textile_factory: {
    name: 'Текстильная фабрика', icon: '🧵', zoning: 'industrial', category: 'industry', tier: 2, requiresTech: 'light_industry',
    description: 'Ткань из хлопка, одежда или обувь. Много ручного труда — дешёвая рабочая сила решает.',
    capex: 1500000, renovPerM2: 40,
    upkeep: { base: 8000, perArea: 3 },
    staff: { role: 'Швея', wage: 2200, min: 10, max: 200, def: 50 },
    marketing: 0,
    production: {
      perStaff: 12.5, cap: [1500, 3000, 5000],
      variants: {
        fabric: { inputs: { cotton: 0.35, chemicals: 0.05 } },
        clothing: { inputs: { fabric: 1.5 }, rate: 0.6 },
        shoes: { inputs: { fabric: 0.6, rubber: 0.3, plastic: 0.3 }, rate: 0.15 },
      },
    },
  },
  consumer_factory: {
    name: 'Фабрика потребтоваров', icon: '🧸', zoning: 'industrial', category: 'industry', tier: 2, requiresTech: 'light_industry',
    description: 'Игрушки, спорттовары, велосипеды, книги или мебель — для своих магазинов и мирового рынка.',
    capex: 2600000, renovPerM2: 40,
    upkeep: { base: 9000, perArea: 3 },
    staff: { role: 'Сборщик', wage: 2500, min: 6, max: 120, def: 35 },
    marketing: 0,
    production: {
      perStaff: 8, cap: [600, 1200, 2000],
      variants: {
        toys: { inputs: { plastic: 0.3, paint: 0.03 } },
        sports_goods: { inputs: { rubber: 0.2, fabric: 0.5, plastic: 0.2 }, rate: 0.5 },
        bicycles: { inputs: { steel: 9, rubber: 0.6, aluminum: 2 }, rate: 0.05 },
        books: { inputs: { paper: 0.4, paint: 0.02 }, rate: 1.5 },
        furniture: { inputs: { lumber: 0.25, fabric: 3, steel: 4 }, rate: 0.04 },
      },
    },
  },
  rubber_plant: {
    name: 'Шинный завод', icon: '🛞', zoning: 'industrial', category: 'industry', tier: 3, license: 'eco',
    description: 'Шины из каучука, химии и стального корда — для автосервисов, автозаводов и грузовиков.',
    capex: 3200000, renovPerM2: 50,
    upkeep: { base: 15000, perArea: 3 },
    staff: { role: 'Вулканизаторщик', wage: 3000, min: 8, max: 100, def: 30 },
    marketing: 0,
    production: {
      perStaff: 2, cap: [100, 200, 340],
      recipe: { output: 'tires', inputs: { rubber: 4, chemicals: 2, steel: 1.5 } },
    },
  },
  jewelry_factory: {
    name: 'Ювелирный завод', icon: '💍', zoning: 'industrial', category: 'industry', tier: 3,
    description: 'Украшения из золота и серебра. Маржа держится на цене золота: дорожает металл — тает прибыль.',
    capex: 3000000, renovPerM2: 80,
    upkeep: { base: 8000, perArea: 5 },
    staff: { role: 'Ювелир', wage: 3800, min: 4, max: 50, def: 15 },
    marketing: 0,
    production: {
      perStaff: 2, cap: [25, 50, 85],
      recipe: { output: 'jewelry', inputs: { gold: 4, silver: 10 } },
    },
  },
  // ---------- высокие технологии ----------
  electrical_plant: {
    name: 'Электротехнический завод', icon: '🔌', zoning: 'industrial', category: 'industry', tier: 3, requiresTech: 'electrical', license: 'eco',
    description: 'Кабель, бытовая техника, аккумуляторы или солнечные панели. Литий и никель для батарей — дефицит.',
    capex: 5600000, renovPerM2: 60,
    upkeep: { base: 22000, perArea: 4 },
    staff: { role: 'Электромонтажник', wage: 3300, min: 10, max: 150, def: 45 },
    marketing: 0,
    production: {
      perStaff: 120, cap: [10000, 20000, 35000],
      variants: {
        cables: { inputs: { copper: 0.08, plastic: 0.05 } },
        appliances: { inputs: { steel: 15, electronics: 0.3, plastic: 4, copper: 0.5 }, rate: 0.005 },
        batteries: { inputs: { lithium: 0.8, nickel: 0.6, chemicals: 1 }, rate: 0.012 },
        solar_panels: { inputs: { glass: 10, aluminum: 2, chips: 0.2 }, rate: 0.007 },
      },
    },
  },
  chip_fab: {
    name: 'Фабрика микросхем', icon: '🔬', zoning: 'industrial', category: 'industry', tier: 4, requiresTech: 'semiconductors', license: 'eco',
    description: 'Микросхемы из кремния, химии и золота — для электроники, компьютеров и автомобилей. Самое дорогое производство в игре.',
    capex: 50000000, renovPerM2: 400,
    upkeep: { base: 120000, perArea: 20 },
    staff: { role: 'Инженер-технолог', wage: 6000, min: 20, max: 200, def: 80 },
    marketing: 0,
    production: {
      perStaff: 15, cap: [3000, 6000, 10000],
      recipe: { output: 'chips', inputs: { sand: 0.05, chemicals: 0.2, gold: 0.005, copper: 0.01 } },
    },
  },
  machine_plant: {
    name: 'Машиностроительный завод', icon: '🏗️', zoning: 'industrial', category: 'industry', tier: 4, requiresTech: 'machine_building', license: 'eco',
    description: 'Станки, грузовики, медтехника, авиакомпоненты или роботы. Длинные цепочки — огромная добавленная стоимость.',
    capex: 18000000, renovPerM2: 200,
    upkeep: { base: 60000, perArea: 10 },
    staff: { role: 'Инженер', wage: 4200, min: 20, max: 300, def: 120 },
    marketing: 0,
    production: {
      perStaff: 0.02, cap: [2, 4, 7],
      variants: {
        machinery: { inputs: { steel: 900, electronics: 4, cables: 50, parts: 20 } },
        trucks: { inputs: { steel: 4500, parts: 250, tires: 10, electronics: 3 }, rate: 0.3 },
        medical_devices: { inputs: { steel: 10, electronics: 3, plastic: 5 }, rate: 6 },
        aircraft_parts: { inputs: { aluminum: 15, electronics: 6, chips: 10 }, rate: 2.5 },
        robots: { inputs: { machinery: 1, chips: 40, electronics: 20 }, rate: 0.5 },
      },
    },
  },
  // ---------- новые магазины ----------
  clothing_store: {
    name: 'Магазин одежды', icon: '👕', zoning: 'commercial', category: 'clothing', tier: 2,
    description: 'Одежда и обувь: мода меняется, торговые центры — лучшее место. Своя фабрика — главный козырь.',
    capex: 220000, renovPerM2: 140,
    upkeep: { base: 900, perArea: 9 },
    staff: { role: 'Продавец-консультант', wage: 2500, min: 2, max: 20, def: 4 },
    marketing: 800,
    retail: {
      perStaff: 14, cap: [120, 220, 350],
      products: [
        { id: 'clothes', name: 'Одежда', ref: 22, attach: 1, tradable: 0.4, recipe: { clothing: 1 } },
        { id: 'shoes', name: 'Обувь', ref: 42, attach: 0.35, tradable: 0.4, recipe: { shoes: 1 } },
      ],
    },
  },
  home_store: {
    name: 'Мебель и техника', icon: '🛋️', zoning: 'commercial', category: 'home', tier: 3, minArea: 100,
    description: 'Мебель и бытовая техника: редкие, но крупные покупки. Любит спальные районы и торговые кластеры.',
    capex: 380000, renovPerM2: 120,
    upkeep: { base: 1800, perArea: 8 },
    staff: { role: 'Консультант', wage: 2700, min: 3, max: 25, def: 5 },
    marketing: 1200,
    retail: {
      perStaff: 2, cap: [14, 26, 42],
      products: [
        { id: 'furniture', name: 'Мебель', ref: 450, attach: 1, tradable: 0.5, recipe: { furniture: 1 } },
        { id: 'appliance', name: 'Техника', ref: 480, attach: 0.5, tradable: 0.6, recipe: { appliances: 1 } },
      ],
    },
  },
  diy_store: {
    name: 'Строительный гипермаркет', icon: '🔨', zoning: 'commercial', category: 'diy', tier: 3, minArea: 120,
    description: 'Краска, цемент, кабель и доски для ремонта. Растёт вместе с городом и застройщиками.',
    capex: 420000, renovPerM2: 90,
    upkeep: { base: 2000, perArea: 7 },
    staff: { role: 'Продавец', wage: 2500, min: 4, max: 40, def: 8 },
    marketing: 1200,
    retail: {
      perStaff: 8, cap: [90, 170, 280],
      products: [
        { id: 'materials', name: 'Стройматериалы', ref: 75, attach: 1, tradable: 0.4, recipe: { paint: 2, cement: 25, cables: 5, lumber: 0.03 } },
        { id: 'tools', name: 'Инструменты', ref: 16, attach: 0.4, recipe: { steel: 2, plastic: 1 } },
      ],
    },
  },
  kids_store: {
    name: 'Игрушки и книги', icon: '🧸', zoning: 'commercial', category: 'kids', tier: 2,
    description: 'Игрушки и книги: тихо весь год и аншлаг перед Новым годом.',
    capex: 200000, renovPerM2: 110,
    upkeep: { base: 700, perArea: 8 },
    staff: { role: 'Продавец', wage: 2300, min: 2, max: 15, def: 3 },
    marketing: 500,
    retail: {
      perStaff: 18, cap: [120, 220, 350],
      products: [
        { id: 'toy', name: 'Игрушка', ref: 18, attach: 1, tradable: 0.4, recipe: { toys: 1 } },
        { id: 'book', name: 'Книга', ref: 12, attach: 0.4, tradable: 0.4, recipe: { books: 1 } },
      ],
    },
  },
  sports_store: {
    name: 'Спорттовары', icon: '⚽', zoning: 'commercial', category: 'sports', tier: 2,
    description: 'Мячи, форма и велосипеды. Летом — велосипеды, зимой — тихо. Хорошая пара к фитнес-клубу.',
    capex: 140000, renovPerM2: 110,
    upkeep: { base: 800, perArea: 8 },
    staff: { role: 'Продавец', wage: 2400, min: 2, max: 15, def: 3 },
    marketing: 600,
    retail: {
      perStaff: 12, cap: [90, 170, 280],
      products: [
        { id: 'sport', name: 'Спорттовары', ref: 34, attach: 1, tradable: 0.4, recipe: { sports_goods: 1 } },
        { id: 'bike', name: 'Велосипед', ref: 290, attach: 0.06, tradable: 0.5, recipe: { bicycles: 1 } },
      ],
    },
  },
  jewelry_store: {
    name: 'Ювелирный салон', icon: '💎', zoning: 'commercial', category: 'luxury', tier: 3, minArea: 40,
    description: 'Пара покупок в день — и месяц сделан. Только для богатых районов; в кризис продажи проседают.',
    capex: 500000, renovPerM2: 400,
    upkeep: { base: 2500, perArea: 20 },
    staff: { role: 'Ювелир-консультант', wage: 3600, min: 2, max: 12, def: 3 },
    marketing: 2000,
    retail: {
      perStaff: 2, cap: [8, 14, 22],
      products: [
        { id: 'ring', name: 'Украшение', ref: 1050, attach: 1, tradable: 0.7, recipe: { jewelry: 1 } },
        { id: 'watch', name: 'Часы и аксессуары', ref: 240, attach: 0.3, tradable: 0.6, recipe: { silver: 30, electronics: 0.2 } },
      ],
    },
  },
  bar: {
    name: 'Бар', icon: '🍻', zoning: 'commercial', category: 'bar', tier: 2, license: 'alcohol',
    description: 'Пиво, вино и закуски. Вечером и в выходные — полный зал; любит центр и студенческие кварталы.',
    capex: 150000, renovPerM2: 180,
    upkeep: { base: 1000, perArea: 10 },
    staff: { role: 'Бармен', wage: 2500, min: 2, max: 20, def: 4 },
    marketing: 700,
    retail: {
      perStaff: 25, cap: [180, 330, 520],
      products: [
        { id: 'beer', name: 'Пиво', ref: 5.5, attach: 1, recipe: { beer: 0.5 } },
        { id: 'wine', name: 'Бокал вина', ref: 8, attach: 0.35, recipe: { wine: 0.15 } },
        { id: 'snack', name: 'Закуски', ref: 6, attach: 0.4, recipe: { sausages: 0.1, potatoes: 0.15, vegetable_oil: 0.02 } },
      ],
    },
  },
};

// Профиль бизнеса для игрока: риск и характер дохода
export const RISK = {
  coffee_shop: ['mid', 'Ходовой старт: быстро окупается, но много конкурентов'],
  bakery: ['mid', 'Своя выпечка снабжает кофейни'],
  fastfood: ['mid', 'Дёшево открыть, тонкая маржа, любит студентов'],
  minimarket: ['low', 'Тонкая маржа, зато спрос есть всегда'],
  restaurant: ['mid', 'Высокий чек, дорогой персонал'],
  supermarket: ['low', 'Большой оборот, стабильно'],
  gas_station: ['mid', 'Зависит от цен на топливо'],
  coffee_roastery: ['mid', 'Маржа зависит от цен на зерно'],
  mill: ['mid', 'Сырьевой бизнес: цены гуляют'],
  meat_plant: ['mid', 'Сырьевой бизнес: цены гуляют'],
  dairy_plant: ['mid', 'Сырьевой бизнес: цены гуляют'],
  packaging_plant: ['mid', 'Зависит от цен на пластик'],
  food_factory: ['mid', 'Большой оборот, маржа зависит от сырья'],
  refinery: ['high', 'Нефтяные шоки: то густо, то пусто'],
  chemical_plant: ['high', 'Зависит от цен на нефть'],
  oil_well: ['high', 'Огромные деньги при дорогой нефти, убытки при дешёвой'],
  coffee_plantation: ['mid', 'Урожай и цены на кофе'], wheat_farm: ['mid', 'Урожай и погода'],
  dairy_farm: ['mid', 'Корма и цены на молоко'], livestock_farm: ['mid', 'Корма и цены на мясо'],
  trucking: ['mid', 'Заказы зависят от экономики'], ad_agency: ['high', 'В кризис реклама — первое, на чём экономят'],
  it_studio: ['mid', 'Нужны дорогие программисты'], billboards: ['mid', 'Реклама на своих щитах — бесплатно'],
  warehouse: ['low', 'Экономит на закупках и доставке'],
  bank: ['high', 'В кризис невозвраты бьют по прибыли'], saas: ['high', 'Подписки: то бум, то отток'],
  electronics_plant: ['high', 'Огромный оборот, мода и цены на чипы'], electronics_store: ['high', 'Дорогие покупки, мода на гаджеты'],
  hotel: ['mid', 'Сезон и туристы: летом аншлаг, зимой пусто'], fitness: ['low', 'Абонементы: стабильно, пик в январе'],
  beauty_salon: ['low', 'Мастера дорогие, клиенты верные'], pharmacy: ['low', 'Лекарства нужны всегда — почти без кризисов'],
  pharma_plant: ['high', 'Огромная маржа, но отзывы партий стоят миллионы'], car_dealer: ['high', 'Дорогие покупки: в кризис продажи падают вдвое'],
  auto_service: ['low', 'Машины ломаются всегда'], shopping_mall: ['low', 'Дорого, но аренда как часы'],
  business_center: ['low', 'Самый спокойный доход'], developer: ['high', 'Бум — огромные деньги, кризис — убытки'],
  power_plant: ['low', 'Регулируемый тариф: очень стабильно'], port: ['mid', 'Зависит от мировой торговли'],
  courier: ['mid', 'Своя доставка для ваших кафе'],
  cosmetics_factory: ['mid', 'Снабжает салоны и аптеки, высокая маржа'],
  parts_factory: ['mid', 'Запчасти нужны всем автосервисам'],
  car_plant: ['high', 'Гигантские вложения, обороты и риск'],
  mine: ['mid', 'Сырьё нужно всем, но цены на руду гуляют'], gold_mine: ['high', 'Цена золота скачет: то густо, то пусто'],
  gas_field: ['mid', 'Цены на газ — вслед за нефтью'], quarry: ['low', 'Дёшево и скромно, но спрос есть всегда'],
  logging: ['low', 'Лес растёт, спрос стабилен'], crop_farm: ['mid', 'Урожай и погода'], orchard: ['mid', 'Урожай, погода и ручной труд'],
  poultry_farm: ['low', 'Яйца и курица нужны всегда'], fishery: ['high', 'Улов и топливо: то густо, то пусто'],
  steel_mill: ['mid', 'Огромные объёмы, маржа от цен на руду и уголь'], smelter: ['mid', 'Металлы: цены гуляют, газ дорог'],
  building_materials: ['mid', 'Стройка: бум и спад вместе с экономикой'], sawmill: ['low', 'Спокойный сырьевой бизнес'],
  oil_mill: ['low', 'Тонкая, но стабильная маржа'], beverage_plant: ['low', 'Напитки пьют всегда'], winery: ['mid', 'Урожай винограда решает'],
  confectionery: ['mid', 'Капризные цены на какао'], cannery: ['low', 'Долгое хранение — стабильно'],
  textile_factory: ['mid', 'Нужен дешёвый труд'], consumer_factory: ['mid', 'Широкий выбор продукции'],
  rubber_plant: ['mid', 'Зависит от каучука и авторынка'], jewelry_factory: ['high', 'Маржа зависит от цены золота'],
  electrical_plant: ['mid', 'Дефицит лития и никеля'], chip_fab: ['high', 'Гигантские вложения, огромная маржа'],
  machine_plant: ['high', 'Длинные цепочки, огромная добавленная стоимость'],
  clothing_store: ['mid', 'Мода и сезоны'], home_store: ['mid', 'Крупные редкие покупки'], diy_store: ['mid', 'Растёт со стройкой'],
  kids_store: ['low', 'Пик перед Новым годом'], sports_store: ['mid', 'Сезонные велосипеды'], jewelry_store: ['high', 'Дорогие покупки: в кризис проседают'],
  bar: ['mid', 'Вечерами и в выходные'],
};
export const RISK_NAMES = { low: '🟢 низкий риск', mid: '🟡 средний риск', high: '🔴 высокий риск' };

// Оборудование (уровень бизнеса 1..3): класс задаёт мощность и качество (k — «звёзды» того, что можно сделать на нём)
export const EQUIPMENT = [
  { name: 'Стандартное', k: 3.0 },
  { name: 'Профессиональное', k: 3.8 },
  { name: 'Премиальное', k: 4.6 },
];
// Квалификация персонала — по уровню зарплаты (staff.js WAGE_LEVELS): дороже люди — выше качество
export const STAFF_CLASSES = { 0.8: { name: 'Стажёры', k: 2.2 }, 1: { name: 'Опытные', k: 3.0 }, 1.2: { name: 'Профессионалы', k: 3.7 }, 1.5: { name: 'Мастера', k: 4.4 } };

// Улучшения оборудования: уровень 1..3.
export const MAX_LEVEL = 3;
export const UPGRADE_COST_FACTOR = 0.5; // × capex × текущий уровень
export const QUALITY_PER_LEVEL = 0.4;
