export {
  createGame, addCompany, companyUnits, activeCompanies, formatDate, monthLabel, dateOf, netWorth, coreWorth, loanLimit,
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
  presenceByCountry, presenceIn, hasLocalTeam, foreignFactor, entryFee, purchasingDiscount, LOCAL_TEAM_UNITS, isConsumer,
} from './expansion.js';
export { attention, efficiency, morale, wageLevel, managerCost, laborFactor, WAGE_LEVELS, BASE_ATTENTION } from './staff.js';
export { districtShares, districtPotential, refPrice } from './demand.js';
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
