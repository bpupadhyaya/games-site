// Every screen that is not the play screen: title, setup, settings, result, pause, and the paginated About / How to Play /
// Rules reader with its illustrations (drawn with the game's own board and darts). Pure drawing; game.js owns state.
// Fluid: every screen is laid out from the live size (W, H, VIEW.mode in layout.js). Portrait / tablet: one centred column (the
// original phone look). Landscape: two columns (art or first half left, buttons right), the left one clear of the back button.
import { W, H, VIEW, host, BACKBOX, PAGE, wideCols, fontFloor, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS } from './layout.js';
import { drawBackdrop, drawBoardAt, drawBoard, drawDart, regionPath, wobbleAng, TAU } from './art.js';
import { FONT, NUM, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES } from './ai.js';
import { ASSIST } from './aim.js';
import { avg3 } from './engine.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { drawLockup, lockupHeight, drawMoreLine } from './brand.js';

// ---- flow screens ------------------------------------------------------------------------------
let LAID = { key: '', vk: '', lay: null, top: 0, bottom: 0 };
export const flowMeta = () => LAID;
const scaleOf = (state) => Math.max(TEXT_SCALES[state.settings.textIdx], fontFloor());
// A layout for the scene being updated right now, before anything has been drawn (first frame after a scene change, or
// headless runs): same widgets, text widths estimated instead of measured.
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };

const BOT = () => H - Math.max(0, host.b);
const topOff = () => (host.back ? BACKBOX.y + BACKBOX.h + 4 : Math.max(0, host.t));
const GAPT = (h) => ({ t: 'gap', h });
// Which widgets go in which column(s) for each screen. Returns { cols: [{ x, w, widgets, center }], top, bottom }.
function flowDef(state, key) {
  const wide = VIEW.mode === 'wide', c = wide ? wideCols() : null;
  const c1w = Math.min(640, W - 2 * Math.max(40, host.l + 10, host.r + 10)), c1x = Math.round((W - c1w) / 2);
  const one = (widgets, bottom = BOT(), top = topOff()) => ({ cols: [{ x: c1x, w: c1w, widgets }], top, bottom });
  if (key === 'title') {
    const tw = titleWidgets(state), top = wide ? Math.max(0, host.t) : topOff();
    if (wide) {
      const hero = heroArt(state, Math.min(560, H - 40), c.lw), btns = tw.slice(1);
      return { cols: [{ x: c.lx, w: c.lw, widgets: [hero], center: true }, { x: c.rx, w: c.rw, widgets: btns, center: true }], top, bottom: BOT() - lockSize(c.rw).strip };
    }
    tw[0] = heroArt(state, Math.round(Math.max(380, Math.min(560, H - top - 500 - lockSize(c1w).strip))), c1w);
    return one(tw, BOT() - lockSize(c1w).strip, top);
  }
  if (key === 'setup') {
    const g = setupGroups(state);
    if (!wide) return one([...g.head, ...g.opp, ...g.start, ...g.legs, ...g.assist, GAPT(24)], SETUP_PINS.start.y - 26);
    const two = state.setup.mode === 'two';
    const left = two ? [...g.head, ...g.start] : [...g.head, ...g.opp], right = two ? [GAPT(34), ...g.legs, ...g.assist] : [GAPT(24), ...g.start, ...g.legs, ...g.assist];
    right.push(GAPT(130));
    return { cols: [{ x: c.lx, w: c.lw, widgets: left }, { x: c.rx, w: c.rw, widgets: right }], top: Math.max(0, host.t), bottom: BOT() };
  }
  if (key === 'settings') {
    const g = settingsGroups(state);
    if (!wide) return one([...g.head, ...g.snd, ...g.assist, ...g.text, ...g.think, ...g.restore, ...g.back]);
    return { cols: [{ x: c.lx, w: c.lw, widgets: [...g.head, ...g.snd, ...g.assist] }, { x: c.rx, w: c.rw, widgets: [GAPT(34), ...g.text, ...g.think, ...g.restore, ...g.back] }], top: Math.max(0, host.t), bottom: BOT() };
  }
  if (key === 'result') {
    const g = resultGroups(state);
    if (!wide) return one([...g.stats, ...g.buttons]);
    return { cols: [{ x: c.lx, w: c.lw, widgets: g.stats, center: true }, { x: c.rx, w: c.rw, widgets: g.buttons, center: true }], top: Math.max(0, host.t), bottom: BOT() };
  }
  return one(demoLimitWidgets(), BOT(), wide ? 0 : topOff());
}
function buildFlow(ctx, state, key) {
  const def = flowDef(state, key), sc = scaleOf(state), view = def.bottom - def.top;
  const items = []; let contentH = 0, lastEnd = 0, lastCol = null;
  for (const col of def.cols) {
    const lay = flowLayout(ctx, col.widgets, sc, { x: col.x, w: col.w });
    const dy = col.center && lay.contentH < view ? (view - lay.contentH) / 2 : 0;
    for (const it of lay.items) { it.y += dy; items.push(it); }
    contentH = Math.max(contentH, lay.contentH + dy);
    lastEnd = lay.contentH + dy; lastCol = col;
  }
  const out = { key, vk: VIEW.key, lay: { items, contentH }, top: def.top, bottom: def.bottom, h: contentH };
  if (key === 'title' && lastCol) {      // the lockup: right under the last button row, pinned at the bottom when the menu scrolls
    const ls = lockSize(lastCol.w), cx = lastCol.x + lastCol.w / 2, pinned = BOT() - ls.h - 12, y = Math.min(def.top + lastEnd + 12, pinned);
    const m = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(ls.w + 24, m), th = Math.max(ls.h + 12, m);
    out.lock = { cx, y, w: ls.w, h: ls.h, tap: { x: cx - tw / 2, y: y - 4, w: tw, h: Math.max(th, ls.h + 8) } };
  }
  return out;
}
export function ensureLayout(state, key) {
  if (LAID.key === key && LAID.vk === VIEW.key && LAID.lay) return;
  if (!['title', 'setup', 'settings', 'result', 'demolimit'].includes(key)) return;
  LAID = buildFlow(estCtx, state, key);
}
export const lockupZone = () => (LAID.lock ? LAID.lock.tap : null);
export function hitScreen(x, y, scroll) {
  { const t = LAID.key === 'title' && LAID.lock && LAID.lock.tap; if (t && x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return 'arcforge'; }
  return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null;
}

const spaced = (ctx, text, cx, y, gap) => {
  const ws = [...text].map((ch) => ctx.measureText(ch).width);
  const total = ws.reduce((a, b) => a + b, 0) + gap * (text.length - 1);
  let x = cx - total / 2;
  [...text].forEach((ch, i) => { ctx.fillText(ch, x + ws[i] / 2, y); x += ws[i] + gap; });
};

// The hero: the logo, and a small live board that darts keep landing in. Drawn in a 640 x 560 box, scaled to fit (w, h).
function heroArt(state, h = 560, wMax = 640) {
  return {
    t: 'art', h,
    draw(ctx, w) {
      const s = Math.min(1, w / 640, h / 560), cx = 320;
      ctx.save(); ctx.translate(w / 2 - 320 * s, (h - 560 * s) / 2); ctx.scale(s, s);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = `700 ${Math.round(Math.min(40, Math.max(24, 11.5 / (host.px * s))))}px ${FONT}`; ctx.fillStyle = 'rgba(233,193,95,0.95)';
      spaced(ctx, 'THE PUB GAME', cx, 70, 9);
      ctx.font = `800 118px ${NUM}`;
      textShadow(ctx, 'OCHE DARTS', cx, 178, '#fff4d6', 16);
      ctx.strokeStyle = 'rgba(233,193,95,0.8)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - 250, 208); ctx.lineTo(cx - 70, 208); ctx.moveTo(cx + 70, 208); ctx.lineTo(cx + 250, 208); ctx.stroke();
      ctx.font = `800 40px ${NUM}`; ctx.fillStyle = '#e9c15f';
      ctx.fillText('501', cx, 220);
      // the board
      const bx = cx, by = 400, R = 130;
      drawBoardAt(ctx, bx, by, R);
      const k = R / 170;
      for (const d of state.att.darts) drawDart(ctx, bx + d.x * k, by + d.y * k, { scale: 0.52, ang: wobbleAng(d.age, d.amp ?? 0, d.ph ?? 0), style: d.side });
      for (const p of state.att.parts) { ctx.save(); ctx.globalAlpha = 1 - p.t / p.max; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(bx + p.x * k, by + p.y * k, p.size, 0, TAU); ctx.fill(); ctx.restore(); }
      ctx.restore();
    },
  };
}

// The Arcforge lockup under the title menu: >= ~125 css px wide (aspect 1200:327); `strip` is the room kept for it under the buttons.
const lockSize = (maxW) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), maxW); const h = w * 327 / 1200; return { w, h, strip: Math.round(h + 26) }; };
export function titleWidgets(state) {
  const sound = state.settings.sound;
  const wd = [heroArt(state)];
  if (state.resume) {
    const r = state.resume, who = r.cfg.mode === 'two' ? 'Two players' : PROFILES[r.cfg.opp]?.name ?? 'Opponent';
    wd.push({ t: 'btn', id: 'continue', label: 'Continue match', sub: `${who}, legs ${r.legsWon[0]} to ${r.legsWon[1]}`, primary: true, h: 92 });
    wd.push({ t: 'btn', id: 'play', label: 'New match vs Computer', h: 80 });
  } else wd.push({ t: 'btn', id: 'play', label: 'Play vs Computer', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'two', label: 'Two Players', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 1 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 2 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 2 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 3 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 3 });
  return wd;
}

