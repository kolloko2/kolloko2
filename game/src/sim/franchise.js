import { BUSINESSES } from '../data/businesses.js';
import { COUNTRIES, CITIES } from '../data/cities.js';
import { rand, chance } from './rng.js';
import { refPrice } from './demand.js';
import { costIndex } from './world.js';
import { countryDemand } from './countries.js';
import { brandAwareness, brandUnits } from './brands.js';
import { addNews } from './state.js';
import { earnCompany } from './units.js';

// Франшиза: местные предприниматели открывают точки под вашей маркой и платят роялти с выручки.
// Так можно зайти в страну без сбора за выход на рынок и без своей команды. Франчайзи тоже поднимают
// узнаваемость бренда — и вашим собственным точкам в этих городах.
export const FRANCHISE_MIN_UNITS = 3; // продавать франшизу можно, когда у сети есть 3 свои точки
export const ROYALTIES = [0.03, 0.05, 0.07, 0.09, 0.12];
export const FRANCHISE_PACKAGE = 8000; // упаковка франшизы для страны (юристы, стандарты), × индекс цен × бюрократия
export const FRANCHISE_FEE = 10000; // паушальный взнос нового франчайзи вам, × индекс цен

export function franchiseCount(brand) {
  return Object.values(brand.franchisees || {}).reduce((a, b) => a + b, 0);
}

export function packageCost(country) {
  const cities = CITIES.filter((c) => c.country === country);
  const idx = cities.reduce((s, c) => s + costIndex({ kind: 'city', rent: c.rent }), 0) / cities.length;
  return Math.round(FRANCHISE_PACKAGE * idx * COUNTRIES[country].bureaucracy);
}

// Типичная месячная выручка точки франчайзи в городе
export function franchiseRevenue(state, brand, place) {
  const def = BUSINESSES[brand.type];
  let check = 0;
  for (const p of def.retail.products.filter((x) => !x.opt)) check += p.attach * refPrice(place, p) * (brand.priceRatio[p.id] ?? 1);
  return check * def.retail.cap[0] * 0.5 * 30 * countryDemand(state, place.country);
}

export function cityCap(place) {
  return 1 + Math.floor(place.pop / 2.5);
}

// Привлекательность франшизы: узнаваемость бренда в стране и размер роялти
export function franchiseAppeal(state, brand, country) {
  let aware = 0;
  for (const c of CITIES) if (c.country === country) aware = Math.max(aware, brandAwareness(brand, c.id));
  const royaltyFactor = Math.min(1.5, Math.max(0.1, (0.13 - brand.royalty) / 0.07));
  return Math.min(0.7, (0.18 + 1.2 * aware) * royaltyFactor);
}

// Конец месяца: роялти, новые франчайзи и уход недовольных
export function monthlyFranchise(state) {
  for (const brand of Object.values(state.brands)) {
    if (!brand.franchise || !Object.keys(brand.franchise).length) continue;
    const co = state.companies[brand.companyId];
    if (!co || co.bankrupt) continue;
    brand.franchisees ||= {};
    const ownUnits = brandUnits(state, brand).length;
    // роялти
    let royalty = 0;
    for (const [pid, n] of Object.entries(brand.franchisees)) {
      royalty += n * franchiseRevenue(state, brand, state.world.places[pid]) * brand.royalty;
    }
    if (royalty > 0) earnCompany(state, brand.companyId, 'royalty', royalty);
    brand.lastRoyalty = Math.round(royalty);
    // уход: высокие роялти и кризис в стране
    for (const [pid, n] of Object.entries(brand.franchisees)) {
      const place = state.world.places[pid];
      const p = 0.015 + Math.max(0, brand.royalty - 0.07) * 0.6 + (countryDemand(state, place.country) < 1 ? 0.03 : 0);
      let left = 0;
      for (let i = 0; i < n; i++) if (chance(state.rng, p)) left++;
      if (left) {
        brand.franchisees[pid] = n - left;
        if (!brand.franchisees[pid]) delete brand.franchisees[pid];
        addNews(state, 'warn', `🏷️ Франчайзи «${brand.name}» в городе ${place.name} закрыл точку.`, null, brand.companyId);
      }
    }
    if (ownUnits < FRANCHISE_MIN_UNITS) continue; // пока у сети мало своих точек, новых франчайзи нет
    // новые франчайзи: по одному в месяц на страну, город — с вероятностью по числу жителей
    for (const country of Object.keys(brand.franchise)) {
      if (!chance(state.rng, franchiseAppeal(state, brand, country))) continue;
      const cities = CITIES.filter((c) => c.country === country && (brand.franchisees[c.id] || 0) < cityCap(c));
      if (!cities.length) continue;
      let r = rand(state.rng) * cities.reduce((s, c) => s + c.pop, 0);
      const city = cities.find((c) => (r -= c.pop) < 0) || cities[0];
      brand.franchisees[city.id] = (brand.franchisees[city.id] || 0) + 1;
      const fee = Math.round(FRANCHISE_FEE * costIndex(state.world.places[city.id]));
      earnCompany(state, brand.companyId, 'franchiseFees', fee);
      addNews(state, 'good', `🏷️ Новый франчайзи «${brand.name}» в городе ${city.name}: взнос $${fee.toLocaleString('ru-RU')}, роялти ${Math.round(brand.royalty * 100)}% с выручки.`, null, brand.companyId);
    }
  }
}
