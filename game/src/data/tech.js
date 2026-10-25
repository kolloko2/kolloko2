// Дерево исследований (как в стратегиях: ветки, ряды, стрелки-зависимости).
// branch — ветка (колонка группы), row — ряд (чем ниже, тем дороже), col — место в ряду внутри ветки.
// stat — какой бонус копит технология: эффект = число изученных технологий с этим stat (techLevel).
// Без stat технология открывает бизнесы (requiresTech в data/businesses.js).
// cost — цена (с поправкой на мировую инфляцию), months — срок; платится по дням, пока идёт работа.
export const BRANCHES = {
  retail: { name: 'Торговля и сервис', icon: '🛍️', color: '#e67e22' },
  industry: { name: 'Производство', icon: '🏭', color: '#7f8c8d' },
  raw: { name: 'Сырьё и аграрка', icon: '⛏️', color: '#8d6e3f' },
  logistics: { name: 'Логистика и энергия', icon: '🚛', color: '#2e86c1' },
  hitech: { name: 'Высокие технологии', icon: '🔬', color: '#8e44ad' },
  corporate: { name: 'Управление и финансы', icon: '🏛️', color: '#27ae60' },
};

// Что даёт один уровень бонуса (сколько технологий с этим stat изучено)
export const STAT_EFFECTS = {
  pos: '+8% к скорости обслуживания во всех точках продаж',
  quality: '+0.15★ к рейтингу всех точек продаж',
  marketing: 'реклама на 15% эффективнее',
  loyalty: 'узнаваемость сетей растёт на 50% быстрее',
  ecommerce: '+10% заказов у точек с доставкой',
  automation: '+12% выработки на работника на производствах и фермах',
  durability: 'износ на 20% медленнее',
  lean: '−5% сырья на единицу продукции',
  agro: '+10% урожая ферм, садов и лесозаготовок',
  mining: '+10% добычи шахт, приисков, скважин и месторождений',
  logistics: '−12% к стоимости перевозок, −15% порчи в пути',
  cold: '−30% порчи в пути',
  energy: '−8% коммунальных и обслуживания',
  biotech: 'отзывы партий лекарств вдвое реже',
  ai: '+5% к обслуживанию и выработке везде',
  mgmt: '+2 точки к вниманию владельца',
  hr: '+5 к морали во всех точках',
  tax: 'налог на прибыль −2 п.п. во всех странах',
  pr: 'шанс успешного лоббирования +10%',
  holding: 'расходы штаба −15%',
};

const T = (branch, row, col, name, icon, cost, months, requires, extra) => ({ branch, row, col, name, icon, cost, months, requires, ...extra });

