// Товары мирового рынка.
// base — мировая цена ($ за единицу) на старте; depth — сколько единиц в день рынок «переваривает»
// без заметного влияния на цену; spoil — доля порчи запаса в день; weight — кг на единицу (для логистики);
// local — товар закупается у местных оптовиков, цена зависит от уровня цен в городе;
// freight — множитель тарифа перевозки (нефть и топливо идут по трубам и танкерами — дешевле).
export const GOODS = {
  coffee_green:   { name: 'Кофе-зерно (зелёное)', icon: '🫘', unit: 'кг', base: 3.0,  depth: 40000,  spoil: 0.0005, weight: 1 },
  coffee_roasted: { name: 'Кофе обжаренный',     icon: '☕', unit: 'кг', base: 7.2,  depth: 12000,  spoil: 0.002,  weight: 1 },
  milk:           { name: 'Молоко',              icon: '🥛', unit: 'л',  base: 0.70, depth: 300000, spoil: 0.12,   weight: 1.03 },
  wheat:          { name: 'Пшеница',             icon: '🌾', unit: 'кг', base: 0.16, depth: 2000000, spoil: 0.0003, weight: 1 },
  flour:          { name: 'Мука',                icon: '🥣', unit: 'кг', base: 0.37, depth: 400000, spoil: 0.001,  weight: 1 },
  sugar:          { name: 'Сахар',               icon: '🧂', unit: 'кг', base: 0.55, depth: 300000, spoil: 0.0002, weight: 1 },
  cups:           { name: 'Стаканы и упаковка',  icon: '🥤', unit: 'шт', base: 0.06, depth: 2000000, spoil: 0,     weight: 0.01 },
  pastry:         { name: 'Выпечка (опт)',       icon: '🥐', unit: 'шт', base: 0.45, depth: 150000, spoil: 0.25,   weight: 0.1 },
  meat:           { name: 'Мясо',                icon: '🥩', unit: 'кг', base: 4.8,  depth: 200000, spoil: 0.05,   weight: 1 },
  groceries:      { name: 'Товары для магазина', icon: '📦', unit: 'ед', base: 1.35,  depth: 1000000, spoil: 0.003, weight: 0.5, local: true },
  cheese:         { name: 'Сыр',                 icon: '🧀', unit: 'кг', base: 10.0, depth: 60000,  spoil: 0.004,  weight: 1 },
  cattle:         { name: 'Скот (живой вес)',    icon: '🐂', unit: 'кг', base: 1.6,  depth: 500000, spoil: 0.002,  weight: 1 },
  plastic:        { name: 'Пластик (гранулы)',   icon: '🧴', unit: 'кг', base: 1.0,  depth: 800000, spoil: 0,      weight: 1 },
  fuel:           { name: 'Топливо',             icon: '⛽', unit: 'л',  base: 0.50, depth: 5000000, spoil: 0,     weight: 0.85, freight: 0.5 },
  chips:          { name: 'Микросхемы',          icon: '🔌', unit: 'шт', base: 22.0, depth: 300000, spoil: 0,      weight: 0.05 },
  electronics:    { name: 'Электроника',         icon: '📱', unit: 'шт', base: 110,  depth: 40000,  spoil: 0.0005, weight: 3 },
  medicine:       { name: 'Лекарства',           icon: '💊', unit: 'уп', base: 5.0,  depth: 400000, spoil: 0.0005, weight: 0.1 },
  cosmetics:      { name: 'Косметика',           icon: '🧴', unit: 'шт', base: 4.0,  depth: 500000, spoil: 0.0005, weight: 0.2 },
  parts:          { name: 'Автозапчасти',        icon: '🔧', unit: 'шт', base: 30,   depth: 300000, spoil: 0,      weight: 3 },
  cars:           { name: 'Автомобили',          icon: '🚗', unit: 'шт', base: 20000, depth: 2000,  spoil: 0,      weight: 1400 },
  oil:            { name: 'Нефть',               icon: '🛢️', unit: 'л',  base: 0.27, depth: 8000000, spoil: 0,     weight: 0.86, freight: 0.2 },
  // --- добыча: шахты, рудники, карьеры, месторождения ---
  iron_ore:       { name: 'Железная руда',       icon: '🪨', unit: 'кг', base: 0.11, depth: 20000000, spoil: 0, weight: 1, freight: 0.35 },
  coal:           { name: 'Уголь',               icon: '⚫', unit: 'кг', base: 0.12, depth: 20000000, spoil: 0, weight: 1, freight: 0.35 },
  copper_ore:     { name: 'Медная руда',         icon: '🟤', unit: 'кг', base: 0.9,  depth: 3000000, spoil: 0, weight: 1, freight: 0.5 },
  bauxite:        { name: 'Бокситы',             icon: '🟫', unit: 'кг', base: 0.06, depth: 10000000, spoil: 0, weight: 1, freight: 0.35 },
  nickel_ore:     { name: 'Никелевая руда',      icon: '⚪', unit: 'кг', base: 1.6,  depth: 1000000, spoil: 0, weight: 1, freight: 0.5 },
  gold:           { name: 'Золото',              icon: '🥇', unit: 'г',  base: 62,   depth: 400000, spoil: 0, weight: 0.001 },
  silver:         { name: 'Серебро',             icon: '🥈', unit: 'г',  base: 0.8,  depth: 3000000, spoil: 0, weight: 0.001 },
  lithium:        { name: 'Литий (карбонат)',    icon: '🔋', unit: 'кг', base: 14,   depth: 200000, spoil: 0, weight: 1 },
  uranium:        { name: 'Уран',                icon: '☢️', unit: 'кг', base: 110,  depth: 30000, spoil: 0, weight: 1 },
  limestone:      { name: 'Известняк',           icon: '🪨', unit: 'кг', base: 0.02, depth: 30000000, spoil: 0, weight: 1, freight: 0.35 },
  sand:           { name: 'Кварцевый песок',     icon: '⏳', unit: 'кг', base: 0.03, depth: 30000000, spoil: 0, weight: 1, freight: 0.35 },
  clay:           { name: 'Глина',               icon: '🧱', unit: 'кг', base: 0.02, depth: 20000000, spoil: 0, weight: 1, freight: 0.35 },
  salt:           { name: 'Соль',                icon: '🧂', unit: 'кг', base: 0.08, depth: 5000000, spoil: 0, weight: 1, freight: 0.5 },
  phosphate:      { name: 'Фосфаты',             icon: '🪨', unit: 'кг', base: 0.13, depth: 5000000, spoil: 0, weight: 1, freight: 0.4 },
  potash:         { name: 'Калийная соль',       icon: '🪨', unit: 'кг', base: 0.3,  depth: 4000000, spoil: 0, weight: 1, freight: 0.4 },
  natural_gas:    { name: 'Природный газ',       icon: '🔥', unit: 'м³', base: 0.25, depth: 10000000, spoil: 0, weight: 0.75, freight: 0.25 },
  // --- поля, сады, леса, море ---
  corn:           { name: 'Кукуруза',            icon: '🌽', unit: 'кг', base: 0.19, depth: 2000000, spoil: 0.0004, weight: 1 },
  rice:           { name: 'Рис',                 icon: '🍚', unit: 'кг', base: 0.42, depth: 1500000, spoil: 0.0002, weight: 1 },
  soybeans:       { name: 'Соя',                 icon: '🫛', unit: 'кг', base: 0.45, depth: 1500000, spoil: 0.0003, weight: 1 },
  potatoes:       { name: 'Картофель',           icon: '🥔', unit: 'кг', base: 0.22, depth: 1000000, spoil: 0.004, weight: 1 },
  vegetables:     { name: 'Овощи',               icon: '🥕', unit: 'кг', base: 0.8,  depth: 800000, spoil: 0.03, weight: 1 },
  fruits:         { name: 'Фрукты',              icon: '🍎', unit: 'кг', base: 1.0,  depth: 800000, spoil: 0.02, weight: 1 },
  grapes:         { name: 'Виноград',            icon: '🍇', unit: 'кг', base: 0.9,  depth: 300000, spoil: 0.03, weight: 1 },
  cocoa:          { name: 'Какао-бобы',          icon: '🫘', unit: 'кг', base: 4.5,  depth: 100000, spoil: 0.0005, weight: 1 },
  tea_leaf:       { name: 'Чайный лист',         icon: '🍃', unit: 'кг', base: 2.8,  depth: 100000, spoil: 0.001, weight: 1 },
  cotton:         { name: 'Хлопок',              icon: '☁️', unit: 'кг', base: 1.8,  depth: 600000, spoil: 0, weight: 1 },
  rubber:         { name: 'Натуральный каучук',  icon: '🌳', unit: 'кг', base: 1.7,  depth: 400000, spoil: 0, weight: 1 },
  timber:         { name: 'Лес-кругляк',         icon: '🪵', unit: 'м³', base: 90,   depth: 60000, spoil: 0, weight: 650, freight: 0.6 },
  fish:           { name: 'Рыба',                icon: '🐟', unit: 'кг', base: 3.2,  depth: 300000, spoil: 0.08, weight: 1 },
  eggs:           { name: 'Яйца',                icon: '🥚', unit: 'шт', base: 0.16, depth: 3000000, spoil: 0.01, weight: 0.06 },
  chicken:        { name: 'Курица',              icon: '🍗', unit: 'кг', base: 2.6,  depth: 400000, spoil: 0.05, weight: 1 },
  barley:         { name: 'Ячмень',              icon: '🌾', unit: 'кг', base: 0.2,  depth: 1500000, spoil: 0.0003, weight: 1 },
  sugar_beet:     { name: 'Сахарная свёкла',     icon: '🟣', unit: 'кг', base: 0.05, depth: 3000000, spoil: 0.003, weight: 1 },
  // --- пища и напитки ---
  vegetable_oil:  { name: 'Растительное масло',  icon: '🫒', unit: 'л',  base: 1.6,  depth: 500000, spoil: 0.0005, weight: 0.92 },
  butter:         { name: 'Сливочное масло',     icon: '🧈', unit: 'кг', base: 6.5,  depth: 100000, spoil: 0.005, weight: 1 },
  sausages:       { name: 'Колбасы',             icon: '🌭', unit: 'кг', base: 6.0,  depth: 200000, spoil: 0.01, weight: 1 },
  canned_food:    { name: 'Консервы',            icon: '🥫', unit: 'шт', base: 1.3,  depth: 800000, spoil: 0.0002, weight: 0.4 },
  frozen_food:    { name: 'Замороженные продукты', icon: '🧊', unit: 'кг', base: 2.6, depth: 400000, spoil: 0.002, weight: 1 },
  chocolate:      { name: 'Шоколад',             icon: '🍫', unit: 'кг', base: 9.0,  depth: 150000, spoil: 0.0008, weight: 1 },
  tea:            { name: 'Чай (упаковка)',      icon: '🍵', unit: 'кг', base: 9.0,  depth: 80000, spoil: 0.0003, weight: 1 },
  juice:          { name: 'Сок',                 icon: '🧃', unit: 'л',  base: 2.0,  depth: 600000, spoil: 0.003, weight: 1.05 },
  beer:           { name: 'Пиво',                icon: '🍺', unit: 'л',  base: 1.0,  depth: 1500000, spoil: 0.002, weight: 1.1 },
  wine:           { name: 'Вино',                icon: '🍷', unit: 'л',  base: 4.5,  depth: 300000, spoil: 0, weight: 1.3 },
  soda:           { name: 'Газировка',           icon: '🥤', unit: 'л',  base: 0.5,  depth: 2000000, spoil: 0.0005, weight: 1.05 },
  water:          { name: 'Бутилированная вода', icon: '💧', unit: 'л',  base: 0.22, depth: 3000000, spoil: 0, weight: 1.03 },
  feed:           { name: 'Комбикорм',           icon: '🌰', unit: 'кг', base: 0.38,  depth: 2000000, spoil: 0.001, weight: 1 },
  pasta:          { name: 'Макароны',            icon: '🍝', unit: 'кг', base: 1.1,  depth: 500000, spoil: 0.0002, weight: 1 },
  ice_cream:      { name: 'Мороженое',           icon: '🍦', unit: 'кг', base: 4.0,  depth: 150000, spoil: 0.004, weight: 1 },
  // --- материалы и полуфабрикаты ---
  steel:          { name: 'Сталь',               icon: '🔩', unit: 'кг', base: 0.65, depth: 6000000, spoil: 0, weight: 1, freight: 0.6 },
  aluminum:       { name: 'Алюминий',            icon: '🥫', unit: 'кг', base: 2.4,  depth: 1500000, spoil: 0, weight: 1, freight: 0.7 },
  copper:         { name: 'Медь',                icon: '🟠', unit: 'кг', base: 9.0,  depth: 600000, spoil: 0, weight: 1 },
  nickel:         { name: 'Никель',              icon: '⚪', unit: 'кг', base: 17,   depth: 150000, spoil: 0, weight: 1 },
  cement:         { name: 'Цемент',              icon: '🏗️', unit: 'кг', base: 0.11, depth: 10000000, spoil: 0.0002, weight: 1, freight: 0.5 },
  bricks:         { name: 'Кирпич',              icon: '🧱', unit: 'шт', base: 0.35, depth: 5000000, spoil: 0, weight: 3, freight: 0.5 },
  glass:          { name: 'Стекло',              icon: '🪟', unit: 'кг', base: 0.9,  depth: 1500000, spoil: 0, weight: 1 },
  lumber:         { name: 'Пиломатериалы',       icon: '🪵', unit: 'м³', base: 260,  depth: 30000, spoil: 0, weight: 500, freight: 0.6 },
  paper:          { name: 'Бумага',              icon: '📄', unit: 'кг', base: 1.0,  depth: 1500000, spoil: 0, weight: 1 },
  cardboard:      { name: 'Картон',              icon: '📦', unit: 'кг', base: 0.7,  depth: 1500000, spoil: 0, weight: 1 },
  fabric:         { name: 'Ткань',               icon: '🧵', unit: 'м',  base: 3.0,  depth: 800000, spoil: 0, weight: 0.3 },
  fertilizer:     { name: 'Удобрения',           icon: '🧪', unit: 'кг', base: 0.55, depth: 4000000, spoil: 0, weight: 1, freight: 0.5 },
  chemicals:      { name: 'Химикаты',            icon: '⚗️', unit: 'кг', base: 0.8,  depth: 2000000, spoil: 0, weight: 1 },
  tires:          { name: 'Шины',                icon: '🛞', unit: 'шт', base: 60,   depth: 100000, spoil: 0, weight: 9 },
  paint:          { name: 'Краска',              icon: '🎨', unit: 'л',  base: 4.0,  depth: 400000, spoil: 0.0002, weight: 1.3 },
  cables:         { name: 'Кабель',              icon: '🔌', unit: 'м',  base: 1.6,  depth: 1500000, spoil: 0, weight: 0.15 },
  batteries:      { name: 'Аккумуляторы',        icon: '🔋', unit: 'шт', base: 90,   depth: 60000, spoil: 0, weight: 6 },
  solar_panels:   { name: 'Солнечные панели',    icon: '☀️', unit: 'шт', base: 140,  depth: 40000, spoil: 0, weight: 20 },
  jet_fuel:       { name: 'Авиатопливо',         icon: '✈️', unit: 'л',  base: 0.6,  depth: 3000000, spoil: 0, weight: 0.8, freight: 0.5 },
  // --- товары для людей ---
  clothing:       { name: 'Одежда',              icon: '👕', unit: 'шт', base: 9,    depth: 500000, spoil: 0, weight: 0.4 },
  shoes:          { name: 'Обувь',               icon: '👟', unit: 'пара', base: 18, depth: 250000, spoil: 0, weight: 1 },
  furniture:      { name: 'Мебель',              icon: '🛋️', unit: 'шт', base: 180,  depth: 30000, spoil: 0, weight: 40 },
  toys:           { name: 'Игрушки',             icon: '🧸', unit: 'шт', base: 6,    depth: 400000, spoil: 0, weight: 0.4 },
  books:          { name: 'Книги',               icon: '📚', unit: 'шт', base: 4,    depth: 300000, spoil: 0, weight: 0.5 },
  appliances:     { name: 'Бытовая техника',     icon: '🧺', unit: 'шт', base: 220,  depth: 30000, spoil: 0, weight: 35 },
  computers:      { name: 'Компьютеры',          icon: '💻', unit: 'шт', base: 450,  depth: 25000, spoil: 0.0005, weight: 4 },
  bicycles:       { name: 'Велосипеды',          icon: '🚲', unit: 'шт', base: 120,  depth: 20000, spoil: 0, weight: 14 },
  sports_goods:   { name: 'Спорттовары',         icon: '⚽', unit: 'шт', base: 14,   depth: 200000, spoil: 0, weight: 0.8 },
  detergents:     { name: 'Бытовая химия',       icon: '🧼', unit: 'шт', base: 2.2,  depth: 800000, spoil: 0, weight: 1 },
  jewelry:        { name: 'Ювелирные украшения', icon: '💍', unit: 'шт', base: 460,  depth: 8000, spoil: 0, weight: 0.02 },
  // --- машины и высокие технологии ---
  machinery:      { name: 'Станки и оборудование', icon: '⚙️', unit: 'шт', base: 9000, depth: 2000, spoil: 0, weight: 800 },
  trucks:         { name: 'Грузовики',           icon: '🚛', unit: 'шт', base: 52000, depth: 400, spoil: 0, weight: 7000 },
  medical_devices: { name: 'Медтехника',         icon: '🩺', unit: 'шт', base: 1500, depth: 8000, spoil: 0, weight: 20 },
  aircraft_parts: { name: 'Авиакомпоненты',      icon: '🛩️', unit: 'шт', base: 4000, depth: 3000, spoil: 0, weight: 30 },
  robots:         { name: 'Промышленные роботы', icon: '🤖', unit: 'шт', base: 30000, depth: 400, spoil: 0, weight: 300 },
};

