// Every screen that is not the play screen: title, setup, settings, result, pause, the reason reader, and the paginated
// About / How to play / Rules reader with its illustrations (drawn with the game's own course art). Pure drawing; game.js owns state.
import { W, H, LAND, SAFE, PANEL, host, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS, flowGeom, modalGeom, lockSize, minTap } from './layout.js';
import { drawCredit, drawLockupImage, drawMoreLine } from './brand.js';
import { FONT, SERIF, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit, FLOOR } from './ui.js';
import { PROFILES } from './ai.js';
import { COURSES, COURSE_BY_ID, holeById } from './courses.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { compileHole, newBall, stepBall, simulate } from './sim.js';
import { makeCam, drawCourse, drawBall, drawFlag, drawGuide, drawPowerRing, drawBackdrop, themeOf, BALL_COLORS, place, parLabel } from './view.js';

const TAU = Math.PI * 2;

// ---- the attract course behind the menus ---------------------------------------------------------------------------
const ATTRACT = [
  { h: 'dunes-3', a: -1.1781, p: 1 }, { h: 'harbour-4', a: 1.0472, p: 0.92 }, { h: 'harbour-3', a: -0.6109, p: 0.92 },
  { h: 'dunes-5', a: -1.5708, p: 0.68 }, { h: 'dunes-6', a: -2.73, p: 0.8 }, { h: 'harbour-5', a: -0.1309, p: 0.92 },
];
export function newAttract() { return { i: 0, ball: null, clock: 0, wait: 1.2, trail: [], ready: false }; }
export function stepAttract(a, dt) {
  const def = holeById(ATTRACT[a.i % ATTRACT.length].h), h = compileHole(def);
  if (!a.ball) { a.ball = newBall(def.tee.x, def.tee.y); a.wait = 1.2; a.trail = []; }
  a.clock += dt;
  const b = a.ball;
  if (b.mode === 'roll') {
    const ev = [];
    for (let k = 0; k < 2 && b.mode === 'roll'; k++) { ev.length = 0; stepBall(h, b, a.clock, ev); if (k === 0) { a.trail.push([b.x, b.y]); if (a.trail.length > 16) a.trail.shift(); } }
    if (b.mode !== 'roll') a.wait = b.mode === 'sunk' ? 1.6 : 0.8;
  } else {
    if (a.trail.length) a.trail.shift();
    if (b.mode === 'sunk') b.sink = Math.min(1, b.sink + dt);
    a.wait -= dt;
    if (a.wait <= 0) {
      if (!a.shot) {
        const s = ATTRACT[a.i % ATTRACT.length];
        b.vx = Math.cos(s.a) * 22 * s.p; b.vy = Math.sin(s.a) * 22 * s.p; b.mode = 'roll'; b.t = 0; a.shot = true;
      } else { a.i++; a.ball = null; a.shot = false; }
    }
  }
}
export function drawAttract(ctx, state) {
  const a = state.att; if (!a) return;
  const def = holeById(ATTRACT[a.i % ATTRACT.length].h), h = compileHole(def), th = themeOf(def.course);
  drawBackdrop(ctx, COURSE_BY_ID[def.course].feel, state.t);
  const cam = makeCam(h, { x: 0, y: 0, w: W, h: H }, 0, true);
  drawCourse(ctx, h, cam, a.clock, th, {});
  if (a.ball) {
    ctx.save(); place(ctx, cam);
    if (a.trail.length > 1) { ctx.lineCap = 'round'; for (let i = 1; i < a.trail.length; i++) { ctx.strokeStyle = '#fff'; ctx.globalAlpha = (i / a.trail.length) * 0.3; ctx.lineWidth = 0.3 * (i / a.trail.length); ctx.beginPath(); ctx.moveTo(a.trail[i - 1][0], a.trail[i - 1][1]); ctx.lineTo(a.trail[i][0], a.trail[i][1]); ctx.stroke(); } }
    drawBall(ctx, cam, a.ball, BALL_COLORS[0]);
    ctx.restore();
  }
  drawFlag(ctx, cam, h, th, state.t, false);
}

