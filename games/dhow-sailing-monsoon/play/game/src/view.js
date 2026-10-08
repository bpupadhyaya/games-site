// All drawing for screens. Reads `state`; the only thing it writes is state._ui (hit rectangles for the update step), which is non-enumerable
// so it never enters getState().
import { DEG, clamp, lerp, smooth, wrap360, MONTHS } from './core.js';
import { PAL, FONT, SANS, rr, textFill, wrapLines, glow, drawParticles } from './art.js';
import { TEXT_SCALES, drawButton, drawPill, panel, layoutColumn, drawColumn, maxScroll, scrollbar, inRect } from './ui.js';
import { LY, host } from './layout.js';
import { drawLockup, edgeStroke, drawMoreLine } from './brand.js';
import { ABOUT, HOWTO, RULES, CREDITS_FALLBACK } from './content.js';
import { LEVELS, SEASONS, PORTS, PORT_IDX, GOODS, LEGS, legById, legFavour, LORE, CREW_ROLES, portById } from './data.js';
import * as E from './economy.js';
import { KN, polar, POLAR, idealAngle, sheetAngle, COAST_HALF, SIGHT_R } from './sim.js';
import { drawSea2d } from './scene2d.js';
import { drawHud, drawChart, drawDial, drawSheet, drawSailStatus, drawActions, drawDecision, drawSight, fitFont, bar } from './hud.js';

const hidden = (o, k, v) => { Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true }); };
function setUi(state, ui) { if (!('_ui' in state)) hidden(state, '_ui', ui); else state._ui = ui; }
export const scaleOf = (state) => TEXT_SCALES[clamp(state.prefs.textIdx, 0, TEXT_SCALES.length - 1)];
const txt = (n) => Math.max(n, LY.minText);
const gradTitle = [[0, '#fff6cf'], [0.6, '#ffd05c'], [1, '#f0a02a']];

const live3d = (state) => !!(state.env && state.env.view3d && state.env.view3d.active);
const TEXT_SCENES = ['howto', 'rules', 'about', 'settings', 'logbook'];
export const wants3d = (state) => !TEXT_SCENES.includes(state.scene);

// ---- backgrounds ---------------------------------------------------------------------------------------------------------------------------------
export function drawMenuBackdrop(ctx, state) {
  const VW = LY.w, VH = LY.h, sc = state.scene, text = TEXT_SCENES.includes(sc);
  const dim = sc === 'title' ? 0.1 : text ? 1 : 0.55;
  if (!text && live3d(state)) ctx.clearRect(0, 0, VW, VH);
  else { ctx.fillStyle = '#06202f'; ctx.fillRect(0, 0, VW, VH); if (!text) drawSea2d(ctx, VW, VH, { t: state.t, tod: 0.32 + state.t * 0.003, wind: 7, ship: { heel: 4, eff: 0.9, flap: 0 } }); }
  if (text) { const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#0a2f45'); g.addColorStop(0.55, '#0a2a3f'); g.addColorStop(1, '#06202f'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH); ctx.save(); ctx.globalAlpha = 0.07; ctx.strokeStyle = '#9fe8e8'; ctx.lineWidth = 2; for (let i = 0; i < 12; i++) { ctx.beginPath(); for (let x = 0; x <= VW; x += 24) { const y = VH * (0.1 + i * 0.075) + Math.sin(x * 0.02 + i) * 8; if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); } ctx.restore(); }
  else { const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, `rgba(4,22,36,${0.5 * dim + 0.1})`); g.addColorStop(1, `rgba(3,16,28,${0.78 * dim + 0.08})`); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH); }
}

function drawHero(ctx, w, h, state) {
  const cx = w / 2, th = Math.max(60, h - 34), t = state.t;
  let s1 = Math.min(w * 0.19, th * 0.33), s2 = Math.min(w * 0.12, th * 0.2);
  ctx.font = `700 ${s1}px ${FONT}`; const mw = ctx.measureText('DHOW').width; if (mw > w - 20) { const k = (w - 20) / mw; s1 *= k; s2 *= k; }
  const base = Math.max(th * 0.3, s1 * 1.0);
  textFill(ctx, 'DHOW', cx, base, s1, { grad: [[0, '#fff6cf'], [0.55, '#ffd05c'], [1, '#e8861e']], stroke: 'rgba(4,24,40,0.75)' });
  textFill(ctx, 'SAILING', cx, base + s2 * 1.1, s2, { grad: [[0, '#e0fbf6'], [0.6, '#63e0cc'], [1, '#1fa595']], stroke: 'rgba(0,36,36,0.75)' });
  const sub = 'THE MONSOON TRADE', ss = Math.max(txt(20), s2 * 0.34);
  ctx.save(); ctx.font = `700 ${ss}px ${SANS}`; ctx.fillStyle = 'rgba(255,243,218,0.92)'; ctx.textAlign = 'center';
  const tracked = [...sub].join(' '); ctx.fillText(tracked, cx, base + s2 * 1.1 + ss * 1.9); ctx.restore();
  const tag = 'Ride the monsoon. Trim the lateen. Steer by the stars.';
  ctx.fillStyle = 'rgba(255,248,232,0.93)'; ctx.textAlign = 'center'; fitFont(ctx, tag, Math.min(24, w * 0.036) * Math.min(scaleOf(state), 2.2), w - 40, 600, SANS, LY.minText);
  ctx.fillText(tag, cx, h - 12);
  void t;
}

function zoomPills(ctx, state) {
  const s = state.prefs.textIdx, z = LY.zoom;
  drawPill(ctx, z.dec, 'A−', { disabled: s === 0 });
  drawPill(ctx, z.inc, 'A+', { disabled: s === TEXT_SCALES.length - 1 });
  ctx.font = `600 ${Math.max(22, LY.minText)}px ${SANS}`; ctx.fillStyle = 'rgba(235,250,250,0.88)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(TEXT_SCALES[s] * 100)}%`, z.label.x, z.label.y);
}

