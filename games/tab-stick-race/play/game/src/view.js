// Everything drawn each frame. Reads state, changes nothing (apart from small caches).
import {
  W, H, DISPLAY, THEMES, themeById, text, rr, panel, button, background, icon, drawParticles, drawPiece, boardGeo, drawBoard, drawFelt, drawStick, drawStickCached, drawStickShadow, drawDust,
  alpha, clamp01, ease, easeIO, backOut, mix,
} from './art.js';
import { TEXT_SCALES, wrap, tw } from './ui.js';
import { HOME, WAIT, N, COLS, SAFE, FLAT_ODDS, FLAT_TO_VALUE, sqOf, cellOf, sideName, isSafe } from './rules.js';
import { LEVELS } from './ai.js';
import { LESSONS, lessonText } from './lessons.js';
import { tr, valueName } from './content.js';
import { BACK_BTN, PAUSE_BTN, TOOLBAR_IDS, autoLayout, DOC_PANEL, NAV_PREV, NAV_NEXT, playLayout } from './layout.js';
import { THINK_STEPS, AUTO_SPEEDS, lvName, piecesLabel } from './screens.js';
import { humanTurn, movesOf, canThrow, canUndo, isHumanSide } from './match.js';
import { planThrow, stickPose, restPose } from './sticks.js';

const theme = (S) => themeById(S.themeId);
const T = (S, k, v) => tr(k, v, S.lang);
const STEP = 1 / 60;
// Display time of a clocked animation: the simulation is one step ahead of what is drawn, and the drawn time is interpolated
// between steps with S.alpha (0..1), so motion is smooth on 60 and 120 Hz screens.
export const vis = (S, a) => Math.max(0, a.t - (1 - (S.alpha ?? 1)) * STEP * (S.pace ?? 1));

// Largest text size (<= start) whose wrapped lines fit w x h. Used by every HUD text so zoom never overflows.
export function fitText(str, w, h, start, min = 18, lh = 1.28) {
  let size = start;
  for (; size > min; size -= 2) {
    const lines = wrap(str, size, w);
    if (lines.length * size * lh <= h) return { lines, size, line: size * lh };
  }
  const lines = wrap(str, min, w);
  return { lines, size: min, line: min * lh };
}
const fitOne = (str, w, start, min = 16) => { let s = start; while (s > min && tw(str, s) > w) s -= 1; return s; };
const acc = (th) => (th.accent.length === 7 ? th.accent : '#e8c46a');
const pulse = (S, rate = 5) => 0.5 + 0.5 * Math.sin(S.t * rate);

// ----------------------------------------------------------------------------------------- documents
function drawDocBlocks(ctx, S, ui, scroll) {
  const th = theme(S);
  const { region, layout } = ui;
  ctx.save();
  rr(ctx, region.x - 6, region.y - 4, region.w + 12, region.h + 8, 18);
  ctx.clip();
  const ox = region.x, oy = region.y - scroll + (ui.offY || 0);
  for (const it of layout.items) {
    const b = it.b;
    const top = oy + it.y;
    if (top > region.y + region.h + 20 || top + it.h < region.y - 20) continue;
    if (b.t === 'h') {
      for (let i = 0; i < it.lines.length; i++) text(ctx, it.lines[i], ox + it.w / 2, top + i * it.line + it.size, it.size, th.accent, { font: DISPLAY, weight: 800 });
    } else if (b.t === 'p') {
      const center = b.center || b.align === 'center';
      const right = ui.rtl && !center;
      for (let i = 0; i < it.lines.length; i++) {
        text(ctx, it.lines[i], center ? ox + it.w / 2 : right ? ox + it.w : ox, top + i * it.line + it.size * 0.98, it.size, 'rgba(246,236,214,0.93)', { weight: 500, align: center ? 'center' : right ? 'right' : 'left' });
      }
    } else if (b.t === 'img') {
      drawArt(ctx, S, b.name, ox, top, it.w, b.h, b);
    } else if (b.t === 'btn') {
      const bt = it.btns[0];
      button(ctx, th, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, it.lines, b.kind ?? 'normal', { size: it.size, line: it.line, sub: it.sub, disabled: bt.disabled, pressed: S.press && S.press.id === bt.id && S.press.active });
    } else if (b.t === 'row') {
      for (const bt of it.btns) {
        if (bt.id == null) text(ctx, bt.label, ox + bt.x + bt.w / 2, oy + bt.y + bt.h / 2 + it.size * 0.34, it.size, th.ink, { weight: 700 });
        else button(ctx, th, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, bt.lines, bt.kind ?? 'normal', { size: it.size, line: it.line, disabled: bt.disabled, pressed: S.press && S.press.id === bt.id && S.press.active });
      }
    }
  }
  ctx.restore();
  if (layout.height > region.h) {
    const track = region.h - 8, tH = Math.max(48, (region.h / layout.height) * track);
    const ty = region.y + 4 + (scroll / (layout.height - region.h)) * (track - tH);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    rr(ctx, region.x + region.w + 8, region.y + 4, 6, track, 3); ctx.fill();
    ctx.fillStyle = alpha(acc(th), 0.75);
    rr(ctx, region.x + region.w + 8, ty, 6, tH, 3); ctx.fill();
  }
}

function drawFixed(ctx, S, list) {
  const th = theme(S);
  for (const f of list) {
    if (f.static) { text(ctx, f.label, f.rect.x + f.rect.w / 2, f.rect.y + f.rect.h / 2 + 10, f.size, 'rgba(246,236,214,0.8)', { weight: 700 }); continue; }
    const pressed = S.press && S.press.id === f.id && S.press.active;
    if (f.icon) {
      button(ctx, th, f.rect, [], f.kind, { disabled: f.disabled, pressed });
      icon(ctx, f.icon, f.rect.x + 36, f.rect.y + f.rect.h / 2 + (pressed ? 2 : 0), 30, th.ink);
      text(ctx, f.label, f.rect.x + 62 + (f.rect.w - 72) / 2, f.rect.y + f.rect.h / 2 + f.size * 0.34 + (pressed ? 2 : 0), f.size, th.ink, { weight: 700 });
    } else button(ctx, th, f.rect, f.lines ?? [f.label], f.kind, { size: f.size, line: f.line, disabled: f.disabled, pressed });
  }
}

