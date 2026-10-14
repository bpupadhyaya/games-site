// Takoyaki Flip Stall: all screens are drawn here from the game state `S` (render only; nothing here mutates the simulation).
import { playLayout, titleArt, titleLayout, docLayout, settingsLayout, listLayout, shiftRects, overLayout, pauseLayout, plateGeo, centerCard, TEXT_SCALES, THINK_STEPS, host, inRect } from './layout.js';
import { T, UI, NUM, txt, para, paraHeight, shiftHeads, panel, button, background, rr, clamp, F, icons, fillingIcon, mix, rgba, slab } from './ui.js';
import { v3, place } from './v3.js';
import { sprites } from './sprites.js';
import { drawAwning, drawPlate, drawBall, drawSteam, drawTicket, drawTray, drawHearts, drawBoat, drawRing, demoMould, cookColor } from './art.js';
import { DOCS, FACTS } from './content.js';
import { drawCredit, drawMoreLine, edgeStroke, drawBadgeStack } from './brand.js';
import { K, FLAMES, FILLINGS, STALLS, SHIFTS_PER_STALL, TOTAL_SHIFTS, grade } from './engine.js';

export const metrics = { max: 0, view: 0, rect: null };   // scroll body of the current screen, filled in each frame
export const SETTINGS = [
  { id: 'sound', label: 'Sound', desc: 'Pours, sizzle ticks, flips and the bell.', opts: ['On', 'Off'] },
  { id: 'ring', label: 'Cook ring', desc: 'The ring that shows how done the bottom quarter is.', opts: ['Show', 'Hide'] },
  { id: 'calm', label: 'Calm iron', desc: 'Cooks about a fifth slower: more time for every ball.', opts: ['Off', 'On'] },
  { id: 'think', label: 'Think time', desc: 'How long Watch and Learn thinks before it acts.', opts: THINK_STEPS.map((s) => `${s}s`) },
];
// Settings rows for the current state: the Purchases row is hidden in the web demo (nothing can be bought there).
export const settingsRows = (s) => {
  if (s.demo) return SETTINGS;
  const msg = s.restoreMsg || (s.owned ? 'Thank you for playing.' : 'Restore the full game if you bought it before.');
  return [...SETTINGS, { id: 'restore', label: s.owned ? 'Full game unlocked' : 'Restore purchase', desc: msg, opts: [s.owned ? 'Unlocked' : s.restoreBusy ? 'Checking...' : 'Restore'] }];
};
export const settingValue = (s, id) => {
  if (id === 'sound') return s.prefs.sound ? 0 : 1;
  if (id === 'ring') return s.prefs.ring ? 0 : 1;
  if (id === 'calm') return s.prefs.calm ? 1 : 0;
  if (id === 'think') return s.prefs.thinkIdx;
  return -1;
};

const flashK = (s, id) => (s.flash && s.flash.id === id ? 1 - s.flash.t / 0.25 : 0);
const TAU = Math.PI * 2;

export function render(ctx, s, view) {
  const w = view.width, h = view.height, sc = s.scene;
  ctx.clearRect(0, 0, w, h);
  if (sc === 'play') drawPlay(ctx, s, w, h);
  else if (sc === 'title') drawTitle(ctx, s, w, h);
  else if (sc === 'shifts') drawShifts(ctx, s, w, h);
  else if (sc === 'doc') drawDoc(ctx, s, w, h);
  else if (sc === 'settings') drawSettings(ctx, s, w, h);
  else if (sc === 'over') drawOver(ctx, s, w, h);
  else if (sc === 'demo-limit') drawDemoLimit(ctx, s, w, h);
  else background(ctx, w, h, s.t);
}

// ---- play -----------------------------------------------------------------------------------------------------------------------
export const toolIds = (spec) => ['ladle', ...spec.fills.map((f) => 'f:' + f), 'picks', 'flame', 'hint'];

