// Rendering of every screen. Reads the game state; records tappable rects in ui.hits. No state changes here except scroll clamping.
import { PAL, UI, DISPLAY, txt, wrap, button, panel, rrect, icon, chip, bar } from './ui.js';
import { ui, renderDoc, docMetrics } from './docview.js';
import { TEXT_SCALES, host, inRect } from './layout.js';
import { drawCredit, drawLockup, brandGradient } from './brand.js';
import { paintScene, drawMap, miniCity, mapPoints } from './scenes.js';
import { portrait, camel, walker } from './figures.js';
import { drawGood } from './icons.js';
import { skyline } from './skyline.js';
import { CITIES, GOODS, LEGS, PACES, PEOPLE, LIMIT_DAYS, CAMEL_LOADS, PRICES, MAX, UNITS_PER_LOAD, GOOD_IDX, oddsWord } from './data.js';
import * as E from './engine.js';
import { EVENT_BY_ID } from './events.js';

const TAU = Math.PI * 2;
const money = (n) => Math.round(n).toLocaleString('en-US');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ODDS_COL = { Safe: '#86d493', Likely: '#b6d86a', Even: '#f2c04c', Risky: '#f09a4c', 'Long shot': '#ff7d6a' };
const FIG = { city: (ctx, box, id, dim, t) => miniCity(ctx, box, id, dim, t) };

// ---- shared pieces -----------------------------------------------------------------------------------------------------------------------------------------
export function sceneSpec(st) {
  const S = st.S, C = S ? CITIES[S.city] : CITIES[0];
  const ph = st.ph;
  if (ph === 'travel' && S?.trip) {
    const tr = S.trip, dirScreen = S.trip.to > S.trip.from ? -1 : 1, leg = S.trip.leg;
    const frac = tr.day / tr.days, time = frac < 0.12 ? 'dawn' : frac > 0.8 ? 'dusk' : 'day';
    return { biome: tr.biome, time: (tr.pace === 'quick' && frac > 0.7) ? 'dusk' : time, scroll: st.tv.scroll * -dirScreen * -1, seed: 3 + leg * 7, caravan: { n: Math.min(6, S.camels), dir: dirScreen, kind: tr.from >= 6 || tr.to >= 6 ? (Math.max(tr.from, tr.to) >= 7 ? 'dromedary' : 'bactrian') : 'bactrian', loads: loadsOf(S) }, props: [] };
  }
  if (ph === 'event' || ph === 'outcome') {
    const ev = st.ev ? EVENT_BY_ID[st.ev.id] : null, tr = S?.trip;
    if (ev && tr) return { biome: tr.biome, time: ev.art.time, scroll: 140 * tr.leg + 60, seed: 3 + tr.leg * 7, caravan: ev.art.props.includes('sick') || ev.art.props.includes('stars') || ev.art.props.includes('wolves') || ev.art.props.includes('cairn') || ev.art.props.includes('riders') || ev.art.props.includes('snow') || ev.art.props.includes('storm') || ev.art.props.includes('mirage') ? { n: Math.min(5, S.camels), dir: S.trip.to > S.trip.from ? -1 : 1, still: true, x: ev.art.props.includes('sick') ? 0.3 : 0.45, loads: loadsOf(S), kind: Math.max(tr.from, tr.to) >= 7 ? 'dromedary' : 'bactrian' } : { n: Math.min(4, S.camels), dir: S.trip.to > S.trip.from ? -1 : 1, still: true, x: 0.62, loads: loadsOf(S), kind: Math.max(tr.from, tr.to) >= 7 ? 'dromedary' : 'bactrian' }, props: ev.art.props, kind: Math.max(tr.from, tr.to) >= 7 ? 'dromedary' : 'bactrian' };
  }
  return { biome: C.biome, time: C.sky, city: C.skyline, scroll: 0, seed: 3 + C.id, caravan: { n: Math.min(5, S?.camels ?? 4), dir: S?.dir > 0 ? -1 : 1, still: true, x: 0.5, loads: loadsOf(S), kind: C.camel }, props: [], cityScale: 1 };
}
function loadsOf(S) {
  if (!S) return [['silk'], ['spice']];
  const have = GOODS.filter((g) => S.goods[g.id] > 0).map((g) => g.id);
  if (!have.length) return [[]];
  return Array.from({ length: Math.max(1, Math.min(S.camels, 6)) }, (_, i) => [have[i % have.length], have[(i + 1) % have.length]]);
}

function hud(ctx, st, L, G, o = {}) {
  const S = st.S; if (!S) return;
  const y = G.hudY + 22, x0 = G.hudX0, x1 = G.hudX1;
  const fs = 26;
  let cx = x0;
  const nbtn = (o.buttons ?? [1, 2, 3]).length, bsz = Math.max(64, L.mb), room = x1 - x0 - nbtn * (bsz + 8);
  ctx.font = `700 ${fs}px ${UI}`; const full = `Day ${S.day} of ${LIMIT_DAYS}`, need = ctx.measureText(full).width + ctx.measureText(money(S.silver)).width + fs * 8.5;
  const r1 = chip(ctx, cx, y, need <= room ? full : `Day ${S.day}`, need <= room ? fs : fs * 0.9, { icon: 'sun', stroke: 'rgba(255,230,190,0.25)' }); cx += r1.w + 6;
  chip(ctx, cx, y, money(S.silver), fs, { icon: 'coin', color: PAL.gold, stroke: 'rgba(255,230,190,0.25)' });
  // buttons on the right: menu, journal, map
  const bs = Math.max(64, L.mb), btns = o.buttons ?? [['menu', 'menu'], ['journal', 'book'], ['map', 'map']];
  let bx = x1 - bs;
  for (const [id, ic] of btns) { const r = { x: bx, y: G.hudY - 2 + 0, w: bs, h: bs }; ctx.fillStyle = 'rgba(20,12,8,0.62)'; rrect(ctx, r, bs / 2); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,230,190,0.28)'; rrect(ctx, r, bs / 2); ctx.stroke(); icon(ctx, ic, r.x + bs / 2, r.y + bs / 2, bs * 0.27, PAL.text); ui.hits.push({ id: 'hud:' + id, r }); bx -= bs + 8; }
  return bx;
}

// A scrolling column. Rows are drawn with `y` advancing; hits carry the clip. Returns helpers.
function column(ctx, st, rect, key) {
  const scroll = clamp(st.psc ?? 0, 0, st.pmax ?? 0);
  st.psc = scroll;
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  const c = { y: rect.y - scroll, x: rect.x, w: rect.w, rect, key, scroll,
    hit(id, r, extra) { ui.hits.push({ id, r, clip: rect, ...extra }); },
    end() {
      const total = c.y + scroll - rect.y; st.pmax = Math.max(0, total - rect.h + 6); ctx.restore();
      if (st.pmax > 0) { const sb = { x: rect.x + rect.w - 7, y: rect.y + 4, w: 5, h: rect.h - 8 }, th = Math.max(36, sb.h * rect.h / total); ctx.fillStyle = 'rgba(255,240,215,0.1)'; rrect(ctx, sb, 2.5); ctx.fill(); ctx.fillStyle = 'rgba(255,200,140,0.65)'; rrect(ctx, { x: sb.x, y: sb.y + (sb.h - th) * (scroll / st.pmax), w: sb.w, h: th }, 2.5); ctx.fill(); }
      ui.scrollRect = rect; }
  };
  return c;
}
const kk = (st) => Math.min(TEXT_SCALES[st.prefs.textIdx] ?? 1, 1.55);

