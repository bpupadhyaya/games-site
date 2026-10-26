// Every screen that is not the play screen: title, setup, settings, result, puzzle list, pause, and the scrolling
// About / How to play / Rules reader with its illustrations (drawn with the game's own pins and ball). Pure drawing;
// game.js owns state. Every position comes from the live layout L (layout.js).
import { LANE, PIN_XY } from './sim.js';
import { ballIcon, pinIcon, lyingIcon, ALLEYS, ALLEY_IDS } from './art.js';
import { worldBackdrop } from './view.js';
import { TEXT_SCALES, THINK_STEPS, host } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES } from './ai.js';
import { PUZZLES } from './puzzles.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { totals } from './match.js';
import { v3, shade } from './v3.js';

const TAU = Math.PI * 2;
const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

// ---- flow screens ------------------------------------------------------------------------------
let LAID = { key: '', size: '', cols: [], max: 0, est: false };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };

// Embossed marquee lettering: an extruded stack of offset copies, a vertical metal gradient, a dark outline and a hot edge light.
function marquee(ctx, text, cx, y, size, top, bottom, side, glow) {
  ctx.save();
  ctx.font = `900 ${size}px ${DISPLAY}`; ctx.lineJoin = 'round'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const depth = Math.max(4, Math.round(size * 0.075));
  ctx.shadowColor = glow; ctx.shadowBlur = size * 0.35; ctx.fillStyle = side; ctx.fillText(text, cx, y + depth);
  ctx.shadowBlur = 0;
  for (let d = depth; d >= 1; d--) { ctx.lineWidth = size * 0.13; ctx.strokeStyle = 'rgba(10,8,30,0.92)'; ctx.strokeText(text, cx, y + d); ctx.fillStyle = side; ctx.fillText(text, cx, y + d); }
  ctx.lineWidth = size * 0.13; ctx.strokeStyle = 'rgba(10,8,30,0.95)'; ctx.strokeText(text, cx, y);
  const g = ctx.createLinearGradient(0, y - size * 0.78, 0, y + size * 0.05);
  g.addColorStop(0, top); g.addColorStop(0.55, bottom); g.addColorStop(0.56, side); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillText(text, cx, y);
  ctx.lineWidth = Math.max(1.5, size * 0.016); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.save(); ctx.translate(0, -size * 0.012); ctx.strokeText(text, cx, y); ctx.restore();
  ctx.restore();
}
const heroArt = (h = 500) => ({
  t: 'art', h,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const s = Math.min(1, w / 640); ctx.scale(s, s);
    const cx = w / s / 2;
    if (v3.on) {
      marquee(ctx, 'Candlepin', cx, 126, 112, '#fffdf2', '#ffd98a', '#a8741f', 'rgba(255,170,60,0.75)');
      marquee(ctx, 'BOWLING', cx, 214, 78, '#ffe9a8', '#ff9d2e', '#a3281f', 'rgba(255,60,90,0.8)');
      // neon underline and the tagline
      ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = '#7ff7ee'; ctx.shadowColor = '#34e4d6'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.moveTo(cx - 240, 244); ctx.lineTo(cx + 240, 244); ctx.stroke(); ctx.restore();
      ctx.font = `700 23px ${FONT}`; textShadow(ctx, 'SMALL BALL  ·  SLIM PINS  ·  KEEP THE WOOD', cx, 282, '#fff1cc', 8);
    } else {
      ctx.font = `900 112px ${DISPLAY}`; ctx.lineJoin = 'round';
      const word = (t, y, size, fill) => { ctx.font = `900 ${size}px ${DISPLAY}`; ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(8,12,34,0.9)'; ctx.strokeText(t, cx, y); ctx.fillStyle = fill; ctx.fillText(t, cx, y); };
      word('Candlepin', 128, 108, '#fff2cf');
      word('BOWLING', 214, 74, '#ffc24a');
      ctx.font = `600 24px ${FONT}`; textShadow(ctx, 'SMALL BALL  ·  SLIM PINS  ·  KEEP THE WOOD', cx, 262, '#f0e8cc', 6);
      if (h > 340) {
        const base = h - 56;
        [[-132, 0.0], [-66, 0.0], [0, 0.0], [66, 0.0], [132, 0.0]].forEach(([dx], i) => pinIcon(ctx, cx + dx, base - (i % 2) * 22, Math.min(190, base - 300)));
        ctx.save(); ctx.translate(cx + 40, base + 24); lyingIcon(ctx, 0, 0, Math.min(150, base - 330), -0.35); ctx.restore();
        ballIcon(ctx, cx - 190, base - 6, 44);
      }
    }
    ctx.restore();
  },
});