function toolButton(ctx, s, r, id, active, flash, pulse) {
  ctx.save();
  if (v3.on) v3.buttons.push({ layer: v3.layer, r, on: active, flash, radius: 16, tool: true, pulse });
  else {
    rr(ctx, r.x, r.y, r.w, r.h, 16);
    ctx.fillStyle = active ? 'rgba(242,169,59,0.24)' : T.btn; ctx.fill();
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${0.25 * flash})`; ctx.fill(); }
    ctx.lineWidth = active ? 3 : 1.5; ctx.strokeStyle = active ? T.accent : T.line; ctx.stroke();
    if (pulse) { ctx.strokeStyle = `rgba(139,224,138,${0.5 + 0.4 * Math.sin(s.t * 8)})`; ctx.lineWidth = 4; rr(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 18); ctx.stroke(); }
  }
  const iy = r.y + r.h * 0.42, isz = Math.min(r.h * 0.5, r.w * 0.5), col = active ? T.accent : T.text;
  let label = '';
  if (id === 'ladle') { icons.ladle(ctx, r.x + r.w / 2, iy, isz, col); label = 'Ladle'; }
  else if (id === 'picks') { icons.picks(ctx, r.x + r.w / 2, iy, isz, col); label = 'Picks'; }
  else if (id === 'hint') { icons.bulb(ctx, r.x + r.w / 2, iy, isz, '#ffd45a'); label = 'Think'; }
  else if (id === 'flame') {
    const lv = s.sim ? s.sim.flame : 1, fc = ['#ffb24a', '#ff8a2a', '#ff4a2a'][lv];
    icons.flame(ctx, r.x + r.w / 2, iy, isz * (0.8 + 0.2 * lv), fc); label = FLAMES[lv].name;
  } else if (id.startsWith('f:')) { fillingIcon(ctx, id.slice(2), r.x + r.w / 2, iy, isz * 1.05); label = FILLINGS[id.slice(2)].name.split(' ')[0]; }
  txt(ctx, label, r.x + r.w / 2, r.y + r.h - Math.max(14, r.h * 0.2), { size: F(18), weight: 700, color: active ? T.accent : T.dim, align: 'center', maxW: r.w - 8 });
  ctx.restore();
}

function drawFx(ctx, s) {
  for (const p of s.fx.parts) { const a = clamp(1 - p.t / p.life, 0, 1); ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + a * 0.5), 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  for (const f of s.fx.floats) {
    const a = clamp(1 - f.t / f.life, 0, 1), y = f.y - f.t * 46;
    ctx.globalAlpha = Math.min(1, a * 2);
    txt(ctx, f.text, f.x, y, { size: f.size, weight: 800, color: f.color, align: 'center', fam: NUM, shadow: true });
  }
  ctx.globalAlpha = 1;
}

function coachText(s) {
  if (s.auto.on) {
    const h = s.hint;
    if (s.auto.done) return { a: 'Shift complete. Well cooked.', b: 'Press Exit to go back.' };
    if (!h) return { a: 'Watching the plate...', b: 'The game is deciding what needs doing first.' };
    return { a: h.text, b: s.auto.phase === 'think' ? `Thinking... ${Math.ceil(s.auto.timer)}s` : h.why };
  }
  if (s.hint) return { a: s.hint.text, b: s.hint.why };
  return null;
}

function drawBanner(ctx, s, L) {
  const b = L.banner;
  let line = null, sub = '', col = T.text;
  const c = coachText(s);
  if (s.msg) { line = s.msg.text; col = T.accent; }
  else if (c && !s.auto.on) { line = c.a; sub = c.b; col = '#ffd45a'; }
  else if (s.auto.on && c) { line = c.a; sub = c.b; col = '#ffd45a'; }
  else {
    const t = s.tool;
    line = t === 'ladle' ? 'Ladle: tap or hold a mould to pour, drag to pour a row.' : t === 'picks' ? 'Picks: tap a ball to flip it, or to pack it when it glows.' : `${FILLINGS[t.slice(2)].name}: tap or drag over fresh batter.`;
    col = T.dim;
  }
  slab(ctx, b, { radius: 16, fill: 'rgba(0,0,0,0.32)', line: s.auto.on || s.hint ? 'rgba(255,212,90,0.5)' : T.line, kind: 'banner', hot: !!(s.auto.on || s.hint) });
  const pad = 14, tw = b.w - 2 * pad;
  const wrapFit = (str, size, weight) => { setW(ctx, size, UI, weight); return ctx.measureText(str).width <= tw; };
  const longLine = !wrapFit(line, F(22), sub ? 800 : 600) && line.includes(' ');
  if (longLine) {   // too long for one line at a readable size: two lines instead of an ellipsis (the 'why' line yields)
    const words = line.split(' '); let best = 1, bw = 1e9;
    for (let i = 1; i < words.length; i++) { const a = words.slice(0, i).join(' '), c = words.slice(i).join(' '); setW(ctx, F(22), UI, 700); const m = Math.max(ctx.measureText(a).width, ctx.measureText(c).width); if (m < bw) { bw = m; best = i; } }
    txt(ctx, words.slice(0, best).join(' '), b.x + pad, b.y + b.h * 0.3, { size: F(22), weight: 700, color: col, maxW: tw });
    txt(ctx, words.slice(best).join(' '), b.x + pad, b.y + b.h * 0.72, { size: F(22), weight: 700, color: col, maxW: tw });
  } else if (sub) {
    txt(ctx, line, b.x + pad, b.y + b.h * 0.34, { size: F(25), weight: 800, color: col, maxW: tw });
    txt(ctx, sub, b.x + pad, b.y + b.h * 0.74, { size: F(20), weight: 500, color: T.dim, maxW: tw });
  } else txt(ctx, line, b.x + pad, b.y + b.h / 2, { size: F(24), weight: 600, color: col, maxW: tw });
}

function drawHud(ctx, s, L, spec) {
  const sim = s.sim, tt = L.hud.title;
  txt(ctx, spec.name, tt.x, tt.y + 24, { size: F(36), weight: 800, color: T.text, fam: NUM, maxW: tt.w, shadow: true });
  const left = spec.endless ? `${Math.ceil(sim.rushLeft)}s` : `Ticket ${Math.min(spec.tickets.length, spec.tickets.length - sim.queue.length)} of ${spec.tickets.length}`;
  let x = tt.x;
  txt(ctx, sim.score.toLocaleString('en-US'), x, tt.y + 58, { size: F(30), weight: 800, color: T.accent, fam: NUM });
  setW(ctx, 30, NUM, 800); x += ctx.measureText(sim.score.toLocaleString('en-US')).width + 16;
  txt(ctx, left, x, tt.y + 58, { size: F(22), weight: 600, color: T.dim, maxW: Math.max(40, tt.w - (x - tt.x) - 90) });
  if (!spec.endless) drawHearts(ctx, Math.min(tt.x + tt.w - K.HEARTS * 32, Math.max(x + 150, tt.x + tt.w - K.HEARTS * 32)), tt.y + 24, 26, sim.hearts, K.HEARTS);
  if (!s.auto.on) {
    const r = L.pause;
    if (v3.on) v3.buttons.push({ layer: v3.layer, r, radius: 18, flash: flashK(s, 'pause') });
    else { rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fillStyle = T.btn; ctx.fill(); ctx.strokeStyle = T.line; ctx.lineWidth = 1.5; ctx.stroke(); }
    icons.pause(ctx, r.x + r.w / 2, r.y + r.h / 2, 38, T.text);
  }
}
function setW(ctx, size, fam, weight) { ctx.font = `${weight} ${size}px ${fam}`; }

function drawPourFx(ctx, s, geo) {
  const p = s.pourFx;
  if (!p || p.age > 0.2) return;
  const c = geo.cell(p.i), a = 1 - p.age / 0.2;
  ctx.save(); ctx.globalAlpha = a;
  const top = c.cy - c.r * 2.0;
  const g = ctx.createLinearGradient(0, top, 0, c.cy);
  g.addColorStop(0, '#f7ecc9'); g.addColorStop(1, '#ead49a');
  ctx.strokeStyle = g; ctx.lineWidth = Math.max(5, c.r * 0.16); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(c.cx + c.r * 0.05, top + c.r * 0.5); ctx.lineTo(c.cx + c.r * 0.02, c.cy - c.r * 0.2); ctx.stroke();
  ctx.fillStyle = '#9aa0a8'; ctx.beginPath(); ctx.ellipse(c.cx + c.r * 0.35, top + c.r * 0.35, c.r * 0.5, c.r * 0.3, -0.5, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#6a7078'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(c.cx + c.r * 0.65, top + c.r * 0.15); ctx.lineTo(c.cx + c.r * 1.5, top - c.r * 0.5); ctx.stroke();
  ctx.restore();
}

function drawPlay(ctx, s, w, h) {
  const sim = s.sim, spec = sim.spec;
  const ids = toolIds(spec), L = playLayout(w, h, { ids, auto: s.auto.on });
  background(ctx, w, h, s.t);
  drawAwning(ctx, w, host.t, s.t);
  if (v3.on && s.paused) ctx.globalAlpha = 0.28;   // the 3D scrim dims the lit scene; the 2D text under it dims here
  drawHud(ctx, s, L, spec);
  // tickets
  const shown = [null, null, null];
  for (const c of sim.customers) if (c.slot >= 0 && c.slot < 3) shown[c.slot] = c;
  for (let i = 0; i < 3; i++) drawTicket(ctx, L.tickets[i], shown[i], L.ticketMode, s.t, sim);
  drawBanner(ctx, s, L);
  // plate
  const geo = plateGeo(L.area, sim.cols, sim.rows, true);
  if (v3.on) v3.plate = { area: L.area, cols: sim.cols, rows: sim.rows };
  else drawPlate(ctx, geo, sim, s.t, sim.flame);
  const target = s.hint && s.hint.action ? new Set(s.hint.action.cells ?? [s.hint.action.i]) : null;
  for (let i = 0; i < sim.plate.length; i++) {
    const m = sim.plate[i], c = geo.cell(i);
    if (m.st === 'empty' && target && target.has(i)) { ctx.save(); ctx.strokeStyle = `rgba(255,212,90,${0.5 + 0.4 * Math.sin(s.t * 8)})`; ctx.lineWidth = 4; ctx.setLineDash([9, 8]); ctx.beginPath(); ctx.arc(c.cx, c.cy, c.c * 0.44, 0, TAU); ctx.stroke(); ctx.restore(); }
    drawBall(ctx, c, m, s.t, { ring: s.prefs.ring, sel: target && target.has(i) && m.st !== 'empty', live: true });
    // keyboard cursor
    if (s.kbd && s.cursor === i) { ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; rr(ctx, c.cx - c.c * 0.46, c.cy - c.c * 0.46, c.c * 0.92, c.c * 0.92, 14); ctx.stroke(); ctx.restore(); }
  }
  for (let i = 0; i < sim.plate.length; i++) drawSteam(ctx, geo.cell(i), sim.plate[i], s.t);
  if (!v3.on) drawPourFx(ctx, s, geo);
  drawFx(ctx, s);
  drawTray(ctx, L.tray, sim, s.t);
  // tools or the Watch and Learn rail
  if (s.auto.on) drawRail(ctx, s, L);
  else {
    const pulse = s.hint && s.hint.tool;
    for (const id of ids) toolButton(ctx, s, L.tools[id], id, id === s.tool, flashK(s, 'tool:' + id), pulse === id);
  }
  ctx.globalAlpha = 1;
  if (s.paused) drawPaused(ctx, s, L, w, h);
  if (s.sim.done && s.endT < 1.8) drawEndBanner(ctx, s, w, h);
}

function drawEndBanner(ctx, s, w, h) {
  const o = s.sim.outcome, a = clamp(s.endT / 0.3, 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  const word = o.why === 'closed' ? 'Stall closed' : o.why === 'time' ? "Time's up" : 'All served';
  const c = centerCard(w, h, 520, 150);
  slab(ctx, c, { radius: 24, fill: 'rgba(15,8,5,0.82)', line: T.accent, lineWidth: 3, kind: 'sign' });
  txt(ctx, word, c.x + c.w / 2, c.y + c.h / 2, { size: F(64), weight: 800, color: T.accent, align: 'center', fam: NUM, maxW: c.w - 30 });
  ctx.restore();
}

function drawRail(ctx, s, L) {
  const r = L.rail, a = s.auto;
  button(ctx, r.exit, 'Exit', { icon: 'exit', size: 24, flash: flashK(s, 'aexit') });
  button(ctx, r.pause, a.paused ? 'Resume' : 'Pause', { icon: a.paused ? 'play' : 'pause', size: 24, kind: a.paused ? 'accent' : 'solid', flash: flashK(s, 'apause') });
  button(ctx, r.dec, 'Think -', { size: 22, disabled: s.prefs.thinkIdx === 0, flash: flashK(s, 'adec'), sub: `${THINK_STEPS[s.prefs.thinkIdx]}s` });
  button(ctx, r.inc, 'Think +', { size: 22, disabled: s.prefs.thinkIdx === THINK_STEPS.length - 1, flash: flashK(s, 'ainc'), sub: `${THINK_STEPS[s.prefs.thinkIdx]}s` });
  if (L.railInfo && L.railInfo.h > 40) {
    const q = L.railInfo;
    txt(ctx, a.paused ? 'Paused' : a.phase === 'think' ? 'Thinking' : a.phase === 'reveal' ? 'Showing' : 'Cooking', q.x + 4, q.y + 18, { size: F(22), weight: 800, color: '#ffd45a', fam: NUM });
  }
}

function drawPaused(ctx, s, L, w, h) {
  if (v3.on) { v3.scrim = 0.72; v3.layer = 1; } else { ctx.fillStyle = 'rgba(8,4,3,0.72)'; ctx.fillRect(0, 0, w, h); }
  const P = pauseLayout(w, h, { x: L.U.x0, y: L.U.y0, w: L.U.w, h: L.U.h });
  panel(ctx, P.card, { radius: 24, fill: '#1f1310', line: T.line });
  txt(ctx, 'Paused', P.card.x + P.card.w / 2, P.card.y + 38, { size: F(44), weight: 800, align: 'center', fam: NUM });
  button(ctx, P.resume, 'Resume', { kind: 'accent', icon: 'play', flash: flashK(s, 'resume') });
  button(ctx, P.restart, 'Restart shift', { flash: flashK(s, 'restart') });
  button(ctx, P.settings, 'Settings', { icon: 'gear', flash: flashK(s, 'psettings') });
  button(ctx, P.menu, 'Leave shift', { flash: flashK(s, 'pmenu') });
}

// ---- headers and scrolling body ------------------------------------------------------------------------------------------------------
function header(ctx, s, P, title, sub = '') {
  panel(ctx, { x: P.header.x - 6, y: P.header.y - 2, w: P.header.w + 12, h: P.header.h + 6 }, { radius: 20 });
  txt(ctx, title, P.titleX, P.header.y + (sub ? 26 : 35), { size: F(42), weight: 800, fam: NUM, maxW: P.textDec.x - P.titleX - 12, shadow: true });
  if (sub) txt(ctx, sub, P.titleX, P.header.y + 58, { size: F(22), weight: 500, color: T.dim, maxW: P.textDec.x - P.titleX - 12 });
}
function zoomButtons(ctx, s, P) {
  const sc = TEXT_SCALES[s.prefs.textIdx];
  button(ctx, P.textDec, 'A-', { size: 26, disabled: s.prefs.textIdx === 0, flash: flashK(s, 'tdec') });
  button(ctx, P.textInc, 'A+', { size: 26, disabled: s.prefs.textIdx === TEXT_SCALES.length - 1, flash: flashK(s, 'tinc') });
  txt(ctx, `${Math.round(sc * 100)}%`, P.textDec.x - 8, P.textDec.y + P.textDec.h / 2, { size: F(20), weight: 600, color: T.dim, align: 'right' });
}
function scrollBody(ctx, s, rect, draw) {
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x - 4, rect.y, rect.w + 8, rect.h); ctx.clip();
  ctx.translate(0, -s.scrollY);
  v3.clip = rect; v3.sy = s.scrollY;
  const contentH = draw();
  v3.clip = null; v3.sy = 0;
  ctx.restore();
  metrics.rect = rect; metrics.view = rect.h; metrics.max = Math.max(0, contentH - rect.h + 10);
  if (metrics.max > 0) {
    const th = Math.max(36, rect.h * rect.h / (contentH + 10)), ty = rect.y + (rect.h - th) * (s.scrollY / metrics.max);
    rr(ctx, rect.x + rect.w + 2, ty, 4, th, 2); ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fill();
  }
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------
function heroBalls(ctx, rect, t, s) {
  const cols = 3, rows = 2, geo = plateGeo(rect, cols, rows);
  const fake = { plate: [], cols, rows, flame: 1 };
  for (let i = 0; i < cols * rows; i++) {
    const ph = (t * 0.16 + i * 0.37) % 4;                     // 0..4 quarters
    const b = Math.floor(ph) % 4, f = ph - Math.floor(ph);
    const q = [0, 0, 0, 0];
    for (let k = 0; k < 4; k++) q[k] = clamp(0.05 + ((ph - k + 8) % 4) * 0.28, 0.05, 1.0);
    q[b] = clamp(0.1 + f * 0.8, 0, 1.0);
    const m = demoMould(i, q, b, f < 0.12 ? f * 2.8 : 9); m.hs = i === 4 ? 1.3 : 1.0;
    m.fil = i === 1 ? 'cheese' : i === 4 ? 'corn' : null;
    fake.plate.push(m);
  }
  drawPlate(ctx, geo, fake, t, 1);
  for (let i = 0; i < fake.plate.length; i++) drawBall(ctx, geo.cell(i), fake.plate[i], t, { ring: false });
  for (let i = 0; i < fake.plate.length; i++) drawSteam(ctx, geo.cell(i), fake.plate[i], t);
}
function drawTitle(ctx, s, w, h) {
  const T0 = titleLayout(w, h);
  background(ctx, w, h, s.t);
  drawAwning(ctx, w, host.t, s.t);
  const { H, cx, big, ty, plateTop } = titleArt(w, h);
  // title lettering
  ctx.save();
  ctx.font = `800 ${big}px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw = Math.min(H.w - 20, ctx.measureText('TAKOYAKI').width);
  const g = ctx.createLinearGradient(cx - tw / 2, 0, cx + tw / 2, 0);
  g.addColorStop(0, '#ffd980'); g.addColorStop(0.5, '#f5a734'); g.addColorStop(1, '#e2562a');
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText('TAKOYAKI', cx, ty + 5, H.w - 20);
  ctx.fillStyle = g; ctx.fillText('TAKOYAKI', cx, ty, H.w - 20);
  ctx.restore();
  txt(ctx, 'FLIP STALL', cx, ty + big * 0.62, { size: big * 0.46, weight: 800, color: T.text, align: 'center', fam: NUM, maxW: H.w - 20, shadow: true });
  if (!v3.on) heroBalls(ctx, { x: H.x, y: plateTop, w: H.w, h: Math.max(80, H.y + H.h - plateTop) }, s.t, s);
  // buttons
  const B = T0.buttons;
  const best = s.stats.rush ? `Best ${s.stats.rush.toLocaleString('en-US')}` : '90 seconds, score only';
  const done = totalStars(s);
  button(ctx, B.journey, 'Journey', { kind: 'accent', size: 36, sub: T0.subs ? `${TOTAL_SHIFTS} shifts, ${done} of ${TOTAL_SHIFTS * 3} stars` : '', flash: flashK(s, 'journey') });
  button(ctx, B.rush, 'Rush Hour', { size: 32, sub: T0.subs ? best : '', flash: flashK(s, 'rush') });
  button(ctx, B.daily, 'Daily Shift', { size: 32, sub: T0.subs ? (s.dailyDone ? `Done today. Streak ${s.streak}` : s.streak ? `Streak ${s.streak}: keep it going` : 'A new shift every day') : '', flash: flashK(s, 'daily') });
  button(ctx, B.learn, 'Watch and Learn', { size: 30, icon: 'eye', sub: T0.subs ? 'The game cooks and explains' : '', flash: flashK(s, 'learn') });
  button(ctx, B.howto, 'How to Play', { size: 25, flash: flashK(s, 'howto') });
  button(ctx, B.rules, 'Rules', { size: 25, flash: flashK(s, 'rules') });
  button(ctx, B.about, 'About', { size: 25, flash: flashK(s, 'about') });
  button(ctx, B.settings, 'Settings', { size: 25, flash: flashK(s, 'settings') });
  drawCredit(ctx, T0.brand.x, T0.brand.y, 15);
  if (s.msg) drawToast(ctx, s, w, h);
}
export const totalStars = (s) => Object.values(s.progress).reduce((a, p) => a + (p.stars | 0), 0);
function drawToast(ctx, s, w, h) {
  const t = s.msg.text, y = h - 120;
  ctx.font = `700 24px ${UI}`; const tw = Math.min(w - 40, ctx.measureText(t).width + 40);
  rr(ctx, w / 2 - tw / 2, y, tw, 52, 26); ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fill();
  txt(ctx, t, w / 2, y + 26, { size: 24, weight: 700, color: T.text, align: 'center', maxW: tw - 30 });
}

