// Региональные товарные рынки. Цена в регионе = мировая цена × региональный коэффициент.
// Коэффициенты отражают, где товар производят (дешевле) и где его приходится ввозить (дороже).
export const MARKET_REGIONS = {
  eu: { name: 'Европа', countries: ['DE', 'FR', 'GB', 'ES', 'IT', 'NL', 'TR'] },
  cis: { name: 'Россия и СНГ', countries: ['RU'] },
  na: { name: 'Северная Америка', countries: ['US', 'CA'] },
  la: { name: 'Латинская Америка', countries: ['MX', 'BR', 'CO', 'AR'] },
  asia: { name: 'Азия', countries: ['JP', 'KR', 'CN', 'SG', 'IN', 'VN'] },
  mea: { name: 'Ближний Восток и Африка', countries: ['AE', 'EG', 'NG', 'ET'] },
  oc: { name: 'Океания', countries: ['AU', 'NZ'] },
};

export const COUNTRY_REGION = Object.fromEntries(
  Object.entries(MARKET_REGIONS).flatMap(([r, def]) => def.countries.map((c) => [c, r])),
);

// Долгосрочный коэффициент цены товара в регионе (по умолчанию 1)
export const REGION_BIAS = {
  coffee_green: { la: 0.8, asia: 0.88, mea: 0.92, eu: 1.12, na: 1.1, cis: 1.15, oc: 1.08 },
  coffee_roasted: { la: 0.9, asia: 0.95, eu: 1.04, na: 1.02, cis: 1.1, oc: 1.05 },
  wheat: { cis: 0.82, na: 0.88, oc: 0.9, la: 0.92, eu: 0.96, asia: 1.12, mea: 1.18 },
  flour: { cis: 0.88, na: 0.92, la: 0.95, eu: 0.98, asia: 1.08, mea: 1.12 },
  milk: { oc: 0.82, eu: 0.95, na: 0.95, la: 0.92, cis: 0.97, asia: 1.15, mea: 1.2 },
  meat: { la: 0.85, oc: 0.88, na: 0.95, cis: 1.0, eu: 1.08, asia: 1.12, mea: 1.1 },
  sugar: { la: 0.82, asia: 0.95, cis: 1.05, eu: 1.08, na: 1.02, mea: 1.05 },
  cups: { asia: 0.88, na: 1.0, eu: 1.04, la: 1.06, mea: 1.08, cis: 1.05, oc: 1.1 },
  pastry: {},
  groceries: {},
  cheese: { eu: 0.92, oc: 0.9, na: 0.98, la: 1.05, asia: 1.2, mea: 1.15, cis: 1.05 },
  cattle: { la: 0.78, oc: 0.85, na: 0.9, cis: 0.95, eu: 1.1, asia: 1.15, mea: 1.1 },
  plastic: { asia: 0.9, mea: 0.88, na: 0.95, eu: 1.08, la: 1.05, cis: 1.0, oc: 1.12 },
  chips: { asia: 0.85, na: 1.0, eu: 1.08, la: 1.12, mea: 1.1, cis: 1.15, oc: 1.08 },
  electronics: { asia: 0.88, na: 1.0, eu: 1.05, la: 1.15, mea: 1.08, cis: 1.12, oc: 1.08 },
  oil: { mea: 0.8, cis: 0.85, na: 0.92, la: 0.95, eu: 1.1, asia: 1.1, oc: 1.08 },
  fuel: { mea: 0.7, cis: 0.8, na: 0.88, la: 0.95, asia: 1.05, eu: 1.2, oc: 1.1 },
};