function columnScreen(ctx, state, spec) {
  const s = scaleOf(state);
  drawMenuBackdrop(ctx, state);
  zoomPills(ctx, state);
  const col = spec.col ?? LY.col;
  if (spec.hero) { ctx.save(); ctx.translate(spec.hero.x, spec.hero.y); drawHero(ctx, spec.hero.w, spec.hero.h, state); ctx.restore(); }
  const fy = footerLayout(ctx, spec.footer ?? [], s, col);
  const lk = spec.lockup ? lockupBox(col) : null;
  const top = col.top, bottom = fy.top - 10 - (lk ? lk.h + 24 : 0);
  const view = { x: col.x, y: top, w: col.w, h: Math.max(80, bottom - top) };
  const gutter = 26, contentW = view.w - gutter;
  const lay = layoutColumn(ctx, spec.items, contentW, s, { cols: spec.cols ?? 1 });
  const maxS = maxScroll(lay, view.h);
  const sc = clamp(state.ui.scroll, 0, maxS);
  state.ui.scroll = sc;
  const hits = drawColumn(ctx, lay, { x: view.x, y: view.y, w: contentW, h: view.h }, sc, s, state, null);
  const bar2 = { x: view.x + view.w - 14, y: view.y, w: 10, h: view.h };
  const thumb = scrollbar(ctx, bar2, sc, lay.total, view.h);
  for (const b of fy.buttons) drawButton(ctx, b.rect, b.label, { primary: b.primary, disabled: b.disabled, size: b.size, sub: b.sub, active: b.active });
  let lockTap = null;
  if (lk) {
    const ly = Math.min(view.y + Math.min(lay.total, view.h) + 12, bottom + 10);
    const lx = col.x + col.w / 2, m = 44 / Math.max(0.2, host.px || 0.54);
    ctx.save(); ctx.fillStyle = state.lockDown > state.t ? 'rgba(255,226,122,0.5)' : 'rgba(4,22,36,0.6)'; rr(ctx, lx - lk.w / 2 - 12, ly - 6, lk.w + 24, lk.h + 12, (lk.h + 12) / 2); ctx.fill(); ctx.restore();
    drawLockup(ctx, lx, ly, lk.w, 1);
    const tw = Math.max(lk.w + 24, m), th = Math.max(lk.h + 12, m);
    lockTap = { x: lx - tw / 2, y: ly + lk.h + 6 - th, w: tw, h: th };
  }
  setUi(state, { lockTap, hits, footer: fy.buttons.filter((b) => !b.disabled).map((b) => ({ id: b.id, rect: b.rect })), view, lay, maxS, bar: bar2, thumb });
}
function lockupBox(col) { const w = clamp(col.w * 0.5, 240, LY.land || LY.h < 1200 ? 260 : 340); return { w, h: Math.round(w * 327 / 1200) }; }
function footerLayout(ctx, btns, s, col) {
  if (!btns.length) return { top: col.bottom + 6, buttons: [] };
  const gapx = 14, fx = col.x - 10, fw = col.w + 20;
  const stack = s >= 2 && btns.length > 1 && !LY.land;
  const size = 30 * (LY.land ? Math.min(s, 1.5) : Math.min(s, 2.2));
  const out = []; let top;
  ctx.font = `700 ${size}px ${FONT}`;
  if (stack) {
    const hs = btns.map((b) => Math.max(88, wrapLines(ctx, b.label, fw - 28).length * size * 1.2 + 44));
    const total = hs.reduce((a, b) => a + b + gapx, 0); top = col.bottom - total + gapx; let y = top;
    btns.forEach((b, i) => { out.push({ ...b, size, rect: { x: fx, y, w: fw, h: hs[i] } }); y += hs[i] + gapx; });
  } else {
    const n = btns.length, bw = (fw - gapx * (n - 1)) / n;
    const hs = btns.map((b) => Math.max(92, wrapLines(ctx, b.label, bw - 28).length * size * 1.2 + 44)); const hh = Math.max(...hs); top = col.bottom - hh;
    btns.forEach((b, i) => out.push({ ...b, size, rect: { x: fx + i * (bw + gapx), y: top, w: bw, h: hh } }));
  }
  return { top, buttons: out };
}
const readerCol = () => (LY.land ? { x: LY.readerX, w: LY.readerW, top: LY.col.top, bottom: LY.col.bottom } : LY.col);

