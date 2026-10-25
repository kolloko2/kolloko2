// Лицензии: разовый платёж в каждой стране при открытии первого такого бизнеса.
// cost — при индексе цен 1, умножается на бюрократию страны.
export const LICENSES = {
  alcohol: { name: 'Лицензия на алкоголь', cost: 8000 },
  food: { name: 'Сертификат пищевого производства', cost: 15000 },
  fuel: { name: 'Лицензия на торговлю топливом', cost: 25000 },
  subsoil: { name: 'Лицензия на недропользование', cost: 120000 },
  eco: { name: 'Экологическое разрешение', cost: 40000 },
  bank: { name: 'Банковская лицензия', cost: 300000 },
};

// События в странах (раз в месяц). weight — относительная частота; нестабильные страны чаще получают плохие.
//   demand — множитель спроса на время; tax/tariff — изменение ставки навсегда
export const COUNTRY_EVENTS = [
  { id: 'recession', kind: 'bad', unstable: true, demand: 0.85, months: 6, text: (n) => `Рецессия в стране ${n}: люди экономят, спрос упал на 15%.` },
  { id: 'crisis', kind: 'bad', unstable: true, demand: 0.75, months: 4, onlyUnstable: true, text: (n) => `Валютный кризис в стране ${n}: спрос упал на четверть.` },
  { id: 'boom', kind: 'good', demand: 1.1, months: 6, text: (n) => `Экономический подъём в стране ${n}: спрос вырос на 10%.` },
  { id: 'tax_up', kind: 'warn', unstable: true, tax: 0.03, text: (n, c) => `В стране ${n} повысили налог на прибыль до ${Math.round(c.tax * 100)}%.` },
  { id: 'tax_down', kind: 'good', tax: -0.03, text: (n, c) => `В стране ${n} снизили налог на прибыль до ${Math.round(c.tax * 100)}%.` },
  { id: 'tariff_up', kind: 'warn', unstable: true, tariff: 0.05, text: (n, c) => `Страна ${n} подняла импортные пошлины до ${Math.round(c.tariff * 100)}%.` },
  { id: 'tariff_down', kind: 'good', tariff: -0.04, text: (n, c) => `Страна ${n} снизила импортные пошлины до ${Math.round(c.tariff * 100)}%.` },
];
