// Страны. tax — налог на прибыль; tariff — пошлина на ввоз своих товаров из другой страны (внутри торгового блока — 0);
// bloc — торговый союз; bureaucracy — множитель стоимости лицензий и выхода на рынок;
// stability — 0..1: чем ниже, тем чаще кризисы и смена законов. Индексы городов — относительно США (= 1).
export const COUNTRIES = {
  RU: { name: 'Россия', tax: 0.20, tariff: 0.12, bloc: null, bureaucracy: 1.3, stability: 0.55 },
  DE: { name: 'Германия', tax: 0.30, tariff: 0.06, bloc: 'eu', bureaucracy: 1.15, stability: 0.9 },
  FR: { name: 'Франция', tax: 0.28, tariff: 0.06, bloc: 'eu', bureaucracy: 1.25, stability: 0.85 },
  GB: { name: 'Великобритания', tax: 0.25, tariff: 0.06, bloc: null, bureaucracy: 0.9, stability: 0.85 },
  ES: { name: 'Испания', tax: 0.25, tariff: 0.06, bloc: 'eu', bureaucracy: 1.1, stability: 0.8 },
  IT: { name: 'Италия', tax: 0.27, tariff: 0.06, bloc: 'eu', bureaucracy: 1.3, stability: 0.75 },
  NL: { name: 'Нидерланды', tax: 0.25, tariff: 0.06, bloc: 'eu', bureaucracy: 0.9, stability: 0.9 },
  TR: { name: 'Турция', tax: 0.22, tariff: 0.12, bloc: null, bureaucracy: 1.2, stability: 0.55 },
  AE: { name: 'ОАЭ', tax: 0.0, tariff: 0.05, bloc: null, bureaucracy: 0.7, stability: 0.85 },
  US: { name: 'США', tax: 0.25, tariff: 0.08, bloc: 'usmca', bureaucracy: 0.9, stability: 0.85 },
  CA: { name: 'Канада', tax: 0.26, tariff: 0.06, bloc: 'usmca', bureaucracy: 0.95, stability: 0.9 },
  MX: { name: 'Мексика', tax: 0.30, tariff: 0.10, bloc: 'usmca', bureaucracy: 1.25, stability: 0.6 },
  BR: { name: 'Бразилия', tax: 0.34, tariff: 0.14, bloc: 'mercosur', bureaucracy: 1.45, stability: 0.55 },
  CO: { name: 'Колумбия', tax: 0.33, tariff: 0.10, bloc: null, bureaucracy: 1.2, stability: 0.6 },
  AR: { name: 'Аргентина', tax: 0.35, tariff: 0.16, bloc: 'mercosur', bureaucracy: 1.4, stability: 0.4 },
  JP: { name: 'Япония', tax: 0.30, tariff: 0.07, bloc: null, bureaucracy: 1.1, stability: 0.9 },
  KR: { name: 'Южная Корея', tax: 0.24, tariff: 0.08, bloc: null, bureaucracy: 1.0, stability: 0.85 },
  CN: { name: 'Китай', tax: 0.25, tariff: 0.12, bloc: null, bureaucracy: 1.35, stability: 0.75 },
  SG: { name: 'Сингапур', tax: 0.17, tariff: 0.0, bloc: 'asean', bureaucracy: 0.6, stability: 0.95 },
  IN: { name: 'Индия', tax: 0.30, tariff: 0.18, bloc: null, bureaucracy: 1.45, stability: 0.65 },
  AU: { name: 'Австралия', tax: 0.30, tariff: 0.05, bloc: null, bureaucracy: 0.85, stability: 0.9 },
  EG: { name: 'Египет', tax: 0.22, tariff: 0.14, bloc: null, bureaucracy: 1.35, stability: 0.5 },
  NG: { name: 'Нигерия', tax: 0.30, tariff: 0.18, bloc: null, bureaucracy: 1.5, stability: 0.4 },
  ET: { name: 'Эфиопия', tax: 0.30, tariff: 0.15, bloc: null, bureaucracy: 1.4, stability: 0.45 },
  VN: { name: 'Вьетнам', tax: 0.20, tariff: 0.10, bloc: 'asean', bureaucracy: 1.2, stability: 0.75 },
  NZ: { name: 'Новая Зеландия', tax: 0.28, tariff: 0.05, bloc: null, bureaucracy: 0.75, stability: 0.92 },
};

export const BLOCS = {
  eu: 'Евросоюз',
  usmca: 'Северная Америка (USMCA)',
  mercosur: 'Меркосур',
  asean: 'АСЕАН',
};