// ---- scene specs ------------------------------------------------------------------------------------------------------------------------------------
const favourText = { fair: 'Fair wind', mixed: 'Wind across', foul: 'Against the wind', light: 'Light, shifting wind' };
const nm = (id) => portById(id).name;
export function legLabel(l) { return `${nm(l.from)} to ${nm(l.to)}`; }
export function sceneSpec(state) {
  const s = scaleOf(state), pf = state.prefs, demo = state.env.config.demo, camp = state.camp;
  switch (state.scene) {
    case 'title': {
      const tight = !LY.land && LY.h < 1200 && s < 2, hf = {};
      let bh = LY.land ? 66 : LY.h < 1200 ? 60 : 84, heroH = s >= 2 ? 340 : tight ? 250 : LY.title.heroH;
      if (!LY.land && s < 2) {
        const c = LY.title.col, avail = c.bottom - c.top - lockupBox(c).h - 40;
        const need = (hh, fs) => hh + 4 * Math.max(bh, fs * 1.18 + 36) + 2 * Math.max(bh, fs * 1.18 + fs * 0.62 * 1.25 + 44) + 6 * 14;
        let fs = 31; if (need(heroH, fs) > avail) fs = 26;
        const ex = need(heroH, fs) - avail; if (ex > 0) heroH = Math.max(140, heroH - ex);
        if (fs < 31) hf.size = fs;
      }
      const items = [];
      if (!LY.land) items.push({ t: 'fig', h: Math.round(heroH), draw: (ctx, w, h) => drawHero(ctx, w, h, state) });
      items.push(
        { t: 'btn', id: 'play', label: 'Play', sub: 'Career, passage, daily passage', primary: true, h: bh, ...hf },
        { t: 'btn', id: 'auto', label: 'Auto Play', sub: 'Watch the computer sail and learn', h: bh, ...hf },
        { t: 'btn', id: 'howto', label: 'How to Play', h: bh, ...hf },
        { t: 'btn', id: 'rules', label: 'Rules', h: bh, ...hf },
        { t: 'btn', id: 'about', label: 'About', h: bh, ...hf },
        { t: 'btn', id: 'settings', label: 'Settings', h: bh, ...hf });
      return { lockup: true, items, footer: [], col: LY.title.col, hero: LY.land ? LY.title.hero : null };
    }
    case 'modes': {
      const rec = state.records;
      const cs = camp ? `${nm(camp.port)}, ${E.dateText(camp)}, ${E.rankOf(camp)}` : 'Start in Kilwa with a small dhow and 320 coins';
      const items = [
        { t: 'title', text: 'Choose your sailing', size: 40 },
        { t: 'card', id: 'mode:career', title: demo ? 'Career (app only)' : camp ? 'Continue Career' : 'Career', text: demo ? 'Trade across the ocean season after season.' : cs, tag: camp ? `${Math.round(camp.coins)} coins  |  reputation ${Math.round(camp.rep)}` : 'Become a Master Nakhoda', accent: PAL.gold },
        { t: 'card', id: 'mode:passage', title: 'Passage', text: 'Sail one leg of your choice in a season you choose. Earn up to three stars.', tag: `Passages sailed ${rec.passages ?? 0}  |  best ${rec.bestStars ?? 0} stars`, accent: PAL.teal },
        { t: 'card', id: 'mode:daily', title: demo ? 'Daily Passage (app only)' : 'Daily Passage', text: 'The same leg, wind and weather for everyone, today.', tag: rec.dailyDay === state.env.config.day ? `Today: ${rec.dailyStars ?? 0} stars` : 'Not sailed today', accent: PAL.coral },
      ];
      if (camp && !demo) items.push({ t: 'btn', id: 'newcareer', label: 'Start a new Career', h: 70, size: 26 });
      return { items, footer: [{ id: 'back', label: 'Back' }], cols: 1, col: readerCol() };
    }
    case 'setup': {
      const su = state.setup, leg = legById(su.legId), fav = legFavour(leg, su.season);
      const items = [{ t: 'title', text: 'Passage', size: 40, sub: 'Choose a leg, a season and how hard the sea should be.' }];
      items.push({ t: 'chips', id: 'leg', label: 'Leg', value: su.base, options: LEGS.filter((l, i) => i % 2 === 0).map((l) => ({ v: l.id, label: legLabel(l), disabled: demo && l.id !== 'mombasa>aden' && l.id !== 'kilwa>mombasa' })) });
      items.push({ t: 'chips', id: 'dir', label: 'Direction', value: su.rev ? 1 : 0, options: [{ v: 0, label: 'Out' }, { v: 1, label: 'Back', disabled: demo }] });
      items.push({ t: 'chips', id: 'season', label: 'Season', value: su.season, options: ['kusi', 'kaskazi', 'between'].map((k) => ({ v: k, label: SEASONS[k].short, disabled: demo && k !== 'kusi' })) });
      items.push({ t: 'para', text: `${legLabel(leg)}: ${leg.nm} nautical miles, about ${leg.days} days at sea. ${favourText[fav.rating]} in the ${SEASONS[su.season].short.toLowerCase()}. ${fav.rating === 'foul' ? 'You will have to tack against the monsoon.' : fav.rating === 'light' ? 'Calms and squalls are likely.' : ''}`, color: PAL.peach });
      items.push({ t: 'chips', id: 'level', label: 'Difficulty', value: su.level, options: LEVELS.map((l, i) => ({ v: i, label: l.name, disabled: demo && i === 2 })) });
      items.push({ t: 'para', text: LEVELS[su.level].blurb });
      return { items, footer: [{ id: 'back', label: 'Back' }, { id: 'start', label: 'Set sail', primary: true }], col: readerCol() };
    }
    case 'port': {
      const p = portById(camp.port), season = E.seasonNow(camp), S = SEASONS[season];
      const items = [
        { t: 'title', text: p.name, size: 44, sub: `${p.region}. ${p.blurb}` },
        { t: 'stat', label: 'Date', value: E.dateText(camp), wide: true },
        { t: 'stat', label: 'Season', value: S.name, wide: true },
        { t: 'para', text: S.blurb, color: PAL.peach },
        { t: 'stat', label: 'Coins', value: String(Math.round(camp.coins)), color: PAL.gold, wide: true },
        { t: 'stat', label: 'Reputation', value: `${Math.round(camp.rep)}  (${E.rankOf(camp)})`, wide: true },
        { t: 'stat', label: 'Cargo', value: `${E.cargoUnits(camp)} of ${E.holdMax(camp)}`, wide: true },
        { t: 'stat', label: 'Hull and sail', value: `${Math.round(camp.hull)} and ${Math.round(camp.sail)}`, wide: true },
        { t: 'stat', label: 'Water barrels', value: String(Math.round(camp.barrels * 10) / 10), wide: true },
        { t: 'stat', label: 'Crew', value: `${camp.crew.sailors} sailors${camp.crew.navigator ? ', navigator' : ''}${camp.crew.sailmaker ? ', sailmaker' : ''}`, wide: true },
        { t: 'gap', h: 6 },
        { t: 'btn', id: 'p:market', label: 'Market', sub: 'Buy and sell cargo', h: 78, size: 30 },
        { t: 'btn', id: 'p:yard', label: 'Shipyard and water', sub: 'Repairs, barrels, hold', h: 78, size: 30 },
        { t: 'btn', id: 'p:crew', label: 'Crew', sub: 'Hire a navigator, sailors', h: 78, size: 30 },
        { t: 'btn', id: 'p:talk', label: 'Harbour talk', sub: camp.talkKey === `${camp.port}:${camp.day}` ? 'Already talked here today' : 'Answer a question, earn a lore card', h: 78, size: 30 },
        { t: 'btn', id: 'p:log', label: 'Logbook and lore', h: 78, size: 30 },
        { t: 'btn', id: 'p:sail', label: 'Set sail', sub: 'Choose where to', primary: true, h: 88, size: 34 },
      ];
      return { items, footer: [{ id: 'back', label: 'Menu' }], col: readerCol() };
    }
    case 'market': {
      const items = [{ t: 'title', text: `${nm(camp.port)} market`, size: 40, sub: `${Math.round(camp.coins)} coins    hold ${E.cargoUnits(camp)} of ${E.holdMax(camp)}` }];
      items.push({ t: 'chips', id: 'lot', label: 'Lot size', value: state.ui.lot, options: [{ v: 1, label: '1' }, { v: 5, label: '5' }, { v: 10, label: '10' }] });
      for (const g of GOODS) {
        const b = E.buyPrice(camp, camp.port, g.id), sl = E.sellPrice(camp, camp.port, g.id), have = camp.cargo[g.id];
        const tr = b < g.base * 0.85 ? 'cheap here' : sl > g.base * 1.15 ? 'dear here' : '';
        const qb = E.quoteBuy(camp, g.id, state.ui.lot), qs = E.quoteSell(camp, g.id, state.ui.lot);
        items.push({ t: 'trade', good: g.id, name: g.name, info: `Pay ${b} each, sell for ${sl} each. In hold: ${have}${have ? ` (bought at ${Math.round(camp.cost[g.id])})` : ''}${tr ? `. ${tr[0].toUpperCase()}${tr.slice(1)}` : ''}`, buyLabel: qb.n ? `Buy ${qb.n} for ${qb.total}` : `Buy ${state.ui.lot}`, sellLabel: qs.n ? `Sell ${qs.n} for ${qs.total}` : `Sell ${state.ui.lot}`, canBuy: qb.n > 0, canSell: have > 0 });
      }
      return { items, footer: [{ id: 'back', label: 'Back to harbour', primary: true }], col: readerCol() };
    }
    case 'yard': {
      const items = [{ t: 'title', text: 'Shipyard and water', size: 40, sub: `${Math.round(camp.coins)} coins` }];
      const hc = Math.ceil((100 - camp.hull) * E.HULL_PRICE), sc = Math.ceil((100 - camp.sail) * E.SAIL_PRICE);
      items.push({ t: 'stat', label: 'Hull', value: `${Math.round(camp.hull)} of 100`, wide: true }, { t: 'btn', id: 'y:hull', label: hc ? `Repair hull (${hc} coins)` : 'Hull is sound', disabled: !hc || camp.coins < 1, h: 74, size: 28 });
      items.push({ t: 'stat', label: 'Sail', value: `${Math.round(camp.sail)} of 100`, wide: true }, { t: 'btn', id: 'y:sail', label: sc ? `Mend sail (${sc} coins)` : 'Sail is sound', disabled: !sc || camp.coins < 1, h: 74, size: 28 });
      items.push({ t: 'stat', label: 'Water barrels', value: `${Math.round(camp.barrels * 10) / 10} of 6`, wide: true }, { t: 'btn', id: 'y:water', label: camp.barrels >= 6 ? 'Barrels full' : `Fill a barrel (${E.WATER_PRICE} coins)`, disabled: camp.barrels >= 6 || camp.coins < E.WATER_PRICE, h: 74, size: 28 }, { t: 'btn', id: 'y:waterall', label: 'Fill all barrels', disabled: camp.barrels >= 6 || camp.coins < E.WATER_PRICE, h: 74, size: 28 });
      items.push({ t: 'para', text: 'Each barrel is a fifth of a tank. A tank lasts three times the par time of a passage with three sailors.' });
      items.push({ t: 'stat', label: 'Hold size', value: `${E.holdMax(camp)} units`, wide: true }, { t: 'btn', id: 'y:hold', label: camp.hold >= 2 ? 'Hold fully enlarged' : `Enlarge hold to ${E.HOLD_STEPS[camp.hold + 1]} (${E.HOLD_COST[camp.hold + 1]} coins)`, disabled: camp.hold >= 2 || camp.coins < E.HOLD_COST[camp.hold + 1], h: 74, size: 28 });
      return { items, footer: [{ id: 'back', label: 'Back to harbour', primary: true }], col: readerCol() };
    }
    case 'crew': {
      const items = [{ t: 'title', text: 'Crew', size: 40, sub: `${Math.round(camp.coins)} coins    wages ${E.dailyWage(camp).toFixed(1)} a day    morale ${Math.round(camp.morale)}` }];
      const roles = [['sailors', 'Sailors', 'Dip the yard faster and pull the sweeps.'], ['navigator', 'Navigator', 'A steadier star sight and a smaller circle of doubt.'], ['sailmaker', 'Sailmaker', 'The sail strains and splits less.']];
      for (const [k, name, blurb] of roles) {
        items.push({ t: 'card', id: `c:${k}`, title: `${name}: ${camp.crew[k]} of ${E.CREW_MAX[k]}`, text: `${blurb} Hire ${E.HIRE[k]} coins, wage ${E.WAGE[k]} a day.`, accent: PAL.teal });
        items.push({ t: 'btn', id: `hire:${k}`, label: `Hire ${name.toLowerCase()} (${E.HIRE[k]})`, disabled: camp.crew[k] >= E.CREW_MAX[k] || camp.coins < E.HIRE[k], h: 70, size: 26 }, { t: 'btn', id: `fire:${k}`, label: `Pay off one ${name.toLowerCase().replace(/s$/, '')}`, disabled: camp.crew[k] <= (k === 'sailors' ? 1 : 0), h: 70, size: 26 });
      }
      return { items, footer: [{ id: 'back', label: 'Back to harbour', primary: true }], col: readerCol() };
    }
    case 'talk': {
      const q = state.talk.q, picked = state.talk.picked;
      const items = [{ t: 'title', text: 'Harbour talk', size: 40, sub: 'An old pilot asks you a question.' }, { t: 'para', text: q.q, size: 31 }];
      q.a.forEach((a, i) => items.push({ t: 'btn', id: `ans:${i}`, label: a, disabled: picked != null, active: picked != null && i === q.c, danger: picked === i && i !== q.c, h: 78, size: 27 }));
      if (picked != null) { items.push({ t: 'para', text: picked === q.c ? 'Right! You earn 4 coins and a card for your logbook.' : 'Not quite, but you learn something.', color: PAL.peach }); const l = LORE.find((x) => x.id === q.lore); if (l) items.push({ t: 'card', title: l.title, text: l.text, accent: PAL.gold }); }
      return { items, footer: [{ id: 'back', label: picked != null ? 'Back to harbour' : 'Leave', primary: picked != null }], col: readerCol() };
    }
    case 'logbook': {
      const items = [{ t: 'title', text: 'Logbook', size: 42, sub: `${E.rankOf(camp)}, ${E.dateText(camp)}` }];
      const st = camp.stats;
      items.push({ t: 'stat', label: 'Voyages sailed', value: String(st.voyages), wide: true }, { t: 'stat', label: 'Arrivals', value: String(st.delivered), wide: true }, { t: 'stat', label: 'Star sights', value: String(st.sights), wide: true }, { t: 'stat', label: 'Wrecks', value: String(st.wrecks), wide: true }, { t: 'stat', label: 'Goal', value: `${Math.round(camp.coins)} of ${E.GOAL_COINS} coins, reputation ${Math.round(camp.rep)} of ${E.GOAL_REP}${camp.finished ? '  (done!)' : ''}`, wide: true });
      items.push({ t: 'h', text: 'Entries' });
      for (const e of [...camp.log].reverse().slice(0, 24)) items.push({ t: 'para', text: `Day ${e.day}: ${e.text}`, size: 25 });
      items.push({ t: 'h', text: `Lore (${camp.lore.length} of ${LORE.length})` });
      for (const id of camp.lore) { const l = LORE.find((x) => x.id === id); if (l) items.push({ t: 'card', title: l.title, text: l.text, accent: PAL.teal }); }
      return { items, footer: [{ id: 'back', label: 'Back to harbour', primary: true }], col: readerCol() };
    }
    case 'voyage': {
      const season = E.seasonNow(camp), items = [{ t: 'title', text: 'Where to?', size: 42, sub: `${nm(camp.port)} in the ${SEASONS[season].short.toLowerCase()}, ${E.dateText(camp)}` }];
      if (state.notice) items.push({ t: 'para', text: state.notice, color: '#ff9a8a' });
      const wd = E.dailyWage(camp);
      for (const l of E.legsOpen(camp)) {
        const fav = legFavour(l, season), low = camp.barrels < 2;
        items.push({ t: 'card', id: `go:${l.id}`, title: `To ${nm(l.to)}`, text: `${l.nm} nautical miles, about ${l.days} days. ${favourText[fav.rating]}.${fav.rating === 'foul' ? ' You will tack against the monsoon; better to wait.' : ''}${low ? ' Water is low!' : ''}`, tag: `wages ~${Math.round(wd * l.days)} coins`, accent: fav.rating === 'fair' ? PAL.teal : fav.rating === 'foul' ? PAL.coral : PAL.gold });
      }
      items.push({ t: 'btn', id: 'wait', label: 'Wait a week in port', sub: `costs ${Math.round(wd * 7)} coins in wages`, h: 80, size: 27 });
      return { items, footer: [{ id: 'back', label: 'Back to harbour' }], col: readerCol() };
    }
    case 'settings': {
      const items = [
        { t: 'title', text: 'Settings', size: 42 },
        { t: 'row', id: 'set:sound', label: 'Sound', value: pf.sound ? 'On' : 'Off' },
        { t: 'row', id: 'set:level', label: 'Difficulty for Career and Daily', value: LEVELS[pf.level].name },
        { t: 'row', id: 'set:think', label: 'Auto Play thinking time', value: `${[2, 5, 8, 10][pf.thinkIdx]} s` },
        { t: 'row', id: 'set:cam', label: 'Camera', value: ['Chase', 'Side', 'Bow', 'Orbit'][pf.cam % 4] },
        { t: 'para', text: 'Tap a row to change it. Use A− and A+ at the top of any screen to change the text size from 100% to 300%.' },
        { t: 'btn', id: 'set:restore', label: 'Restore purchase' },
      ];
      if (state.env.config.dev) items.push({ t: 'btn', id: 'set:dev', label: 'Developer: unlock all' });
      return { items, footer: [{ id: 'back', label: 'Back', primary: true }] };
    }
    case 'howto': case 'about': case 'rules': {
      const doc = state.scene === 'howto' ? HOWTO : state.scene === 'about' ? ABOUT : RULES;
      let items = doc.map((it) => (it.t === 'fig' ? { ...it, draw: (ctx, w, h) => drawFigure(ctx, it.key, w, h, state) } : it));
      if (state.scene === 'about') {
        const m = state.env.monetization, owned = m && m.owns && m.owns('unlock_game');
        items = items.concat([{ t: 'h', text: 'Full game' }, { t: 'para', text: owned ? 'The full game is unlocked. Thank you!' : 'Sail free for a short preview, then unlock the full game once for good.' }]);
        if (!owned) items.push({ t: 'btn', id: 'a:unlock', label: 'Unlock full game', primary: true, h: 80 });
        items.push({ t: 'btn', id: 'a:restore', label: 'Restore purchase', h: 70 });
        items = items.concat((state.env?.view3d?.credits ?? CREDITS_FALLBACK).map((text) => (text.startsWith('# ') ? { t: 'h', text: text.slice(2) } : { t: 'para', text })));
        items.push({ t: 'more' });
      }
      return { items, footer: [{ id: 'back', label: 'Back', primary: true }], col: readerCol() };
    }
    case 'arrive': {
      const rs = state.results;
      const items = [{ t: 'title', text: rs.headline, size: 44, sub: rs.sub }];
      if (rs.stars != null) items.push({ t: 'fig', h: 90, draw: (ctx, w, h) => drawStars(ctx, w, h, rs.stars, state) });
      for (const row of rs.rows) items.push({ t: 'stat', label: row.label, value: row.value, color: row.color, wide: true });
      for (const n of rs.notes ?? []) items.push({ t: 'para', text: n, color: PAL.peach });
      items.push({ t: 'gap', h: 10 }, { t: 'more' });
      return { items, footer: rs.career ? [{ id: 'cont', label: 'Continue', primary: true }] : [{ id: 'again', label: 'Sail again', primary: true }, { id: 'menu', label: 'Menu' }], col: readerCol() };
    }
    case 'demolimit': {
      const items = [
        { t: 'title', text: 'That was the free taste', size: 40 },
        { t: 'para', text: 'You have sailed the free passages in this web preview. The full game, with Career, the Daily Passage, every harbour and season and unlimited sailing, is on iPhone and Android.' },
        { t: 'para', text: 'Auto Play is still free to watch.' },
      ];
      return { items, footer: [{ id: 'auto', label: 'Watch Auto Play' }, { id: 'menu', label: 'Menu', primary: true }] };
    }
    default: return { items: [], footer: [] };
  }
}

