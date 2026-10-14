// Every screen that is not the play screen: title, setup, settings, result, pause, the club ladder, and the scrolling
// About / How to play / Rules reader with its illustrations (drawn with the game's own bowls). Pure drawing; game.js owns
// state. Every position comes from the live layout L (layout.js).
import { GREEN_IDS, GREENS, greenName, WEIGHTS, RINK } from './sim.js';
import { drawBowlIcon, TEAM, drawGreen } from './art.js';
import { drawWorld } from './view.js';
import { v3 } from './v3.js';
import { projector, fitBox } from './cam.js';
import { TEXT_SCALES, THINK_STEPS, host } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES, LADDER } from './opponents.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { drawLockup, drawMoreLine } from './brand.js';

const TAU = Math.PI * 2;
const GUIDE_NAMES = ['Whole path', 'First part only', 'Off'];

// ---- flow screens ------------------------------------------------------------------------------
// A screen is one or more columns of widgets (flowLayout). LAID keeps the laid-out result for hit-testing and scrolling.
let LAID = { key: '', size: '', cols: [], max: 0, est: false };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };

const heroArt = (h = 440) => ({
  t: 'art', h,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const s = Math.min(1, w / 640); ctx.scale(s, s);
    const cx = w / s / 2;
    // embossed lettering: a deep shadow, a dark bevel edge, a lit metallic face and a thin highlight on the top edge
    const emboss = (txt, y, font, c0, c1, c2) => {
      ctx.font = font;
      ctx.save(); ctx.shadowColor = 'rgba(0,10,6,0.65)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8; ctx.fillStyle = '#10241a'; ctx.fillText(txt, cx, y + 4); ctx.restore();
      ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(8,20,14,0.9)'; ctx.strokeText(txt, cx, y);
      const g = ctx.createLinearGradient(0, y - 96, 0, y + 6); g.addColorStop(0, c0); g.addColorStop(0.55, c1); g.addColorStop(1, c2);
      ctx.fillStyle = g; ctx.fillText(txt, cx, y);
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.save(); ctx.beginPath(); ctx.rect(0, y - 110, 4000, 60); ctx.clip(); ctx.strokeText(txt, cx, y - 1.5); ctx.restore();
    };
    emboss('Lawn', 140, `700 112px ${DISPLAY}`, '#ffffff', '#efe7d0', '#b9ad8a');
    emboss('Bowls', 236, `italic 700 104px ${DISPLAY}`, '#fff1a8', '#e2b23c', '#8d5f10');
    ctx.font = `600 24px ${FONT}`; textShadow(ctx, 'READ THE GREEN · BEND IT IN', cx, 284, '#f3efe0', 6);
    // a white string with the jack on it
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(cx - 160, 308, 320, 3);
    
    ctx.restore();
  },
});

export function titleWidgets(state, compact = false) {
  const sound = state.settings.sound;
  const wd = [heroArt(compact ? 330 : 360)];
  wd.push({ t: 'btn', id: 'play', label: 'Play vs Computer', primary: true, h: compact ? 80 : 92 });
  wd.push({ t: 'btn', id: 'ladder', label: 'Club Ladder', row: 1 });
  wd.push({ t: 'btn', id: 'two', label: 'Two Players', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 3 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 4 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4 });
  return wd;
}

