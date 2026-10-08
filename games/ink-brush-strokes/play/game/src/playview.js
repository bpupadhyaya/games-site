// The painting screens: practice (lessons and Watch and Learn) and the free scroll, with their overlays (pause, grind, result, seal row).
import { PAL, UI, DISPLAY, CJK, rgba, drawBackdrop, paperImage, drawMount, paintSeal, drawBrush, drawStar, drawStone } from './art.js';
import { txt, button, panel, rrect, chip, icon, wrap } from './ui.js';
import { menuRects } from './layout.js';
import { LESSONS, TYPES, SEALS, PAGE, targetPath, envAt, toPage } from './lessons.js';
import { BRUSH, toneAlpha, toneBand } from './brush.js';
import { drawLayer } from './ink.js';
import { edgeStroke } from './brand.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TOOL_LABEL = { dip: 'Dip', water: 'Water', grind: 'Grind', size: 'Size', guide: 'Guide', undo: 'Undo', hint: 'Hint', seal: 'Seal', left: 'Left', right: 'Right', keep: 'Keep', pause: 'Pause', skip: 'Next' };

export function renderPlay(ctx, st, L, view, meta, h) {
  const free = st.scene === 'free', sess = free ? st.fr : st.ps, { w, h: hh } = L, P = L.play;
  meta.previewBadge = null;
  drawBackdrop(ctx, w + 20, hh + 20, st.t, st.prefs.calm ? 1 : 0);
  if (!sess) return;
  const les = free ? null : LESSONS[sess.li], auto = !free && sess.mode === 'auto';
  if (L.mode === 'wide') {
    panel(ctx, P.panelL, { fill: 'rgba(12,20,22,0.72)', rad: 26 }); edgeStroke(ctx, P.panelL, 26, 0.18);
    panel(ctx, P.panelR, { fill: 'rgba(12,20,22,0.72)', rad: 26 }); edgeStroke(ctx, P.panelR, 26, 0.18);
  }
  drawPaper(ctx, st, L, h, sess, les, free, auto);
  drawHeader(ctx, st, L, h, sess, les, free, auto);
  drawCoach(ctx, st, L, h, sess, les, free, auto);
  drawTools(ctx, st, L, h, sess, free, auto);
  if (free && sess.sealMode) drawSealRow(ctx, P.seals, sess.sealSel);
  if (sess.overlay === 'pause') drawPause(ctx, st, L, h, sess, auto);
  else if (sess.overlay === 'grind') drawGrind(ctx, st, L);
  else if (sess.overlay === 'result') drawResult(ctx, st, L, sess, les, h);
  else if (auto && sess.paused) { ctx.fillStyle = 'rgba(6,10,12,0.35)'; rrect(ctx, P.paper, 4); ctx.fill(); txt(ctx, 'Paused', P.paper.x + P.paper.w / 2, P.paper.y + P.paper.h / 2, 64, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 8 }); }
}