function drawStars(ctx, w, h, n, state) {
  const cx = w / 2, R = Math.min(h * 0.42, 40);
  for (let i = 0; i < 3; i++) {
    const x = cx + (i - 1) * R * 2.6, on = i < n, sc = on ? 1 + 0.08 * Math.sin(state.t * 3 + i) : 0.8;
    ctx.save(); ctx.translate(x, h / 2); ctx.scale(sc, sc); ctx.fillStyle = on ? '#ffd05c' : 'rgba(255,255,255,0.18)'; ctx.strokeStyle = on ? 'rgba(90,50,0,0.8)' : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3;
    ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? R * 0.45 : R; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
}

// ---- figures (Rules and How to Play) ------------------------------------------------------------------------------------------------------------------
function drawFigure(ctx, key, w, h, state) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,40,60,0.75)'; rr(ctx, 0, 0, w, h, 18); ctx.fill(); ctx.strokeStyle = 'rgba(130,225,225,0.35)'; ctx.lineWidth = 2; ctx.stroke();
  const para = (t, x, y, c, sz = txt(17)) => { ctx.font = `600 ${sz}px ${SANS}`; for (const l of wrapLines(ctx, t, w - x - 12)) { lab(l, x, y, c, 'left', sz); y += sz * 1.3; } };
  const lab = (t, x, y, c = '#fff', al = 'center', sz = txt(18)) => { ctx.font = `600 ${sz}px ${SANS}`; ctx.fillStyle = c; ctx.textAlign = al; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); };
  if (key === 'dial') {
    const R = Math.min(h * 0.42, w * 0.2), cx = w * 0.28, cy = h / 2;
    ctx.fillStyle = '#0c3450'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill(); ctx.strokeStyle = '#c58f48'; ctx.lineWidth = 9; ctx.stroke();
    ctx.fillStyle = 'rgba(235,80,70,0.3)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R - 6, (-34 - 90 + 40) * DEG, (34 - 90 + 40) * DEG); ctx.closePath(); ctx.fill();
    const wa = 40; const [wx, wy] = [cx + Math.sin(wa * DEG) * R * 0.85, cy - Math.cos(wa * DEG) * R * 0.85]; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(cx + Math.sin(wa * DEG) * R * 0.35, cy - Math.cos(wa * DEG) * R * 0.35); ctx.stroke();
    ctx.strokeStyle = PAL.gold; ctx.setLineDash([3, 7]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * 0.9, cy - R * 0.25); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = PAL.teal; ctx.beginPath(); ctx.arc(cx - R * 0.6, cy - R * 0.55, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#c99a5a'; ctx.beginPath(); ctx.ellipse(cx, cy, R * 0.12, R * 0.3, 0.3, 0, 7); ctx.fill();
    const tx = w * 0.5, rows = [['#fff', 'white arrow: where the wind comes from'], ['#ff9a8a', 'red wedge: the sail cannot work here'], [PAL.gold, 'gold line: the course you chose'], [PAL.teal, 'teal flag: your harbour (estimated)']];
    let yy = h * 0.14; for (const [c, t] of rows) { for (const l of wrapLines(ctx, t, w - tx - 12)) { lab(l, tx, yy + 14, c, 'left', txt(17)); yy += txt(17) * 1.25; } yy += 8; }
  } else if (key === 'sheet') {
    const sx = w * 0.14, y0 = 24, y1 = h - 24;
    rr(ctx, sx - 14, y0, 28, y1 - y0, 14); ctx.fillStyle = '#12506b'; ctx.fill(); rr(ctx, sx - 22, y0 + (y1 - y0) * 0.35, 44, (y1 - y0) * 0.22, 10); ctx.fillStyle = 'rgba(79,224,204,0.4)'; ctx.fill();
    rr(ctx, sx - 28, y0 + (y1 - y0) * 0.42, 56, 34, 12); ctx.fillStyle = '#f0b43a'; ctx.fill();
    lab('out', sx, y0 - 6, '#cfeeee'); lab('in', sx, y1 + 18, '#cfeeee');
    const tx = w * 0.3; const rows = [['#ffb15a', 'Shaking: the sail is too far out. Pull the slider down.'], ['#8fc4ff', 'Flat and stalled: too tight. Push the slider up.'], ['#7fe3a0', 'Full and drawing: the teal band is right.'], [PAL.gold, 'Half the wind angle plus 2 degrees is the ideal.']];
    rows.forEach(([c, t], i) => { ctx.font = `600 ${txt(17)}px ${SANS}`; const ls = wrapLines(ctx, t, w - tx - 16); ls.forEach((l, j) => lab(l, tx, h * 0.18 + i * (h * 0.22) + j * 22, c, 'left', txt(17))); });
  } else if (key === 'polar') {
    const cx = w * 0.3, cy = h * 0.88, R = Math.min(h * 0.8, w * 0.26);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1.5; for (const f of [0.5, 1]) { ctx.beginPath(); ctx.arc(cx, cy, R * f, Math.PI, 2 * Math.PI); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx, cy); for (let a = 0; a <= 180; a += 3) { const p = polar(a), x = cx + Math.sin(a * DEG) * R * p * -1, y = cy - Math.cos(a * DEG) * R * p; ctx.lineTo(x, y); } ctx.closePath(); ctx.fillStyle = 'rgba(79,224,204,0.3)'; ctx.fill(); ctx.strokeStyle = PAL.teal; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = 'rgba(235,80,70,0.3)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, -Math.PI / 2 - 34 * DEG, -Math.PI / 2 + 34 * DEG); ctx.closePath(); ctx.fill();
    lab('wind', cx, cy - R - 10, '#fff'); lab('into the wind: no drive', cx, cy + 22, '#ff9a8a', 'center', txt(15));
    const tx = w * 0.56; para('Distance from the middle is the drive at that angle to the wind. Best near 105 degrees, 70 percent dead downwind.', tx, h * 0.2, '#e6f6f6');
  } else if (key === 'monsoon') {
    const mid = w / 2;
    const draw = (x, title, from, col, line) => { lab(title, x, 34, col, 'center', txt(19)); const cx = x, cy = h * 0.58, R = h * 0.26; ctx.strokeStyle = col; ctx.lineWidth = 4; const [ax, ay] = [cx + Math.sin(from * DEG) * R, cy - Math.cos(from * DEG) * R]; const [bx, by] = [cx - Math.sin(from * DEG) * R, cy + Math.cos(from * DEG) * R]; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.save(); ctx.translate(bx, by); ctx.rotate((from + 180) * DEG); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 8); ctx.lineTo(-10, 8); ctx.closePath(); ctx.fill(); ctx.restore(); ctx.font = `600 ${txt(16)}px ${SANS}`; const ls = wrapLines(ctx, line, w * 0.44); ls.forEach((l, j) => lab(l, x, h - 8 - (ls.length - 1 - j) * txt(16) * 1.25, '#e6f6f6', 'center', txt(16))); };
    draw(w * 0.27, 'Kaskazi', 50, '#ffd05c', 'Nov to Mar: to the south-west');
    draw(w * 0.73, 'Kusi', 225, '#5ec6f2', 'May to Sep: to the north-east');
    void mid;
  } else if (key === 'chart') {
    ctx.strokeStyle = 'rgba(79,224,204,0.6)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.8); ctx.lineTo(w * 0.62, h * 0.25); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,208,92,0.15)'; ctx.beginPath(); ctx.arc(w * 0.38, h * 0.52, 36, 0, 7); ctx.fill(); ctx.strokeStyle = PAL.gold; ctx.setLineDash([4, 5]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(w * 0.38, h * 0.52 - 12); ctx.lineTo(w * 0.38 + 8, h * 0.52 + 9); ctx.lineTo(w * 0.38 - 8, h * 0.52 + 9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(206,180,120,0.6)'; ctx.fillRect(w * 0.6, h * 0.08, w * 0.07, h * 0.4); lab('coast', w * 0.636, h * 0.6, '#ffe9b0', 'center', txt(15));
    para('The yellow circle is your doubt. It grows as the real position drifts from your estimate. Seeing land removes it.', w * 0.7, h * 0.22, '#e6f6f6', txt(16));
  } else if (key === 'kamal') {
    const gx = w * 0.06, gw = w * 0.5, gy = h * 0.28, gh = h * 0.4;
    rr(ctx, gx, gy, gw, gh, 12); ctx.fillStyle = 'rgba(2,10,28,0.85)'; ctx.fill(); ctx.strokeStyle = 'rgba(140,180,255,0.5)'; ctx.stroke();
    rr(ctx, gx + gw * 0.3, gy + 6, gw * 0.4, gh - 12, 8); ctx.fillStyle = 'rgba(79,224,204,0.3)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,240,200,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(gx + gw / 2, gy); ctx.lineTo(gx + gw / 2, gy + gh); ctx.stroke();
    const sx = gx + gw * 0.62; glow(ctx, sx, gy + gh / 2, 30, 'rgba(200,225,255,A)', 0.8); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx, gy + gh / 2, 7, 0, 7); ctx.fill();
    para('At night, tap NOW as the star meets the edge of the card. It fixes your latitude (north-south).', w * 0.62, h * 0.24, '#e6f6f6', txt(16));
  }
  void state; ctx.restore();
}