// ---- flow screens ------------------------------------------------------------------------------------------------
let LAID = { key: '', lay: null, top: 0, bottom: H, sz: '' };
export const flowMeta = () => LAID;
export function resetMenus() { LAID = { key: '', lay: null, top: 0, bottom: H, sz: '' }; }
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.55 }; } };
const MODALS = new Set(['pause', 'reason']);
const BUILD = { title: titleWidgets, setup: setupWidgets, settings: settingsWidgets, result: resultWidgets, demolimit: demoLimitWidgets, pause: pauseWidgets, reason: reasonWidgets };
function colOf(key) {
  if (MODALS.has(key)) { const m = modalGeom(); return { x: m.x + 30, w: m.w - 60, top: m.top, bottom: m.bottom, split: false }; }
  const g = flowGeom(key);
  return { x: g.x, w: g.w, top: g.top, bottom: g.bottom, split: g.split };
}
const vOffset = (key, contentH, top, bottom) => (MODALS.has(key) || key === 'setup' ? 0 : Math.max(0, (bottom - top - contentH) * (key === 'title' ? 0.3 : 0.12)));
export function ensureLayout(state, key) {
  const sz = `${W}x${H}|${state.settings.textIdx}`;
  if (LAID.key === key && LAID.lay && LAID.sz === sz) return;
  const c = colOf(key);
  const lay = flowLayout(estCtx, BUILD[key](state, c.split), TEXT_SCALES[state.settings.textIdx], { x: c.x, w: c.w, minH: minTap() });
  const off = vOffset(key, lay.contentH, c.top, c.bottom);
  LAID = { key, lay, top: c.top + off, bottom: c.bottom, h: lay.contentH, sz, lock: lockFor(key, c, c.top + off, lay) };
}
function lockFor(key, c, top, lay) {
  if (key !== 'title') return null;
  const ls = lockSize(c.w), cx = c.x + c.w / 2, pinned = SAFE.y1 - ls.h - 12, y = Math.min(top + lay.contentH + 12, pinned);
  const m = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(ls.w + 24, m), th = Math.max(ls.h + 12, m);
  return { cx, y, w: ls.w, h: ls.h, tap: { x: cx - tw / 2, y: y - 4, w: tw, h: Math.max(th, ls.h + 8) } };
}
export const lockupZone = () => (LAID.lock ? LAID.lock.tap : null);
export function hitScreen(x, y, scroll) {
  { const t = LAID.key === 'title' && LAID.lock && LAID.lock.tap; if (t && x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return 'arcforge'; }
  return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null;
}

function drawGolfBall(ctx, x, y, r) {
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x + r * 0.25, y + r * 0.95, r * 0.9, r * 0.28, 0, 0, TAU); ctx.fillStyle = 'rgba(0,15,6,0.4)'; ctx.fill();
  const rg = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.5, '#f1f1ea'); rg.addColorStop(1, '#b9bdb3');
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = rg; ctx.fill();
  ctx.fillStyle = 'rgba(120,125,115,0.35)';
  for (let ring = 1; ring <= 3; ring++) for (let k = 0; k < ring * 5; k++) { const a = (k / (ring * 5)) * TAU + ring, d = (ring / 3.6) * r; ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.07, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function drawHero(ctx, cx, y0, scale = 1) {
  ctx.save(); ctx.translate(cx, y0); ctx.scale(scale, scale); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 96px ${FONT}`; textShadow(ctx, 'MINI GOLF', 0, 154, '#f6fbf1', 14);
  ctx.font = `italic 700 76px ${SERIF}`; textShadow(ctx, 'Links Putt', 0, 236, '#ffd447', 12);
  ctx.font = `500 27px ${FONT}`; textShadow(ctx, 'Pull back. Bank it. Sink it.', 0, 286, '#d6efd8', 6);
  ctx.strokeStyle = 'rgba(190,235,200,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-200, 310); ctx.lineTo(200, 310); ctx.stroke();
  ctx.restore();
}
const heroArt = (h = 336, hs = 1) => ({ t: 'art', h, draw(ctx, w) { drawHero(ctx, w / 2, 0, hs); } });

export function titleWidgets(state, split = false) {
  const sound = state.settings.sound;
  const tall = H >= 1180;
  const wd = split ? [{ t: 'gap', h: 18 }] : H < 1120 ? [heroArt(236, 0.8), { t: 'gap', h: 14 }] : [heroArt(tall ? 336 : 304), { t: 'gap', h: state.saved ? (tall ? 60 : 24) : (tall ? 120 : 40) }];
  if (state.saved) {
    const sn = state.saved, c = COURSE_BY_ID[sn.cfg.course];
    const who = sn.cfg.mode === 'two' ? 'Two players' : sn.cfg.mode === 'solo' ? 'Solo' : `vs ${sn.cfg.opp === 4 ? 'the full field' : PROFILES[sn.cfg.opp].name}`;
    wd.push({ t: 'btn', id: 'resume', label: 'Continue round', sub: `${c ? c.name : 'Grand Round'} · ${who} · hole ${sn.idx + 1} of ${sn.holeIds.length}`, primary: true, h: 92 });
  }
  wd.push({ t: 'btn', id: 'play', label: 'Play', primary: !state.saved, h: 92 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 3 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 4 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4 });
  wd.push({ t: 'gap', h: split ? 10 : 70 });
  return wd;
}

export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'New Round', size: 48 }];
  wd.push({ t: 'p', label: 'Who is playing', bold: true, color: '#cfeed3', size: 26 });
  wd.push({ t: 'btn', id: 'mode-ai', label: 'Against the computer', active: s.mode === 'ai', dark: s.mode !== 'ai', h: 80 });
  wd.push({ t: 'btn', id: 'mode-two', label: 'Two players', row: 5, active: s.mode === 'two', dark: s.mode !== 'two' });
  wd.push({ t: 'btn', id: 'mode-solo', label: 'Just me', row: 5, active: s.mode === 'solo', dark: s.mode !== 'solo' });
  if (s.mode === 'ai') {
    wd.push({ t: 'p', label: 'Choose your rival', bold: true, color: '#cfeed3', size: 26 });
    PROFILES.forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0, locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${'★'.repeat(pf.stars)}${'☆'.repeat(5 - pf.stars)}  ${pf.tag}${won ? ` · won ${won}` : ''}`, active: s.opp === i && !locked, dark: s.opp !== i, disabled: locked, hitDisabled: true, h: 88 });
    });
    const locked = demo;
    wd.push({ t: 'btn', id: 'opp4', label: 'The full field', sub: locked ? 'In the full game' : 'Clubhouse, Club Pro and Champion together', active: s.opp === 4 && !locked, dark: s.opp !== 4, disabled: locked, hitDisabled: true, h: 88 });
  }
  wd.push({ t: 'p', label: 'Course', bold: true, color: '#cfeed3', size: 26 });
  for (const c of [...COURSES, { id: 'grand', name: 'The Grand Round', blurb: 'All eighteen holes, one after another.' }]) {
    const locked = demo && c.id !== 'heather', best = (rec.best ?? {})[c.id];
    wd.push({ t: 'btn', id: `crs-${c.id}`, label: c.name, sub: locked ? 'In the full game' : `${c.blurb}${best ? `  ·  best ${best}` : ''}`, active: s.course === c.id && !locked, dark: s.course !== c.id, disabled: locked, hitDisabled: true, h: 92 });
  }
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  const guide = ['Full path', 'First bounce', 'Off'][st.guide];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#cfeed3', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'set-guide', label: `Aim guide: ${guide}`, sub: 'What the dotted line shows while you aim' },
    { t: 'btn', id: 'set-confirm', label: st.confirm ? 'Aim then Putt button' : 'Let go to putt', sub: st.confirm ? 'Letting go keeps the aim; press Putt when ready' : 'Letting go putts straight away', active: st.confirm },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#cfeed3', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#cfeed3' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const m = state.m, o = m.over, names = m.players.map((p) => p.name);
  const watch = m.cfg.mode === 'watch', solo = m.players.length === 1;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  let title;
  if (watch) title = 'Round finished';
  else if (solo) title = `${o.totals[0]} strokes`;
  else if (o.winners.length === 1) title = names[o.winners[0]] === 'You' ? 'You win!' : `${names[o.winners[0]]} wins`;
  else title = 'A tie';
  const wd = [{ t: 'gap', h: big ? 24 : 60 }, { t: 'h', label: title, size: 64, cap: big ? 1.2 : 1.5 }];
  if (solo) wd.push({ t: 'h', label: `${parLabel(o.totals[0] - o.par)} against par ${o.par}`, size: 46, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  else m.players.forEach((p, i) => wd.push({ t: 'p', label: `${p.name}: ${o.totals[i]}  (${parLabel(o.totals[i] - o.par)})`, bold: true, size: 32, cap: big ? 1.6 : 2, color: o.winners.includes(i) ? '#ffd97a' : 'rgba(240,248,236,0.96)' }));
  const rows = m.players.map((p, i) => `${p.name}: ${m.scores[i].join(' ')}`).join('   ·   ');
  wd.push({ t: 'p', label: `Holes: par ${m.holes.map((d) => d.par).join(' ')}`, size: 22, cap: big ? 2 : 3 });
  wd.push({ t: 'p', label: rows, size: 22, cap: big ? 2 : 3 });
  if (o.newBest) wd.push({ t: 'p', label: 'A new personal best on this course!', bold: true, color: '#9fe9b0', size: 26, cap: big ? 2 : 3 });
  wd.push({ t: 'gap', h: 20 });
  wd.push({ t: 'btn', id: 'again', label: watch ? 'Watch again' : 'Play again', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: watch ? 'Play a round' : 'New round', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 },
    { t: 'btn', id: 'p-guide', label: `Guide: ${['Full', 'First bounce', 'Off'][st.guide]}`, row: 8 },
    { t: 'btn', id: 'p-txtdec', label: 'A−', row: 10, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'p-txtinc', label: 'A+', row: 10, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}
export function reasonWidgets(state) {
  const k = state.card ?? { title: '', text: '' };
  return [{ t: 'h', label: k.title, size: 40, color: '#ffd447' }, { t: 'p', label: k.text, size: 26, align: 'left', pad: 4 }, { t: 'btn', id: 'reason-close', label: 'Close', primary: true, h: 84 }];
}
export function demoLimitWidgets(state) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  return [
    { t: 'gap', h: big ? 30 : 160 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free holes of the web demo. The full game on iPhone and Android has all three courses, every rival, the Grand Round and unlimited play.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(2,14,8,${a * 0.75})`); g.addColorStop(0.5, `rgba(2,14,8,${a})`); g.addColorStop(1, `rgba(2,14,8,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(2,14,8,0)'); g.addColorStop(1, 'rgba(2,14,8,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(220,242,222,0.92)'; ctx.fill();
    ctx.fillStyle = '#16301f'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(220,242,222,0.92)'; ctx.fill();
    ctx.fillStyle = '#16301f'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
function prepFlow(ctx, state, key, widgets) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const c = colOf(key);
  const lay = flowLayout(ctx, widgets, sc, { x: c.x, w: c.w, minH: minTap() });
  const off = vOffset(key, lay.contentH, c.top, c.bottom);
  const top = c.top + off, bottom = c.bottom;
  LAID = { key, lay, top, bottom, h: lay.contentH, sz: `${W}x${H}|${state.settings.textIdx}`, lock: lockFor(key, c, top, lay) };
  return { lay, c, off, top, bottom };
}
function drawPrepared(ctx, state, f) {
  const { lay, top, bottom } = f;
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, SAFE.x1 - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(220,242,222,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll, f.c.x, f.c.w);
  }
  return { scroll, maxScroll, lay };
}
const drawFlowScreen = (ctx, state, key, widgets) => drawPrepared(ctx, state, prepFlow(ctx, state, key, widgets));

function brandFooter(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(2,14,8,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  if (!drawLockupImage(ctx, k.cx, k.y + k.h + (dn ? 1 : 0), k.w * (dn ? 0.96 : 1), dn ? 0.7 : 1)) drawCredit(ctx, k.cx, k.y + k.h - 6, 13);
}

export function renderTitle(ctx, state) {
  const g = flowGeom('title'), split = g.split;
  const f = prepFlow(ctx, state, 'title', titleWidgets(state, split));
  drawAttract(ctx, state);
  if (split) {
    scrim(ctx, 0.46);
    const hx = (SAFE.x0 + f.c.x - 12) / 2;
    const rg = ctx.createRadialGradient(hx, H * 0.3, 40, hx, H * 0.3, 420);
    rg.addColorStop(0, 'rgba(2,14,8,0.7)'); rg.addColorStop(1, 'rgba(2,14,8,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, f.c.x, H);
    const hs = Math.min(1, (f.c.x - SAFE.x0 - 24) / 640);
    drawHero(ctx, hx, Math.max(SAFE.y0 + 24, H * 0.5 - 336 * hs * 0.62 - 40), hs);
  } else {
    scrim(ctx, 0.46);
    const rg = ctx.createRadialGradient(W / 2, 200 + f.off, 40, W / 2, 200 + f.off, 420);
    rg.addColorStop(0, 'rgba(2,14,8,0.7)'); rg.addColorStop(1, 'rgba(2,14,8,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, 700 + f.off);
  }
  drawPrepared(ctx, state, f);
  brandFooter(ctx, state);
  ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(220,242,222,0.6)';
  if (state.demo) ctx.fillText('Web demo', split ? (SAFE.x0 + f.c.x - 12) / 2 : W / 2, SAFE.y1 - 10);
}
export function renderSetup(ctx, state) {
  drawAttract(ctx, state); scrim(ctx, 0.72);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state));
  const y0 = SETUP_PINS.start.y - 56;
  const g = ctx.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, 'rgba(2,14,8,0)'); g.addColorStop(0.2, 'rgba(2,14,8,0.88)'); g.addColorStop(1, 'rgba(2,14,8,0.96)');
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, H - y0);
  drawButton(ctx, SETUP_PINS.start, 'Start the round', { primary: true, size: LAND ? 28 : 32 });
  drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: LAND ? 26 : 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, SETUP_PINS.start.y - 16); }
}
export function renderSettings(ctx, state) { drawAttract(ctx, state); scrim(ctx, 0.74); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state)); }
export function renderResult(ctx, state) {
  drawAttract(ctx, state); scrim(ctx, 0.66);
  const r = drawFlowScreen(ctx, state, 'result', resultWidgets(state));
  const room = r.maxScroll <= 0 && LAID.top + r.lay.contentH < SAFE.y1 - 30;
  if (room) drawMoreLine(ctx, W / 2, SAFE.y1 - 14, 15);
}
export function renderDemoLimit(ctx, state) { drawAttract(ctx, state); scrim(ctx, 0.76); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(state)); }

