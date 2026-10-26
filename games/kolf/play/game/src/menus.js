// Every screen that is not the play screen: title, setup, settings, result, pause, the reason reader, and the paginated
// About / How to play / Rules reader with its illustrations (drawn with the game's own court art). Pure drawing; game.js owns state.
import { W, H, LAND, SAFE, PANEL, host, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS, flowGeom, modalGeom, lockSize, minTap } from './layout.js';
import { drawCredit, drawLockupImage, drawMoreLine } from './brand.js';
import { FONT, SERIF, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit, FLOOR } from './ui.js';
import { PROFILES } from './ai.js';
import { COURTS, COURT_BY_ID, VENUES, VENUE_BY_ID } from './courts.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { compileCourt, newBall, stepBall, simulate } from './sim.js';
import { drawScene, BALL_COLORS } from './view.js';
import { parLabel } from './hud.js';

const TAU = Math.PI * 2;

// ---- the attract court behind the menus ---------------------------------------------------------------------------
// A slow drift over a court while a ball slides down it: real physics, no input. Strokes are pre-aimed (checked by hand).
const ATTRACT = [
  { c: 'canal-run', dir: 0, a: -0.012, p: 0.66 }, { c: 'bollard-field', dir: 0, a: 0.139, p: 0.76 }, { c: 'windmill-reach', dir: 0, a: -0.02, p: 0.78 },
  { c: 'boat-yard', dir: 1, a: 3.12, p: 0.7 }, { c: 'canal-run', dir: 1, a: 3.0, p: 0.7 },
];
export function newAttract() { return { i: 0, ball: null, clock: 0, wait: 1.4, trail: [], shot: false, court: null, evq: [], fph: 'idle', fu: 0, figAt: null, snap: false }; }
export function stepAttract(a, dt) {
  const s = ATTRACT[a.i % ATTRACT.length];
  if (!a.court || a.court.id !== s.c || a.court.dir !== s.dir) { a.court = compileCourt(COURT_BY_ID[s.c], s.dir); a.ball = null; }
  if (!a.ball) { a.ball = newBall(a.court.tee.x, a.court.tee.y); a.wait = 2.2; a.trail = []; a.shot = false; a.fph = 'idle'; a.fu = 0; a.figAt = { x: a.court.tee.x, y: a.court.tee.y }; a.snap = true; }
  a.clock += dt;
  const b = a.ball;
  if (b.mode === 'roll') {
    const ev = [];
    for (let k = 0; k < 2 && b.mode === 'roll'; k++) { ev.length = 0; stepBall(a.court, b, a.clock, ev); for (const e of ev) a.evq.push(e); if (a.evq.length > 30) a.evq.splice(0, a.evq.length - 30); if (k === 0) { a.trail.push([b.x, b.y]); if (a.trail.length > 22) a.trail.shift(); } }
    if (b.mode !== 'roll') a.wait = b.mode === 'post' ? 2.2 : 1.2;
  } else {
    if (a.trail.length) a.trail.shift();
    a.wait -= dt;
    if (b.mode === 'thin') b.sink = Math.min(1.2, b.sink + dt);
    if (!a.shot) {
      // the player draws the club back, brings it down, and the ball goes at the moment of impact
      if (a.wait > 1.0) { a.fph = 'idle'; a.fu = 0; }
      else if (a.wait > 0.22) { a.fph = 'back'; a.fu = Math.min(1, (1.0 - a.wait) / 0.78) * 0.8; a.fbase = a.fu; }
      else if (a.wait > 0) { a.fph = 'down'; a.fu = 1 - a.wait / 0.22; }
      else { const sp = 4 + 21 * s.p; b.vx = Math.sin(s.a) * sp; b.vy = Math.cos(s.a) * sp; b.mode = 'roll'; b.t = 0; a.shot = true; a.fph = 'follow'; a.fu = 0; }
    } else if (a.wait <= 0) { a.i++; a.ball = null; }
  }
  if (a.fph === 'follow') a.fu = Math.min(9, a.fu + dt);
}
export function sceneFor(c, t, ball, trail, yaw, extra = {}) {
  const dist = Math.hypot(c.post.x - ball.x, c.post.y - ball.y);
  return {
    court: c, v: { x: ball.x, y: ball.y, yaw, dist }, t, clock: extra.clock ?? t, cur: 0,
    balls: [{ ball, color: BALL_COLORS[0], trail, done: false }], parts: [], guide: extra.guide || null, fig: extra.fig || null, ...extra,
  };
}
export function drawAttract(ctx, state) {
  const a = state.att; if (!a || !a.court || !a.ball) return;
  const c = a.court, b = a.ball;
  const base = Math.atan2(c.post.x - b.x, c.post.y - b.y);
  const yaw = base + Math.sin(state.t * 0.11) * 0.18;
  const port = H > W * 1.1;   // portrait: the scene is drawn 30 % taller so the player stands low, clear of the menu buttons
  drawScene(ctx, port ? { x: 0, y: -H * 0.05, w: W, h: H * 1.3 } : { x: 0, y: 0, w: W, h: H }, sceneFor(c, state.t, b, a.trail, yaw, { clock: a.clock, events: a.evq.splice(0), fig: a.figAt ? { show: true, at: a.figAt, ph: a.fph, u: a.fu, from: a.fbase || 0.8, swing: 0.25, color: BALL_COLORS[0], snap: a.snap && !(a.snap = false) } : null }));
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

function drawHero(ctx, cx, y0, scale = 1) {
  ctx.save(); ctx.translate(cx, y0); ctx.scale(scale, scale); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `600 30px ${SERIF}`; textShadow(ctx, 'THE ICE GAME OF THE LOW COUNTRIES', 0, 70, '#f6e4b4', 9);
  // embossed gilt lettering: dark extrusion, gold face with a lit top, a fine dark rim
  ctx.font = `italic 700 150px ${SERIF}`;
  for (let i = 9; i >= 1; i--) { ctx.fillStyle = i > 4 ? '#3a230c' : '#6a4310'; ctx.fillText('Kolf', 0, 205 + i); }
  const gg = ctx.createLinearGradient(0, 100, 0, 215);
  gg.addColorStop(0, '#fff6d0'); gg.addColorStop(0.42, '#f1c964'); gg.addColorStop(0.7, '#d79a2b'); gg.addColorStop(1, '#a8701a');
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 18; ctx.fillStyle = gg; ctx.fillText('Kolf', 0, 205); ctx.shadowBlur = 0;
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(60,34,6,0.8)'; ctx.strokeText('Kolf', 0, 205);
  ctx.save(); ctx.beginPath(); ctx.rect(-300, 90, 600, 60); ctx.clip(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff'; ctx.fillText('Kolf', 0, 203); ctx.restore();
  // a Delft-blue tile rule under the title
  ctx.fillStyle = 'rgba(8,4,0,0.35)'; ctx.fillRect(-212, 232, 424, 14);
  for (let i = 0; i < 14; i++) {
    const x = -210 + i * 30; ctx.fillStyle = '#f4f2ea'; ctx.fillRect(x, 230, 28, 14); ctx.strokeStyle = '#2b5aa0'; ctx.lineWidth = 1.6; ctx.strokeRect(x + 2, 232, 24, 10);
    ctx.fillStyle = '#2b5aa0'; ctx.beginPath(); ctx.arc(x + 14, 237, 3, 0, TAU); ctx.fill();
  }
  ctx.font = `500 29px ${FONT}`; textShadow(ctx, 'Aim. Swing. Touch the post.', 0, 292, '#f8ecc8', 8);
  ctx.restore();
}
const heroArt = (h = 336, hs = 1) => ({ t: 'art', h, draw(ctx, w) { drawHero(ctx, w / 2, 0, hs); } });

export function titleWidgets(state, split = false) {
  const sound = state.settings.sound;
  const tall = H >= 1180;
  const wd = split ? [{ t: 'gap', h: 18 }] : H < 1120 ? [heroArt(236, 0.8), { t: 'gap', h: 14 }] : [heroArt(tall ? 336 : 304), { t: 'gap', h: state.saved ? (tall ? 60 : 24) : (tall ? 120 : 40) }];
  if (state.saved) {
    const sn = state.saved, v = VENUE_BY_ID[sn.cfg.venue];
    const who = sn.cfg.mode === 'two' ? 'Two players' : sn.cfg.mode === 'solo' ? 'Solo' : `vs ${PROFILES[sn.cfg.opp].name}`;
    wd.push({ t: 'btn', id: 'resume', label: 'Continue match', sub: `${v ? v.name : 'The Golden Cup'} · ${who} · leg ${sn.idx + 1} of ${sn.legIds.length}`, primary: true, h: 92 });
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
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'New Match', size: 48 }];
  wd.push({ t: 'p', label: 'Who is playing', bold: true, color: '#e8c273', size: 26 });
  wd.push({ t: 'btn', id: 'mode-ai', label: 'Against the computer', active: s.mode === 'ai', dark: s.mode !== 'ai', h: 80 });
  wd.push({ t: 'btn', id: 'mode-two', label: 'Two players', row: 5, active: s.mode === 'two', dark: s.mode !== 'two' });
  wd.push({ t: 'btn', id: 'mode-solo', label: 'Just me', row: 5, active: s.mode === 'solo', dark: s.mode !== 'solo' });
  if (s.mode === 'ai') {
    wd.push({ t: 'p', label: 'Choose your rival', bold: true, color: '#e8c273', size: 26 });
    PROFILES.forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0, locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${'★'.repeat(pf.stars)}${'☆'.repeat(5 - pf.stars)}  ${pf.tag}${won ? ` · won ${won}` : ''}`, active: s.opp === i && !locked, dark: s.opp !== i, disabled: locked, hitDisabled: true, h: 88 });
    });
  }
  wd.push({ t: 'p', label: 'Venue', bold: true, color: '#e8c273', size: 26 });
  for (const v of [...VENUES, { id: 'cup', name: 'The Golden Cup', blurb: 'All twelve legs on all six courts.' }]) {
    const locked = demo && v.id !== 'canal', best = (rec.best ?? {})[v.id];
    wd.push({ t: 'btn', id: `crs-${v.id}`, label: v.name, sub: locked ? 'In the full game' : `${v.blurb}${best ? `  ·  best ${best}` : ''}`, active: s.venue === v.id && !locked, dark: s.venue !== v.id, disabled: locked, hitDisabled: true, h: 92 });
  }
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  const guide = ['Full path', 'Up to the first bounce', 'Off'][st.guide];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#e8c273', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'set-guide', label: `Aim guide: ${guide}`, sub: 'What the dotted line shows while you aim' },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#e8c273', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#e8c273' }] : []),
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
  if (watch) title = 'Match finished';
  else if (solo) title = `${o.totals[0]} strokes`;
  else if (o.winners.length === 1) title = names[o.winners[0]] === 'You' ? 'You win the match!' : `${names[o.winners[0]]} wins`;
  else title = 'The match is drawn';
  const wd = [{ t: 'gap', h: big ? 24 : 60 }, { t: 'h', label: title, size: 60, cap: big ? 1.2 : 1.5 }];
  if (solo) wd.push({ t: 'h', label: `${parLabel(o.totals[0] - o.par)} against par ${o.par}`, size: 46, cap: big ? 1.1 : 1.3, color: '#e8c273' });
  else m.players.forEach((p, i) => wd.push({ t: 'p', label: `${p.name}: ${m.wins[i]} ${m.wins[i] === 1 ? 'leg' : 'legs'}  ·  ${o.totals[i]} strokes`, bold: true, size: 32, cap: big ? 1.6 : 2, color: o.winners.includes(i) ? '#e8c273' : 'rgba(248,238,214,0.97)' }));
  const rows = m.players.map((p, i) => `${p.name}: ${m.scores[i].join(' ')}`).join('   ·   ');
  wd.push({ t: 'p', label: `Legs: par ${m.legs.map((d) => d.par).join(' ')}`, size: 22, cap: big ? 2 : 3 });
  wd.push({ t: 'p', label: rows, size: 22, cap: big ? 2 : 3 });
  if (o.newBest) wd.push({ t: 'p', label: 'A new personal best on this venue!', bold: true, color: '#b9e29a', size: 26, cap: big ? 2 : 3 });
  wd.push({ t: 'gap', h: 20 });
  wd.push({ t: 'btn', id: 'again', label: watch ? 'Watch again' : 'Play again', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: watch ? 'Play a match' : 'New match', row: 6 });
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
    { t: 'gap', h: big ? 30 : 160 }, { t: 'h', label: 'That is the demo end', size: 48 },
    { t: 'p', label: 'You have played the free legs of the web demo. The full game on iPhone and Android has all six courts, every rival, The Golden Cup and unlimited play.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(14,8,3,${a * 0.75})`); g.addColorStop(0.5, `rgba(14,8,3,${a})`); g.addColorStop(1, `rgba(14,8,3,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(14,8,3,0)'); g.addColorStop(1, 'rgba(14,8,3,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(247,239,215,0.94)'; ctx.fill();
    ctx.fillStyle = '#2a1d12'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(247,239,215,0.94)'; ctx.fill();
    ctx.fillStyle = '#2a1d12'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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
    roundPath(ctx, SAFE.x1 - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(247,239,215,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll, f.c.x, f.c.w);
  }
  return { scroll, maxScroll, lay };
}
const drawFlowScreen = (ctx, state, key, widgets) => drawPrepared(ctx, state, prepFlow(ctx, state, key, widgets));

function brandFooter(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(14,8,3,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  if (!drawLockupImage(ctx, k.cx, k.y + k.h + (dn ? 1 : 0), k.w * (dn ? 0.96 : 1), dn ? 0.7 : 1)) drawCredit(ctx, k.cx, k.y + k.h - 6, 13);
}

export function renderTitle(ctx, state) {
  const g = flowGeom('title'), split = g.split;
  const f = prepFlow(ctx, state, 'title', titleWidgets(state, split));
  drawAttract(ctx, state);
  if (split) {
    scrim(ctx, 0.26);
    const hx = (SAFE.x0 + f.c.x - 12) / 2;
    const rg = ctx.createRadialGradient(hx, H * 0.3, 40, hx, H * 0.3, 420);
    rg.addColorStop(0, 'rgba(14,8,3,0.7)'); rg.addColorStop(1, 'rgba(14,8,3,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, f.c.x, H);
    const hs = Math.min(1, (f.c.x - SAFE.x0 - 24) / 640);
    drawHero(ctx, hx, Math.max(SAFE.y0 + 24, H * 0.5 - 336 * hs * 0.62 - 40), hs);
  } else {
    scrim(ctx, 0.26);
    const rg = ctx.createRadialGradient(W / 2, 200 + f.off, 40, W / 2, 200 + f.off, 420);
    rg.addColorStop(0, 'rgba(14,8,3,0.7)'); rg.addColorStop(1, 'rgba(14,8,3,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, 700 + f.off);
  }
  drawPrepared(ctx, state, f);
  brandFooter(ctx, state);
  ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(247,239,215,0.6)';
  if (state.demo) ctx.fillText('Web demo', split ? (SAFE.x0 + f.c.x - 12) / 2 : W / 2, SAFE.y1 - 10);
}
export function renderSetup(ctx, state) {
  drawAttract(ctx, state); scrim(ctx, 0.72);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state));
  const y0 = SETUP_PINS.start.y - 56;
  const g = ctx.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, 'rgba(14,8,3,0)'); g.addColorStop(0.2, 'rgba(14,8,3,0.88)'); g.addColorStop(1, 'rgba(14,8,3,0.96)');
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
  panel(ctx, mg.x, y0 - 20, mg.w, ch + 40, { r: 30, fill: 'rgba(36,26,16,0.97)', stroke: 'rgba(201,153,58,0.55)' });
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
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(247,239,215,0.98)', stroke: 'rgba(125,42,28,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `italic 700 ${Math.round(44 * Math.min(sc, 1.15))}px ${SERIF}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(125,42,28,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  const cy0 = PANEL.y + 112, cy1 = PANEL.y + PANEL.h - 62;
  READER.max = Math.max(0, Math.ceil(pg.total - (cy1 - cy0 - 8))); READER.view = cy1 - cy0; READER.y0 = cy0; READER.y1 = cy1;
  state.ui.scroll = Math.max(0, Math.min(READER.max, state.ui.scroll || 0));
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 4, cy0, PANEL.w - 8, cy1 - cy0); ctx.clip();
  let y = PANEL.y + 120 - state.ui.scroll;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(125,42,28,0.22)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.delft; ctx.font = `700 ${pg.secFs}px ${SERIF}`;
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
    roundPath(ctx, PANEL.x + PANEL.w - 14, ty, 6, th, 3); ctx.fillStyle = 'rgba(125,42,28,0.45)'; ctx.fill();
    ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(80,40,20,0.7)';
    ctx.fillText(state.ui.scroll < READER.max - 4 ? '▼' : '▲', pcx, PANEL.y + PANEL.h - 28);
  }
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#f8edd0'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(sc * 100)}%`, TEXT_DEC.x - 14, TEXT_DEC.y + TEXT_DEC.h / 2 + 8);
  drawButton(ctx, refCloseRect(), 'Close', { primary: true, size: LAND ? 28 : 32 });
}

// ---- illustrations: the real court art in a small frame ----------------------------------------------------------
export function drawArt(key, ctx, x, y, w, h, state) {
  const def = COURT_BY_ID['canal-run'], c = compileCourt(def, 0);
  const ball = newBall(c.tee.x, c.tee.y);
  ctx.save();
  roundPath(ctx, x, y, w, h, 16); ctx.clip();
  let guide = null, yaw = 0;
  if (key === 'aim') {
    const ang = Math.atan2(c.post.x - ball.x, c.post.y - ball.y) + 0.07;
    yaw = ang;
    const r = simulate(c, ball, ang, 0.7, 0, { path: true, noMovers: true, until: 'wall', maxT: 6 });
    guide = { pts: r.path, end: { x: r.x, y: r.y } };
  }
  drawScene(ctx, { x, y, w, h }, sceneFor(c, state.t, ball, [], yaw, { clock: 0, guide, fig: { show: true, swing: 0.2, color: BALL_COLORS[0] } }));
  ctx.restore();
  ctx.save(); roundPath(ctx, x, y, w, h, 16); ctx.strokeStyle = 'rgba(201,153,58,0.8)'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
}