function statusStrip(ctx, st, rect) {
  const S = st.S, k = Math.min(kk(st), 1.3), fs = 23 * k, h = fs * 1.75 + 6; let x = rect.x, y = rect.y + h / 2;
  const used = E.usedLoads(S), cap = E.capacity(S);
  const items = [
    [`${Math.ceil(used * 10) / 10} / ${cap}`, 'camel', used > cap * 0.9 ? PAL.warn : PAL.text], [`${Math.round(S.water)}`, 'water', S.water < 8 ? PAL.bad : '#8ad4ff'], [`${Math.round(S.food)}`, 'food', S.food < 8 ? PAL.bad : '#e8b86a'],
    [`${Math.round(S.str)}`, 'rest', S.str < 40 ? PAL.bad : S.str < 60 ? PAL.warn : PAL.ok], [`${S.guards}`, 'guard', PAL.text],
  ];
  for (const [label, ic, col] of items) { ctx.font = `700 ${fs}px ${UI}`; const w = ctx.measureText(label).width + fs * 2.6; if (x + w > rect.x + rect.w) { x = rect.x; y += h; } const r = chip(ctx, x, y, label, fs, { icon: ic, color: col, fill: 'rgba(255,240,215,0.08)' }); x += r.w + 6; }
  return y + h / 2 - rect.y;
}

const lowest = (a, b) => (a < b ? a : b);

// ---- city screen -----------------------------------------------------------------------------------------------------------------------------------------
export function renderCity(ctx, st, L, t) {
  const S = st.S, G = L.split('city'), P = G.panel, C = CITIES[S.city], k = kk(st);
  paintScene(ctx, G.art, sceneSpec(st), t);
  // city name over the painting
  const nameY = L.mode === 'wide' ? G.art.h * 0.2 : G.art.h - 78;
  txt(ctx, C.name, G.art.x + (L.mode === 'wide' ? G.art.w / 2 : G.art.w / 2), nameY, L.mode === 'wide' ? 56 : 54, '#fff3d6', { align: 'center', font: DISPLAY, weight: 800, stroke: 10, strokeColor: 'rgba(30,14,6,0.8)', maxW: G.art.w - 60 });
  hud(ctx, st, L, G);
  // panel
  panel(ctx, P);
  const pad = 14, inner = { x: P.x + pad, y: P.y + 12 + st.lessonH, w: P.w - pad * 2, h: P.h - 24 - st.lessonH };
  const tabH = Math.max(72, L.mb), tabsR = { x: inner.x, y: inner.y + inner.h - tabH, w: inner.w, h: tabH };
  const sh = statusStrip(ctx, st, { x: inner.x, y: inner.y, w: inner.w, h: 120 });
  let top = inner.y + sh + 4;
  // hint card
  if (st.hint) { const hh = hintCard(ctx, st, { x: inner.x, y: top, w: inner.w }, t); top += hh + 8; }
  const area = { x: inner.x, y: top, w: inner.w, h: tabsR.y - 10 - top };
  if (st.tab === 'trade') tradeTab(ctx, st, area, t);
  else if (st.tab === 'caravan') caravanTab(ctx, st, area, t);
  else roadTab(ctx, st, area, t, L);
  // tabs bar
  const tabs = [['trade', 'Trade', 'coin'], ['caravan', 'Caravan', 'camel'], ['road', 'Road', 'east']];
  const thw = Math.max(82, L.mb), tw = (tabsR.w - 8 * (tabs.length - 1) - thw - 8) / tabs.length;
  tabs.forEach(([id, label, ic], i) => { const r = { x: tabsR.x + i * (tw + 8), y: tabsR.y, w: tw, h: tabsR.h }; button(ctx, r, label, { icon: ic, kind: st.tab === id ? 'primary' : 'quiet', size: 27, glow: st.hint && st.hint.tab === id && st.tab !== id, t }); ui.hits.push({ id: 'tab:' + id, r }); });
  const hr = { x: tabsR.x + tabsR.w - thw, y: tabsR.y, w: thw, h: tabsR.h }; button(ctx, hr, '', { icon: 'bulb', kind: st.hint ? 'gold' : 'quiet', size: 24 }); ui.hits.push({ id: 'think', r: hr });
}

function hintCard(ctx, st, r, t) {
  const h = st.hint, k = Math.min(kk(st), 1.4), fs = 24 * k;
  ctx.font = `600 ${fs}px ${UI}`; const lines = wrap(ctx, h.why, r.w - 28);
  const hh = Math.min(fs * 1.4 * lines.length + fs * 1.5 + 16, 270);
  ctx.fillStyle = 'rgba(232,184,74,0.14)'; rrect(ctx, { x: r.x, y: r.y, w: r.w, h: hh }, 14); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(232,184,74,0.7)'; rrect(ctx, { x: r.x, y: r.y, w: r.w, h: hh }, 14); ctx.stroke();
  icon(ctx, 'bulb', r.x + 28, r.y + 28, 14, PAL.gold);
  txt(ctx, 'Think: ' + h.label, r.x + 54, r.y + 28, fs * 1.08, PAL.gold, { weight: 800, maxW: r.w - 70 });
  ctx.font = `500 ${fs}px ${UI}`; ctx.fillStyle = PAL.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; lines.slice(0, 7).forEach((ln, i) => ctx.fillText(ln, r.x + 14, r.y + fs * 2 + 2 + i * fs * 1.4));
  ui.hits.push({ id: 'hintClose', r: { x: r.x, y: r.y, w: r.w, h: hh } });
  return hh;
}