// ---- in-play overlays ---------------------------------------------------------------------------------------------------------------------------------
function drawToasts(ctx, state) {
  let y = LY.toastY + (state.coachShown ? 54 : 0); const now = state.t;
  for (const tt of state.toasts) {
    const age = now - tt.t0; if (age > 4.2) continue;
    const a = clamp(Math.min(age * 4, (4.2 - age) * 2), 0, 1);
    ctx.font = `700 ${txt(22)}px ${SANS}`; const w = ctx.measureText(tt.text).width + 40;
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(6,26,40,0.82)'; rr(ctx, LY.cx - w / 2, y - 26, w, 44, 22); ctx.fill(); ctx.strokeStyle = tt.col ?? 'rgba(130,225,225,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = tt.col ?? '#fff3da'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(tt.text, LY.cx, y - 3); ctx.restore(); y += 52;
  }
  ctx.textBaseline = 'alphabetic';
}
function drawThink(ctx, state) {
  const th = state.think, TC = LY.thinkCard, zs = Math.min(scaleOf(state), 2);
  const maxH = TC.bottom - (LY.U.y0 + LY.hud.h + 30);
  let fs = 25 * zs, wrapped; const textW = TC.w - 52;
  for (;;) { ctx.font = `500 ${fs}px ${SANS}`; wrapped = th.lines.map((l) => wrapLines(ctx, l, textW)); const n = wrapped.reduce((a, w) => a + w.length, 0); const need = 96 + n * fs * 1.32 + wrapped.length * 8; if (need <= maxH || fs <= LY.minText) { wrapped.need = need; break; } fs -= 1; }
  const r = { x: TC.x, y: Math.min(TC.bottom - (LY.land ? 250 : 330), TC.bottom - wrapped.need - 10), w: TC.w, h: 0 };
  r.h = TC.btn.y + TC.btn.h + 20 - r.y;
  ctx.fillStyle = 'rgba(2,12,22,0.5)'; ctx.fillRect(0, 0, LY.w, LY.h);
  panel(ctx, r, { radius: 30 });
  textFill(ctx, 'THINK', LY.cx, r.y + 52, 38, { grad: [[0, '#d4fff2'], [1, '#35c4a4']], stroke: 'rgba(0,40,40,0.5)' });
  ctx.font = `500 ${fs}px ${SANS}`; ctx.fillStyle = '#fff3da'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let y = r.y + 100 + fs * 0.2; for (const ws of wrapped) { for (const l of ws) { ctx.fillText(l, r.x + 24, y); y += fs * 1.32; } y += 8; }
  drawButton(ctx, TC.btn, 'Got it', { primary: true, size: 30 });
}
function drawPauseMenu(ctx, state) {
  const P = LY.pauseMenu; ctx.fillStyle = 'rgba(2,12,22,0.76)'; ctx.fillRect(0, 0, LY.w, LY.h);
  textFill(ctx, 'Paused', LY.cx, P.titleY, 66, { grad: gradTitle, stroke: 'rgba(4,24,40,0.55)' });
  const fs = 30 * Math.min(Math.min(scaleOf(state), 2), 1.5);
  drawButton(ctx, P.resume, 'Resume', { primary: true, size: fs });
  drawButton(ctx, P.sound, state.prefs.sound ? 'Sound: On' : 'Sound: Off', { size: fs });
  drawButton(ctx, P.quit, 'Quit to menu', { danger: true, size: fs });
}
function drawAutoPanel(ctx, state) {
  const a = state.auto, A = LY.auto;
  drawButton(ctx, A.pause, state.paused ? 'RESUME' : 'PAUSE', { primary: state.paused, size: 28 });
  drawButton(ctx, A.speed, `Speed x${a.speed}`, { size: 24 });
  drawButton(ctx, A.exit, 'Exit', { size: 24 });
  drawButton(ctx, A.dec, '−', { size: 32 }); drawButton(ctx, A.inc, '+', { size: 32 });
  ctx.font = `600 ${txt(18)}px ${SANS}`; ctx.fillStyle = 'rgba(240,252,252,0.92)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`think ${[2, 5, 8, 10][state.prefs.thinkIdx]} s`, A.thinkLbl.x, A.thinkLbl.y);
  const lines = a.lines;
  if (lines.length) {
    const phaseName = a.revealing ? 'REVEAL' : a.phase === 'think' ? 'THINK' : 'ACT';
    const phaseCol = a.revealing ? PAL.gold : a.phase === 'think' ? PAL.teal : '#fff';
    const C = A.card, r = { x: C.x, y: 0, w: C.w, h: 0 }, zs = Math.min(scaleOf(state), 2);
    let fs = 21 * zs, wrapped; const maxH = C.bottom - (LY.chart.y + LY.chart.h + 14);
    for (;;) { ctx.font = `500 ${fs}px ${SANS}`; wrapped = []; for (const l of lines) wrapped.push(...wrapLines(ctx, l, C.w - 44)); if (58 + wrapped.length * fs * 1.33 + 14 <= maxH || fs <= LY.minText) break; fs -= 1; }
    r.h = 58 + wrapped.length * fs * 1.33 + 14; r.y = C.bottom - r.h; A._cardTop = r.y;
    panel(ctx, r, { radius: 22, top: 'rgba(6,30,46,0.9)', bottom: 'rgba(4,20,32,0.86)' });
    textFill(ctx, phaseName, r.x + 22, r.y + 42, 28, { align: 'left', color: phaseCol, weight: 700 });
    const frac = a.total > 0 ? clamp(1 - a.timer / a.total, 0, 1) : 1;
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, r.x + 150, r.y + 28, r.w - 180, 10, 5); ctx.fill();
    ctx.fillStyle = phaseCol; rr(ctx, r.x + 150, r.y + 28, (r.w - 180) * frac, 10, 5); ctx.fill();
    ctx.font = `500 ${fs}px ${SANS}`; ctx.fillStyle = '#fff3da'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; let y = r.y + 58 + fs * 1.05;
    for (const l of wrapped) { ctx.fillText(l, r.x + 22, y); y += fs * 1.33; }
  }
  if (state.paused) textFill(ctx, 'PAUSED', LY.cx, Math.min(A.pausedY, (A._cardTop ?? 1e9) - 24), 56, { color: '#fff', stroke: 'rgba(10,20,40,0.7)' });
}

