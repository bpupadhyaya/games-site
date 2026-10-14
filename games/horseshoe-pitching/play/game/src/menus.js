// Every screen that is not the play screen: title, setup, settings, result, pause, demo limit, and the scrolling About / How to
// Play / Rules reader with its illustrations (drawn with the game's own shoes and pit). Pure drawing; game.js owns state.
// Every position comes from the live layout L (layout.js).
import { PITS, PIT_IDS, FLIPS, SIX, SWING, CL, HALF_T, TIP, windowDeg } from './sim.js';
import { drawLane, drawBoard, TEAM, CAM_CLOSE } from './view.js';
import { TEXT_SCALES, THINK_STEPS, host } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit, metalText } from './ui.js';
import { PROFILES } from './ai.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { drawLockup, drawMoreLine } from './brand.js';

const TAU = Math.PI * 2;
const PIT_NOTE = { clay: PITS.clay.note, sand: PITS.sand.note, hard: PITS.hard.note, daily: 'A new surface every day.' };

// ---- flow screens ------------------------------------------------------------------------------------------------------------
let LAID = { key: '', size: '', cols: [], max: 0, est: false };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };

function shoeIcon(ctx, x, y, s, rot, fill, line = 'rgba(255,255,255,0.85)') {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  const ro = CL + HALF_T, ri = CL - HALF_T;
  ctx.beginPath(); ctx.moveTo(-ro, -TIP);
  for (let i = 0; i <= 16; i++) { const q = Math.PI + (Math.PI * i) / 16; ctx.lineTo(ro * Math.cos(q), -ro * Math.sin(q)); }
  ctx.lineTo(ro, -TIP); ctx.lineTo(ri, -TIP);
  for (let i = 16; i >= 0; i--) { const q = Math.PI + (Math.PI * i) / 16; ctx.lineTo(ri * Math.cos(q), -ri * Math.sin(q)); }
  ctx.lineTo(-ri, -TIP); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 0.012; ctx.strokeStyle = line; ctx.stroke();
  ctx.restore();
}

const HERO_TOP = 292;   // the lettering occupies the top of the hero sheet; below it (GL on) the 3D scene shows through
const heroArt = (h = 400, gl = false) => ({
  t: 'art', h, gl,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const s = Math.min(1, w / 640, gl ? Math.max(0.5, h / 300) : h / 400); ctx.scale(s, s);   // the art is drawn on a 640-unit wide sheet
    const cx = w / s / 2;
    const fit = (txt, px, maxW) => { ctx.font = `700 ${px}px ${DISPLAY}`; while (ctx.measureText(txt).width > maxW && px > 20) { px -= 2; ctx.font = `700 ${px}px ${DISPLAY}`; } return px; };
    if (gl) {
      const p1 = fit('HORSESHOE', 112, 600); metalText(ctx, 'HORSESHOE', cx, 126, p1, { kind: 'steel' });
      const p2 = fit('PITCHING', 84, 520); metalText(ctx, 'PITCHING', cx, 216, p2, { kind: 'gold' });
      // a ribbon under the lettering
      const tw = 560, ty = 242;
      ctx.fillStyle = 'rgba(24,12,4,0.78)'; roundPath(ctx, cx - tw / 2, ty, tw, 40, 20); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,226,150,0.8)'; ctx.stroke();
      ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffe9c0'; ctx.fillText('FORTY FEET, ONE STAKE, THREE FOR A RINGER', cx, ty + 28, tw - 24);
      ctx.restore();
      return;
    }
    fit('HORSESHOE', 112, 600); textShadow(ctx, 'HORSESHOE', cx, 128, '#f7f2e6', 14);
    fit('PITCHING', 84, 520); textShadow(ctx, 'PITCHING', cx, 220, '#f6c445', 12);
    ctx.font = `600 25px ${FONT}`; textShadow(ctx, 'FORTY FEET, ONE STAKE, THREE FOR A RINGER', cx, 266, '#ffe9c8', 6);
    shoeIcon(ctx, cx - 110, 360, 560, -0.3, TEAM[0].main); shoeIcon(ctx, cx + 110, 360, 560, 0.3, TEAM[1].main);
    // the stake between them
    const g = ctx.createRadialGradient(cx - 3, 352, 1, cx, 360, 14);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#68727e'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, 360, 11, 0, TAU); ctx.fill();
    ctx.restore();
  },
});