// ---- the sheet: paper, grid, guide, ink, brush -----------------------------------------------------------------------------------------------------------------
function drawPaper(ctx, st, L, h, sess, les, free, auto) {
  const P = L.play, r = P.paper, k = r.w / PAGE.w;
  drawMount(ctx, r, Math.max(10, r.w * 0.026));
  let src = { x: 0, y: 0, w: PAGE.w, h: PAGE.h };
  const lay = h.layer(free ? 'free' : 'lesson');
  if (free) { src = { x: sess.scroll, y: 0, w: PAGE.w, h: PAGE.h }; }
  const pimg = free ? paperImage(PAGE.w * 3, PAGE.h, 1.2) : paperImage(PAGE.w, PAGE.h, 1.25);
  if (pimg) ctx.drawImage(pimg, src.x * (pimg.width / (free ? PAGE.w * 3 : PAGE.w)), 0, PAGE.w * (pimg.width / (free ? PAGE.w * 3 : PAGE.w)), pimg.height, r.x, r.y, r.w, r.h);
  else { ctx.fillStyle = PAL.paper; ctx.fillRect(r.x, r.y, r.w, r.h); }
  const sx = (x) => r.x + (x - src.x) * k, sy = (y) => r.y + y * k;
  if (free) {                                   // page seams
    ctx.save(); ctx.strokeStyle = 'rgba(120,90,50,0.22)'; ctx.setLineDash([8, 8]); ctx.lineWidth = 1.5;
    for (let i = 1; i < 3; i++) { const x = sx(PAGE.w * i); if (x > r.x + 2 && x < r.x + r.w - 2) { ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke(); } }
    ctx.restore();
  } else if (les.box.w === 480) {               // the square practice grid
    const b = les.box;
    ctx.save(); ctx.strokeStyle = 'rgba(190,70,50,0.45)'; ctx.lineWidth = 2;
    ctx.strokeRect(sx(b.x), sy(b.y), b.w * k, b.h * k);
    ctx.setLineDash([10, 9]); ctx.strokeStyle = 'rgba(190,70,50,0.26)'; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(sx(b.x), sy(b.y)); ctx.lineTo(sx(b.x + b.w), sy(b.y + b.h)); ctx.moveTo(sx(b.x + b.w), sy(b.y)); ctx.lineTo(sx(b.x), sy(b.y + b.h));
    ctx.moveTo(sx(b.x + b.w / 2), sy(b.y)); ctx.lineTo(sx(b.x + b.w / 2), sy(b.y + b.h)); ctx.moveTo(sx(b.x), sy(b.y + b.h / 2)); ctx.lineTo(sx(b.x + b.w), sy(b.y + b.h / 2));
    ctx.stroke(); ctx.restore();
  }
  if (!free) drawGuide(ctx, st, sess, les, auto, sx, sy, k, h);
  drawLayer(ctx, lay, r, src);
  if (st.flash && !free && !auto) {              // a soft glow round the paper after a stroke
    const a = 1 - st.flash.t; ctx.save(); ctx.strokeStyle = st.flash.good ? `rgba(88,194,163,${0.7 * a})` : `rgba(236,208,138,${0.55 * a})`; ctx.lineWidth = 6;
    ctx.strokeRect(r.x - 6, r.y - 6, r.w + 12, r.h + 12); ctx.restore();
  }
  // brush
  const bs = Math.max(14, 20 * BRUSH.sizes[st.prefs.size].k * clamp(k * 1.7, 0.7, 1.4));
  if (auto) {
    if (!sess.paused || sess.overlay !== 'none') { const a = sess.auto; if (a.phase === 'reveal' || a.phase === 'act') drawBrush(ctx, sx(a.ghost.x), sy(a.ghost.y), bs, st.brush.load, st.brush.tone, a.phase === 'act'); }
  } else if (st.cursor.on && sess.cur) drawBrush(ctx, st.cursor.x, st.cursor.y, bs, st.brush.load, st.brush.tone, true);
  if (free) {                                    // scroll position dots
    for (let i = 0; i < 3; i++) { const cur = Math.abs(sess.scroll / PAGE.w - i) < 0.5; ctx.fillStyle = cur ? PAL.gold : 'rgba(244,236,216,0.3)'; ctx.beginPath(); ctx.arc(r.x + r.w / 2 + (i - 1) * 26, r.y + r.h + Math.max(10, r.w * 0.026) + 14, cur ? 6 : 4.5, 0, Math.PI * 2); ctx.fill(); }
  }
}