// setup widget groups: head, rivals, greens, length
export function setupParts(state, wide) {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const title = s.mode === 'two' ? 'Two Players' : 'New Match';
  const head = wide ? [] : [{ t: 'gap', h: 10 }, { t: 'h', label: title, size: 48 }];
  const rivals = [];
  if (s.mode !== 'two') {
    rivals.push({ t: 'p', label: 'Choose your rival', bold: true, color: '#f4ecd0', size: 26 });
    PROFILES.forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0, locked = demo && i > 1;
      rivals.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${'★'.repeat(pf.stars)}${'☆'.repeat(5 - pf.stars)}  ${wide ? '' : pf.tag}${won ? `${wide ? '' : ' · '}won ${won}` : ''}`.trim(), active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: wide ? 84 : 92 });
    });
  }
  const greens = [{ t: 'p', label: 'Choose the green', bold: true, color: '#f4ecd0', size: 26 }];
  GREEN_IDS.forEach((id) => {
    const locked = demo && id !== 'village';
    greens.push({ t: 'btn', id: `grn${id}`, label: greenName(id), sub: locked ? 'In the full game' : GREENS[id].sub, active: s.green === id && !locked, disabled: locked, hitDisabled: true, ...(wide ? { h: 88 } : {}) });
  });
  const length = [{ t: 'p', label: 'Match length', bold: true, color: '#f4ecd0', size: 26 },
    { t: 'btn', id: 'ends6', label: '6 ends', sub: 'about 8 minutes', ...(wide ? {} : { row: 9 }), active: s.ends === 6 },
    { t: 'btn', id: 'ends10', label: '10 ends', sub: 'a full match', ...(wide ? {} : { row: 9 }), active: s.ends === 10 }];
  return { head, rivals, greens, length };
}
export function setupWidgets(state) {
  const p = setupParts(state, false);
  return [...p.head, ...p.rivals, ...p.greens, ...p.length, { t: 'gap', h: 24 }];
}

export function settingsParts(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  const a = [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-guide', label: `Guide line: ${GUIDE_NAMES[st.guide]}`, sub: 'Tap to change: the whole bent path, only its first part, or none', active: st.guide === 0 },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#f4ecd0', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
  ];
  const b = [
    { t: 'p', label: `Watch & Learn think time: ${THINK_STEPS[st.thinkIdx]} sec`, bold: true, color: '#f4ecd0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : state.owned ? [{ t: 'p', label: 'Full game unlocked', bold: true, size: 26, color: '#ecc65c' }] : [{ t: 'btn', id: 'restore', label: state.restoreBusy ? 'Checking…' : 'Restore purchase', dark: true, disabled: !!state.restoreBusy }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#f4ecd0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
  return { a, b };
}
export function settingsWidgets(state) { const p = settingsParts(state); return [...p.a, ...p.b]; }

// a pair of bowls with a gold cup for the result screen
const trophyArt = (win, h) => ({
  t: 'art', h,
  draw(ctx, w, hh) {
    const cx = w / 2, cy = hh / 2, s = Math.min(1, hh / 300);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
    const halo = ctx.createRadialGradient(0, 0, 10, 0, 0, 170); halo.addColorStop(0, win ? 'rgba(255,224,130,0.5)' : 'rgba(255,255,255,0.18)'); halo.addColorStop(1, 'rgba(255,224,130,0)');
    ctx.fillStyle = halo; ctx.fillRect(-200, -200, 400, 400);
    drawBowlIcon(ctx, -150, 70, 42, 0); drawBowlIcon(ctx, 150, 78, 42, 1); drawBowlIcon(ctx, 104, 100, 14, -1);
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
  const title = mode === 'two' || mode === 'watch' ? `${lab[winner].name} wins` : winner === 0 ? 'You win!' : 'You lose';
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const words = [{ t: 'gap', h: wide ? 6 : big ? 24 : 40 }, ...(wide || big ? [] : [trophyArt(winner === 0 || mode === 'two' || mode === 'watch', 260)]), { t: 'h', label: title, size: 62, cap: big ? 1.2 : 1.5 }, { t: 'h', label: `${m.scores[0]} – ${m.scores[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ecc65c' }];
  if (o.shutout) words.push({ t: 'p', label: winner === 0 || mode !== 'ai' ? 'A clean sheet: the other side never scored.' : 'A clean sheet for the rival.', bold: true, color: '#f4ecd0', size: 26, cap: big ? 2 : 3 });
  const ends = `${m.log.filter((l) => !l.dead).length} ends played on the ${greenName(m.cfg.green).toLowerCase()}.`;
  const rec = mode === 'ai' ? `Your record against ${PROFILES[m.cfg.opp].name}: ${(state.record?.wins ?? [])[m.cfg.opp] ?? 0} won.` : '';
  words.push({ t: 'p', label: big ? `${ends} ${rec}`.trim() : ends, size: 26, cap: big ? 2 : 3 });
  if (rec && !big) words.push({ t: 'p', label: rec, size: 26 });
  const btns = [{ t: 'gap', h: wide ? 0 : 24 }];
  if (mode === 'ladder') {
    const l = state.ladder;
    if (winner === 0 && l && !l.done) btns.push({ t: 'btn', id: 'next', label: 'Next rung', primary: true, h: 92 });
    else if (winner === 0) btns.push({ t: 'btn', id: 'next', label: 'You topped the ladder!', primary: true, h: 92 });
    else btns.push({ t: 'btn', id: 'again', label: 'Try this rung again', primary: true, h: 92 });
    btns.push({ t: 'btn', id: 'next', label: 'See the ladder', row: 6 }, { t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
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
    { t: 'btn', id: 'p-guide', label: `Guide: ${GUIDE_NAMES[st.guide]}`, row: 8 },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets(wide) {
  return [
    { t: 'gap', h: wide ? 40 : 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have bowled the free ends of the web demo. The full game on iPhone and Android has every green and rival, the club ladder and unlimited matches.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

// the club ladder: five rungs, each a green and a rival
export function ladderWidgets(state, wide) {
  const l = state.ladder, rec = state.record;
  const best = Math.max(rec.ladder | 0, l ? l.rung : 0);
  const rows = LADDER.map((r, i) => ({ r, i, state: i < best || (l && l.done) ? 'won' : i === (l ? l.rung : 0) ? 'now' : 'locked' }));
  const tail = l && l.done ? 'You topped the ladder!' : l && l.lost ? 'Knocked back. Try the rung again!' : `Next: ${PROFILES[LADDER[l ? l.rung : 0].opp].name} on the ${greenName(LADDER[l ? l.rung : 0].green).toLowerCase()}`;
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Club Ladder', size: 46 }, { t: 'gap', h: 8 },
    { t: 'art', h: wide ? 330 : 520, draw: (ctx, w, h) => drawLadder(ctx, w, h, rows, l) },
    { t: 'p', label: tail, bold: true, color: '#ecc65c', size: 28 },
    { t: 'gap', h: 8 },
    ...(l && !l.done ? [{ t: 'btn', id: l.lost ? 'ladder-retry' : 'ladder-go', label: l.lost ? 'Play this rung again' : `Play rung ${l.rung + 1}`, primary: true, h: 88 }] : [{ t: 'btn', id: 'ladder-new', label: 'Start again', primary: true, h: 88 }]),
    { t: 'btn', id: 'back', label: 'Back', dark: true, h: 88 },
    { t: 'gap', h: 30 },
  ];
}
function drawLadder(ctx, w, h, rows, l) {
  const n = rows.length, rowH = h / n;
  ctx.save();
  ctx.textBaseline = 'middle';
  rows.slice().reverse().forEach((row, k) => {
    const y = k * rowH + rowH / 2, now = row.state === 'now';
    const bw = Math.min(w - 12, 640), bx = (w - bw) / 2, bh = rowH * 0.8;
    roundPath(ctx, bx, y - bh / 2, bw, bh, 14);
    ctx.fillStyle = now ? 'rgba(236,198,92,0.96)' : row.state === 'won' ? 'rgba(47,125,58,0.9)' : 'rgba(14,34,58,0.85)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
    const p = PROFILES[row.r.opp];
    ctx.fillStyle = now ? '#1b1405' : '#fff6e0'; ctx.textAlign = 'left';
    ctx.font = `700 ${Math.round(Math.min(28, rowH * 0.3))}px ${FONT}`;
    ctx.fillText(`${row.i + 1}. ${p.name}`, bx + 20, y - bh * 0.14);
    ctx.font = `400 ${Math.round(Math.min(20, rowH * 0.22))}px ${FONT}`;
    ctx.fillText(greenName(row.r.green), bx + 20, y + bh * 0.22);
    ctx.textAlign = 'right'; ctx.font = `700 ${Math.round(Math.min(26, rowH * 0.28))}px ${FONT}`;
    ctx.fillText(row.state === 'won' ? '✓ won' : row.state === 'now' ? '► next' : '·', bx + bw - 20, y);
  });
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
    if (!L.wide && L.w / L.h >= 0.6) {   // squarish tablets in portrait: a narrower menu column on the right leaves the bowler visible on the left
      const cwi = Math.min(480, w * 0.62);
      return [{ widgets: wd, x: w - cwi - Math.max(40, I.r), w: cwi, top: Math.max(I.t, 0) + 10, bottom: L.sb - strip }];
    }
    if (!L.wide) { const off = Math.round(Math.max(0, L.sb - 1280) * 0.35); return one(wd, 640, Math.max(off, I.t), L.sb - strip); }
    const cw = Math.min(500, w / 2 - 40 - side), lw = Math.min(560, w / 2 - 40 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 8;
    return [{ widgets: [wd[0]], x: w / 4 - lw / 2, w: lw, top, bottom: bot, center: true, shift: -26 }, { widgets: wd.slice(1), x: (3 * w) / 4 - cw / 2, w: cw, top, bottom: bot - strip, center: true }];
  }
  if (key === 'setup') {
    if (!L.wide) return one(setupWidgets(state)).map((c) => ({ ...c, ...L.setup.cols[0] }));
    const p = setupParts(state, true), two = state.setup.mode === 'two';
    const cols = L.setup.cols;
    if (two) return [{ widgets: [...p.head, ...p.greens], ...cols[0] }, { widgets: p.length, ...cols[1] }, { widgets: [], ...cols[2] }];
    return [{ widgets: p.rivals, ...cols[0] }, { widgets: [...p.head, ...p.greens], ...cols[1] }, { widgets: p.length, ...cols[2] }];
  }
  if (key === 'settings') {
    if (!L.wide) return one(settingsWidgets(state));
    const p = settingsParts(state), cw = Math.min(520, w / 2 - 30 - side), top = Math.max(I.t, 0) + 8, bot = L.sb - 8;
    return [{ widgets: p.a, x: w / 2 - cw - 14, w: cw, top, bottom: bot, center: true }, { widgets: [{ t: 'gap', h: 58 }, ...p.b], x: w / 2 + 14, w: cw, top, bottom: bot, center: true }];
  }
  if (key === 'demolimit') return one(demoLimitWidgets(L.wide));
  if (key === 'ladder') return one(ladderWidgets(state, L.wide), 700);
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
    const ls = lockSize(L), bc = cols[cols.length - 1], used = bc.top + bc.off + bc.lay.contentH, cx = L.wide ? (3 * L.w) / 4 : (key === 'title' && L.w / L.h >= 0.6) ? bc.x + bc.w / 2 : L.w / 2;
    const pinned = L.sb - ls.h - 12, y = Math.min(used + 12, pinned), m = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(ls.w + 24, m), th = Math.max(ls.h + 12, m);
    out.lock = { cx, y, w: ls.w, h: ls.h, tap: { x: cx - tw / 2, y: y - 4, w: tw, h: Math.max(th, ls.h + 8) } };
  }
  return out;
}
// A layout for the scene being updated right now, before anything has been drawn (first frame after a scene change, a
// rotation, or headless runs): same widgets, text widths estimated instead of measured.
export function ensureLayout(state, key, L) {
  if (LAID.key === key && LAID.size === L.key && LAID.cols.length) return;
  if (!['title', 'setup', 'settings', 'result', 'demolimit', 'ladder'].includes(key)) return;
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

// ---- backdrop: the attract green, close up, behind every menu ---------------------------------------------------
export function backdrop(ctx, L, state, world, parts, focus = null) {
  const R = { x: 0, y: 0, w: L.w, h: L.h };
  // `focus` is the part of the screen the head of the green is shown in (the rest is plain lawn around it)
  const F = focus ?? R;
  const cam = fitBox(F, L.wide, { x0: -1.1, x1: 1.1, y0: 25.6, y1: 27.5 }, { margin: 6, min: 20, max: 260 });
  const pr = projector(F, L.wide, cam);
  drawWorld(ctx, R, pr, state, world, parts, { noRing: true });
}
const titleFocus = (L) => (L.wide ? { x: 0, y: L.h * 0.5, w: L.w * 0.5, h: L.h * 0.5 } : { x: 0, y: L.h * 0.62, w: L.w, h: L.h * 0.38 });

function scrim(ctx, L, a = 0.55) {
  if (v3.on) a *= 0.5;
  const g = ctx.createLinearGradient(0, 0, 0, L.h);
  g.addColorStop(0, `rgba(6,20,40,${a * 0.7})`); g.addColorStop(0.5, `rgba(6,20,40,${a})`); g.addColorStop(1, `rgba(6,20,40,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
}

// An obvious "there is more below / above" cue for any list that scrolls: soft fade plus a chevron pill.
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0, w) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(6,20,40,0)'); g.addColorStop(1, 'rgba(6,20,40,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(248,242,222,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(248,242,222,0.92)'; ctx.fill();
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
  return { scroll, max: LAID.max };
}

export function renderTitle(ctx, state, L) {
  backdrop(ctx, L, state, state.att.w, state.att.parts, titleFocus(L));
  scrim(ctx, L, 0.3);
  const vx = L.wide ? L.w / 4 : L.w / 2, vy = L.wide ? L.h / 2 : 260 + Math.round(Math.max(0, L.sb - 1280) * 0.35);
  const g = ctx.createRadialGradient(vx, vy, 40, vx, vy, 420);
  g.addColorStop(0, `rgba(6,20,40,${v3.on ? 0.28 : 0.5})`); g.addColorStop(1, 'rgba(6,20,40,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
  if (L.wide) {   // calm panel behind the buttons so they read over the green
    const c = screenCols(state, 'title', L)[1], gx = ctx.createLinearGradient(c.x - 60, 0, c.x + c.w + 60, 0);
    gx.addColorStop(0, 'rgba(6,20,40,0)'); gx.addColorStop(0.25, 'rgba(6,20,40,0.4)'); gx.addColorStop(1, 'rgba(6,20,40,0.45)');
    ctx.fillStyle = gx; ctx.fillRect(c.x - 60, 0, L.w - c.x + 60, L.h);
  }
  drawFlowScreen(ctx, state, 'title', L);
  // the Arcforge lockup under the last button row; a tap opens the Arcforge home
  if (LAID.lock) {
    const k = LAID.lock, dn = !!(state.ui.drag && state.ui.drag.x0 >= k.tap.x && state.ui.drag.x0 <= k.tap.x + k.tap.w && state.ui.drag.y0 >= k.tap.y && state.ui.drag.y0 <= k.tap.y + k.tap.h);
    ctx.save(); ctx.fillStyle = 'rgba(6,20,40,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
    drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.w * (dn ? 0.96 : 1), dn ? 0.7 : 1);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(244,236,208,0.6)';
  if (state.demo) ctx.fillText('Web demo', L.wide ? (3 * L.w) / 4 : L.w / 2, L.sb - 4);
}

export function renderSetup(ctx, state, L) {
  backdrop(ctx, L, state, state.att.w, state.att.parts);
  scrim(ctx, L, 0.64);
  drawFlowScreen(ctx, state, 'setup', L);
  if (!L.wide) {
    const y0 = L.pins.start.y - 56, g = ctx.createLinearGradient(0, y0, 0, L.h);
    g.addColorStop(0, 'rgba(6,20,40,0)'); g.addColorStop(0.2, 'rgba(6,20,40,0.85)'); g.addColorStop(1, 'rgba(6,20,40,0.95)');
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
  backdrop(ctx, L, state, state.att.w, state.att.parts);
  scrim(ctx, L, 0.68);
  drawFlowScreen(ctx, state, 'settings', L);
}
export function renderResult(ctx, state, L) {
  backdrop(ctx, L, state, state.att.w, state.att.parts);
  scrim(ctx, L, 0.64);
  drawFlowScreen(ctx, state, 'result', L);
  const cols = LAID.cols, bcol = cols[cols.length - 1];
  const maxScroll = Math.max(0, bcol.lay.contentH - (bcol.bottom - bcol.top));
  const y = L.wide ? Math.min(L.sb - 12, bcol.top + bcol.off + bcol.lay.contentH + 44) : L.sb - 22;
  if (maxScroll === 0 || L.wide) drawMoreLine(ctx, L.wide ? bcol.x + bcol.w / 2 : L.w / 2, y, 18);
}
export function renderLadder(ctx, state, L) {
  backdrop(ctx, L, state, state.att.w, state.att.parts);
  scrim(ctx, L, 0.68);
  drawFlowScreen(ctx, state, 'ladder', L);
}
export function renderDemoLimit(ctx, state, L) {
  backdrop(ctx, L, state, state.att.w, state.att.parts);
  scrim(ctx, L, 0.72);
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
  panel(ctx, cx - cardW / 2, y0 - 20, cardW, ch + 40, { r: 28, fill: 'rgba(12,34,58,0.95)', stroke: 'rgba(236,198,92,0.55)' });
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
  backdrop(ctx, L, state, state.att.w, []);
  scrim(ctx, L, 0.68);
  const PANEL = L.ref.panel;
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let fl = pageCache.get(pkey);
  if (!fl) { fl = buildFlow(ctx, list, sc, PANEL); pageCache.set(pkey, fl); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, top = PANEL.y + 96, viewH = Math.max(60, PANEL.h - 96 - 70);
  REF.max = Math.max(0, Math.ceil(fl.total - viewH)); REF.view = viewH;
  state.refScroll = Math.max(0, Math.min(REF.max, state.refScroll || 0));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 28, fill: 'rgba(250,246,232,0.97)', stroke: 'rgba(20,48,79,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.navy; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(20,48,79,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(20,48,79,0.2)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.grassDark; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { const aw = Math.min(PANEL.w - 80, 620); ctx.save(); ctx.beginPath(); ctx.rect(pcx - aw / 2 - 20, y, aw + 40, 210); ctx.clip(); drawArt(it.art, ctx, pcx - aw / 2, y, aw, 198); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(20,48,79,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(20,48,79,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(20,48,79,0.7)';
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
// a strip of green with the mown stripes, as every diagram's ground
function lawn(ctx, x, y, w, h) {
  ctx.save(); roundPath(ctx, x, y, w, h, 16); ctx.clip();
  const n = Math.ceil(w / 36);
  for (let i = 0; i < n; i++) { ctx.fillStyle = i % 2 ? '#62b24e' : '#6bbb56'; ctx.fillRect(x + i * 36, y, 36, h); }
  ctx.restore();
  ctx.lineWidth = 5; ctx.strokeStyle = '#2f7d3a'; roundPath(ctx, x, y, w, h, 16); ctx.stroke();
}
function arrow(ctx, x0, y0, x1, y1, col = C.red, wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function curve(ctx, x0, y0, cx, cy, x1, y1, col = '#fff', dash = true, wd = 4) {
  ctx.strokeStyle = 'rgba(0,30,10,0.4)'; ctx.lineWidth = wd + 2.5; ctx.lineCap = 'round'; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = wd; if (dash) ctx.setLineDash([3, 9]);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke(); ctx.setLineDash([]);
}
function ring(ctx, x, y, r, col = '#ffd54a') { ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); }

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    bowls() {
      lawn(ctx, 0, 0, w, h);
      drawBowlIcon(ctx, w * 0.2, h * 0.46, 40, 0, 1, { bias: 1 }); drawBowlIcon(ctx, w * 0.5, h * 0.46, 40, 1, 1, { bias: -1 }); drawBowlIcon(ctx, w * 0.8, h * 0.46, 14, -1);
      label(ctx, 'Black', w * 0.2, h - 24, 22); label(ctx, 'Ivory', w * 0.5, h - 24, 22); label(ctx, 'Jack', w * 0.8, h - 24, 22);
    },
    ring() {
      lawn(ctx, 0, 0, w, h);
      const bx = w * 0.26, by = h * 0.86, tx = w * 0.74, ty = h * 0.3;
      curve(ctx, bx, by, bx + 10, h * 0.28, tx, ty, '#fff', true, 4);
      drawBowlIcon(ctx, bx, by, 14, 0, 1, { shadow: false });
      drawBowlIcon(ctx, tx, ty + 6, 14, 0, 0.5, { shadow: false });
      ring(ctx, tx, ty, 26);
      ctx.fillStyle = 'rgba(255,230,120,0.2)'; ctx.strokeStyle = 'rgba(255,230,120,0.8)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.ellipse(tx, ty + 6, 18, 36, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      drawBowlIcon(ctx, tx + 78, ty + 16, 9, -1);
      label(ctx, 'ring: where it finishes', tx - 20, h * 0.1 + 6, 19, C.ink, 'center');
      label(ctx, 'oval: where a shaky hand might finish', w * 0.5, h - 14, 18, C.ink);
    },
    bias() {
      lawn(ctx, 0, 0, w, h);
      [['Curve left', 0.27, -1, '#7c5aa0'], ['Curve right', 0.73, 1, '#1f4f9a']].forEach(([nm, fx, dir, col]) => {
        const cx = w * fx, y0 = h * 0.7, y1 = h * 0.18;
        curve(ctx, cx, y0, cx, (y0 + y1) / 2 + 10, cx + dir * 62, y1, col, true, 5);
        drawBowlIcon(ctx, cx + dir * 62, y1, 17, 0, 1, { bias: dir }); drawBowlIcon(ctx, cx, y0 + 8, 13, 0, 1, { shadow: false, bias: dir });
        label(ctx, nm, cx, h - 10, 20, col);
      });
    },
    weights() {
      lawn(ctx, 0, 0, w, h);
      const gy = h * 0.62;
      [['Draw', 0, '#2f7d3a'], ['Firm', 1, '#c98b12'], ['Drive', 2, '#b3282b']].forEach(([nm, i, col]) => {
        const x0 = w * (0.12 + i * 0.31), len = [28, 48, 74][i];
        ctx.strokeStyle = col; ctx.lineWidth = 4 + i; ctx.setLineDash([2, 9]); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x0, gy - len * 1.0 - 36); ctx.stroke(); ctx.setLineDash([]);
        arrow(ctx, x0, gy - len - 36, x0, gy - len - 56 - i * 4, col, 5 + i);
        drawBowlIcon(ctx, x0, gy + 14, 14, 0, 1, { shadow: false });
        label(ctx, nm, x0, h - 12, 21, col);
      });
    },
    order() {
      lawn(ctx, 0, 0, w, h);
      const xs = [0.12, 0.26, 0.4, 0.54, 0.68, 0.82];
      xs.forEach((fx, i) => drawBowlIcon(ctx, w * fx, h * 0.4, 24, i % 2));
      label(ctx, 'alternate: black, ivory, black, ivory…', w * 0.5, h * 0.82, 21, C.ink);
    },
    score() {
      lawn(ctx, 0, 0, w, h);
      const cx = w * 0.5, cy = h * 0.5;
      ctx.strokeStyle = 'rgba(255,214,90,0.95)'; ctx.lineWidth = 3;
      [[-70, -14], [-30, 56]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + dx, cy + dy); ctx.stroke(); });
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
      [[96, 18], [150, -34]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + dx, cy + dy); ctx.stroke(); }); ctx.setLineDash([]);
      drawBowlIcon(ctx, cx - 70, cy - 14, 24, 0); drawBowlIcon(ctx, cx - 30, cy + 56, 24, 0); drawBowlIcon(ctx, cx + 96, cy + 18, 24, 1); drawBowlIcon(ctx, cx + 150, cy - 34, 24, 0);
      drawBowlIcon(ctx, cx, cy, 10, -1);
      label(ctx, 'black scores 2: both nearer than ivory\'s nearest', cx, h - 14, 20, C.ink);
    },
    rink() {
      const pw = Math.min(w * 0.46, 250), px = (w - pw) / 2;
      lawn(ctx, px, 4, pw, h - 8);
      ctx.fillStyle = '#bfa97a'; ctx.fillRect(px + 3, 8, pw - 6, 18);
      ctx.fillStyle = '#efe9d6'; ctx.fillRect(px + 3, 4, pw - 6, 8);
      ctx.fillStyle = '#2c3034'; ctx.fillRect(w / 2 - 14, h - 34, 28, 22);
      drawBowlIcon(ctx, w / 2, h * 0.28, 9, -1);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px, 26); ctx.lineTo(px, h - 8); ctx.moveTo(px + pw, 26); ctx.lineTo(px + pw, h - 8); ctx.stroke();
      label(ctx, 'ditch', px + pw + 12, 22, 19, C.ink, 'left'); label(ctx, 'jack', px + pw + 12, h * 0.28 + 6, 19, C.ink, 'left');
      label(ctx, 'mat', px + pw + 12, h - 18, 19, C.ink, 'left'); label(ctx, '4.6 m wide', px - 12, h * 0.55, 19, C.ink, 'right');
      label(ctx, 'bank', px - 12, 14, 18, C.ink, 'right');
    },
    jack() {
      const pw = Math.min(w * 0.46, 250), px = (w - pw) / 2;
      lawn(ctx, px, 4, pw, h - 8);
      const ym = h * 0.42;
      ctx.strokeStyle = 'rgba(255,236,150,0.95)'; ctx.setLineDash([8, 6]); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(px, ym); ctx.lineTo(px + pw, ym); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, '23 m: the shortest jack', px - 12, ym + 6, 18, C.ink, 'right');
      arrow(ctx, w / 2, h - 30, w / 2, ym - 24, '#fff', 4);
      drawBowlIcon(ctx, w / 2, ym - 38, 9, -1);
      ctx.fillStyle = '#2c3034'; ctx.fillRect(w / 2 - 14, h - 34, 28, 22);
    },
    dead() {
      const pw = Math.min(w * 0.46, 250), px = (w - pw) / 2;
      lawn(ctx, px, 4, pw, h - 8);
      ctx.fillStyle = '#bfa97a'; ctx.fillRect(px + 3, 8, pw - 6, 26);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px, 34); ctx.lineTo(px, h - 8); ctx.moveTo(px + pw, 34); ctx.lineTo(px + pw, h - 8); ctx.stroke();
      const cx = px + pw * 0.5;
      drawBowlIcon(ctx, cx - 40, 22, 10, 0, 1, { shadow: false });
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - 46, 16); ctx.lineTo(cx - 34, 16); ctx.moveTo(cx - 40, 16); ctx.lineTo(cx - 40, 28); ctx.stroke();
      drawBowlIcon(ctx, cx + 4, 20, 6, -1, 1, { shadow: false });
      label(ctx, 'toucher: alive', cx + 30, 26, 18, C.ink, 'left');
      ctx.globalAlpha = 0.45; drawBowlIcon(ctx, px - 24, h * 0.62, 14, 1, 1, { shadow: false }); ctx.globalAlpha = 1;
      label(ctx, 'over the string: dead', px - 44, h * 0.62 + 6, 18, C.ink, 'right');
      drawBowlIcon(ctx, cx + 10, h * 0.62, 14, 1);
      label(ctx, 'on the green: alive', cx + 34, h * 0.62 + 6, 18, '#fff', 'left');
    },
  };
  (A[key] ?? A.bowls)();
  ctx.restore();
}
export { WEIGHTS, RINK, TEAM, drawGreen };