// ------------------------------------------------------------------------------- small boards for illustrations
// o: { iv: [sq], cl: [sq], hl: [sq], rings: [{sq,color}], path: [[sqFrom, sqTo, label, color]], flip }
function pathPoints(geo, a, b) { const pts = []; for (let q = a; q <= b; q++) pts.push(geo.sqXY(q)); return pts; }
function drawPathArrow(ctx, geo, a, b, color, label, lw) {
  const pts = pathPoints(geo, a, b);
  if (pts.length < 2) return;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([lw * 1.6, lw * 1.4]);
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.setLineDash([]);
  const e = pts[pts.length - 1], q = pts[pts.length - 2], ang = Math.atan2(e[1] - q[1], e[0] - q[0]);
  ctx.fillStyle = color; ctx.translate(e[0], e[1]); ctx.rotate(ang);
  ctx.beginPath(); ctx.moveTo(lw * 2.2, 0); ctx.lineTo(-lw * 1.2, -lw * 1.7); ctx.lineTo(-lw * 1.2, lw * 1.7); ctx.closePath(); ctx.fill();
  ctx.restore();
  if (label) { const m = pts[Math.floor(pts.length / 2)]; ctx.fillStyle = 'rgba(10,6,4,0.85)'; ctx.beginPath(); ctx.arc(m[0], m[1], geo.s * 0.26, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); text(ctx, label, m[0], m[1] + geo.s * 0.1, geo.s * 0.3, '#fff', { weight: 800 }); }
}
export function drawMini(ctx, th, x, y, w, o = {}) {
  const geo = boardGeo(x, y, w, Boolean(o.flip));
  drawBoard(ctx, th, geo, { flat: true });
  for (const sq of o.hl ?? []) { const [cx, cy] = geo.sqXY(sq); ctx.fillStyle = alpha(acc(th), 0.4); rr(ctx, cx - geo.s / 2 + 3, cy - geo.s / 2 + 3, geo.s - 6, geo.s - 6, 8); ctx.fill(); }
  for (const a of o.path ?? []) drawPathArrow(ctx, geo, a[0], a[1], a[3] ?? acc(th), a[2], Math.max(3, geo.s * 0.05));
  for (const sq of o.iv ?? []) { const [cx, cy] = geo.sqXY(sq); drawPiece(ctx, th, 1, cx, cy, geo.d, { noShadow: w < 260 }); }
  for (const sq of o.cl ?? []) { const [cx, cy] = geo.sqXY(sq); drawPiece(ctx, th, 2, cx, cy, geo.d, { noShadow: w < 260 }); }
  for (const r of o.rings ?? []) { const [cx, cy] = geo.sqXY(r.sq); ctx.strokeStyle = r.color; ctx.lineWidth = Math.max(3, geo.s * 0.05); ctx.beginPath(); ctx.arc(cx, cy, geo.d * 0.68, 0, Math.PI * 2); ctx.stroke(); }
  return geo;
}

// A throw laid out at rest: draws four sticks side by side (used by illustrations and the title).
function stickRow(ctx, th, x, y, w, h, flats, yawJit = true) {
  const L = Math.min(h * 0.82, 250), Wd = L * 0.19;
  flats.forEach((f, i) => {
    const px = x + w * (0.5 + (i - 1.5) * 0.22), py = y + h / 2;
    drawStickShadow(ctx, px, py, L, Wd, yawJit ? (i % 2 ? 0.1 : -0.1) : 0, 0);
    drawStick(ctx, th, px, py, L, Wd, yawJit ? (i % 2 ? 0.1 : -0.1) : 0, f ? Math.PI : 0, 0);
  });
}

// ----------------------------------------------------------------------------------- illustrations
const cap = (ctx, str, x, y, size = 22, col = 'rgba(246,236,214,0.82)') => text(ctx, str, x, y, size, col, { weight: 600 });
const RED = '#ff6a5a';