function modal(ctx, state, key, widgets) {
  scrim(ctx, 0.62);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const mg = modalGeom();
  const lay = flowLayout(ctx, widgets, sc, { x: mg.x + 30, w: mg.w - 60, minH: minTap() });
  const top = mg.top, bottom = mg.bottom;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, mg.x, y0 - 20, mg.w, ch + 40, { r: 30, fill: 'rgba(8,34,22,0.96)', stroke: 'rgba(150,215,170,0.5)' });
  LAID = { key, lay, top: y0, bottom: y0 + ch, h: lay.contentH, sz: `${W}x${H}|${state.settings.textIdx}` };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, mg.x, mg.w);
}
export const renderPause = (ctx, state) => modal(ctx, state, 'pause', pauseWidgets(state));
export const renderReason = (ctx, state) => modal(ctx, state, 'reason', reasonWidgets(state));

// ---- reference pages ---------------------------------------------------------------------------------------------
export const READER = { max: 0, view: 0, y0: 0, y1: 0 };
export const refCloseRect = () => ({ x: REF_BACK.x, y: REF_BACK.y, w: REF_NEXT.x + REF_NEXT.w - REF_BACK.x, h: REF_BACK.h });

function buildPages(ctx, list, scale) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 80;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const viewH = Math.max(0, PANEL.h - 190);
  const blocks = [];
  let total = 0;
  list.forEach((sec) => {
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw), titleH = tl.length * secFs * 1.2 + 16;
    ctx.font = `400 ${fs}px ${FONT}`;
    const lines = [];
    sec.p.forEach((para, pi) => { wrapLines(ctx, para, tw).forEach((l, k) => lines.push({ text: l, gapBefore: k === 0 && pi > 0 })); });
    const artH = sec.art ? Math.min(250, Math.max(130, Math.round(viewH * 0.4))) : 0;
    let h = titleH + artH + 26;
    lines.forEach((l, k) => { h += lh + (l.gapBefore && k > 0 ? lh * 0.45 : 0); });
    blocks.push({ title: sec.title, tl, titleH, art: sec.art, artH, lines });
    total += h;
  });
  return { blocks, fs, lh, secFs, total };
}