// ---- shift map ----------------------------------------------------------------------------------------------------------------------------
export function shiftIndex(ci, i) { return ci * SHIFTS_PER_STALL + i; }
function drawShifts(ctx, s, w, h) {
  const P = listLayout(w, h), sc = TEXT_SCALES[s.prefs.textIdx];
  background(ctx, w, h, s.t);
  header(ctx, s, P, 'Choose a shift', `${totalStars(s)} of ${TOTAL_SHIFTS * 3} stars`);
  zoomButtons(ctx, s, P);
  scrollBody(ctx, s, P.body, () => {
    const J = shiftRects(P.body, sc, shiftHeads(STALLS, P.body.w, sc));
    J.items.forEach((it) => {
      const st = STALLS[it.ci];
      const stars = Array.from({ length: SHIFTS_PER_STALL }, (_, i) => s.progress[shiftIndex(it.ci, i)]?.stars | 0).reduce((a, b) => a + b, 0);
      panel(ctx, it.head, { radius: 18, fill: 'rgba(214,64,47,0.18)', line: 'rgba(214,64,47,0.5)' });
      const nameS = F(36 * Math.min(sc, 1.5));
      txt(ctx, st.name, it.head.x + 18, it.head.y + 18 + nameS * 0.6, { size: nameS, weight: 800, fam: NUM, maxW: it.head.w - 140 * Math.min(sc, 1.4) });
      para(ctx, st.blurb, it.head.x + 18, it.head.y + 18 + nameS * 1.2 + 6, it.head.w - 36, { size: F(21 * Math.min(sc, 1.5)), weight: 500, color: T.dim });
      txt(ctx, `${stars}/${SHIFTS_PER_STALL * 3}`, it.head.x + it.head.w - 18, it.head.y + 18 + F(36 * Math.min(sc, 1.5)) * 0.6, { size: F(26), weight: 800, color: T.accent, align: 'right', fam: NUM });
      it.lv.forEach((r, i) => {
        const g = shiftIndex(it.ci, i), p = s.progress[g], locked = g > s.open, cur = !p && !locked;
        slab(ctx, r, { radius: 16, fill: locked ? 'rgba(255,255,255,0.04)' : cur ? 'rgba(242,169,59,0.2)' : T.btn, line: cur ? T.accent : T.line, lineWidth: cur ? 3 : 1.5, kind: locked ? 'tileLocked' : cur ? 'tileCur' : 'tile' });
        ctx.globalAlpha = locked ? 0.4 : 1;
        txt(ctx, String(i + 1), r.x + r.w / 2, r.y + r.h * 0.4, { size: F(r.h * 0.48), weight: 800, align: 'center', fam: NUM });
        for (let k = 0; k < 3; k++) icons.star(ctx, r.x + r.w / 2 + (k - 1) * r.w * 0.24, r.y + r.h * 0.78, r.w * 0.2, k < (p?.stars | 0) ? '#ffd45a' : 'rgba(255,255,255,0.2)');
        ctx.globalAlpha = 1;
      });
    });
    return J.contentH;
  });
  button(ctx, P.back, 'Menu', { size: 28, icon: 'back', flash: flashK(s, 'back') });
  if (s.msg) drawToast(ctx, s, w, h);
}

