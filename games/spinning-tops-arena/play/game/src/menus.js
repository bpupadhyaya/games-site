// Every screen that is not the play screen: title, setup, workshop, settings, result, pause, learn, and the paginated
// About / How to play / Rules reader with its illustrations (drawn with the game's own tops and dish). Pure drawing;
// game.js owns state.
import { W, H, ARENA, ARENAS, ARENA_IDS, BODIES, TIPS, BALLAST, BODY_IDS, TIP_IDS, BALLAST_IDS, WEIGHT, weightOf, legal, partStats, derive, K, STEP } from './sim.js';
import { drawTableLayer, drawDishLayer, drawTop, drawTopPreview, drawMiniDish, topHeight, lookOf, LOOKS, toScreen } from './art.js';
import { TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES } from './ai.js';
import { LESSONS } from './lessons.js';

const TAU = Math.PI * 2;
export const LOOK_NAMES = ['Red and cream', 'Blue and cream', 'Amber and brown', 'Green and cream', 'Plum and gold', 'Night and gold'];

// ---- flow screens ------------------------------------------------------------------------------
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
// A layout for the scene being updated right now, before anything has been drawn (first frame after a
// scene change, or headless runs): same widgets, text widths estimated instead of measured.
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
export function ensureLayout(state, key) {
  if (LAID.key === key && LAID.lay) return;
  const defs = {
    title: [titleWidgets, TITLE_TOP, H], setup: [setupWidgets, 0, 1130], workshop: [workshopWidgets, 0, 1130], settings: [settingsWidgets, 0, H],
    result: [resultWidgets, 0, H], demolimit: [demoLimitWidgets, 0, H], learn: [learnWidgets, 0, 1130], lessonbrief: [briefWidgets, 0, 1130],
  };
  const d = defs[key];
  if (!d) return;
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx]);
  LAID = { key, lay, top: d[1], bottom: d[2], h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const TITLE_TOP = 660;

// ---- the title: a dish with a duel in it, behind the name ----------------------------------------------------------
export function drawAttract(ctx, state, cy = 475, sc = 0.72) {
  const a = state.att;
  drawTableLayer(ctx);
  ctx.save();
  ctx.translate(ARENA.cx, cy); ctx.scale(sc, sc); ctx.translate(-ARENA.cx, -ARENA.cy);
  drawDishLayer(ctx, a.arena);
  const order = a.w.tops.map((t, i) => ({ t, i })).sort((p, q) => p.t.y - q.t.y);
  for (const { t, i } of order) drawTop(ctx, t, a.looks[i], state.t);
  // sparks, in dish space
  for (const p of a.parts) {
    const f = 1 - p.t / p.max; if (f <= 0) continue;
    const s = toScreen(p.x, p.y);
    ctx.save(); ctx.globalAlpha = Math.min(1, f * 1.4); ctx.strokeStyle = '#ffd98a'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - p.vx * 0.04, s.y - p.vy * 0.04 * ARENA.sy); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}

const heroArt = () => ({
  t: 'art', h: TITLE_TOP === 590 ? 0 : 0, draw() {},
});

export function drawTitleText(ctx) {
  const cx = W / 2;
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `italic 700 44px ${DISPLAY}`;
  textShadow(ctx, 'SPINNING', cx, 84, '#f4c95d', 8);
  ctx.font = `700 92px ${DISPLAY}`;
  const g = ctx.createLinearGradient(0, 90, 0, 172); g.addColorStop(0, '#fff3dc'); g.addColorStop(1, '#f1c27c');
  ctx.save(); ctx.shadowColor = 'rgba(18,8,2,0.7)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4; ctx.fillStyle = g; ctx.fillText('TOPS', cx, 170); ctx.restore();
  ctx.font = `700 52px ${DISPLAY}`;
  ctx.save(); ctx.shadowColor = 'rgba(18,8,2,0.7)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3; ctx.fillStyle = '#ff7a55'; ctx.fillText('ARENA', cx, 222); ctx.restore();
  ctx.font = `500 24px ${FONT}`; textShadow(ctx, 'Wind it. Launch it. Last one spinning wins.', cx, 262, '#fff3dc', 8);
  ctx.restore();
}

export function titleWidgets(state) {
  const sound = state.settings.sound;
  const sv = state.saved;
  return [
    ...(sv ? [{ t: 'btn', id: 'continue', label: 'Continue Match', sub: `${sv.title}${sv.rounds === 3 ? ` · ${sv.wins[0]}–${sv.wins[1]}` : ''} · Round ${sv.round}`, primary: true, h: 88 }] : []),
    { t: 'btn', id: 'play', label: 'Play a Duel', primary: !sv, h: 84 },
    { t: 'btn', id: 'friend', label: 'Two Players', sub: 'Take turns on one device', h: 80 },
    { t: 'btn', id: 'learn', label: 'Learn', row: 1, h: 72 },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', row: 1, h: 72 },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2, h: 72 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 2, h: 72 },
    { t: 'btn', id: 'about', label: 'About', row: 2, h: 72 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 3, h: 72 },
    { t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 3, h: 72 },
  ];
}

export const buildLine = (b) => `${BODIES[b.body].name} · ${TIPS[b.tip].name} · ${BALLAST[b.ballast].name}`;
const rivalSub = (pf, won, locked) => (locked ? 'In the full game' : `${'★'.repeat(pf.stars)}${'☆'.repeat(5 - pf.stars)}  ${pf.tag}${won ? ` · won ${won}` : ''}`);
export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const friend = s.mode === 'friend';
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: friend ? 'Two Players' : 'New Duel', size: 48 }];
  if (!friend) {
    wd.push({ t: 'p', label: 'Choose your rival', bold: true, color: '#ffe9a0', size: 26 });
    PROFILES.forEach((pf, i) => {
      const locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: rivalSub(pf, (rec.wins ?? [])[i] ?? 0, locked), active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: 92 });
    });
  } else wd.push({ t: 'p', label: 'Each player builds a top, then takes a turn to launch it. The other launch stays hidden until both are set.', size: 24 });
  wd.push({ t: 'p', label: 'Choose the dish', bold: true, color: '#ffe9a0', size: 26 });
  ARENA_IDS.forEach((id) => {
    const locked = demo && id === 'plate';
    wd.push({ t: 'btn', id: `arena${id}`, label: ARENAS[id].name, sub: locked ? 'In the full game' : ARENAS[id].blurb, active: s.arena === id && !locked, disabled: locked, hitDisabled: true });
  });
  wd.push({ t: 'p', label: 'Match length', bold: true, color: '#ffe9a0', size: 26 });
  wd.push({ t: 'btn', id: 'len3', label: 'Best of 3', row: 9, active: s.rounds === 3 });
  wd.push({ t: 'btn', id: 'len1', label: 'Quick Duel', row: 9, active: s.rounds === 1 });
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