const pageCache = new Map();
export function renderPages(ctx, state, list, header) {
  drawAttract(ctx, state); scrim(ctx, 0.76);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${PANEL.w}x${PANEL.h}`;
  let pg = pageCache.get(pkey);
  if (!pg) { pg = buildPages(ctx, list, sc); pageCache.set(pkey, pg); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2;
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(246,249,240,0.98)', stroke: 'rgba(40,110,70,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `800 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(40,110,70,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  const cy0 = PANEL.y + 112, cy1 = PANEL.y + PANEL.h - 62;
  READER.max = Math.max(0, Math.ceil(pg.total - (cy1 - cy0 - 8))); READER.view = cy1 - cy0; READER.y0 = cy0; READER.y1 = cy1;
  state.ui.scroll = Math.max(0, Math.min(READER.max, state.ui.scroll || 0));
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 4, cy0, PANEL.w - 8, cy1 - cy0); ctx.clip();
  let y = PANEL.y + 120 - state.ui.scroll;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(40,110,70,0.25)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.sky; ctx.font = `800 ${pg.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l, pcx, y + pg.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    if (blk.art) { if (y < cy1 && y + blk.artH > cy0) { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, blk.artH); ctx.clip(); drawArt(blk.art, ctx, PANEL.x + 40, y, PANEL.w - 80, blk.artH - 12, state); ctx.restore(); } y += blk.artH; }
    ctx.fillStyle = C.ink; ctx.font = `400 ${pg.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => {
      if (l.gapBefore && k > 0) y += pg.lh * 0.45;
      ctx.fillText(l.text, PANEL.x + 40, y + pg.fs * 0.85);
      y += pg.lh;
    });
    y += 26;
  });
  ctx.restore();
  if (READER.max > 0) {
    const th = Math.max(50, (cy1 - cy0) * ((cy1 - cy0) / pg.total)), ty = cy0 + (state.ui.scroll / READER.max) * (cy1 - cy0 - th);
    roundPath(ctx, PANEL.x + PANEL.w - 14, ty, 6, th, 3); ctx.fillStyle = 'rgba(40,110,70,0.5)'; ctx.fill();
    ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(30,70,45,0.7)';
    ctx.fillText(state.ui.scroll < READER.max - 4 ? '▼' : '▲', pcx, PANEL.y + PANEL.h - 28);
  }
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#f6fbf1'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(sc * 100)}%`, TEXT_DEC.x - 14, TEXT_DEC.y + TEXT_DEC.h / 2 + 8);
  drawButton(ctx, refCloseRect(), 'Close', { primary: true, size: LAND ? 28 : 32 });
}