// ---- Trade tab ---------------------------------------------------------------------------------------------------------------------------------------------
function bestElsewhere(S, g) {
  let best = null;
  for (const c of CITIES) { if (c.id === S.city) continue; const e = S.ledger[c.id]?.[g]; if (!e) continue; if (!best || e.sell > best.sell) best = { c: c.id, sell: e.sell, rumor: e.rumor, day: e.day }; }
  return best;
}
function tradeTab(ctx, st, area, t) {
  const S = st.S, k = kk(st), c = column(ctx, st, area, 'trade');
  const fsN = 29 * k, fsS = 22 * k, rh = Math.max(L_RH(st), 116 * k);
  // step selector
  const sh = Math.max(56, 54 * k);
  ctx.font = `600 ${23 * k}px ${UI}`; const lw0 = ctx.measureText('Move at once').width + 24; const steps = [[1, '1'], [5, '5'], [99, 'All']]; const sw = Math.max(52, Math.min(120 * k, (area.w - lw0 - 30) / 3));
  txt(ctx, 'Move at once', c.x + 6, c.y + sh / 2, 23 * k, PAL.dim, { weight: 600 });
  ctx.font = `600 ${23 * k}px ${UI}`; const lw = ctx.measureText('Move at once').width + 24;
  steps.forEach(([v, label], i) => { const r = { x: c.x + Math.max(lw, area.w - sw * 3 - 16) + i * (sw + 8), y: c.y + 2, w: sw, h: sh - 4 }; if (r.x + r.w <= area.x + area.w + 2) { button(ctx, r, label, { kind: st.step === v ? 'primary' : 'quiet', size: 26 * k, noShadow: true }); c.hit('step:' + v, r); } });
  c.y += sh + 6;
  const news = E.cityNews(S);
  if (news) { ctx.font = `600 ${22 * k}px ${UI}`; const nl = wrap(ctx, 'Market news: ' + news.text, area.w - 40), nh = nl.length * 22 * k * 1.3 + 22; ctx.fillStyle = 'rgba(242,192,76,0.14)'; rrect(ctx, { x: c.x, y: c.y, w: area.w - 8, h: nh }, 14); ctx.fill(); ctx.fillStyle = PAL.warn; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; nl.forEach((ln, i) => ctx.fillText(ln, c.x + 16, c.y + 11 + i * 22 * k * 1.3)); c.y += nh + 8; }
  for (const g of GOODS) {
    const gi = GOOD_IDX[g.id], have = S.goods[g.id], here = E.price(S, S.city, g.id), sp = E.sellPrice(S, S.city, g.id);
    const r = { x: c.x, y: c.y, w: area.w - (st.pmax > 0 ? 10 : 0), h: rh };
    const hl = st.hint && st.hint.good === g.id && st.hint.tab === 'trade';
    ctx.fillStyle = 'rgba(255,240,215,0.07)'; rrect(ctx, r, 18); ctx.fill();
    if (hl) { ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,214,110,${0.6 + 0.4 * Math.sin(t * 5)})`; rrect(ctx, r, 18); ctx.stroke(); }
    const ic = Math.min(rh - 22, 78 * k);
    drawGood(ctx, g.id, r.x + 14 + ic / 2, r.y + r.h / 2, ic);
    const tx = r.x + ic + 28, bw = Math.min(128 * k, r.w * 0.22), bx2 = r.x + r.w - 12 - bw, bx1 = bx2 - 10 - bw;
    const tw = bx1 - 12 - tx;
    txt(ctx, g.name, tx, r.y + r.h * 0.22, fsN, PAL.text, { weight: 800, maxW: tw });
    txt(ctx, `Buy ${here}   Sell ${sp}`, tx, r.y + r.h * 0.46, fsS * 1.08, PAL.gold, { weight: 700, maxW: tw });
    const be = bestElsewhere(S, g.id);
    const bt = be ? `Best ${CITIES[be.c].short} ${be.sell}${be.rumor ? ' (heard)' : ''}` : 'Best: not known yet';
    txt(ctx, `Hold ${have}  \u00b7  ${bt}`, tx, r.y + r.h * 0.7, fsS, be && be.sell > sp ? PAL.ok : PAL.dim, { weight: 600, maxW: tw });
    // price trend bar: where this price sits between the cheapest and dearest typical price
    const row = E.CITIES ? null : null;
    // buttons
    const nSell = Math.min(st.step, have), nBuy = Math.min(st.step, Math.max(0, Math.floor((E.freeLoads(S) + 1e-9) / g.loads)));
    const sellQ = nSell > 0 ? E.quote(S, 'sell', S.city, g.id, nSell) : null;
    let nB = nBuy; while (nB > 0 && E.quote(S, 'buy', S.city, g.id, nB).total > S.silver) nB--;
    const buyQ = nB > 0 ? E.quote(S, 'buy', S.city, g.id, nB) : null;
    const sr = { x: bx1, y: r.y + r.h * 0.12, w: bw, h: r.h * 0.76 }, br = { x: bx2, y: sr.y, w: bw, h: sr.h };
    button(ctx, sr, 'Sell', { kind: sellQ ? 'quiet' : 'disabled', size: 26 * k, sub: sellQ ? `${nSell} for ${money(sellQ.total)}` : 'none', noShadow: true, glow: hl && st.hint.act === 'sell', t });
    button(ctx, br, 'Buy', { kind: buyQ ? 'primary' : 'disabled', size: 26 * k, sub: buyQ ? `${nB} for ${money(buyQ.total)}` : (E.freeLoads(S) < g.loads ? 'no room' : 'no silver'), noShadow: true, glow: hl && st.hint.act === 'buy', t });
    if (sellQ) c.hit('sell:' + g.id, sr); if (buyQ) c.hit('buy:' + g.id, br);
    c.y += rh + 8;
  }
  const rg = ctx.createLinearGradient(0, c.y, 0, c.y); void rg;
  txt(ctx, 'Prices move with every load you buy or sell, and recover day by day.', c.x + 6, c.y + 18, 21 * k, PAL.dim, { weight: 500, maxW: area.w - 20 }); c.y += 40;
  c.end();
}
const L_RH = () => 118;

// ---- Caravan tab ---------------------------------------------------------------------------------------------------------------------------------------------
function actionRow(ctx, c, area, k, o) {
  const rh = Math.max(o.h ?? 120 * k, 108), r = { x: c.x, y: c.y, w: area.w - (c.st.pmax > 0 ? 10 : 0), h: rh };
  ctx.fillStyle = 'rgba(255,240,215,0.07)'; rrect(ctx, r, 18); ctx.fill();
  if (o.glow) { ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,214,110,${0.6 + 0.4 * Math.sin(o.t * 5)})`; rrect(ctx, r, 18); ctx.stroke(); }
  icon(ctx, o.icon, r.x + 40, r.y + r.h / 2, 21 * k, o.iconCol ?? PAL.gold);
  const nb = o.btns.length, bw = Math.min(138 * k, (r.w - 100) * 0.27), tx = r.x + 76, tw = r.w - 76 - nb * (bw + 10) - 14;
  txt(ctx, o.title, tx, r.y + r.h * (o.bar !== undefined ? 0.2 : 0.26), 28 * k, PAL.text, { weight: 800, maxW: tw });
  ctx.font = `500 ${21 * k}px ${UI}`; const sl = wrap(ctx, o.sub, tw).slice(0, 2); ctx.fillStyle = PAL.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  sl.forEach((ln, i) => ctx.fillText(ln, tx, r.y + r.h * (o.bar !== undefined ? 0.36 : 0.43) + i * 21 * k * 1.25));
  if (o.bar !== undefined) bar(ctx, { x: tx, y: r.y + r.h * 0.84, w: Math.min(tw, 300), h: 11 }, o.bar, o.barCol ?? PAL.ok);
  o.btns.forEach((b, i) => { const br = { x: r.x + r.w - (nb - i) * (bw + 10) + 2, y: r.y + r.h * 0.14, w: bw, h: r.h * 0.72 }; button(ctx, br, b.label, { kind: b.kind ?? 'quiet', size: 25 * k, sub: b.sub, noShadow: true, glow: b.glow, t: o.t }); if (b.kind !== 'disabled') c.hit(b.id, br); });
  c.y += rh + 8;
}
function caravanTab(ctx, st, area, t) {
  const S = st.S, k = kk(st), c = column(ctx, st, area, 'caravan'); c.st = st;
  const H = st.hint;
  const pl = E.plan(S, clamp(S.city + (S.dir >= 0 ? 1 : -1), 0, 8) === S.city ? S.city - S.dir : S.city + S.dir, 'main', 'steady');
  actionRow(ctx, c, area, k, { t, icon: 'camel', title: `Camels ${S.camels} (${S.camels * CAMEL_LOADS} loads)`, sub: `Strength ${Math.round(S.str)}. Carry ${CAMEL_LOADS} loads each.`, bar: S.str / 100, barCol: S.str < 40 ? PAL.bad : S.str < 60 ? PAL.warn : PAL.ok,
    btns: [{ id: 'camel+', label: 'Buy', sub: `${PRICES.camelBuy}`, kind: S.silver >= PRICES.camelBuy && S.camels < MAX.camels ? 'primary' : 'disabled', glow: H?.id === 'camel+' }, { id: 'camel-', label: 'Sell', sub: `+${PRICES.camelSell}`, kind: S.camels > 1 ? 'quiet' : 'disabled' }] });
  actionRow(ctx, c, area, k, { t, icon: 'guard', title: `Guards ${S.guards} of ${MAX.guards}`, sub: `${PRICES.guardWage} silver a day each. Better odds on the road.`,
    btns: [{ id: 'guard+', label: 'Hire', sub: `${PRICES.guardWage * 2}`, kind: S.guards < MAX.guards && S.silver >= PRICES.guardWage * 2 ? 'primary' : 'disabled', glow: H?.id === 'guard+' }, { id: 'guard-', label: 'Pay off', kind: S.guards > 0 ? 'quiet' : 'disabled', glow: H?.id === 'guard-' }] });
  const sp = (kind) => E.supplyPrice(S, kind);
  const need = st.roadNeed ?? { water: 0, food: 0 };
  actionRow(ctx, c, area, k, { t, icon: 'water', iconCol: '#8ad4ff', title: `Water ${Math.round(S.water)}`, sub: `${sp('water')} silver a unit. Next road needs ${need.water}.`,
    btns: [{ id: 'water+10', label: '+10', sub: `${Math.round(sp('water') * 10)}`, kind: S.silver >= sp('water') && E.freeLoads(S) > 0.09 ? 'primary' : 'disabled', glow: H?.id === 'water+' }, { id: 'water+need', label: 'To need', kind: S.water < need.water ? 'quiet' : 'disabled', glow: H?.id === 'water+' }] });
  actionRow(ctx, c, area, k, { t, icon: 'food', iconCol: '#e8b86a', title: `Provisions ${Math.round(S.food)}`, sub: `${sp('food')} silver a unit. Next road needs ${need.food}.`,
    btns: [{ id: 'food+10', label: '+10', sub: `${Math.round(sp('food') * 10)}`, kind: S.silver >= sp('food') && E.freeLoads(S) > 0.09 ? 'primary' : 'disabled', glow: H?.id === 'food+' }, { id: 'food+need', label: 'To need', kind: S.food < need.food ? 'quiet' : 'disabled', glow: H?.id === 'food+' }] });
  const rest = PRICES.restDay + E.people(S);
  actionRow(ctx, c, area, k, { t, icon: 'rest', title: 'Rest a day', sub: `${rest} silver, +1 day, camels regain 14 strength.`, btns: [{ id: 'rest', label: 'Rest', sub: `${rest}`, kind: S.silver >= rest ? 'quiet' : 'disabled', glow: H?.id === 'rest' }] });
  const did = (key) => S.did[key + S.city];
  actionRow(ctx, c, area, k, { t, icon: 'speak', title: `Languages ${S.tongues} of ${MAX.tongues}`, sub: did('phr') ? 'Studied here already.' : `${PRICES.phrases} silver and a day with a teacher: +1.`, btns: [{ id: 'phrases', label: 'Learn', sub: `${PRICES.phrases}`, kind: !did('phr') && S.tongues < MAX.tongues && S.silver >= PRICES.phrases ? 'quiet' : 'disabled', glow: H?.id === 'phrases' }] });
  actionRow(ctx, c, area, k, { t, icon: 'news', title: 'Ask for news', sub: did('news') ? 'You have asked here already.' : `${PRICES.news} silver: prices in the nearby cities.`, btns: [{ id: 'news', label: 'Ask', sub: `${PRICES.news}`, kind: !did('news') && S.silver >= PRICES.news ? 'quiet' : 'disabled', glow: H?.id === 'news' }] });
  // standing
  const sr = { x: c.x, y: c.y, w: area.w - (st.pmax > 0 ? 10 : 0), h: 130 * k };
  ctx.fillStyle = 'rgba(255,240,215,0.05)'; rrect(ctx, sr, 18); ctx.fill();
  const rows = [['Reputation', S.rep / MAX.rep, `${S.rep}`], ['Customs', S.customs / MAX.customs, `${S.customs}`], ['Languages', S.tongues / MAX.tongues, `${S.tongues}`]];
  rows.forEach(([label, v, n], i) => { const y = sr.y + sr.h * (0.2 + i * 0.3); txt(ctx, label, sr.x + 18, y, 23 * k, PAL.text, { weight: 700 }); bar(ctx, { x: sr.x + sr.w * 0.34, y: y - 7, w: sr.w * 0.5, h: 14 }, v, PAL.turq); txt(ctx, n, sr.x + sr.w - 22, y, 23 * k, PAL.gold, { align: 'right', weight: 800 }); });
  c.y += sr.h + 10;
  c.end();
}