// ---- documents (How to Play, Rules, About) -------------------------------------------------------------------------------------------
function figure(ctx, kind, r, s) {
  ctx.save();
  panel(ctx, r, { radius: 20, fill: 'rgba(0,0,0,0.28)', line: T.line });
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, u = Math.min(r.w, r.h * 1.7);
  const fitImg = (img, box) => { const k = Math.min(box.w / img.width, box.h / img.height), w = img.width * k, h = img.height * k; ctx.drawImage(img, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h); };
  if (sprites.ready && v3.on && kind === 'plate') fitImg(sprites.plate, { x: r.x + 8, y: r.y + 8, w: r.w - 16, h: r.h - 16 });
  else if (sprites.ready && v3.on && kind === 'boat') fitImg(sprites.boat, { x: r.x + 8, y: r.y + 8, w: r.w - 16, h: r.h - 16 });
  else if (sprites.ready && v3.on && (kind === 'ball' || kind === 'ring')) {
    const rad = Math.min(r.h * 0.34, r.w * (kind === 'ball' ? 0.2 : 0.24)), bx = r.x + r.w * (kind === 'ball' ? 0.28 : 0.3);
    fitImg(sprites[kind], { x: bx - rad * 1.45, y: cy - rad * 1.45, w: rad * 2.9, h: rad * 2.9 });
    if (kind === 'ring') drawRing(ctx, bx, cy, rad * 1.15, demoMould(0, [0.84, 0.3, 0.1, 0.4], 0, 9), s.t);
    if (kind === 'ball') {
      const labels = [['On the iron: cooks', 0.95], ['Side: cooks slowly', 0.55], ['On top: barely', 0.12], ['Side: cooks slowly', 0.32]];
      labels.forEach(([lab, q], i) => {
        const y = r.y + r.h * (0.2 + i * 0.2), x = r.x + r.w * 0.52;
        ctx.fillStyle = cookColor(q); rr(ctx, x, y - 14, 34, 28, 6); ctx.fill();
        txt(ctx, lab, x + 46, y, { size: F(19), weight: 600, color: T.text, maxW: r.x + r.w - x - 56 });
      });
    } else {
      const zs = [['Raw', '#7e9bc4'], ['Setting', '#e9b34c'], ['Golden: flip', '#8be08a'], ['Toasting', '#ff6a55']];
      zs.forEach(([lab, col], i) => { const y = r.y + r.h * (0.2 + i * 0.2), x = r.x + r.w * 0.56; ctx.fillStyle = col; rr(ctx, x, y - 8, 36, 16, 8); ctx.fill(); txt(ctx, lab, x + 48, y, { size: F(20), weight: 600, maxW: r.x + r.w - x - 58 }); });
    }
  } else if (kind === 'plate') {
    const cols = 3, rows = 2, geo = plateGeo({ x: r.x + 10, y: r.y + 10, w: r.w - 20, h: r.h - 20 }, cols, rows), plate = [];
    for (let i = 0; i < 6; i++) { const m = demoMould(i, [0.5 + i * 0.12, 0.2, 0.05, 0.1], 0, 9); m.hs = i === 4 ? 1.3 : 1; m.flips = 0; m.fill = i === 5 ? 0 : 0.95; if (i === 5) m.st = 'empty'; if (i === 1) m.fil = 'cheese'; plate.push(m); }
    drawPlate(ctx, geo, { plate }, s.t, 1);
    plate.forEach((m, i) => drawBall(ctx, geo.cell(i), m, s.t, { ring: false }));
  } else if (kind === 'ball') {
    const m = demoMould(0, [0.95, 0.55, 0.12, 0.32], 3, 9), rad = Math.min(r.h * 0.34, r.w * 0.2);
    drawBall(ctx, { cx: r.x + r.w * 0.28, cy, r: rad * 1.0 }, m, s.t, { ring: true });
    const labels = [['On the iron: cooks', 0.95], ['Side: cooks slowly', 0.55], ['On top: barely', 0.12], ['Side: cooks slowly', 0.32]];
    labels.forEach(([lab, q], i) => {
      const y = r.y + r.h * (0.2 + i * 0.2), x = r.x + r.w * 0.52;
      ctx.fillStyle = cookColor(q); rr(ctx, x, y - 14, 34, 28, 6); ctx.fill();
      txt(ctx, lab, x + 46, y, { size: F(19), weight: 600, color: T.text, maxW: r.x + r.w - x - 56 });
    });
  } else if (kind === 'ring') {
    const rad = Math.min(r.h * 0.34, r.w * 0.24), m = demoMould(0, [0.84, 0.3, 0.1, 0.4], 0, 9);
    drawBall(ctx, { cx: r.x + r.w * 0.3, cy, r: rad }, m, s.t, { ring: true });
    const zs = [['Raw', '#7e9bc4'], ['Setting', '#e9b34c'], ['Golden: flip', '#8be08a'], ['Toasting', '#ff6a55']];
    zs.forEach(([lab, col], i) => { const y = r.y + r.h * (0.2 + i * 0.2), x = r.x + r.w * 0.56; ctx.fillStyle = col; rr(ctx, x, y - 8, 36, 16, 8); ctx.fill(); txt(ctx, lab, x + 48, y, { size: F(20), weight: 600, maxW: r.x + r.w - x - 58 }); });
  } else if (kind === 'ticket') {
    const fake = { id: 1, no: 7, lines: [{ fil: 'cheese', need: 3, got: 1 }, { fil: null, need: 2, got: 0 }], patMax: 60, pat: 40, st: 'wait', born: -5, exit: 0 };
    const tw = Math.min(r.w - 30, 300), th = Math.min(r.h - 30, 190);
    drawTicket(ctx, { x: cx - tw / 2, y: cy - th / 2, w: tw, h: th }, fake, 'card', s.t, { t: 0 });
  } else if (kind === 'boat') {
    drawBoat(ctx, { x: r.x + 10, y: r.y + 10, w: r.w - 20, h: r.h - 20 }, s.t, 6, 3);
  } else if (kind === 'flame') {
    FLAMES.forEach((f, i) => {
      const x = r.x + r.w * (0.2 + i * 0.3), col = ['#ffb24a', '#ff8a2a', '#ff4a2a'][i];
      icons.flame(ctx, x, cy - 6, Math.min(r.h * 0.5, r.w * 0.22) * (0.8 + 0.2 * i), col);
      txt(ctx, f.name, x, cy + r.h * 0.3, { size: F(21), weight: 700, align: 'center', maxW: r.w * 0.28 });
    });
  }
  ctx.restore();
  void u;
}
function drawDoc(ctx, s, w, h) {
  const L = docLayout(w, h), doc = DOCS[s.doc.kind], page = doc.pages[s.doc.page], sc = TEXT_SCALES[s.prefs.textIdx];
  background(ctx, w, h, s.t);
  header(ctx, s, L, doc.title, `Page ${s.doc.page + 1} of ${doc.pages.length}`);
  zoomButtons(ctx, s, L);
  panel(ctx, { x: L.text.x - 10, y: L.text.y - 4, w: L.text.w + 20, h: L.text.h + 8 }, { radius: 20 });
  if (L.split && page.fig) figure(ctx, page.fig, L.fig, s);
  scrollBody(ctx, s, L.text, () => {
    const x = L.text.x, wd = L.text.w;
    let y = L.text.y + 4;
    if (!L.split && page.fig) { const fh = clamp(wd * 0.5, 170, 300); figure(ctx, page.fig, { x, y, w: wd, h: fh }, s); y += fh + 18; }
    y += para(ctx, page.title, x, y, wd, { size: 40 * sc, weight: 800, color: T.accent, fam: NUM, lh: 1.15 }) + 10 * sc;
    for (const b of page.body) {
      if (b.p) y += para(ctx, b.p, x, y, wd, { size: 26 * sc, weight: 500, color: T.text, lh: 1.34 }) + 14 * sc;
      if (b.li) for (const li of b.li) {
        const ind = 26 * sc;
        ctx.fillStyle = T.accent; ctx.beginPath(); ctx.arc(x + 8 * sc, y + 14 * sc, 5 * sc, 0, TAU); ctx.fill();
        y += para(ctx, li, x + ind, y, wd - ind, { size: 26 * sc, weight: 500, color: T.text, lh: 1.34 }) + 10 * sc;
      }
    }
    if (s.doc.kind === 'about' && s.doc.page === 0) {
      y += 6; para(ctx, FACTS[s.doc.fact % FACTS.length], x, y, wd, { size: 22 * sc, weight: 500, color: T.dim }); y += paraHeight(ctx, FACTS[s.doc.fact % FACTS.length], wd, 22 * sc, 500) + 10;
    }
    return y - L.text.y + 16;
  });
  const n = doc.pages.length;
  button(ctx, L.menu, 'Menu', { icon: 'back', size: 26, flash: flashK(s, 'back') });
  button(ctx, L.prev, 'Back', { size: 26, disabled: s.doc.page === 0, flash: flashK(s, 'prev') });
  txt(ctx, `${s.doc.page + 1} / ${n}`, L.count.x + L.count.w / 2, L.count.y + L.count.h / 2, { size: F(24), weight: 700, color: T.dim, align: 'center' });
  button(ctx, L.next, 'Next', { kind: s.doc.page < n - 1 ? 'accent' : 'solid', size: 26, disabled: s.doc.page >= n - 1, flash: flashK(s, 'next') });
}

