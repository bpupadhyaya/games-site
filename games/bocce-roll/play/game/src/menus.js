// Every screen that is not the play screen: title, setup, settings, result, pause, tournament bracket, and the scrolling
// About / How to play / Rules reader with its illustrations (drawn with the game's own balls). Pure drawing; game.js owns
// state. Every position comes from the live layout L (layout.js).
import { COURT, HALF, SURFACE_IDS, surfaceName, SURFACES } from './sim.js';
import { drawBallIcon, TEAM } from './art.js';
import { worldBackdrop } from './view.js';
import { TEXT_SCALES, THINK_STEPS, host } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES, PARTNER, TOUR_NAMES } from './opponents.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { drawLockup, drawMoreLine } from './brand.js';

const TAU = Math.PI * 2;

// ---- flow screens ------------------------------------------------------------------------------
// A screen is one or more columns of widgets (flowLayout). LAID keeps the laid-out result for hit-testing and scrolling.
let LAID = { key: '', size: '', cols: [], max: 0, est: false };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };

const heroArt = (h = 520) => ({
  t: 'art', h,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const s = Math.min(1, w / 640); ctx.scale(s, s);
    const cx = w / s / 2;
    ctx.font = `700 118px ${DISPLAY}`; textShadow(ctx, 'Bocce', cx, 150, '#fff6dc', 16);
    ctx.font = `700 78px ${DISPLAY}`; textShadow(ctx, 'Roll', cx, 232, '#ffd97a', 12);
    ctx.font = `600 26px ${FONT}`; textShadow(ctx, 'IL GIOCO DELLE BOCCE', cx, 282, '#f3ecd6', 6);
    // tricolour rule with the pallino in the middle
    const cols = ['#2aa05c', '#f8f4e8', '#d3232f'];
    cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(cx - 150 + i * 100, 308, 100, 5); });
    if (h > 360) {
      drawBallIcon(ctx, cx - 92, 392, 38, 0); drawBallIcon(ctx, cx + 4, 408, 38, 1); drawBallIcon(ctx, cx + 100, 384, 38, 0); drawBallIcon(ctx, cx + 20, 372, 14, -1);
    }
    ctx.restore();
  },
});

export function titleWidgets(state, compact = false) {
  const sound = state.settings.sound;
  const wd = [heroArt(compact ? 330 : 470)];
  wd.push({ t: 'btn', id: 'play', label: 'Play vs Computer', primary: true, h: compact ? 80 : 92 });
  wd.push({ t: 'btn', id: 'team', label: 'Team Match', row: 1 });
  wd.push({ t: 'btn', id: 'cup', label: 'Cup Tournament', row: 1 });
  wd.push({ t: 'btn', id: 'two', label: 'Two Players', row: 2 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 3 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 3 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 4 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4 });
  return wd;
}

// setup widget groups: head, rivals, courts, length
export function setupParts(state, wide) {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const title = s.mode === 'two' ? 'Two Players' : s.mode === 'team' ? 'Team Match' : 'New Match';
  const head = wide ? (s.mode === 'team' ? [{ t: 'p', label: `You play with ${PARTNER.name}`, bold: true, color: '#ffd97a', size: 24 }] : []) : [{ t: 'gap', h: 10 }, { t: 'h', label: title, size: 48 }, ...(s.mode === 'team' ? [{ t: 'p', label: `You play with ${PARTNER.name}`, bold: true, color: '#ffd97a', size: 26 }] : [])];
  const rivals = [];
  if (s.mode !== 'two') {
    rivals.push({ t: 'p', label: s.mode === 'team' ? 'Choose the rival team' : 'Choose your rival', bold: true, color: '#f4ecd0', size: 26 });
    PROFILES.forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0, locked = demo && i > 1;
      const nm = s.mode === 'team' ? `${pf.name} & ${PROFILES[Math.max(0, i - 1)].id === pf.id ? 'Pino' : PROFILES[Math.max(0, i - 1)].name}` : pf.name;
      rivals.push({ t: 'btn', id: `opp${i}`, label: nm, sub: locked ? 'In the full game' : `${'★'.repeat(pf.stars)}${'☆'.repeat(5 - pf.stars)}  ${wide ? '' : pf.tag}${won ? `${wide ? '' : ' · '}won ${won}` : ''}`.trim(), active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: wide ? 84 : 92 });
    });
  }
  const courts = [{ t: 'p', label: 'Choose the court', bold: true, color: '#f4ecd0', size: 26 }];
  SURFACE_IDS.forEach((id) => {
    const locked = demo && id !== 'shell';
    const sub = id === 'daily' ? 'A new court every day' : SURFACES[id].sub;
    courts.push({ t: 'btn', id: `crt${id}`, label: surfaceName(id), sub: locked ? 'In the full game' : sub, active: s.court === id && !locked, disabled: locked, hitDisabled: true, ...(wide ? { h: 88 } : {}) });
  });
  const length = [{ t: 'p', label: 'Match length', bold: true, color: '#f4ecd0', size: 26 },
    { t: 'btn', id: 'len12', label: 'To 12 points', ...(wide ? {} : { row: 9 }), active: s.target === 12 },
    { t: 'btn', id: 'len7', label: 'Quick: to 7', ...(wide ? {} : { row: 9 }), active: s.target === 7 }];
  return { head, rivals, courts, length };
}
export function setupWidgets(state) {
  const p = setupParts(state, false);
  return [...p.head, ...p.rivals, ...p.courts, ...p.length, { t: 'gap', h: 24 }];
}

