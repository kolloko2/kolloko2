// Каналы рекламы точки. Бюджет — $ в месяц при индексе цен 1.
//   k — сила канала на доллар; cap — выше этой узнаваемости канал почти не помогает;
//   district / category — насколько канал подходит району и типу бизнеса (по умолчанию 1);
//   viral — ролик может «залететь» (или вызвать скандал).
// ТВ — это национальная реклама сети (вкладка «Сети»).
export const AD_CHANNELS = {
  flyers: {
    name: 'Листовки и промоутеры', icon: '📄', k: 0.0015, cap: 0.35,
    desc: 'Копейки, работает рядом с точкой. Узнаваемость выше 35% ими не поднять.',
    district: { residential: 1.3, student: 1.1, historic: 0.9, mall: 0.8, cbd: 0.7, premium: 0.6 },
    category: { grocery: 1.3, bakery: 1.3, fastfood: 1.1, restaurant: 0.8, fuel: 0.6, electronics: 0.7 },
  },
  social: {
    name: 'Соцсети и короткие видео', icon: '📱', k: 0.0006, cap: 0.75, viral: true,
    desc: 'Дёшево начать, молодая аудитория. Иногда ролик «залетает» — а иногда случается скандал.',
    district: { student: 1.5, cbd: 1.2, mall: 1.1, residential: 0.8, premium: 0.8 },
    category: { coffee: 1.3, fastfood: 1.3, electronics: 1.3, restaurant: 1.1, bakery: 0.9, grocery: 0.6, fuel: 0.5 },
  },
  radio: {
    name: 'Радио', icon: '📻', k: 0.00035, cap: 0.7,
    desc: 'Слушают водители и спальные районы.',
    district: { residential: 1.2, student: 0.7, premium: 0.9 },
    category: { fuel: 1.4, grocery: 1.2, coffee: 0.8, fastfood: 0.9, electronics: 0.9 },
  },
  billboard: {
    name: 'Билборды', icon: '🪧', k: 0.00035, cap: 0.85,
    desc: 'Видит весь город. Дорого, но стабильно. Свои рекламные щиты в городе дают это бесплатно.',
    district: { mall: 1.2, cbd: 1.1, student: 0.8 },
    category: { fuel: 1.5, restaurant: 1.2, grocery: 1.1, electronics: 1.1, bakery: 0.8 },
  },
};

// Новая точка: бюджет по умолчанию делится между дешёвыми каналами
export const DEFAULT_AD_SPLIT = { flyers: 0.4, social: 0.6 };

// Свои щиты дают каждой вашей точке в городе рекламу на столько $ в месяц (при индексе цен 1)
export const OWN_BILLBOARD_VALUE = 1500;