// ---- settings --------------------------------------------------------------------------------------------------------------------------
function drawSettings(ctx, s, w, h) {
  const ROWS = settingsRows(s), sc = TEXT_SCALES[s.prefs.textIdx], L = settingsLayout(w, h, sc, ROWS.length);
  background(ctx, w, h, s.t);
  header(ctx, s, L, 'Settings', 'Text size A- / A+ applies to every text screen');
  zoomButtons(ctx, s, L);
  metrics.rect = L.body; metrics.view = L.body.h; metrics.max = Math.max(0, L.contentH - L.body.h + 10);
  ctx.save(); ctx.beginPath(); ctx.rect(L.body.x - 4, L.body.y, L.body.w + 8, L.body.h); ctx.clip(); ctx.translate(0, -s.scrollY);
  v3.clip = L.body; v3.sy = s.scrollY;
  ROWS.forEach((row, i) => {
    const g = L.rows[i], val = settingValue(s, row.id);
    panel(ctx, g.rect, { radius: 18 });
    const tw = g.stacked ? g.rect.w - 36 : g.ctrl.x - g.rect.x - 28, k2 = Math.min(sc, 1.5);
    if (g.stacked) {
      txt(ctx, row.label, g.rect.x + 18, g.rect.y + 14 + 20 * k2, { size: F(30 * k2), weight: 800, maxW: tw });
      para(ctx, row.desc, g.rect.x + 18, g.rect.y + 22 + 42 * k2, tw, { size: F(19 * k2), weight: 500, color: T.dim, lh: 1.2 });
    } else {
      txt(ctx, row.label, g.rect.x + 18, g.rect.y + g.rect.h * 0.32, { size: F(30 * k2), weight: 800, maxW: tw });
      para(ctx, row.desc, g.rect.x + 18, g.rect.y + g.rect.h * 0.5, tw, { size: F(19 * k2), weight: 500, color: T.dim, lh: 1.2 });
    }
    const n = row.opts.length, cw = (g.ctrl.w - 8 * (n - 1)) / n;
    row.opts.forEach((o, k) => button(ctx, { x: g.ctrl.x + k * (cw + 8), y: g.ctrl.y, w: cw, h: g.ctrl.h }, o, { size: 24 * Math.min(sc, 1.3), active: val === k, flash: flashK(s, 'set' + i + '.' + k), kind: row.id === 'restore' ? 'solid' : 'solid' }));
  });
  v3.clip = null; v3.sy = 0;
  ctx.restore();
  button(ctx, L.back, s.back === 'play' ? 'Back to shift' : 'Menu', { size: 28, icon: 'back', flash: flashK(s, 'back') });
  if (s.msg) drawToast(ctx, s, w, h);
}