function setupGroups(state) {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const head = [{ t: 'gap', h: 10 }, { t: 'h', label: s.mode === 'two' ? 'Two Players' : 'New Match', size: 48 }];
  const opp = [];
  if (s.mode !== 'two') {
    opp.push({ t: 'p', label: 'Choose your opponent', bold: true, color: '#ffe9bf', size: 26 });
    PROFILES.forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0, locked = demo && i > 1;
      opp.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${pf.tag}${won ? ` · won ${won}` : ''}`, stars: locked ? 0 : pf.stars, active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: 92 });
    });
  }
  const start = [{ t: 'p', label: 'Start from', bold: true, color: '#ffe9bf', size: 26 }, { t: 'btn', id: 'st501', label: '501', row: 9, active: s.start === 501 }, { t: 'btn', id: 'st301', label: '301', row: 9, active: s.start === 301 }];
  const legs = [{ t: 'p', label: 'First to win', bold: true, color: '#ffe9bf', size: 26 }, { t: 'btn', id: 'legs1', label: '1 leg', row: 10, active: s.legs === 1 }, { t: 'btn', id: 'legs2', label: '2 legs', row: 10, active: s.legs === 2 }, { t: 'btn', id: 'legs3', label: '3 legs', row: 10, active: s.legs === 3 }];
  const assist = [{ t: 'p', label: 'Aim steadiness', bold: true, color: '#ffe9bf', size: 26 }, ...ASSIST.map((a, i) => ({ t: 'btn', id: `as${i}`, label: a.name, row: 11, active: state.settings.assist === i }))];
  return { head, opp, start, legs, assist };
}
export const setupWidgets = (state) => { const g = setupGroups(state); return [...g.head, ...g.opp, ...g.start, ...g.legs, ...g.assist, { t: 'gap', h: 24 }]; };

function settingsGroups(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return {
    head: [{ t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 }],
    snd: [{ t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
      { t: 'btn', id: 'set-coach', label: st.coach ? 'Checkout coach: On' : 'Checkout coach: Off', sub: 'Shows the finishing route when you can check out', active: st.coach }],
    assist: [{ t: 'p', label: `Aim steadiness: ${ASSIST[st.assist].name}`, bold: true, color: '#ffe9bf', size: 26 },
      ...ASSIST.map((a, i) => ({ t: 'btn', id: `as${i}`, label: a.name, row: 12, active: st.assist === i }))],
    text: [{ t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9bf', size: 26 },
      { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
      { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 }],
    think: [{ t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9bf', size: 26 },
      { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
      { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 }],
    restore: [...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
      ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9bf' }] : [])],
    back: [{ t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 }, { t: 'gap', h: 30 }],
  };
}
export const settingsWidgets = (state) => { const g = settingsGroups(state); return [...g.head, ...g.snd, ...g.assist, ...g.text, ...g.think, ...g.restore, ...g.back]; };

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '–');
function resultGroups(state) {
  const m = state.m, o = m.over, mode = m.cfg.mode, winner = o.win;
  const nameOf = (s) => (mode === 'two' ? `Player ${s + 1}` : mode === 'watch' ? PROFILES[s === 0 ? m.cfg.watchA : m.cfg.opp].name : s === 0 ? 'You' : PROFILES[m.cfg.opp].name);
  const title = mode === 'two' ? `Player ${winner + 1} wins` : mode === 'watch' ? `${nameOf(winner)} wins` : winner === 0 ? 'You win!' : 'You lose';
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const [a, b] = m.stats;
  const stats = [{ t: 'gap', h: big ? 20 : VIEW.mode === 'wide' ? 20 : 50 }, { t: 'h', label: title, size: 62, cap: big ? 1.2 : 1.5 }, { t: 'h', label: `${m.legsWon[0]} – ${m.legsWon[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' },
    { t: 'p', label: `${nameOf(0)}  vs  ${nameOf(1)}`, bold: true, color: '#ffe9bf', size: 24, cap: 2 }];
  const rows = [['3-dart average', avg3(a).toFixed(1), avg3(b).toFixed(1)], ['Highest visit', a.hi, b.hi], ['180s', a.c180, b.c180], ['100 or more', a.c100, b.c100], ['Best checkout', a.bestOut || '–', b.bestOut || '–'], ['Doubles hit', `${a.dblHit} of ${a.dblTried} (${pct(a.dblHit, a.dblTried)})`, `${b.dblHit} of ${b.dblTried} (${pct(b.dblHit, b.dblTried)})`]];
  rows.forEach(([k, x, y]) => stats.push({ t: 'p', label: `${k}:  ${x}  –  ${y}`, size: 24, cap: 2.4 }));
  if (mode === 'ai') stats.push({ t: 'p', label: `Matches won against ${PROFILES[m.cfg.opp].name}: ${(state.record.wins ?? [])[m.cfg.opp] ?? 0}`, size: 22, cap: 2, color: '#ffe9bf' });
  const buttons = [{ t: 'gap', h: 16 },
    { t: 'btn', id: 'again', label: mode === 'watch' ? 'Watch another' : 'Rematch', primary: true, h: 92 },
    { t: 'btn', id: 'new', label: 'New match', row: 6 },
    { t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true },
    // quiet brand line (text only: this build has no way to open the hub from here)
    { t: 'art', h: 54, draw(ctx, w, h) { drawMoreLine(ctx, w / 2, h / 2 + 4, Math.round(20 * fontFloor())); } },
    { t: 'gap', h: 30 }];
  return { stats, buttons };
}
export const resultWidgets = (state) => { const g = resultGroups(state); return [...g.stats, ...g.buttons]; };

export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 },
    { t: 'btn', id: 'p-coach', label: st.coach ? 'Coach: On' : 'Coach: Off', row: 8, active: st.coach },
    { t: 'btn', id: 'quit', label: 'Quit to menu', sub: 'Your match is kept', dark: true },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: VIEW.mode === 'wide' ? 40 : 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the two legs of the web demo. The full game on iPhone and Android has all five opponents, 301 and 501, matches of up to three legs and your saved records.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(6,10,8,${a * 0.7})`); g.addColorStop(0.5, `rgba(6,10,8,${a})`); g.addColorStop(1, `rgba(6,10,8,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2, fz = fontFloor();
  const fs = Math.round(22 * fz), bw = 88 * fz, bh = 32 * fz;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(6,10,8,0)'); g.addColorStop(1, 'rgba(6,10,8,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - bw / 2, bottom - bh - 8, bw, bh, bh / 2); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = '#2a1d10'; ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - bh / 2 - 8);
  } else if (scroll > 4) {
    roundPath(ctx, cx - bw / 2, top + 8, bw, bh, bh / 2); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = '#2a1d10'; ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 8 + bh / 2);
  }
}