// tier 0: tall phones; 1: shorter screens (hero 330); 2: tablets held upright (everything on one screen, a little tighter)
export function titleWidgets(state, tier = 0, heroH = 0) {
  const k = tier === 3 ? 0.66 : tier === 2 ? 0.84 : 1, base = tier === 3 ? 200 : tier === 2 ? 250 : tier === 1 ? 330 : 400;
  const hero = heroArt(Math.max(heroH, state.useGL ? Math.min(base, 300) : base), !!state.useGL);
  const H = (n) => Math.round(n * k), sub = (t) => (tier === 3 ? undefined : t);
  return [
    hero,
    { t: 'btn', id: 'play', label: 'Play vs Computer', primary: true, h: H(92) },
    { t: 'btn', id: 'doubles', label: 'Doubles', sub: sub('you and a partner against two rivals'), h: H(84) },
    { t: 'btn', id: 'two', label: 'Two Players', h: H(80) },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: sub('two rivals play; see why'), h: H(84) },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 1, h: H(76) }, { t: 'btn', id: 'rules', label: 'Rules', row: 1, h: H(76) },
    { t: 'btn', id: 'about', label: 'About', row: 2, h: H(76) }, { t: 'btn', id: 'settings', label: 'Settings', row: 2, h: H(76) },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: on' : 'Sound: off', dark: true, h: H(70) },
  ];
}

export function setupParts(state) {
  const s = state.setup, two = s.mode === 'two';
  const title = s.mode === 'two' ? 'Two Players' : s.mode === 'doubles' ? 'Doubles' : 'Play vs Computer';
  const head = [{ t: 'h', label: title, size: 40 }];
  const rivals = [{ t: 'h', label: s.mode === 'doubles' ? 'Your rivals' : 'Your rival', size: 30 },
    ...PROFILES.map((p, i) => ({ t: 'btn', id: `opp${i}`, label: p.name, sub: `${'★'.repeat(p.stars)}${'☆'.repeat(5 - p.stars)}  ${p.tag}`, active: s.opp === i, disabled: state.demo && i > 1, hitDisabled: true, h: 84 }))];
  const pits = [{ t: 'h', label: 'The pit', size: 30 }, ...[...PIT_IDS, 'daily'].map((c) => ({ t: 'btn', id: `pit${c}`, label: c === 'daily' ? 'Daily Pit' : PITS[c].name, sub: PIT_NOTE[c], active: s.pit === c, disabled: state.demo && c !== 'clay', hitDisabled: true, h: 84 }))];
  const length = [{ t: 'h', label: 'Match length', size: 30 },
    { t: 'btn', id: 'len21', label: 'First to 21', active: s.target === 21, h: 80, row: 7 }, { t: 'btn', id: 'len11', label: 'Quick: 11', active: s.target === 11, h: 80, row: 7 }];
  if (state.setupMsg) length.push({ t: 'p', label: state.setupMsg, size: 24, color: '#ffd27a', bold: true });
  if (s.mode === 'doubles') length.push({ t: 'p', label: 'You and Sunny play as the blue side. The two of you pitch from opposite ends, so you take every other inning.', size: 22 });
  if (state.demo) length.push({ t: 'p', label: 'The web demo plays three innings against the first two rivals on Packed Clay.', size: 22 });
  return { head, rivals: two ? [] : rivals, pits, length };
}
export function setupWidgets(state) { const p = setupParts(state); return [...p.head, ...p.rivals, ...p.pits, ...p.length]; }