// ---- Road tab --------------------------------------------------------------------------------------------------------------------------------------------------
function roadTab(ctx, st, area, t, L) {
  const S = st.S, k = kk(st), c = column(ctx, st, area, 'road'); c.st = st;
  const nb = E.neighbours(S.city);
  const to = st.roadTo != null && nb.includes(st.roadTo) ? st.roadTo : nb.includes(S.city + S.dir) ? S.city + S.dir : nb[0];
  const leg = LEGS[Math.min(S.city, to)], route = leg.alt && st.roadAlt ? 'alt' : 'main';
  const pl = E.plan(S, to, route, st.pace);
  st.roadNeed = { water: pl.water, food: pl.food }; st.roadTo = to;
  const w = area.w - (st.pmax > 0 ? 10 : 0), H = st.hint;
  // destination cards
  const cw = (w - 10) / 2, ch = Math.max(112, 118 * k);
  [S.city + 1, S.city - 1].forEach((d, i) => {
    const r = { x: c.x + i * (cw + 10), y: c.y, w: cw, h: ch };
    if (d < 0 || d > 8) { ctx.fillStyle = 'rgba(255,255,255,0.03)'; rrect(ctx, r, 18); ctx.fill(); txt(ctx, d > 8 ? 'Edge of the map' : 'Edge of the map', r.x + r.w / 2, r.y + r.h / 2, 22 * k, PAL.dim, { align: 'center' }); return; }
    const sel = d === to, west = d > S.city;
    ctx.fillStyle = sel ? 'rgba(224,160,48,0.2)' : 'rgba(255,240,215,0.07)'; rrect(ctx, r, 18); ctx.fill(); if (sel) { ctx.lineWidth = 3; ctx.strokeStyle = PAL.amber; rrect(ctx, r, 18); ctx.stroke(); }
    icon(ctx, west ? 'west' : 'east', r.x + 34, r.y + r.h * 0.28, 15 * k, sel ? PAL.gold : PAL.dim);
    txt(ctx, west ? 'WEST' : 'EAST', r.x + 62, r.y + r.h * 0.28, 20 * k, PAL.dim, { weight: 800 });
    txt(ctx, CITIES[d].short, r.x + 16, r.y + r.h * 0.5, 31 * k, PAL.text, { weight: 800, maxW: r.w - 30, font: DISPLAY });
    const pp = E.plan(S, d, 'main', 'steady');
    txt(ctx, `${pp.days} days, ${CITIES[d].id === 8 && west ? 'the end of the road' : pp.riskWord.toLowerCase() + ' risk'}`, r.x + 16, r.y + r.h * 0.75, 22 * k, PAL.dim, { weight: 600, maxW: r.w - 30 });
    c.hit('road:' + d, r);
  });
  c.y += ch + 10;
  // route
  if (leg.alt) {
    const rr = [['main', leg], ['alt', leg.alt]];
    rr.forEach(([id, L2], i) => { const r = { x: c.x, y: c.y, w, h: Math.max(100, 100 * k) }; const sel = route === id; ctx.fillStyle = sel ? 'rgba(39,167,157,0.18)' : 'rgba(255,240,215,0.06)'; rrect(ctx, r, 16); ctx.fill(); if (sel) { ctx.lineWidth = 3; ctx.strokeStyle = PAL.turq; rrect(ctx, r, 16); ctx.stroke(); }
      txt(ctx, L2.name, r.x + 18, r.y + r.h * 0.3, 26 * k, PAL.text, { weight: 800, maxW: r.w - 40 });
      txt(ctx, `${L2.days} days at a steady pace. Dry factor ${L2.dry}. ${L2.danger >= 0.45 ? 'Dangerous.' : L2.danger >= 0.33 ? 'Some danger.' : 'Fairly safe.'}`, r.x + 18, r.y + r.h * 0.68, 21 * k, PAL.dim, { weight: 500, maxW: r.w - 36 });
      c.hit('route:' + id, r); c.y += r.h + 8; });
  } else {
    txt(ctx, leg.name, c.x + 8, c.y + 18, 24 * k, PAL.gold, { weight: 700, maxW: w - 16, font: DISPLAY }); c.y += 44;
  }
  // pace
  const pw = (w - 16) / 3, ph = Math.max(78, 76 * k);
  PACES.forEach((p, i) => { const r = { x: c.x + i * (pw + 8), y: c.y, w: pw, h: ph }; button(ctx, r, p.name, { kind: st.pace === p.id ? 'primary' : 'quiet', size: 27 * k, sub: `x${p.mult} days`, noShadow: true }); c.hit('pace:' + p.id, r); });
  c.y += ph + 6;
  txt(ctx, PACES.find((p) => p.id === st.pace).note, c.x + 8, c.y + 16, 21 * k, PAL.dim, { weight: 500, maxW: w - 16 }); c.y += 38;
  // needs
  const need = (label, have, nd, col, ic) => { const ok = have >= nd; const r = { x: c.x, y: c.y, w, h: Math.max(64, 62 * k) }; ctx.fillStyle = ok ? 'rgba(134,212,147,0.1)' : 'rgba(255,138,118,0.14)'; rrect(ctx, r, 14); ctx.fill(); icon(ctx, ic, r.x + 32, r.y + r.h / 2, 15 * k, col); txt(ctx, `${label}: have ${Math.round(have)}, need ${nd}`, r.x + 62, r.y + r.h / 2, 24 * k, ok ? PAL.text : PAL.bad, { weight: 700, maxW: w - 160 }); txt(ctx, ok ? 'enough' : `short ${Math.ceil(nd - have)}`, r.x + r.w - 18, r.y + r.h / 2, 22 * k, ok ? PAL.ok : PAL.bad, { align: 'right', weight: 800 }); c.y += r.h + 6; };
  need('Water', S.water, pl.water, '#8ad4ff', 'water'); need('Provisions', S.food, pl.food, '#e8b86a', 'food');
  if (S.guards) txt(ctx, `Guards' wages for the road: ${pl.wages} silver.`, c.x + 8, c.y + 14, 21 * k, PAL.dim, { weight: 500, maxW: w - 16 }), c.y += 32;
  const short = S.water < pl.water || S.food < pl.food;
  if (short) { const r = { x: c.x, y: c.y, w, h: Math.max(70, 68 * k) }; button(ctx, r, 'Buy what the road needs', { kind: 'quiet', size: 25 * k, sub: `about ${Math.round(Math.max(0, pl.water - S.water) * E.supplyPrice(S, 'water') + Math.max(0, pl.food - S.food) * E.supplyPrice(S, 'food'))} silver`, noShadow: true }); c.hit('buyNeed', r); c.y += r.h + 8; }
  // depart
  const dr = { x: c.x, y: c.y + 6, w, h: Math.max(88, 84 * k) };
  button(ctx, dr, `Depart for ${CITIES[to].short}`, { kind: 'primary', size: 31 * k, sub: `${pl.days} days, ${pl.riskWord.toLowerCase()} risk`, glow: H?.id === 'depart', t }); c.hit('depart', dr); c.y += dr.h + 16;
  const sr = { x: c.x, y: c.y, w, h: Math.max(70, 66 * k) };
  button(ctx, sr, 'Settle here and end the journey', { kind: 'ghost', size: 23 * k, sub: `Score now: ${money(E.score(S).total)}`, noShadow: true, glow: H?.id === 'settle', t }); c.hit('settle', sr); c.y += sr.h + 10;
  c.end();
}

