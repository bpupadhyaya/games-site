// Every screen that is not the play screen: title, setup, settings, result, pause, demo limit, and the scrolling About / How to
// Play / Rules reader with its illustrations (drawn with the game's own discs and course). Pure drawing; game.js owns state.
// Every position comes from the live layout L (layout.js).
import { TRACKS, TRACK_IDS, maxPoints, makeTrack } from './sim.js';
import { discIcon, SIDE } from './art.js';
import { drawScope } from './view.js';
import { TEXT_SCALES, THINK_STEPS, host } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES } from './opponents.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { gl } from './glhook.js';

const TAU = Math.PI * 2;
const TRACK_LABEL = { meadow: 'Meadow Run', slope: 'Sloped Field', twin: 'Twin Stakes', mud: 'Mud and Boulder', daily: 'Daily Course' };
const TRACK_NOTE = { meadow: TRACKS.meadow.note, slope: TRACKS.slope.note, twin: TRACKS.twin.note, mud: TRACKS.mud.note, daily: 'A new mix every day, the same for everyone.' };

// ---- flow screens ------------------------------------------------------------------------------------------------------------
let LAID = { key: '', size: '', cols: [], max: 0, est: false };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };

// Embossed lettering: a dark carved outline, a lit gradient face and a thin top highlight.
function embossed(ctx, text, x, y, size, c0, c1, c2) {
  ctx.save();
  ctx.font = `700 ${size}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(4,10,16,0.65)'; ctx.shadowBlur = size * 0.16; ctx.shadowOffsetY = size * 0.06;
  ctx.strokeStyle = '#2a0f06'; ctx.lineWidth = size * 0.15; ctx.strokeText(text, x, y);
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#7a3a12'; ctx.lineWidth = size * 0.07; ctx.strokeText(text, x, y);
  const g = ctx.createLinearGradient(0, y - size * 0.8, 0, y + size * 0.05); g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fillText(text, x, y);
  ctx.save(); ctx.beginPath(); ctx.rect(x - 1000, y - size * 0.82, 2000, size * 0.3); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillText(text, x, y - 1.5); ctx.restore();
  ctx.restore();
}
function kapaBand(ctx, cx, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(30,10,4,0.75)'; roundPath(ctx, cx - w / 2, y, w, h, h / 2); ctx.fill();
  ctx.beginPath(); roundPath(ctx, cx - w / 2, y, w, h, h / 2); ctx.clip();
  const n = Math.floor(w / (h * 1.1)), tw = w / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? '#e6b855' : '#c4282d';
    ctx.beginPath(); ctx.moveTo(cx - w / 2 + i * tw + 2, y + h - 3); ctx.lineTo(cx - w / 2 + i * tw + tw / 2, y + 3); ctx.lineTo(cx - w / 2 + (i + 1) * tw - 2, y + h - 3); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
const heroArt = (h = 400, compact = false) => ({
  t: 'art', h,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const s = Math.min(1, w / 640); ctx.scale(s, s);
    const cx = w / s / 2;
    if (gl.active) {
      embossed(ctx, 'Ulu', cx, 132, 124, '#fffaf0', '#f3e6c0', '#cdb98a');
      embossed(ctx, 'Maika', cx, 236, 104, '#ffe9a0', '#ffc43d', '#d98a14');
      kapaBand(ctx, cx, 262, 500, 20);
      ctx.font = `700 24px ${FONT}`; textShadow(ctx, 'THE DISC-ROLLING GAME OF HAWAI\u02BBI', cx, 318, '#fff3d6', 6);
    } else {
      ctx.font = `700 132px ${DISPLAY}`; textShadow(ctx, 'Ulu', cx, 138, '#fff6e4', 16);
      ctx.font = `700 100px ${DISPLAY}`; textShadow(ctx, 'Maika', cx, 238, '#ffc857', 14);
      ctx.font = `600 25px ${FONT}`; textShadow(ctx, 'THE DISC-ROLLING GAME OF HAWAI\u02BBI', cx, 284, '#fff0d0', 6);
      if (compact) { discIcon(ctx, cx - 226, 172, 30, 0, 0.9); discIcon(ctx, cx + 226, 172, 30, 1, 2.1); }
      else { discIcon(ctx, cx - 70, 346, 32, 0, 0.9); discIcon(ctx, cx + 70, 346, 32, 1, 2.1); }
    }
    ctx.restore();
  },
});

export function titleWidgets(state, compact = false, spacer = 0) {
  const hero = heroArt(compact ? 300 : 400, compact), k = compact ? 0.92 : 1;
  return [
    hero,
    ...(spacer > 0 ? [{ t: 'gap', h: spacer }] : []),
    { t: 'btn', id: 'play', label: 'Play vs Computer', primary: true, h: Math.round(92 * k) },
    { t: 'btn', id: 'two', label: 'Two Players', row: 5, h: Math.round(84 * k) }, { t: 'btn', id: 'solo', label: 'Solo Practice', row: 5, h: Math.round(84 * k) },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'two rivals play; see why', h: Math.round(84 * k) },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 1, h: Math.round(76 * k) }, { t: 'btn', id: 'rules', label: 'Rules', row: 1, h: Math.round(76 * k) },
    { t: 'btn', id: 'about', label: 'About', row: 2, h: Math.round(76 * k) }, { t: 'btn', id: 'settings', label: 'Settings', row: 2, h: Math.round(76 * k) },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: on' : 'Sound: off', dark: true, h: Math.round(70 * k) },
  ];
}

export function setupParts(state, wide) {
  const s = state.setup, two = s.mode === 'two', solo = s.mode === 'solo';
  const head = [{ t: 'h', label: solo ? 'Solo Practice' : two ? 'Two Players' : 'Play vs Computer', size: 40 }];
  const rivals = [{ t: 'h', label: 'Your rival', size: 30 }, ...PROFILES.map((p, i) => ({ t: 'btn', id: `opp${i}`, label: p.name, sub: `${'★'.repeat(p.stars)}${'☆'.repeat(5 - p.stars)}  ${p.tag}`, active: s.opp === i, disabled: state.demo && i > 1, hitDisabled: true, h: 84 }))];
  const courses = [{ t: 'h', label: 'The course', size: 30 }, ...TRACK_IDS.map((c) => ({ t: 'btn', id: `trk${c}`, label: TRACK_LABEL[c], sub: TRACK_NOTE[c], active: s.track === c, disabled: state.demo && c !== 'meadow' && c !== 'slope', hitDisabled: true, h: 84 }))];
  const length = [{ t: 'h', label: 'Discs each', size: 30 },
    { t: 'btn', id: 'len6', label: 'Six discs', active: s.rolls === 6, h: 80, row: 7 }, { t: 'btn', id: 'len3', label: 'Quick: three', active: s.rolls === 3, h: 80, row: 7 }];
  if (state.setupMsg) length.push({ t: 'p', label: state.setupMsg, size: 24, color: '#ffd27a', bold: true });
  if (state.demo) length.push({ t: 'p', label: 'The web demo has two courses and the first two rivals.', size: 22 });
  return { head, rivals: two || solo ? [] : rivals, courses, length };
}
export function setupWidgets(state) { const p = setupParts(state, false); return [...p.head, ...p.rivals, ...p.courses, ...p.length]; }

export function settingsParts(state) {
  const st = state.settings;
  const a = [
    { t: 'h', label: 'Settings', size: 42 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: on' : 'Sound: off', active: st.sound, h: 80 },
    { t: 'btn', id: 'set-calm', label: st.calm ? 'Steady hand: on' : 'Steady hand: off', sub: 'halves the wobble of your release', active: st.calm, h: 92 },
    { t: 'btn', id: 'set-fine', label: st.fine ? 'Fine sight: on' : 'Fine sight: off', sub: 'the sight turns more slowly under your finger', active: st.fine, h: 92 },
    { t: 'p', label: `Text size ${Math.round(TEXT_SCALES[st.textIdx] * 100)}%`, size: 26, bold: true },
    { t: 'btn', id: 'txt-dec', label: 'Smaller text', row: 1, disabled: st.textIdx === 0, h: 76 }, { t: 'btn', id: 'txt-inc', label: 'Larger text', row: 1, disabled: st.textIdx === TEXT_SCALES.length - 1, h: 76 },
  ];
  const b = [
    { t: 'p', label: `Watch & Learn thinking time ${THINK_STEPS[st.thinkIdx]} s`, size: 26, bold: true },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 2, disabled: st.thinkIdx === 0, h: 76 }, { t: 'btn', id: 'think-inc', label: 'Longer', row: 2, disabled: st.thinkIdx === THINK_STEPS.length - 1, h: 76 },
    { t: 'gap', h: 10 },
    ...(state.demo ? [] : [
      { t: 'btn', id: 'restore', label: state.owned ? 'Full game unlocked' : 'Restore purchase', sub: state.owned ? 'Thank you for playing' : 'Already bought it? Get it back', disabled: !!state.owned || !!state.restoreBusy, h: 92 },
      ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 22 }] : []),
    ]),
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
    g.addColorStop(0, win ? '#fff0a8' : '#d8d0f0'); g.addColorStop(1, win ? '#e09a1c' : '#6a5a98');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 70, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(40,20,80,0.55)'; ctx.font = `700 78px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(win ? '★' : '·', 0, 4);
    ctx.restore();
  },
});
export function resultParts(state, wide) {
  const m = state.m, c = m.cfg, solo = c.mode === 'solo', win = m.over && m.over.win === 0;
  const two = c.mode === 'two', watch = c.mode === 'watch', draw = m.over && m.over.win === -1;
  const winner = m.over && m.over.win >= 0 ? state.labels[m.over.win].name : '';
  const title = solo ? 'Practice complete' : draw ? 'A draw' : two || watch ? `${winner} wins` : win ? 'You win!' : `${winner} wins`;
  const words = [
    trophyArt(win || two || watch, 150),
    { t: 'h', label: title, size: 54, cap: 1.4 },
    { t: 'p', label: solo ? `${m.scores[0]} of ${maxPoints(state.track) * c.rolls} points` : `${m.scores[0]} – ${m.scores[1]}`, size: 34, bold: true },
  ];
  if (solo) words.push({ t: 'p', label: `Best on ${state.track.name}: ${state.record.best[state.track.id] | 0}${state.newBest ? '  (new best!)' : ''}`, size: 24 });
  if (c.mode === 'ai') words.push({ t: 'p', label: `Wins against ${PROFILES[c.opp].name}: ${state.record.wins[c.opp]}  ·  streak ${state.record.streak}`, size: 24 });
  if (m.sudden) words.push({ t: 'p', label: m.sudden === 1 ? 'Settled in sudden death.' : `Settled after ${m.sudden} sudden-death rolls.`, size: 22 });
  const btns = [
    { t: 'btn', id: 'again', label: 'Play again', primary: true, h: 92 },
    { t: 'btn', id: 'new', label: 'New setup', h: 80 },
    { t: 'btn', id: 'menu', label: 'Main menu', h: 80 },
  ];
  return { words, btns };
}
export function resultWidgets(state) { const p = resultParts(state, false); return [...p.words, ...p.btns]; }