function strokeGhost(ctx, les, idx, sx, sy, k, color, widthK) {
  const pts = targetPath(les, idx), type = les.strokes[idx].type, n = pts.length, L = [], Rr = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    const w = Math.max(3 / k, les.base * 0.8 * widthK * envAt(type, i / (n - 1))) / 2, nx = (-dy / d) * w, ny = (dx / d) * w;
    L.push([sx(pts[i][0] + nx), sy(pts[i][1] + ny)]); Rr.push([sx(pts[i][0] - nx), sy(pts[i][1] - ny)]);
  }
  ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(Rr[i][0], Rr[i][1]);
  ctx.closePath(); ctx.fill(); ctx.restore();
}
function numberDot(ctx, x, y, r, n, active, pulse) {
  ctx.save();
  if (active) { ctx.strokeStyle = `rgba(239,106,82,${0.55 - 0.4 * pulse})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r + 5 + pulse * 10, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = active ? PAL.cinnabar : 'rgba(60,80,80,0.75)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  txt(ctx, String(n), x, y + 1, r * 1.15, '#fff', { align: 'center', weight: 800 });
  ctx.restore();
}
function drawGuide(ctx, st, sess, les, auto, sx, sy, k, h) {
  const e = sess.done.length >= les.strokes.length ? -1 : (() => { for (let i = 0; i < les.strokes.length; i++) if (!sess.done.includes(i)) return i; return -1; })();
  const g = auto ? 0 : st.prefs.guide, hint = sess.hintT > 0 || (auto && sess.auto && (sess.auto.phase === 'reveal' || sess.auto.phase === 'think'));
  const pulse = 0.5 + 0.5 * Math.sin(st.t * 4), ph = (st.t * 0.9) % 1;
  if (g === 0) {
    for (let i = 0; i < les.strokes.length; i++) {
      if (sess.done.includes(i) || i === e) continue;
      strokeGhost(ctx, les, i, sx, sy, k, 'rgba(40,74,74,0.13)', 0.9);
      const p0 = targetPath(les, i)[0]; numberDot(ctx, sx(p0[0]), sy(p0[1]), Math.max(10, 13 * k * 1.6), i + 1, false, 0);
    }
  }
  if (e >= 0 && (g <= 1 || hint)) {
    if (g === 0 || hint) strokeGhost(ctx, les, e, sx, sy, k, hint ? `rgba(200,65,47,${0.26 + 0.14 * pulse})` : 'rgba(200,65,47,0.2)', 0.9);
    const pts = targetPath(les, e), p0 = pts[0];
    if (g === 0 || hint) {                       // marching arrow along the path
      const i = Math.min(pts.length - 2, Math.floor(ph * (pts.length - 1))), a = pts[i], b = pts[i + 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      ctx.save(); ctx.translate(sx(a[0]), sy(a[1])); ctx.rotate(ang); ctx.fillStyle = 'rgba(200,65,47,0.9)';
      const as = Math.max(9, 14 * k * 1.5); ctx.beginPath(); ctx.moveTo(as, 0); ctx.lineTo(-as * 0.7, -as * 0.75); ctx.lineTo(-as * 0.7, as * 0.75); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    numberDot(ctx, sx(p0[0]), sy(p0[1]), Math.max(12, 15 * k * 1.6), e + 1, true, pulse);
  }
}

// ---- header: menu button, title, stroke-order chips ----------------------------------------------------------------------------------------------------------------
function drawHeader(ctx, st, L, h, sess, les, free, auto) {
  const P = L.play, wide = L.mode === 'wide';
  if (!wide) {
    button(ctx, P.menu, '', { icon: 'pause', kind: 'quiet', size: 26 });
    const title = free ? 'Free Scroll' : auto ? `Watch and Learn` : les.title;
    if (!free) txt(ctx, les.cn, P.title.x + 24, P.title.y, 54, PAL.gold, { font: CJK, weight: 700 });
    txt(ctx, title, P.title.x + (free ? 0 : 100), P.title.y - (auto ? 12 : 0), 38, PAL.text, { font: DISPLAY, weight: 700, maxW: P.title.w - (free ? 0 : 104) });
    if (auto) txt(ctx, `${les.cn} ${les.title}`, P.title.x + 100, P.title.y + 22, 24, PAL.dim, { font: CJK, weight: 600, maxW: P.title.w - 104 });
  } else {
    button(ctx, P.menu, 'Menu', { icon: 'pause', kind: 'quiet', size: 28 });
    if (!free) {
      txt(ctx, les.cn, P.panelL.x + 22, P.title.y, 62, PAL.gold, { font: CJK, weight: 700 });
      txt(ctx, auto ? 'Watch and Learn' : les.title, P.panelL.x + 22 + 80, P.title.y - (auto ? 14 : 0), 34, PAL.text, { font: DISPLAY, weight: 700, maxW: P.panelL.w - 110 });
      if (auto) txt(ctx, les.title, P.panelL.x + 102, P.title.y + 22, 24, PAL.dim, { weight: 600, maxW: P.panelL.w - 110 });
      const img = modelOf(h, les, P.model);
      if (img) ctx.drawImage(img, P.model.x + (P.model.w - img.width / 2) / 2, P.model.y, img.width / 2, img.height / 2);
    } else txt(ctx, 'Free Scroll', P.panelL.x + 22, P.title.y, 40, PAL.text, { font: DISPLAY, weight: 700, maxW: P.panelL.w - 40 });
  }
  if (free) { if (!wide) txt(ctx, `Page ${Math.round(sess.scroll / PAGE.w) + 1} of 3`, P.chips.x + 8, P.chips.y + 28, 26, PAL.dim, { weight: 600 }); return; }
  // stroke order chips
  const C = P.chips, n = les.strokes.length, e = (() => { for (let i = 0; i < n; i++) if (!sess.done.includes(i)) return i; return n; })();
  const cs = Math.min(wide ? 52 : 46, (C.w - 8) / Math.max(1, n) - 6), per = Math.max(1, Math.floor((C.w + 6) / (cs + 6)));
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / per), col = i % per, cx = C.x + 4 + col * (cs + 6) + cs / 2 + (wide ? 0 : 0), cy = C.y + cs / 2 + 4 + row * (cs + 8);
    const done = sess.done.includes(i), cur = i === e;
    ctx.fillStyle = done ? '#2f9c82' : cur ? PAL.cinnabar : 'rgba(244,236,216,0.12)'; ctx.beginPath(); ctx.arc(cx, cy, cs / 2, 0, Math.PI * 2); ctx.fill();
    if (cur) { ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, cs / 2 + 3, 0, Math.PI * 2); ctx.stroke(); }
    txt(ctx, done ? '✓' : String(i + 1), cx, cy + 1, cs * 0.46, done || cur ? '#fff' : PAL.dim, { align: 'center', weight: 800 });
    if (wide && L.mode === 'wide') { /* names are in the coach panel */ }
  }
  if (!wide && n <= 8) {
    const nm = e < n ? `${TYPES[les.strokes[e].type].cn} ${TYPES[les.strokes[e].type].name}` : 'All strokes written';
    txt(ctx, nm, C.x + 4 + n * (cs + 6) + 10, C.y + cs / 2 + 4, 26, PAL.gold, { weight: 700, font: CJK, maxW: C.w - n * (cs + 6) - 24 });
  }
}
function modelOf(h, les, rect) { return rect ? h.modelImage(les, Math.round(rect.h)) : null; }

// ---- coach box with the ink gauge ----------------------------------------------------------------------------------------------------------------------------------
function drawCoach(ctx, st, L, h, sess, les, free, auto) {
  const P = L.play, C = P.coach;
  if (sess.overlay === 'after') {
    const half = C.w / 2;
    button(ctx, { x: C.x, y: C.y + 8, w: half - 6, h: C.h - 16 }, 'Try again', { kind: 'quiet', size: 30, icon: 'restart' });
    button(ctx, { x: C.x + half + 6, y: C.y + 8, w: half - 6, h: C.h - 16 }, LESSONS.indexOf(les) + 1 < LESSONS.length ? 'Next lesson' : 'Lessons', { kind: 'primary', size: 30, icon: 'next' });
    return;
  }
  panel(ctx, C, { fill: 'rgba(12,20,22,0.78)', rad: 20 });
  // ink gauge: a tone swatch and a load bar (beside the text on tall screens, above it in the side panel)
  const wide = L.mode === 'wide', gr = wide ? 26 : Math.min(26, C.h * 0.26), gx = C.x + 18, gy = wide ? C.y + 20 + gr : C.y + C.h / 2;
  ctx.save();
  ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.arc(gx + gr, gy, gr + 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(14,16,20,${toneAlpha(st.brush.tone)})`; ctx.globalAlpha = st.brush.load > 0.02 ? 1 : 0.15; ctx.beginPath(); ctx.arc(gx + gr, gy, gr, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  let tx, tw, ty0 = C.y, th = C.h;
  if (wide) {
    const bx = gx + gr * 2 + 16, bw = C.x + C.w - 20 - bx;
    ctx.fillStyle = 'rgba(244,236,216,0.14)'; rrect(ctx, { x: bx, y: gy - 6, w: bw, h: 12 }, 6); ctx.fill();
    ctx.fillStyle = st.brush.load < 0.25 ? PAL.cinnabarHi : PAL.jade; rrect(ctx, { x: bx, y: gy - 6, w: Math.max(12, bw * st.brush.load), h: 12 }, 6); ctx.fill();
    txt(ctx, `Ink: ${toneBand(st.brush.tone)}`, bx, gy - 26, 22, PAL.dim, { weight: 600 });
    tx = C.x + 16; tw = C.w - 32; ty0 = C.y + 20 + gr * 2 + 14; th = C.y + C.h - 12 - ty0;
  } else {
    const bx = gx + gr * 2 + 14, bh = Math.min(C.h - 28, 64);
    ctx.fillStyle = 'rgba(244,236,216,0.14)'; rrect(ctx, { x: bx, y: gy - bh / 2, w: 10, h: bh }, 5); ctx.fill();
    ctx.fillStyle = st.brush.load < 0.25 ? PAL.cinnabarHi : PAL.jade; const lh = bh * st.brush.load; rrect(ctx, { x: bx, y: gy + bh / 2 - lh, w: 10, h: lh }, 5); ctx.fill();
    tx = bx + 28; tw = C.x + C.w - 16 - tx; th = C.h - 8;
  }
  const text = free ? (sess.coach && sess.coachT > 0 ? sess.coach : (sess.sealMode ? 'Pick a seal below, then tap the paper to press it.' : st.brush.load <= 0.02 ? 'The brush is empty. Tap Dip to load it with ink.' : 'Paint freely. Slide the scroll with the arrows. Add a seal at the end.')) :
    auto ? autoCaption(sess, les, st) : h.coachFor(sess);
  let size = 28, lines;
  for (; size >= 18; size -= 2) { ctx.font = `600 ${size}px ${UI}`; lines = wrap(ctx, text, tw); if (lines.length * size * 1.28 <= th - 8) break; }
  const lh2 = size * 1.28, y0 = ty0 + th / 2 - (lines.length * lh2) / 2 + lh2 / 2;
  lines.forEach((ln, i) => txt(ctx, ln, tx, y0 + i * lh2, size, PAL.text, { weight: 600 }));
  if (auto && sess.auto && sess.auto.phase === 'think') {   // think countdown
    const f = clamp(sess.auto.t / st.prefs.think, 0, 1);
    ctx.fillStyle = 'rgba(244,236,216,0.12)'; ctx.fillRect(C.x + 18, C.y + C.h - 8, C.w - 36, 4); ctx.fillStyle = PAL.gold; ctx.fillRect(C.x + 18, C.y + C.h - 8, (C.w - 36) * f, 4);
  }
}
function autoCaption(sess, les, st) {
  const a = sess.auto, e = (() => { for (let i = 0; i < les.strokes.length; i++) if (!sess.done.includes(i)) return i; return les.strokes.length; })();
  if (a.phase === 'end') return `${les.cn} ${les.title} is finished. The next lesson starts in a moment.`;
  const t = TYPES[les.strokes[e].type], head = `Stroke ${e + 1} of ${les.strokes.length}: ${t.cn} ${t.name}.`;
  if (a.phase === 'think') return `${head} ${t.why}${a.note ? ' ' + a.note : ''}`;
  if (a.phase === 'reveal') return `${head} Watch where it starts and which way it goes.`;
  return `${head} ${t.why}`;
}

// ---- tools -----------------------------------------------------------------------------------------------------------------------------------------------------------------
function drawTools(ctx, st, L, h, sess, free, auto) {
  const P = L.play, ids = auto ? h.TOOLS.auto : free ? h.TOOLS.free : h.TOOLS.practice;
  ids.forEach((id, i) => {
    const r = P.tools[i]; if (!r) return;
    let label = TOOL_LABEL[id], ic = id, kind = 'quiet';
    if (id === 'size') label = BRUSH.sizes[st.prefs.size].name;
    else if (id === 'guide') label = 'Guide ' + ['Full', 'Light', 'Off'][st.prefs.guide];
    else if (id === 'pause') { label = sess.paused ? 'Resume' : 'Pause'; ic = sess.paused ? 'play' : 'pause'; }
    else if (id === 'skip') ic = 'next';
    else if (id === 'seal' && sess.sealMode) kind = 'primary';
    else if (id === 'keep') { kind = 'gold'; ic = 'save'; }
    if (id === 'dip' && (st.brush.load < 0.2 || st.dipPulse > 0)) kind = 'primary';
    if ((id === 'undo') && (free ? !sess.strokes.length : !sess.strokes.length)) kind = 'disabled';
    if (id === 'left' && sess.scrollTarget <= 0) kind = 'disabled';
    if (id === 'right' && sess.scrollTarget >= PAGE.w * 2) kind = 'disabled';
    toolTile(ctx, r, label, ic, kind);
  });
}
export function toolTile(ctx, r, label, ic, kind) {
  const fills = { quiet: 'rgba(244,236,216,0.12)', primary: '#c8412f', gold: '#e2c37a', disabled: 'rgba(255,255,255,0.05)' };
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; rrect(ctx, { x: r.x, y: r.y + 4, w: r.w, h: r.h }, 16); ctx.fill();
  ctx.fillStyle = fills[kind] ?? fills.quiet; rrect(ctx, r, 16); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(244,236,216,0.22)'; rrect(ctx, r, 16); ctx.stroke();
  const col = kind === 'disabled' ? 'rgba(244,236,216,0.35)' : kind === 'gold' ? '#1a1a14' : '#fff6e6';
  icon(ctx, ic, r.x + r.w / 2, r.y + r.h * 0.38, Math.min(r.h * 0.26, r.w * 0.26), col);
  txt(ctx, label, r.x + r.w / 2, r.y + r.h * 0.78, Math.min(24, r.h * 0.22), col, { align: 'center', weight: 700, maxW: r.w - 8 });
  ctx.restore();
}

export function drawSealRow(ctx, rects, sel) {
  rects.forEach((r, i) => {
    ctx.fillStyle = 'rgba(243,234,211,0.94)'; rrect(ctx, { x: r.x - 3, y: r.y - 3, w: r.w + 6, h: r.h + 6 }, 10); ctx.fill();
    if (i === sel) { ctx.lineWidth = 4; ctx.strokeStyle = PAL.cinnabar; rrect(ctx, { x: r.x - 3, y: r.y - 3, w: r.w + 6, h: r.h + 6 }, 10); ctx.stroke(); }
    paintSeal(ctx, SEALS[i].id, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.82, 0, 3, 1);
  });
}

// ---- overlays ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
function dim(ctx, L) { ctx.fillStyle = 'rgba(5,9,10,0.66)'; ctx.fillRect(0, 0, L.w, L.h); }
function drawPause(ctx, st, L, h, sess, auto) {
  dim(ctx, L);
  const items = h.pauseItems(), M = menuRects(L, items.length, 130);
  panel(ctx, M.panel, { fill: 'rgba(14,24,26,0.96)', rad: 28 }); edgeStroke(ctx, M.panel, 28, 0.3);
  txt(ctx, 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 62, 54, PAL.gold, { align: 'center', font: DISPLAY, weight: 700 });
  items.forEach(([id, label], i) => button(ctx, M.btns[i], label, { kind: i === 0 ? 'primary' : 'ghost', size: 30 }));
}
function drawGrind(ctx, st, L) {
  dim(ctx, L);
  const G = L.grind, g = st.grind;
  panel(ctx, G.panel, { fill: 'rgba(14,24,26,0.97)', rad: 28 }); edgeStroke(ctx, G.panel, 28, 0.3);
  txt(ctx, 'Grind the ink', G.panel.x + G.panel.w / 2, G.panel.y + 58, 50, PAL.gold, { align: 'center', font: DISPLAY, weight: 700 });
  txt(ctx, 'Rub the ink stick in circles on the stone.', G.panel.x + G.panel.w / 2, G.panel.y + 104, 26, PAL.dim, { align: 'center', weight: 500, maxW: G.panel.w - 40 });
  drawStone(ctx, G.stone, st.ink.d, st.t, g && g.stick ? g.stick : { x: G.stone.x + G.stone.rx * 0.25, y: G.stone.y + G.stone.ry * 0.35 });
  // density meter
  const mx = G.panel.x + 40, my = G.done.y - 66, mw = G.panel.w - 80;
  ctx.fillStyle = 'rgba(244,236,216,0.12)'; rrect(ctx, { x: mx, y: my, w: mw, h: 16 }, 8); ctx.fill();
  const gr = ctx.createLinearGradient(mx, 0, mx + mw, 0); gr.addColorStop(0, '#9fb0b0'); gr.addColorStop(1, '#0b0d10');
  ctx.fillStyle = gr; rrect(ctx, { x: mx, y: my, w: Math.max(16, mw * st.ink.d), h: 16 }, 8); ctx.fill();
  const band = toneBand(st.ink.d);
  txt(ctx, `Ink: ${band}`, mx, my - 22, 26, PAL.text, { weight: 700 });
  txt(ctx, 'Then tap Dip to load the brush', mx + mw, my - 22, 22, PAL.dim, { align: 'right', weight: 500, maxW: mw * 0.6 });
  button(ctx, G.done, 'Done', { kind: 'primary', size: 36 });
}
function drawResult(ctx, st, L, ps, les, h) {
  dim(ctx, L);
  const R = L.result, p = R.panel, wide = L.mode === 'wide', thumb = !wide || p.h >= 520;
  panel(ctx, p, { fill: 'rgba(14,24,26,0.97)', rad: 30 }); edgeStroke(ctx, p, 30, 0.35);
  let x0 = p.x + 40, w0 = p.w - 80, titleX = p.x + 130, starCx = p.x + p.w / 2, starY, by;
  const sr = wide ? 40 : 54;
  if (thumb) {                                    // your painting, small, so the brushwork stays in view
    const tw = wide ? 150 : 104, tr = { x: p.x + 28, y: p.y + 24, w: tw, h: tw / 0.75 };
    drawMount(ctx, tr, 5);
    const pimg = paperImage(PAGE.w, PAGE.h, 1.25); if (pimg) ctx.drawImage(pimg, tr.x, tr.y, tr.w, tr.h);
    drawLayer(ctx, h.layer('lesson'), tr);
    titleX = tr.x + tr.w + 22;
    if (wide) { x0 = titleX + 8; w0 = p.x + p.w - 40 - x0; starCx = x0 + w0 / 2; starY = p.y + 150; by = starY + sr + 22; }
    else { starY = tr.y + tr.h + sr + 24; by = starY + sr + 28; }
  } else {
    txt(ctx, les.cn, p.x + 70, p.y + 62, 64, PAL.gold, { align: 'center', font: CJK, weight: 700 });
    starY = p.y + 112; by = starY + sr + 14;
  }
  txt(ctx, ps.stars ? (ps.stars === 3 ? 'Beautifully written' : ps.stars === 2 ? 'Well done' : 'Lesson complete') : 'Keep practising', titleX, p.y + 56, wide ? 42 : 38, PAL.text, { font: DISPLAY, weight: 700, maxW: p.x + p.w - 190 - titleX });
  txt(ctx, `${les.cn} ${les.title}`, titleX, p.y + 98, 26, PAL.dim, { weight: 600, font: CJK });
  button(ctx, R.menu, 'Lessons', { kind: 'ghost', size: 24 });
  for (let i = 0; i < 3; i++) drawStar(ctx, starCx + (i - 1) * sr * 2.4, starY, sr, i < ps.stars, i < ps.stars ? 14 : 0);
  const m = ps.metrics ?? {}, rows = [['Order', m.order], ['Shape', m.shape], ['Rhythm', m.rhythm], ['Tone', m.tone]].filter((q) => q[1] !== null && q[1] !== undefined);
  const rh = wide ? 38 : 48;
  rows.forEach(([name, v], i) => {
    const y = by + i * rh;
    txt(ctx, name, x0, y + 10, 24, PAL.text, { weight: 700 });
    ctx.fillStyle = 'rgba(244,236,216,0.12)'; rrect(ctx, { x: x0 + 120, y: y + 2, w: w0 - 120 - 76, h: 16 }, 8); ctx.fill();
    ctx.fillStyle = v >= 0.8 ? PAL.jade : v >= 0.6 ? PAL.gold : PAL.cinnabarHi; rrect(ctx, { x: x0 + 120, y: y + 2, w: Math.max(14, (w0 - 120 - 76) * v), h: 16 }, 8); ctx.fill();
    txt(ctx, `${Math.round(v * 100)}%`, x0 + w0, y + 10, 24, PAL.dim, { align: 'right', weight: 700 });
  });
  const tipY = by + rows.length * rh + 4, cx = x0 + w0 / 2;
  const worst = ps.res.length ? ps.res.reduce((a, b) => (b.score < a.score ? b : a)) : null;
  if (worst && tipY < R.seals[0].y - 44) { let size = 24; let lines; for (; size >= 18; size -= 2) { ctx.font = `600 ${size}px ${UI}`; lines = wrap(ctx, worst.msg, w0); if (tipY + lines.length * size * 1.3 < R.seals[0].y - 12) break; } lines.slice(0, 3).forEach((ln, i) => txt(ctx, ln, cx, tipY + 12 + i * size * 1.3, size, PAL.dim, { align: 'center', weight: 600 })); }
  // seal row + buttons
  R.seals.forEach((r, i) => {
    const q = { x: r.x, y: r.y, w: r.w, h: r.h };
    ctx.fillStyle = 'rgba(243,234,211,0.94)'; rrect(ctx, q, 12); ctx.fill();
    if (i === ps.sealSel) { ctx.lineWidth = 4; ctx.strokeStyle = PAL.cinnabar; rrect(ctx, q, 12); ctx.stroke(); }
    paintSeal(ctx, SEALS[i].id, q.x + q.w / 2, q.y + q.h / 2, Math.min(q.w, q.h) * 0.8, 0, 3, 1);
  });
  button(ctx, R.retry, 'Try again', { kind: 'quiet', size: 30, icon: 'restart' });
  button(ctx, R.keep, ps.sealed ? 'Kept' : 'Stamp and keep', { kind: 'gold', size: 30, icon: 'seal' });
  button(ctx, R.next, LESSONS.indexOf(les) + 1 < LESSONS.length ? 'Next lesson' : 'Lessons', { kind: 'primary', size: 30, icon: 'next' });
}
