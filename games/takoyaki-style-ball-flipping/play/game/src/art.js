// Scene art: awning, iron plate, the ball (four quarters that slide when flipped), cook ring, tickets, tray, steam, sparks.
// Pure canvas drawing; nothing here changes game state. `t` is the game clock so everything is deterministic and pausable.
import { K, doneness, isReady, FILLINGS, quality } from './engine.js';
import { T, mix, rgba, rr, txt, NUM, UI, fillingIcon, clamp, icons, F, slab } from './ui.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;
const easeOut = (x) => 1 - (1 - x) ** 3;

// ---- doneness colours ---------------------------------------------------------------------------------------------------------------
const STOPS = [[0, '#f7edd2'], [0.28, '#f1dca6'], [0.5, '#e5bb68'], [0.7, '#dca24a'], [0.9, '#cf8a2c'], [1.1, '#b46a1f'], [1.28, '#7c3d14'], [1.45, '#2a150a']];
export function cookColor(q) {
  if (q <= 0) return STOPS[0][1];
  for (let i = 1; i < STOPS.length; i++) if (q <= STOPS[i][0]) { const a = STOPS[i - 1], b = STOPS[i]; return mix(a[1], b[1], (q - a[0]) / (b[0] - a[0])); }
  return STOPS[STOPS.length - 1][1];
}

// ---- awning + backdrop ---------------------------------------------------------------------------------------------------------------
export function drawAwning(ctx, w, topInset, t) {
  if (v3.on) return;
  const h = topInset + 4, n = Math.max(10, Math.round(w / 44)), sw = w / n;
  ctx.save();
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? '#f3e6c8' : T.red;
    ctx.beginPath(); ctx.rect(i * sw, 0, sw + 0.6, h); ctx.fill();
    ctx.beginPath(); ctx.arc(i * sw + sw / 2, h, sw / 2, 0, Math.PI); ctx.fill();
  }
  const g = ctx.createLinearGradient(0, 0, 0, h + sw / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.38)'); g.addColorStop(0.6, 'rgba(0,0,0,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.26)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h + sw / 2);
  // soft lamp glow under the awning
  const lg = ctx.createRadialGradient(w / 2, h + 6, 0, w / 2, h + 6, w * 0.7);
  lg.addColorStop(0, 'rgba(255,190,110,0.16)'); lg.addColorStop(1, 'rgba(255,190,110,0)');
  ctx.fillStyle = lg; ctx.fillRect(0, h, w, w * 0.7);
  ctx.restore();
  void t;
}