export function settingsParts(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  const a = [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-calm', label: st.calm ? 'Calm mode: On' : 'Calm mode: Off', sub: 'Shows the whole path of your throw before you let go', active: st.calm },
    { t: 'btn', id: 'set-pal', label: st.palette === 'bold' ? 'Ball colours: Blue & orange' : 'Ball colours: Red & green', sub: 'Blue and orange is easier to tell apart for many players' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#f4ecd0', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
  ];
  const b = [
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#f4ecd0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#f4ecd0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
  return { a, b };
}
export function settingsWidgets(state) { const p = settingsParts(state); return [...p.a, ...p.b]; }

// a gold cup between two balls for the result screen
const trophyArt = (win, h) => ({
  t: 'art', h,
  draw(ctx, w, hh) {
    const cx = w / 2, cy = hh / 2, s = Math.min(1, hh / 300) * 1.0;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
    const halo = ctx.createRadialGradient(0, 0, 10, 0, 0, 170); halo.addColorStop(0, win ? 'rgba(255,224,130,0.5)' : 'rgba(255,255,255,0.18)'); halo.addColorStop(1, 'rgba(255,224,130,0)');
    ctx.fillStyle = halo; ctx.fillRect(-200, -200, 400, 400);
    drawBallIcon(ctx, -150, 70, 42, 0); drawBallIcon(ctx, 150, 78, 42, 1); drawBallIcon(ctx, 104, 100, 14, -1);
    if (win) {
      const g = ctx.createLinearGradient(-60, -100, 60, 40); g.addColorStop(0, '#fff2b0'); g.addColorStop(0.45, '#e8b84a'); g.addColorStop(1, '#8f5f12');
      ctx.fillStyle = g; ctx.strokeStyle = 'rgba(80,50,6,0.7)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-70, -90); ctx.lineTo(70, -90); ctx.bezierCurveTo(70, -10, 40, 28, 0, 36); ctx.bezierCurveTo(-40, 28, -70, -10, -70, -90); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 12; ctx.strokeStyle = '#d9a73a'; ctx.beginPath(); ctx.arc(-76, -52, 26, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke(); ctx.beginPath(); ctx.arc(76, -52, 26, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
      ctx.fillStyle = g; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(80,50,6,0.7)';
      ctx.fillRect(-10, 34, 20, 38); ctx.strokeRect(-10, 34, 20, 38);
      roundPath(ctx, -50, 70, 100, 26, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(-34, -52, 9, 34, 0.1, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7a4c0c'; ctx.font = `700 40px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillText('★', 0, -36);
    }
    ctx.restore();
  },
});

// result widget groups: the words, the buttons
export function resultParts(state, wide) {
  const m = state.m, o = m.over, mode = m.cfg.mode, winner = o.win, lab = state.labels;
  const title = mode === 'two' ? `${lab[winner].name} wins` : mode === 'watch' ? `${lab[winner].name} wins` : mode === 'team' ? (winner === 0 ? 'Your team wins!' : 'Your team loses') : winner === 0 ? 'You win!' : 'You lose';
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const words = [{ t: 'gap', h: wide ? 6 : big ? 24 : 40 }, ...(wide || big ? [] : [trophyArt(winner === 0 || mode === 'two' || mode === 'watch', 260)]), { t: 'h', label: title, size: 62, cap: big ? 1.2 : 1.5 }, { t: 'h', label: `${m.scores[0]} – ${m.scores[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' }];
  if (o.shutout) words.push({ t: 'p', label: winner === 0 || mode !== 'ai' ? 'A clean sheet: the other side never scored.' : 'A clean sheet for the rival.', bold: true, color: '#f4ecd0', size: 26, cap: big ? 2 : 3 });
  const frames = `${m.log.length} frames played on ${surfaceName(m.cfg.court)}.`;
  const rec = mode === 'ai' ? `Your record against ${PROFILES[m.cfg.opp].name}: ${(state.record?.wins ?? [])[m.cfg.opp] ?? 0} won.` : '';
  words.push({ t: 'p', label: big ? `${frames} ${rec}`.trim() : frames, size: 26, cap: big ? 2 : 3 });
  if (rec && !big) words.push({ t: 'p', label: rec, size: 26 });
  const btns = [{ t: 'gap', h: wide ? 0 : 24 }];
  if (mode === 'tour') {
    const t = state.tour;
    if (winner === 0 && t && !t.done) btns.push({ t: 'btn', id: 'next', label: 'Next round', primary: true, h: 92 });
    else if (winner === 0) btns.push({ t: 'btn', id: 'bracket', label: 'You won the cup!', primary: true, h: 92 });
    else btns.push({ t: 'btn', id: 'again', label: 'New cup', primary: true, h: 92 });
    btns.push({ t: 'btn', id: 'bracket', label: 'See the bracket', row: 6 }, { t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  } else {
    btns.push({ t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 }, { t: 'btn', id: 'new', label: 'New match', row: 6 }, { t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  }
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
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 },
    { t: 'btn', id: 'p-calm', label: st.calm ? 'Calm: On' : 'Calm: Off', row: 8, active: st.calm },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets(wide) {
  return [
    { t: 'gap', h: wide ? 40 : 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free frames of the web demo. The full game on iPhone and Android has every court, every rival, the cup and unlimited matches.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

// the tournament bracket: eight players, three rounds
export function bracketWidgets(state, wide) {
  const t = state.tour;
  const tail = t && t.done ? (t.won ? 'You won the cup!' : 'Knocked out. Try again!') : `${['Quarter-final', 'Semi-final', 'Final'][t ? t.round : 0]}: you play ${t ? t.names[t.oppIndex[t.round] ?? 0] : ''}`;
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Cup Tournament', size: 46 }, { t: 'gap', h: 12 },
    { t: 'art', h: wide ? 330 : 560, draw: (ctx, w, h) => drawBracket(ctx, w, h, state) },
    { t: 'p', label: tail, bold: true, color: '#ffd97a', size: 28 },
    { t: 'gap', h: 8 },
    ...(t && !t.done ? [{ t: 'btn', id: 'cup-go', label: `Play the ${['quarter-final', 'semi-final', 'final'][t.round]}`, primary: true, h: 88 }] : [{ t: 'btn', id: 'cup-new', label: 'New cup', primary: true, h: 88 }]),
    { t: 'btn', id: 'back', label: 'Back', dark: true, h: 88 },
    { t: 'gap', h: 30 },
  ];
}
function drawBracket(ctx, w, h, state) {
  const t = state.tour;
  if (!t) return;
  ctx.save();
  const cols = 3, colW = w / (cols + 1), rowH = h / 8;
  ctx.font = `700 ${Math.round(Math.min(28, rowH * 0.42))}px ${FONT}`; ctx.textBaseline = 'middle';
  const slot = (x, y, name, you, lost, win) => {
    const bw = colW * 0.92, bh = rowH * 0.78;
    roundPath(ctx, x, y - bh / 2, bw, bh, 10); ctx.fillStyle = win ? 'rgba(255,217,122,0.95)' : you ? 'rgba(46,160,96,0.9)' : 'rgba(20,50,34,0.85)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = win ? '#1d2b20' : lost ? 'rgba(255,255,255,0.4)' : '#fff6dc'; ctx.textAlign = 'center';
    let s = name; while (ctx.measureText(s).width > bw - 12 && s.length > 3) s = s.slice(0, -1);
    ctx.fillText(s, x + bw / 2, y);
  };
  // round 0: eight names, 1: four, 2: two, 3 (right): winner
  for (let i = 0; i < 8; i++) slot(4, rowH * (i + 0.5), t.names[i], i === 0, t.alive[0] && !t.alive[0][i], false);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  let ys = Array.from({ length: 8 }, (_, i) => rowH * (i + 0.5));
  for (let r = 1; r <= 3; r++) {
    const nxt = [];
    for (let i = 0; i < ys.length; i += 2) {
      const y = (ys[i] + ys[i + 1]) / 2, x0 = 4 + (r - 1) * colW + colW * 0.9, x1 = 4 + r * colW;
      ctx.beginPath(); ctx.moveTo(x0, ys[i]); ctx.lineTo(x0 + (x1 - x0) / 2, ys[i]); ctx.lineTo(x0 + (x1 - x0) / 2, ys[i + 1]); ctx.lineTo(x0, ys[i + 1]); ctx.moveTo(x0 + (x1 - x0) / 2, y); ctx.lineTo(x1, y); ctx.stroke();
      const idx = i / 2, w2 = t.winners[r - 1] ? t.winners[r - 1][idx] : -1;
      if (w2 >= 0) slot(x1, y, t.names[w2], w2 === 0, false, r === 3);
      else slot(x1, y, '?', false, false, false);
      nxt.push(y);
    }
    ys = nxt;
  }
  ctx.restore();
}

// The columns of a flow screen for layout L: [{ widgets, x, w, top, bottom, center }]
// The Arcforge lockup under the title menu: >= ~125 css px wide (aspect 1200:327), its width never beyond the button column.
const lockSize = (L) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), Math.max(180, (L.wide ? L.w / 2 : L.w) - 80)); const h = w * 327 / 1200; return { w, h, strip: Math.round(h + 26) }; };
function screenCols(state, key, L) {
  const w = L.w, I = L.ins, one = (widgets, cw = 640, top = I.t, bottom = L.sb) => { const cwi = Math.min(cw, w - 80); return [{ widgets, x: (w - cwi) / 2, w: cwi, top, bottom }]; };
  const side = Math.max(I.l, I.r);
  if (key === 'title') {
    const wd = titleWidgets(state, !L.wide && L.sb < 1100);
    const strip = lockSize(L).strip;     // room kept under the buttons for the Arcforge lockup
    if (!L.wide) { const off = Math.round(Math.max(0, L.sb - 1280) * 0.35); return one(wd, 640, Math.max(off, I.t), L.sb - strip); }
    const cw = Math.min(500, w / 2 - 40 - side), lw = Math.min(560, w / 2 - 40 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 8;
    return [{ widgets: [wd[0]], x: w / 4 - lw / 2, w: lw, top, bottom: bot, center: true, shift: -26 }, { widgets: wd.slice(1), x: (3 * w) / 4 - cw / 2, w: cw, top, bottom: bot - strip, center: true }];
  }
  if (key === 'setup') {
    if (!L.wide) return one(setupWidgets(state)).map((c) => ({ ...c, ...L.setup.cols[0] }));
    const p = setupParts(state, true), two = state.setup.mode === 'two';
    const cols = L.setup.cols;
    if (two) return [{ widgets: [...p.head, ...p.courts], ...cols[0] }, { widgets: p.length, ...cols[1] }, { widgets: [], ...cols[2] }];
    return [{ widgets: p.rivals, ...cols[0] }, { widgets: [...p.head, ...p.courts], ...cols[1] }, { widgets: p.length, ...cols[2] }];
  }
  if (key === 'settings') {
    if (!L.wide) return one(settingsWidgets(state));
    const p = settingsParts(state), cw = Math.min(520, w / 2 - 30 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 8;
    return [{ widgets: p.a, x: w / 2 - cw - 14, w: cw, top, bottom: bot, center: true }, { widgets: [{ t: 'gap', h: 58 }, ...p.b], x: w / 2 + 14, w: cw, top, bottom: bot, center: true }];
  }
  if (key === 'demolimit') return one(demoLimitWidgets(L.wide));
  if (key === 'bracket') return one(bracketWidgets(state, L.wide), 700);
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
  if (key === 'title') {      // the lockup: right under the last button row, pinned at the bottom when the menu scrolls
    const ls = lockSize(L), bc = cols[cols.length - 1], used = bc.top + bc.off + bc.lay.contentH, cx = L.wide ? (3 * L.w) / 4 : L.w / 2;
    const pinned = L.sb - ls.h - 12, y = Math.min(used + 12, pinned), m = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(ls.w + 24, m), th = Math.max(ls.h + 12, m);
    out.lock = { cx, y, w: ls.w, h: ls.h, tap: { x: cx - tw / 2, y: y - 4, w: tw, h: Math.max(th, ls.h + 8) } };
  }
  return out;
}
// A layout for the scene being updated right now, before anything has been drawn (first frame after a scene change, a
// rotation, or headless runs): same widgets, text widths estimated instead of measured.
export function ensureLayout(state, key, L) {
  if (LAID.key === key && LAID.size === L.key && LAID.cols.length) return;
  if (!['title', 'setup', 'settings', 'result', 'demolimit', 'bracket'].includes(key)) return;
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
// Button rectangles of the current flow screen, scroll applied (for the layout check scripts).
export function flowRects(scroll) {
  const out = [];
  for (const c of LAID.cols) {
    const sc = Math.min(scroll, Math.max(0, c.lay.contentH - (c.bottom - c.top)));
    for (const it of c.lay.items) if (it.w.t === 'btn') out.push({ id: it.w.id, x: it.x, y: c.top + c.off + it.y - sc, w: it.wd, h: it.h, clip: { top: c.top, bottom: c.bottom } });
  }
  return out;
}

function scrim(ctx, L, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, L.h);
  g.addColorStop(0, `rgba(6,20,12,${a * 0.7})`); g.addColorStop(0.5, `rgba(6,20,12,${a})`); g.addColorStop(1, `rgba(6,20,12,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
}

// An obvious "there is more below / above" cue for any list that scrolls: soft fade plus a chevron pill.
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0, w) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(6,20,12,0)'); g.addColorStop(1, 'rgba(6,20,12,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(244,236,208,0.9)'; ctx.fill();
    ctx.fillStyle = '#1d2b20'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(244,236,208,0.9)'; ctx.fill();
    ctx.fillStyle = '#1d2b20'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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

export function renderTitle(ctx, state, L) {
  const ok = worldBackdrop(ctx, L, state, state.att.w, state.att.parts, { noMarker: true });
  if (!ok) return;
  scrim(ctx, L, 0.28);
  // soft vignette behind the logo
  const vx = L.wide ? L.w / 4 : L.w / 2, vy = L.wide ? L.h / 2 : 260 + Math.round(Math.max(0, L.sb - 1280) * 0.35);
  const g = ctx.createRadialGradient(vx, vy, 40, vx, vy, 420);
  g.addColorStop(0, 'rgba(6,20,12,0.5)'); g.addColorStop(1, 'rgba(6,20,12,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
  if (L.wide) {   // calm panel behind the buttons so they read over the lane
    const c = screenCols(state, 'title', L)[1], gx = ctx.createLinearGradient(c.x - 60, 0, c.x + c.w + 60, 0);
    gx.addColorStop(0, 'rgba(6,20,12,0)'); gx.addColorStop(0.25, 'rgba(6,20,12,0.4)'); gx.addColorStop(1, 'rgba(6,20,12,0.45)');
    ctx.fillStyle = gx; ctx.fillRect(c.x - 60, 0, L.w - c.x + 60, L.h);
  }
  drawFlowScreen(ctx, state, 'title', L);
  // the Arcforge lockup under the last button row; a tap opens the Arcforge home
  if (LAID.lock) {
    const k = LAID.lock, dn = !!(state.ui.drag && state.ui.drag.x0 >= k.tap.x && state.ui.drag.x0 <= k.tap.x + k.tap.w && state.ui.drag.y0 >= k.tap.y && state.ui.drag.y0 <= k.tap.y + k.tap.h);
    ctx.save(); ctx.fillStyle = 'rgba(6,20,12,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
    drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.w * (dn ? 0.96 : 1), dn ? 0.7 : 1);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(244,236,208,0.6)';
  if (state.demo) ctx.fillText('Web demo', L.wide ? (3 * L.w) / 4 : L.w / 2, L.sb - 4);
}

export function renderSetup(ctx, state, L) {
  const ok = worldBackdrop(ctx, L, state, state.att.w, state.att.parts, { noMarker: true });
  if (!ok) return;
  scrim(ctx, L, 0.62);
  drawFlowScreen(ctx, state, 'setup', L);
  if (!L.wide) {
    const y0 = L.pins.start.y - 56, g = ctx.createLinearGradient(0, y0, 0, L.h);
    g.addColorStop(0, 'rgba(6,20,12,0)'); g.addColorStop(0.2, 'rgba(6,20,12,0.85)'); g.addColorStop(1, 'rgba(6,20,12,0.95)');
    ctx.fillStyle = g; ctx.fillRect(0, y0, L.w, L.h - y0);
  }
  drawButton(ctx, L.pins.start, 'Start the match', { primary: true, size: L.wide ? 28 : 32 });
  drawButton(ctx, L.pins.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) {
    ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0';
    const mx = L.wide ? L.pins.start.x + (L.pins.back.x + L.pins.back.w - L.pins.start.x) / 2 : L.w / 2;
    ctx.fillText(state.setupMsg, mx, L.pins.start.y - (L.wide ? 20 : 16));
  }
}
export function renderSettings(ctx, state, L) {
  const ok = worldBackdrop(ctx, L, state, state.att.w, state.att.parts, { noMarker: true });
  if (!ok) return;
  scrim(ctx, L, 0.66);
  drawFlowScreen(ctx, state, 'settings', L);
}
export function renderResult(ctx, state, L) {
  const ok = worldBackdrop(ctx, L, state, state.w, [], { noMarker: true });
  if (!ok) return;
  scrim(ctx, L, 0.6);
  drawFlowScreen(ctx, state, 'result', L);
  const cols = LAID.cols, bcol = cols[cols.length - 1];
  // one quiet line, never over the buttons
  const maxScroll = Math.max(0, bcol.lay.contentH - (bcol.bottom - bcol.top));
  const y = L.wide ? Math.min(L.sb - 12, bcol.top + bcol.off + bcol.lay.contentH + 44) : L.sb - 22;
  if (maxScroll === 0 || L.wide) drawMoreLine(ctx, L.wide ? bcol.x + bcol.w / 2 : L.w / 2, y, 18);
}
export function renderBracket(ctx, state, L) {
  const ok = worldBackdrop(ctx, L, state, state.att.w, state.att.parts, { noMarker: true });
  if (!ok) return;
  scrim(ctx, L, 0.66);
  drawFlowScreen(ctx, state, 'bracket', L);
}
export function renderDemoLimit(ctx, state, L) {
  const ok = worldBackdrop(ctx, L, state, state.att.w, state.att.parts, { noMarker: true });
  if (!ok) return;
  scrim(ctx, L, 0.7);
  drawFlowScreen(ctx, state, 'demolimit', L);
}
export function renderPause(ctx, state, L) {
  scrim(ctx, L, 0.55);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const cardW = Math.min(660, L.w - 60 - 2 * Math.max(L.ins.l, L.ins.r)), cw = cardW - 60, cx = L.w / 2;
  const lay = flowLayout(ctx, wd, sc, { x: cx - cw / 2, w: cw });
  const top = Math.max(L.ins.t, 0) + (L.wide ? 20 : 70), bottom = L.sb - (L.wide ? 20 : 70);
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (L.h - ch) / 2);
  panel(ctx, cx - cardW / 2, y0 - 20, cardW, ch + 40, { r: 30, fill: 'rgba(10,34,22,0.94)', stroke: 'rgba(255,224,130,0.5)' });
  LAID = { key: 'pause', size: L.key, cols: [{ lay, x: cx - cw / 2, w: cw, top: y0, bottom: y0 + ch, off: 0 }], max: Math.max(0, lay.contentH - ch), est: false };
  const sc0 = Math.min(state.ui.scroll, LAID.max);
  drawFlow(ctx, lay, y0, y0 + ch, sc0, { clipX: cx - cardW / 2, clipW: cardW });
  scrollHint(ctx, y0, y0 + ch, sc0, LAID.max, cx - cardW / 2, cardW);
}

// ---- reference pages (one continuous scrolling reader) -----------------------------------------
export const REF = { max: 0, view: 400 };   // published each frame: how far the body can scroll, and its height
export const pageCount = () => 1;

// Flows every section (title, optional illustration, paragraphs) into one tall column; y offsets are relative to the body top.
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
  const ok = worldBackdrop(ctx, L, state, state.att.w, [], { noMarker: true });
  if (!ok) return;
  scrim(ctx, L, 0.66);
  const PANEL = L.ref.panel;
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let fl = pageCache.get(pkey);
  if (!fl) { fl = buildFlow(ctx, list, sc, PANEL); pageCache.set(pkey, fl); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, top = PANEL.y + 96, viewH = Math.max(60, PANEL.h - 96 - 70);
  REF.max = Math.max(0, Math.ceil(fl.total - viewH)); REF.view = viewH;
  state.refScroll = Math.max(0, Math.min(REF.max, state.refScroll || 0));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(250,244,226,0.97)', stroke: 'rgba(60,80,50,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(110,76,40,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(110,76,40,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { const aw = Math.min(PANEL.w - 80, 620); ctx.save(); ctx.beginPath(); ctx.rect(pcx - aw / 2 - 20, y, aw + 40, 210); ctx.clip(); drawArt(it.art, ctx, pcx - aw / 2, y, aw, 198, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(110,76,40,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(110,76,40,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(70,50,30,0.7)';
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
function floorStrip(ctx, x, y, w, h, kind = 'shell') {
  const cols = { shell: ['#ece4cf', '#cfc4a6'], clay: ['#c8744a', '#a9573a'], lawn: ['#79b25a', '#5a9444'], sand: ['#efd9a8', '#d6bd86'] }[kind];
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = g; ctx.fill();
  ctx.save(); roundPath(ctx, x, y, w, h, 16); ctx.clip();
  let s = 11;
  for (let i = 0; i < 220; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const px = x + (s % 10000) / 10000 * w; s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const py = y + (s % 10000) / 10000 * h; ctx.fillStyle = i % 3 ? 'rgba(255,255,255,0.35)' : 'rgba(70,50,30,0.25)'; ctx.beginPath(); ctx.arc(px, py, 1 + (i % 3) * 0.6, 0, TAU); ctx.fill(); }
  ctx.restore();
  ctx.lineWidth = 7; ctx.strokeStyle = '#7a4a26'; roundPath(ctx, x, y, w, h, 16); ctx.stroke();
}
function arrow(ctx, x0, y0, x1, y1, col = C.terra, wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    balls() {
      floorStrip(ctx, 0, 0, w, h);
      drawBallIcon(ctx, w * 0.2, h * 0.46, 40, 0); drawBallIcon(ctx, w * 0.5, h * 0.46, 40, 1); drawBallIcon(ctx, w * 0.8, h * 0.46, 15, -1);
      label(ctx, TEAM[0].name, w * 0.2, h - 24, 22); label(ctx, TEAM[1].name, w * 0.5, h - 24, 22); label(ctx, 'Pallino', w * 0.8, h - 24, 22);
    },
    pull() {
      floorStrip(ctx, 0, 0, w, h);
      const cx = w * 0.4, by = h * 0.4;
      ctx.setLineDash([3, 9]); ctx.strokeStyle = 'rgba(40,60,40,0.7)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, by); ctx.lineTo(cx + 120, by - 100); ctx.stroke(); ctx.setLineDash([]);
      drawBallIcon(ctx, cx, by, 30, 0);
      arrow(ctx, cx, by + 6, cx - 70, h * 0.86, C.terra, 5); label(ctx, 'pull back', cx - 70, h * 0.86 + 0, 20, C.terra, 'right');
      arrow(ctx, cx + 30, by - 30, cx + 130, by - 108, C.olive, 5); label(ctx, 'ball goes', cx + 150, by - 100, 20, C.olive, 'left');
    },
    types() {
      floorStrip(ctx, 0, 0, w, h);
      const gy = h * 0.8;
      const cols = ['#1f7a4a', '#3f78ad', '#c8202c'];
      [['Roll', 0], ['Lob', 1], ['Hit', 2]].forEach(([nm, i]) => {
        const x0 = 24, x1 = w * (0.38 + i * 0.28) , hgt = [0, 96, 18][i];
        ctx.strokeStyle = cols[i]; ctx.lineWidth = 4; ctx.setLineDash([2, 9]); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x0, gy - 8 - i * 4); ctx.quadraticCurveTo((x0 + x1) / 2, gy - 8 - hgt * 2 - i * 4, x1, gy - 8 - i * 4); ctx.stroke(); ctx.setLineDash([]);
        drawBallIcon(ctx, x1, gy - 15 - i * 4, 14, 0);
        label(ctx, nm, x1, gy + 28, 20, cols[i]);
      });
    },
    curve() {
      floorStrip(ctx, 0, 0, w, h);
      [['Straight', 0.18, 0, '#3f78ad'], ['Curve left', 0.5, -1, '#7c5aa0'], ['Curve right', 0.82, 1, '#1f7a4a']].forEach(([nm, fx, dir, col]) => {
        const cx = w * fx, y0 = h * 0.8, y1 = h * 0.2;
        ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.setLineDash([2, 9]); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx, y0); ctx.quadraticCurveTo(cx, (y0 + y1) / 2 + 20, cx + dir * 60, y1); ctx.stroke(); ctx.setLineDash([]);
        drawBallIcon(ctx, cx + dir * 60, y1, 16, 0); drawBallIcon(ctx, cx, y0 + 6, 12, 0, 0.5);
        label(ctx, nm, cx, h - 12, 20, col);
      });
    },
    order() {
      floorStrip(ctx, 0, 0, w, h);
      const cx = w * 0.5, cy = h * 0.42;
      drawBallIcon(ctx, cx, cy, 12, -1);
      ctx.strokeStyle = 'rgba(255,214,90,0.95)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(cx - 70, cy + 24, 34, 15, 0, 0, TAU); ctx.stroke();
      drawBallIcon(ctx, cx - 70, cy + 20, 28, 0); drawBallIcon(ctx, cx + 100, cy - 12, 28, 1);
      label(ctx, 'in', cx - 70, cy + 82, 22, '#a4780c'); label(ctx, 'out: plays next', cx + 100, cy + 40, 20, C.terra);
    },
    score() {
      floorStrip(ctx, 0, 0, w, h);
      const cx = w * 0.5, cy = h * 0.5;
      ctx.strokeStyle = 'rgba(60,40,20,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
      [[-120, -12], [-34, 50], [96, 16], [150, -30]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + dx, cy + dy); ctx.stroke(); });
      ctx.setLineDash([]);
      drawBallIcon(ctx, cx - 120, cy - 12, 24, 0); drawBallIcon(ctx, cx - 34, cy + 50, 24, 0); drawBallIcon(ctx, cx + 96, cy + 16, 24, 1); drawBallIcon(ctx, cx + 150, cy - 30, 24, 0);
      drawBallIcon(ctx, cx, cy, 11, -1);
      label(ctx, '1', cx - 34, cy + 92, 22, '#7a1b22'); label(ctx, '2', cx - 120, cy - 44, 22, '#7a1b22'); label(ctx, `${TEAM[0].name} scores 2`, cx, h - 14, 21, C.ink);
    },
    court() {
      const pw = w * 0.5, px = (w - pw) / 2;
      floorStrip(ctx, px, 4, pw, h - 8);
      ctx.strokeStyle = '#fffdf5'; ctx.lineWidth = 3;
      const yf = h * 0.8, yc = h * 0.42;
      ctx.beginPath(); ctx.moveTo(px, yf); ctx.lineTo(px + pw, yf); ctx.moveTo(px, yc); ctx.lineTo(px + pw, yc); ctx.stroke();
      label(ctx, 'foul line (3 m)', px - 12, yf + 6, 18, C.ink, 'right'); label(ctx, 'centre line (9 m)', px - 12, yc + 6, 18, C.ink, 'right'); label(ctx, 'back wall', px + pw + 12, 24, 18, C.ink, 'left');
      label(ctx, 'rail', px + pw + 12, h * 0.6, 18, C.ink, 'left');
      drawBallIcon(ctx, w / 2, h * 0.12, 9, -1);
    },
    rails() {
      floorStrip(ctx, 0, 0, w, h);
      ctx.strokeStyle = C.olive; ctx.lineWidth = 5; ctx.setLineDash([2, 9]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w * 0.15, h * 0.85); ctx.lineTo(w * 0.62, h * 0.18); ctx.lineTo(w * 0.78, h * 0.55); ctx.stroke(); ctx.setLineDash([]);
      drawBallIcon(ctx, w * 0.78, h * 0.58, 22, 0); drawBallIcon(ctx, w * 0.15, h * 0.88, 14, 0, 0.5);
      label(ctx, 'bank off the rail', w * 0.45, h * 0.12, 20, C.olive, 'center');
    },
    surfaces() {
      const sw = (w - 36) / 4;
      [['Shell', 'shell'], ['Clay', 'clay'], ['Lawn', 'lawn'], ['Sand', 'sand']].forEach(([nm, k], i) => {
        const sx = i * (sw + 12);
        floorStrip(ctx, sx, 0, sw, h - 44, k); drawBallIcon(ctx, sx + sw / 2, (h - 44) / 2, 22, i % 2);
        label(ctx, nm, sx + sw / 2, h - 14, 19);
      });
    },
  };
  (A[key] ?? A.balls)();
  ctx.restore();
}