// ---- result ----------------------------------------------------------------------------------------------------------------------------
function drawOver(ctx, s, w, h) {
  const O = overLayout(w, h), R0 = s.result;
  background(ctx, w, h, s.t);
  if (!R0) return;
  const A = O.art;
  drawBoat(ctx, { x: A.x, y: A.y + A.h * 0.1, w: A.w, h: A.h * 0.68 }, s.t, clamp(R0.balls, 2, 8), 2);
  // stars
  const starY = A.y + A.h * 0.9, ss = Math.min(86, A.w * 0.18, A.h * 0.26);
  const earned = R0.stars, pop = (i) => clamp((s.sceneT - 0.35 - i * 0.22) / 0.3, 0, 1);
  for (let i = 0; i < 3; i++) {
    const k = pop(i), on = i < earned, x = A.x + A.w / 2 + (i - 1) * ss * 1.15;
    icons.star(ctx, x, starY, ss * (on ? 0.6 + 0.4 * k : 1), on ? `rgba(255,212,90,${0.25 + 0.75 * k})` : 'rgba(255,255,255,0.16)');
  }
  const B = O.body;
  panel(ctx, { x: B.x - 6, y: B.y - 4, w: B.w + 12, h: B.h + 8 }, { radius: 22 });
  let y = B.y + 8;
  const head = R0.kind === 'rush' ? (R0.score > R0.best0 ? 'New best' : "Time's up") : R0.why === 'closed' ? 'Stall closed' : R0.stars === 3 ? 'Perfect shift' : 'Shift complete';
  txt(ctx, head, B.x + B.w / 2, y + 28, { size: F(52), weight: 800, align: 'center', color: R0.why === 'closed' ? T.bad : T.accent, fam: NUM, maxW: B.w });
  y += 70;
  txt(ctx, R0.score.toLocaleString('en-US'), B.x + B.w / 2, y + 26, { size: F(64), weight: 800, align: 'center', fam: NUM });
  y += 66;
  txt(ctx, R0.kind === 'rush' ? `Best ${Math.max(R0.best0, R0.score).toLocaleString('en-US')}` : `Par ${R0.par.toLocaleString('en-US')}`, B.x + B.w / 2, y + 8, { size: F(24), weight: 600, color: T.dim, align: 'center' });
  y += 36;
  const rows = [['Balls served', R0.balls], ['Perfect balls', R0.perfect], ['Best streak', R0.bestStreak], R0.kind === 'rush' ? ['Customers lost', R0.left] : ['Hearts kept', `${R0.hearts} of ${K.HEARTS}`]];
  const cw = B.w / 2;
  rows.forEach(([k, v], i) => {
    const x = B.x + (i % 2) * cw + 8, yy = y + Math.floor(i / 2) * 58;
    txt(ctx, k, x, yy + 12, { size: F(20), weight: 500, color: T.dim, maxW: cw - 16 });
    txt(ctx, String(v), x, yy + 38, { size: F(32), weight: 800, fam: NUM, maxW: cw - 16 });
  });
  y += 128;
  if (y + 20 < B.y + B.h) para(ctx, FACTS[R0.fact % FACTS.length], B.x + 8, y, B.w - 16, { size: F(20), weight: 500, color: T.dim, lh: 1.25 });
  const b = O.btns;
  const nextLabel = R0.kind === 'rush' ? 'Rush again' : R0.kind === 'daily' ? 'Menu' : R0.why === 'closed' ? 'Try again' : R0.next != null ? 'Next shift' : 'Shifts';
  button(ctx, b.next, nextLabel, { kind: 'accent', size: 32, flash: flashK(s, 'next') });
  button(ctx, b.share, 'Share', { size: 26, flash: flashK(s, 'share') });
  button(ctx, b.menu, R0.kind === 'journey' ? 'Shifts' : 'Menu', { size: 26, flash: flashK(s, 'menu') });
  drawMoreLine(ctx, w / 2, Math.min(h - 8, O.F.U.y1 - 4), 15);
  drawFx(ctx, s);
}

function drawDemoLimit(ctx, s, w, h) {
  background(ctx, w, h, s.t);
  const c = centerCard(w, h, 600, 380);
  panel(ctx, c, { radius: 26, fill: '#1f1310' });
  txt(ctx, 'That was the free preview', c.x + c.w / 2, c.y + 70, { size: F(44), weight: 800, align: 'center', fam: NUM, maxW: c.w - 40 });
  para(ctx, 'The web version stops after three shifts. Get the full game on iPhone and Android for every stall, Rush Hour, the Daily Shift and Watch and Learn.', c.x + 30, c.y + 130, c.w - 60, { size: F(26), weight: 500, align: 'center', color: T.dim });
  button(ctx, { x: c.x + 30, y: c.y + c.h - 100, w: c.w - 60, h: 70 }, 'Back to menu', { kind: 'accent', size: 30 });
}

export { fillingIcon, rgba, mix, inRect, drawRing, drawBadgeStack, edgeStroke, grade };
