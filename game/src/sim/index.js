export {
  createGame, addCompany, companyUnits, activeCompanies, playerCompanies, formatDate, monthLabel, dateOf, netWorth, coreWorth, loanLimit, loanRate,
  addNews, newsFor, SAVE_VERSION, MODES, COMPANY_COLORS,
} from './state.js';
export { stepDay, stepDays, isOver } from './tick.js';
export { applyCommand, upgradeCost, COMMAND_TYPES } from './commands.js';
export { GOALS, goalContext, VICTORY_OPTIONS, victoryText } from './goals.js';
export { forecast, buildableTypes, canBuildHere } from './forecast.js';
export { buyPrice, sellPrice, midPrice, regionOf } from './market.js';
export { contractOffer, contractGoods, remainingValue, CONTRACT_MONTHS } from './contracts.js';
export { leadDays, inTransit } from './logistics.js';
export { isWarehouse, storageCapacity, storedKg, servedBy } from './supply.js';
export {
  BRAND_TIERS, brandOf, brandUnits, brandAwareness, effectiveAwareness, presenceTarget,
} from './brands.js';
export {
  presenceByCountry, presenceIn, hasLocalTeam, overhead, marginalOverhead, foreignFactor, entryFee, purchasingDiscount, LOCAL_TEAM_UNITS, isConsumer,
} from './expansion.js';
export { attention, efficiency, morale, wageLevel, managerCost, laborFactor, WAGE_LEVELS, BASE_ATTENTION } from './staff.js';
export { districtShares, districtPotential, refPrice, seasonFactor, aiUtility } from './demand.js';
export { distanceKm, costIndex, priceIndex } from './world.js';
export * from './units.js';
export {
  countryState, countryTax, countryDemand, tariffRate, sameBloc, licenseNeeded,
} from './countries.js';
export {
  franchiseCount, franchiseRevenue, franchiseAppeal, packageCost, cityCap, ROYALTIES, FRANCHISE_MIN_UNITS,
} from './franchise.js';
export {
  listingOf, portfolioValue, controllerOf, stakeOf, fairCompanyPrice, ipoCheck, absorbCost,
  IPO_MIN_WORTH, IPO_MIN_MONTHS, CONTROL_SHARE, ABSORB_SHARE, TRADE_FEE, COMPANY_SHARES,
} from './stocks.js';
export {
  companyAlerts, ALERT_KINDS, directorCost, DIRECTOR_WAGE, WORN,
} from './management.js';
export {
  ARCHETYPES, rivalUnitPrice, truceCost, isAi, TRUCE_MONTHS, offerText, bidForUnit, rivalWants,
} from './rivals.js';
export {
  techLevel, techCost, techLocked, researchSpeed, missingTech, lobbyCost, lobbyChance, employees, taxBreak,
  LOBBY_GOALS, LOBBY_COOLDOWN, BIG_EMPLOYER,
} from './research.js';
export { adsOf, channelFit, adGain } from './ads.js';
export { ownBillboards } from './bonuses.js';
export { trendOf, districtEventOf } from './luck.js';
export { advice } from './advisor.js';