export function renderPlay(ctx, state) {
  const V = state.voy, v = state.v, zs = Math.min(scaleOf(state), 2);
  if (live3d(state)) ctx.clearRect(0, 0, LY.w, LY.h);
  else { ctx.fillStyle = '#06202f'; ctx.fillRect(0, 0, LY.w, LY.h); drawSea2d(ctx, LY.w, LY.h, { t: V.t, tod: (V.tod0 + V.t / 70) % 1, wind: V.wind.speed, ship: { heel: V.ship.heel, eff: V.ship.eff, flap: V.ship.flap }, storm: 0 }); }
  if (v.flash > 0.01) { ctx.fillStyle = `rgba(255,70,50,${v.flash * 0.28})`; ctx.fillRect(0, 0, LY.w, LY.h); }
  drawParticles(ctx, v.parts);
  drawHud(ctx, state, V, zs);
  drawChart(ctx, state, V);
  drawSheet(ctx, state, V);
  if (state.scene === 'auto') { drawAutoPanel(ctx, state); } else { drawDial(ctx, state, V); drawSailStatus(ctx, state, V); drawActions(ctx, state, V); if (V.decision) drawDecision(ctx, state, V); }
  if (V.sight && state.scene === 'play') drawSight(ctx, state, V);
  state.coachShown = false;
  if (state.coach && state.scene === 'play' && !V.decision && !V.sight) drawCoach(ctx, state, V);
  drawToasts(ctx, state);
  if (V.phase !== 'sail') {
    const k = smooth(state.endT / 0.6);
    ctx.fillStyle = `rgba(4,20,32,${0.5 * k})`; ctx.fillRect(0, 0, LY.w, LY.h);
    const ok = V.phase === 'arrived';
    textFill(ctx, ok ? 'Landfall!' : 'Passage ended', LY.cx, LY.h * 0.4, 70 * Math.min(1, LY.w / 560), { grad: ok ? gradTitle : [[0, '#ffe5dd'], [1, '#e8806a']], stroke: 'rgba(4,24,40,0.6)', alpha: k });
    textFill(ctx, ok ? `Welcome to ${nm(V.to)}` : ({ wrecked: 'The hull gave way', thirst: 'Out of water', lost: 'Too long at sea' })[V.result.how] ?? '', LY.cx, LY.h * 0.4 + 56, txt(32), { color: '#fff3da', alpha: k });
  }
  if (state.think.open) drawThink(ctx, state);
  if (state.paused && state.scene === 'play') drawPauseMenu(ctx, state);
}
function drawCoach(ctx, state, V) {
  const sh = V.ship; let msg = null;
  if (state.prefs.coach < 3 && V.t < 25) msg = V.t < 8 ? 'Drag the compass to choose your course.' : 'Drag the sheet slider until the sail is full.';
  else if (state.prefs.coach < 4 && sh.flap > 0.6 && V.t > 4) msg = 'The sail is shaking: haul the sheet in.';
  else if (state.prefs.coach < 4 && sh.beta < 36 && V.t > 4) msg = 'Too close to the wind! Turn away from the red wedge.';
  state.coachShown = !!msg;
  if (!msg) return;
  ctx.font = `600 ${txt(21)}px ${SANS}`; const w = ctx.measureText(msg).width + 36, y = LY.toastY;
  ctx.fillStyle = 'rgba(6,26,40,0.78)'; rr(ctx, LY.cx - w / 2, y - 28, w, 44, 22); ctx.fill(); ctx.fillStyle = '#fff3da'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(msg, LY.cx, y - 5); ctx.textBaseline = 'alphabetic';
}

export function renderScene(ctx, state) {
  const sc = state.scene;
  if (sc === 'play' || sc === 'auto') { renderPlay(ctx, state); return; }
  columnScreen(ctx, state, sceneSpec(state));
}
void lerp; void wrap360; void MONTHS; void edgeStroke; void drawMoreLine; void glow; void bar; void inRect; void idealAngle; void sheetAngle; void COAST_HALF; void SIGHT_R; void LEGS; void CREW_ROLES; void POLAR; void KN;