// pop — млн жителей; income — покупательная способность; rent — уровень аренды; wage — уровень зарплат;
// tourism — поток туристов (отели); port — морской порт (можно построить порт)
export const CITIES = [
  { id: 'msk', name: 'Москва', country: 'RU', lat: 55.7558, lng: 37.6173, pop: 12.5, income: 0.45, rent: 0.50, wage: 0.35, tourism: 0.55 },
  { id: 'spb', name: 'Санкт-Петербург', country: 'RU', lat: 59.9343, lng: 30.3351, pop: 5.4, income: 0.38, rent: 0.38, wage: 0.30, tourism: 0.6, port: true },
  { id: 'ber', name: 'Берлин', country: 'DE', lat: 52.5200, lng: 13.4050, pop: 3.6, income: 0.85, rent: 0.70, wage: 0.85, tourism: 0.6 },
  { id: 'par', name: 'Париж', country: 'FR', lat: 48.8566, lng: 2.3522, pop: 11.0, income: 0.90, rent: 1.10, wage: 0.90, tourism: 1.0 },
  { id: 'lon', name: 'Лондон', country: 'GB', lat: 51.5074, lng: -0.1278, pop: 9.0, income: 0.95, rent: 1.30, wage: 0.95, tourism: 0.9, port: true },
  { id: 'mad', name: 'Мадрид', country: 'ES', lat: 40.4168, lng: -3.7038, pop: 6.6, income: 0.70, rent: 0.70, wage: 0.65, tourism: 0.7 },
  { id: 'rom', name: 'Рим', country: 'IT', lat: 41.9028, lng: 12.4964, pop: 4.3, income: 0.70, rent: 0.75, wage: 0.70, tourism: 1.0 },
  { id: 'ams', name: 'Амстердам', country: 'NL', lat: 52.3676, lng: 4.9041, pop: 1.1, income: 0.95, rent: 0.95, wage: 0.90, tourism: 0.8, port: true },
  { id: 'ist', name: 'Стамбул', country: 'TR', lat: 41.0082, lng: 28.9784, pop: 15.0, income: 0.35, rent: 0.35, wage: 0.30, tourism: 0.85, port: true },
  { id: 'dxb', name: 'Дубай', country: 'AE', lat: 25.2048, lng: 55.2708, pop: 3.3, income: 0.90, rent: 0.90, wage: 0.50, tourism: 0.95, port: true },
  { id: 'nyc', name: 'Нью-Йорк', country: 'US', lat: 40.7128, lng: -74.0060, pop: 8.4, income: 1.15, rent: 1.40, wage: 1.10, tourism: 0.9, port: true },
  { id: 'lax', name: 'Лос-Анджелес', country: 'US', lat: 34.0522, lng: -118.2437, pop: 4.0, income: 1.00, rent: 1.10, wage: 1.00, tourism: 0.75, port: true },
  { id: 'chi', name: 'Чикаго', country: 'US', lat: 41.8781, lng: -87.6298, pop: 2.7, income: 0.95, rent: 0.85, wage: 0.95, tourism: 0.5 },
  { id: 'tor', name: 'Торонто', country: 'CA', lat: 43.6532, lng: -79.3832, pop: 2.9, income: 0.90, rent: 0.90, wage: 0.90, tourism: 0.45 },
  { id: 'mex', name: 'Мехико', country: 'MX', lat: 19.4326, lng: -99.1332, pop: 9.2, income: 0.30, rent: 0.28, wage: 0.22, tourism: 0.6 },
  { id: 'sao', name: 'Сан-Паулу', country: 'BR', lat: -23.5505, lng: -46.6333, pop: 12.3, income: 0.30, rent: 0.30, wage: 0.25, tourism: 0.4, port: true },
  { id: 'bog', name: 'Богота', country: 'CO', lat: 4.7110, lng: -74.0721, pop: 7.4, income: 0.25, rent: 0.22, wage: 0.20, tourism: 0.35 },
  { id: 'bue', name: 'Буэнос-Айрес', country: 'AR', lat: -34.6037, lng: -58.3816, pop: 3.1, income: 0.35, rent: 0.30, wage: 0.30, tourism: 0.55, port: true },
  { id: 'tyo', name: 'Токио', country: 'JP', lat: 35.6762, lng: 139.6503, pop: 14.0, income: 1.00, rent: 1.20, wage: 0.95, tourism: 0.85, port: true },
  { id: 'sel', name: 'Сеул', country: 'KR', lat: 37.5665, lng: 126.9780, pop: 9.7, income: 0.80, rent: 0.90, wage: 0.75, tourism: 0.6, port: true },
  { id: 'sha', name: 'Шанхай', country: 'CN', lat: 31.2304, lng: 121.4737, pop: 24.0, income: 0.45, rent: 0.50, wage: 0.35, tourism: 0.6, port: true },
  { id: 'sin', name: 'Сингапур', country: 'SG', lat: 1.3521, lng: 103.8198, pop: 5.6, income: 1.10, rent: 1.20, wage: 1.00, tourism: 0.8, port: true },
  { id: 'bom', name: 'Мумбаи', country: 'IN', lat: 19.0760, lng: 72.8777, pop: 20.0, income: 0.15, rent: 0.30, wage: 0.10, tourism: 0.45, port: true },
  { id: 'syd', name: 'Сидней', country: 'AU', lat: -33.8688, lng: 151.2093, pop: 5.3, income: 0.95, rent: 1.10, wage: 1.00, tourism: 0.75, port: true },
  { id: 'cai', name: 'Каир', country: 'EG', lat: 30.0444, lng: 31.2357, pop: 10.0, income: 0.15, rent: 0.15, wage: 0.10, tourism: 0.65 },
  { id: 'los', name: 'Лагос', country: 'NG', lat: 6.5244, lng: 3.3792, pop: 15.0, income: 0.12, rent: 0.20, wage: 0.08, tourism: 0.2, port: true },
];