function drawFlowScreen(ctx, state, key) {
  LAID = buildFlow(ctx, state, key);
  const { lay, top, bottom } = LAID;
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, W - 10 - Math.max(0, host.r), ty, 5, th, 3); ctx.fillStyle = 'rgba(255,240,204,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}

export function renderTitle(ctx, state) {
  drawBackdrop(ctx);
  scrim(ctx, 0.18);
  drawFlowScreen(ctx, state, 'title');
  if (LAID.lock) {      // the themed Arcforge lockup under the menu; a tap opens the Arcforge home
    const k = LAID.lock, d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
    ctx.save(); ctx.fillStyle = 'rgba(14,10,6,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.globalAlpha = dn ? 0.7 : 1; drawLockup(ctx, k.cx, k.y + k.h / 2 + (dn ? 1 : 0), k.w * (dn ? 0.96 : 1), dn ? 0.7 : 1); ctx.restore();
  }
  ctx.textAlign = 'center'; ctx.font = `400 ${Math.round(18 * fontFloor())}px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.6)'; ctx.textBaseline = 'alphabetic';
  if (state.demo) ctx.fillText('Web demo', W / 2, H - 14);
}
export function renderSetup(ctx, state) {
  drawBackdrop(ctx); scrim(ctx, 0.6);
  drawFlowScreen(ctx, state, 'setup');
  const P = SETUP_PINS, gy = P.start.y - 56, wide = VIEW.mode === 'wide', gx = wide ? wideCols().rx - 14 : 0;
  const g = ctx.createLinearGradient(0, gy, 0, H);
  g.addColorStop(0, 'rgba(6,10,8,0)'); g.addColorStop(0.2, 'rgba(6,10,8,0.88)'); g.addColorStop(1, 'rgba(6,10,8,0.96)');
  ctx.fillStyle = g; ctx.fillRect(gx, gy, W - gx, H - gy);
  drawButton(ctx, P.start, 'Start the match', { primary: true, size: 32 });
  drawButton(ctx, P.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 ${Math.round(22 * fontFloor())}px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, P.start.x + (P.back.x + P.back.w - P.start.x) / 2, P.start.y - 12); }
}
export function renderSettings(ctx, state) { drawBackdrop(ctx); scrim(ctx, 0.66); drawFlowScreen(ctx, state, 'settings'); }
export function renderResult(ctx, state) { drawBackdrop(ctx); scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'result'); }
export function renderDemoLimit(ctx, state) { drawBackdrop(ctx); scrim(ctx, 0.7); drawFlowScreen(ctx, state, 'demolimit'); }
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state), sc = scaleOf(state);
  const pw = Math.min(660, W - 60), px = Math.round((W - pw) / 2), lay = flowLayout(ctx, wd, sc, { x: px + 30, w: pw - 60 });
  const top = Math.max(70, host.back ? BACKBOX.y + BACKBOX.h + 28 : host.t + 60), bottom = H - Math.max(70, host.b + 40);
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(24,18,12,0.94)', stroke: 'rgba(233,193,95,0.55)' });
  LAID = { key: 'pause', vk: VIEW.key, lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, px, pw);
}

// ---- reference pages --------------------------------------------------------------------------
// One continuous SCROLLING reader (drag, wheel, keys, scroll bar): READER is refreshed on every draw for the input code.
export const READER = { max: 0, view: 0, y0: 0, y1: 0 };

function buildPages(ctx, list, scale) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PAGE.w - 80;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const top = PAGE.y + PAGE.head, limit = Infinity, viewH = Math.max(0, PAGE.h - PAGE.head - PAGE.foot);
  const pages = [];
  let cur = null, used = 0;
  const newPage = () => { cur = { blocks: [], fs, lh, secFs }; used = 0; pages.push(cur); };
  list.forEach((sec) => {
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    const titleH = tl.length * secFs * 1.2 + 16;
    ctx.font = `400 ${fs}px ${FONT}`;
    const lines = [];
    sec.p.forEach((para, pi) => { wrapLines(ctx, para, tw).forEach((l, k) => lines.push({ text: l, gapBefore: k === 0 && pi > 0 })); });
    const lineH = (l, n) => lh + (l.gapBefore && n > 0 ? lh * 0.45 : 0);
    const artH = sec.art ? Math.min(210, Math.max(150, viewH * 0.5)) : 0;
    let full = titleH + artH + 26;
    lines.forEach((l, k) => { full += lineH(l, k); });
    if (!cur || used + full > limit - top) newPage();
    let i = 0, part = 0;
    while (true) {
      const blk = { title: sec.title, tl, titleH, art: part === 0 ? sec.art : null, artH: part === 0 ? artH : 0, lines: [], part };
      let h = titleH + blk.artH + 26;
      while (i < lines.length) {
        const add = lineH(lines[i], blk.lines.length);
        if (used + h + add > limit - top && (blk.lines.length > 0 || used > 0)) break;
        blk.lines.push({ ...lines[i] }); h += add; i++;
      }
      cur.blocks.push(blk); used += h;
      part++;
      if (i >= lines.length) break;
      newPage();
    }
  });
  pages.forEach((pg) => { pg.total = used; });
  return pages;
}

// Wide pages: Close sits at the right and the 'Text N%' readout takes the free space on its left (never under the button).
const REF_CLOSE = () => (PAGE.wide ? { x: REF_NEXT.x, y: REF_NEXT.y, w: REF_NEXT.w, h: REF_NEXT.h } : { x: REF_BACK.x, y: REF_BACK.y, w: REF_NEXT.x + REF_NEXT.w - REF_BACK.x, h: REF_BACK.h });
const pageCache = new Map();
export const refCloseRect = () => REF_CLOSE();
export function renderPages(ctx, state, list, header) {
  drawBackdrop(ctx); scrim(ctx, 0.66);
  const sc = TEXT_SCALES[state.settings.textIdx], fz = fontFloor();
  const pkey = `${header}:${sc}:${Math.round(PAGE.w)}x${Math.round(PAGE.h)}:${PAGE.head}`;
  let pages = pageCache.get(pkey);
  if (!pages) { if (pageCache.size > 30) pageCache.clear(); pages = buildPages(ctx, list, Math.max(sc, fz)); pageCache.set(pkey, pages); }
  const pg = pages[0];
  const pcx = PAGE.x + PAGE.w / 2;
  panel(ctx, PAGE.x, PAGE.y, PAGE.w, PAGE.h, { r: 30, fill: 'rgba(247,238,214,0.97)', stroke: 'rgba(154,116,36,0.8)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.redDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, pcx, PAGE.y + 58);
  ctx.strokeStyle = 'rgba(110,76,40,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PAGE.x + 60, PAGE.y + 78); ctx.lineTo(PAGE.x + PAGE.w - 60, PAGE.y + 78); ctx.stroke();
  const cy0 = PAGE.y + PAGE.head - 6, cy1 = PAGE.y + PAGE.h - PAGE.foot;
  READER.max = Math.max(0, Math.ceil(pg.total - (cy1 - cy0 - 6))); READER.view = cy1 - cy0; READER.y0 = cy0; READER.y1 = cy1;
  state.ui.scroll = Math.max(0, Math.min(READER.max, state.ui.scroll || 0));
  ctx.save(); ctx.beginPath(); ctx.rect(PAGE.x + 4, cy0, PAGE.w - 8, cy1 - cy0); ctx.clip();
  let y = PAGE.y + PAGE.head - state.ui.scroll;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(110,76,40,0.25)'; ctx.beginPath(); ctx.moveTo(PAGE.x + 80, y - 8); ctx.lineTo(PAGE.x + PAGE.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.red; ctx.font = `700 ${pg.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l + (blk.part > 0 && k === blk.tl.length - 1 ? ' (cont.)' : ''), pcx, y + pg.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    if (blk.art) { ctx.save(); ctx.beginPath(); ctx.rect(PAGE.x + 20, y, PAGE.w - 40, blk.artH); ctx.clip(); drawArt(blk.art, ctx, PAGE.x + 40, y, PAGE.w - 80, blk.artH - 12, state); ctx.restore(); y += blk.artH; }
    ctx.fillStyle = C.ink; ctx.font = `400 ${pg.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => {
      if (l.gapBefore && k > 0) y += pg.lh * 0.45;
      ctx.fillText(l.text, PAGE.x + 40, y + pg.fs * 0.85);
      y += pg.lh;
    });
    y += 26;
  });
  ctx.restore();
  if (READER.max > 0) {
    const th = Math.max(50, (cy1 - cy0) * ((cy1 - cy0) / pg.total)), ty = cy0 + (state.ui.scroll / READER.max) * (cy1 - cy0 - th);
    roundPath(ctx, PAGE.x + PAGE.w - 14, ty, 6, th, 3); ctx.fillStyle = 'rgba(110,76,40,0.55)'; ctx.fill();
  }
  ctx.textAlign = 'center'; ctx.font = `400 ${Math.round(22 * fz)}px ${FONT}`; ctx.fillStyle = 'rgba(70,50,30,0.78)';
  const foot = `Text ${Math.round(sc * 100)}%${READER.max > 0 ? (state.ui.scroll < READER.max - 4 ? '  ·  scroll for more' : '  ·  end') : ''}`;
  if (PAGE.wide) {
    const fx0 = REF_BACK.x, fx1 = REF_CLOSE().x - 14, fw = fx1 - fx0; let fpx = Math.round(22 * fz);
    ctx.font = `400 ${fpx}px ${FONT}`; while (fpx > 12 && ctx.measureText(foot).width > fw) { fpx--; ctx.font = `400 ${fpx}px ${FONT}`; }
    ctx.fillText(foot, fx0 + fw / 2, REF_BACK.y + REF_BACK.h / 2 + 8);
  } else ctx.fillText(foot, pcx, PAGE.y + PAGE.h - 28);
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  drawButton(ctx, REF_CLOSE(), 'Close', { primary: true, size: 32 });
}

// ---- illustrations: drawn with the game's own board and darts --------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${Math.round(Math.max(size, 20) * Math.min(fontFloor(), 1.1))}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
const stage = (ctx, x, y, w, h) => {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#16261f'); g.addColorStop(1, '#0d1713');
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(154,116,36,0.7)'; ctx.lineWidth = 2; ctx.stroke();
};
function chipArt(ctx, text, x, y, size, kind) {
  ctx.font = `800 ${size}px ${NUM}`;
  const w = Math.max(size * 1.7, ctx.measureText(text).width + 22), h = size + 14;
  roundPath(ctx, x, y - h / 2, w, h, 11);
  ctx.fillStyle = kind === 'D' ? '#8c1f1b' : kind === 'T' ? '#1d5e37' : '#2a2018'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#e9c15f'; ctx.stroke();
  ctx.fillStyle = '#fff6df'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + w / 2, y + 2);
  return w;
}
function arrow(ctx, x0, y0, x1, y1, col = '#ffd36a', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    board() {
      stage(ctx, 0, 0, w, h);
      const R = (h - 36) / 1.22 / 2;
      drawBoard(ctx, w * 0.3, h / 2, R, { shadow: false, numbers: true });
      label(ctx, 'Clockwise from the top:', w * 0.62, h * 0.3, 20, '#fff2cf', 'left');
      label(ctx, '20 1 18 4 13 6 10 15 2 17', w * 0.62, h * 0.3 + 30, 20, '#ffe08a', 'left');
      label(ctx, '3 19 7 16 8 11 14 9 12 5', w * 0.62, h * 0.3 + 58, 20, '#ffe08a', 'left');
      label(ctx, 'Black ring: the numbers', w * 0.62, h * 0.3 + 100, 18, '#fff2cf', 'left');
    },
    rings() {
      stage(ctx, 0, 0, w, h);
      const R = (h - 30) / 2.4;
      const cx = w * 0.26, cy = h * 0.5;
      drawBoard(ctx, cx, cy, R, { shadow: false, numbers: false });
      const items = [['Double  (x2)', 'D20', 0.12, '#ffb4a0'], ['Treble  (x3)', 'T20', 0.34, '#9fe8b4'], ['Single', '20', 0.56, '#fff2cf'], ['Outer bull  25  ·  Bull  50', 'Bull', 0.78, '#ffd36a']];
      items.forEach(([t, lb, f, col]) => { label(ctx, t, w * 0.5, h * f + 28, 22, col, 'left'); });
      ctx.save();
      regionPath(ctx, 'D20', cx, cy, R); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
      regionPath(ctx, 'T20', cx, cy, R); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
      ctx.restore();
    },
    hold() {
      stage(ctx, 0, 0, w, h);
      const cx = w * 0.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(cx, h * 0.72); ctx.lineTo(cx, h * 0.34); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(cx, h * 0.75, 30, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke();
      label(ctx, 'finger', cx + 100, h * 0.8, 20, '#fff2cf');
      ctx.strokeStyle = '#7dffa0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, h * 0.34, 24, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 36, h * 0.34); ctx.lineTo(cx - 14, h * 0.34); ctx.moveTo(cx + 14, h * 0.34); ctx.lineTo(cx + 36, h * 0.34); ctx.moveTo(cx, h * 0.34 - 36); ctx.lineTo(cx, h * 0.34 - 14); ctx.moveTo(cx, h * 0.34 + 14); ctx.lineTo(cx, h * 0.34 + 36); ctx.stroke();
      label(ctx, 'aim point', cx + 110, h * 0.3, 20, '#7dffa0');
    },
    steady() {
      stage(ctx, 0, 0, w, h);
      const x0 = 36, x1 = w - 30, y0 = h - 40, y1 = 30;
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
      const T = 5.6, X = (t) => x0 + ((x1 - x0) * t) / T;
      const amp = (t) => { const s = Math.min(1, t / 1.4), sm = s * s * (3 - 2 * s); let a = 62 + (22 - 62) * sm; if (t > 2.4) a = Math.min(74, 22 + (t - 2.4) * 17); return a; };
      const Y = (a) => y0 - ((y0 - y1) * (a - 10)) / 70;
      ctx.lineWidth = 5; ctx.lineCap = 'round';
      for (let t = 0; t < T; t += 0.05) { const t2 = t + 0.05; ctx.strokeStyle = t < 1.4 ? '#ffb347' : t < 2.4 ? '#7dffa0' : '#ff7a5c'; ctx.beginPath(); ctx.moveTo(X(t), Y(amp(t))); ctx.lineTo(X(t2), Y(amp(t2))); ctx.stroke(); }
      label(ctx, 'settling', X(0.7), y0 + 24, 17, '#ffb347'); label(ctx, 'steady', X(1.9), y0 + 24, 17, '#7dffa0'); label(ctx, 'tiring', X(4), y0 + 24, 17, '#ff7a5c');
      label(ctx, 'wider drift', x0 + 8, y1 + 4, 17, '#fff2cf', 'left');
    },
    bust() {
      stage(ctx, 0, 0, w, h);
      const rows = [['Score 40', 'D20', 'wins the leg'], ['Score 40', '20 then 20', 'zero on a single: bust'], ['Score 21', '20', 'leaves 1: bust'], ['Score 32', 'T20', 'goes below 0: bust']];
      rows.forEach(([a, b, c], i) => {
        const yy = h * (0.17 + i * 0.22);
        label(ctx, a, 24, yy + 8, 20, '#fff2cf', 'left');
        const cw = chipArt(ctx, b.split(' then ')[0], 150, yy, 22, b[0] === 'D' ? 'D' : b[0] === 'T' ? 'T' : '');
        if (b.includes('then')) chipArt(ctx, b.split(' then ')[1], 150 + cw + 10, yy, 22, '');
        label(ctx, c, 330, yy + 8, 19, i === 0 ? '#9fe8b4' : '#ffb4a0', 'left');
      });
    },
    checkout() {
      stage(ctx, 0, 0, w, h);
      const rows = [['170', ['T20', 'T20', 'Bull']], ['100', ['T20', 'D20']], ['40', ['D20']], ['57 (one dart left)', ['17'], 'leaves 40, then D20']];
      rows.forEach(([s, rt, note], i) => {
        const yy = h * (0.17 + i * 0.22);
        label(ctx, s, 24, yy + 9, 24, '#ffe08a', 'left');
        // the chips start after the label (a long label pushes them right instead of running into them)
        ctx.font = `700 24px ${FONT}`; let cx = Math.max(230, 24 + ctx.measureText(s).width + 18);
        rt.forEach((lb) => { cx += chipArt(ctx, lb, cx, yy, 24, lb[0] === 'D' || lb === 'Bull' ? 'D' : lb[0] === 'T' ? 'T' : '') + 10; });
        if (note) label(ctx, note, w - 16, yy + 8, 17, '#fff2cf', 'right');   // on the row itself, so it can never fall below the illustration box
      });
    },
    bounce() {
      stage(ctx, 0, 0, w, h);
      const cx = w * 0.3, cy = h * 0.5, R = 95;
      drawBoard(ctx, cx, cy, R, { shadow: false, numbers: false });
      drawDart(ctx, cx + 8, cy - 62, { scale: 0.42, ang: wobbleAng(1, 0, 0), style: 0, shadow: false });
      drawDart(ctx, cx + 34, cy - 70, { scale: 0.42, ang: -0.6 + 0.25, style: 0, alpha: 0.55, shadow: false });
      arrow(ctx, cx + 40, cy - 74, cx + 78, cy - 112, '#ffb4a0', 4);
      label(ctx, 'Bounced out: scores 0', w * 0.56, h * 0.36, 21, '#ffb4a0', 'left');
      label(ctx, 'on a wire, or on a dart', w * 0.56, h * 0.36 + 28, 19, '#fff2cf', 'left');
      label(ctx, 'already in the board', w * 0.56, h * 0.36 + 54, 19, '#fff2cf', 'left');
    },
  };
  (A[key] ?? A.board)();
  ctx.restore();
}