function drawArt(ctx, S, name, x, y, w, h, b) {
  const th = theme(S), lang = S.lang;
  const cx = x + w / 2, cy = y + h / 2, t = S.t;
  const tt = (k, v) => tr(k, v, lang);
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,8,0.5)'; rr(ctx, x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5; rr(ctx, x, y, w, h, 18); ctx.stroke();
  ctx.beginPath(); rr(ctx, x, y, w, h, 18); ctx.clip();
  const bw = (reserve) => Math.min(w - 28, (h - reserve) / 0.6057);
  const mb = (s, bx, by, o) => drawMini(ctx, th, bx, by, s, o);
  const ar = lang === 'ar';
  if (name === 'logo' || name === 'setupart') {
    const s = bw(name === 'logo' ? 24 : 24);
    mb(s, cx - s / 2, y + 12, { iv: [0, 2, 10, 14], cl: [27, 23, 17, 12], path: name === 'logo' ? [[2, 6, '3', acc(th)]] : [] });
  } else if (name === 'sticks') {
    stickRow(ctx, th, x, y, w, h - 54, [true, false, true, false]);
    cap(ctx, ar ? 'مسطّح   مستدير   مسطّح   مستدير' : 'flat    round    flat    round', cx, y + h - 22, 22, th.accent);
  } else if (name === 'throws') {
    const rowH = (h - 20) / 5;
    for (let n = 0; n <= 4; n++) {
      const yy = y + 12 + n * rowH + rowH / 2;
      for (let k = 0; k < 4; k++) { const bx = x + 28 + k * 44; ctx.fillStyle = k < n ? th.stickFlat : mix(th.bark[0], th.bark[1], 0.5); rr(ctx, bx, yy - 15, 30, 30, 8); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      const v = FLAT_TO_VALUE[n];
      text(ctx, `${v}`, x + 236, yy + 12, 34, th.ink, { weight: 800 });
      cap(ctx, ar ? `${FLAT_ODDS[n]} من 16` : `${FLAT_ODDS[n]} in 16`, x + w - 190, yy + 8, 22, 'rgba(246,236,214,0.8)');
      if (v === 1 || v === 4 || v === 6) cap(ctx, ar ? 'ارمِ ثانية' : 'throw again', x + w - 70, yy + 8, 19, th.accent);
    }
  } else if (name === 'board') {
    const s = bw(24); mb(s, cx - s / 2, y + 12, { iv: [0], cl: [27], path: [[0, 27, null, 'rgba(255,255,255,0.55)']] });
  } else if (name === 'enter') {
    const s = bw(24); mb(s, cx - s / 2, y + 12, { hl: [0], iv: [], cl: [27], path: [] });
    const g = boardGeo(cx - s / 2, y + 12, s, false), [px, py] = g.sqXY(0);
    ctx.fillStyle = 'rgba(10,6,4,0.85)'; ctx.beginPath(); ctx.arc(px, py, g.s * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = th.accent; ctx.lineWidth = 3; ctx.stroke(); text(ctx, '1', px, py + g.s * 0.11, g.s * 0.36, '#fff', { weight: 800 });
  } else if (name === 'move') {
    const s = bw(24); mb(s, cx - s / 2, y + 12, { iv: [2], cl: [], hl: [5], path: [[2, 5, '3']] });
  } else if (name === 'capture') {
    const s = bw(24); mb(s, cx - s / 2, y + 12, { iv: [5, 12], cl: [18], path: [[5, 9, '4']], rings: [{ sq: 9, color: RED }] });
  } else if (name === 'safe') {
    const s = bw(24); mb(s, cx - s / 2, y + 12, { iv: [3, 17], cl: [10, 24], hl: [] });
  } else if (name === 'home') {
    const s = bw(24); mb(s, cx - s / 2, y + 12, { iv: [26], cl: [], path: [[26, 27, null]] });
    const g = boardGeo(cx - s / 2, y + 12, s, false), [, py] = g.sqXY(27);
    ctx.fillStyle = acc(th); ctx.beginPath(); ctx.moveTo(g.x + g.m * 0.8, py - g.m * 0.5); ctx.lineTo(g.x - g.m * 0.1, py); ctx.lineTo(g.x + g.m * 0.8, py + g.m * 0.5); ctx.closePath(); ctx.fill();
  } else if (name === 'pass') {
    const s = bw(24); mb(s, cx - s / 2, y + 12, { iv: [5, 6], cl: [14], rings: [{ sq: 6, color: RED }] });
  } else if (name === 'variants') {
    const s = Math.min(w * 0.46, (h - 40) / 0.6057);
    mb(s, x + 14, cy - s * 0.3 - 10, { iv: [0, 1, 2, 3, 4, 5, 6], cl: [21, 22, 23, 24, 25, 26, 27] });
    mb(s, x + w - s - 14, cy - s * 0.3 - 10, { iv: [0, 5], cl: [27, 12] });
    cap(ctx, ar ? 'تقليدية' : 'traditional', x + 14 + s / 2, y + h - 16, 20); cap(ctx, ar ? 'هذه النسخة' : 'this edition', x + w - s / 2 - 14, y + h - 16, 20, th.accent);
  } else if (name === 'think') {
    const s = bw(120); mb(s, cx - s / 2, y + 10, { iv: [5, 12], cl: [18], path: [[5, 9, '4']] });
    ctx.fillStyle = 'rgba(10,8,8,0.8)'; rr(ctx, x + 24, y + h - 98, w - 48, 78, 28); ctx.fill();
    ctx.strokeStyle = th.stroke; ctx.lineWidth = 1.5; rr(ctx, x + 24, y + h - 98, w - 48, 78, 28); ctx.stroke();
    const sample = ar ? 'يأسر حجراً ويرسله إلى البداية.' : 'Captures a stone and sends it back to start.';
    cap(ctx, sample, cx, y + h - 50, fitOne(sample, w - 100, 24, 14), th.accent);
  } else if (name === 'levels') {
    LEVELS.forEach((l, i) => {
      const yy = y + 20 + i * ((h - 40) / 5);
      cap(ctx, lvName(S, l), x + 120, yy + 30, 24, th.ink);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, x + 250, yy + 12, w - 290, 26, 13); ctx.fill();
      ctx.fillStyle = th.accent; rr(ctx, x + 250, yy + 12, (w - 290) * (0.2 + 0.2 * i), 26, 13); ctx.fill();
    });
  } else if (name === 'learn') {
    [[1, true], [2, true], [3, false]].forEach(([n, done], i) => {
      const yy = y + 20 + i * 112;
      ctx.fillStyle = done ? th.btnOn[0] : th.btn[0]; rr(ctx, x + 24, yy, w - 48, 96, 16); ctx.fill();
      drawPiece(ctx, th, 1, x + 80, yy + 48, 56, { noShadow: true });
      text(ctx, lessonText(LESSONS[n - 1], lang).title, x + 130, yy + 56, 26, th.ink, { weight: 700, align: 'left' });
      if (done) icon(ctx, 'check', x + w - 70, yy + 48, 40, th.ink);
    });
  } else if (name === 'undo') {
    icon(ctx, 'undo', cx - 130, cy - 14, 84, th.accent); icon(ctx, 'pause', cx + 130, cy - 14, 84, th.accent);
    cap(ctx, tt('undo'), cx - 130, cy + 70, 24); cap(ctx, tt('paused'), cx + 130, cy + 70, 24);
  } else if (name === 'auto') {
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(cx - 150, cy, 46, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = th.accent; ctx.beginPath(); ctx.arc(cx - 150, cy, 46, -Math.PI / 2, -Math.PI / 2 + ((t * 0.4) % 1) * Math.PI * 2); ctx.stroke();
    drawPiece(ctx, th, 1, cx + 10, cy, 96, { glow: 0.5 + 0.5 * Math.sin(t * 5) });
    icon(ctx, 'pause', cx + 150, cy, 52, th.accent);
  } else if (name === 'themes') {
    const s = (w - 4 * 16) / 3;
    THEMES.forEach((tt2, i) => {
      const bx = x + 16 + i * (s + 16);
      drawMini(ctx, tt2, bx, cy - s * 0.3 - 10, s, { iv: [3, 9], cl: [24, 15] });
      cap(ctx, (ar ? tt2.ar : tt2.name).split(' ')[0], bx + s / 2, cy + s * 0.3 + 34, 19);
    });
  } else if (name === 'lock') {
    icon(ctx, 'lock', cx, cy, 90, th.accent);
  } else if (name === 'endmark') {
    const e = b.data ?? {};
    const k = backOut(clamp01((S.ovT - 0.15) / 0.5));
    const pd = Math.min(110, h * 0.62);
    if (e.winner === 0 || e.winner === 1) drawPiece(ctx, th, e.winner + 1, cx, cy + 4, pd, { scale: k, glow: 0.5 + 0.4 * Math.sin(S.ovT * 4) });
  }
  ctx.restore();
}

// --------------------------------------------------------------------------------------- title
// The attract scene: four sticks tumbling over the felt, again and again.
let TITLE_PLANS = null;
function titlePlans() {
  if (TITLE_PLANS) return TITLE_PLANS;
  let s = 7;
  const rng = { next: () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; } };
  TITLE_PLANS = [[1, 0, 1, 1], [0, 0, 1, 0], [1, 1, 0, 1], [0, 1, 0, 0]].map((f) => planThrow(f.map(Boolean), rng));
  return TITLE_PLANS;
}

function drawSticksOn(ctx, th, mat, plan, tm, S, yClip = true) {
  const L = Math.min(250, mat.h * 0.64), Wd = L * 0.19;
  ctx.save();
  if (yClip) { rr(ctx, mat.x, mat.y, mat.w, mat.h, 30); ctx.clip(); }
  const items = plan.sticks.map((_, i) => ({ i, p: stickPose(plan, i, tm) }));
  for (const it of items) { const px = mat.x + it.p.x * mat.w, py = mat.y + it.p.y * mat.h; drawStickShadow(ctx, px, py, L, Wd, it.p.yaw, it.p.z); }
  items.sort((a, b) => a.p.z - b.p.z);
  for (const it of items) { const px = mat.x + it.p.x * mat.w, py = mat.y + it.p.y * mat.h; drawStickCached(ctx, th, px, py, L, Wd, it.p.yaw, it.p.roll, it.p.z); }
  ctx.restore();
  void S;
}