// ---- Travel ----------------------------------------------------------------------------------------------------------------------------------------------------
export function renderTravel(ctx, st, L, t) {
  const S = st.S, tr = S.trip, G = L.split('travel'), P = G.panel, k = kk(st);
  paintScene(ctx, G.art, sceneSpec(st), t);
  hud(ctx, st, L, G, { buttons: [['menu', 'menu'], ['map', 'map']] });
  // day banner on the art
  const cx = G.art.x + G.art.w / 2;
  txt(ctx, tr.name, cx, G.art.h - (L.mode === 'wide' ? 70 : 52), L.mode === 'wide' ? 30 : 28, '#fff3d6', { align: 'center', font: DISPLAY, weight: 700, stroke: 8, strokeColor: 'rgba(30,14,6,0.8)', maxW: G.art.w - 40 });
  panel(ctx, P);
  const pad = 16, inner = { x: P.x + pad, y: P.y + 14 + st.lessonH, w: P.w - pad * 2, h: P.h - 28 - st.lessonH };
  txt(ctx, `${CITIES[tr.from].short}  to  ${CITIES[tr.to].short}`, inner.x + inner.w / 2, inner.y + 26, 32 * Math.min(k, 1.3), PAL.gold, { align: 'center', font: DISPLAY, weight: 800, maxW: inner.w });
  txt(ctx, `Day ${tr.day} of ${tr.days}   (${PACES.find((p) => p.id === tr.pace).name} pace)`, inner.x + inner.w / 2, inner.y + 66 * Math.min(k, 1.3), 25 * Math.min(k, 1.3), PAL.text, { align: 'center', weight: 700 });
  const br = { x: inner.x + 10, y: inner.y + 96 * Math.min(k, 1.3), w: inner.w - 20, h: 20 };
  bar(ctx, br, (tr.day + st.tv.dayT / dayLen(st)) / tr.days, PAL.amber);
  // event markers
  tr.evAt.forEach((d, i) => { const x = br.x + br.w * d / tr.days; ctx.fillStyle = i < tr.evDone ? PAL.dim : PAL.gold; ctx.beginPath(); ctx.arc(x, br.y + br.h / 2, 5, 0, TAU); ctx.fill(); });
  const sy = br.y + 44 * Math.min(k, 1.3);
  const sr = statusStrip(ctx, st, { x: inner.x, y: sy, w: inner.w, h: 120 });
  let y = sy + sr + 14;
  const bh = Math.max(72, L.mb);
  const row = { x: inner.x, y: Math.min(y, inner.y + inner.h - bh), w: inner.w, h: bh }, bw = (row.w - 16) / 3;
  const ctl = [['pause', st.tv.paused ? 'Resume' : 'Pause', st.tv.paused ? 'play' : 'pause'], ['speed1', 'Normal', 'play'], ['speed3', 'Fast', 'skip']];
  ctl.forEach(([id, label, ic], i) => { const r = { x: row.x + i * (bw + 8), y: row.y, w: bw, h: row.h }; const on = (id === 'speed1' && st.tv.speed === 1) || (id === 'speed3' && st.tv.speed === 3) || (id === 'pause' && st.tv.paused); button(ctx, r, label, { icon: ic, kind: on ? 'primary' : 'quiet', size: 25, noShadow: true }); ui.hits.push({ id, r }); });
  if (st.tv.paused) txt(ctx, 'Paused', G.art.x + G.art.w / 2, G.art.h * 0.4, 56, '#fff3d6', { align: 'center', font: DISPLAY, weight: 800, stroke: 10, strokeColor: 'rgba(30,14,6,0.8)' });
  // supply warnings
  let wy = row.y - 12;
  if (S.water <= 0) { txt(ctx, 'Out of water! The camels are weakening.', inner.x + inner.w / 2, wy - 8, 24, PAL.bad, { align: 'center', weight: 800, maxW: inner.w }); wy -= 34; }
  if (S.food <= 0) { txt(ctx, 'Out of provisions!', inner.x + inner.w / 2, wy - 8, 24, PAL.bad, { align: 'center', weight: 800, maxW: inner.w }); }
}
export const dayLen = (st) => (st.auto ? 0.85 : 1.1) / st.tv.speed;