export const TECHS = {
  // ---------- торговля и сервис ----------
  pos: T('retail', 0, 0, 'Кассы и сервис', '💳', 150000, 6, [], { stat: 'pos' }),
  marketing: T('retail', 0, 2, 'Маркетинговая аналитика', '📊', 120000, 6, [], { stat: 'marketing' }),
  pos_2: T('retail', 1, 0, 'Электронная очередь', '🎫', 300000, 6, ['pos'], { stat: 'pos' }),
  quality: T('retail', 1, 1, 'Стандарты качества', '⭐', 200000, 9, ['pos'], { stat: 'quality' }),
  marketing_2: T('retail', 1, 2, 'Таргетированная реклама', '🎯', 240000, 6, ['marketing'], { stat: 'marketing' }),
  ecommerce: T('retail', 2, 0, 'Онлайн-заказы', '📲', 350000, 8, ['pos_2'], { stat: 'ecommerce' }),
  quality_2: T('retail', 2, 1, 'Сервис мирового класса', '🏅', 400000, 9, ['quality'], { stat: 'quality' }),
  loyalty: T('retail', 2, 2, 'Программа лояльности', '🎁', 400000, 8, ['marketing_2', 'quality'], { stat: 'loyalty' }),
  pos_3: T('retail', 3, 0, 'Кассы самообслуживания', '🛒', 600000, 8, ['pos_2'], { stat: 'pos' }),
  quality_3: T('retail', 3, 1, 'Мишленовские стандарты', '🍷', 800000, 10, ['quality_2'], { stat: 'quality' }),
  marketing_3: T('retail', 3, 2, 'Big Data маркетинг', '🧠', 480000, 8, ['marketing_2'], { stat: 'marketing' }),
  cloud: T('retail', 4, 0, 'Облачные технологии', '☁️', 1000000, 12, ['ecommerce'], { desc: 'Открывает облачный сервис (SaaS)' }),
  omnichannel: T('retail', 4, 2, 'Омниканальность', '🌐', 900000, 10, ['cloud', 'loyalty'], { stat: 'ecommerce' }),

  // ---------- производство ----------
  automation: T('industry', 0, 0, 'Автоматизация', '🤖', 250000, 8, [], { stat: 'automation' }),
  durability: T('industry', 0, 2, 'Долговечное оборудование', '🔩', 180000, 8, [], { stat: 'durability' }),
  light_industry: T('industry', 1, 0, 'Лёгкая промышленность', '🧵', 300000, 6, ['automation'], { desc: 'Открывает текстильные фабрики и фабрики потребтоваров' }),
  automation_2: T('industry', 1, 1, 'Конвейер', '⚙️', 500000, 8, ['automation'], { stat: 'automation' }),
  durability_2: T('industry', 1, 2, 'Предиктивный ремонт', '🛠️', 360000, 8, ['durability'], { stat: 'durability' }),
  metallurgy: T('industry', 2, 0, 'Металлургия', '🔥', 600000, 10, ['automation'], { desc: 'Открывает металлургические комбинаты и заводы цветных металлов' }),
  lean: T('industry', 2, 1, 'Бережливое производство', '📉', 600000, 9, ['automation_2'], { stat: 'lean' }),
  electrical: T('industry', 3, 0, 'Электротехника', '🔌', 700000, 10, ['metallurgy'], { desc: 'Открывает электротехнические заводы: кабель, техника, батареи, солнечные панели' }),
  automation_3: T('industry', 3, 1, 'Промышленные роботы', '🦾', 1000000, 10, ['automation_2'], { stat: 'automation' }),
  lean_2: T('industry', 3, 2, 'Шесть сигм', '📐', 1200000, 10, ['lean'], { stat: 'lean' }),
  machine_building: T('industry', 4, 0, 'Машиностроение', '🏗️', 1500000, 14, ['electrical', 'automation_2'], { desc: 'Открывает машиностроительные заводы: станки, грузовики, медтехника, авиакомпоненты, роботы' }),
  robotics: T('industry', 5, 1, 'Полная роботизация', '🏭', 2500000, 14, ['machine_building', 'automation_3'], { stat: 'automation' }),

  // ---------- сырьё и аграрка ----------
  agronomy: T('raw', 0, 0, 'Агрономия', '🌱', 200000, 8, [], { stat: 'agro' }),
  geology: T('raw', 0, 1, 'Геологоразведка', '🧭', 300000, 8, [], { stat: 'mining' }),
  fertilization: T('raw', 1, 0, 'Агрохимия', '🧪', 400000, 9, ['agronomy'], { stat: 'agro' }),
  geology_2: T('raw', 1, 1, 'Глубокое бурение', '⛏️', 600000, 10, ['geology'], { stat: 'mining' }),
  agro_2: T('raw', 2, 0, 'Точное земледелие', '🛰️', 800000, 10, ['fertilization'], { stat: 'agro' }),
  geology_3: T('raw', 2, 1, 'Обогащение руды', '⚗️', 1000000, 12, ['geology_2'], { stat: 'mining' }),
  gmo: T('raw', 3, 0, 'Селекция и ГМО', '🧬', 1500000, 12, ['agro_2', 'biotech'], { stat: 'agro' }),
  shale: T('raw', 3, 1, 'Сланцевая революция', '🛢️', 2000000, 14, ['geology_3'], { stat: 'mining' }),

  // ---------- логистика и энергия ----------
  logistics: T('logistics', 0, 0, 'Логистика', '🚛', 120000, 6, [], { stat: 'logistics' }),
  energy: T('logistics', 0, 1, 'Энергоэффективность', '💡', 150000, 6, [], { stat: 'energy' }),
  logistics_2: T('logistics', 1, 0, 'Контейнеризация', '📦', 240000, 6, ['logistics'], { stat: 'logistics' }),
  energy_2: T('logistics', 1, 1, 'Умные здания', '🏢', 300000, 6, ['energy'], { stat: 'energy' }),
  cold_chain: T('logistics', 2, 0, 'Холодовая цепь', '🧊', 350000, 8, ['logistics_2'], { stat: 'cold' }),
  green_energy: T('logistics', 2, 1, 'Зелёная энергетика', '☀️', 600000, 10, ['energy_2'], { stat: 'energy' }),
  logistics_3: T('logistics', 3, 0, 'Беспилотные грузовики', '🛻', 800000, 10, ['logistics_2', 'ai'], { stat: 'logistics' }),
  smart_grid: T('logistics', 3, 1, 'Умные энергосети', '⚡', 1200000, 12, ['green_energy'], { stat: 'energy' }),

  // ---------- высокие технологии ----------
  electronics: T('hitech', 1, 0, 'Электроника', '📱', 1200000, 14, ['automation'], { desc: 'Открывает заводы электроники, магазины техники и автозавод' }),
  pharma: T('hitech', 1, 1, 'Фармацевтика', '💊', 1500000, 18, ['quality'], { desc: 'Открывает фармацевтический завод' }),
  semiconductors: T('hitech', 2, 0, 'Полупроводники', '🔬', 3000000, 18, ['electronics', 'electrical'], { desc: 'Открывает фабрики микросхем' }),
  biotech: T('hitech', 2, 1, 'Биотехнологии', '🧫', 1200000, 12, ['pharma'], { stat: 'biotech' }),
  ai: T('hitech', 3, 0, 'Искусственный интеллект', '🧠', 4000000, 18, ['semiconductors', 'cloud'], { stat: 'ai' }),

  // ---------- управление и финансы ----------
  management: T('corporate', 0, 0, 'Школа менеджеров', '👔', 200000, 6, [], { stat: 'mgmt' }),
  hr: T('corporate', 0, 1, 'HR-бренд', '🤝', 300000, 6, [], { stat: 'hr' }),
  banking: T('corporate', 1, 0, 'Финансовые технологии', '🏦', 800000, 12, ['management'], { desc: 'Открывает банки' }),
  management_2: T('corporate', 1, 1, 'Корпоративная культура', '🏛️', 400000, 8, ['management'], { stat: 'mgmt' }),
  hr_2: T('corporate', 1, 2, 'Корпоративный университет', '🎓', 500000, 8, ['hr'], { stat: 'hr' }),
  tax_planning: T('corporate', 2, 0, 'Налоговое планирование', '🧾', 800000, 10, ['banking'], { stat: 'tax' }),
  pr: T('corporate', 2, 1, 'GR и связи с властью', '📰', 500000, 8, ['management_2'], { stat: 'pr' }),
  holding: T('corporate', 3, 0, 'Холдинговая структура', '🗂️', 1500000, 12, ['tax_planning', 'management_2'], { stat: 'holding' }),
};

for (const t of Object.values(TECHS)) t.desc ||= STAT_EFFECTS[t.stat];

// Технологии каждого бонуса (для подсчёта уровня)
export const STAT_TECHS = {};
for (const [id, t] of Object.entries(TECHS)) if (t.stat) (STAT_TECHS[t.stat] ||= []).push(id);

// Старые сохранения: уровни технологий (pos: 2) превращаются в изученные узлы дерева (pos, pos_2)
export const LEGACY_LEVELS = {
  pos: ['pos', 'pos_2', 'pos_3'], quality: ['quality', 'quality_2', 'quality_3'], marketing: ['marketing', 'marketing_2', 'marketing_3'],
  automation: ['automation', 'automation_2', 'automation_3'], logistics: ['logistics', 'logistics_2', 'logistics_3'],
  energy: ['energy', 'energy_2', 'green_energy'], durability: ['durability', 'durability_2'],
};