export function settingsParts(state) {
  const st = state.settings;
  const a = [
    { t: 'h', label: 'Settings', size: 42 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: on' : 'Sound: off', active: st.sound, h: 80 },
    { t: 'btn', id: 'set-calm', label: st.calm ? 'Release window: wide' : 'Release window: normal', sub: 'a wider green is easier to hit', active: st.calm, h: 92 },
    { t: 'btn', id: 'set-slow', label: st.slow ? 'Arm swing: slow' : 'Arm swing: normal', sub: 'a slower arm is easier to time', active: st.slow, h: 92 },
    { t: 'p', label: `Text size ${Math.round(TEXT_SCALES[st.textIdx] * 100)}%`, size: 26, bold: true },
    { t: 'btn', id: 'txt-dec', label: 'Smaller text', row: 1, disabled: st.textIdx === 0, h: 76 }, { t: 'btn', id: 'txt-inc', label: 'Larger text', row: 1, disabled: st.textIdx === TEXT_SCALES.length - 1, h: 76 },
  ];
  const b = [
    { t: 'p', label: `Watch & Learn thinking time ${THINK_STEPS[st.thinkIdx]} s`, size: 26, bold: true },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 2, disabled: st.thinkIdx === 0, h: 76 }, { t: 'btn', id: 'think-inc', label: 'Longer', row: 2, disabled: st.thinkIdx === THINK_STEPS.length - 1, h: 76 },
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'restore', label: 'Restore purchase', h: 80 },
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 22 }] : []),
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 88 },
  ];
  return { a, b };
}
export function settingsWidgets(state) { const p = settingsParts(state); return [...p.a, ...p.b]; }

const trophyArt = (win, h) => ({
  t: 'art', h,
  draw(ctx, w) {
    ctx.save(); ctx.translate(w / 2, h / 2);
    const g = ctx.createRadialGradient(0, -10, 6, 0, 0, 90);
    g.addColorStop(0, win ? '#fff0a8' : '#cfd8e6'); g.addColorStop(1, win ? '#d9941c' : '#5d6f88');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 70, 0, TAU); ctx.fill();
    shoeIcon(ctx, 0, 8, 250, 0, win ? '#8a5a12' : '#34465c', 'rgba(255,255,255,0.6)');
    ctx.restore();
  },
});
export function resultParts(state) {
  const m = state.m, c = m.cfg, win = m.over && m.over.win === 0;
  const two = c.mode === 'two', watch = c.mode === 'watch';
  const winner = m.over ? state.labels[m.over.win].name : '';
  const title = two || watch ? `${winner} wins` : win ? 'You win!' : `${winner} wins`;
  const words = [
    trophyArt(win || two || watch, 150),
    { t: 'h', label: title, size: 54, cap: 1.4 },
    { t: 'p', label: `${m.scores[0]} – ${m.scores[1]}  after ${m.history.length} ${m.history.length === 1 ? 'inning' : 'innings'}`, size: 34, bold: true },
    { t: 'p', label: `Ringers: ${m.ringers[0]} – ${m.ringers[1]}`, size: 26 },
  ];
  if (m.over && m.over.shutout && win && !two && !watch) words.push({ t: 'p', label: 'A shutout: they never scored.', size: 26 });
  if (c.mode === 'ai') words.push({ t: 'p', label: `Wins against ${PROFILES[c.opp].name}: ${state.record.wins[c.opp]}  ·  streak ${state.record.streak}`, size: 24 });
  const btns = [
    { t: 'btn', id: 'again', label: 'Play again', primary: true, h: 92 },
    { t: 'btn', id: 'new', label: 'New setup', h: 80 },
    { t: 'btn', id: 'menu', label: 'Main menu', h: 80 },
  ];
  return { words, btns };
}
export function resultWidgets(state) { const p = resultParts(state); return [...p.words, ...p.btns]; }

export function pauseWidgets(state) {
  return [
    { t: 'h', label: 'Paused', size: 46 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 92 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 1, h: 76 }, { t: 'btn', id: 'p-howto', label: 'How to Play', row: 1, h: 76 },
    { t: 'btn', id: 'p-sound', label: state.settings.sound ? 'Sound: on' : 'Sound: off', row: 2, h: 76 },
    { t: 'btn', id: 'p-calm', label: state.settings.calm ? 'Wide window: on' : 'Wide window: off', row: 2, h: 76 },
    { t: 'btn', id: 'quit', label: 'Leave match', dark: true, h: 80 },
  ];
}
export function demoLimitWidgets() {
  return [
    { t: 'h', label: 'That was the free preview', size: 40 },
    { t: 'p', label: 'The web demo plays three innings. The full game for iPhone and Android has every rival, every pit and the Daily Pit, with no limits.', size: 26 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true, h: 90 },
  ];
}