// Сельхозрегионы: здесь только сельхозугодья. productivity — множитель выработки (механизация, климат).
// landRent — $ за гектар в месяц.
export const REGIONS = [
  { id: 'r_minas', name: 'Минас-Жерайс', country: 'BR', lat: -21.55, lng: -45.43, kinds: ['coffee_plantation', 'dairy_farm', 'livestock_farm'], wage: 0.20, landRent: 6, productivity: 1.2 },
  { id: 'r_coltri', name: 'Кофейный треугольник', country: 'CO', lat: 4.53, lng: -75.68, kinds: ['coffee_plantation'], wage: 0.18, landRent: 5, productivity: 1.0 },
  { id: 'r_sidamo', name: 'Сидамо', country: 'ET', lat: 6.70, lng: 38.40, kinds: ['coffee_plantation'], wage: 0.06, landRent: 2, productivity: 0.7 },
  { id: 'r_daklak', name: 'Даклак', country: 'VN', lat: 12.67, lng: 108.05, kinds: ['coffee_plantation'], wage: 0.10, landRent: 3, productivity: 1.3 },
  { id: 'r_kansas', name: 'Канзас', country: 'US', lat: 38.50, lng: -98.00, kinds: ['wheat_farm', 'livestock_farm'], wage: 0.85, landRent: 14, productivity: 2.4 },
  { id: 'r_kuban', name: 'Кубань', country: 'RU', lat: 45.30, lng: 39.50, kinds: ['wheat_farm', 'dairy_farm', 'livestock_farm'], wage: 0.25, landRent: 5, productivity: 1.3 },
  { id: 'r_beauce', name: 'Бос', country: 'FR', lat: 48.30, lng: 1.50, kinds: ['wheat_farm'], wage: 0.80, landRent: 16, productivity: 2.1 },
  { id: 'r_pampas', name: 'Пампасы', country: 'AR', lat: -35.50, lng: -61.00, kinds: ['wheat_farm', 'dairy_farm', 'livestock_farm'], wage: 0.28, landRent: 6, productivity: 1.6 },
  { id: 'r_wisc', name: 'Висконсин', country: 'US', lat: 44.50, lng: -89.50, kinds: ['dairy_farm'], wage: 0.85, landRent: 12, productivity: 2.0 },
  { id: 'r_fries', name: 'Фрисландия', country: 'NL', lat: 53.10, lng: 5.80, kinds: ['dairy_farm'], wage: 0.85, landRent: 18, productivity: 2.2 },
  { id: 'r_wsib', name: 'Западная Сибирь', country: 'RU', lat: 61.10, lng: 73.20, kinds: ['oil_well'], wage: 0.45, landRent: 3, productivity: 1.0 },
  { id: 'r_permian', name: 'Пермский бассейн', country: 'US', lat: 31.90, lng: -102.30, kinds: ['oil_well'], wage: 0.95, landRent: 10, productivity: 1.3 },
  { id: 'r_alberta', name: 'Альберта', country: 'CA', lat: 56.90, lng: -111.40, kinds: ['oil_well'], wage: 0.95, landRent: 8, productivity: 0.85 },
  { id: 'r_abudhabi', name: 'Абу-Даби', country: 'AE', lat: 23.30, lng: 53.90, kinds: ['oil_well'], wage: 0.45, landRent: 4, productivity: 1.5 },
  { id: 'r_niger', name: 'Дельта Нигера', country: 'NG', lat: 5.10, lng: 6.40, kinds: ['oil_well'], wage: 0.10, landRent: 2, productivity: 0.9 },
  { id: 'r_waikato', name: 'Уаикато', country: 'NZ', lat: -37.80, lng: 175.30, kinds: ['dairy_farm'], wage: 0.75, landRent: 10, productivity: 2.3 },
];
