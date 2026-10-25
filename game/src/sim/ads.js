import { BUSINESSES } from '../data/businesses.js';
import { AD_CHANNELS, DEFAULT_AD_SPLIT, OWN_BILLBOARD_VALUE } from '../data/ads.js';
import { costIndex } from './world.js';
import { marketingBoost, ownBillboards } from './bonuses.js';
import { techLevel } from './research.js';
import { addNews } from './state.js';
import { chance, rand } from './rng.js';

// Реклама точки по каналам. unit.ads = { канал: $ в месяц }, unit.marketing — их сумма (для отчёта).

export function defaultAds(type, idx) {
  const total = BUSINESSES[type].marketing * idx;
  const ads = {};
  for (const [ch, share] of Object.entries(DEFAULT_AD_SPLIT)) ads[ch] = Math.round(total * share);
  return ads;
}

export function adsOf(unit) {
  return unit.ads || { social: unit.marketing || 0 };
}

export function setAds(unit, ads) {
  unit.ads = {};
  for (const ch of Object.keys(AD_CHANNELS)) if (ads[ch] > 0) unit.ads[ch] = Math.round(ads[ch]);
  unit.marketing = Object.values(unit.ads).reduce((a, b) => a + b, 0);
}

// Насколько канал подходит этой точке (район и тип бизнеса)
export function channelFit(state, unit, ch) {
  const c = AD_CHANNELS[ch];
  const def = BUSINESSES[unit.type];
  const district = state.world.districts[state.world.lots[unit.lotId].districtId];
  return (c.district[district.type] ?? 1) * (c.category[def.category] ?? 1);
}

// Прирост узнаваемости за день от всех каналов
export function adGain(state, unit) {
  const place = state.world.places[unit.placeId];
  const idx = costIndex(place);
  const boost = marketingBoost(state, unit.companyId, place) * (1 + 0.15 * techLevel(state, unit.companyId, 'marketing'));
  const ads = adsOf(unit);
  const a = unit.awareness;
  let gain = 0;
  for (const [ch, c] of Object.entries(AD_CHANNELS)) {
    let budget = ads[ch] || 0;
    if (ch === 'billboard' && ownBillboards(state, unit.companyId, unit.placeId)) budget += OWN_BILLBOARD_VALUE * idx;
    if (!budget) continue;
    const perDay = (budget / 30 / idx) * boost * channelFit(state, unit, ch);
    gain += (1 - Math.exp(-c.k * perDay)) * Math.max(0, 1 - a / c.cap);
  }
  return gain;
}

// Раз в месяц: ролики в соцсетях иногда «залетают», иногда — скандал
export function monthlyViral(state) {
  for (const unit of Object.values(state.units)) {
    const social = adsOf(unit).social || 0;
    if (!social || !BUSINESSES[unit.type].retail) continue;
    const idx = costIndex(state.world.places[unit.placeId]);
    const power = Math.min(1.5, ((social / idx) * channelFit(state, unit, 'social')) / 500);
    if (chance(state.rng, 0.03 * power)) {
      const jump = 0.12 + 0.18 * rand(state.rng);
      unit.awareness = Math.min(0.95, unit.awareness + jump);
      addNews(state, 'good', `🔥 Ролик про «${unit.name}» набрал миллионы просмотров — к вам идут толпы!`, { unitId: unit.id }, unit.companyId);
    } else if (chance(state.rng, 0.004 * power)) {
      unit.awareness = Math.max(0.05, unit.awareness - 0.1);
      unit.quality = Math.max(1, unit.quality - 0.3);
      addNews(state, 'bad', `😬 Неудачный пост «${unit.name}» вызвал скандал в соцсетях. Часть клиентов отвернулась.`, { unitId: unit.id }, unit.companyId);
    }
  }
}
