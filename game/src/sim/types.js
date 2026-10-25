// Типы состояния игры для проверки типов (npm run typecheck). Только JSDoc — во время игры этот файл пуст.

/**
 * @typedef {Object} Month Месячный отчёт бизнеса
 * @property {number} revenue
 * @property {number} revInternal
 * @property {number} cogs
 * @property {number} wages
 * @property {number} rent
 * @property {number} upkeep
 * @property {number} marketing
 * @property {number} transport
 * @property {number} [duty]
 * @property {number} spoilage
 * @property {number} other
 * @property {number} customers
 * @property {number} lost
 * @property {number} produced
 * @property {number} days
 * @property {number} [shippedInternal]
 */

/**
 * @typedef {Object} Stock Запас товара: количество и средняя себестоимость
 * @property {number} q
 * @property {number} c
 */

/**
 * @typedef {Object} Unit Бизнес на участке
 * @property {string} id
 * @property {string} companyId
 * @property {string} type ключ BUSINESSES
 * @property {string} name
 * @property {string} lotId
 * @property {string} placeId
 * @property {number} opened день открытия
 * @property {number} level
 * @property {number} staff
 * @property {Record<string, number>} prices
 * @property {number} marketing сумма рекламы по каналам, $/мес
 * @property {Record<string, number>} [ads] реклама по каналам
 * @property {number} awareness
 * @property {number} quality
 * @property {number} queue
 * @property {Record<string, Stock>} inv
 * @property {Record<string, Stock>} incoming
 * @property {Record<string, number>} usage
 * @property {Record<string, string>} supplied
 * @property {Record<string, string>} [sources]
 * @property {'auto'|'all'|'hold'} sellMode
 * @property {Month} month
 * @property {Month|null} last
 * @property {number[]} history
 * @property {Record<string, any>} today
 * @property {number} broken
 * @property {number} bookValue
 * @property {number} [condition]
 * @property {number} wageLevel
 * @property {number} morale
 * @property {boolean} manager
 * @property {boolean} autoStaff
 * @property {string|null} [brandId]
 * @property {number} [tierQuality]
 * @property {number} [tierUpkeep]
 * @property {number} [coverDays]
 * @property {number} [mood] настроение спроса на услугу (риск)
 * @property {number} [training] обучение персонала 0–3
 * @property {boolean} [star] звёздный сотрудник
 * @property {'none'|'aggregator'|'own'} [delivery] доставка еды
 */

/**
 * @typedef {Object} Director Региональный директор
 * @property {boolean} staff
 * @property {boolean} renovate
 * @property {boolean} prices
 * @property {number} priceRatio
 */

/**
 * @typedef {Object} Company
 * @property {string} id
 * @property {string} name
 * @property {string} color
 * @property {number} cash
 * @property {number} loan
 * @property {number} loanRate
 * @property {Record<string, number>} month
 * @property {Record<string, any>[]} history
 * @property {number} negativeDays
 * @property {boolean} bankrupt
 * @property {{ in: number, out: number }} totals
 * @property {string|null} homeCountry
 * @property {string[]} licenses
 * @property {number} payout
 * @property {Record<string, number>} [goals]
 * @property {Record<string, Director>} [directors]
 * @property {Record<string, number>} [tech]
 * @property {{ id: string, cost: number, days: number, progress: number }|null} [research]
 * @property {Record<string, number>} [lobbied]
 * @property {Record<string, number>} [truces]
 * @property {{ archetype: string, home: string }} [ai] есть у ИИ-корпораций
 * @property {string} [absorbedBy]
 * @property {Record<string, any>} [templates] шаблоны точек
 * @property {number} [nextTemplateId]
 * @property {{ reserve: number, autoRepay: boolean, closeAfter: number, autoRenovate: boolean }} [rules] автопилот
 */

/**
 * @typedef {Object} Lot Участок
 * @property {string} id
 * @property {string} districtId
 * @property {string} placeId
 * @property {number} lat
 * @property {number} lng
 * @property {'commercial'|'industrial'|'farmland'} zoning
 * @property {number} area
 * @property {number} traffic
 * @property {number} visibility
 * @property {number} rent
 * @property {number} price
 * @property {string|null} ownerId
 * @property {string|null} unitId
 */

/**
 * @typedef {Object} State Всё состояние партии (сериализуется в JSON)
 * @property {number} version
 * @property {number} seed
 * @property {'solo'|'coop'|'pvp'} mode
 * @property {any} victory
 * @property {any} winner
 * @property {{ s: number }} rng
 * @property {number} day
 * @property {{ places: Record<string, any>, districts: Record<string, any>, lots: Record<string, Lot> }} world
 * @property {{ goods: Record<string, any> }} market
 * @property {Record<string, Company>} companies
 * @property {number} nextCompanyId
 * @property {number} nextRivalId
 * @property {Record<string, Unit>} units
 * @property {number} nextUnitId
 * @property {any[]} shipments
 * @property {number} nextShipmentId
 * @property {any[]} contracts
 * @property {number} nextContractId
 * @property {Record<string, any>} brands
 * @property {number} nextBrandId
 * @property {Record<string, any>} countries
 * @property {{ listings: Record<string, any> }} stocks
 * @property {Record<string, Record<string, number>>} trends
 * @property {Record<string, { kind: string, mult: number, until: number }>} districtEvents
 * @property {any[]} offers
 * @property {number} nextOfferId
 * @property {Record<string, number>} [growth] рост городов от застройщиков
 * @property {any[]} news
 * @property {number} newsSeq
 * @property {number} mapVersion
 */

export {};
