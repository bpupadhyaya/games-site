// Every screen that is not an action HUD: title, story cards, plan, tales, summaries, harbour (trade, budget, provisions), season end, settings, pause, Think card and the paginated
// About / How to Play / Rules / Journal reader. Pure drawing; game.js owns the state. Text follows the 100-300% size setting on every screen.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, LY, READ, HUD, host } from './layout.js';

import { drawLockup, drawMoreLine, edgeStroke } from './brand.js';
import { FONT, NUM, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import * as K from './consts.js';
import * as sim from './sim.js';
import { drawPearl, drawShell, drawStrip } from './hud.js';
import { EPILOGUES } from './events.js';

const { BANKS, PROVS } = K;
const THINK_STEPS = K.THINK_STEPS;
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
export const resetMenus = () => { LAID = { key: '', lay: null, top: 0, bottom: H }; pageCache.clear(); };
export const resetPages = () => pageCache.clear();
const estCtx = { font: '', measureText(t) { const m = /(\d+(?:\.\d+)?)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.54 }; } };
const clamp = sim.clamp;
const CARDS = ['pause', 'hint', 'watchend'];
const ON_SEA = ['intro', 'prov', 'plan', 'tale', 'daysum', 'divedone', 'haulDone', 'trade', 'budget', 'season'];

