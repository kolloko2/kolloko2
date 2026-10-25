// Архетипы районов.
// traffic — пешеходов в день на участок; rent — $/м² в месяц при индексе города 1;
// demand — доля прохожих, готовых купить в категории за день; ai — типичное число фоновых конкурентов;
// priceSensitivity — насколько покупатели смотрят на цену (в престижном районе меньше, в студенческом больше).
export const DISTRICTS = {
  cbd: {
    name: 'Деловой центр', icon: '🏙️', color: '#3b6fd8', zoning: 'commercial', segments: { eco: 0.2, mid: 0.55, premium: 0.25 }, priceSensitivity: 2.2,
    traffic: [1800, 3400], rent: 110, lots: [12, 18],
    demand: { coffee: 0.10, fastfood: 0.06, grocery: 0.04, bakery: 0.04, restaurant: 0.05, fuel: 0.03, electronics: 0.004, hotel: 0.028, fitness: 0.09, beauty: 0.015, pharmacy: 0.03 , clothing: 0.02, home: 0.0006, diy: 0.003, kids: 0.015, sports: 0.008, luxury: 0.0009, bar: 0.05},
    ai: { coffee: 4, fastfood: 3, grocery: 1, bakery: 1, restaurant: 4, fuel: 1, electronics: 1, hotel: 2, fitness: 1, beauty: 1, pharmacy: 1 , clothing: 2, home: 0, diy: 0, kids: 1, sports: 1, luxury: 1, bar: 3},
  },
  historic: {
    name: 'Исторический центр', icon: '🏛️', color: '#a0522d', zoning: 'commercial', segments: { eco: 0.25, mid: 0.5, premium: 0.25 }, priceSensitivity: 2.1,
    traffic: [1600, 3000], rent: 90, lots: [10, 15],
    demand: { coffee: 0.09, fastfood: 0.05, grocery: 0.04, bakery: 0.06, restaurant: 0.07, fuel: 0.02, electronics: 0.0025, hotel: 0.042, fitness: 0.036, beauty: 0.015, pharmacy: 0.03 , clothing: 0.02, home: 0.0006, diy: 0.003, kids: 0.025, sports: 0.006, luxury: 0.0012, bar: 0.07},
    ai: { coffee: 3, fastfood: 2, grocery: 1, bakery: 2, restaurant: 5, fuel: 1, electronics: 0, hotel: 3, beauty: 1, pharmacy: 1 , clothing: 2, home: 0, diy: 0, kids: 1, sports: 1, luxury: 1, bar: 4},
  },
  premium: {
    name: 'Престижный жилой', icon: '🏡', color: '#9b59b6', zoning: 'commercial', segments: { eco: 0.1, mid: 0.4, premium: 0.5 }, priceSensitivity: 1.4,
    traffic: [600, 1200], rent: 75, lots: [8, 12],
    demand: { coffee: 0.07, fastfood: 0.02, grocery: 0.10, bakery: 0.09, restaurant: 0.05, fuel: 0.05, electronics: 0.005, hotel: 0.014, fitness: 0.144, beauty: 0.03, pharmacy: 0.05, cars: 0.0003, autoservice: 0.008 , clothing: 0.025, home: 0.00225, diy: 0.012, kids: 0.0375, sports: 0.012, luxury: 0.0018, bar: 0.03},
    ai: { coffee: 1, fastfood: 0, grocery: 1, bakery: 1, restaurant: 2, fuel: 1, electronics: 1, hotel: 1, fitness: 1, beauty: 2, pharmacy: 1, cars: 1, autoservice: 1 , clothing: 1, home: 1, diy: 1, kids: 1, sports: 1, luxury: 1, bar: 1},
  },
  residential: {
    name: 'Спальный район', icon: '🏘️', color: '#27ae60', zoning: 'commercial', segments: { eco: 0.4, mid: 0.5, premium: 0.1 }, priceSensitivity: 2.8,
    traffic: [900, 1800], rent: 40, lots: [12, 18],
    demand: { coffee: 0.04, fastfood: 0.04, grocery: 0.12, bakery: 0.10, restaurant: 0.02, fuel: 0.06, electronics: 0.0025, fitness: 0.108, beauty: 0.02, pharmacy: 0.06, cars: 0.00018, autoservice: 0.012 , clothing: 0.015, home: 0.00225, diy: 0.015, kids: 0.0375, sports: 0.008, luxury: 0.0003, bar: 0.025},
    ai: { coffee: 1, fastfood: 2, grocery: 3, bakery: 2, restaurant: 1, fuel: 2, electronics: 1, fitness: 1, beauty: 2, pharmacy: 2, autoservice: 1 , clothing: 1, home: 1, diy: 1, kids: 1, sports: 1, bar: 2},
  },
  student: {
    name: 'Студенческий квартал', icon: '🎓', color: '#e67e22', zoning: 'commercial', segments: { eco: 0.6, mid: 0.35, premium: 0.05 }, priceSensitivity: 3.3,
    traffic: [1400, 2600], rent: 50, lots: [10, 15],
    demand: { coffee: 0.09, fastfood: 0.10, grocery: 0.06, bakery: 0.04, restaurant: 0.03, fuel: 0.02, electronics: 0.005, fitness: 0.108, beauty: 0.01, pharmacy: 0.03, autoservice: 0.004 , clothing: 0.03, home: 0.0009, diy: 0.0045, kids: 0.015, sports: 0.015, luxury: 0.00015, bar: 0.08},
    ai: { coffee: 2, fastfood: 3, grocery: 1, bakery: 1, restaurant: 2, fuel: 0, electronics: 1, fitness: 1, beauty: 1, pharmacy: 1 , clothing: 2, home: 0, diy: 0, kids: 0, sports: 1, bar: 4},
  },
  mall: {
    name: 'Торговый кластер', icon: '🛍️', color: '#e84393', zoning: 'commercial', segments: { eco: 0.3, mid: 0.5, premium: 0.2 }, priceSensitivity: 2.5,
    traffic: [1800, 3200], rent: 85, lots: [10, 14],
    demand: { coffee: 0.06, fastfood: 0.08, grocery: 0.06, bakery: 0.03, restaurant: 0.05, fuel: 0.05, electronics: 0.008, hotel: 0.014, fitness: 0.072, beauty: 0.02, pharmacy: 0.04, cars: 0.00036, autoservice: 0.008 , clothing: 0.04, home: 0.0027, diy: 0.009, kids: 0.05, sports: 0.014, luxury: 0.0015, bar: 0.03},
    ai: { coffee: 2, fastfood: 3, grocery: 2, bakery: 1, restaurant: 3, fuel: 1, electronics: 2, hotel: 1, fitness: 1, beauty: 1, pharmacy: 1, cars: 1, autoservice: 1 , clothing: 4, home: 1, diy: 1, kids: 2, sports: 2, luxury: 1, bar: 2},
  },
  industrial: {
    name: 'Промзона', icon: '🏭', color: '#7f8c8d', zoning: 'industrial', segments: { eco: 0.5, mid: 0.45, premium: 0.05 }, priceSensitivity: 2.5,
    traffic: [100, 300], rent: 9, lots: [8, 12],
    demand: {}, ai: {},
  },
  rural: {
    name: 'Сельхозугодья', icon: '🌾', color: '#b7950b', zoning: 'farmland', segments: { eco: 0.5, mid: 0.45, premium: 0.05 }, priceSensitivity: 2.5,
    traffic: [0, 0], rent: 0, lots: [8, 12],
    demand: {}, ai: {},
  },
};

export const ZONING_NAMES = {
  commercial: 'Коммерция',
  industrial: 'Промышленность',
  farmland: 'Сельхозземля',
};

// Сегменты покупателей: эконом считает деньги, премиум ценит качество. Доли — у районов (segments).
// p — множитель чувствительности к цене, q — к качеству
export const SEGMENTS = {
  eco: { name: 'Эконом', p: 1.45, q: 0.55 },
  mid: { name: 'Средний класс', p: 1, q: 1 },
  premium: { name: 'Премиум', p: 0.55, q: 1.7 },
};