// ---- the workshop ---------------------------------------------------------------------------------------------------
const statRow = (label, v, col, sub) => ({
  t: 'art', h: 0, label, v, col, sub,
});
export function workshopWidgets(state) {
  const p = state.wsIdx ?? 0, b = state.builds[p], sc = TEXT_SCALES[state.settings.textIdx];
  const friend = state.setup.mode === 'friend';
  const st = partStats(b);
  const wd = [{ t: 'gap', h: 8 }, { t: 'h', label: friend ? `Workshop · Player ${p + 1}` : 'Workshop', size: 46 }];
  wd.push({ t: 'art', h: 330, draw: (ctx, w, h) => drawWorkshopPreview(ctx, w, h, b, state) });
  const rowH = Math.round(46 * Math.min(sc, 3));
  for (const [lab, val, col] of [['Attack', st.attack, '#ff7a55'], ['Defence', st.defence, '#4fc3a8'], ['Stamina', st.stamina, '#f4c95d']]) {
    wd.push({ t: 'art', h: rowH, draw: (ctx, w, h) => drawStatRow(ctx, w, h, lab, val, col, sc) });
  }
  wd.push({ t: 'p', label: `Spin lasts about ${Math.round(st.life)} s if nothing touches it.`, size: 24, color: 'rgba(255,243,220,0.9)' });
  wd.push({ t: 'art', h: Math.round(40 * Math.min(sc, 3)), draw: (ctx, w, h) => drawWeightRow(ctx, w, h, b, sc) });
  wd.push({ t: 'p', label: state.matchupText ?? '', size: 24, color: '#ffe9a0', bold: true });
  wd.push({ t: 'p', label: 'Body', bold: true, color: '#ffe9a0', size: 26 });
  for (const id of BODY_IDS) wd.push({ t: 'btn', id: `body:${id}`, label: BODIES[id].name, sub: BODIES[id].blurb, active: b.body === id, h: 90 });
  wd.push({ t: 'p', label: 'Tip', bold: true, color: '#ffe9a0', size: 26 });
  for (const id of TIP_IDS) wd.push({ t: 'btn', id: `tip:${id}`, label: TIPS[id].name, sub: TIPS[id].blurb, active: b.tip === id, h: 90 });
  wd.push({ t: 'p', label: `Rim weight (the contest limit is ${WEIGHT.limit} weight points; this top uses ${weightOf(b)})`, bold: true, color: '#ffe9a0', size: 26 });
  for (const id of BALLAST_IDS) {
    const ok = legal({ ...b, ballast: id });
    wd.push({ t: 'btn', id: `ballast:${id}`, label: BALLAST[id].name, sub: ok ? BALLAST[id].blurb : 'Too heavy for this body: over the weight limit', active: b.ballast === id, disabled: !ok, hitDisabled: true, h: 90 });
  }
  wd.push({ t: 'p', label: 'Spin direction', bold: true, color: '#ffe9a0', size: 26 });
  wd.push({ t: 'btn', id: 'hand:1', label: 'Clockwise', row: 11, active: b.hand !== -1 });
  wd.push({ t: 'btn', id: 'hand:-1', label: 'Anticlockwise', row: 11, active: b.hand === -1 });
  wd.push({ t: 'p', label: 'Tops that spin the same way grind each other down where they touch. Opposite ways, they slide past.', size: 22, color: 'rgba(255,243,220,0.85)' });
  wd.push({ t: 'btn', id: 'paint', label: `Paint: ${LOOK_NAMES[state.looks[p]]}`, sub: 'Tap to change', dark: true });
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

function drawWorkshopPreview(ctx, w, h, b, state) {
  const look = lookOf(state.looks[state.wsIdx ?? 0]);
  ctx.save();
  // a lathe-bench glow behind the top
  const g = ctx.createRadialGradient(w / 2, h * 0.55, 20, w / 2, h * 0.55, w * 0.55);
  g.addColorStop(0, 'rgba(255,214,150,0.28)'); g.addColorStop(1, 'rgba(255,214,150,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const th = topHeight(b), s = Math.min(2.3, (h - 40) / th);
  drawTopPreview(ctx, b, look, w / 2, h - 36, s, state.t, { spin: 0.55 });
  ctx.restore();
}
function drawStatRow(ctx, w, h, label, v, col, sc) {
  const fs = Math.round(26 * Math.min(sc, 3));
  ctx.font = `700 ${fs}px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const lw = ctx.measureText('Defence').width + 14;
  ctx.fillStyle = '#fff3dc'; ctx.fillText(label, 8, h / 2);
  const bx = lw + 10, bw = w - bx - 8, bh = Math.max(16, h * 0.42);
  roundPath(ctx, bx, h / 2 - bh / 2, bw, bh, bh / 2); ctx.fillStyle = 'rgba(18,8,2,0.6)'; ctx.fill();
  roundPath(ctx, bx, h / 2 - bh / 2, Math.max(bh, bw * v / 100), bh, bh / 2); ctx.fillStyle = col; ctx.fill();
  roundPath(ctx, bx, h / 2 - bh / 2, bw, bh, bh / 2); ctx.strokeStyle = 'rgba(255,243,220,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
}
function drawWeightRow(ctx, w, h, b, sc) {
  const fs = Math.round(24 * Math.min(sc, 3));
  ctx.font = `700 ${fs}px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillStyle = '#fff3dc'; ctx.fillText('Weight', 8, h / 2);
  const lw = ctx.measureText('Weight').width + 24, used = weightOf(b), n = WEIGHT.limit;
  const sw = Math.min(46, (w - lw - 8) / n - 6), sh = Math.min(h * 0.6, 26);
  for (let i = 0; i < n; i++) {
    roundPath(ctx, lw + i * (sw + 6), h / 2 - sh / 2, sw, sh, 6); ctx.fillStyle = i < used ? '#d9b27a' : 'rgba(18,8,2,0.55)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,243,220,0.45)'; ctx.lineWidth = 1.2; ctx.stroke();
  }
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-calm', label: st.calm ? 'Calm effects: On' : 'Calm effects: Off', sub: 'No screen shake, flashes or camera zoom', active: st.calm },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9a0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const m = state.match, o = m.over, mode = m.cfg.mode;
  const winner = o.win;
  const nm = (s) => m.cfg.names[s];
  const title = mode === 'watch' ? `${nm(winner)} wins` : mode === 'friend' ? `${nm(winner)} wins!` : winner === 0 ? 'You win the match!' : `${nm(1)} wins`;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: big ? 24 : 200 }, { t: 'h', label: title, size: 60, cap: big ? 1.15 : 1.4 }, { t: 'h', label: `${m.wins[0]} – ${m.wins[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' }];
  if (mode === 'ai') {
    const l1 = `Knock-outs by ring-out: ${m.stats.outs}. Longest spin of yours: ${Math.round(m.stats.best)} s.`;
    const l2 = `Against ${PROFILES[m.cfg.opp].name}, you have won ${(state.record?.wins ?? [])[m.cfg.opp] ?? 0}.`;
    wd.push({ t: 'p', label: big ? `${l1} ${l2}` : l1, size: 26, cap: big ? 2 : 3 });
    if (!big) wd.push({ t: 'p', label: l2, size: 26 });
  }
  wd.push({ t: 'gap', h: 24 });
  wd.push({ t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: mode === 'watch' ? 'Watch another' : 'New duel', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function learnWidgets(state) {
  const done = state.record.lessons ?? [];
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Learn', size: 48 }, { t: 'p', label: 'Five short lessons in the real dish. Each one has a goal; if it does not work, try again.', size: 24 }];
  LESSONS.forEach((l, i) => wd.push({ t: 'btn', id: `lesson${i}`, label: `${i + 1}. ${l.title}${done[i] ? '  ✓' : ''}`, sub: l.blurb, active: !!done[i], h: 96 }));
  wd.push({ t: 'gap', h: 20 });
  return wd;
}
export function briefWidgets(state) {
  const l = LESSONS[state.lessonIdx ?? 0];
  return [{ t: 'gap', h: 24 }, { t: 'h', label: `Lesson ${(state.lessonIdx ?? 0) + 1}`, size: 40, color: '#ffe9a0' }, { t: 'h', label: l.title, size: 52 }, ...l.brief.map((p) => ({ t: 'p', label: p, size: 26 })), { t: 'p', label: `Goal: ${l.goal}`, bold: true, color: '#ffe9a0', size: 28 }, { t: 'gap', h: 20 }];
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
    { t: 'p', label: `Text size: ${Math.round(TEXT_SCALES[st.textIdx] * 100)}%`, bold: true, color: '#ffe9a0', size: 24 },
    { t: 'btn', id: 'p-txt-dec', label: 'A−  Smaller', row: 10, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'p-txt-inc', label: 'A+  Larger', row: 10, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free rounds of the web demo. The full game on iPhone and Android has every rival, every dish and unlimited matches.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(24,10,4,${a * 0.7})`); g.addColorStop(0.5, `rgba(24,10,4,${a})`); g.addColorStop(1, `rgba(24,10,4,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// An obvious "there is more below / above" cue for any list that scrolls: soft fade plus a chevron pill.
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(24,10,4,0)'); g.addColorStop(1, 'rgba(24,10,4,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,243,220,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,243,220,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}

function drawFlowScreen(ctx, state, key, widgets, top, bottom) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, widgets, sc);
  LAID = { key, lay, top, bottom, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, W - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,243,220,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}

const attScene = (ctx, state, cy = 475, sc = 0.72) => drawAttract(ctx, state, cy, sc);

export function renderTitle(ctx, state) {
  attScene(ctx, state);
  const g = ctx.createLinearGradient(0, 0, 0, 340); g.addColorStop(0, 'rgba(18,8,2,0.55)'); g.addColorStop(1, 'rgba(18,8,2,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 340);
  const g2 = ctx.createLinearGradient(0, TITLE_TOP - 50, 0, TITLE_TOP + 40); g2.addColorStop(0, 'rgba(18,8,2,0)'); g2.addColorStop(1, 'rgba(18,8,2,0.86)');
  ctx.fillStyle = g2; ctx.fillRect(0, TITLE_TOP - 50, W, 90);
  ctx.fillStyle = 'rgba(18,8,2,0.86)'; ctx.fillRect(0, TITLE_TOP + 40, W, H - TITLE_TOP - 40);
  drawTitleText(ctx);
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), TITLE_TOP, H);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,243,220,0.6)'; ctx.fillText('Web demo', W / 2, H - 14); }
}
export function renderSetup(ctx, state) {
  attScene(ctx, state, 320, 0.4);
  scrim(ctx, 0.74);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), 0, 1130);
  pinnedBar(ctx, state, state.setup.mode === 'friend' ? 'Build the tops' : 'To the workshop', state.setupMsg);
}
function pinnedBar(ctx, state, startLabel, msg) {
  const g = ctx.createLinearGradient(0, 1100, 0, H);
  g.addColorStop(0, 'rgba(24,10,4,0)'); g.addColorStop(0.2, 'rgba(24,10,4,0.9)'); g.addColorStop(1, 'rgba(24,10,4,0.96)');
  ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
  const z = Math.min(TEXT_SCALES[state.settings.textIdx], 1.5);
  drawButton(ctx, SETUP_PINS.start, startLabel, { primary: true, size: Math.round(32 * z) });
  drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: Math.round(28 * z) });
  if (msg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(msg, W / 2, 1140); }
}
export function renderWorkshop(ctx, state) {
  drawTableLayer(ctx);
  scrim(ctx, 0.62);
  drawFlowScreen(ctx, state, 'workshop', workshopWidgets(state), 0, 1130);
  const friend = state.setup.mode === 'friend', p = state.wsIdx ?? 0;
  pinnedBar(ctx, state, friend && p === 0 ? 'Next: Player 2' : state.match?.cfg?.lesson != null ? 'Start the lesson' : 'Start the duel', state.setupMsg);
}
export function renderSettings(ctx, state) {
  drawTableLayer(ctx); scrim(ctx, 0.7);
  drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), 0, H);
}
export function renderLearn(ctx, state) {
  drawTableLayer(ctx); scrim(ctx, 0.7);
  drawFlowScreen(ctx, state, 'learn', learnWidgets(state), 0, 1130);
  const g = ctx.createLinearGradient(0, 1100, 0, H); g.addColorStop(0, 'rgba(24,10,4,0)'); g.addColorStop(0.2, 'rgba(24,10,4,0.9)'); g.addColorStop(1, 'rgba(24,10,4,0.96)');
  ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
  drawButton(ctx, SETUP_PINS.start, 'Back', { primary: true, size: Math.round(32 * Math.min(TEXT_SCALES[state.settings.textIdx], 1.5)) });
}
export function renderBrief(ctx, state) {
  drawTableLayer(ctx); scrim(ctx, 0.7);
  drawFlowScreen(ctx, state, 'lessonbrief', briefWidgets(state), 0, 1130);
  pinnedBar(ctx, state, 'Begin', '');
}
export function renderResult(ctx, state, sceneDraw) {
  sceneDraw(ctx);
  scrim(ctx, 0.62);
  drawFlowScreen(ctx, state, 'result', resultWidgets(state), 0, H);
}
export function renderDemoLimit(ctx, state) {
  drawTableLayer(ctx); scrim(ctx, 0.75);
  drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(), 0, H);
}
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, wd, sc, { x: 60, w: 600 });
  const top = 70, bottom = H - 70;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(52,30,16,0.95)', stroke: 'rgba(255,243,220,0.45)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, 660);
}

// ---- reference pages --------------------------------------------------------------------------
let PAGE_COUNT = 1;
export const pageCount = () => PAGE_COUNT;
const PANEL = { x: 34, y: 100, w: 652, h: 1030 };

function buildPages(ctx, list, scale) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 80;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const top = PANEL.y + 120, limit = PANEL.y + PANEL.h - 70;
  const pages = [];
  let cur = null, used = 0;
  const newPage = () => { cur = { blocks: [], fs, lh, secFs }; used = 0; pages.push(cur); };
  list.forEach((sec) => {
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    const titleH = tl.length * secFs * 1.2 + 16;
    ctx.font = `400 ${fs}px ${FONT}`;
    const lines = [];
    sec.p.forEach((para, pi) => {
      const wl = wrapLines(ctx, para, tw);
      wl.forEach((l, k) => lines.push({ text: l, gapBefore: k === 0 && pi > 0 }));
    });
    const lineH = (l, n) => lh + (l.gapBefore && n > 0 ? lh * 0.45 : 0);
    const artH = sec.art && scale < 2 ? 210 : 0;
    let full = titleH + artH + 26;
    lines.forEach((l, k) => { full += lineH(l, k); });
    const minNeed = titleH + artH + 26 + lh * 3;
    if (!cur || (used + full > limit - top && used + minNeed > limit - top)) newPage();
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
  return pages;
}

const pageCache = new Map();
export function renderPages(ctx, state, list, header) {
  drawTableLayer(ctx);
  scrim(ctx, 0.7);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}`;
  let pages = pageCache.get(pkey);
  if (!pages) { pages = buildPages(ctx, list, sc); pageCache.set(pkey, pages); }
  PAGE_COUNT = pages.length;
  const idx = Math.min(state.page, pages.length - 1);
  const pg = pages[idx];
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(255,243,220,0.97)', stroke: 'rgba(46,26,15,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `italic 700 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(46,26,15,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  let y = PANEL.y + 120;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(46,26,15,0.2)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${pg.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l + (blk.part > 0 && k === blk.tl.length - 1 ? ' (cont.)' : ''), W / 2, y + pg.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    if (blk.art) { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, blk.artH); ctx.clip(); drawArt(blk.art, ctx, PANEL.x + 40, y, PANEL.w - 80, blk.artH - 12, state); ctx.restore(); y += blk.artH; }
    ctx.fillStyle = C.ink; ctx.font = `400 ${pg.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => {
      if (l.gapBefore && k > 0) y += pg.lh * 0.45;
      ctx.fillText(l.text, PANEL.x + 40, y + pg.fs * 0.85);
      y += pg.lh;
    });
    y += 26;
  });
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(46,26,15,0.7)';
  ctx.fillText(`Page ${idx + 1} of ${pages.length}`, W / 2, PANEL.y + PANEL.h - 28);
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff3dc'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, idx === 0 ? 'Close' : 'Back', { size: 32 });
  drawButton(ctx, REF_NEXT, idx === pages.length - 1 ? 'Done' : 'Next', { primary: true, size: 32 });
}

// ---- illustrations ----------------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = '#fff3dc', align = 'center') {
  ctx.save(); ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(18,8,2,0.6)'; ctx.shadowBlur = 4; ctx.fillText(t, x, y); ctx.restore();
}
function panelBg(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#5a3a24'); g.addColorStop(1, '#3a2316');
  roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(46,26,15,0.5)'; ctx.lineWidth = 2; ctx.stroke();
}
function arrow(ctx, x0, y0, x1, y1, col = '#f4c95d', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
const B0 = { body: 'pear', tip: 'steel', ballast: 'std', hand: 1 };
const tp = (ctx, b, i, x, y, s, extra = {}) => drawTopPreview(ctx, b, lookOf(i), x, y, s, 1.2, extra);

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    dish() {
      panelBg(ctx, w, h); drawMiniDish(ctx, w, h);
      tp(ctx, B0, 0, w * 0.32, h * 0.72, 0.7, { spin: 0.4 }); tp(ctx, { body: 'disc', tip: 'pebble', ballast: 'std', hand: -1 }, 1, w * 0.66, h * 0.4, 0.7, { spin: 0.4 });
      label(ctx, 'The dish pulls tops toward the middle', w / 2, 24, 19);
    },
    launch() {
      panelBg(ctx, w, h);
      const ax = w * 0.35, ay = h * 0.4, fx = w * 0.35, fy = h * 0.88;
      tp(ctx, B0, 0, ax, ay + 20, 0.62, { spin: 0.1 });
      ctx.strokeStyle = '#d9b27a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax, ay + 12); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.fillStyle = '#fff3dc'; ctx.beginPath(); ctx.arc(fx, fy, 14, 0, TAU); ctx.fill();
      arrow(ctx, ax + 24, ay, w * 0.78, 22, '#fff3dc', 5);
      label(ctx, 'drag back', fx + 28, fy - 4, 19, '#fff3dc', 'left'); label(ctx, 'it flies the other way', w * 0.7, h * 0.52, 19, '#ffe9a0');
    },
    timing() {
      panelBg(ctx, w, h);
      const gx = 30, gw = w - 60, gy = h * 0.42, gh = 40;
      roundPath(ctx, gx, gy, gw, gh, 20); ctx.fillStyle = '#5c3a22'; ctx.fill();
      ctx.save(); roundPath(ctx, gx, gy, gw, gh, 20); ctx.clip();
      ctx.fillStyle = '#a8703a'; ctx.fillRect(gx + gw * 0.3, gy, gw * 0.4, gh); ctx.fillStyle = '#f4c95d'; ctx.fillRect(gx + gw * 0.45, gy, gw * 0.1, gh); ctx.restore();
      ctx.fillStyle = '#fff3dc'; roundPath(ctx, gx + gw * 0.58 - 5, gy - 8, 10, gh + 16, 5); ctx.fill();
      label(ctx, 'Perfect', gx + gw * 0.5, gy - 16, 20, '#ffe27a'); label(ctx, 'Good', gx + gw * 0.33, gy + gh + 28, 19); label(ctx, 'Loose', gx + gw * 0.1, gy + gh + 28, 19, '#ffb0a0'); label(ctx, 'Loose', gx + gw * 0.9, gy + gh + 28, 19, '#ffb0a0');
    },
    spin() {
      panelBg(ctx, w, h);
      const items = [[0, 0, 'Spinning fast'], [0.35, 0.1, 'Slowing: wobbles'], [1.1, 0.0, 'Tips over']];
      items.forEach(([tl, ty, nm], i) => {
        const cx = w * (0.18 + i * 0.32);
        ctx.save(); ctx.translate(cx, h * 0.8); ctx.rotate(tl); tp(ctx, B0, i, 0, 0, 0.62, { spin: i === 0 ? 0.9 : i === 1 ? 0.1 : 0 }); ctx.restore();
        label(ctx, nm, cx, h - 10, 18);
      });
    },
    hit() {
      panelBg(ctx, w, h); drawMiniDish(ctx, w, h);
      tp(ctx, B0, 0, w * 0.4, h * 0.62, 0.62, { spin: 0.5 }); tp(ctx, { body: 'disc', tip: 'pebble', ballast: 'std', hand: -1 }, 1, w * 0.6, h * 0.5, 0.62, { spin: 0.5 });
      ctx.strokeStyle = '#ffe9a0'; ctx.lineWidth = 4;
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, cx = w * 0.5, cy = h * 0.42; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 10); ctx.lineTo(cx + Math.cos(a) * 34, cy + Math.sin(a) * 22); ctx.stroke(); }
      arrow(ctx, w * 0.2, h * 0.8, w * 0.36, h * 0.66, '#fff3dc', 3);
    },
    ringout() {
      panelBg(ctx, w, h); drawMiniDish(ctx, w, h);
      tp(ctx, B0, 0, w * 0.26, h * 0.5, 0.6, { spin: 0.5 });
      ctx.save(); ctx.translate(w * 0.9, h * 0.22); ctx.rotate(0.8); tp(ctx, { body: 'disc', tip: 'pebble', ballast: 'std', hand: -1 }, 1, 0, 0, 0.52, { spin: 0.3 }); ctx.restore();
      arrow(ctx, w * 0.62, h * 0.5, w * 0.88, h * 0.34, '#ff8a6a', 4);
      label(ctx, 'out over the rim', w * 0.6, h - 12, 19, '#ffb0a0');
    },
    parts() {
      panelBg(ctx, w, h);
      const bs = [['disc', 'steel', 'heavy'], ['pear', 'pebble', 'std'], ['spire', 'steel', 'light'], ['dome', 'peg', 'std']];
      bs.forEach((b, i) => { tp(ctx, { body: b[0], tip: b[1], ballast: b[2], hand: 1 }, i + 1, w * (0.14 + i * 0.24), h * 0.78, 0.62, { spin: 0.4 }); label(ctx, BODIES[b[0]].name, w * (0.14 + i * 0.24), h - 8, 16); });
    },
    stats() {
      panelBg(ctx, w, h);
      [['Attack', 0.7, '#ff7a55'], ['Defence', 0.5, '#4fc3a8'], ['Stamina', 0.85, '#f4c95d']].forEach(([nm, v, col], i) => {
        const by = 34 + i * 50;
        roundPath(ctx, 150, by, w - 190, 24, 12); ctx.fillStyle = 'rgba(18,8,2,0.6)'; ctx.fill();
        roundPath(ctx, 150, by, (w - 190) * v, 24, 12); ctx.fillStyle = col; ctx.fill();
        label(ctx, nm, 134, by + 20, 21, '#fff3dc', 'right');
      });
    },
    weight() {
      panelBg(ctx, w, h);
      const n = WEIGHT.limit, sw = Math.min(70, (w - 80) / n - 8);
      for (let i = 0; i < n; i++) { roundPath(ctx, 40 + i * (sw + 8), h * 0.4, sw, 40, 8); ctx.fillStyle = i < 5 ? '#d9b27a' : 'rgba(18,8,2,0.55)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,243,220,0.45)'; ctx.stroke(); }
      label(ctx, `The contest limit is ${n} weight points`, w / 2, h * 0.3, 20); label(ctx, 'body and rim ring together', w / 2, h * 0.82, 19, '#ffe9a0');
    },
    hands() {
      panelBg(ctx, w, h);
      const spin = (cx, cy, dir, col) => { ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, 40, dir > 0 ? 0.3 : Math.PI - 0.3, dir > 0 ? 4.8 : Math.PI - 4.8, dir < 0); ctx.stroke(); };
      tp(ctx, B0, 0, w * 0.28, h * 0.78, 0.6, { spin: 0.2 }); spin(w * 0.28, h * 0.4, 1, '#7fe8d6');
      tp(ctx, B0, 1, w * 0.72, h * 0.78, 0.6, { spin: 0.2 }); spin(w * 0.72, h * 0.4, -1, '#ff9a86');
      label(ctx, 'clockwise', w * 0.28, 24, 18); label(ctx, 'anticlockwise', w * 0.72, 24, 18);
    },
    think() {
      const cw = (w - 40) / 3;
      [['THINK', 'weigh the launches', '#ffe9a0'], ['REVEAL', 'show the plans', '#7fe8d6'], ['ACT', 'launch and watch', '#ff9a86']].forEach(([nm, sub, col], i) => {
        const cx = i * (cw + 20);
        roundPath(ctx, cx, 20, cw, h - 40, 18); ctx.fillStyle = 'rgba(46,26,15,0.92)'; ctx.fill();
        label(ctx, nm, cx + cw / 2, h / 2 - 2, 26, col); label(ctx, sub, cx + cw / 2, h / 2 + 30, 17, '#fff3dc');
        if (i < 2) arrow(ctx, cx + cw + 3, h / 2, cx + cw + 17, h / 2, '#2e1a0f', 4);
      });
    },
    arenas() {
      panelBg(ctx, w, h);
      ARENA_IDS.forEach((id, i) => { const cw = (w - 60) / 3; ctx.save(); ctx.translate(15 + i * (cw + 15), 20); drawMiniDish(ctx, cw, h - 70, id); ctx.restore(); label(ctx, ARENAS[id].name, 15 + i * (cw + 15) + cw / 2, h - 14, 18); });
    },
  };
  (A[key] ?? A.dish)();
  ctx.restore();
}
export { STEP, derive, K, LOOKS };