// ---- geometry of the sheets that sit over the 3D picture ----------------------------------------------------------------------------------------------------------------------
function sheetBox() {
  const U = LY.U, top0 = HUD.strip.y + HUD.strip.h + 8;
  if (LY.land) { const cw = clamp(Math.round(U.w * 0.42), 400, 600), x = U.x1 - 8 - cw; return { x: x + 6, w: cw - 12, top: top0 + 8, bottom: U.y1 - 14, anchor: 'top', panel: { x, w: cw } }; }
  const minTop = Math.round(top0 + LY.h * (LY.h < 1200 ? 0.2 : 0.24));
  return { x: LY.col.x, w: LY.col.w, top: minTop, bottom: U.y1 - 14, anchor: 'bottom', panel: { x: U.x0 + 6, w: U.w - 12 } };
}
function plan(state, key) {
  const U = LY.U, land = LY.land, col = LY.col, top0 = LY.flowTop;
  const full = { x: col.x, w: col.w, top: top0, bottom: LY.flowBottom };
  switch (key) {
    case 'title': {
      if (land) return { panes: [{ wd: titleWidgets(state, true), box: { x: LY.title.col.x, w: LY.title.col.w, top: U.y0 + 10, bottom: U.y1 - 40 }, vcenter: true }] };
      { const g = titleGeom(); return { panes: [{ wd: titleWidgets(state, false), box: { x: LY.title.col.x, w: LY.title.col.w, top: g.hero.y + g.hero.h, bottom: LY.flowBottom - 36 }, anchor: 'bottom' }] }; }
    }
    case 'settings': return { panes: [{ wd: settingsWidgets(state), box: full }] };
    case 'demolimit': return { panes: [{ wd: demoLimitWidgets(), box: full, vcenter: land }] };
    case 'journal': return null;
    default:
      if (CARDS.includes(key)) {
        const wd = { pause: pauseWidgets, hint: hintWidgets, watchend: watchEndWidgets }[key](state);
        return { panes: [{ wd, box: { x: LY.card.x, w: LY.card.w, top: LY.card.top, bottom: LY.card.bottom }, card: true }] };
      }
      if (ON_SEA.includes(key)) {
        const b = sheetBox();
        const wd = { intro: introWidgets, prov: provWidgets, plan: planWidgets, tale: taleWidgets, daysum: daysumWidgets, divedone: diveDoneWidgets, haulDone: haulDoneWidgets, trade: tradeWidgets, budget: budgetWidgets, season: seasonWidgets }[key](state);
        return { panes: [{ wd, box: { x: b.x, w: b.w, top: b.top, bottom: b.bottom }, sheet: b }] };
      }
  }
  return null;
}
function layPane(pane, scale) {
  const lay = flowLayout(estCtx, pane.wd, scale, { x: pane.box.x, w: pane.box.w });
  let top = pane.box.top, bottom = pane.box.bottom;
  if (pane.card) { const ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (top + bottom - ch) / 2); top = y0; bottom = y0 + ch; }
  else if (pane.sheet) { const ch = Math.min(lay.contentH + 6, bottom - top); if (pane.sheet.anchor === 'bottom') top = bottom - ch; else bottom = top + ch; }
  else if (pane.anchor === 'bottom') { if (lay.contentH < bottom - top) top = bottom - lay.contentH; }
  else if (pane.vcenter && lay.contentH < bottom - top) { const off = Math.round((bottom - top - lay.contentH) / 2); top += off; bottom = top + lay.contentH; }
  return { lay, top, bottom, box: pane.box, card: !!pane.card, sheet: pane.sheet || null };
}
function setLaid(state, key, pl) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const ps = pl.panes.map((p) => layPane(p, sc));
  const main = ps[0];
  LAID = { key, lay: main.lay, top: main.top, bottom: main.bottom, h: main.lay.contentH, main };
  return ps;
}
export function ensureLayout(state, key) { const pl = plan(state, key); if (pl) setLaid(state, key, pl); }
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const spaced = (ctx, text, cx, y, gap) => {
  const ws = [...text].map((ch) => ctx.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + gap * (text.length - 1);
  let x = cx - total / 2;
  [...text].forEach((ch, i) => { ctx.fillText(ch, x + ws[i] / 2, y); x += ws[i] + gap; });
};

// ---- backdrops ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// the painted fallback when WebGL is missing: sky, sun, sea, a dhow's sail; and a sea-green room for the text pages
function flatSea(ctx, state, under = false) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (under) { g.addColorStop(0, '#2fb8b0'); g.addColorStop(0.5, '#0f7e86'); g.addColorStop(1, '#064048'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#c7a873'; ctx.fillRect(0, H * 0.82, W, H * 0.18); return; }
  g.addColorStop(0, '#f6c98c'); g.addColorStop(0.36, '#f9e1b8'); g.addColorStop(0.37, '#2ab3b5'); g.addColorStop(1, '#0b5560'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const hy = H * 0.37; ctx.fillStyle = '#fff1c4'; ctx.beginPath(); ctx.arc(W * 0.7, hy - 70, 38, 0, 7); ctx.fill();
  const t = (state.t || 0); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) { const y = hy + 20 + i * (H - hy) / 15; ctx.beginPath(); for (let x = 0; x <= W; x += 24) ctx.lineTo(x, y + Math.sin(x * 0.02 + t * 0.8 + i) * 3 * (1 + i * 0.15)); ctx.stroke(); }
  const bx = W * 0.35, by = hy + 36; ctx.fillStyle = '#5a3a20'; ctx.beginPath(); ctx.moveTo(bx - 150, by); ctx.lineTo(bx + 170, by); ctx.lineTo(bx + 120, by + 34); ctx.lineTo(bx - 110, by + 34); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f5ecd2'; ctx.beginPath(); ctx.moveTo(bx - 10, by - 6); ctx.lineTo(bx + 60, by - 190); ctx.lineTo(bx + 150, by - 6); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#3d2814'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(bx + 20, by + 2); ctx.lineTo(bx + 70, by - 200); ctx.stroke();
}
export const drawFlatBackdrop = flatSea;
function pageBackdrop(ctx) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a3a46'); g.addColorStop(0.5, '#0d4f58'); g.addColorStop(1, '#052a33'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); const rg = ctx.createRadialGradient(W * 0.5, H * 0.1, 10, W * 0.5, H * 0.1, Math.max(W, H) * 0.7); rg.addColorStop(0, 'rgba(120,240,225,0.25)'); rg.addColorStop(1, 'rgba(120,240,225,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H); }
const PAGES = ['rules', 'about', 'howto', 'journal'];
function backdrop(ctx, state, under = false) {
  if (PAGES.includes(state.scene)) { pageBackdrop(ctx); return; }
  if (state.v3) return;
  flatSea(ctx, state, under);
}
function scrim(ctx, state, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(2,22,28,${a * 0.5})`); g.addColorStop(0.5, `rgba(2,22,28,${a})`); g.addColorStop(1, `rgba(2,22,28,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// ---- title ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function titleGeom() {
  const h = clamp(Math.round(LY.h * 0.2), 240, 330);
  return { hero: { x: 0, y: LY.flowTop, w: LY.w, h } };
}
// where the 3D picture of the title sits: below the title text, above the buttons (portrait); the left half below the title text (landscape)
export function titleView() {
  const U = LY.U;
  if (LY.land) return { x: U.x0, y: U.y0 + Math.round(U.h * 0.34), w: Math.round(U.w * 0.5), h: Math.round(U.h * 0.66) };
  const g = titleGeom(), y = g.hero.y + g.hero.h - 20, bottom = LAID.key === 'title' ? LAID.top : U.y0 + Math.round(U.h * 0.62);
  return { x: U.x0, y, w: U.w, h: Math.max(180, bottom - y) };
}
export function drawHero(ctx, state, w, h) {
  const k = Math.max(0.35, Math.min(w / 560, (LY.land ? h * 0.5 : h) / 300, 1.35)), cx = w / 2, top = LY.land ? 6 : Math.max(6, (h - 300 * k) / 2);
  ctx.save(); ctx.translate(cx, top); ctx.scale(k, k); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 24px ${FONT}`; ctx.fillStyle = 'rgba(255,226,160,0.98)'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 8; spaced(ctx, 'A SEASON IN THE ARABIAN GULF', 0, 40, 5); ctx.shadowBlur = 0;
  const g = ctx.createLinearGradient(0, 70, 0, 190); g.addColorStop(0, '#fff6dc'); g.addColorStop(0.55, '#ffe08a'); g.addColorStop(1, '#e2a23c');
  ctx.font = `800 128px ${DISPLAY}`; ctx.lineJoin = 'round'; ctx.lineWidth = 16; ctx.strokeStyle = 'rgba(3,40,48,0.85)'; ctx.strokeText('PEARL', 0, 160); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 14; ctx.fillStyle = g; ctx.fillText('PEARL', 0, 160); ctx.shadowBlur = 0;
  ctx.font = `800 74px ${DISPLAY}`; ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(3,40,48,0.85)'; ctx.strokeText('DIVING', 0, 232); ctx.fillStyle = '#9ff2e6'; ctx.fillText('DIVING', 0, 232);
  ctx.font = `600 24px ${FONT}`; ctx.fillStyle = 'rgba(255,246,222,0.96)'; ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 8; ctx.fillText('One breath. One rope. One season.', 0, 280);
  ctx.restore();
}
let titleLockTap = null, lockDownNow = false;
export const getLockTap = () => titleLockTap;
export const setLockDown = (v) => { lockDownNow = v; };
const LOCK_CAP = 300;
const lockupArt = () => ({ t: 'art', brand: true, h: Math.round(LOCK_CAP * 327 / 1200) + 40, draw(ctx, w) {
  const lw = Math.min(w - 30, LOCK_CAP), lh = Math.round(lw * 327 / 1200);
  ctx.save(); const px = w / 2 - lw / 2 - 14, py = 20 - 8, pw = lw + 28, ph = lh + 16, pg = ctx.createLinearGradient(px, py, px, py + ph);
  pg.addColorStop(0, lockDownNow ? '#14727c' : '#0b4650'); pg.addColorStop(1, lockDownNow ? '#0b525b' : '#052a33');
  roundPath(ctx, px, py, pw, ph, ph / 2); ctx.fillStyle = pg; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = lockDownNow ? 'rgba(255,240,170,0.95)' : 'rgba(150,240,230,0.6)'; ctx.stroke(); ctx.restore();
  drawLockup(ctx, w / 2, 20, lw, 1);
} });
const heroArt = (state) => ({ t: 'art', h: LY.title.heroH || 360, draw(ctx, w, h) { ctx.save(); drawHero(ctx, state, w, h); ctx.restore(); } });
export function titleWidgets(state, land = false) {
  const wd = [];
  const r = state.resume;
  if (r) wd.push({ t: 'btn', id: 'continue', label: 'Continue the season', sub: `Trip ${r.trip + 1}, day ${Math.min(K.DAYS, r.day + 1)}  ·  Rs ${Math.round(r.cash)}  ·  owe ${r.debt}`, primary: true, h: 96 }, { t: 'btn', id: 'play', label: 'Begin a new season', h: 80 });
  else wd.push({ t: 'btn', id: 'play', label: 'Begin the season', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2 }, { t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 3 }, { t: 'btn', id: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', dark: true, h: 76 });
  wd.push(lockupArt());
  return wd;
}

// ---- story and sea screens ---------------------------------------------------------------------------------------------------------------------------------------------------------
const head = (label, size = 46) => ({ t: 'h', label, size, cap: 1.5 });
const para = (label, o = {}) => ({ t: 'p', label, size: 26, cap: 3, color: 'rgba(255,246,222,0.96)', ...o });
const sub = (label) => ({ t: 'p', label, bold: true, color: '#ffe9bf', size: 26, cap: 2.4 });
export function introWidgets(state) {
  return [head('Muharraq, 1924'),
    para(`You are Yusuf, sixteen. The pearl divers of the island have a saying: the sea gives, but the ledger remembers.`),
    para(`Captain ${K.NAMES.captain} has signed you on to his boat for the season, with an advance of ${K.START_DEBT} rupees. Your mother used it for rent and flour. It must be repaid from your share of the pearls.`),
    para(`Four trips of five days. A song in the morning, a dive, a haul, shells at dusk. ${K.NAMES.partner} dives beside you; ${K.NAMES.singer} sings; ${K.NAMES.cook} cooks.`, { size: 24 }),
    { t: 'btn', id: 'intro-go', label: 'Sign on to the boat', primary: true, h: 90 }, { t: 'btn', id: 'intro-back', label: 'Back', dark: true, h: 72 }, { t: 'gap', h: 12 }];
}
export function provWidgets(state) {
  const S = state.S, first = S.trip === 0 && !S.started;
  const wd = [head("Rashid's pot"), para(first ? 'Before the first trip the cook asks what the crew will eat. A fuller pot costs more and restores more every night.' : `Trip ${S.trip + 2} is next. What will the crew eat?`), para(`In your pocket: Rs ${Math.round(S.cash)}. If you cannot pay, Rashid writes the rest in the ledger.`, { size: 22, color: '#ffe9bf' })];
  PROVS.forEach((p, i) => wd.push({ t: 'btn', id: `prov${i}`, label: `${p.name}  ·  Rs ${sim.provCost(S, i)}`, sub: `${p.sub}  Restores ${p.rest} stamina a night.`, active: S.prov === i, h: 96 }));
  wd.push({ t: 'gap', h: 12 });
  return wd;
}
const star = (n) => Math.max(1, Math.min(5, n));
export function planWidgets(state) {
  const S = state.S, w = sim.windOf(S);
  const wd = [head(`Dawn, day ${S.day + 1}`, 44), para(`${w.name}: ${w.sub}. ${S.flags.forceRest ? 'The shamal has the boat sheltering.' : S.wind === 3 ? 'The deep bank is closed.' : ''}`, { size: 24, color: '#ffe9bf' })];
  sim.planOptions(S).forEach((o) => {
    if (o.id === 'rest') wd.push({ t: 'btn', id: 'plan-rest', label: 'Rest day', sub: 'Mend nets, sing, sleep. About +30 stamina.', dark: true, h: 90 });
    else wd.push({ t: 'btn', id: `plan-${o.id}`, label: o.bank.name, sub: o.ok ? o.bank.sub : o.why, disabled: !o.ok, hitDisabled: true, stars: star(Math.round(o.bank.rich * 2.4)), h: 96, primary: state.watch && state.watch.choice === `plan-${o.id}` });
  });
  wd.push({ t: 'gap', h: 14 });
  return wd;
}
export function taleWidgets(state) {
  const S = state.S, e = S.ev; if (!e) return [{ t: 'btn', id: 'tale-next', label: 'Continue', primary: true }];
  const wd = [head(e.title, 42)]; e.lines.forEach((l) => wd.push(para(l, { size: 25 })));
  if (S.chosen < 0 && e.choices.length) e.choices.forEach((c) => { const src = c; wd.push({ t: 'btn', id: `tale${c.i}`, label: src.label, disabled: !c.ok, hitDisabled: true, h: 84 }); });
  else { if (e.result) wd.push(para(e.result, { color: '#9ff2e6', bold: true, size: 25 })); wd.push({ t: 'btn', id: 'tale-next', label: 'Continue', primary: true, h: 88 }); }
  wd.push({ t: 'gap', h: 10 });
  return wd;
}
const pearlRow = (p, right, chip, id, price) => ({ t: 'art', id, h: 86, draw(ctx, w, h) {
  roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = chip === 'HOLD' ? 'rgba(10,50,58,0.9)' : 'rgba(244,234,208,0.95)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = chip === 'HOLD' ? 'rgba(150,240,230,0.4)' : '#a88a50'; ctx.stroke();
  drawPearl(ctx, 46, h / 2, Math.min(30, 11 + p.mm * 1.4), p, 0);
  const dark = chip !== 'HOLD'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let px = 24; ctx.font = `700 ${px}px ${FONT}`; const maxw = w - 88 - 215; while (ctx.measureText(sim.pearlName(p)).width > maxw && px > 14) { px--; ctx.font = `700 ${px}px ${FONT}`; }
  ctx.fillStyle = dark ? C.ink : '#fff3d6'; ctx.fillText(sim.pearlName(p), 88, h / 2 - 4);
  ctx.font = `400 ${Math.max(16, px - 4)}px ${FONT}`; ctx.fillStyle = dark ? '#5a4a30' : 'rgba(255,243,214,0.8)'; ctx.fillText(sim.pearlDetail(p), 88, h / 2 + 22);
  ctx.textAlign = 'right'; ctx.font = `800 24px ${NUM}`; ctx.fillStyle = dark ? '#7d3a12' : '#ffe49a'; ctx.fillText(`Rs ${price}`, w - 102, h / 2 - 2);
  roundPath(ctx, w - 88, h / 2 - 20, 76, 40, 20); ctx.fillStyle = chip === 'HOLD' ? '#e0922b' : chip === 'SOLD' ? '#6a7a7e' : '#0f9aa6'; ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `800 18px ${FONT}`; ctx.fillText(chip, w - 50, h / 2 + 1);
} });
export function daysumWidgets(state) {
  const S = state.S, m = S.sum, last = S.day >= K.DAYS - 1;
  const wd = [head(`End of day ${S.day + 1}`, 42)];
  if (m.rest) wd.push(para('A rest day. The crew mended nets and slept in the shade of the sail.', { size: 25 }));
  else {
    const bank = BANKS.find((b) => b.id === m.bank);
    wd.push(para(`${bank.name}: ${m.shells} shell${m.shells === 1 ? '' : 's'} from your dive${m.gifted ? `, plus ${m.gifted} from Salim` : ''}.`, { size: 25 }));
    const found = (m.pearls || []).map((id) => S.pearls.find((p) => p.id === id)).filter(Boolean);
    wd.push(para(found.length ? `Pearls today: ${found.length}.` : 'No pearls today.', { size: 25, bold: true, color: found.length ? '#fff27a' : '#ffe9bf' }));
    found.slice(0, 6).forEach((p) => wd.push(pearlRow(p, '', 'KEPT', null, p.value)));
    if (m.how) wd.push(para(`Effort ${m.cost} stamina${m.how === 'clean' ? ', a clean surface' : m.how === 'tight' ? ', a tight surface' : ', hauled up by Salim'}.`, { size: 22, color: '#ffe9bf' }));
  }
  wd.push(para(`Stamina ${Math.round(S.stam)}, spirit ${Math.round(S.spirit)}.`, { size: 22, color: '#ffe9bf' }));
  wd.push({ t: 'btn', id: 'ds-neck', label: 'Necklace', row: 9, h: 78 }, { t: 'btn', id: 'ds-journal', label: 'Journal', row: 9, h: 78 });
  wd.push({ t: 'btn', id: 'ds-next', label: last ? 'Sail to Muharraq' : 'Next day', primary: true, h: 92 }, { t: 'gap', h: 10 });
  return wd;
}
const HOWS = { clean: 'a clean surface', tight: 'a tight surface', auto: 'hauled up by Salim, who did not wait for your signal' };
export function diveDoneWidgets(state) {
  const D = state.S.D; if (!D || !D.result) return [{ t: 'btn', id: 'dd-next', label: 'Continue', primary: true }];
  const r = D.result;
  return [head('Back on deck', 44), para(`${r.shells} shell${r.shells === 1 ? '' : 's'}${r.old ? `, ${r.old} of them old` : ''}. ${HOWS[r.how] ? HOWS[r.how][0].toUpperCase() + HOWS[r.how].slice(1) : ''}.`, { size: 26 }),
    para(`Picks: ${r.perfect} perfect, ${r.good} good, ${r.rough} rough${r.broke ? `, ${r.broke} shell${r.broke === 1 ? '' : 's'} broke` : ''}. Effort: ${r.cost} stamina.`, { size: 22, color: '#ffe9bf' }),
    para('Now it is Salim\'s turn below. You hold the rope.', { size: 24 }),
    { t: 'btn', id: 'dd-next', label: 'Take the rope', primary: true, h: 90 }, { t: 'gap', h: 8 }];
}
export function haulDoneWidgets(state) {
  const H0 = state.S.H; if (!H0) return [{ t: 'btn', id: 'hd-next', label: 'Continue', primary: true }];
  const how = { smooth: 'Salim came up smooth and grinning.', tight: 'It was tight: Salim came up gasping.', late: 'Too slow. Salim came up spent.' }[H0.how];
  return [head('Salim is up', 44), para(how, { size: 26 }), para(H0.gift ? `He passed you ${H0.gift} shell${H0.gift === 1 ? '' : 's'} from his basket.` : 'No shells from him today.', { size: 25, bold: true, color: H0.gift ? '#fff27a' : '#ffe9bf' }),
    para(`Pulls: ${H0.perfect} perfect, ${H0.ok} good, ${H0.weak} weak.`, { size: 22, color: '#ffe9bf' }),
    { t: 'btn', id: 'hd-next', label: 'Open the shells', primary: true, h: 90 }, { t: 'gap', h: 8 }];
}
// ---- the harbour --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function tradeWidgets(state) {
  const S = state.S, q = sim.tradeTotals(S), last = sim.lastTrip(S);
  const wd = [head(last ? 'The last market' : 'Muharraq market', 44),
    para(`${K.NAMES.merchant} weighs each pearl on his small scale. Price index ${q.ix.toFixed(2)}.${last ? ' Everything not on your necklace is sold today.' : ' Tap a pearl to hold it for a later market.'}`, { size: 23 })];
  if (!q.rows.length) wd.push(para('You have no pearls to sell.', { size: 25, color: '#ffe9bf' }));
  q.rows.forEach((r) => { const sell = sim.tradeSold(S, r.p); wd.push(pearlRow(r.p, '', last ? 'SOLD' : sell ? 'SELL' : 'HOLD', `pr${r.p.id}`, r.price)); });
  wd.push(para(`${q.sell.length} to sell: Rs ${q.gross}. The boat keeps ${Math.round(K.BOAT_SHARE * 100)}% (Rs ${q.share}). You receive Rs ${q.net}.`, { size: 24, bold: true, color: '#fff27a' }));
  wd.push({ t: 'btn', id: 'tr-neck', label: 'Choose pearls for the necklace', dark: true, h: 76 });
  wd.push({ t: 'btn', id: 'tr-go', label: q.sell.length ? `Sell ${q.sell.length} pearl${q.sell.length === 1 ? '' : 's'}` : 'Continue', primary: true, h: 90 }, { t: 'gap', h: 10 });
  return wd;
}
export function budgetWidgets(state) {
  const S = state.S, B = S.B, left = sim.budgetLeft(S), need = Math.max(0, K.FAMILY_NEED - S.famCredit);
  const wd = [head('Settling up', 44), para(`In your pocket: Rs ${Math.round(S.cash)}. Choose where it goes.`, { size: 24 }),
    sub(`Repay the advance: Rs ${B.debt}  (you owe ${S.debt})`),
    { t: 'btn', id: 'b-debt-dec', label: '−10', row: 20, h: 72, disabled: B.debt <= 0 }, { t: 'btn', id: 'b-debt-inc', label: '+10', row: 20, h: 72, disabled: left <= 0 || B.debt >= S.debt }, { t: 'btn', id: 'b-debt-max', label: 'As much as I can', row: 20, h: 72, disabled: S.debt <= 0 },
    sub(`Family: Rs ${B.fam}  (they need ${need}${S.famCredit ? `, you already sent ${S.famCredit}` : ''})`),
    { t: 'btn', id: 'b-fam-dec', label: '−6', row: 21, h: 72, disabled: B.fam <= 0 }, { t: 'btn', id: 'b-fam-inc', label: '+6', row: 21, h: 72, disabled: left <= 0 || B.fam >= K.FAMILY_NEED * 2 }, { t: 'btn', id: 'b-fam-need', label: `Their need`, row: 21, h: 72 },
    sub('Gift to a family in need'),
    { t: 'btn', id: 'b-gift', label: B.gift ? `Giving Rs ${K.GIFT}` : `Give Rs ${K.GIFT}`, active: !!B.gift, disabled: !B.gift && left < K.GIFT, h: 72 },
    para(`Left in your pocket: Rs ${left}.${B.fam < need ? ' Your family will feel the strain if they get less than they need.' : ''}`, { size: 24, bold: true, color: B.fam < need ? '#ffb59a' : '#fff27a' }),
    { t: 'btn', id: 'b-go', label: sim.lastTrip(S) ? 'Finish the season' : 'Settle', primary: true, h: 90 }, { t: 'gap', h: 10 }];
  return wd;
}
const starsArt = (n) => ({ t: 'art', h: 90, draw(ctx, w, h) { for (let i = 0; i < 5; i++) { const cx = w / 2 + (i - 2) * 76, on = i < n; ctx.save(); ctx.translate(cx, h / 2); ctx.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 14 : 34, a = -Math.PI / 2 + k * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fillStyle = on ? '#ffd45a' : 'rgba(255,255,255,0.14)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = on ? '#b57d12' : 'rgba(255,255,255,0.25)'; ctx.stroke(); ctx.restore(); } } });
export function seasonWidgets(state) {
  const S = state.S, sc = S.score; if (!sc) return [{ t: 'btn', id: 'se-menu', label: 'Main menu', primary: true }];
  const p = sc.parts;
  const wd = [head('The season is over', 44), starsArt(sc.stars), { t: 'h', label: `${sc.total} points`, size: 54, cap: 1.3, color: '#ffd97a' },
    para(`Advance repaid ${p.debt} / 40  ·  Family ${p.family} / 20  ·  Standing ${p.standing} / 10  ·  Necklace ${p.necklace} / 15  ·  Money ${p.savings} / 15`, { size: 22, color: '#ffe9bf' }),
    para(`Left to repay: Rs ${S.debt}. In your pocket: Rs ${Math.round(S.cash)}. Pearls found: ${S.sold + S.pearls.length}. Best pearl: Rs ${S.bestPearl}.`, { size: 22 })];
  EPILOGUES[S.fin].forEach((l) => wd.push(para(l, { size: 24 })));
  wd.push({ t: 'btn', id: 'se-neck', label: 'Necklace', row: 10, h: 78 }, { t: 'btn', id: 'se-journal', label: 'Journal', row: 10, h: 78 });
  wd.push({ t: 'btn', id: 'se-again', label: 'A new season', primary: true, h: 88 }, { t: 'btn', id: 'se-menu', label: 'Main menu', dark: true, h: 76 }, { t: 'gap', h: 10 });
  return wd;
}
export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, head('Settings', 48),
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-music', label: st.music ? 'Music: On' : 'Music: Off', sub: 'A quiet work song while you play' },
    { t: 'btn', id: 'set-tips', label: st.tips ? 'Hints on the screen: On' : 'Hints on the screen: Off', sub: 'Short tips on the first dives' },
    sub(`Text size: ${Math.round(sc * 100)}%`),
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 }, { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    sub(`Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`),
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 }, { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [para(state.restoreMsg, { size: 24, color: '#ffe9bf' })] : []),
    { t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 }, { t: 'gap', h: 30 },
  ];
}
export function pauseWidgets(state) {
  const st = state.settings;
  return [
    head('Paused', 52), { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 }, { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-journal', label: 'Journal', row: 11 }, { t: 'btn', id: 'p-neck', label: 'Necklace', row: 11 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 }, { t: 'btn', id: 'quit', label: 'Quit to menu', sub: state.mode === 'play' ? 'Your season is kept' : '', dark: true, row: 8 },
  ];
}
export function hintWidgets(state) {
  const h = state.hint;
  const wd = [head('Think', 48)];
  (h ? h.lines : []).forEach((l) => wd.push(para(l, { size: 24 })));
  wd.push({ t: 'gap', h: 10 });
  if (h && h.label && h.pick) wd.push({ t: 'btn', id: 'hint-do', label: h.label, primary: true, h: 84 });
  wd.push({ t: 'btn', id: 'hint-close', label: 'Close', dark: true, h: 76 });
  return wd;
}
export function watchEndWidgets(state) {
  const w = state.watchEnd || { days: 0, shells: 0, pearls: 0 };
  return [head('Watch & Learn', 48), para(`You watched ${w.days} days at sea: ${w.shells} shells and ${w.pearls} pearls.`, { size: 26 }), para('Every choice you saw is one you can make yourself. Think gives you a coach\'s hint at any time.', { size: 24 }),
    { t: 'btn', id: 'again', label: 'Watch another', primary: true, h: 84 }, { t: 'btn', id: 'menu', label: 'Main menu', dark: true, h: 76 }];
}
export function demoLimitWidgets() {
  return [{ t: 'gap', h: 200 }, head('That is the free preview', 48), para('You have sailed the first two days of the web demo. The full game on iPhone and Android has the whole season of four trips, the harbour, the necklace and your journal.', { size: 28 }), { t: 'gap', h: 20 }, { t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
}

// ---- drawing the flow screens --------------------------------------------------------------------------------------------------------------------------------------------------------
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(6,30,36,0)'); g.addColorStop(1, 'rgba(6,30,36,0.75)'); ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = '#1c2a2e'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = '#1c2a2e'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
function drawFlowScreen(ctx, state, key) {
  const pl = plan(state, key);
  const ps = setLaid(state, key, pl);
  let res = null;
  for (const P of ps) {
    const { lay, top, bottom, box } = P;
    if (P.sheet) { const sx = P.sheet.panel.x, sw = P.sheet.panel.w; panel(ctx, sx, top - 14, sw, bottom - top + 28, { r: 30, fill: 'rgba(3,32,40,0.88)', stroke: 'rgba(140,235,226,0.4)', lw: 2.5 }); ctx.save(); roundPath(ctx, sx, top - 14, sw, bottom - top + 28, 30); ctx.clip(); edgeStroke(ctx, { x: sx + 3, y: top - 11, w: sw - 6, h: bottom - top + 22 }, 28, 0.3); ctx.restore(); }
    const maxScroll = Math.max(0, lay.contentH - (bottom - top));
    const scroll = Math.min(state.ui.scroll, maxScroll);
    drawFlow(ctx, lay, top, bottom, scroll, P.card ? { x: box.x - 20, w: box.w + 40 } : { x: Math.max(0, box.x - 20), w: box.w + 40 });
    if (maxScroll > 0) {
      const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th), bx = Math.min(W - 10, box.x + box.w + 18);
      roundPath(ctx, bx, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,240,204,0.5)'; ctx.fill();
      scrollHint(ctx, top, bottom, scroll, maxScroll, box.x - 10, box.w + 20);
    }
    res = { scroll, maxScroll, lay };
  }
  return res;
}
export function renderTitle(ctx, state) {
  backdrop(ctx, state);
  if (state.v3) { // a darker panel behind the buttons so they read over the 3D sea
    const col = LY.title.col;
    if (LY.land) { const g = ctx.createLinearGradient(col.x - 80, 0, col.x + 40, 0); g.addColorStop(0, 'rgba(2,24,30,0)'); g.addColorStop(1, 'rgba(2,24,30,0.78)'); ctx.fillStyle = g; ctx.fillRect(col.x - 80, 0, W - col.x + 80, H); const g2 = ctx.createLinearGradient(0, 0, 0, H * 0.4); g2.addColorStop(0, 'rgba(2,24,30,0.45)'); g2.addColorStop(1, 'rgba(2,24,30,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, col.x, H * 0.4); }
    else { const y0 = (LAID.key === 'title' ? LAID.top : LY.h * 0.6) - 60; const g = ctx.createLinearGradient(0, y0, 0, y0 + 120); g.addColorStop(0, 'rgba(2,24,30,0)'); g.addColorStop(1, 'rgba(2,24,30,0.86)'); ctx.fillStyle = g; ctx.fillRect(0, y0, W, 120); ctx.fillStyle = 'rgba(2,24,30,0.86)'; ctx.fillRect(0, y0 + 120, W, H - y0 - 120); const g2 = ctx.createLinearGradient(0, 0, 0, 300); g2.addColorStop(0, 'rgba(2,24,30,0.5)'); g2.addColorStop(1, 'rgba(2,24,30,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, W, 300); }
  } else scrim(ctx, state, 0.18);
  if (LY.land && LY.title.hero) { const h = LY.title.hero; ctx.save(); ctx.translate(h.x, h.y); ctx.beginPath(); ctx.rect(0, 0, h.w, h.h); ctx.clip(); drawHero(ctx, state, h.w, h.h); ctx.restore(); }
  else if (!LY.land) { const g = titleGeom().hero; ctx.save(); ctx.translate(g.x, g.y); drawHero(ctx, state, g.w, g.h); ctx.restore(); }
  const fr = drawFlowScreen(ctx, state, 'title');
  titleLockTap = null;
  if (fr) {
    const it = fr.lay.items.find((i) => i.w && i.w.brand);
    if (it) {
      const lw = Math.min(it.wd - 30, LOCK_CAP), lh = Math.round(lw * 327 / 1200), cx = it.x + it.wd / 2, cy = LAID.top + it.y - fr.scroll + 20 + lh / 2;
      const m = 44 / Math.max(0.2, host.px), tw = Math.max(lw + 24, m), th = Math.max(lh + 12, m);
      if (cy - th / 2 >= LAID.top - 4 && cy + th / 2 <= LAID.bottom + 4) titleLockTap = { x: cx - tw / 2, y: cy - th / 2, w: tw, h: th };
    }
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  if (state.demo) { ctx.font = `400 ${LY.minText}px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.6)'; ctx.fillText('Web demo', (LY.U.x0 + LY.U.x1) / 2, LY.U.y1 - 14); }
}
export function renderSea(ctx, state, key) {
  backdrop(ctx, state, state.S && state.S.phase === 'dive');
  if (!state.v3) scrim(ctx, state, 0.18);
  drawStrip(ctx, state);
  drawFlowScreen(ctx, state, key);
}
export function renderSettings(ctx, state) { backdrop(ctx, state); if (state.v3) { ctx.fillStyle = 'rgba(2,24,30,0.6)'; ctx.fillRect(0, 0, W, H); } scrim(ctx, state, 0.5); drawFlowScreen(ctx, state, 'settings'); }
export function renderDemoLimit(ctx, state) { backdrop(ctx, state); if (state.v3) { ctx.fillStyle = 'rgba(2,24,30,0.6)'; ctx.fillRect(0, 0, W, H); } scrim(ctx, state, 0.6); drawFlowScreen(ctx, state, 'demolimit'); }
function cardOverlay(ctx, state, key) {
  ctx.fillStyle = 'rgba(2,24,30,0.5)'; ctx.fillRect(0, 0, W, H);
  const pl = plan(state, key), ps = setLaid(state, key, pl), P = ps[0];
  const ch = P.bottom - P.top;
  panel(ctx, LY.card.panelX, P.top - 20, LY.card.panelW, ch + 40, { r: 30, fill: 'rgba(5,36,44,0.97)', stroke: 'rgba(140,235,226,0.5)' });
  ctx.save(); ctx.beginPath(); roundPath(ctx, LY.card.panelX, P.top - 20, LY.card.panelW, ch + 40, 30); ctx.clip(); edgeStroke(ctx, { x: LY.card.panelX + 3, y: P.top - 17, w: LY.card.panelW - 6, h: ch + 34 }, 28, 0.35); ctx.restore();
  const maxScroll = Math.max(0, P.lay.contentH - ch), sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, P.lay, P.top, P.bottom, sc0, { x: LY.card.panelX, w: LY.card.panelW }); scrollHint(ctx, P.top, P.bottom, sc0, maxScroll, LY.card.panelX, LY.card.panelW);
}
export const renderPause = (ctx, s) => cardOverlay(ctx, s, 'pause');
export const renderHint = (ctx, s) => cardOverlay(ctx, s, 'hint');
export const renderWatchEnd = (ctx, s) => cardOverlay(ctx, s, 'watchend');

// the Watch & Learn caption: what the coach is thinking and a real Pause
export function renderWatchBar(ctx, state) {
  const w = state.watch; if (!w) return;
  const U = LY.U, land = LY.land, bw = land ? Math.min(560, U.w * 0.4) : U.w - 28, bx = land ? U.x0 + 14 : U.x0 + 14, bh = 150;
  const by = land ? U.y1 - 14 - bh : HUD.ctl.y - bh - 14 + (state.S && ['dive', 'song', 'haul', 'open'].includes(state.S.phase) ? 0 : 0);
  const y = Math.max(HUD.strip.y + HUD.strip.h + 8, by);
  panel(ctx, bx, y, bw - (land ? 0 : 0), bh, { r: 22, fill: 'rgba(3,32,40,0.9)', stroke: 'rgba(255,214,120,0.7)', lw: 2.5 });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const fs = Math.max(22, LY.minText + 2);
  ctx.font = `800 ${fs}px ${FONT}`; ctx.fillStyle = '#ffd97a'; ctx.fillText(state.paused ? 'Watch & Learn: paused' : w.phase === 'think' ? `Thinking...  ${Math.max(0, Math.ceil(w.dur - w.t))} s` : w.phase === 'reveal' ? 'The choice' : 'Watch & Learn', bx + 18, y + 34);
  ctx.font = `500 ${Math.round(fs * 0.92)}px ${FONT}`; ctx.fillStyle = '#fff3d6';
  const lines = wrapLines(ctx, w.text || '', bw - 36 - 200).slice(0, 4);
  lines.forEach((l, i) => ctx.fillText(l, bx + 18, y + 34 + fs * 1.25 * (i + 1)));
  const pb = { x: bx + bw - 190, y: y + 12, w: 172, h: 58 }; state.watchPauseRect = pb;
  drawButton(ctx, pb, state.paused ? 'Resume' : 'Pause', { primary: !state.paused, active: state.paused, size: Math.round(fs * 0.95) });
  const qb = { x: bx + bw - 190, y: y + 80, w: 172, h: 54 }; state.watchQuitRect = qb;
  drawButton(ctx, qb, 'Stop', { dark: true, size: Math.round(fs * 0.85) });
}

// ---- reference pages (one continuous scrolling page) ---------------------------------------------------------------------------------------------------------------------------
const pageCache = new Map();
const READER = { max: 0, view: 900 };
export const readerMeta = () => READER;
const ART_H = 250;
function readerLayout(state, list, header) {
  const scale = TEXT_SCALES[state.settings.textIdx];
  const PANEL = READ.panel;
  const key = `${header}:${scale}:${list.length}:${Math.round(PANEL.w)}:${state.jlen || 0}`;
  let L = pageCache.get(key);
  if (L) return L;
  const ctx = estCtx, fs = Math.round(28 * scale), lh = fs * 1.26, tw = PANEL.w - 70, secFs = Math.round(34 * Math.min(scale, 1.3));
  const items = []; let y = 10;
  list.forEach((sec, si) => {
    if (si > 0) y += 18;
    ctx.font = `800 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    items.push({ k: 'title', y, lines: tl, fs: secFs }); y += tl.length * secFs * 1.2 + 14;
    if (sec.art) { items.push({ k: 'art', y, art: sec.art }); y += ART_H + 12; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => { if (pi > 0) y += lh * 0.45; wrapLines(ctx, para, tw).forEach((l) => { items.push({ k: 'line', y, text: l }); y += lh; }); });
    y += 12; items.push({ k: 'rule', y }); y += 10;
  });
  L = { items, h: y + 30, fs, secFs };
  pageCache.set(key, L);
  return L;
}
export function renderPages(ctx, state, list, header) {
  backdrop(ctx, state); scrim(ctx, state, 0.35);
  const sc = TEXT_SCALES[state.settings.textIdx], PANEL = READ.panel, VIEW = READ.view, pcx = PANEL.x + PANEL.w / 2;
  const L = readerLayout(state, list, header);
  READER.max = Math.max(0, Math.ceil(L.h - VIEW.h)); READER.view = VIEW.h;
  const sy = Math.max(0, Math.min(state.page || 0, READER.max)); state.page = sy;
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(250,243,226,0.97)', stroke: 'rgba(176,122,28,0.8)' });
  ctx.save(); ctx.beginPath(); roundPath(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 30); ctx.clip(); edgeStroke(ctx, { x: PANEL.x + 4, y: PANEL.y + 4, w: PANEL.w - 8, h: PANEL.h - 8 }, 26, 0.3); ctx.restore();
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#0c5560'; ctx.font = `800 ${Math.round(40 * Math.min(sc, 1.15))}px ${DISPLAY}`; ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(28,42,46,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 50, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 50, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 6, VIEW.y, PANEL.w - 12, VIEW.h); ctx.clip();
  const x0 = PANEL.x + 35;
  for (const it of L.items) {
    const y = VIEW.y + it.y - sy;
    const hh = it.k === 'art' ? ART_H : it.k === 'title' ? it.lines.length * L.secFs * 1.2 : L.fs * 1.3;
    if (y > VIEW.y + VIEW.h || y + hh < VIEW.y) continue;
    if (it.k === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = '#b3402a'; ctx.font = `800 ${L.secFs}px ${DISPLAY}`; it.lines.forEach((l, k) => ctx.fillText(l, pcx, y + L.secFs * (0.9 + k * 1.2))); }
    else if (it.k === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, ART_H); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, ART_H); ctx.restore(); }
    else if (it.k === 'line') { ctx.fillStyle = C.ink; ctx.font = `400 ${L.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, x0, y + L.fs * 0.85); }
    else { ctx.strokeStyle = 'rgba(28,42,46,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 70, y); ctx.lineTo(PANEL.x + PANEL.w - 70, y); ctx.stroke(); }
  }
  ctx.restore();
  if (READER.max > 0) {
    const B = READ.bar, th = Math.max(60, VIEW.h * (VIEW.h / L.h)), ty = VIEW.y + (sy / READER.max) * (VIEW.h - th);
    roundPath(ctx, B.x + 12, VIEW.y, 4, VIEW.h, 2); ctx.fillStyle = 'rgba(12,85,96,0.15)'; ctx.fill();
    roundPath(ctx, B.x + 9, ty, 10, th, 5); ctx.fillStyle = 'rgba(12,85,96,0.7)'; ctx.fill();
    ctx.textAlign = 'center'; ctx.font = `700 ${Math.max(22, LY.minText)}px ${FONT}`; ctx.textBaseline = 'middle';
    if (sy < READER.max - 4) { roundPath(ctx, pcx - 54, VIEW.y + VIEW.h - 42, 108, 32, 16); ctx.fillStyle = 'rgba(28,42,46,0.88)'; ctx.fill(); ctx.fillStyle = '#fff3d6'; ctx.fillText('▼ more', pcx, VIEW.y + VIEW.h - 26); }
    else if (sy > 4) { roundPath(ctx, pcx - 54, VIEW.y + 6, 108, 32, 16); ctx.fillStyle = 'rgba(28,42,46,0.88)'; ctx.fill(); ctx.fillStyle = '#fff3d6'; ctx.fillText('▲ top', pcx, VIEW.y + 22); }
    ctx.textBaseline = 'alphabetic';
  }
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 }); drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff3d6'; ctx.font = `700 ${Math.max(24, LY.minText)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(sc * 100)}%`, READ.label.x, READ.label.y); ctx.textBaseline = 'alphabetic';
  const atEnd = READER.max <= 0 || sy >= READER.max - 4;
  drawButton(ctx, REF_BACK, 'Close', { size: 32 }); drawButton(ctx, REF_NEXT, atEnd ? 'Done' : 'More ▼', { primary: true, size: 32 });
}