// ---- plate ------------------------------------------------------------------------------------------------------------------------------
export function drawPlate(ctx, geo, S, t, flameLvl = 1) {
  const r = geo.rect;
  ctx.save();
  // bed of embers under the plate
  const gr = Math.max(r.w, r.h) * 0.8;
  const glow = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h, 10, r.x + r.w / 2, r.y + r.h, gr);
  glow.addColorStop(0, `rgba(255,120,40,${0.16 + 0.1 * flameLvl})`); glow.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + r.h, gr, 0, TAU); ctx.fill();
  // body
  rr(ctx, r.x + 4, r.y + 8, r.w, r.h, 30); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w * 0.4, r.y + r.h);
  g.addColorStop(0, '#46464d'); g.addColorStop(0.5, T.iron0); g.addColorStop(1, T.iron1);
  rr(ctx, r.x, r.y, r.w, r.h, 30); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.16)'; rr(ctx, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, 28); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; rr(ctx, r.x + 6, r.y + 6, r.w - 12, r.h - 12, 24); ctx.stroke();
  // groove lattice between moulds
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; ctx.beginPath();
  for (let c = 1; c < geo.cols; c++) { const x = r.x + 14 + c * geo.c; ctx.moveTo(x, r.y + 14); ctx.lineTo(x, r.y + r.h - 14); }
  for (let rw = 1; rw < geo.rows; rw++) { const y = r.y + 14 + rw * geo.c; ctx.moveTo(r.x + 14, y); ctx.lineTo(r.x + r.w - 14, y); }
  ctx.stroke();
  // moulds
  for (let i = 0; i < geo.cols * geo.rows; i++) {
    const m = S.plate[i], c = geo.cell(i), rad = c.c * 0.44;
    const hot = clamp((m.hs - 1.0) / 0.4, 0, 1) * (0.5 + 0.5 * flameLvl);
    if (hot > 0.05) {
      const hg = ctx.createRadialGradient(c.cx, c.cy, rad * 0.6, c.cx, c.cy, rad * 1.5);
      hg.addColorStop(0, `rgba(255,110,40,${0.5 * hot * (0.85 + 0.15 * Math.sin(t * 3 + i))})`); hg.addColorStop(1, 'rgba(255,110,40,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(c.cx, c.cy, rad * 1.5, 0, TAU); ctx.fill();
    }
    const dg = ctx.createRadialGradient(c.cx - rad * 0.2, c.cy - rad * 0.25, rad * 0.1, c.cx, c.cy, rad);
    dg.addColorStop(0, '#2c2c31'); dg.addColorStop(0.75, '#111114'); dg.addColorStop(1, '#050506');
    ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(c.cx, c.cy, rad, 0, TAU); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.beginPath(); ctx.arc(c.cx, c.cy, rad, Math.PI * 0.9, Math.PI * 1.9); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.arc(c.cx, c.cy, rad, -Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
  }
  ctx.restore();
}

// ---- the ball ---------------------------------------------------------------------------------------------------------------------------
function bands(ctx, cx, cy, R, m, e) {
  // four quarters around a horizontal axis seen from above: angle phi from the top, centre band = top quarter.
  for (let k = 0; k < 4; k++) {
    const p = (k - m.b + 4) % 4;                 // 0 bottom (hidden), 1 and 3 sides, 2 top
    const phi = ((p - 2) * 90 + 90 * (1 - e)) * Math.PI / 180;
    for (const shift of [0, TAU, -TAU]) {
      const a = phi + shift - Math.PI / 4, b = phi + shift + Math.PI / 4;
      if (b <= -Math.PI / 2 || a >= Math.PI / 2) continue;
      const y1 = Math.sin(clamp(a, -Math.PI / 2, Math.PI / 2)) * R, y2 = Math.sin(clamp(b, -Math.PI / 2, Math.PI / 2)) * R;
      ctx.fillStyle = cookColor(m.q[k]);
      ctx.fillRect(cx - R - 1, cy + y1 - 0.5, 2 * R + 2, y2 - y1 + 1);
    }
  }
}

// opts: ring (show the cook ring), sel (highlight), hint (planner target pulse), tag (show filling tag)
export function drawBall(ctx, c, m, t, opts = {}) {
  const { cx, cy, r } = c;
  if (m.st === 'empty') return;
  if (v3.on && opts.live) { overlay3(ctx, c, m, t, opts); return; }   // the ball itself is a lit 3D mesh: only the gauges draw here
  const fillK = clamp(m.fill / 0.95, 0, 1.15), burnt = m.st === 'burnt';
  const R = r * (0.62 + 0.38 * Math.min(1, fillK)) * (fillK > 1 ? 1 + (fillK - 1) * 0.35 : 1);
  const fe = m.flipT < 0.34 ? m.flipT / 0.34 : 1, e = easeOut(fe), pop = m.flipT < 0.34 ? Math.sin(Math.PI * fe) : 0;
  const lift = pop * r * 0.28, sq = 1 + pop * 0.1;
  ctx.save();
  // overflow skirt
  if (m.ovf > 0) { ctx.fillStyle = `rgba(247,234,196,${clamp(m.ovf * 1.3, 0.2, 0.7)})`; ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.08, r * 1.0, 0, 0, TAU); ctx.fill(); }
  const liquid = m.flips === 0 && m.q[m.b] < K.RAW;
  if (m.fill < 0.35) {
    ctx.fillStyle = 'rgba(247,232,190,0.85)'; ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.62, r * 0.55, 0, 0, TAU); ctx.fill();
    ctx.restore(); return;
  }
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(cx + R * 0.1, cy + R * 0.22, R * 0.98, R * 0.8, 0, 0, TAU); ctx.fill();
  ctx.translate(cx, cy - lift); ctx.scale(1, sq);
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.save(); ctx.clip();
  if (burnt) { ctx.fillStyle = '#1f130b'; ctx.fillRect(-R, -R, 2 * R, 2 * R); }
  else if (liquid) {
    ctx.fillStyle = cookColor(m.q[m.b] * 0.8); ctx.fillRect(-R, -R, 2 * R, 2 * R);
  } else bands(ctx, 0, 0, R, m, e);
  // seeded speckle: browned flecks that grow with doneness
  if (!liquid) {
    const mean = m.q.reduce((a, q) => a + q, 0) / 4;
    for (let n = 0; n < 9; n++) {
      const a = (n * 2.399 + m.i * 1.7) % TAU, d = ((n * 0.37 + m.i * 0.11) % 1) * R * 0.85;
      ctx.fillStyle = `rgba(90,40,10,${clamp(0.06 + mean * 0.18, 0, 0.32)})`; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, R * 0.05, 0, TAU); ctx.fill();
    }
  }
  // sphere shading
  const sh = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R * 1.05);
  sh.addColorStop(0, 'rgba(255,255,255,0.42)'); sh.addColorStop(0.35, 'rgba(255,255,255,0.05)'); sh.addColorStop(0.75, 'rgba(40,12,0,0.12)'); sh.addColorStop(1, 'rgba(25,8,0,0.55)');
  ctx.fillStyle = sh; ctx.fillRect(-R, -R, 2 * R, 2 * R);
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(40,18,4,0.55)'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  // wet gloss on raw batter, specular on cooked
  if (liquid) { ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.arc(0, 0, R * (0.35 + 0.25 * ((t * 0.7 + k * 0.5) % 1)), 0, TAU); ctx.globalAlpha = 0.5 * (1 - ((t * 0.7 + k * 0.5) % 1)); ctx.stroke(); } ctx.globalAlpha = 1; }
  ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.beginPath(); ctx.ellipse(-R * 0.38, -R * 0.42, R * 0.2, R * 0.1, -0.7, 0, TAU); ctx.fill();
  ctx.restore();
  // ready glow
  if (isReady(m) && !burnt) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 6);
    ctx.save(); ctx.strokeStyle = `rgba(255,240,170,${0.5 + 0.4 * pulse})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy - lift, R + 5 + pulse * 3, 0, TAU); ctx.stroke(); ctx.restore();
  }
  // filling tag
  if (m.fil && opts.tag !== false) {
    const tr = Math.max(13, r * 0.3), tx = cx + r * 0.78, ty = cy + r * 0.74;
    ctx.save(); ctx.fillStyle = 'rgba(20,12,8,0.82)'; ctx.beginPath(); ctx.arc(tx, ty, tr, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.stroke();
    fillingIcon(ctx, m.fil, tx, ty, tr * 1.5); ctx.restore();
  }
  if (opts.ring && !burnt) drawRing(ctx, cx, cy, r * 1.15, m, t);
  if (opts.sel) { ctx.save(); ctx.strokeStyle = T.accent; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.arc(cx, cy, r * 1.28, 0, TAU); ctx.stroke(); ctx.restore(); }
}

// Gauges drawn over the 3D ball: ready pulse, filling tag, cook ring (lying on the pan plane), planner target.
function overlay3(ctx, c, m, t, opts) {
  const { cx, cy, r } = c, ky = c.ky || 0.8, burnt = m.st === 'burnt', fillK = clamp(m.fill / 0.95, 0, 1.15);
  if (m.fill < 0.35) return;
  const lift = r * 0.55 * ky;
  if (m.fill >= 0.35 && fillK > 0 && opts.tag !== false && m.fil) {
    const tr = Math.max(13, r * 0.3), tx = cx + r * 0.82, ty = cy + r * 0.62 * ky + tr * 0.2;
    ctx.save(); ctx.fillStyle = 'rgba(20,12,8,0.82)'; ctx.beginPath(); ctx.arc(tx, ty, tr, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; ctx.stroke();
    fillingIcon(ctx, m.fil, tx, ty, tr * 1.5); ctx.restore();
  }
  if (opts.ring && !burnt && m.st === 'ball') { ctx.save(); ctx.translate(cx, cy + lift * 0.1); ctx.scale(1, ky); drawRing(ctx, 0, 0, r * 1.15, m, t); ctx.restore(); }
  if (opts.sel) { ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ky); ctx.strokeStyle = T.accent; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.arc(0, 0, r * 1.28, 0, TAU); ctx.stroke(); ctx.restore(); }
}

// Cook ring: the bottom quarter's doneness against its zones. Starts at 12 o'clock, runs clockwise.
export function drawRing(ctx, cx, cy, rad, m, t) {
  const total = K.BURN, a0 = -Math.PI / 2, ang = (v) => a0 + (v / total) * TAU, q = clamp(m.q[m.b], 0, total);
  const lw = Math.max(5, rad * 0.11);
  const zones = [[0, K.RAW, '#7e9bc4'], [K.RAW, K.GOLD, '#e9b34c'], [K.GOLD, K.GOLD_END, '#8be08a'], [K.GOLD_END, total, '#ff6a55']];
  ctx.save(); ctx.lineCap = 'butt'; ctx.lineWidth = lw;
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.stroke();
  for (const [a, b, col] of zones) {
    ctx.strokeStyle = col; ctx.globalAlpha = 0.32; ctx.beginPath(); ctx.arc(cx, cy, rad, ang(a), ang(b)); ctx.stroke();
    if (q > a) { ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(cx, cy, rad, ang(a), ang(Math.min(b, q))); ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
  const ax = cx + Math.cos(ang(q)) * rad, ay = cy + Math.sin(ang(q)) * rad;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ax, ay, lw * 0.85, 0, TAU); ctx.fill(); ctx.stroke();
  // "flip now" cue: a gentle pulse around the golden band's start
  if (q >= K.FLIP_AT && q <= K.GOLD_END && !isReady(m)) { ctx.strokeStyle = `rgba(139,224,138,${0.35 + 0.35 * Math.sin(t * 9)})`; ctx.lineWidth = lw * 1.8; ctx.beginPath(); ctx.arc(cx, cy, rad + lw, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

// ---- steam + smoke -------------------------------------------------------------------------------------------------------------------
export function drawSteam(ctx, c, m, t) {
  if (v3.on) return;
  if (m.st === 'empty' || m.fill < 0.35) return;
  const burnt = m.st === 'burnt', n = burnt ? 4 : 2, base = clamp(m.q[m.b] / 1.0, 0.15, 1);
  ctx.save();
  for (let k = 0; k < n; k++) {
    const ph = (t * (burnt ? 0.45 : 0.3) + k / n + m.i * 0.173) % 1;
    const x = c.cx + Math.sin(ph * 6 + k * 2 + m.i) * c.r * 0.35, y = c.cy - c.r * (0.4 + ph * 1.7), rad = c.r * (0.22 + ph * 0.38);
    ctx.fillStyle = burnt ? `rgba(30,25,24,${0.5 * (1 - ph)})` : `rgba(255,255,255,${0.2 * base * (1 - ph)})`;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---- tickets ----------------------------------------------------------------------------------------------------------------------------
const patColor = (f) => (f > 0.5 ? mix('#e9b34c', '#8be08a', (f - 0.5) * 2) : mix('#ff6a55', '#e9b34c', f * 2));
export function drawTicket(ctx, r, cust, mode, t, S) {
  const age = cust ? S.t - cust.born : 0, slide = cust ? 1 - easeOut(clamp(age / 0.35, 0, 1)) : 0;
  ctx.save();
  if (!cust) {
    ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(255,240,215,0.2)'; ctx.lineWidth = 2; rr(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 14); ctx.stroke();
    txt(ctx, 'Next customer', r.x + r.w / 2, r.y + r.h / 2, { size: 20, weight: 500, color: T.faint, align: 'center', maxW: r.w - 16 });
    ctx.restore(); return;
  }
  const out = cust.st !== 'wait' ? clamp(cust.exit / 1.2, 0, 1) : 0;
  ctx.globalAlpha = 1 - out * 0.85; ctx.translate(0, -slide * 30 - out * 14);
  const f = clamp(cust.pat / cust.patMax, 0, 1), urgent = f < 0.25 && cust.st === 'wait';
  const jig = urgent ? Math.sin(t * 30) * 1.5 : 0;
  ctx.translate(jig, 0);
  const hh = mode === 'card' ? 30 : r.h, hdrCol = cust.st === 'happy' ? '#3f9b4a' : cust.st === 'gone' ? '#7a7a7a' : T.red;
  if (v3.on) {
    // lit paper ticket (the presenter draws the slab, header strip and the customer bust); the text below stays 2D
    const rr3 = { x: r.x + jig, y: r.y - slide * 30 - (cust.st !== 'wait' ? clamp(cust.exit / 1.2, 0, 1) * 14 : 0), w: r.w, h: r.h };
    slab(ctx, rr3, { radius: 14, kind: 'ticket', hdr: hdrCol, hdrSide: mode === 'card' ? 'top' : 'left', hdrH: mode === 'card' ? hh : 54, alpha: 1 - out * 0.85, urgent });
    const bw = mode === 'card' ? 60 : 50, bh = mode === 'card' ? 68 : Math.min(r.h - 8, 72);
    v3.custs.push({ r: mode === 'card' ? { x: rr3.x + rr3.w - bw - 6, y: rr3.y - 16, w: bw, h: bh } : { x: rr3.x + 2, y: rr3.y + (r.h - bh) / 2, w: bw, h: bh }, id: cust.id, st: cust.st, f, urgent, no: cust.no, alpha: 1 - out * 0.85 });
  } else {
  rr(ctx, r.x + 3, r.y + 5, r.w, r.h, 14); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
  rr(ctx, r.x, r.y, r.w, r.h, 14); ctx.fillStyle = T.paper; ctx.fill();
  // red header
  ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, 14); ctx.clip();
  ctx.fillStyle = hdrCol;
  if (mode === 'card') ctx.fillRect(r.x, r.y, r.w, hh); else ctx.fillRect(r.x, r.y, 54, r.h);
  // perforation dots
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; if (mode === 'card') for (let x = r.x + 8; x < r.x + r.w - 4; x += 12) { ctx.beginPath(); ctx.arc(x, r.y + hh, 2, 0, TAU); ctx.fill(); }
  ctx.restore();
  }
  const lines = cust.lines;
  if (mode === 'card') {
    txt(ctx, `No. ${cust.no}`, r.x + 12, r.y + hh / 2 + 1, { size: 24, weight: 800, color: '#fff', fam: NUM, maxW: r.w * 0.5 });
    const rowsTop = r.y + hh + 6, avail = r.h - hh - 18, rh = Math.min(38, avail / Math.max(1, lines.length));
    lines.forEach((l, i) => {
      const y = rowsTop + i * rh + rh / 2, isz = Math.min(rh * 0.95, 34);
      fillingIcon(ctx, l.fil ?? 'plain', r.x + 12 + isz / 2, y, isz);
      const dr = Math.min(8, rh * 0.28);
      for (let d = 0; d < l.need; d++) {
        const dx = r.x + 16 + isz + d * (dr * 2.5) + dr;
        ctx.beginPath(); ctx.arc(dx, y, dr, 0, TAU);
        if (d < l.got) { ctx.fillStyle = '#e0a02a'; ctx.fill(); } else { ctx.strokeStyle = 'rgba(42,27,18,0.55)'; ctx.lineWidth = 2; ctx.stroke(); }
      }
    });
    // patience bar
    const bx = r.x + 10, bw = r.w - 20, by = r.y + r.h - 12;
    rr(ctx, bx, by, bw, 6, 3); ctx.fillStyle = 'rgba(42,27,18,0.18)'; ctx.fill();
    rr(ctx, bx, by, Math.max(4, bw * f), 6, 3); ctx.fillStyle = patColor(f); ctx.fill();
  } else {
    if (v3.on) txt(ctx, `${cust.no}`, r.x + 62, r.y + 18, { size: 22, weight: 800, color: T.ink, fam: NUM, align: 'center' }); else txt(ctx, `${cust.no}`, r.x + 27, r.y + r.h / 2 + 1, { size: 38, weight: 800, color: '#fff', fam: NUM, align: 'center' });
    const x0 = r.x + 66, aw = r.w - 78, rowH = Math.min(34, (r.h - 22) / Math.max(1, Math.ceil(lines.length / 2))), per = 2, cw = aw / per;
    lines.forEach((l, i) => {
      const cxx = x0 + (i % per) * cw, y = r.y + 8 + Math.floor(i / per) * rowH + rowH / 2, isz = Math.min(rowH * 0.95, 30);
      fillingIcon(ctx, l.fil ?? 'plain', cxx + isz / 2, y, isz);
      const dr = Math.min(7, rowH * 0.24);
      for (let d = 0; d < l.need; d++) {
        const dx = cxx + isz + 6 + d * (dr * 2.4) + dr;
        ctx.beginPath(); ctx.arc(dx, y, dr, 0, TAU);
        if (d < l.got) { ctx.fillStyle = '#e0a02a'; ctx.fill(); } else { ctx.strokeStyle = 'rgba(42,27,18,0.55)'; ctx.lineWidth = 2; ctx.stroke(); }
      }
    });
    const bx = x0, bw = aw, by = r.y + r.h - 13;
    rr(ctx, bx, by, bw, 6, 3); ctx.fillStyle = 'rgba(42,27,18,0.18)'; ctx.fill();
    rr(ctx, bx, by, Math.max(4, bw * f), 6, 3); ctx.fillStyle = patColor(f); ctx.fill();
  }
  if (cust.st !== 'wait') {
    ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.rotate(-0.18);
    ctx.font = `800 ${Math.min(34, r.h * 0.34)}px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const word = cust.st === 'happy' ? 'THANKS!' : 'LEFT', col = cust.st === 'happy' ? '#2f8a3a' : '#7a2d22', wd = ctx.measureText(word).width + 20;
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(246,236,213,0.88)'; rr(ctx, -wd / 2, -r.h * 0.2, wd, r.h * 0.4, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col; ctx.fillText(word, 0, 1);
    ctx.restore();
  }
  ctx.restore();
}