export function titleWidgets(state, compact = false) {
  const sound = state.settings.sound;
  const wd = [heroArt(compact ? 330 : 520)];
  wd.push({ t: 'btn', id: 'play', label: 'Play vs Computer', primary: true, h: compact ? 80 : 92 });
  wd.push({ t: 'btn', id: 'two', label: 'Two Players', row: 1 });
  wd.push({ t: 'btn', id: 'puzzles', label: 'Wood Puzzles', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 3 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 4 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4 });
  return wd;
}

// setup widget groups: head, rivals, alleys, wood rule
export function setupParts(state, wide) {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const title = s.mode === 'two' ? 'Two Players' : 'New Game';
  const head = wide ? [] : [{ t: 'gap', h: 10 }, { t: 'h', label: title, size: 48 }];
  const rivals = [];
  if (s.mode !== 'two') {
    rivals.push({ t: 'p', label: 'Choose your rival', bold: true, color: '#f4ecd0', size: 26 });
    PROFILES.forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0, locked = demo && i > 0;
      rivals.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${'★'.repeat(pf.stars)}${'☆'.repeat(5 - pf.stars)}  ${wide ? '' : pf.tag}${won ? `${wide ? '' : ' · '}beaten ${won}` : ''}`.trim(), active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: wide ? 84 : 92 });
    });
  }
  const alleys = [{ t: 'p', label: 'Choose the alley', bold: true, color: '#f4ecd0', size: 26 }];
  ALLEY_IDS.forEach((id) => {
    const locked = demo && id !== 'harbor';
    alleys.push({ t: 'btn', id: `aly${id}`, label: ALLEYS[id].name, sub: locked ? 'In the full game' : ALLEYS[id].sub, active: s.alley === id && !locked, disabled: locked, hitDisabled: true, ...(wide ? { h: 88 } : {}) });
  });
  const rule = [{ t: 'p', label: 'Fallen pins (wood)', bold: true, color: '#f4ecd0', size: 26 },
    { t: 'btn', id: 'woodclassic', label: 'Classic: wood stays', sub: 'Fallen pins stay in play until the frame ends', active: s.wood === 'classic' },
    { t: 'btn', id: 'woodeasy', label: 'Easy: swept after each ball', sub: 'Only standing pins remain', active: s.wood === 'easy' }];
  return { head, rivals, alleys, rule };
}
export function setupWidgets(state) {
  const p = setupParts(state, false);
  return [...p.head, ...p.rivals, ...p.alleys, ...p.rule, { t: 'gap', h: 24 }];
}

export function settingsParts(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  const a = [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-guide', label: st.guide ? 'Aim guide: On' : 'Aim guide: Off', sub: 'The dotted line shows where your ball will roll', active: st.guide },
    { t: 'btn', id: 'set-alley', label: `Alley: ${ALLEYS[st.alley].name}`, sub: 'Tap to change the look of the lane' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#f4ecd0', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
  ];
  const b = [
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#f4ecd0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : state.owned ? [{ t: 'p', label: 'Full game unlocked. Thank you!', bold: true, size: 24, color: '#9ff0d6' }]
      : [{ t: 'btn', id: 'restore', label: state.restoreBusy ? 'Checking with the store…' : 'Restore purchase', dark: true, disabled: !!state.restoreBusy }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#f4ecd0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
  return { a, b };
}
export function settingsWidgets(state) { const p = settingsParts(state); return [...p.a, ...p.b]; }

// pins and the ball for the result screen
const trophyArt = (good, h) => ({
  t: 'art', h,
  draw(ctx, w, hh) {
    if (v3.on) { const m = ctx.getTransform(); v3.hero = { x: m.e, y: m.f, w, h: hh, good }; return; }
    const cx = w / 2, base = hh - 40, s = Math.min(1, hh / 300);
    const halo = ctx.createRadialGradient(cx, hh / 2, 10, cx, hh / 2, 190); halo.addColorStop(0, good ? 'rgba(255,214,90,0.45)' : 'rgba(255,255,255,0.14)'); halo.addColorStop(1, 'rgba(255,214,90,0)');
    ctx.fillStyle = halo; ctx.fillRect(cx - 220, 0, 440, hh);
    ctx.save(); ctx.translate(cx, base); ctx.scale(s, s);
    if (good) { [-90, -45, 0, 45, 90].forEach((dx, i) => pinIcon(ctx, dx, -(i % 2 === 0 ? 0 : -14), 180)); }
    else { [-70, 0, 70].forEach((dx, i) => pinIcon(ctx, dx, 0, 170)); lyingIcon(ctx, 18, 22, 140, 0.25); }
    ballIcon(ctx, 150, -4, 36);
    ctx.restore();
  },
});

// result widget groups: the words, the buttons
export function resultParts(state, wide) {
  const mode = state.mode, big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  if (mode === 'puzzle') {
    const r = state.pzResult, pz = PUZZLES[r.index];
    const words = [{ t: 'gap', h: wide ? 6 : big ? 24 : 40 }, ...(wide || big ? [] : [trophyArt(r.stars > 0, 250)]),
      { t: 'h', label: r.stars > 0 ? 'Cleared!' : 'Not this time', size: 62, cap: big ? 1.2 : 1.5 },
      { t: 'h', label: r.stars > 0 ? stars(r.stars) : `${r.left} pin${r.left === 1 ? '' : 's'} left`, size: 76, cap: big ? 1.1 : 1.3, color: '#ffd97a' },
      { t: 'p', label: `${pz.title}: ${r.stars > 0 ? `cleared in ${r.used} ball${r.used === 1 ? '' : 's'}` : 'three balls used'}. Three stars need ${pz.budget} ball${pz.budget === 1 ? '' : 's'}.`, size: 26, cap: big ? 2 : 3 }];
    const btns = [{ t: 'gap', h: wide ? 0 : 24 }];
    if (r.stars > 0 && r.index < PUZZLES.length - 1) btns.push({ t: 'btn', id: 'next', label: 'Next puzzle', primary: true, h: 92 }, { t: 'btn', id: 'again', label: 'Try again', row: 6 }, { t: 'btn', id: 'list', label: 'Puzzle list', row: 6, dark: true });
    else btns.push({ t: 'btn', id: 'again', label: 'Try again', primary: true, h: 92 }, { t: 'btn', id: 'list', label: 'Puzzle list', row: 6 }, { t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
    return { words, btns };
  }
  const m = state.m, o = m.over, lab = state.labels, t = totals(m);
  let title;
  if (mode === 'two') title = o.tie ? 'A tie!' : `${lab[o.win].name} wins`;
  else if (mode === 'watch') title = o.tie ? 'A tie' : `${lab[o.win].name} wins`;
  else title = o.tie ? 'A tie!' : o.win === 0 ? 'You win!' : `${lab[1].name} wins`;
  const words = [{ t: 'gap', h: wide ? 6 : big ? 24 : 40 }, ...(wide || big ? [] : [trophyArt(o.win === 0 || mode !== 'ai', 260)]),
    { t: 'h', label: title, size: 62, cap: big ? 1.2 : 1.5 },
    { t: 'h', label: m.n === 1 ? `${t[0]}` : `${t[0]} – ${t[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' }];
  const sk = `${m.strikes[0]} strike${m.strikes[0] === 1 ? '' : 's'} and ${m.spares[0]} spare${m.spares[0] === 1 ? '' : 's'}${mode === 'two' ? ` for ${lab[0].name}; ${m.strikes[1]} and ${m.spares[1]} for ${lab[1].name}` : ''}.`;
  words.push({ t: 'p', label: sk, size: 26, cap: big ? 2 : 3 });
  if (mode === 'ai' && !big) words.push({ t: 'p', label: `Your best game: ${state.record.best}.`, size: 26 });
  const btns = [{ t: 'gap', h: wide ? 0 : 24 }, { t: 'btn', id: 'sheet', label: 'Scorecard', row: 8 }, { t: 'btn', id: 'again', label: 'Rematch', primary: true, row: 8 }, { t: 'btn', id: 'new', label: 'New game', row: 6 }, { t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true }];
  return { words, btns };
}
export function resultWidgets(state) {
  const p = resultParts(state, false);
  return [...p.words, ...p.btns, { t: 'gap', h: 30 }];
}

export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    ...(state.m ? [{ t: 'btn', id: 'p-card', label: 'Scorecard' }] : []),
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 },
    { t: 'btn', id: 'p-guide', label: st.guide ? 'Guide: On' : 'Guide: Off', row: 8, active: st.guide },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets(wide) {
  return [
    { t: 'gap', h: wide ? 40 : 200 }, { t: 'h', label: 'That is the demo end', size: 48 },
    { t: 'p', label: 'You have bowled the free frames of the web demo. The full game on iPhone and Android has every rival, all three alleys, the sixteen Wood Puzzles and unlimited games.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

export function puzzleWidgets(state) {
  const rec = state.record.stars ?? {}, demo = state.demo;
  const w = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Wood Puzzles', size: 46 },
    { t: 'p', label: 'Clear every standing pin. Fallen pins stay where they lie: use them. Three balls at most.', size: 24 }, { t: 'gap', h: 6 }];
  const tiers = ['Warm-up', 'Wood on the lane', 'Corners and bridges', 'Master class'];
  PUZZLES.forEach((pz, i) => {
    if (i % 4 === 0) w.push({ t: 'p', label: tiers[i / 4], bold: true, color: '#ffd97a', size: 26 });
    const s = rec[i] ?? 0, locked = demo;
    w.push({ t: 'btn', id: `pz${i}`, label: `${i + 1}. ${pz.title}`, sub: locked ? 'In the full game' : `${stars(s)}   ${pz.standing.length} standing, ${pz.wood.length} wood`, disabled: locked, hitDisabled: true, active: s > 0 && !locked, h: 84 });
  });
  w.push({ t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: 'Back', dark: true, h: 84 }, { t: 'gap', h: 30 });
  return w;
}

// The columns of a flow screen for layout L: [{ widgets, x, w, top, bottom, center }]
const lockSize = (L) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), Math.max(180, (L.wide ? L.w / 2 : L.w) - 80)); const h = w * 327 / 1200; return { w, h, strip: Math.round(h + 26) }; };
function screenCols(state, key, L) {
  const w = L.w, I = L.ins, one = (widgets, cw = 640, top = I.t, bottom = L.sb) => { const cwi = Math.min(cw, w - 80); return [{ widgets, x: (w - cwi) / 2, w: cwi, top, bottom }]; };
  const side = Math.max(I.l, I.r);
  if (key === 'title') {
    const wd = titleWidgets(state, !L.wide && L.sb < 1100);
    const strip = lockSize(L).strip;
    if (!L.wide) { const off = Math.round(Math.max(0, L.sb - 1280) * 0.35); return one(wd, 640, Math.max(off, I.t), L.sb - strip); }
    const cw = Math.min(500, w / 2 - 40 - side), lw = Math.min(560, w / 2 - 40 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 8;
    return [{ widgets: [wd[0]], x: w / 4 - lw / 2, w: lw, top, bottom: bot, center: true, shift: -26 }, { widgets: wd.slice(1), x: (3 * w) / 4 - cw / 2, w: cw, top, bottom: bot - strip, center: true }];
  }
  if (key === 'setup') {
    if (!L.wide) return one(setupWidgets(state)).map((c) => ({ ...c, ...L.setup.cols[0] }));
    const p = setupParts(state, true), two = state.setup.mode === 'two';
    const cols = L.setup.cols;
    if (two) return [{ widgets: p.alleys, ...cols[0] }, { widgets: p.rule, ...cols[1] }, { widgets: [], ...cols[2] }];
    return [{ widgets: p.rivals, ...cols[0] }, { widgets: p.alleys, ...cols[1] }, { widgets: p.rule, ...cols[2] }];
  }
  if (key === 'settings') {
    if (!L.wide) return one(settingsWidgets(state));
    const p = settingsParts(state), cw = Math.min(520, w / 2 - 30 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 8;
    return [{ widgets: p.a, x: w / 2 - cw - 14, w: cw, top, bottom: bot, center: true }, { widgets: [{ t: 'gap', h: 58 }, ...p.b], x: w / 2 + 14, w: cw, top, bottom: bot, center: true }];
  }
  if (key === 'demolimit') return one(demoLimitWidgets(L.wide));
  if (key === 'puzzles') return one(puzzleWidgets(state), 700);
  if (key === 'result') {
    if (!L.wide) return one(resultWidgets(state));
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
    const pinned = L.sb - ls.h - 12, y = Math.min(used + 12, pinned), m = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(ls.w + 24, m), th = Math.max(ls.h + 12, m);
    out.lock = { cx, y, w: ls.w, h: ls.h, tap: { x: cx - tw / 2, y: y - 4, w: tw, h: Math.max(th, ls.h + 8) } };
  }
  return out;
}
export function ensureLayout(state, key, L) {
  if (LAID.key === key && LAID.size === L.key && LAID.cols.length) return;
  if (!['title', 'setup', 'settings', 'result', 'demolimit', 'puzzles'].includes(key)) return;
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

function scrim(ctx, L, a = 0.55) {
  if (v3.on) {
    shade(`scrim${a}`, { x: 0, y: 0, w: L.w, h: L.h }, (g2, w, h) => {
      const g = g2.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `rgba(4,8,26,${a * 0.7})`); g.addColorStop(0.5, `rgba(4,8,26,${a})`); g.addColorStop(1, `rgba(4,8,26,${Math.min(0.94, a + 0.3)})`);
      g2.fillStyle = g; g2.fillRect(0, 0, w, h);
    });
    return;
  }
  const g = ctx.createLinearGradient(0, 0, 0, L.h);
  g.addColorStop(0, `rgba(4,8,26,${a * 0.7})`); g.addColorStop(0.5, `rgba(4,8,26,${a})`); g.addColorStop(1, `rgba(4,8,26,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
}

function scrollHint(ctx, top, bottom, scroll, maxScroll, x0, w) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(4,8,26,0)'); g.addColorStop(1, 'rgba(4,8,26,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(244,236,208,0.9)'; ctx.fill();
    ctx.fillStyle = '#16213a'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(244,236,208,0.9)'; ctx.fill();
    ctx.fillStyle = '#16213a'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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
  return { scroll, max: LAID.max };
}

const backdrop = (ctx, state, L, camT) => worldBackdrop(ctx, L, state, state.att.w, state.att.parts, { pose: camT >= 1 ? L.poses.full : L.poses.title });

export function renderTitle(ctx, state, L) {
  backdrop(ctx, state, L, 0.78);
  scrim(ctx, L, 0.34);
  const vx = L.wide ? L.w / 4 : L.w / 2, vy = L.wide ? L.h / 2 : 260 + Math.round(Math.max(0, L.sb - 1280) * 0.35);
  if (v3.on) {
    shade(`tvig${Math.round(vx)}x${Math.round(vy)}`, { x: 0, y: 0, w: L.w, h: L.h }, (g2, w, h) => {
      const g = g2.createRadialGradient(vx, vy, 40, vx, vy, 440);
      g.addColorStop(0, 'rgba(4,8,26,0.45)'); g.addColorStop(1, 'rgba(4,8,26,0)');
      g2.fillStyle = g; g2.fillRect(0, 0, w, h);
    });
    if (L.wide) {
      const c = screenCols(state, 'title', L)[1];
      shade(`tside${Math.round(c.x)}`, { x: 0, y: 0, w: L.w, h: L.h }, (g2, w, h) => {
        const gx = g2.createLinearGradient(c.x - 60, 0, c.x + c.w + 60, 0);
        gx.addColorStop(0, 'rgba(4,8,26,0)'); gx.addColorStop(0.25, 'rgba(4,8,26,0.4)'); gx.addColorStop(1, 'rgba(4,8,26,0.45)');
        g2.fillStyle = gx; g2.fillRect(c.x - 60, 0, w - c.x + 60, h);
      });
    }
  } else {
  const g = ctx.createRadialGradient(vx, vy, 40, vx, vy, 440);
  g.addColorStop(0, 'rgba(4,8,26,0.55)'); g.addColorStop(1, 'rgba(4,8,26,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
  if (L.wide) {
    const c = screenCols(state, 'title', L)[1], gx = ctx.createLinearGradient(c.x - 60, 0, c.x + c.w + 60, 0);
    gx.addColorStop(0, 'rgba(4,8,26,0)'); gx.addColorStop(0.25, 'rgba(4,8,26,0.45)'); gx.addColorStop(1, 'rgba(4,8,26,0.5)');
    ctx.fillStyle = gx; ctx.fillRect(c.x - 60, 0, L.w - c.x + 60, L.h);
  }
  }
  drawFlowScreen(ctx, state, 'title', L);
  if (LAID.lock) {
    const k = LAID.lock, dn = !!(state.ui.drag && state.ui.drag.x0 >= k.tap.x && state.ui.drag.x0 <= k.tap.x + k.tap.w && state.ui.drag.y0 >= k.tap.y && state.ui.drag.y0 <= k.tap.y + k.tap.h);
    ctx.save(); ctx.fillStyle = 'rgba(4,8,26,0.66)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
    drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.w * (dn ? 0.96 : 1), dn ? 0.7 : 1);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(244,236,208,0.6)';
  if (state.demo) ctx.fillText('Web demo', L.wide ? (3 * L.w) / 4 : L.w / 2, L.sb - 4);
}

export function renderSetup(ctx, state, L) {
  backdrop(ctx, state, L, 1);
  scrim(ctx, L, 0.62);
  drawFlowScreen(ctx, state, 'setup', L);
  if (!L.wide) {
    const y0 = L.pins.start.y - 56;
    const paint = (c2, ox, w, h) => { const g = c2.createLinearGradient(0, y0 - ox, 0, h); g.addColorStop(0, 'rgba(4,8,26,0)'); g.addColorStop(0.2, 'rgba(4,8,26,0.85)'); g.addColorStop(1, 'rgba(4,8,26,0.95)'); c2.fillStyle = g; c2.fillRect(0, y0 - ox, w, h - (y0 - ox)); };
    if (v3.on) shade(`sbot${Math.round(y0)}`, { x: 0, y: 0, w: L.w, h: L.h }, (g2, w, h) => paint(g2, 0, w, h));
    else paint(ctx, 0, L.w, L.h);
  }
  drawButton(ctx, L.pins.start, 'Start the game', { primary: true, size: L.wide ? 28 : 32 });
  drawButton(ctx, L.pins.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) {
    ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0';
    const mx = L.wide ? L.pins.start.x + (L.pins.back.x + L.pins.back.w - L.pins.start.x) / 2 : L.w / 2;
    ctx.fillText(state.setupMsg, mx, L.pins.start.y - (L.wide ? 20 : 16));
  }
}
export function renderSettings(ctx, state, L) { backdrop(ctx, state, L, 1); scrim(ctx, L, 0.7); drawFlowScreen(ctx, state, 'settings', L); }
export function renderPuzzles(ctx, state, L) { backdrop(ctx, state, L, 1); scrim(ctx, L, 0.7); drawFlowScreen(ctx, state, 'puzzles', L); }
export function renderDemoLimit(ctx, state, L) { backdrop(ctx, state, L, 1); scrim(ctx, L, 0.72); drawFlowScreen(ctx, state, 'demolimit', L); }
export function renderResult(ctx, state, L) {
  backdrop(ctx, state, L, 1);
  scrim(ctx, L, 0.62);
  drawFlowScreen(ctx, state, 'result', L);
  const cols = LAID.cols, bcol = cols[cols.length - 1];
  const maxScroll = Math.max(0, bcol.lay.contentH - (bcol.bottom - bcol.top));
  const y = L.wide ? Math.min(L.sb - 12, bcol.top + bcol.off + bcol.lay.contentH + 44) : L.sb - 22;
  if (maxScroll === 0 || L.wide) drawMoreLine(ctx, L.wide ? bcol.x + bcol.w / 2 : L.w / 2, y, 18);
}
export function renderPause(ctx, state, L) {
  scrim(ctx, L, 0.58);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const cardW = Math.min(660, L.w - 60 - 2 * Math.max(L.ins.l, L.ins.r)), cw = cardW - 60, cx = L.w / 2;
  const lay = flowLayout(ctx, wd, sc, { x: cx - cw / 2, w: cw });
  const top = Math.max(L.ins.t, 0) + (L.wide ? 20 : 70), bottom = L.sb - (L.wide ? 20 : 70);
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (L.h - ch) / 2);
  panel(ctx, cx - cardW / 2, y0 - 20, cardW, ch + 40, { r: 30, fill: 'rgba(12,20,48,0.95)', stroke: 'rgba(255,194,74,0.55)' });
  LAID = { key: 'pause', size: L.key, cols: [{ lay, x: cx - cw / 2, w: cw, top: y0, bottom: y0 + ch, off: 0 }], max: Math.max(0, lay.contentH - ch), est: false };
  const sc0 = Math.min(state.ui.scroll, LAID.max);
  drawFlow(ctx, lay, y0, y0 + ch, sc0, { clipX: cx - cardW / 2, clipW: cardW });
  scrollHint(ctx, y0, y0 + ch, sc0, LAID.max, cx - cardW / 2, cardW);
}

// ---- reference pages (one continuous scrolling reader) -----------------------------------------
export const REF = { max: 0, view: 400 };
export const pageCount = () => 1;

function buildFlow(ctx, list, scale, PANEL) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 80;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
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
  backdrop(ctx, state, L, 1);
  scrim(ctx, L, 0.66);
  const PANEL = L.ref.panel;
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let fl = pageCache.get(pkey);
  if (!fl) { fl = buildFlow(ctx, list, sc, PANEL); pageCache.set(pkey, fl); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, top = PANEL.y + 96, viewH = Math.max(60, PANEL.h - 96 - 70);
  REF.max = Math.max(0, Math.ceil(fl.total - viewH)); REF.view = viewH;
  state.refScroll = Math.max(0, Math.min(REF.max, state.refScroll || 0));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(250,244,226,0.97)', stroke: 'rgba(40,50,90,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(40,50,90,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(40,50,90,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { const aw = Math.min(PANEL.w - 80, 620); ctx.save(); ctx.beginPath(); ctx.rect(pcx - aw / 2 - 20, y, aw + 40, 210); ctx.clip(); drawArt(it.art, ctx, pcx - aw / 2, y, aw, 198, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(40,50,90,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(40,50,90,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(40,50,90,0.7)';
  ctx.fillText(`text ${Math.round(sc * 100)}%`, pcx, PANEL.y + PANEL.h - 28);
  drawButton(ctx, L.ref.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, L.ref.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  drawButton(ctx, L.ref.back, 'Back', { size: 32 });
  drawButton(ctx, L.ref.next, 'Done', { primary: true, size: 32 });
}

// ---- illustrations ----------------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
function laneStrip(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#e6b66b'); g.addColorStop(0.5, '#f1cb86'); g.addColorStop(1, '#e0ad5f');
  roundPath(ctx, x, y, w, h, 14); ctx.fillStyle = g; ctx.fill();
  ctx.save(); roundPath(ctx, x, y, w, h, 14); ctx.clip();
  ctx.strokeStyle = 'rgba(90,50,10,0.16)'; ctx.lineWidth = 1;
  for (let i = 1; i < 12; i++) { const xx = x + (w * i) / 12; ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); ctx.stroke(); }
  ctx.restore();
  ctx.lineWidth = 6; ctx.strokeStyle = '#2a2d3a'; roundPath(ctx, x, y, w, h, 14); ctx.stroke();
}
function arrow(ctx, x0, y0, x1, y1, col = C.terra, wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
// the pins as a top-down triangle inside a box
function rackAt(ctx, cx, cy, k, o = {}) {
  PIN_XY.forEach(([x, y], i) => {
    const px = cx + x * k, py = cy + (y - LANE.headY) * k;
    if (o.down && o.down.includes(i)) { ctx.strokeStyle = 'rgba(60,40,10,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(px, py, LANE.pinR * k * 1.4, 0, TAU); ctx.stroke(); ctx.setLineDash([]); return; }
    ctx.fillStyle = '#fbf5e3'; ctx.strokeStyle = '#c6252f'; ctx.lineWidth = Math.max(2, k * 0.012);
    ctx.beginPath(); ctx.arc(px, py, LANE.pinR * k * 1.4, 0, TAU); ctx.fill(); ctx.stroke();
    if (o.num) { ctx.fillStyle = C.ink; ctx.font = `800 ${Math.max(11, k * 0.07)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), px, py + 1); }
  });
}

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    pins() {
      laneStrip(ctx, 0, 0, w, h);
      rackAt(ctx, w * 0.5, h * 0.28, 150, { num: true });
      ballIcon(ctx, w * 0.17, h * 0.55, 26); label(ctx, 'ball', w * 0.17, h - 18, 20);
      pinIcon(ctx, w * 0.83, h * 0.78, 100); label(ctx, 'pin', w * 0.83, h - 8, 20);
      label(ctx, 'head pin', w * 0.5 + 62, h * 0.2, 18, C.terra, 'left');
    },
    lane() {
      const lw = w * 0.34, lx = (w - lw) / 2;
      laneStrip(ctx, lx, 4, lw, h - 8);
      ctx.strokeStyle = '#d4262f'; ctx.lineWidth = 4; const yf = h * 0.88; ctx.beginPath(); ctx.moveTo(lx, yf); ctx.lineTo(lx + lw, yf); ctx.stroke();
      label(ctx, 'foul line (start)', lx - 12, yf + 6, 18, C.ink, 'right');
      rackAt(ctx, w / 2, h * 0.12, 70);
      label(ctx, '18 m of lane', lx + lw + 14, h * 0.5, 18, C.ink, 'left');
      label(ctx, 'gutters', lx + lw + 14, h * 0.7, 18, C.ink, 'left');
      label(ctx, 'pins', lx - 12, h * 0.12 + 6, 18, C.ink, 'right');
      ballIcon(ctx, w / 2, yf - 14, 10);
    },
    aim() {
      const lw = w * 0.36, lx = (w - lw) / 2;
      laneStrip(ctx, lx, 4, lw, h - 8);
      rackAt(ctx, w / 2, h * 0.14, 70);
      const bx = lx + lw * 0.25, by = h * 0.86, tx = w / 2 + 22, ty = h * 0.14;
      ctx.setLineDash([3, 8]); ctx.strokeStyle = C.terra; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
      ballIcon(ctx, bx, by, 11);
      ctx.strokeStyle = C.terra; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tx, ty, 8, 0, TAU); ctx.stroke();
      arrow(ctx, bx - 40, by + 10, bx + 40, by + 10, C.olive, 4); label(ctx, '1  slide the ball', lx - 14, by + 6, 18, C.olive, 'right');
      label(ctx, '2  aim at the pins', lx + lw + 14, h * 0.4, 18, C.terra, 'left');
    },
    pace() {
      laneStrip(ctx, 0, 0, w, h);
      [['Soft', 0.3, '#3f78ad'], ['Firm', 0.62, C.olive], ['Fast', 0.92, C.terra]].forEach(([nm, f, col], i) => {
        const yy = h * (0.25 + i * 0.25);
        ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.setLineDash([2, 9]); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(24, yy); ctx.lineTo(w * f, yy); ctx.stroke(); ctx.setLineDash([]);
        ballIcon(ctx, w * f + 12, yy, 13); label(ctx, nm, 24, yy - 14, 20, col, 'left');
      });
    },
    curve() {
      laneStrip(ctx, 0, 0, w, h);
      [['Straight', 0.18, 0, '#3f78ad'], ['Curve left', 0.5, -1, '#6a58a8'], ['Curve right', 0.82, 1, C.olive]].forEach(([nm, fx, dir, col]) => {
        const cx = w * fx, y0 = h * 0.82, y1 = h * 0.2;
        ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.setLineDash([2, 9]); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx - dir * 34, y0); ctx.quadraticCurveTo(cx + dir * 4, (y0 + y1) / 2 + 30, cx, y1); ctx.stroke(); ctx.setLineDash([]);
        ballIcon(ctx, cx, y1, 12); label(ctx, nm, cx, h - 10, 19, col);
      });
    },
    wood() {
      laneStrip(ctx, 0, 0, w, h);
      // a pin lying across the path, ball glances off it into a standing pin
      pinIcon(ctx, w * 0.7, h * 0.46, 92);
      pinIcon(ctx, w * 0.84, h * 0.58, 92);
      lyingIcon(ctx, w * 0.4, h * 0.52, 130, -0.5);
      ballIcon(ctx, w * 0.14, h * 0.8, 20);
      ctx.setLineDash([3, 8]); ctx.strokeStyle = C.terra; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(w * 0.14, h * 0.8); ctx.lineTo(w * 0.36, h * 0.58); ctx.lineTo(w * 0.66, h * 0.4); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, 'wood', w * 0.4, h * 0.82, 20, C.ink); label(ctx, 'standing pins', w * 0.78, h * 0.92, 18, C.ink);
    },
    score() {
      laneStrip(ctx, 0, 0, w, h);
      ctx.fillStyle = '#fffdf3'; ctx.strokeStyle = '#2b3558'; ctx.lineWidth = 2;
      const cw = w / 3 - 14;
      [['Strike', 'X', '10 + the next two balls'], ['Spare', '4 /', '10 + the next ball'], ['Open', '3 2 1', 'the pins you knocked']].forEach(([nm, mk, sub], i) => {
        const cx = 8 + i * (cw + 14);
        ctx.fillStyle = '#fffdf3'; ctx.fillRect(cx, 14, cw, h - 28); ctx.strokeRect(cx, 14, cw, h - 28);
        label(ctx, nm, cx + cw / 2, 46, 24, C.terra); label(ctx, mk, cx + cw / 2, 104, 34, C.ink);
        ctx.font = `400 16px ${FONT}`; ctx.fillStyle = C.ink; ctx.textAlign = 'center';
        wrapLines(ctx, sub, cw - 14).forEach((l, k) => ctx.fillText(l, cx + cw / 2, 144 + k * 20));
      });
    },
  };
  (A[key] ?? A.pins)();
  ctx.restore();
}