// ---- layout of columns --------------------------------------------------------------------------------------------------------
const lockSize = (L) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), Math.max(180, (L.wide ? L.w / 2 : L.w) - 80)); const h = (w * 327) / 1200; return { w, h, strip: Math.round(h + 26) }; };
function screenCols(state, key, L) {
  const w = L.w, I = L.ins, one = (widgets, cw = 640, top = I.t, bottom = L.sb) => { const cwi = Math.min(cw, w - 80); return [{ widgets, x: (w - cwi) / 2, w: cwi, top, bottom }]; };
  const side = Math.max(I.l, I.r);
  if (key === 'title') {
    const strip = lockSize(L).strip, sc0 = TEXT_SCALES[state.settings.textIdx], base = L.wide ? 0 : L.sb < 1000 ? 2 : L.sb < 1100 ? 1 : 0;
    const cw0 = L.wide ? Math.min(500, L.w / 2 - 40 - side) : Math.min(640, L.w - 80), avail = L.wide ? L.sb - 8 - strip - (Math.max(I.t, 0) + 8) : L.sb - strip - Math.max(Math.round(Math.max(0, L.sb - 1280) * 0.2), I.t);
    let tier = base;   // tighten step by step until the whole menu is visible without scrolling
    for (const t of L.wide ? [0, 3] : base < 2 ? [base, 1, 2, 3] : [base, 3]) { tier = t; if (flowLayout(estCtx, titleWidgets(state, t).slice(L.wide ? 1 : 0), sc0, { x: 0, w: cw0 }).contentH <= avail) break; }
    let heroH = 0;
    if (state.useGL) {   // with the 3D scene behind, the hero sheet grows to the free height: lettering on top, a window for the pitcher below it
      const restH = flowLayout(estCtx, titleWidgets(state, tier).slice(1), sc0, { x: 0, w: cw0 }).contentH;
      heroH = L.wide ? Math.max(300, Math.round(L.sb - 16 - strip - (Math.max(I.t, 0) + 8) - 10)) : Math.max(0, Math.min(560, Math.round(avail - restH - 70)));
      if (L.wide) heroH = Math.min(heroH, 900);
    }
    const wd = titleWidgets(state, tier, heroH);
    if (!L.wide) { const off = Math.round(Math.max(0, L.sb - 1280) * 0.2); return one(wd, 640, Math.max(off, I.t), L.sb - strip); }
    const cw = Math.min(500, w / 2 - 40 - side), lw = Math.min(560, w / 2 - 40 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 8;
    return [{ widgets: [wd[0]], x: w / 4 - lw / 2, w: lw, top, bottom: bot, center: true, shift: -26 }, { widgets: wd.slice(1), x: (3 * w) / 4 - cw / 2, w: cw, top, bottom: bot - strip, center: true }];
  }
  if (key === 'setup') {
    if (!L.wide) return one(setupWidgets(state)).map((c) => ({ ...c, ...L.setup.cols[0] }));
    const p = setupParts(state), two = state.setup.mode === 'two', cols = L.setup.cols;
    if (two) return [{ widgets: [...p.head, ...p.pits], ...cols[0] }, { widgets: p.length, ...cols[1] }, { widgets: [], ...cols[2] }];
    return [{ widgets: p.rivals, ...cols[0] }, { widgets: [...p.head, ...p.pits], ...cols[1] }, { widgets: p.length, ...cols[2] }];
  }
  if (key === 'settings') {
    if (!L.wide) return one(settingsWidgets(state));
    const p = settingsParts(state), cw = Math.min(520, w / 2 - 30 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 8;
    return [{ widgets: p.a, x: w / 2 - cw - 14, w: cw, top, bottom: bot, center: true }, { widgets: [{ t: 'gap', h: 58 }, ...p.b], x: w / 2 + 14, w: cw, top, bottom: bot, center: true }];
  }
  if (key === 'demolimit') return one(demoLimitWidgets());
  if (key === 'result') {
    if (!L.wide) return one(resultWidgets(state));
    const p = resultParts(state), cw = Math.min(480, w / 2 - 40 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 40;
    return [{ widgets: p.words, x: w / 4 - cw / 2, w: cw, top, bottom: bot, center: true }, { widgets: p.btns, x: (3 * w) / 4 - Math.min(440, cw) / 2, w: Math.min(440, cw), top, bottom: bot, center: true }];
  }
  return [];
}
function layColumns(ctx, state, key, L) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const cols = screenCols(state, key, L).map((c) => ({ ...c, lay: flowLayout(ctx, c.widgets, sc, { x: c.x, w: c.w }) }));
  let max = 0;
  for (const c of cols) { c.off = c.center ? Math.max(0, (c.bottom - c.top - c.lay.contentH) / 2) + (c.shift ?? 0) : 0; max = Math.max(max, c.lay.contentH - (c.bottom - c.top)); }
  const out = { key, size: L.key, cols, max: Math.max(0, max) };
  if (key === 'title') {
    const c0 = cols[0], art = c0.lay.items.find((it) => it.w.t === 'art');
    if (art && art.w.gl) { const sk = Math.min(1, art.wd / 640, Math.max(0.5, art.h / 300)); out.heroWin = { x: art.x, y: c0.top + c0.off + art.y + HERO_TOP * sk, w: art.wd, h: Math.max(60, art.h - HERO_TOP * sk) }; }
    const ls = lockSize(L), bc = cols[cols.length - 1], used = bc.top + bc.off + bc.lay.contentH, cx = L.wide ? (3 * L.w) / 4 : L.w / 2;
    const pinned = L.sb - ls.h - 12, y = Math.min(used + 12, pinned), mm = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(ls.w + 24, mm), th = Math.max(ls.h + 12, mm);
    out.lock = { cx, y, w: ls.w, h: ls.h, tap: { x: cx - tw / 2, y: y - 4, w: tw, h: Math.max(th, ls.h + 8) } };
  }
  return out;
}
export function ensureLayout(state, key, L) {
  if (LAID.key === key && LAID.size === L.key && LAID.cols.length) return;
  if (!['title', 'setup', 'settings', 'result', 'demolimit'].includes(key)) return;
  LAID = { ...layColumns(estCtx, state, key, L), est: true };
}
export function hitScreen(x, y, scroll) {
  { const t = LAID.lock && LAID.lock.tap; if (t && x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return 'arcforge'; }
  for (const c of LAID.cols) {
    const id = flowHit(c.lay, c.top + c.off, Math.min(scroll, Math.max(0, c.lay.contentH - (c.bottom - c.top))), x, y);
    if (id && y >= c.top && y <= c.bottom) return id;
  }
  return null;
}
export const lockupZone = () => (LAID.lock ? LAID.lock.tap : null);
export function flowRects(scroll) {
  const out = [];
  for (const c of LAID.cols) {
    const sc = Math.min(scroll, Math.max(0, c.lay.contentH - (c.bottom - c.top)));
    for (const it of c.lay.items) if (it.w.t === 'btn') out.push({ id: it.w.id, x: it.x, y: c.top + c.off + it.y - sc, w: it.wd, h: it.h, clip: { top: c.top, bottom: c.bottom } });
  }
  return out;
}

// ---- backdrop: the lane in late sun with the attract pitcher at work ---------------------------------------------------------
function backdrop(ctx, L, state) {
  if (state.useGL) return;     // the 3D scene is behind the (transparent) canvas
  const a = state.att;
  drawLane(ctx, { x: 0, y: 0, w: L.w, h: L.h }, { cam: { ...a.cam, fov: 34 }, shoes: a.shoes, fly: a.fly, parts: a.parts, t: state.t, pitClay: '#b2693b' });
}
function scrim(ctx, L, a = 0.5, state = null) {
  if (state && state.useGL) a *= 0.72;
  const g = ctx.createLinearGradient(0, 0, 0, L.h);
  g.addColorStop(0, `rgba(8,20,34,${a * 0.5})`); g.addColorStop(0.5, `rgba(8,20,34,${a})`); g.addColorStop(1, `rgba(8,20,34,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0, w) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(8,20,34,0)'); g.addColorStop(1, 'rgba(8,20,34,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(247,242,230,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(247,242,230,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
function drawFlowScreen(ctx, state, key, L) {
  LAID = layColumns(ctx, state, key, L);
  state.heroWin = key === 'title' ? LAID.heroWin || null : null;
  const scroll = Math.min(state.ui.scroll, LAID.max);
  for (const c of LAID.cols) {
    const range = Math.max(0, c.lay.contentH - (c.bottom - c.top)), sc = Math.min(scroll, range), top = c.top + c.off;
    drawFlow(ctx, c.lay, top, c.bottom, sc, { clipX: c.x - 24, clipW: c.w + 48 });
    if (range > 0) {
      const th = Math.max(60, (c.bottom - c.top) * ((c.bottom - c.top) / c.lay.contentH)), ty = c.top + (sc / range) * (c.bottom - c.top - th);
      roundPath(ctx, c.x + c.w + 6, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,248,224,0.5)'; ctx.fill();
      scrollHint(ctx, c.top, c.bottom, sc, range, c.x, c.w);
    }
  }
}

export function renderTitle(ctx, state, L) {
  backdrop(ctx, L, state);
  scrim(ctx, L, 0.42, state);
  drawFlowScreen(ctx, state, 'title', L);
  const lk = LAID.lock;
  if (lk) drawLockup(ctx, lk.cx, lk.y, lk.w, 0.92);
}
export function renderSetup(ctx, state, L) {
  backdrop(ctx, L, state); scrim(ctx, L, 0.66, state);
  drawFlowScreen(ctx, state, 'setup', L);
  drawButton(ctx, L.pins.start, 'Start', { primary: true, size: 36 });
  drawButton(ctx, L.pins.back, 'Back', { size: 32 });
}
export function renderSettings(ctx, state, L) { backdrop(ctx, L, state); scrim(ctx, L, 0.66, state); drawFlowScreen(ctx, state, 'settings', L); }
export function renderResult(ctx, state, L) {
  backdrop(ctx, L, state); scrim(ctx, L, 0.62, state);
  drawFlowScreen(ctx, state, 'result', L);
  drawMoreLine(ctx, L.w / 2, L.sb - 14, 20);
}
export function renderDemoLimit(ctx, state, L) { backdrop(ctx, L, state); scrim(ctx, L, 0.66, state); drawFlowScreen(ctx, state, 'demolimit', L); }
export function renderPause(ctx, state, L) {
  scrim(ctx, L, 0.6, state);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const cardW = Math.min(660, L.w - 60 - 2 * Math.max(L.ins.l, L.ins.r)), cw = cardW - 60, cx = L.w / 2;
  const lay = flowLayout(ctx, wd, sc, { x: cx - cw / 2, w: cw });
  const top = Math.max(L.ins.t, 0) + (L.wide ? 20 : 70), bottom = L.sb - (L.wide ? 20 : 70);
  const ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (L.h - ch) / 2);
  panel(ctx, cx - cardW / 2, y0 - 20, cardW, ch + 40, { r: 30, fill: 'rgba(16,36,58,0.95)', stroke: 'rgba(255,226,138,0.5)' });
  LAID = { key: 'pause', size: L.key, cols: [{ lay, x: cx - cw / 2, w: cw, top: y0, bottom: y0 + ch, off: 0 }], max: Math.max(0, lay.contentH - ch), est: false };
  const sc0 = Math.min(state.ui.scroll, LAID.max);
  drawFlow(ctx, lay, y0, y0 + ch, sc0, { clipX: cx - cardW / 2, clipW: cardW });
  scrollHint(ctx, y0, y0 + ch, sc0, LAID.max, cx - cardW / 2, cardW);
}

// ---- reference pages (one continuous scrolling reader) ----------------------------------------------------------------------------
export const REF = { max: 0, view: 400 };
export const pageCount = () => 1;
function buildFlow(ctx, list, scale, PANEL) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 80, secFs = Math.round(34 * Math.min(scale, 1.3));
  const items = [];
  let y = 6;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ t: 'rule', y }); y += 20; }
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    items.push({ t: 'title', tl, y });
    y += tl.length * secFs * 1.2 + 16;
    if (sec.art && scale <= 2) { items.push({ t: 'art', art: sec.art, y }); y += 210; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => {
      if (pi > 0) y += lh * 0.45;
      wrapLines(ctx, para, tw).forEach((l) => { items.push({ t: 'line', text: l, y }); y += lh; });
    });
    y += 26;
  });
  return { items, fs, lh, secFs, total: y + 10 };
}
const pageCache = new Map();
export function renderPages(ctx, state, list, header, L) {
  backdrop(ctx, L, state); scrim(ctx, L, 0.72, state);
  const PANEL = L.ref.panel, sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let fl = pageCache.get(pkey);
  if (!fl) { fl = buildFlow(ctx, list, sc, PANEL); pageCache.set(pkey, fl); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, top = PANEL.y + 96, viewH = Math.max(60, PANEL.h - 96 - 70);
  REF.max = Math.max(0, Math.ceil(fl.total - viewH)); REF.view = viewH;
  state.refScroll = Math.max(0, Math.min(REF.max, state.refScroll || 0));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(250,246,236,0.97)', stroke: 'rgba(30,50,80,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.coralDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(30,60,90,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(30,60,90,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.coralDark; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { const aw = Math.min(PANEL.w - 80, 620); ctx.save(); ctx.beginPath(); ctx.rect(pcx - aw / 2 - 20, y, aw + 40, 210); ctx.clip(); drawArt(it.art, ctx, pcx - aw / 2, y, aw, 198, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, (viewH * viewH) / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(30,60,90,0.15)'; roundPath(ctx, PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(30,60,90,0.55)'; roundPath(ctx, PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(30,50,70,0.75)';
  ctx.fillText(`text ${Math.round(sc * 100)}%`, pcx, PANEL.y + PANEL.h - 28);
  drawButton(ctx, L.ref.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, L.ref.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  drawButton(ctx, L.ref.back, 'Back', { size: 32 });
  drawButton(ctx, L.ref.next, 'Done', { primary: true, size: 32 });
}

// ---- illustrations -----------------------------------------------------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
function clayStrip(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#a35f35'); g.addColorStop(1, '#c98c55');
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = '#5d3a1d'; ctx.stroke();
}
function stakeDot(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
  g.addColorStop(0, '#fff'); g.addColorStop(0.5, '#c8d0d8'); g.addColorStop(1, '#58626d');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#2c333b'; ctx.stroke();
}
function arrow(ctx, x0, y0, x1, y1, col = C.coralDark, wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    shoe() {
      clayStrip(ctx, 0, 0, w, h);
      shoeIcon(ctx, w * 0.3, h * 0.62, 760 * (h / 700), 0, TEAM[0].main);
      stakeDot(ctx, w * 0.3, h * 0.5, 8);
      shoeIcon(ctx, w * 0.74, h * 0.62, 760 * (h / 700), 0.5, TEAM[1].main);
      stakeDot(ctx, w * 0.74 + 36, h * 0.5 + 8, 8);
      label(ctx, 'ringer: the stake is inside', w * 0.3, h - 14, 19); label(ctx, 'not a ringer', w * 0.74, h - 14, 19);
    },
    pit() {
      clayStrip(ctx, 0, 0, w, h);
      const cx = w * 0.5, cy = h * 0.5, k = h * 0.9;
      ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(255,248,214,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, (SIX + 0.0127) * k * 2.4, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      stakeDot(ctx, cx, cy, 8);
      shoeIcon(ctx, cx - 70, cy + 8, 700 * (h / 700), 0.4, TEAM[0].main); shoeIcon(ctx, cx + 80, cy - 22, 700 * (h / 700), -0.9, TEAM[1].main);
      label(ctx, '6 in. ring: a shoe inside it can score 1', cx, h - 14, 19, '#fff6e0');
    },
    flips() {
      roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = '#16314a'; ctx.fill();
      const x1 = w * 0.25, x2 = w * 0.75, cy = h * 0.5;
      for (const [cx, turns, name] of [[x1, 0.75, FLIPS[0].name], [x2, 1.25, FLIPS[1].name]]) {
        ctx.strokeStyle = '#6ec1ff'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(cx, cy, 44, -Math.PI / 2, -Math.PI / 2 + turns * TAU * (turns > 1 ? 0.8 : 1)); ctx.stroke();
        shoeIcon(ctx, cx, cy + 4, 330, 0, '#e8eef4');
        label(ctx, `${turns === 0.75 ? '¾' : '1¼'} turn`, cx, cy + 82, 24, '#fff'); label(ctx, name, cx, h - 14, 18, '#bfe0ff');
      }
    },
    gauge() {
      roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = '#16314a'; ctx.fill();
      const cx = w / 2, cy = h - 16, R = h * 0.7, rad = (d) => ((d - 90) * Math.PI) / 180;
      ctx.lineCap = 'butt'; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 20; ctx.beginPath(); ctx.arc(cx, cy, R, rad(-SWING.A), rad(SWING.A)); ctx.stroke();
      const W = windowDeg(0, false);
      ctx.strokeStyle = '#2ca866'; ctx.beginPath(); ctx.arc(cx, cy, R, rad(SWING.mark - W), rad(SWING.mark + W)); ctx.stroke();
      ctx.strokeStyle = '#c9ffe0'; ctx.beginPath(); ctx.arc(cx, cy, R, rad(SWING.mark - W * 0.35), rad(SWING.mark + W * 0.35)); ctx.stroke();
      const a = rad(30); ctx.strokeStyle = '#ffe28a'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
      label(ctx, 'early: short', 14, h - 14, 18, '#cfe3f5', 'left'); label(ctx, 'late: long', w - 14, h - 14, 18, '#cfe3f5', 'right'); label(ctx, 'release in the green', cx, 28, 20, '#9dffc7');
    },
    score() {
      clayStrip(ctx, 0, 0, w, h);
      stakeDot(ctx, w * 0.5, h * 0.5, 8);
      shoeIcon(ctx, w * 0.5 - 4, h * 0.5 + 8, 700 * (h / 700), 0, TEAM[0].main);
      shoeIcon(ctx, w * 0.5 + 80, h * 0.5 - 20, 700 * (h / 700), -0.8, TEAM[1].main);
      label(ctx, 'blue ringer = 3', w * 0.5 - 6, 34, 20, '#fff6e0'); label(ctx, 'red shoe in the ring = 1', w * 0.5 + 100, h - 18, 18, '#fff6e0');
    },
    aim() {
      clayStrip(ctx, 0, 0, w, h);
      const cx = w * 0.55, cy = h * 0.45;
      stakeDot(ctx, cx, cy, 8);
      ctx.setLineDash([7, 6]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(cx - 6, cy + 14, 60, 66, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      shoeIcon(ctx, cx - 6, cy + 14, 700 * (h / 700), 0, 'rgba(255,255,255,0.25)', '#8cc4ff');
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 16, cy + 14); ctx.lineTo(cx + 4, cy + 14); ctx.moveTo(cx - 6, cy + 4); ctx.lineTo(cx - 6, cy + 24); ctx.stroke();
      label(ctx, 'drag the target here', cx - 6, h - 16, 20, '#fff6e0'); label(ctx, 'dashed ring: where most shoes land', w * 0.3, 32, 17, '#fff6e0');
    },
  };
  (A[key] ?? A.shoe)();
  ctx.restore();
}
export { drawBoard, CAM_CLOSE };