// ---- Event -----------------------------------------------------------------------------------------------------------------------------------------------------
export function renderEvent(ctx, st, L, t) {
  const S = st.S, ev = EVENT_BY_ID[st.ev.id], G = L.split('event'), P = G.panel, k = TEXT_SCALES[st.prefs.textIdx] ?? 1;
  paintScene(ctx, G.art, sceneSpec(st), t);
  hud(ctx, st, L, G, { buttons: [['menu', 'menu'], ['map', 'map']] });
  // portrait of the person met
  if (ev.who) { const ps = clamp(Math.min(G.art.w, G.art.h) * 0.3, 120, 200), px = G.art.x + 24 + ps / 2, py = G.art.h - 24 - ps / 2 - (L.mode === 'wide' ? 0 : 0); portrait(ctx, px, py, ps, PEOPLE[ev.who].look, { frame: PAL.gold }); const nm = PEOPLE[ev.who].name, rr = chip(ctx, px - ps / 2, py + ps / 2 + 0, nm, 22, { fill: 'rgba(20,12,8,0.82)', color: PAL.gold, align: 'left', stroke: 'rgba(232,184,74,0.5)' }); void rr; }
  panel(ctx, P);
  const pad = 16, inner = { x: P.x + pad, y: P.y + 12 + st.lessonH, w: P.w - pad * 2, h: P.h - 24 - st.lessonH };
  const res = st.ev.res;
  const hintH = st.hint ? (() => { const hh = hintCard(ctx, st, { x: inner.x, y: inner.y, w: inner.w }, t); return hh + 14; })() : 0;
  const area = { x: inner.x, y: inner.y + hintH, w: inner.w, h: inner.h - hintH - (res ? Math.max(84, L.mb + 16) + 8 : 0) };
  const c = column(ctx, st, area, 'event'); c.st = st;
  const w = area.w - (st.pmax > 0 ? 12 : 0);
  ctx.font = `800 ${34 * Math.min(k, 1.6)}px ${DISPLAY}`; const tl = wrap(ctx, ev.title, w);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = PAL.gold; tl.forEach((ln) => { ctx.fillText(ln, c.x + 4, c.y + 4); c.y += 34 * Math.min(k, 1.6) * 1.25; }); c.y += 10;
  const bodyF = 26 * k;
  ctx.font = `500 ${bodyF}px ${UI}`; const bl = wrap(ctx, ev.text, w - 8);
  ctx.fillStyle = PAL.text; ctx.textBaseline = 'top'; bl.forEach((ln) => { ctx.fillText(ln, c.x + 4, c.y); c.y += bodyF * 1.42; }); c.y += 14;
  if (!res) {
    const list = E.choicesFor(S, ev), H = st.hint;
    list.forEach((ch) => {
      const lf = 27 * Math.min(k, 1.7), sf = 21 * Math.min(k, 1.7);
      ctx.font = `700 ${lf}px ${UI}`; const ll = wrap(ctx, ch.label, w - 60 - (ch.word ? 190 * Math.min(k, 1.3) : 0));
      const hh = Math.max(Math.max(96, L.mb * 1.2), ll.length * lf * 1.25 + (ch.sub || ch.why ? sf * 1.5 : 0) + 34);
      const r = { x: c.x, y: c.y, w, h: hh }, hl = H && H.i === ch.i;
      ctx.fillStyle = ch.ok ? 'rgba(255,240,215,0.1)' : 'rgba(255,255,255,0.04)'; rrect(ctx, r, 18); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = hl ? `rgba(255,214,110,${0.7 + 0.3 * Math.sin(t * 5)})` : (ch.ok ? 'rgba(255,230,190,0.32)' : 'rgba(255,230,190,0.12)'); if (hl) ctx.lineWidth = 4; rrect(ctx, r, 18); ctx.stroke();
      ctx.font = `700 ${lf}px ${UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = ch.ok ? PAL.text : PAL.dim; ll.forEach((ln, i) => ctx.fillText(ln, r.x + 18, r.y + 16 + i * lf * 1.25));
      const sub = !ch.ok ? ch.why : ch.sub; if (sub) txt(ctx, sub, r.x + 18, r.y + 16 + ll.length * lf * 1.25 + sf * 0.8, sf, ch.ok ? PAL.dim : PAL.bad, { weight: 600, maxW: w - 40 - (ch.word ? 190 * Math.min(k, 1.3) : 0) });
      if (ch.word && ch.ok) { const col = ODDS_COL[ch.word]; const bw = 170 * Math.min(k, 1.3), br = { x: r.x + r.w - bw - 14, y: r.y + r.h / 2 - 32, w: bw, h: 64 }; ctx.fillStyle = 'rgba(0,0,0,0.3)'; rrect(ctx, br, 32); ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = col; rrect(ctx, br, 32); ctx.stroke(); txt(ctx, ch.word, br.x + br.w / 2, br.y + 24, 25 * Math.min(k, 1.2), col, { align: 'center', weight: 800, maxW: br.w - 16 }); txt(ctx, Math.round(ch.p * 100) + '%', br.x + br.w / 2, br.y + 49, 21, PAL.dim, { align: 'center', weight: 700 }); }
      if (ch.ok) c.hit('choice:' + ch.i, r);
      c.y += hh + 10;
    });
  } else {
    // outcome
    const col = res.win === null ? PAL.gold : res.win ? PAL.ok : PAL.bad;
    const head = res.win === null ? 'The result' : res.win ? 'It went well' : 'It did not go well';
    txt(ctx, head, c.x + 6, c.y + 22, 29 * Math.min(k, 1.5), col, { weight: 800, font: DISPLAY, maxW: w });
    c.y += 50 * Math.min(k, 1.5);
    ctx.font = `500 ${bodyF}px ${UI}`; const ol = wrap(ctx, res.text, w - 8); ctx.fillStyle = PAL.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ol.forEach((ln) => { ctx.fillText(ln, c.x + 4, c.y); c.y += bodyF * 1.42; }); c.y += 12;
    let cx = c.x; const chipF = 24 * Math.min(k, 1.4), rowH = chipF * 2.2;
    let cy = c.y + rowH / 2;
    for (const ch of res.chips) {
      const good = (['silver', 'water', 'food', 'strength', 'reputation', 'customs', 'languages', 'camels', 'guards', 'days'].includes(ch.k) ? (ch.k === 'days' ? ch.v < 0 : ch.v > 0) : ch.v > 0), label = `${ch.v > 0 ? '+' : ''}${ch.v} ${ch.k}`;
      ctx.font = `700 ${chipF}px ${UI}`; const wd = ctx.measureText(label).width + chipF * 1.4; if (cx + wd > c.x + w) { cx = c.x; cy += rowH; }
      const r = chip(ctx, cx, cy, label, chipF, { fill: good ? 'rgba(134,212,147,0.18)' : 'rgba(255,138,118,0.2)', color: good ? PAL.ok : PAL.bad, stroke: good ? 'rgba(134,212,147,0.5)' : 'rgba(255,138,118,0.5)' }); cx += r.w + 8;
    }
    c.y = cy + rowH * 0.7;
    if (!res.chips.length) { txt(ctx, 'Nothing changes.', c.x + 6, c.y + 12, 24 * Math.min(k, 1.4), PAL.dim, { weight: 600 }); c.y += 40; }
  }
  c.end();
  if (res) { const br = { x: inner.x, y: inner.y + inner.h - Math.max(84, L.mb + 16), w: inner.w, h: Math.max(84, L.mb + 16) }; button(ctx, br, 'Continue', { kind: 'primary', size: 32 }); ui.hits.push({ id: 'evContinue', r: br }); }
  if (!res) { const hr = { x: inner.x + inner.w - 74, y: inner.y - 0, w: 0, h: 0 }; void hr; }
}

// ---- Arrival ---------------------------------------------------------------------------------------------------------------------------------------------------
export function renderArrive(ctx, st, L, t) {
  const S = st.S, G = L.split('city'), P = G.panel, C = CITIES[S.city], k = TEXT_SCALES[st.prefs.textIdx] ?? 1, a = st.arr;
  paintScene(ctx, G.art, sceneSpec(st), t);
  hud(ctx, st, L, G, { buttons: [['menu', 'menu'], ['map', 'map']] });
  const nameY = L.mode === 'wide' ? G.art.h * 0.2 : G.art.h - 78;
  txt(ctx, C.name, G.art.x + G.art.w / 2, nameY, L.mode === 'wide' ? 56 : 54, '#fff3d6', { align: 'center', font: DISPLAY, weight: 800, stroke: 10, strokeColor: 'rgba(30,14,6,0.8)', maxW: G.art.w - 60 });
  panel(ctx, P);
  const pad = 18, inner = { x: P.x + pad, y: P.y + 14 + st.lessonH, w: P.w - pad * 2, h: P.h - 28 - st.lessonH }, bh = Math.max(84, L.mb + 16);
  const area = { x: inner.x, y: inner.y, w: inner.w, h: inner.h - bh - 10 };
  const c = column(ctx, st, area, 'arrive'); c.st = st; const w = area.w - (st.pmax > 0 ? 12 : 0), bodyF = 26 * k;
  txt(ctx, a.first ? 'You have reached a new city' : `Back in ${C.short}`, c.x + 4, c.y + 24, 31 * Math.min(k, 1.5), PAL.gold, { font: DISPLAY, weight: 800, maxW: w }); c.y += 56 * Math.min(k, 1.5);
  txt(ctx, `Day ${S.day} of ${LIMIT_DAYS}`, c.x + 4, c.y + 8, 24 * Math.min(k, 1.5), PAL.dim, { weight: 700 }); c.y += 40 * Math.min(k, 1.5);
  ctx.font = `500 ${bodyF}px ${UI}`; ctx.fillStyle = PAL.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  for (const para of [C.known, a.first ? 'New custom learned: ' + C.custom : null, a.news ? 'Market news: ' + a.news : null, a.first ? 'Your journal has a new entry.' : null].filter(Boolean)) {
    const ls = wrap(ctx, para, w - 8); ctx.fillStyle = para.startsWith('Market') ? PAL.warn : para.startsWith('New custom') ? PAL.ok : PAL.text; ls.forEach((ln) => { ctx.fillText(ln, c.x + 4, c.y); c.y += bodyF * 1.42; }); c.y += 12;
  }
  if (a.first) { const r = chip(ctx, c.x, c.y + 22, '+1 customs', 25 * Math.min(k, 1.4), { fill: 'rgba(134,212,147,0.18)', color: PAL.ok, stroke: 'rgba(134,212,147,0.5)' }); c.y += r.h + 14; }
  c.end();
  const br = { x: inner.x, y: inner.y + inner.h - bh, w: inner.w, h: bh }; button(ctx, br, 'Enter the market', { kind: 'primary', size: 32 }); ui.hits.push({ id: 'arrContinue', r: br });
}

// ---- Map screen -----------------------------------------------------------------------------------------------------------------------------------------------
export function renderMap(ctx, st, L, t) {
  const S = st.S, D = L.doc, k = TEXT_SCALES[st.prefs.textIdx] ?? 1; ui.hits = [];
  ctx.fillStyle = '#1a110b'; ctx.fillRect(0, 0, L.w, L.h);
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 }); ui.hits.push({ id: 'back', r: D.back });
  txt(ctx, 'The route', L.w / 2, D.titleY, 38, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6 });
  const vp = D.viewportFull, wide = L.mode === 'wide';
  const mh = wide ? vp.h : Math.min(vp.h * 0.64, vp.w * 1.12), mapR = { x: vp.x, y: vp.y, w: wide ? Math.min(vp.w, vp.h * 1.7) : vp.w, h: mh };
  const pts = drawMap(ctx, mapR, S, t);
  // itinerary
  const list = wide ? { x: mapR.x + mapR.w + 14, y: vp.y, w: vp.x + vp.w - (mapR.x + mapR.w + 14), h: vp.h } : { x: vp.x, y: mapR.y + mapR.h + 14, w: vp.w, h: vp.y + vp.h - (mapR.y + mapR.h + 14) };
  if (list.h > 80 && list.w > 200) {
    panel(ctx, list, { fill: 'rgba(18,11,7,0.8)' });
    const c = column(ctx, st, { x: list.x + 10, y: list.y + 8, w: list.w - 20, h: list.h - 16 }, 'map'); const kf = Math.min(k, 1.4);
    if (S) {
      txt(ctx, `Day ${S.day} of ${LIMIT_DAYS}. ${S.trip ? 'On the road to ' + CITIES[S.trip.to].short : 'In ' + CITIES[S.city].short}.`, c.x + 8, c.y + 24, 26 * kf, PAL.text, { weight: 700, maxW: c.w - 16 }); c.y += 52 * kf;
      CITIES.forEach((C) => { const seen = S.j.cities.includes(C.id); const e = S.ledger[C.id]; txt(ctx, `${C.id + 1}. ${C.short}${seen ? '' : '  (not yet)'}`, c.x + 8, c.y + 18, 25 * kf, seen ? PAL.gold : PAL.dim, { weight: 700, maxW: c.w * 0.55 }); if (seen && e) txt(ctx, `silk ${e.silk?.sell ?? '-'}  spice ${e.spice?.sell ?? '-'}`, c.x + c.w - 8, c.y + 18, 21 * kf, PAL.dim, { align: 'right', weight: 600, maxW: c.w * 0.42 }); c.y += 40 * kf; });
    } else txt(ctx, 'No journey in progress.', c.x + 8, c.y + 24, 26, PAL.dim);
    c.end();
  }
}

// ---- Result ----------------------------------------------------------------------------------------------------------------------------------------------------
export function renderResult(ctx, st, L, t) {
  const S = st.S, R = st.result, G = L.split('city'), P = G.panel, k = TEXT_SCALES[st.prefs.textIdx] ?? 1; ui.hits = [];
  const C = CITIES[S.city];
  paintScene(ctx, G.art, { biome: C.biome, time: 'dusk', city: C.skyline, caravan: { n: Math.min(5, S.camels), dir: -1, still: true, x: 0.5, loads: [['silk']], kind: C.camel }, seed: 3 + C.id }, t);
  txt(ctx, R.reason === 'stranded' ? 'The caravan could go no further' : R.reason === 'snow' ? 'Snow closes the passes' : `Settled in ${C.short}`, G.art.x + G.art.w / 2, G.art.h - (L.mode === 'wide' ? 90 : 70), L.mode === 'wide' ? 40 : 34, '#fff3d6', { align: 'center', font: DISPLAY, weight: 800, stroke: 9, strokeColor: 'rgba(30,14,6,0.8)', maxW: G.art.w - 40 });
  panel(ctx, P);
  const pad = 18, inner = { x: P.x + pad, y: P.y + 14 + st.lessonH, w: P.w - pad * 2, h: P.h - 28 - st.lessonH }, bh = Math.max(78, L.mb + 8);
  const area = { x: inner.x, y: inner.y, w: inner.w, h: inner.h - bh * 2 - 22 };
  const c = column(ctx, st, area, 'result'); c.st = st; const w = area.w - (st.pmax > 0 ? 12 : 0), kf = Math.min(k, 1.5);
  txt(ctx, R.rank, c.x + w / 2, c.y + 40 * kf, 46 * kf, PAL.gold, { align: 'center', font: DISPLAY, weight: 900, stroke: 8, maxW: w }); c.y += 84 * kf;
  txt(ctx, `${money(R.total)} points`, c.x + w / 2, c.y + 14, 34 * kf, PAL.text, { align: 'center', weight: 800 }); c.y += 52 * kf;
  if (R.newBest) { txt(ctx, 'A new best score!', c.x + w / 2, c.y + 4, 25 * kf, PAL.ok, { align: 'center', weight: 800 }); c.y += 40 * kf; } else if (st.best.score) { txt(ctx, `Best: ${money(st.best.score)}`, c.x + w / 2, c.y + 4, 23 * kf, PAL.dim, { align: 'center', weight: 600 }); c.y += 38 * kf; }
  const names = { silver: 'Silver', goods: 'Goods', camels: 'Camels', cities: 'Cities reached', rep: 'Reputation', customs: 'Customs', tongues: 'Languages', journal: 'Journal entries' };
  for (const [key, v] of Object.entries(R.parts)) { txt(ctx, names[key], c.x + 10, c.y + 22 * kf, 25 * kf, PAL.text, { weight: 600 }); txt(ctx, money(v), c.x + w - 10, c.y + 22 * kf, 25 * kf, PAL.gold, { align: 'right', weight: 800 }); ctx.fillStyle = 'rgba(255,240,215,0.07)'; ctx.fillRect(c.x + 6, c.y + 44 * kf, w - 12, 1); c.y += 48 * kf; }
  c.y += 14;
  const rv = S.rival;
  const rl = rv.met === 0 ? 'You never crossed paths with the rival trader Vakhushu.' : rv.mood >= 3 ? 'Vakhushu became a friend: you shared a table and the road.' : rv.mood <= -2 ? 'Vakhushu still tells people you were a hard bargain.' : 'Vakhushu remembers you as a fair rival.';
  ctx.font = `500 ${25 * k}px ${UI}`; ctx.fillStyle = PAL.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; wrap(ctx, rl + `  Vakhushu is thought to have made about ${money(R.rivalNet)}.`, w - 8).forEach((ln) => { ctx.fillText(ln, c.x + 4, c.y); c.y += 25 * k * 1.42; }); c.y += 10;
  c.end();
  const b1 = { x: inner.x, y: inner.y + inner.h - bh * 2 - 10, w: inner.w, h: bh }, b2 = { x: inner.x, y: inner.y + inner.h - bh, w: (inner.w - 10) / 2, h: bh }, b3 = { x: inner.x + (inner.w - 10) / 2 + 10, y: b2.y, w: (inner.w - 10) / 2, h: bh };
  button(ctx, b1, 'New journey', { kind: 'primary', size: 31 }); button(ctx, b2, 'Journal', { kind: 'quiet', size: 26 }); button(ctx, b3, 'Main menu', { kind: 'quiet', size: 26 });
  ui.hits.push({ id: 'resNew', r: b1 }, { id: 'resJournal', r: b2 }, { id: 'resMenu', r: b3 });
}

// ---- Title -----------------------------------------------------------------------------------------------------------------------------------------------------
export function renderTitle(ctx, st, L, t, items) {
  const T = L.title; ui.hits = [];
  const wide = L.mode === 'wide', tall = L.mode === 'tall';
  const cxScene = wide ? (T.title.x + T.title.w / 2) / L.w : 0.5;
  paintScene(ctx, { x: 0, y: 0, w: L.w, h: L.h }, { biome: 'dunes', time: 'dusk', scroll: t * 14, horizon: wide ? 0.46 : 0.22, road: wide ? 0.86 : 0.43, seed: 5, caravan: { n: 5, dir: -1, x: cxScene, kind: 'bactrian', loads: [['silk', 'jade'], ['paper'], ['spice', 'glass'], ['silk']] }, zoom: wide ? 0.8 : 0.58, city: null }, t);
  // a dark foot under the menu so the buttons read on any painting
  const my = Math.min(...T.buttons.map((b) => b.y)) - 40;
  if (!wide) { const g = ctx.createLinearGradient(0, my - 10, 0, my + 70); g.addColorStop(0, 'rgba(14,8,4,0)'); g.addColorStop(1, 'rgba(14,8,4,0.92)'); ctx.fillStyle = g; ctx.fillRect(0, my - 10, L.w, L.h - my + 10); }
  else { const g = ctx.createLinearGradient(L.w * 0.5, 0, L.w, 0); g.addColorStop(0, 'rgba(14,8,4,0)'); g.addColorStop(0.35, 'rgba(14,8,4,0.72)'); g.addColorStop(1, 'rgba(14,8,4,0.9)'); ctx.fillStyle = g; ctx.fillRect(L.w * 0.5, 0, L.w * 0.5, L.h); }
  const tc = T.title, cx = tc.x + tc.w / 2;
  const big = Math.min(tc.w / 6.0, wide ? 92 : 104), ty = tc.y + Math.min(tc.h * 0.45, big * 1.4);
  ctx.save(); ctx.font = `900 ${big}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ['SILK ROAD', 'TRADER'].forEach((ln, i) => { const y = ty + (i - 0.5) * big * 1.08; ctx.lineWidth = big * 0.18; ctx.strokeStyle = 'rgba(30,12,4,0.9)'; ctx.strokeText(ln, cx, y); const g = ctx.createLinearGradient(0, y - big * 0.5, 0, y + big * 0.5); g.addColorStop(0, '#fff3c4'); g.addColorStop(0.5, '#f2c04c'); g.addColorStop(1, '#b8731c'); ctx.fillStyle = g; ctx.fillText(ln, cx, y); });
  ctx.restore();
  txt(ctx, "A caravan journey from Chang'an to Baghdad", cx, ty + big * 1.3, Math.min(32, tc.w / 15), '#fff0d0', { align: 'center', weight: 600, stroke: 6, strokeColor: 'rgba(30,12,4,0.85)', maxW: tc.w });
  items.forEach((it, i) => { const r = T.buttons[i]; button(ctx, r, it.label, { kind: it.kind === 'primary' ? 'primary' : 'menu', size: 30, sub: it.sub, icon: it.icon }); ui.hits.push({ id: 'menu:' + it.id, r }); });
  const cr = T.credit;
  if (!drawLockup(ctx, cr, 0.95)) drawCredit(ctx, cr.x + cr.w / 2, cr.y + cr.h * 0.6, Math.min(22, cr.w / 14));
  ui.hits.push({ id: 'credit', r: { x: cr.x - 10, y: cr.y - 10, w: cr.w + 20, h: cr.h + 20 } });
}

export function renderDemoLimit(ctx, st, L, t) {
  ui.hits = [];
  paintScene(ctx, { x: 0, y: 0, w: L.w, h: L.h }, { biome: 'dunes', time: 'dusk', caravan: { n: 4, dir: -1, x: 0.5, still: true, loads: [['silk']] }, zoom: 0.8 }, t);
  ctx.fillStyle = 'rgba(14,8,4,0.6)'; ctx.fillRect(0, 0, L.w, L.h);
  const S = L.S, w = Math.min(S.w - 40, 620), r = { x: S.x + (S.w - w) / 2, y: S.y + S.h * 0.22, w, h: 420 }; panel(ctx, r, { fill: 'rgba(24,16,11,0.95)' });
  txt(ctx, 'The road goes on', r.x + r.w / 2, r.y + 62, 42, PAL.gold, { align: 'center', font: DISPLAY, weight: 800, maxW: r.w - 40 });
  ctx.font = `500 27px ${UI}`; ctx.fillStyle = PAL.text; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; wrap(ctx, 'This web demo covers the first two legs, Chang\'an to Dunhuang. Get the full game on iPhone and Android to cross the whole road to Baghdad and back.', r.w - 60).forEach((ln, i) => ctx.fillText(ln, r.x + r.w / 2, r.y + 118 + i * 38));
  const b = { x: r.x + 40, y: r.y + r.h - 110, w: r.w - 80, h: 76 }; button(ctx, b, 'Back to the menu', { kind: 'primary', size: 29 }); ui.hits.push({ id: 'demoBack', r: b });
}