// ---- illustrations: the real course art in a small frame ---------------------------------------------------------
export function drawArt(key, ctx, x, y, w, h, state) {
  const id = key === 'aim' ? 'dunes-1' : key;
  const def = holeById(id); if (!def) return;
  const hole = compileHole(def), th = themeOf(def.course);
  ctx.save();
  roundPath(ctx, x, y, w, h, 16); ctx.clip();
  ctx.fillStyle = '#0e2a1c'; ctx.fillRect(x, y, w, h);
  const cam = makeCam(hole, { x, y, w, h }, 0);
  drawCourse(ctx, hole, cam, state.t, th, {});
  ctx.save(); place(ctx, cam);
  const tee = def.tee;
  if (key === 'aim') {
    const ang = Math.atan2(def.cup.y - tee.y, def.cup.x - tee.x) + 0.0;
    const r = simulate(hole, newBall(tee.x, tee.y), ang, 0.5, 0, { path: true, noMovers: true, until: 'wall', maxT: 5 });
    drawGuide(ctx, cam, { pts: r.path, end: { x: r.x, y: r.y }, hitWall: false }, state.t);
  }
  drawBall(ctx, cam, newBall(tee.x, tee.y), BALL_COLORS[0]);
  ctx.restore();
  if (key === 'aim') {
    const [bx, by] = cam.m2s(tee.x, tee.y);
    drawPowerRing(ctx, cam, tee.x, tee.y, 0.5, 0);
    const dir = cam.rot ? [0, 1] : [0, 1];
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.setLineDash([2, 9]);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + dir[0] * 70, by + dir[1] * 70); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(bx + dir[0] * 70, by + dir[1] * 70, 12, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
  }
  drawFlag(ctx, cam, hole, th, state.t, false);
  ctx.restore();
  ctx.save(); roundPath(ctx, x, y, w, h, 16); ctx.strokeStyle = 'rgba(40,110,70,0.6)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
}
