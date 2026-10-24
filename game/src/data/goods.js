// Товары мирового рынка.
// base — мировая цена ($ за единицу) на старте; depth — сколько единиц в день рынок «переваривает»
// без заметного влияния на цену; spoil — доля порчи запаса в день; weight — кг на единицу (для логистики);
// local — товар закупается у местных оптовиков, цена зависит от уровня цен в городе.
export const GOODS = {
  coffee_green:   { name: 'Кофе-зерно (зелёное)', icon: '🫘', unit: 'кг', base: 3.0,  depth: 40000,  spoil: 0.0005, weight: 1 },
  coffee_roasted: { name: 'Кофе обжаренный',     icon: '☕', unit: 'кг', base: 9.0,  depth: 12000,  spoil: 0.002,  weight: 1 },
  milk:           { name: 'Молоко',              icon: '🥛', unit: 'л',  base: 0.70, depth: 300000, spoil: 0.12,   weight: 1.03 },
  wheat:          { name: 'Пшеница',             icon: '🌾', unit: 'кг', base: 0.16, depth: 2000000, spoil: 0.0003, weight: 1 },
  flour:          { name: 'Мука',                icon: '🥣', unit: 'кг', base: 0.40, depth: 400000, spoil: 0.001,  weight: 1 },
  sugar:          { name: 'Сахар',               icon: '🧂', unit: 'кг', base: 0.55, depth: 300000, spoil: 0.0002, weight: 1 },
  cups:           { name: 'Стаканы и упаковка',  icon: '🥤', unit: 'шт', base: 0.07, depth: 2000000, spoil: 0,     weight: 0.01 },
  pastry:         { name: 'Выпечка (опт)',       icon: '🥐', unit: 'шт', base: 0.45, depth: 150000, spoil: 0.25,   weight: 0.1 },
  meat:           { name: 'Мясо',                icon: '🥩', unit: 'кг', base: 5.0,  depth: 200000, spoil: 0.05,   weight: 1 },
  groceries:      { name: 'Товары для магазина', icon: '📦', unit: 'ед', base: 1.5,  depth: 1000000, spoil: 0.003, weight: 0.5, local: true },
  cheese:         { name: 'Сыр',                 icon: '🧀', unit: 'кг', base: 11.0, depth: 60000,  spoil: 0.004,  weight: 1 },
  cattle:         { name: 'Скот (живой вес)',    icon: '🐂', unit: 'кг', base: 1.6,  depth: 500000, spoil: 0.002,  weight: 1 },
  plastic:        { name: 'Пластик (гранулы)',   icon: '🧴', unit: 'кг', base: 1.3,  depth: 800000, spoil: 0,      weight: 1 },
  fuel:           { name: 'Дизельное топливо',   icon: '⛽', unit: 'л',  base: 0.55, depth: 5000000, spoil: 0,     weight: 0.85 },
};

// Спред: покупатель платит больше мировой цены, продавец получает меньше (посредники, фрахт).
export const MARKET_BUY_MARKUP = 0.07;
export const MARKET_SELL_DISCOUNT = 0.08;
// Перевозка между своими бизнесами: $ за кг·км + перевалка за кг.
export const TRANSPORT_PER_KG_KM = 0.00003;
export const TRANSPORT_HANDLING_PER_KG = 0.02;