// ---- diagrams for the Rules page, drawn with the same pearl and shell art as the game ----------------------------------------------------------------------------------------
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  ctx.font = `700 22px ${FONT}`; ctx.fillStyle = C.ink; ctx.textAlign = 'center';
  if (key === 'day') {
    const steps = ['Plan', 'Song', 'Dive', 'Haul', 'Open', 'Tale'], cw = w / steps.length;
    steps.forEach((s, i) => { const cx = cw * (i + 0.5), cy = h * 0.4; ctx.fillStyle = ['#e0922b', '#1b78a8', '#0f9aa6', '#2fa090', '#a05a2c', '#7a4a8a'][i]; ctx.beginPath(); ctx.arc(cx, cy, Math.min(34, cw * 0.38), 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `800 24px ${FONT}`; ctx.fillText(String(i + 1), cx, cy + 8); ctx.fillStyle = C.ink; ctx.font = `700 ${Math.min(22, cw * 0.28)}px ${FONT}`; ctx.fillText(s, cx, cy + 66); if (i) { ctx.strokeStyle = '#8a7448'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cw * i - 10, cy); ctx.lineTo(cw * i + 6, cy); ctx.stroke(); } });
    ctx.font = `500 20px ${FONT}`; ctx.fillStyle = '#5a4a30'; ctx.fillText('then the night restores stamina by the provisions', w / 2, h * 0.92);
  } else if (key === 'banks') {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#bfe9e8'); g.addColorStop(0.18, '#2ab3b5'); g.addColorStop(1, '#0b5560'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d6b985'; ctx.fillRect(0, h - 22, w, 22);
    BANKS.forEach((b, i) => { const bx = w * (0.2 + 0.3 * i), by = h * 0.16 + (h - 22 - h * 0.16) * (b.depth / 17); ctx.strokeStyle = '#e9d9a8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx, h * 0.16); ctx.lineTo(bx, by); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.font = `700 21px ${FONT}`; ctx.fillText(`${b.depth} m`, bx, by - 8); drawShell(ctx, bx, Math.min(h - 40, by + 20), 48, 0, i === 2, null); ctx.fillStyle = '#fff6dc'; ctx.font = `800 20px ${FONT}`; ctx.fillText(b.name.split(' ')[0], bx, h - 4); });
  } else if (key === 'breath') {
    const bw = w - 40, by = h * 0.4; ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(20, by, bw, 46); ctx.fillStyle = 'rgba(70,170,110,0.65)'; ctx.fillRect(20 + bw * K.DIVE.zone[0], by, bw * (K.DIVE.zone[1] - K.DIVE.zone[0]), 46); ctx.fillStyle = '#1b78a8'; ctx.fillRect(20, by + 8, bw * 0.62, 30);
    ctx.fillStyle = C.ink; ctx.font = `700 21px ${FONT}`; ctx.fillText('too little', 20 + bw * 0.3, by + 82); ctx.fillText('the green band', 20 + bw * ((K.DIVE.zone[0] + K.DIVE.zone[1]) / 2), by - 12); ctx.fillText('dizzy', 20 + bw * 0.97, by + 82);
  } else if (key === 'ring') {
    const cx = w * 0.3, cy = h * 0.5; ctx.strokeStyle = '#8a7448'; ctx.lineWidth = 5; for (const [r, a] of [[78, 0.35], [60, 0.55], [46, 1]]) { ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke(); } ctx.globalAlpha = 1;
    ctx.fillStyle = '#0f9aa6'; ctx.beginPath(); ctx.arc(cx, cy, 34, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = `800 22px ${FONT}`; ctx.fillText('PICK', cx, cy + 8);
    ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.font = `600 22px ${FONT}`; ['The ring closes towards the shell.', `Tap at the mark: Perfect (${K.DIVE.pickTime.perfect} s).`, 'Early or late: Good, then Rough.'].forEach((l, i) => ctx.fillText(l, w * 0.52, h * 0.3 + i * 40));
  } else if (key === 'pearls') {
    const ex = [{ id: 1, col: 0, lust: 3, shape: 3, mm: 9 }, { id: 2, col: 1, lust: 2, shape: 2, mm: 8 }, { id: 3, col: 2, lust: 2, shape: 1, mm: 7 }, { id: 4, col: 3, lust: 1, shape: 0, mm: 8 }, { id: 5, col: 4, lust: 3, shape: 3, mm: 10 }];
    ex.forEach((p, i) => { const cx = w * (0.12 + 0.19 * i); drawPearl(ctx, cx, h * 0.36, 16 + p.mm * 1.7, p, 0); ctx.fillStyle = C.ink; ctx.font = `700 19px ${FONT}`; ctx.fillText(K.COLOURS[p.col].name, cx, h * 0.72); ctx.font = `500 17px ${FONT}`; ctx.fillStyle = '#5a4a30'; ctx.fillText(K.SHAPES[p.shape].name, cx, h * 0.72 + 24); });
  } else if (key === 'necklace') {
    const n = 11; for (let i = 0; i < n; i++) { const u = i / (n - 1), a = Math.PI * (0.08 + 0.84 * u), mm = 5 + Math.round(4 * Math.sin(Math.PI * u)); const px = w / 2 - Math.cos(a) * w * 0.42, py = h * 0.12 + Math.sin(a) * h * 0.66; drawPearl(ctx, px, py, 8 + mm * 1.5, { id: i + 1, col: 1, lust: 2, shape: 3, mm }, 0); }
    ctx.fillStyle = '#5a4a30'; ctx.font = `600 20px ${FONT}`; ctx.fillText('largest in the middle, matching colours', w / 2, h - 8);
  }
  ctx.restore();
}