// ---- warm tray -----------------------------------------------------------------------------------------------------------------------
export function drawTray(ctx, r, S, t) {
  ctx.save();
  slab(ctx, r, { radius: 16, fill: 'rgba(255,240,215,0.07)', line: T.line, kind: 'tray' });
  txt(ctx, 'WARM TRAY', r.x + 14, r.y + 17, { size: F(17), weight: 800, color: T.faint, fam: NUM });
  const n = K.TRAY, sw = Math.min(r.h * 1.05, (r.w - 130) / n), x0 = r.x + r.w - n * sw - 8;
  for (let i = 0; i < n; i++) {
    const cx = x0 + i * sw + sw / 2, cy = r.y + r.h / 2 + 2, b = S.tray[i], rad = Math.min(sw, r.h) * 0.36;
    // paper boat slot
    ctx.fillStyle = v3.on ? 'rgba(246,236,213,0.28)' : 'rgba(246,236,213,0.16)'; ctx.beginPath(); ctx.ellipse(cx, cy + rad * 0.2, rad * 1.1, rad * 0.9, 0, 0, TAU); ctx.fill();
    if (b && v3.on) { v3.trays.push({ x: cx, y: cy - rad * 0.1, r: rad * 1.02, fil: b.fil, q: b.q, i }); if (b.fil) { ctx.fillStyle = 'rgba(20,12,8,0.8)'; ctx.beginPath(); ctx.arc(cx + rad * 0.7, cy + rad * 0.65, rad * 0.4, 0, TAU); ctx.fill(); fillingIcon(ctx, b.fil, cx + rad * 0.7, cy + rad * 0.65, rad * 0.62); } }
    else if (b) {
      const g = ctx.createRadialGradient(cx - rad * 0.3, cy - rad * 0.4, rad * 0.1, cx, cy, rad);
      g.addColorStop(0, '#f3c565'); g.addColorStop(0.6, '#d9993a'); g.addColorStop(1, '#8a4a14');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(cx - rad * 0.35, cy - rad * 0.4, rad * 0.22, rad * 0.11, -0.7, 0, TAU); ctx.fill();
      if (b.fil) { ctx.fillStyle = 'rgba(20,12,8,0.8)'; ctx.beginPath(); ctx.arc(cx + rad * 0.7, cy + rad * 0.65, rad * 0.4, 0, TAU); ctx.fill(); fillingIcon(ctx, b.fil, cx + rad * 0.7, cy + rad * 0.65, rad * 0.62); }
      const s = 0.5 + 0.5 * Math.sin(t * 3 + i); ctx.fillStyle = `rgba(255,255,255,${0.1 * s})`; ctx.beginPath(); ctx.arc(cx, cy - rad * 1.2 - s * 4, rad * 0.3, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}

// ---- hearts and stars ----------------------------------------------------------------------------------------------------------------------
export function drawHearts(ctx, x, y, size, have, total) {
  for (let i = 0; i < total; i++) icons.heart(ctx, x + i * size * 1.15 + size / 2, y, size, i < have ? '#ff6a55' : 'rgba(255,255,255,0.18)');
}

// A paper boat of finished balls with sauce, for the result screen and the title hero.
export function drawBoat(ctx, r, t, n = 6, seed = 1) {
  if (v3.on) return;   // the lit 3D boat is drawn by the presenter (result screen) or comes from sprites (rules figure)
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, W = Math.min(r.w * 0.9, r.h * 1.7), H = W * 0.42;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx, cy + H * 0.62, W * 0.52, H * 0.22, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(0, cy - H / 2, 0, cy + H / 2);
  g.addColorStop(0, '#f3e6c8'); g.addColorStop(1, '#c9b58a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - W / 2, cy - H * 0.1); ctx.quadraticCurveTo(cx, cy - H * 0.35, cx + W / 2, cy - H * 0.1); ctx.lineTo(cx + W * 0.4, cy + H * 0.5); ctx.lineTo(cx - W * 0.4, cy + H * 0.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(120,90,50,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  const per = Math.ceil(n / 2), br = Math.min(W / (per * 2.25), H * 0.62);
  for (let i = 0; i < n; i++) {
    const row = i < per ? 0 : 1, col = row ? i - per : i, cnt = row ? n - per : per;
    const x = cx + (col - (cnt - 1) / 2) * br * 2.1 + (row ? br * 0.4 : 0), y = cy - H * 0.2 + row * br * 0.95 - br * 0.15;
    const gg = ctx.createRadialGradient(x - br * 0.35, y - br * 0.4, br * 0.1, x, y, br);
    gg.addColorStop(0, '#f6cf75'); gg.addColorStop(0.55, '#d8953a'); gg.addColorStop(1, '#7d4412');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, br, 0, TAU); ctx.fill();
    // sauce zigzag + green flecks
    ctx.strokeStyle = 'rgba(70,28,8,0.85)'; ctx.lineWidth = Math.max(2, br * 0.12); ctx.lineCap = 'round'; ctx.beginPath();
    for (let k = 0; k <= 5; k++) { const px = x - br * 0.62 + k * br * 0.25, py = y - br * 0.15 + (k % 2 ? br * 0.14 : -br * 0.14); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,248,225,0.9)'; ctx.lineWidth = Math.max(1.5, br * 0.07); ctx.beginPath();
    for (let k = 0; k <= 4; k++) { const px = x - br * 0.5 + k * br * 0.25, py = y + br * 0.12 + (k % 2 ? -br * 0.1 : br * 0.1); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.stroke();
    ctx.fillStyle = '#7bd35a'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + Math.cos(k * 2.1 + seed + i) * br * 0.45, y + Math.sin(k * 2.1 + seed * 2 + i) * br * 0.4, br * 0.06, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(x - br * 0.4, y - br * 0.45, br * 0.2, br * 0.1, -0.7, 0, TAU); ctx.fill();
    // steam
    const ph = (t * 0.35 + i * 0.21) % 1; ctx.fillStyle = `rgba(255,255,255,${0.16 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x + Math.sin(ph * 5 + i) * br * 0.3, y - br * (1 + ph * 1.3), br * (0.3 + ph * 0.3), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// Plate of synthetic balls for the title hero (a slow loop of flips) and for Rules figures.
export function demoMould(i, q, b = 0, flipT = 9) { return { i, hs: 1, st: 'ball', fill: 0.95, fil: null, q, b, flips: 1, spill: 0, ovf: 0, flipT, age: 0, ready: false }; }
export { quality, FILLINGS, doneness, rgba };