// Спред: покупатель платит больше мировой цены, продавец получает меньше (посредники, фрахт).
export const MARKET_BUY_MARKUP = 0.07;
export const MARKET_SELL_DISCOUNT = 0.08;
// Перевозка между своими бизнесами: $ за кг·км + перевалка за кг.
export const TRANSPORT_PER_KG_KM = 0.00003;
export const TRANSPORT_HANDLING_PER_KG = 0.02;

// Класс товара (качество, «звёзды» 1–5). На рынке можно закупать любой класс — дороже или дешевле;
// своё производство выпускает тот класс, на который способны его оборудование, персонал и сырьё.
export const GRADES = {
  cheap: { name: 'Дешёвый', k: 1.8, price: 0.65 },
  std: { name: 'Стандарт', k: 3, price: 1 },
  premium: { name: 'Премиум', k: 4, price: 1.45 },
  elite: { name: 'Элитный', k: 4.8, price: 2.1 },
};
// Насколько класс влияет на цену: у сырья почти не влияет (руда — она и есть руда), у товаров для людей — сильно
const RAW_GOODS = new Set(['coffee_green', 'wheat', 'cattle', 'oil', 'iron_ore', 'coal', 'copper_ore', 'bauxite', 'nickel_ore', 'gold', 'silver',
  'lithium', 'uranium', 'limestone', 'sand', 'clay', 'salt', 'phosphate', 'potash', 'natural_gas', 'corn', 'rice', 'soybeans', 'potatoes',
  'barley', 'sugar_beet', 'cotton', 'rubber', 'timber', 'cocoa', 'tea_leaf', 'fuel', 'jet_fuel', 'steel', 'aluminum', 'copper', 'nickel', 'cement',
  'chemicals', 'fertilizer', 'plastic', 'flour', 'sugar', 'feed']);
for (const [id, g] of Object.entries(GOODS)) g.qualityWeight = RAW_GOODS.has(id) ? 0.25 : 1;

// Название класса по качеству
export function gradeName(k) {
  return k < 2.4 ? 'дешёвый' : k < 3.5 ? 'стандарт' : k < 4.4 ? 'премиум' : 'элитный';
}
