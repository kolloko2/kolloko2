// Архетипы районов.
// traffic — пешеходов в день на участок; rent — $/м² в месяц при индексе города 1;
// demand — доля прохожих, готовых купить в категории за день; ai — типичное число фоновых конкурентов;
// priceSensitivity — насколько покупатели смотрят на цену (в престижном районе меньше, в студенческом больше).
export const DISTRICTS = {
  cbd: {
    name: 'Деловой центр', icon: '🏙️', color: '#3b6fd8', zoning: 'commercial', priceSensitivity: 2.2,
    traffic: [1800, 3400], rent: 110, lots: [4, 6],
    demand: { coffee: 0.10, fastfood: 0.06, grocery: 0.04, bakery: 0.04, restaurant: 0.05, fuel: 0.03, electronics: 0.004 },
    ai: { coffee: 4, fastfood: 3, grocery: 1, bakery: 1, restaurant: 4, fuel: 1, electronics: 1 },
  },
  historic: {
    name: 'Исторический центр', icon: '🏛️', color: '#a0522d', zoning: 'commercial', priceSensitivity: 2.1,
    traffic: [1600, 3000], rent: 90, lots: [3, 5],
    demand: { coffee: 0.09, fastfood: 0.05, grocery: 0.04, bakery: 0.06, restaurant: 0.07, fuel: 0.02, electronics: 0.0025 },
    ai: { coffee: 3, fastfood: 2, grocery: 1, bakery: 2, restaurant: 5, fuel: 1, electronics: 0 },
  },
  premium: {
    name: 'Престижный жилой', icon: '🏡', color: '#9b59b6', zoning: 'commercial', priceSensitivity: 1.4,
    traffic: [600, 1200], rent: 75, lots: [3, 4],
    demand: { coffee: 0.07, fastfood: 0.02, grocery: 0.10, bakery: 0.09, restaurant: 0.05, fuel: 0.05, electronics: 0.005 },
    ai: { coffee: 1, fastfood: 0, grocery: 1, bakery: 1, restaurant: 2, fuel: 1, electronics: 1 },
  },
  residential: {
    name: 'Спальный район', icon: '🏘️', color: '#27ae60', zoning: 'commercial', priceSensitivity: 2.8,
    traffic: [900, 1800], rent: 40, lots: [4, 6],
    demand: { coffee: 0.04, fastfood: 0.04, grocery: 0.12, bakery: 0.10, restaurant: 0.02, fuel: 0.06, electronics: 0.0025 },
    ai: { coffee: 1, fastfood: 2, grocery: 3, bakery: 2, restaurant: 1, fuel: 2, electronics: 1 },
  },
  student: {
    name: 'Студенческий квартал', icon: '🎓', color: '#e67e22', zoning: 'commercial', priceSensitivity: 3.3,
    traffic: [1400, 2600], rent: 50, lots: [3, 5],
    demand: { coffee: 0.09, fastfood: 0.10, grocery: 0.06, bakery: 0.04, restaurant: 0.03, fuel: 0.02, electronics: 0.005 },
    ai: { coffee: 2, fastfood: 3, grocery: 1, bakery: 1, restaurant: 2, fuel: 0, electronics: 1 },
  },
  mall: {
    name: 'Торговый кластер', icon: '🛍️', color: '#e84393', zoning: 'commercial', priceSensitivity: 2.5,
    traffic: [1800, 3200], rent: 85, lots: [3, 4],
    demand: { coffee: 0.06, fastfood: 0.08, grocery: 0.06, bakery: 0.03, restaurant: 0.05, fuel: 0.05, electronics: 0.008 },
    ai: { coffee: 2, fastfood: 3, grocery: 2, bakery: 1, restaurant: 3, fuel: 1, electronics: 2 },
  },
  industrial: {
    name: 'Промзона', icon: '🏭', color: '#7f8c8d', zoning: 'industrial', priceSensitivity: 2.5,
    traffic: [100, 300], rent: 9, lots: [3, 5],
    demand: {}, ai: {},
  },
  rural: {
    name: 'Сельхозугодья', icon: '🌾', color: '#b7950b', zoning: 'farmland', priceSensitivity: 2.5,
    traffic: [0, 0], rent: 0, lots: [4, 6],
    demand: {}, ai: {},
  },
};

export const ZONING_NAMES = {
  commercial: 'Коммерция',
  industrial: 'Промышленность',
  farmland: 'Сельхозземля',
};