function drawTitle(ctx, S, ui) {
  const th = theme(S), ar = S.lang === 'ar';
  background(ctx, th, S.t, 560);
  const g = ctx.createLinearGradient(0, 100, 0, 290);
  g.addColorStop(0, light2(th.accent)); g.addColorStop(0.5, th.accent); g.addColorStop(1, '#a8782a');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.font = `800 ${ar ? 150 : 150}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillStyle = g; ctx.direction = ar ? 'rtl' : 'ltr';
  ctx.fillText(T(S, 'title'), 360, 222);
  ctx.restore();
  text(ctx, T(S, 'titleSub'), 360, 280, 40, 'rgba(246,236,214,0.92)', { weight: 600, font: DISPLAY });
  text(ctx, T(S, 'tagline'), 360, 322, fitOne(T(S, 'tagline'), 640, 24, 16), 'rgba(246,236,214,0.62)', { weight: 500 });
  const mat = { x: 60, y: 350, w: 600, h: 318 };
  drawFelt(ctx, th, mat, S.t);
  const plans = titlePlans(), cyc = 4.8, k = Math.floor(S.t / cyc) % plans.length, tm = S.t % cyc;
  drawSticksOn(ctx, th, mat, plans[k], Math.min(tm, plans[k].dur), S);
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
}
const light2 = (c) => (c.length === 7 ? `rgb(${Math.min(255, parseInt(c.slice(1, 3), 16) + 70)},${Math.min(255, parseInt(c.slice(3, 5), 16) + 70)},${Math.min(255, parseInt(c.slice(5, 7), 16) + 70)})` : '#fff3c4');

function drawDocScreen(ctx, S, ui) {
  const th = theme(S);
  background(ctx, th, S.t);
  if (ui.panel) panel(ctx, th, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  if (ui.nav) {
    drawFixed(ctx, S, [ui.nav.prev, ui.nav.next]);
    text(ctx, ui.nav.label, 360, 1500, 26, 'rgba(246,236,214,0.75)', { weight: 600 });
  }
}

function drawOverlay(ctx, S, ui) {
  const th = theme(S);
  ctx.fillStyle = `rgba(6,4,4,${0.62 * clamp01(S.ovT / 0.25)})`;
  ctx.fillRect(0, 0, W, H);
  const k = ease(clamp01(S.ovT / 0.3));
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k); ctx.translate(-W / 2, -H / 2);
  ctx.globalAlpha = k;
  panel(ctx, th, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------ play: geometry
export function playGeo(S, M) {
  const lay = playLayout(TEXT_SCALES[S.textIdx]);
  const flip = !M.two && !M.auto && M.human === 1;
  const geo = boardGeo(lay.board.x, lay.board.y, lay.board.w, flip);
  return { lay, geo, flip };
}
// The yard of side p (top or bottom, depending on which side the player sits).
export const yardRect = (lay, flip, p) => ((p === 0) !== flip ? lay.yardBottom : lay.yardTop);
export function slotXY(rect, n, k) {
  const slotS = Math.min(96, (rect.w - 40) / n), total = slotS * n;
  const x0 = rect.x + (rect.w - total) / 2;
  return [x0 + (k + 0.5) * slotS, rect.y + rect.h - 33, Math.min(slotS * 0.8, 50)];
}
export function exitBadge(geo, p) {
  const sq = p === 0 ? N - 1 : 0, [, cy] = geo.sqXY(sq);
  return [geo.flip ? geo.x + geo.w - geo.m * 0.55 : geo.x + geo.m * 0.55, cy];
}
// The square tapped (path index) or -1.
export function squareAt(geo, x, y) {
  for (let sq = 0; sq < N; sq++) { const [cx, cy] = geo.sqXY(sq); if (Math.abs(x - cx) <= geo.s / 2 && Math.abs(y - cy) <= geo.s / 2) return sq; }
  return -1;
}

// The path of a moving stone and where it is at fraction k (0..1) of its trip: pure, so a script can measure it.
export function animRoute(geo, lay, flip, n, A) {
  const pts = [];
  const yard = yardRect(lay, flip, A.p);
  if (A.from === WAIT) { const [sx, sy] = slotXY(yard, n, A.waitAfter); pts.push([sx, sy]); pts.push(geo.sqXY(sqOf(A.p, 0))); }
  else {
    pts.push(geo.sqXY(sqOf(A.p, A.from)));
    for (let i = A.from + 1; i <= Math.min(A.to, N - 1); i++) pts.push(geo.sqXY(sqOf(A.p, i)));
    if (A.off) { const [bx, by] = exitBadge(geo, A.p); pts.push([bx, by]); }
  }
  return pts;
}
export function pointOnRoute(pts, e) {
  let total = 0; const seg = [];
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); total += d; }
  let s = e * total;
  for (let i = 0; i < seg.length; i++) {
    if (s <= seg[i] || i === seg.length - 1) { const u = seg[i] ? Math.min(1, s / seg[i]) : 1; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u]; }
    s -= seg[i];
  }
  return pts[pts.length - 1];
}
export const smooth = (k) => k * k * (3 - 2 * k);

// ------------------------------------------------------------------------------------------ play: pieces
function drawHud(ctx, S, title, sub, showPause) {
  const th = theme(S);
  button(ctx, th, BACK_BTN, [], 'normal', { pressed: S.press && S.press.id === 'hud:back' && S.press.active });
  icon(ctx, 'back', BACK_BTN.x + BACK_BTN.w / 2, BACK_BTN.y + BACK_BTN.h / 2, 34, th.ink);
  if (showPause) {
    button(ctx, th, PAUSE_BTN, [], 'normal', { pressed: S.press && S.press.id === 'hud:pause' && S.press.active });
    icon(ctx, 'pause', PAUSE_BTN.x + PAUSE_BTN.w / 2, PAUSE_BTN.y + PAUSE_BTN.h / 2, 34, th.ink);
  }
  const z = TEXT_SCALES[S.textIdx];
  const tSize = fitOne(title, 480, 40 * (1 + (z - 1) * 0.25), 22);
  text(ctx, title, 360, 58, tSize, th.ink, { font: DISPLAY, weight: 800, shadow: 'rgba(0,0,0,0.6)' });
  const sSize = fitOne(sub, 480, 24 * (1 + (z - 1) * 0.3), 16);
  text(ctx, sub, 360, 96, sSize, 'rgba(246,236,214,0.7)', { weight: 500 });
}

function drawYard(ctx, S, M, lay, p, name, sub, active, geo) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx], flip = geo.flip;
  const r = yardRect(lay, flip, p), st = M.st, n = st.pos[p].length, A = M.anim;
  ctx.save();
  ctx.fillStyle = 'rgba(8,6,6,0.55)'; rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.fill();
  ctx.strokeStyle = active ? th.accent : 'rgba(255,255,255,0.14)'; ctx.lineWidth = active ? 3 : 1.5;
  if (active) { ctx.shadowColor = alpha(acc(th), 0.7); ctx.shadowBlur = 16; }
  rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.stroke();
  ctx.restore();
  const textH = r.h - 70;
  const ns = fitOne(name, r.w - 40, 30 * (1 + (z - 1) * 0.45), 16);
  const ss = fitOne(sub, r.w - 40, 21 * (1 + (z - 1) * 0.45), 14);
  const total = ns + ss + 6, ty = r.y + 4 + Math.max(0, (textH - total) / 3) + ns * 0.88;
  const left = S.lang === 'ar' ? r.x + r.w - 22 : r.x + 22, alg = S.lang === 'ar' ? 'right' : 'left';
  text(ctx, name, left, ty, ns, th.ink, { weight: 800, align: alg, font: DISPLAY });
  text(ctx, sub, left, ty + ss + 6, ss, active ? th.accent : 'rgba(246,236,214,0.66)', { weight: 600, align: alg });
  // slots: waiting stones from the left, home stones from the right, empty sockets between
  let wait = st.pos[p].filter((x) => x === WAIT).length, home = st.pos[p].filter((x) => x === HOME).length;
  if (A && !A.landed) { if (A.p === p && A.off) home = A.homeBefore; }
  if (A && A.cap && A.p !== p && A.t < A.dur + A.capDur) wait -= 1;
  for (let k = 0; k < n; k++) {
    const [sx, sy, d] = slotXY(r, n, k);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(sx, sy, d * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5; ctx.stroke();
    if (k < wait) drawPiece(ctx, th, p + 1, sx, sy, d, { noShadow: true });
    else if (k >= n - home) drawPiece(ctx, th, p + 1, sx, sy, d, { noShadow: true, ring: th.accent, scale: A && A.off && A.p === p && A.landed && k === n - home ? backOut(clamp01((A.t - A.dur) / 0.3)) : 1 });
  }
}

function describeAnim(S, A) {
  const side = T(S, A.p === 0 ? 'ivory' : 'clay');
  if (A.cap) return T(S, 'capturesStone', { side });
  if (A.off) return T(S, 'bearsOff', { side });
  if (A.from === WAIT) return T(S, 'entersStone', { side });
  return T(S, 'movesStone', { side });
}

export function drawBoardScene(ctx, S, M, geo, lay, auto) {
  const th = theme(S), st = M.st, A = M.anim, a = acc(th), pl = pulse(S), n = st.pos[0].length;
  ctx.save();
  const glow = ctx.createRadialGradient(geo.x + geo.w / 2, geo.y + geo.h / 2, 40, geo.x + geo.w / 2, geo.y + geo.h / 2, geo.w * 0.8);
  glow.addColorStop(0, th.glow); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(geo.x - 120, geo.y - 120, geo.w + 240, geo.h + 240);
  drawBoard(ctx, th, geo, {});
  const ringAt = (cx, cy, col, lw = 4, al = 1, rad = 0.62) => { ctx.save(); ctx.strokeStyle = col; ctx.globalAlpha = al; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(cx, cy, geo.d * rad, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); };
  const cellAt = (sq, col, al) => { const [cx, cy] = geo.sqXY(sq); ctx.save(); ctx.fillStyle = col; ctx.globalAlpha = al; rr(ctx, cx - geo.s / 2 + 3, cy - geo.s / 2 + 3, geo.s - 6, geo.s - 6, 9); ctx.fill(); ctx.restore(); };
  const badge = (cx, cy, label, col, al = 1, rad = 0.3) => {
    ctx.save(); ctx.globalAlpha = al;
    ctx.fillStyle = 'rgba(10,6,4,0.82)'; ctx.beginPath(); ctx.arc(cx, cy, geo.s * rad, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.stroke();
    text(ctx, label, cx, cy + geo.s * rad * 0.38, geo.s * rad * 1.05, '#fff', { weight: 800 });
    ctx.restore();
  };
  const turn = st.turn, mine = M.over ? -1 : turn;
  // last move
  if (M.lastMove && !M.over && !A && M.lastMove.to !== HOME) { const sq = sqOf(M.lastMove.p, M.lastMove.to); if (M.lastMove.to >= 0) cellAt(sq, a, 0.1 + 0.05 * pl); }
  // hint
  const hint = M.hint && !M.over ? M.hint : null;
  // selection and destinations
  const sel = M.sel;
  const playable = humanTurn(M) && st.phase === 'move' && !auto;
  const dests = [];
  if (playable) {
    for (const m of movesOf(M)) {
      if (sel !== null && sel !== undefined && m.from !== sel) continue;
      dests.push(m);
    }
  }
  if (playable && sel !== null && sel !== undefined) {
    if (sel >= 0) { const [cx, cy] = geo.sqXY(sqOf(turn, sel)); cellAt(sqOf(turn, sel), a, 0.2 + 0.1 * pl); void cx; void cy; }
  }
  // destination markers (no selection: only entry targets so the first tap is obvious)
  if (playable) {
    const shown = sel !== null && sel !== undefined ? dests : dests.filter((m) => m.from === WAIT);
    for (const m of shown) {
      if (m.off) { const [bx, by] = exitBadge(geo, turn); ctx.save(); ctx.fillStyle = alpha(a, 0.9); ctx.beginPath(); ctx.arc(bx, by, geo.s * 0.3 + 3 * pl, 0, Math.PI * 2); ctx.fill(); ctx.restore(); badge(bx, by, `${m.v}`, a, 1, 0.26); continue; }
      const [cx, cy] = geo.sqXY(m.sq);
      cellAt(m.sq, m.cap ? RED : a, 0.22 + 0.12 * pl);
      badge(cx, cy, `${m.v}`, m.cap ? RED : a, 0.95);
    }
  }
  if (M.flash && M.flashT > 0 && M.flashSq != null) cellAt(M.flashSq, RED, 0.4 * clamp01(M.flashT / 0.3));
  // hint marker
  if (hint) {
    const mv = hint.mv;
    if (mv.off) { const [bx, by] = exitBadge(geo, turn); ringAt(bx, by, a, 5, 0.6 + 0.4 * pl, 0.4); }
    else { const [cx, cy] = geo.sqXY(mv.sq); cellAt(mv.sq, a, 0.3 + 0.2 * pl); ringAt(cx, cy, a, 5, 0.6 + 0.4 * pl, 0.68); }
    if (mv.from >= 0) { const [cx, cy] = geo.sqXY(sqOf(turn, mv.from)); ringAt(cx, cy, a, 5, 0.9, 0.66); }
  }
  // Watch & Learn reveal
  if (auto && auto.plan && (auto.phase === 'reveal')) {
    const mv = auto.plan.mv;
    if (mv.from >= 0) { const [cx, cy] = geo.sqXY(sqOf(turn, mv.from)); ringAt(cx, cy, a, 5, 0.9, 0.66); }
    if (mv.off) { const [bx, by] = exitBadge(geo, turn); ringAt(bx, by, a, 5, 0.7 + 0.3 * pl, 0.4); }
    else { const [cx, cy] = geo.sqXY(mv.sq); cellAt(mv.sq, a, 0.3 + 0.2 * pl); ringAt(cx, cy, a, 5, 0.7 + 0.3 * pl, 0.66); }
  }
  if (auto && auto.phase === 'think' && auto.scan != null) { const [cx, cy] = geo.sqXY(auto.scan); cellAt(auto.scan, 'rgba(255,255,255,0.8)', 0.08 + 0.08 * pl); void cx; void cy; }
  // stones on the board
  const winner = M.over ? M.over.winner : -1;
  const kA = A ? clamp01(vis(S, A) / A.dur) : 0;
  for (let p = 0; p < 2; p++) {
    for (const x of st.pos[p]) {
      if (x < 0 || x >= N) continue;
      if (A && A.p === p && A.to === x && !A.off && vis(S, A) < A.dur) continue;           // drawn in flight
      const [cx, cy] = geo.sqXY(sqOf(p, x));
      let o = {};
      if (sel === x && turn === p && playable) o = { glow: 0.5 + 0.3 * pl, lift: 0.5 };
      else if (hint && turn === p && hint.mv.from === x) o = { glow: 0.6 };
      else if (auto && auto.phase === 'reveal' && auto.plan && turn === p && auto.plan.mv.from === x) o = { glow: 0.5 + 0.4 * pl };
      else if (M.over && M.winT > 0.3 && winner === p) o = { glow: 0.4 + 0.3 * Math.sin(M.winT * 5 + x) };
      else if (M.over && winner >= 0 && winner !== p) o = { alpha: 0.75 };
      drawPiece(ctx, th, p + 1, cx, cy, geo.d, o);
    }
  }
  // the stone in flight (and the captured one, until it lands)
  if (A) {
    const ta = vis(S, A);
    const pts = animRoute(geo, lay, geo.flip, n, A);
    if (A.cap && ta < A.dur) { const [cx, cy] = geo.sqXY(A.sq); drawPiece(ctx, th, (A.p === 0 ? 1 : 0) + 1, cx, cy, geo.d, { glow: 0.3 + 0.5 * clamp01((kA - 0.6) / 0.4) }); }
    if (ta < A.dur) {
      const k = clamp01(ta / A.dur), e = smooth(k), [px, py] = pointOnRoute(pts, e);
      const fade = A.off ? 1 - smooth(clamp01((k - 0.7) / 0.3)) : 1;
      drawPiece(ctx, th, A.p + 1, px, py, geo.d * (A.from === WAIT ? 0.9 + 0.1 * e : 1) * (A.off ? 0.55 + 0.45 * fade : 1), { lift: Math.sin(k * Math.PI) * 0.8, glow: 0.5, alpha: fade });
    }
    if (A.cap && ta >= A.dur && ta < A.dur + A.capDur) {
      const e = A.p === 0 ? 1 : 0, yr = yardRect(lay, geo.flip, e), wcount = st.pos[e].filter((x) => x === WAIT).length;
      const [hx, hy, hd] = slotXY(yr, n, wcount - 1), [sx, sy] = geo.sqXY(A.sq);
      const k = clamp01((ta - A.dur) / A.capDur), ee = smooth(k);
      drawPiece(ctx, th, e + 1, sx + (hx - sx) * ee, sy + (hy - sy) * ee, geo.d + (hd - geo.d) * ee, { lift: Math.sin(k * Math.PI) * 0.9, alpha: 1 });
    }
  }
  ctx.restore();
  drawParticles(ctx, M.parts);
}

// ------------------------------------------------------------------------------------------ play: chips, mat, status
function drawChips(ctx, S, M, r) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx], st = M.st;
  ctx.save();
  ctx.fillStyle = 'rgba(8,6,6,0.5)'; rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5; rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.stroke();
  ctx.restore();
  const vals = st.pending, done = M.throwAnim ? st.throws.length : st.throws.length;
  const label = S.lang === 'ar' ? 'الأعداد' : 'Counts';
  const ls = fitOne(label, 150, 24 * (1 + (z - 1) * 0.4), 14);
  const ar = S.lang === 'ar';
  text(ctx, label, ar ? r.x + r.w - 18 : r.x + 18, r.y + r.h / 2 + ls * 0.34, ls, 'rgba(246,236,214,0.7)', { weight: 700, align: ar ? 'right' : 'left' });
  const cw = Math.min(r.h - 14, 90), gap = 10;
  const startX = ar ? r.x + r.w - 24 - tw(label, ls) - 24 - cw : r.x + 24 + tw(label, ls) + 24;
  const dir = ar ? -1 : 1;
  const total = Math.max(1, Math.min(vals.length, Math.floor((r.w - 60 - tw(label, ls)) / (cw + gap))));
  for (let i = 0; i < Math.min(vals.length, total); i++) {
    const x = startX + dir * i * (cw + gap), y = r.y + (r.h - cw) / 2;
    ctx.fillStyle = th.primary[0]; rr(ctx, x, y, cw, cw, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.5; rr(ctx, x, y, cw, cw, 14); ctx.stroke();
    text(ctx, `${vals[i]}`, x + cw / 2, y + cw / 2 + cw * 0.17, cw * 0.56, th.primaryInk, { weight: 800 });
  }
  if (!vals.length) {
    const hint = M.over ? '' : st.phase === 'throw' ? (S.lang === 'ar' ? 'لا أعداد بعد' : 'no counts yet') : '';
    if (hint) text(ctx, hint, startX + dir * 60, r.y + r.h / 2 + ls * 0.34, ls * 0.9, 'rgba(246,236,214,0.45)', { weight: 600, align: ar ? 'right' : 'left' });
  }
  void done;
}

function drawMat(ctx, S, M, r) {
  const th = theme(S);
  drawFelt(ctx, th, r, S.t);
  const A = M.throwAnim;
  let plan = null, tm = 0;
  if (A) { plan = A.plan; tm = vis(S, A); }
  else if (M.lastPlan) { plan = M.lastPlan.plan; tm = plan.dur; }
  const L = Math.min(250, r.h * 0.64), Wd = L * 0.19;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();      // a plain rectangle clip is far cheaper than a rounded one; the sticks never reach the corners
  if (plan) drawSticksOn(ctx, th, r, plan, Math.min(tm, plan.dur), S, false);
  else {
    const flats = [false, true, false, true];
    const items = flats.map((f, i) => ({ i, p: restPose(flats, i), f }));
    for (const it of items) { const px = r.x + it.p.x * r.w, py = r.y + it.p.y * r.h; drawStickShadow(ctx, px, py, L, Wd, it.p.yaw, 0); }
    for (const it of items) { const px = r.x + it.p.x * r.w, py = r.y + it.p.y * r.h; drawStickCached(ctx, th, px, py, L, Wd, it.p.yaw, it.p.roll, 0); }
  }
  drawDust(ctx, M.parts);
  ctx.restore();
  // the count just thrown, large, above the sticks
  const pop = M.pop;
  if (pop && !A) {
    const k = backOut(clamp01(pop.t / 0.35)), fade = 1 - clamp01((pop.t - 2.2) / 0.6);
    if (fade > 0) {
      ctx.save(); ctx.globalAlpha = fade;
      const cx = r.x + r.w / 2, cy = r.y + 56, big = 74 * k;
      ctx.fillStyle = 'rgba(8,10,8,0.7)'; rr(ctx, cx - 190, cy - 44, 380, 88, 44); ctx.fill();
      ctx.strokeStyle = th.accent; ctx.lineWidth = 2.5; rr(ctx, cx - 190, cy - 44, 380, 88, 44); ctx.stroke();
      text(ctx, `${pop.v}`, cx - 100, cy + big * 0.34, big, th.accent, { font: DISPLAY, weight: 800 });
      const nm = valueName(pop.v, S.lang), fl = T(S, 'flatsUp', { n: pop.n });
      text(ctx, nm + (pop.extra ? '  +' : ''), cx + 60, cy - 4, fitOne(nm, 200, 30, 16), th.ink, { weight: 800 });
      text(ctx, fl, cx + 60, cy + 28, fitOne(fl, 200, 22, 14), 'rgba(246,236,214,0.75)', { weight: 600 });
      ctx.restore();
    }
  }
  if (!A && M.over === null && canThrow(M) && !M.lastPlan) {
    text(ctx, T(S, 'yourThrowBody'), r.x + r.w / 2, r.y + r.h - 26, fitOne(T(S, 'yourThrowBody'), r.w - 60, 22, 14), 'rgba(246,236,214,0.7)', { weight: 600 });
  }
}

function drawStatus(ctx, S, r, head, body, col) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  ctx.save();
  ctx.fillStyle = 'rgba(8,6,6,0.6)'; rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.fill();
  ctx.strokeStyle = th.stroke; ctx.lineWidth = 1.5; rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.stroke();
  ctx.restore();
  const pad = 22, w = r.w - pad * 2;
  const full = body ? `${head}\n${body}` : head;
  const f = fitText(full, w, r.h - 24, 32 * (1 + (z - 1) * 0.6), 16);
  const hl = wrap(head, f.size, w).length;
  const all = body ? [...wrap(head, f.size, w), ...wrap(body, f.size, w)] : wrap(head, f.size, w);
  const total = all.length * f.line;
  let ty = r.y + (r.h - total) / 2 + f.size * 0.95;
  all.forEach((ln, i) => { text(ctx, ln, r.x + r.w / 2, ty, f.size, i < hl ? (col ?? th.accent) : 'rgba(246,236,214,0.92)', { weight: i < hl ? 800 : 500 }); ty += f.line; });
}

function drawToolbar(ctx, S, M, lay) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  const lesson = Boolean(M.lesson);
  const defs = {
    throw: { icon: 'play', label: T(S, 'throwBtn'), off: !canThrow(M), kind: 'primary' },
    think: { icon: 'hint', label: T(S, 'think'), off: M.over || !humanTurn(M) || M.st.phase !== 'move' || S.hintBusy, kind: 'normal' },
    undo: { icon: 'undo', label: T(S, 'undo'), off: M.over || lesson || !S.canUndo, kind: 'normal' },
  };
  TOOLBAR_IDS.forEach((id, i) => {
    const r = lay.tool[i], d = defs[id];
    const pressed = S.press && S.press.id === `tool:${id}` && S.press.active;
    button(ctx, th, r, [], d.kind, { disabled: d.off, pressed, radius: 22 });
    const yy = r.y + (pressed ? 2 : 0);
    ctx.save();
    if (d.off) ctx.globalAlpha = 0.4;
    const ink = id === 'throw' ? th.primaryInk : th.ink;
    const is = 44 * (1 + (z - 1) * 0.35);
    const ls = fitOne(d.label, r.w - 20, 24 * (1 + (z - 1) * 0.6), 16);
    const total = is + ls + 10;
    icon(ctx, d.icon, r.x + r.w / 2, yy + (r.h - total) / 2 + is / 2, is, ink);
    text(ctx, d.label, r.x + r.w / 2, yy + (r.h - total) / 2 + is + 10 + ls * 0.85, ls, ink, { weight: 700 });
    ctx.restore();
  });
}

function drawAutoBar(ctx, S, auto) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx], b = autoLayout(z);
  const pr = (id) => S.press && S.press.id === id && S.press.active;
  const side = (r, ic, label, off, id) => {
    button(ctx, th, r, [], 'normal', { disabled: off, pressed: pr(id), radius: 22 });
    ctx.save(); if (off) ctx.globalAlpha = 0.4;
    const is = 40 * (1 + (z - 1) * 0.35), ls = fitOne(label, r.w - 20, 22 * (1 + (z - 1) * 0.6), 14), total = is + ls + 10, yy = r.y + (r.h - total) / 2;
    icon(ctx, ic, r.x + r.w / 2, yy + is / 2, is, th.ink);
    text(ctx, label, r.x + r.w / 2, yy + is + 10 + ls * 0.85, ls, th.ink, { weight: 700 });
    ctx.restore();
  };
  side(b.slower, 'minus', T(S, 'autoSlower'), S.speedIdx === 0, 'auto:slower');
  side(b.faster, 'plus', T(S, 'autoFaster'), S.speedIdx === AUTO_SPEEDS.length - 1, 'auto:faster');
  button(ctx, th, b.pause, [], 'primary', { pressed: pr('auto:pause'), radius: 22 });
  const lab = auto.paused ? T(S, 'autoPlay') : T(S, 'autoPause');
  const ps = fitOne(lab, b.pause.w - 140, 32 * (1 + (z - 1) * 0.5), 18), is = 44 * (1 + (z - 1) * 0.3);
  icon(ctx, auto.paused ? 'play' : 'pause', b.pause.x + 52 + is / 2, b.pause.y + b.pause.h / 2, is, th.primaryInk);
  text(ctx, lab, b.pause.x + 52 + is + (b.pause.w - 52 - is) / 2 - 16, b.pause.y + b.pause.h / 2 + ps * 0.35, ps, th.primaryInk, { weight: 800 });
}

const youName = (S, M, p) => {
  const side = T(S, p === 0 ? 'ivory' : 'clay');
  if (M.auto) return `${side} · ${lvName(S, LEVELS.find((l) => l.id === M.autoLv[p]) ?? LEVELS[4])}`;
  if (M.two) return side;
  if (M.lesson && M.lesson.type !== 'game') return p === M.human ? `${side} (${T(S, 'youWord')})` : side;
  return p === M.human ? `${side} (${T(S, 'youWord')})` : `${side} · ${lvName(S, LEVELS.find((l) => l.id === M.level) ?? LEVELS[2])}`;
};

function statusOf(S, M, auto) {
  const st = M.st, side = (p) => T(S, p === 0 ? 'ivory' : 'clay');
  let head = '', body = '', col = null;
  const name = (p) => (M.two || M.auto ? side(p) : LEVELS.find((l) => l.id === M.level) ? lvName(S, LEVELS.find((l) => l.id === M.level)) : side(p));
  if (M.over) {
    head = S.endInfo ? S.endInfo.head : '';
    body = S.endInfo && !(M.lesson && M.lesson.type === 'game') ? S.endInfo.body : '';
  } else if (auto) {
    if (auto.paused) head = T(S, 'paused');
    else if (auto.phase === 'think') { head = `${T(S, 'autoThink')} ${Math.max(0, Math.ceil((auto.forced ? 0.5 : THINK_STEPS[S.thinkIdx]) - auto.t))}`; body = st.phase === 'throw' ? T(S, 'turnThrow', { side: side(st.turn) }) : T(S, 'toMove') ? `${side(st.turn)} ${T(S, 'toMove')}` : ''; }
    else if (auto.phase === 'reveal' || auto.phase === 'act') { head = auto.note.head; body = auto.note.why; }
    else if (auto.phase === 'intro') head = T(S, 'title');
    else if (auto.phase === 'throw') head = M.throwAnim ? T(S, 'theyThrow', { name: side(st.turn) }) : T(S, 'turnThrow', { side: side(st.turn) });
    if (!head) head = M.throwAnim ? T(S, 'theyThrow', { name: side(st.turn) }) : M.anim ? describeAnim(S, M.anim) : '';
  } else if (S.toast) head = S.toast;
  else if (M.throwAnim) head = isHumanSide(M, M.throwAnim.by) && !M.two ? T(S, 'yourThrow') : M.two ? T(S, 'turnThrow', { side: side(M.throwAnim.by) }) : T(S, 'theyThrow', { name: name(M.throwAnim.by) });
  else if (M.anim) head = describeAnim(S, M.anim);
  else if (M.msg) { head = T(S, M.msg); col = '#ffb3a6'; }
  else if (M.notice && M.notice.kind === 'pass' && M.pop && M.pop.t < 2) { head = T(S, 'passTurn'); }
  else if (M.hint) { head = M.hint.head; body = M.hint.why; }
  else if (S.hintBusy) head = T(S, 'thinking');
  else if (M.lesson && M.lesson.type !== 'game') head = lessonText(M.lesson, S.lang).task;
  else if (st.phase === 'throw' && isHumanSide(M, st.turn)) { head = M.two ? T(S, 'turnThrow', { side: side(st.turn) }) : T(S, 'yourThrow'); body = T(S, 'yourThrowBody'); }
  else if (M.thinking) head = T(S, 'thinking');
  else if (humanTurn(M) && st.phase === 'move') { head = M.sel !== null && M.sel !== undefined ? T(S, 'pickDest') : T(S, 'tapStone'); body = M.sel !== null && M.sel !== undefined ? T(S, 'pickDestBody') : T(S, 'tapStoneBody'); }
  else if (M.lesson) head = lessonText(M.lesson, S.lang).task;
  return { head, body, col };
}

function drawPlay(ctx, S) {
  const th = theme(S), M = S.match, z = TEXT_SCALES[S.textIdx];
  background(ctx, th, S.t, 800);
  const auto = S.scene === 'auto' ? S.auto : null;
  const { lay, geo } = playGeo(S, M);
  const title = M.lesson ? lessonText(M.lesson, S.lang).title : T(S, 'title');
  const pcs = piecesLabel(S, M.pieces);
  const sub = M.lesson ? `${S.lang === 'ar' ? 'الدرس' : 'Lesson'} ${S.lessonIdx + 1} / ${LESSONS.length}` : auto ? `${T(S, 'autoSession')} · ${T(S, 'autoSpeed')} x${AUTO_SPEEDS[S.speedIdx]} · ${T(S, 'think')} ${THINK_STEPS[S.thinkIdx]}${T(S, 'seconds')}` : `${M.two ? T(S, 'twoPlayers') : `${T(S, 'vsComputer')} · ${lvName(S, LEVELS.find((l) => l.id === M.level) ?? LEVELS[2])}`} · ${pcs}`;
  drawHud(ctx, S, title, sub, !auto);
  const st = M.st;
  const toMove = M.over ? -1 : st.turn;
  const plateSub = (p) => {
    const w = st.pos[p].filter((x) => x === WAIT).length, h = st.pos[p].filter((x) => x === HOME).length;
    const cnt = `${T(S, 'home')} ${h}/${st.pos[p].length}`;
    if (M.over) return M.over.winner === p ? `${S.lang === 'ar' ? 'الفائز' : 'Winner'} · ${cnt}` : cnt;
    if (toMove === p) return `${M.thinking && !M.two && !M.lesson && !isHumanSide(M, p) ? T(S, 'thinking').replace('...', '') : T(S, 'toMove')} · ${cnt}`;
    void w;
    return cnt;
  };
  drawYard(ctx, S, M, lay, 1, youName(S, M, 1), plateSub(1), toMove === 1, geo);
  drawYard(ctx, S, M, lay, 0, youName(S, M, 0), plateSub(0), toMove === 0, geo);
  drawBoardScene(ctx, S, M, geo, lay, auto);
  drawChips(ctx, S, M, lay.chips);
  drawMat(ctx, S, M, lay.mat);
  const { head, body, col } = statusOf(S, M, auto);
  drawStatus(ctx, S, lay.status, head, body, col);
  if (auto && auto.phase === 'think' && !auto.paused) {
    const frac = clamp01(auto.t / (auto.forced ? 0.5 : THINK_STEPS[S.thinkIdx]));
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(ctx, lay.status.x + 24, lay.status.y + lay.status.h - 16, lay.status.w - 48, 7, 3.5); ctx.fill();
    ctx.fillStyle = th.accent; rr(ctx, lay.status.x + 24, lay.status.y + lay.status.h - 16, (lay.status.w - 48) * frac, 7, 3.5); ctx.fill();
  }
  if (auto) drawAutoBar(ctx, S, auto); else drawToolbar(ctx, S, M, lay);
  void z;
}

export function render(ctx, S, ui) {
  ctx.textBaseline = 'alphabetic';
  switch (S.scene) {
    case 'title': drawTitle(ctx, S, ui); break;
    case 'setup': case 'learn': case 'howto': case 'rules': case 'about': case 'settings': drawDocScreen(ctx, S, ui); break;
    case 'demo-limit':
      background(ctx, theme(S), S.t);
      panel(ctx, theme(S), ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
      drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
      drawFixed(ctx, S, ui.fixed);
      break;
    case 'play': case 'auto':
      if (!S.match) { background(ctx, theme(S), S.t); break; }
      drawPlay(ctx, S);
      break;
    default: background(ctx, theme(S), S.t);
  }
  if (S.overlay) drawOverlay(ctx, S, ui);
}

export { DOC_PANEL, NAV_PREV, NAV_NEXT, H, W, COLS, SAFE, cellOf, sideName, isSafe, easeIO, canUndo };