export function pauseWidgets(state) {
  return [
    { t: 'h', label: 'Paused', size: 46 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 92 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 1, h: 76 }, { t: 'btn', id: 'p-howto', label: 'How to Play', row: 1, h: 76 },
    { t: 'btn', id: 'p-sound', label: state.settings.sound ? 'Sound: on' : 'Sound: off', row: 2, h: 76 },
    { t: 'btn', id: 'p-calm', label: state.settings.calm ? 'Steady hand: on' : 'Steady hand: off', row: 2, h: 76 },
    { t: 'btn', id: 'quit', label: 'Leave match', dark: true, h: 80 },
  ];
}
export function demoLimitWidgets(wide) {
  return [
    { t: 'h', label: 'That was the free preview', size: 40 },
    { t: 'p', label: 'The web demo plays three discs a side. The full game for iPhone and Android has every rival, every course and the Daily Course, with no limits.', size: 26 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true, h: 90 },
  ];
}

// ---- layout of columns --------------------------------------------------------------------------------------------------------
const lockSize = (L) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), Math.max(180, (L.wide ? L.w / 2 : L.w) - 80)); const h = (w * 327) / 1200; return { w, h, strip: Math.round(h + 26) }; };
function screenCols(state, key, L) {
  const w = L.w, I = L.ins, one = (widgets, cw = 640, top = Math.max(I.t, 14), bottom = L.sb) => { const cwi = Math.min(cw, w - 80); return [{ widgets, x: (w - cwi) / 2, w: cwi, top, bottom }]; };
  const side = Math.max(I.l, I.r);
  if (key === 'title') {
    const strip = lockSize(L).strip, compact = !L.wide && L.sb < 1100;
    if (!L.wide) {
      // with the 3D village behind the menu the buttons sit low and the players and the lane show above them
      const off = Math.round(Math.max(0, L.sb - 1280) * 0.2), top = Math.max(off, I.t), bottom = L.sb - strip;
      const k = compact ? 0.92 : 1, used = (compact ? 300 : 400) + 560 * k + 10;
      const spacer = gl.active ? Math.max(0, Math.round((bottom - top - used) * 0.92)) : 0;
      return one(titleWidgets(state, compact, spacer), 640, top, bottom);
    }
    const wd = titleWidgets(state, false);
    const cw = Math.min(500, w / 2 - 40 - side), lw = Math.min(560, w / 2 - 40 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 8;
    return [{ widgets: [wd[0]], x: w / 4 - lw / 2, w: lw, top, bottom: bot, center: true, shift: -26 }, { widgets: wd.slice(1), x: (3 * w) / 4 - cw / 2, w: cw, top, bottom: bot - strip, center: true }];
  }
  if (key === 'setup') {
    if (!L.wide && L.setup.cols.length === 2) {
      const p2 = setupParts(state, false), c2 = L.setup.cols;
      if (state.setup.mode !== 'ai') return [{ widgets: [...p2.head, ...p2.length], ...c2[0] }, { widgets: p2.courses, ...c2[1] }];
      return [{ widgets: [...p2.head, ...p2.rivals], ...c2[0] }, { widgets: [...p2.courses, ...p2.length], ...c2[1] }];
    }
    if (!L.wide) return one(setupWidgets(state)).map((c) => ({ ...c, ...L.setup.cols[0] }));
    const p = setupParts(state, true), noRival = state.setup.mode !== 'ai', cols = L.setup.cols;
    if (noRival) return [{ widgets: [...p.head, ...p.courses], ...cols[0] }, { widgets: p.length, ...cols[1] }, { widgets: [], ...cols[2] }];
    return [{ widgets: p.rivals, ...cols[0] }, { widgets: [...p.head, ...p.courses], ...cols[1] }, { widgets: p.length, ...cols[2] }];
  }
  if (key === 'settings') {
    if (!L.wide) return one(settingsWidgets(state));
    const p = settingsParts(state), cw = Math.min(520, w / 2 - 30 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 8;
    return [{ widgets: p.a, x: w / 2 - cw - 14, w: cw, top, bottom: bot, center: true }, { widgets: [{ t: 'gap', h: 58 }, ...p.b], x: w / 2 + 14, w: cw, top, bottom: bot, center: true }];
  }
  if (key === 'demolimit') return one(demoLimitWidgets(L.wide));
  if (key === 'result') {
    if (!L.wide) return one(resultWidgets(state), 640, I.t, L.sb - 40).map((c) => ({ ...c, center: true, shift: -30 }));
    const p = resultParts(state, true), cw = Math.min(480, w / 2 - 40 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 40;
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

// ---- backdrop: the dusk court with the attract game rolling ---------------------------------------------------------------------
function backdrop(ctx, L, state) {
  if (gl.active) return;                          // the WebGL village shows through the transparent kit canvas
  const a = state.att;
  ctx.fillStyle = '#0b2433'; ctx.fillRect(0, 0, L.w, L.h);
  const rect = { x: 0, y: 0, w: L.w, h: L.h };
  drawScope(ctx, rect, a.scene, { noClip: true });
}
function scrim(ctx, L, a = 0.5) {
  if (gl.active) a *= 0.62;
  const g = ctx.createLinearGradient(0, 0, 0, L.h);
  g.addColorStop(0, `rgba(4,20,30,${a * 0.5})`); g.addColorStop(0.5, `rgba(4,20,30,${a})`); g.addColorStop(1, `rgba(4,20,30,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0, w) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(4,20,30,0)'); g.addColorStop(1, 'rgba(4,20,30,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
function drawFlowScreen(ctx, state, key, L) {
  LAID = layColumns(ctx, state, key, L);
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
  scrim(ctx, L, 0.42);
  drawFlowScreen(ctx, state, 'title', L);
  const lk = LAID.lock;
  if (lk) drawLockup(ctx, lk.cx, lk.y, lk.w, 0.92);
}
export function renderSetup(ctx, state, L) {
  backdrop(ctx, L, state); scrim(ctx, L, 0.66);
  drawFlowScreen(ctx, state, 'setup', L);
  drawButton(ctx, L.pins.start, 'Start', { primary: true, size: 36 });
  drawButton(ctx, L.pins.back, 'Back', { size: 32 });
}
export function renderSettings(ctx, state, L) { backdrop(ctx, L, state); scrim(ctx, L, 0.66); drawFlowScreen(ctx, state, 'settings', L); }
export function renderResult(ctx, state, L) {
  backdrop(ctx, L, state); scrim(ctx, L, 0.62);
  drawFlowScreen(ctx, state, 'result', L);
  drawMoreLine(ctx, L.w / 2, L.sb - 14, 20);
}
export function renderDemoLimit(ctx, state, L) { backdrop(ctx, L, state); scrim(ctx, L, 0.66); drawFlowScreen(ctx, state, 'demolimit', L); }
export function renderPause(ctx, state, L) {
  scrim(ctx, L, 0.6);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const cardW = Math.min(660, L.w - 60 - 2 * Math.max(L.ins.l, L.ins.r)), cw = cardW - 60, cx = L.w / 2;
  const lay = flowLayout(ctx, wd, sc, { x: cx - cw / 2, w: cw });
  const top = Math.max(L.ins.t, 0) + (L.wide ? 20 : 70), bottom = L.sb - (L.wide ? 20 : 70);
  const ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (L.h - ch) / 2);
  panel(ctx, cx - cardW / 2, y0 - 20, cardW, ch + 40, { r: 30, fill: 'rgba(30,20,70,0.95)', stroke: 'rgba(255,214,150,0.5)' });
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
  backdrop(ctx, L, state); scrim(ctx, L, 0.72);
  const PANEL = L.ref.panel, sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let fl = pageCache.get(pkey);
  if (!fl) { fl = buildFlow(ctx, list, sc, PANEL); pageCache.set(pkey, fl); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, top = PANEL.y + 96, viewH = Math.max(60, PANEL.h - 96 - 70);
  REF.max = Math.max(0, Math.ceil(fl.total - viewH)); REF.view = viewH;
  state.refScroll = Math.max(0, Math.min(REF.max, state.refScroll || 0));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,246,228,0.97)', stroke: 'rgba(70,50,100,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.coralDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(90,60,120,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(90,60,120,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.coralDark; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { const aw = Math.min(PANEL.w - 80, 620); ctx.save(); ctx.beginPath(); ctx.rect(pcx - aw / 2 - 20, y, aw + 40, 210); ctx.clip(); drawArt(it.art, ctx, pcx - aw / 2, y, aw, 198, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, (viewH * viewH) / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(90,60,120,0.15)'; roundPath(ctx, PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(90,60,120,0.55)'; roundPath(ctx, PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(70,50,90,0.75)';
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
function lawn(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#8ad47c'); g.addColorStop(1, '#5fb55a');
  ctx.save(); roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = g; ctx.fill(); ctx.clip();
  ctx.fillStyle = 'rgba(30,110,40,0.16)'; for (let i = 0; i < w; i += 36) ctx.fillRect(x + i, y, 18, h);
  const v = ctx.createLinearGradient(0, y, 0, y + h); v.addColorStop(0, 'rgba(255,255,255,0.18)'); v.addColorStop(1, 'rgba(0,0,0,0.18)'); ctx.fillStyle = v; ctx.fillRect(x, y, w, h);
  ctx.restore();
  roundPath(ctx, x, y, w, h, 16); ctx.lineWidth = 6; ctx.strokeStyle = '#5a2e16'; ctx.stroke();
  roundPath(ctx, x + 3, y + 3, w - 6, h - 6, 13); ctx.lineWidth = 1.5; ctx.strokeStyle = '#e6b855'; ctx.stroke();
}
function arrow(ctx, x0, y0, x1, y1, col = C.coralDark, wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
const stakeDot = (ctx, x, y, r = 7, col = '#14b3a7') => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); };
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    discs() {
      lawn(ctx, 0, 0, w, h);
      discIcon(ctx, w * 0.22, h * 0.46, 42, 0, 0.9); discIcon(ctx, w * 0.5, h * 0.46, 42, 1, 2.2);
      stakeDot(ctx, w * 0.8, h * 0.5, 13, '#e23a5c');
      label(ctx, SIDE[0].name, w * 0.22, h - 20, 22); label(ctx, SIDE[1].name, w * 0.5, h - 20, 22); label(ctx, 'Far stake', w * 0.8, h - 20, 22);
    },
    course() {
      lawn(ctx, 0, 0, w, h);
      const x0 = 34, x1 = w - 40, k = (x1 - x0) / 22, cy = h * 0.5;
      ctx.fillStyle = '#fffbe9'; ctx.fillRect(x0 - 3, 20, 6, h - 40);
      stakeDot(ctx, x0 + 8 * k, cy - 22); stakeDot(ctx, x0 + 8 * k, cy + 22);
      ctx.strokeStyle = '#ffe07a'; ctx.setLineDash([4, 4]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0 + 8 * k, cy - 22); ctx.lineTo(x0 + 8 * k, cy + 22); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(x1, cy, 1.35 * k, 0, TAU); ctx.fillStyle = 'rgba(255,214,96,0.3)'; ctx.fill(); ctx.strokeStyle = '#ffe07a'; ctx.lineWidth = 3; ctx.stroke();
      stakeDot(ctx, x1, cy, 9, '#e23a5c');
      arrow(ctx, x0 + 6, cy, x0 + 8 * k - 14, cy, '#fff', 4);
      label(ctx, 'roll line', x0 + 4, h - 20, 18, C.ink, 'left'); label(ctx, 'gate', x0 + 8 * k, 20, 18); label(ctx, 'ring and far stake', x1 - 10, h - 20, 18, C.ink, 'right');
    },
    gate() {
      lawn(ctx, 0, 0, w, h);
      const gx = [w * 0.17, w * 0.5, w * 0.83], gy = h * 0.5, gw = 90;
      [['Clean: +2', '#1b5a2a', 0], ['Touched: 0', '#7a1c1c', 38], ['Missed: 0', '#7a1c1c', 1]].forEach(([t, c, mode], i) => {
        stakeDot(ctx, gx[i] - gw / 2, gy - 26); stakeDot(ctx, gx[i] + gw / 2, gy - 26);
        const px = gx[i] + (mode === 1 ? gw * 0.95 : mode === 38 ? -gw * 0.44 : 0);
        arrow(ctx, px, gy + 52, px, gy - 56, mode === 0 ? '#14693a' : '#a0301e', 4);
        label(ctx, t, gx[i], h - 20, 20, c);
      });
    },
    power() {
      roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = '#10384a'; ctx.fill();
      const bx = w * 0.3, bw = 36, by = 22, bh = h - 44;
      roundPath(ctx, bx, by, bw, bh, 18); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill();
      const gr = ctx.createLinearGradient(0, by + bh, 0, by); gr.addColorStop(0, '#14b3a7'); gr.addColorStop(0.6, '#ffc857'); gr.addColorStop(1, '#ff6a4d');
      ctx.save(); roundPath(ctx, bx, by, bw, bh, 18); ctx.clip(); ctx.fillStyle = gr; ctx.fillRect(bx, by + bh * 0.46, bw, bh * 0.54); ctx.restore();
      [[0.78, 'F  just reaches the far stake'], [0.38, 'G  just reaches the gate']].forEach(([p, t]) => {
        const yy = by + bh * (1 - p); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(bx - 10, yy); ctx.lineTo(bx + bw + 8, yy); ctx.stroke();
        label(ctx, t, bx + bw + 18, yy + 6, 19, '#fff6e4', 'left');
      });
      arrow(ctx, w * 0.12, h * 0.8, w * 0.12, h * 0.2, '#ffd27a', 6); label(ctx, 'swipe up', w * 0.12, h - 6, 17, '#ffd27a');
    },
    lean() {
      lawn(ctx, 0, 0, w, h);
      const sx = w * 0.5, sy = h - 26, ey = 26;
      ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.setLineDash([2, 9]); ctx.strokeStyle = '#fff';
      [[-1, 'Left'], [0, 'Straight'], [1, 'Right']].forEach(([d, t], i) => {
        ctx.beginPath(); ctx.moveTo(sx + d * 8 + (i - 1) * 0, sy); ctx.quadraticCurveTo(sx + d * 8 + d * 70, (sy + ey) / 2 + 10, sx + d * 8 + d * 150, ey); ctx.stroke();
        void t;
      });
      ctx.setLineDash([]);
      discIcon(ctx, sx, sy - 6, 14, 0, 0.9);
      label(ctx, 'Lean left', w * 0.1, h - 18, 18, '#0b3a1c', 'left'); label(ctx, 'straight', sx, 20, 18, '#0b3a1c'); label(ctx, 'Lean right', w * 0.9, h - 18, 18, '#0b3a1c', 'right');
    },
    ground() {
      lawn(ctx, 0, 0, w, h);
      ctx.fillStyle = '#6a4a2e'; ctx.fillRect(w * 0.06, 24, w * 0.34, h - 48);
      ctx.fillStyle = 'rgba(160,120,80,0.5)'; for (let i = 0; i < 18; i++) ctx.fillRect(w * 0.08 + (i * 53) % (w * 0.3), 32 + (i * 37) % (h - 70), 14, 5);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { const px = w * (0.58 + i * 0.12); ctx.beginPath(); ctx.moveTo(px, h * 0.3); ctx.lineTo(px + 30, h * 0.5); ctx.lineTo(px, h * 0.7); ctx.stroke(); }
      ctx.fillStyle = '#3a4048'; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.2, 14, 0, TAU); ctx.fill();
      label(ctx, 'mud: heavy drag', w * 0.23, h - 8, 18, '#fff6e4'); label(ctx, 'slope: pushes sideways', w * 0.72, h - 8, 18, '#0b3a1c');
    },
    score() {
      roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = '#fff6e4'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,80,100,0.5)'; ctx.stroke();
      const rows = [['Each gate passed clean', '+2'], ['Hit the far stake', '+2'], ['Rest in the ring', '+1']];
      rows.forEach(([a, b], i) => { const yy = 52 + i * 46; label(ctx, a, 30, yy, 24, C.ink, 'left'); label(ctx, b, w - 30, yy, 26, '#0b7a45', 'right'); });
    },
    scope() {
      const tr = makeTrack('slope');
      drawScope(ctx, { x: 0, y: 0, w, h }, { track: tr, cam: { x: 0, y: -2.4, yaw: 0.03 }, t: 0, rests: [], roll: null, held: { x: 0, y: 0, side: 0 }, preview: null, parts: [] }, { force2d: true });
    },
  };
  (A[key] ?? A.discs)();
  ctx.restore();
}
