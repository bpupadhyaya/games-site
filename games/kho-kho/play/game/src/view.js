// Everything drawn each frame. Reads `state` (game.js) and changes nothing. The court is a cached layer (art.js); every position comes
// from the layout `L` for the live screen size (layout.js) and the court is drawn in canonical space through one transform.
import { CW, CH, TEXT_SCALES, AUTO_THINK_STEPS } from './layout.js';
import { drawBackdrop, drawCourt, drawPole, drawAthlete, drawSeated, skinFor, CHASER, RUNNER } from './art.js';
import { COURT, SEAT_Y, POLE_Y, RUNNERS, BATCHES, INNINGS, LEVELS, legalSeats, HINTS } from './engine.js';
import { flowOf, MAX_POINTS } from './pages.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { plaque, chalkboard, title3d, icon } from './chrome.js';

const DISPLAY = '"Dela Gothic One", "Arial Black", system-ui, sans-serif', BODY = '"Barlow", "Trebuchet MS", system-ui, sans-serif', NUM = '"Barlow Condensed", "Barlow", system-ui, sans-serif';
const TAU = Math.PI * 2, GOLD = '#ffcf5a', CREAM = '#f4f1ff', INK = '#0b0e2a', PLATE = '9,12,38', TEAL = '#46e6d4', CORAL = '#ff8a50';
const R4 = (x, y, w, h) => ({ x, y, w, h });

// How far the current reader page overflows its viewport (set while drawing; game.js clamps scrolling with it).
export const reader = { max: 0 };
const flowCache = new Map();

export function render(ctx, state, L) { ctx.save(); draw(ctx, state, L); ctx.restore(); }

function draw(ctx, state, L) {
  const ts = TEXT_SCALES[state.textScaleIdx] ?? 1, bs = Math.min(ts, 1.16), sc = state.scene, t = state.t;
  const W_ = L.w, H_ = L.h, FL = L.minText;
  const font = (w, size, fam = BODY) => `${w} ${size}px ${fam}`;
  const text = (str, x, y, size, color = CREAM, align = 'center', weight = 600, fam = BODY) => { ctx.textAlign = align; ctx.font = font(weight, Math.max(size, FL), fam); ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const fit = (str, maxW, size, weight = 600, fam = BODY) => { let s = size; const lo = FL * 0.85; ctx.font = font(weight, s, fam); while (s > lo && ctx.measureText(str).width > maxW) { s = Math.max(lo, s * 0.93); ctx.font = font(weight, s, fam); } return s; };
  const fitText = (str, x, y, size, maxW, color = CREAM, align = 'center', weight = 600, fam = BODY) => { const s = fit(str, maxW, Math.max(size, FL), weight, fam); ctx.textAlign = align; ctx.font = font(weight, s, fam); ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const lines = (str, size, maxW, weight = 500) => {
    ctx.font = font(weight, size); const out = [];
    for (const para of String(str).split('\n')) { let cur = ''; for (const w of para.split(' ')) { const tt = cur ? cur + ' ' + w : w; if (ctx.measureText(tt).width > maxW && cur) { out.push(cur); cur = w; } else cur = tt; } out.push(cur); }
    return out;
  };
  const wrap = (str, x, y, size, maxW, color = CREAM, lh = size * 1.28, align = 'center', weight = 500) => { size = Math.max(size, FL); const out = lines(str, size, maxW, weight); out.forEach((ln, i) => text(ln, x, y + i * lh, size, color, align, weight)); return out.length; };
  const wrapIn = (str, r, size, color = CREAM, o = {}) => {
    const align = o.align ?? 'center', weight = o.weight ?? 500, pad = o.pad ?? 12, tw = r.w - 2 * pad; let s = Math.max(size, FL), out;
    for (;;) { out = lines(str, s, tw, weight); if (out.length * s * 1.26 <= r.h - 2 * (o.vpad ?? 6) || s <= FL) break; s = Math.max(FL, s * 0.94); }
    const lh = s * 1.26, total = out.length * lh, y0 = o.vc ? r.y + (r.h - total) / 2 : r.y + (o.vpad ?? 6);
    const x = align === 'center' ? r.x + r.w / 2 : align === 'left' ? r.x + pad : r.x + r.w - pad;
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
    out.forEach((ln, i) => text(ln, x, y0 + s * 0.92 + i * lh, s, color, align, weight)); ctx.restore(); return s;
  };
  const shadowText = (str, x, y, size, color, align = 'center', weight = 600, maxW = 0, fam = DISPLAY) => { const s = maxW ? fit(str, maxW, Math.max(size, FL), weight, fam) : size; text(str, x + 2, y + 4, s, 'rgba(0,0,10,0.7)', align, weight, fam); text(str, x, y, s, color, align, weight, fam); };
  const button = (r, label, o = {}) => {
    ctx.save();
    const press = o.press ? 3 : 0;
    const tone = o.primary ? 'gold' : o.kho && !o.dim ? 'teal' : 'teak';
    plaque(ctx, r, { tone, press, dim: !!o.dim });
    if (o.dim) ctx.globalAlpha = 0.5;
    const want = (o.size ?? (r.h > 80 ? 30 : 24)) * (o.noscale ? 1 : Math.min(bs, 1.08)), sub = o.sub && r.h >= 74 ? o.sub : '';
    let ic = o.icon && r.h >= 56 ? Math.min(r.h * 0.42, 30) : 0, icw = ic ? ic + 10 : 0;
    if (ic) { const w0 = fit(label, r.w - 40, want, 400, DISPLAY); ctx.font = font(400, w0, DISPLAY); if (ctx.measureText(label).width + icw + 36 > r.w) { ic = 0; icw = 0; } }
    const s = label ? fit(label, r.w - 40 - icw, want, 400, DISPLAY) : want, cy = r.y + press + (sub ? r.h * 0.42 : r.h / 2);
    const light = o.primary || (o.kho && !o.dim);
    if (label) {
      ctx.font = font(400, s, DISPLAY); const tw = ctx.measureText(label).width, x0 = r.x + r.w / 2 + icw / 2;
      if (ic) icon(ctx, o.icon, x0 - tw / 2 - ic / 2 - 6, cy, ic, light ? '#4a2a00' : '#ffe6a0');
      // engraved / embossed lettering
      text(label, x0, cy + s * 0.34 + 1.5, s, light ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.7)', 'center', 400, DISPLAY);
      text(label, x0, cy + s * 0.34, s, light ? '#3a1f00' : '#fff4d6', 'center', 400, DISPLAY);
    }
    if (sub) { ctx.font = font(600, FL); if (ctx.measureText(sub).width <= r.w - 40) text(sub, r.x + r.w / 2, r.y + r.h - 14, FL, light ? 'rgba(58,31,0,0.8)' : 'rgba(255,240,210,0.78)', 'center', 600); }
    ctx.restore();
  };
  const panel = (r, a = 0.8, rad = 26) => { chalkboard(ctx, r, Math.min(rad, 28)); void a; };
  let curP = null;
  const inCourt = (P, shake, fn) => {
    curP = P; ctx.save(); ctx.translate(P.cx + (shake?.x ?? 0), P.cy + (shake?.y ?? 0)); if (P.rot) ctx.rotate(Math.PI / 2);
    ctx.scale(P.f, P.f); ctx.translate(-CW / 2, -CH / 2); fn(); ctx.restore();
  };
  const toScr = (P, X, Y) => (P.rot ? { x: P.cx - (Y - CH / 2) * P.f, y: P.cy + (X - CW / 2) * P.f } : { x: P.cx + (X - CW / 2) * P.f, y: P.cy + (Y - CH / 2) * P.f });
  const SP = COURT.spine;

  // -------------------------------------------------------------- the court scene (title attract, play, auto)
  const courtScene = (b, o) => {
    const cal = state.calm;
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    const legal = o.live && b.mode === 'chase' ? legalSeats(b) : [];
    const a = b.active;
    const c3 = globalThis.__court3d, g3 = c3 && c3.ok && !c3.lost && c3.ready ? c3 : null;
    const pending = !g3 && c3 && c3.pending;
    // ---- markers that lie on the ground (drawn into the 3D ground layer when the 3D picture is up, onto the court otherwise)
    const marks = (ctx, withRings) => {
      for (const s of b.seats) {
        if (!legal.includes(s.i)) continue;
        const al = 0.45 + 0.4 * pulse;
        ctx.save(); ctx.strokeStyle = `rgba(90,255,230,${al})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(SP, s.y, 40, 0, TAU); ctx.stroke();
        ctx.fillStyle = `rgba(70,230,212,${al * 0.3})`; ctx.fill(); ctx.restore();
      }
      if (o.live && b.mode === 'chase' && a.tx != null) {
        ctx.save(); ctx.setLineDash([4, 10]); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.tx, a.ty); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = TEAL; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(a.tx, a.ty, 12 + 3 * pulse, 0, TAU); ctx.stroke(); ctx.restore();
      }
      if (o.live && b.mode === 'defend') {
        const r = b.runners[b.sel];
        if (r && !r.out && r.human) { ctx.save(); ctx.setLineDash([4, 10]); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.tx, r.ty); ctx.stroke(); ctx.setLineDash([]); ctx.strokeStyle = CORAL; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(r.tx, r.ty, 12 + 3 * pulse, 0, TAU); ctx.stroke(); ctx.restore(); }
      }
      if ((o.live && a.lock !== 0 && b.mode !== 'defend') || (o.guide && a.lock !== 0 && o.live !== false)) {
        const dy = -a.lock * 38;      // the blocked way: a red bar behind the chaser
        ctx.save(); ctx.strokeStyle = `rgba(255,90,80,${0.55 + 0.25 * pulse})`; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(a.x - 30, a.y + dy); ctx.lineTo(a.x + 30, a.y + dy); ctx.stroke(); ctx.restore();
      }
      if (withRings) {
        const sel = o.live && b.mode === 'defend' ? b.runners[b.sel] : null;
        if (sel && !sel.out) { ctx.save(); ctx.strokeStyle = 'rgba(255,236,140,0.95)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(sel.x, sel.y, 30, 0, TAU); ctx.stroke(); ctx.restore(); }
        if (o.live && b.mode === 'chase') { ctx.save(); ctx.strokeStyle = 'rgba(70,230,212,0.95)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(a.x, a.y, 32, 0, TAU); ctx.stroke(); ctx.restore(); }
      }
    };
    // the hint and the effects that lie on the ground
    const marksTop = (ctx) => {
      if (o.hint) {
        const h = o.hint, k = 0.7 + 0.3 * Math.sin(t * 9);
        ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = GOLD; ctx.fillStyle = GOLD; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.setLineDash([2, 14]);
        const from = h.kind === 'run' ? b.runners[b.sel] : a;
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(h.x, h.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(h.x, h.y, 20, 0, TAU); ctx.stroke();
        if (h.kind === 'kho') { ctx.fillStyle = 'rgba(255,207,90,0.28)'; ctx.beginPath(); ctx.arc(SP, SEAT_Y[h.seat], 44, 0, TAU); ctx.fill(); ctx.stroke(); }
        if (h.kind === 'chase' && h.rid >= 0) { const r = b.runners[h.rid]; if (r && !r.out) { ctx.beginPath(); ctx.arc(r.x, r.y, 38, 0, TAU); ctx.stroke(); } }
        ctx.restore();
      }
      for (const f of state.fx) {
        const k = f.t / f.dur;
        if (f.type === 'ring') { ctx.strokeStyle = `rgba(255,248,220,${0.85 * (1 - k)})`; ctx.lineWidth = 4 * (1 - k) + 1; ctx.beginPath(); ctx.arc(f.x, f.y, (10 + k * 60 * f.s) * (cal ? 0.6 : 1), 0, TAU); ctx.stroke(); }
        else if (f.type === 'dust') { ctx.fillStyle = `rgba(255,214,170,${0.55 * (1 - k)})`; ctx.beginPath(); ctx.arc(f.x + f.vx * f.t, f.y + f.vy * f.t, 5 + k * 12, 0, TAU); ctx.fill(); }
      }
    };
    // stars and the flash are in the air: always drawn over the picture
    const air = (ctx) => {
      for (const f of state.fx) {
        const k = f.t / f.dur;
        if (f.type === 'star') { ctx.save(); ctx.translate(f.x + f.vx * f.t, f.y + f.vy * f.t + 140 * f.t * f.t); ctx.rotate(f.t * 6); ctx.globalAlpha = Math.max(0, 1 - k); ctx.fillStyle = f.color; ctx.beginPath(); for (let i = 0; i < 5; i++) { const aa = i * TAU / 5 - Math.PI / 2; ctx.lineTo(Math.cos(aa) * 10, Math.sin(aa) * 10); ctx.lineTo(Math.cos(aa + TAU / 10) * 4.2, Math.sin(aa + TAU / 10) * 4.2); } ctx.closePath(); ctx.fill(); ctx.restore(); }
        else if (f.type === 'flash') { ctx.fillStyle = `rgba(255,255,255,${0.16 * (1 - k)})`; ctx.fillRect(0, 0, CW, CH); }
      }
    };
    if (g3 && curP) {
      const ov = g3.overlay();
      marks(ov, true); marksTop(ov);
      ctx.save(); ctx.translate(CW / 2, CH / 2); if (curP.rot) ctx.rotate(-Math.PI / 2);
      const ok = g3.draw(ctx, b, state, !!curP.rot);
      ctx.restore();
      if (ok) { air(ctx); return; }
    }
    // ---- the 2D picture: court, poles, then (unless the 3D people are still loading) the figures from above
    drawCourt(ctx);
    for (const py of POLE_Y) drawPole(ctx, SP, py);
    marks(ctx, false);
    if (pending) { marksTop(ctx); air(ctx); return; }
    for (const s of b.seats) drawSeated(ctx, SP, s.y, s.face, { kit: CHASER, skin: skinFor(s.i + 2), scale: 1.3 });
    // runners out: they fade where they were touched
    for (const r of b.runners) {
      if (!r.out) continue;
      const k = (b.t - r.outT) / 1.3;
      if (k < 1) { ctx.save(); ctx.globalAlpha = 0.55 * (1 - k); drawAthlete(ctx, r.x, r.y, { kit: RUNNER, skin: skinFor(r.id), ang: r.ang, phase: 0, moving: false, scale: 1.1 - 0.3 * k }); ctx.restore(); }
    }
    const items = [];
    for (const r of b.runners) {
      if (r.out) continue;
      const sel = o.live && b.mode === 'defend' && b.sel === r.id;
      items.push({ y: r.y, d: () => drawAthlete(ctx, r.x, r.y, { kit: RUNNER, skin: skinFor(r.id), ang: r.ang, phase: r.phase, moving: r.moving, scale: 1.4, num: o.numbers ? r.id + 1 : 0, ring: sel ? 'rgba(255,236,140,0.95)' : null }) });
    }
    items.push({ y: a.y, d: () => drawAthlete(ctx, a.x, a.y, { kit: CHASER, skin: skinFor(a.seat + 3 + 1), ang: a.ang, phase: a.phase, moving: a.moving, scale: 1.5, num: 9, ring: o.live && b.mode === 'chase' ? 'rgba(70,230,212,0.95)' : null }) });
    items.sort((p, q) => p.y - q.y).forEach((it) => it.d());
    marksTop(ctx); air(ctx);
  };
  const popsIn = (P) => {
    for (const f of state.fx) {
      if (f.type !== 'pop') continue;
      const k = f.t / f.dur, s = toScr(P, f.x, f.y);
      ctx.globalAlpha = Math.min(1, 2 - k * 2);
      shadowText(f.text, Math.max(90, Math.min(W_ - 90, s.x)), s.y - 40 * P.f - k * 54, 30, f.color ?? GOLD, 'center', 400, W_ * 0.7);
      ctx.globalAlpha = 1;
    }
  };

  // -------------------------------------------------------------- TITLE
  if (sc === 'title') {
    const T = L.title(), d = state.demo;
    drawBackdrop(ctx, W_, H_);
    const g3t = globalThis.__court3d, ok3 = g3t && g3t.ok && !g3t.lost && g3t.ready && d.b;
    if (ok3) {
      g3t.overlay();
      const hr = L.land ? { x: 0, y: 0, w: T.card.x - 4, h: H_ } : { x: 0, y: 0, w: W_, h: T.dim.y + 30 };
      ctx.save(); ctx.beginPath(); ctx.rect(hr.x, hr.y, hr.w, hr.h); ctx.clip();
      const okh = g3t.drawHero(ctx, hr, d.b, state, L.land); ctx.restore();
      if (!okh) { const HP = { cx: T.hero.cx, cy: T.hero.cy, f: T.hero.sc, rot: T.hero.rot }; inCourt(HP, null, () => courtScene(d.b, { live: false, numbers: false })); }
    } else if (d.b) { const HP = { cx: T.hero.cx, cy: T.hero.cy, f: T.hero.sc, rot: T.hero.rot }; inCourt(HP, null, () => courtScene(d.b, { live: false, numbers: false })); }
    if (!L.land) {
      const sh = T.tag.y + 70, gr = ctx.createLinearGradient(0, 0, 0, sh); gr.addColorStop(0, `rgba(${PLATE},0.72)`); gr.addColorStop(0.65, `rgba(${PLATE},0.34)`); gr.addColorStop(1, `rgba(${PLATE},0)`); ctx.fillStyle = gr; ctx.fillRect(0, 0, W_, sh);
      const dm = T.dim, gr2 = ctx.createLinearGradient(0, dm.y - 70, 0, dm.y); gr2.addColorStop(0, `rgba(${PLATE},0)`); gr2.addColorStop(1, `rgba(${PLATE},0.93)`); ctx.fillStyle = gr2; ctx.fillRect(0, dm.y - 70, W_, 70); ctx.fillStyle = `rgba(${PLATE},0.93)`; ctx.fillRect(0, dm.y, W_, dm.h + 2);
    } else {
      const gr = ctx.createLinearGradient(0, 0, 0, 200); gr.addColorStop(0, `rgba(${PLATE},0.8)`); gr.addColorStop(1, `rgba(${PLATE},0)`); ctx.fillStyle = gr; ctx.fillRect(0, 0, T.card.x, 200);
      panel(T.card, 0.9);
    }
    const tt = T.titleText;
    { const tsz = fit('KHO-KHO', Math.min(L.w - 56, L.land ? T.card.x - 56 : L.w - 56), tt.size * 0.8, 400, DISPLAY); title3d(ctx, 'KHO-KHO', tt.x, tt.y, tsz, font(400, tsz, DISPLAY)); }
    fitText('The chain chase: run, read, shout Kho', T.tag.x, T.tag.y, T.tag.size, L.land ? (T.card.x - 16 - L.U.x0) - 40 : W_ - 40, 'rgba(235,236,255,0.95)', 'center', 600);
    { const bh = T.brand.w * 0.2725; ctx.save(); ctx.fillStyle = 'rgba(4,6,24,0.66)'; ctx.beginPath(); ctx.roundRect(T.brand.x - T.brand.w / 2 - 10, T.brand.y - bh / 2 - 6, T.brand.w + 20, bh + 12, (bh + 12) / 2); ctx.fill(); ctx.restore(); }
    drawLockup(ctx, T.brand.x, T.brand.y + (state.lkDown ? 1 : 0), T.brand.w * (state.lkDown ? 0.96 : 1), state.lkDown ? 0.7 : 1);
    const B = T.rows;
    button(B.play, 'Play', { primary: true, size: 36, icon: 'play', sub: state.stats.matches ? `${state.stats.wins} wins in ${state.stats.matches} matches` : `${BATCHES * INNINGS} batches to chase, ${BATCHES * INNINGS} to run` });
    button(B.level, 'Level: ' + LEVELS[state.level].name, { size: 22, icon: 'level' });
    button(B.auto, 'Auto Play', { size: 24, icon: 'auto' });
    button(B.howto, 'How to play', { size: 19, icon: 'book' }); button(B.about, 'About', { size: 20, icon: 'info' }); button(B.rules, 'Game Rules', { size: 19, icon: 'rules' });
    button(B.settings, 'Settings', { size: 24, icon: 'gear' });
    if (state.dev) text('dev', T.dev.x, T.dev.y, 20, '#9f9', 'right');
    return;
  }

  // -------------------------------------------------------------- PAGES
  const backdrop = () => { drawBackdrop(ctx, W_, H_, 0.1); ctx.fillStyle = `rgba(${PLATE},0.6)`; ctx.fillRect(0, 0, W_, H_); };
  if (sc === 'howto' || sc === 'about' || sc === 'rules') {
    backdrop();
    const RD = L.reader;
    panel(RD.panel, 0.93);
    const heading = sc === 'about' ? 'About' : sc === 'rules' ? 'Game Rules' : 'How to play';
    shadowText(heading, RD.title.x, RD.title.y + 14, 30, GOLD, 'left', 400, RD.dec.x - RD.title.x - 12);
    button(RD.dec, 'A−', { dim: state.textScaleIdx === 0, size: 26, noscale: true });
    button(RD.inc, 'A+', { dim: state.textScaleIdx === TEXT_SCALES.length - 1, size: 26, noscale: true });
    const vp = RD.viewport, tw = RD.textW, x0 = vp.x + 4, cxv = vp.x + vp.w / 2;
    const fkey = `${sc}|${ts}|${Math.round(tw)}`;
    let F = flowCache.get(fkey);
    if (!F) {
      const items = []; let y = 4;
      for (const sec of flowOf(sc)) {
        const tsz = 32 * Math.min(ts, 1.2), tlh = tsz * 1.2, tl = lines(sec.name, tsz, tw, 400);
        items.push({ k: 'rtitle', y, lines: tl, size: tsz, lh: tlh }); y += tl.length * tlh + 18;
        if (sec.illus) { items.push({ k: 'illus', y, which: sec.illus }); y += 250 * Math.min(1, tw / 568) + 14; }
        for (const item of sec.items) {
          if (item.h) { const sz = 30 * ts, lh = sz * 1.18, ls = lines(item.h, sz, tw, 700); items.push({ k: 'text', y, lines: ls, size: sz, lh, color: GOLD, weight: 700 }); y += ls.length * lh + 10; }
          else { const sz = 28 * ts, ls = lines(item.t, sz, tw, 500); items.push({ k: 'text', y, lines: ls, size: sz, lh: 39 * ts, color: CREAM }); y += ls.length * 39 * ts + 16; }
        }
        y += 30;
      }
      F = { items, total: y }; flowCache.set(fkey, F); if (flowCache.size > 30) flowCache.delete(flowCache.keys().next().value);
    }
    const items = F.items, y = F.total, max = Math.max(0, y + 6 - vp.h); reader.max = max;
    const off = Math.min(Math.max(0, state.scroll || 0), max);
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x - 4, vp.y, vp.w + 8, vp.h); ctx.clip(); ctx.translate(0, vp.y - off);
    for (const it of items) {
      if (it.y - off > vp.h + 400 || it.y - off < -1400) continue;
      if (it.k === 'text') it.lines.forEach((ln, i) => text(ln, x0, it.y + it.size * 0.95 + i * it.lh, it.size, it.color, 'left', it.weight ?? 500));
      else if (it.k === 'rtitle') it.lines.forEach((ln, i) => text(ln, x0, it.y + it.size * 0.95 + i * it.lh, it.size, GOLD, 'left', 400, DISPLAY));
      else if (it.k === 'illus') illus(it.which, cxv, it.y, Math.min(1, tw / 568));
    }
    ctx.restore();
    if (max > 0) { const sb = RD.scrollbar, th = Math.max(36, sb.h * vp.h / (vp.h + max)), ty = sb.y + (sb.h - th) * (off / max); ctx.fillStyle = 'rgba(200,210,255,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x, sb.y, sb.w, sb.h, 5); ctx.fill(); ctx.fillStyle = 'rgba(255,207,90,0.75)'; ctx.beginPath(); ctx.roundRect(sb.x, ty, sb.w, th, 5); ctx.fill(); }
    text(max > 0 ? (off >= max - 2 ? 'End' : 'Scroll: drag, wheel or arrow keys') : '', RD.counter.x, RD.counter.y, 22, 'rgba(244,241,255,0.7)');
    button(RD.nav.prev, 'Top', { dim: off < 4, size: 22 });
    button(RD.nav.next, 'More', { dim: off >= max - 2, size: 22 });
    button(RD.nav.back, 'Done', { primary: true, size: 24 });
    return;
  }
  if (sc === 'settings') {
    backdrop(); const S0 = L.settings, rows = state.demoMode ? S0.rows5 : S0.rows;
    shadowText('Settings', S0.title.x, S0.title.y, S0.title.size * 0.62, GOLD, 'center', 400, L.U.w - 40);
    const items = [
      ['Sound', state.sound ? 'On' : 'Off', state.sound],
      ['Reduced motion', state.calm ? 'On' : 'Off', state.calm],
      ['Text size', Math.round((TEXT_SCALES[state.textScaleIdx] ?? 1) * 100) + '%', state.textScaleIdx > 0],
      ['Left-handed layout', state.left ? 'On' : 'Off', state.left],
      ['Show tips on court', state.guide ? 'On' : 'Off', state.guide],
    ];
    if (!state.demoMode) items.push([state.owned ? 'Full game unlocked' : 'Restore purchase', '', state.owned, state.owned ? 'Thank you for playing' : (state.restoreMsg || 'Already bought it? Get it back')]);
    items.forEach((it, i) => {
      const r = rows[i]; button(r, '', { size: 26 }); const vw = it[1] ? 130 : 0, sub = it[3];
      fitText(it[0], r.x + 28, r.y + r.h / 2 + (sub ? -4 : 10), 28, r.w - 56 - vw, CREAM, 'left', 700);
      if (sub) fitText(sub, r.x + 28, r.y + r.h / 2 + 26, 21, r.w - 56, 'rgba(244,241,255,0.75)', 'left', 600);
      if (it[1]) fitText(it[1], r.x + r.w - 28, r.y + r.h / 2 + 10, 28, vw, it[2] ? '#8ff5e6' : GOLD, 'right', 700);
    });
    if (S0.noteFits) text('Tap a row to change it.', S0.note.x, S0.note.y, 24, 'rgba(244,241,255,0.7)');
    button(S0.done, 'Done', { primary: true, size: 26 }); return;
  }
  if (sc === 'demo-limit') {
    backdrop(); const D = L.demo; shadowText('Enjoying the preview?', D.title.x, D.title.y, D.title.size * 0.5, GOLD, 'center', 400, L.U.w - 40);
    wrap('The free web preview ends here. Get the free app on iPhone and Android for unlimited matches on all three grounds.', D.body.x, D.body.y, 30, D.body.w, CREAM, 42); button(D.back, 'Back', { primary: true, size: 26 }); return;
  }

  // -------------------------------------------------------------- PLAY / AUTO
  const b = state.b, m = state.match;
  const P = L.play(sc);
  drawBackdrop(ctx, W_, H_);
  const hintOn = state.hint && state.hint.t < 3 ? state.hint.plan : null;
  const live = state.stage === 'live' || (sc === 'auto' && state.stage !== 'intro');
  const autoA = state.auto, autoPlan = sc === 'auto' && autoA && (autoA.sub === 'think' || autoA.sub === 'reveal') && autoA.dec ? autoA.dec : null;
  inCourt(P, state.shake, () => courtScene(b, { live: live && sc === 'play', numbers: true, guide: state.guide, hint: hintOn ?? (autoPlan && autoA.sub === 'reveal' ? autoPlan : null) }));
  popsIn(P);
  const role = state.role;
  const autoLabel = () => { const A = state.auto; if (!A) return ''; const ended = state.stage === 'result' || state.stage === 'over'; return A.paused ? 'Paused' : A.sub === 'think' ? A.what + ' · thinking' : A.sub === 'reveal' ? A.what + ' · here it is' : ended ? 'Batch complete' : A.sub === 'act' ? 'Running it' : 'Watch the play'; };
  // ---- info card
  {
    const c = P.card, rad = 24, pad = Math.min(18, c.w * 0.05), tight = c.h < 150;
    chalkboard(ctx, c, rad);
    const nar = c.w < 420 && c.h > 150, k = Math.min(bs, 1.1);
    const AUc = sc === 'auto' && P.auto && P.auto.inCard ? { label: autoLabel(), think: `Think ${AUTO_THINK_STEPS[state.autoThinkIdx]}s` } : null;
    const inn = m ? Math.floor(m.n / (2 * BATCHES)) + 1 : 1;
    const head = sc === 'auto' ? 'Watch and learn' : `Inning ${inn} of ${INNINGS}`;
    const roleTxt = role === 'chase' ? 'You chase' : 'You run', roleCol = role === 'chase' ? TEAL : CORAL;
    const left = Math.max(0, b.limit - b.t), u = left / b.limit;
    const score = m && sc === 'play' ? `You ${m.me + (role === 'chase' ? b.outs : 0)}  ·  Them ${m.them + (role === 'run' ? b.outs : 0)}` : `Touched ${b.outs} of ${RUNNERS}`;
    const chips = (x0, cy, maxW) => {
      const sp = Math.min(54, maxW / RUNNERS);
      b.runners.forEach((ru, i) => {
        const cx = x0 + 20 + i * sp, sel = role === 'run' && b.sel === ru.id && !ru.out && sc === 'play';
        ctx.fillStyle = ru.out ? 'rgba(255,255,255,0.14)' : CORAL; ctx.beginPath(); ctx.arc(cx, cy, 17, 0, TAU); ctx.fill();
        ctx.strokeStyle = sel ? '#fff' : 'rgba(0,0,20,0.55)'; ctx.lineWidth = sel ? 3.5 : 2; ctx.stroke();
        if (ru.out) { ctx.strokeStyle = '#ff6a50'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(cx - 8, cy - 8); ctx.lineTo(cx + 8, cy + 8); ctx.moveTo(cx + 8, cy - 8); ctx.lineTo(cx - 8, cy + 8); ctx.stroke(); }
        else text(String(ru.id + 1), cx, cy + 7, 20, INK, 'center', 800, NUM);
      });
    };
    const bar = (x, y, w2) => {
      if (w2 < 40) return;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.roundRect(x, y - 8, w2, 16, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(255,226,154,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
      const fw = Math.max(12, (w2 - 4) * u), gr = ctx.createLinearGradient(0, y - 6, 0, y + 6);
      if (u < 0.22) { gr.addColorStop(0, '#ff9a80'); gr.addColorStop(1, '#d9381e'); } else { gr.addColorStop(0, '#ffe58a'); gr.addColorStop(0.55, '#ffbc2e'); gr.addColorStop(1, '#d97706'); }
      ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(x + 2, y - 6, fw, 12, 6); ctx.fill();
    };
    if (!nar) {
      const rowA = c.y + c.h * 0.26, rowB = c.y + c.h * 0.56, rowC = c.y + c.h * 0.86;
      fitText(head, c.x + pad, rowA + 8, 24 * k, c.w * 0.52 - pad, CREAM, 'left', 400, DISPLAY);
      fitText(AUc ? AUc.label : roleTxt, c.x + c.w - pad, rowA + 6, 22 * k, c.w * 0.4 - pad, AUc ? (state.auto && state.auto.paused ? '#ffd08a' : GOLD) : roleCol, 'right', 700);
      text(AUc ? AUc.think : `${Math.ceil(left)} s`, c.x + c.w - pad, rowB + 8, (AUc ? 22 : 26) * k, AUc ? CREAM : left <= 6 ? '#ff9a80' : CREAM, 'right', 800, NUM);
      bar(c.x + pad, rowB, c.w - 2 * pad - 110 * k);
      chips(c.x + pad, rowC - 8, c.w * 0.5 - pad);
      fitText(score, c.x + c.w - pad, rowC, 28 * Math.min(bs, 1.05), c.w * 0.5, GOLD, 'right', 800, NUM);
    } else {
      let y = c.y + 38 * k;
      fitText(head, c.x + pad, y, 22 * k, c.w - 2 * pad, CREAM, 'left', 400, DISPLAY); y += 36 * k;
      fitText(roleTxt, c.x + pad, y, 24 * k, c.w - 2 * pad, roleCol, 'left', 700); y += 34 * k;
      text(`${Math.ceil(left)} s`, c.x + c.w - pad, y, 26 * k, left <= 6 ? '#ff9a80' : CREAM, 'right', 800, NUM);
      bar(c.x + pad, y - 8, c.w - 2 * pad - 80 * k); y += 40 * k;
      chips(c.x + pad, y, c.w - 2 * pad); y += 44 * k;
      fitText(score, c.x + pad, y, 26 * Math.min(bs, 1.05), c.w - 2 * pad, GOLD, 'left', 800, NUM);
    }
    void tight;
  }
  // ---- toast
  const mg = state.msg;
  if (mg) { const al = Math.min(1, (mg.hold - mg.t) * 2, mg.t * 6 + 0.2); ctx.globalAlpha = Math.max(0, al); panel(P.msg, 0.9, 18); wrapIn(mg.text, P.msg, 24 * bs, CREAM, { vc: true }); ctx.globalAlpha = 1; }
  // ---- buttons
  if (sc === 'play') {
    const pb = P.btn, liveNow = state.stage === 'live' && !b.result;
    button(pb.menu, 'Menu', { size: 24 });
    button(pb.hint, state.hintsLeft > 0 ? `Hint ${state.hintsLeft}` : 'Hint', { size: 24, dim: state.hintsLeft <= 0 || !liveNow });
    if (role === 'chase') button(pb.act, 'KHO!', { kho: true, size: 28, dim: !liveNow || legalSeats(b).length === 0 });
    else button(pb.act, 'Next', { size: 26, dim: !liveNow });
  } else if (sc === 'auto' && state.auto) {
    const pb = P.btn, A = state.auto, AU = P.auto, ended = state.stage === 'result' || state.stage === 'over';
    button(pb.menu, 'Exit', { size: 24 });
    if (!ended) button(pb.hint, A.paused ? 'Resume' : 'Pause', { size: 24 });
    if (!ended) button(pb.act, 'Skip', { size: 24, dim: A.sub !== 'think' && A.sub !== 'reveal' });
    const label = autoLabel();
    const sideBar = L.land && !P.stack;
    if (!AU.inCard) {
    panel(AU.bar, 0.82, 22);
    const lw = sideBar ? AU.bar.w - 24 : AU.think.x - AU.label.x - 130;
    fitText(label, AU.label.x, AU.label.y + 9, 24, sideBar ? lw : Math.max(120, lw), A.paused ? '#ffd08a' : GOLD, AU.label.align, 700);
    fitText(`Think ${AUTO_THINK_STEPS[state.autoThinkIdx]}s`, AU.think.x, AU.think.y + 8, 22, sideBar ? AU.bar.w - 24 : 150, CREAM, AU.think.align, 600);
    }
    button(AU.dec, '-', { size: 30, noscale: true, dim: state.autoThinkIdx === 0 }); button(AU.inc, '+', { size: 30, noscale: true, dim: state.autoThinkIdx === AUTO_THINK_STEPS.length - 1 });
  }
  // ---- intro banner
  const dim = (al) => { ctx.fillStyle = `rgba(${PLATE},${al})`; ctx.fillRect(0, 0, W_, H_); };
  if (state.stage === 'intro') {
    dim(0.62);
    const cy = H_ / 2 - 40, bw = Math.min(W_ - 40, 640);
    panel(R4(W_ / 2 - bw / 2, cy - 120, bw, 270), 0.94);
    const bn = m ? (m.n % BATCHES) + 1 : 1;
    text(sc === 'auto' ? `One batch · ${LEVELS[0].name}` : `Inning ${m ? Math.floor(m.n / (2 * BATCHES)) + 1 : 1} · batch ${bn} of ${BATCHES} · ${LEVELS[state.level].name}`, W_ / 2, cy - 56, 24, 'rgba(244,241,255,0.88)', 'center', 700);
    shadowText(sc === 'auto' ? 'Watch the chase' : role === 'chase' ? 'You chase' : 'You run', W_ / 2, cy + 22, 44, role === 'run' && sc !== 'auto' ? CORAL : TEAL, 'center', 400, bw - 40);
    wrap(sc === 'auto' ? 'The computer chases: watch how it reads the runners and when it gives Kho.'
      : role === 'chase' ? 'Touch all three runners. You cannot turn back or cross the lane: give Kho to change side.'
        : 'Tap a runner to pick it, tap the court to send it. Cross the lane to wrong-foot the chaser.', W_ / 2, cy + 78, 25, bw - 60, CREAM, 32);
  }
  // ---- overlays
  if (state.menu) {
    const M = L.menu; dim(0.8); shadowText('Paused', M.title.x, M.title.y, M.title.size * 0.6, GOLD, 'center', 400, L.U.w - 40);
    button(M.resume, 'Resume', { primary: true, size: 28 }); button(M.restart, 'New match', { size: 28 }); button(M.settings, 'Settings', { size: 28 }); button(M.quit, 'Leave', { size: 28 });
  }
  if (state.stage === 'result' && b.result) {
    dim(0.62); const D = L.dialog('round'), res = b.result, last = !!m.over;
    const chase = role === 'chase';
    const title = sc === 'auto' ? 'Chase complete' : chase ? (res.outs === RUNNERS ? 'All three out!' : res.outs > 0 ? 'Batch done' : 'Nobody touched') : (res.outs === 0 ? 'All safe!' : res.outs === RUNNERS ? 'All three caught' : 'Batch done');
    panel(D.panel, 0.96);
    shadowText(title, D.title.x, D.title.y, 38, chase ? (res.outs > 0 ? GOLD : '#ff9f80') : (res.outs < RUNNERS ? GOLD : '#ff9f80'), 'center', 400, D.panel.w * (D.land ? 0.5 : 0.86));
    const why = chase ? `You touched ${res.outs} of ${RUNNERS} runners${res.kind === 'cleared' ? ` in ${res.time.toFixed(1)} seconds.` : '. Time ran out.'}`
      : `The computer touched ${res.outs} of your ${RUNNERS} runners${res.kind === 'cleared' ? ` in ${res.time.toFixed(1)} seconds.` : '. You held out to the end.'}`;
    wrapIn(why, R4(D.body.x - D.body.w / 2, D.body.y + 8, D.body.w, 90), 27, CREAM, { vc: true });
    if (sc !== 'auto') {
      fitText(`You ${m.me}  ·  Them ${m.them}`, D.body.x, D.body.y + 150, 44, D.body.w, GOLD, 'center', 800, NUM);
      fitText(`Match is ${MAX_POINTS} points a side`, D.body.x, D.body.y + 196, 24, D.body.w, 'rgba(244,241,255,0.72)', 'center', 600);
    }
    button(D.btns[0], last ? 'See result' : (sc === 'auto' ? 'Close' : 'Next batch'), { primary: true, size: 26 }); button(D.btns[1], sc === 'auto' ? 'Exit' : 'Menu', { size: 24 });
    drawMoreLine(ctx, D.extra.x, D.extra.y, Math.max(FL, 20));
  }
  if (state.stage === 'over' && m && m.over) {
    dim(0.7); const D = L.dialog('over'), o = m.over;
    if (!state.calm && sc === 'play' && o.win) for (let i = 0; i < 26; i++) { const aa = i * 2.4 + t * 0.6, y = (t * 90 + i * 53) % H_, x = W_ / 2 + Math.cos(aa + i) * (W_ * 0.46); ctx.fillStyle = [GOLD, '#ff8a50', TEAL, '#8a9bff'][i % 4]; ctx.beginPath(); ctx.roundRect(x, y, 10, 6, 2); ctx.fill(); }
    panel(D.panel, 0.96);
    const title = sc === 'auto' ? 'Watch complete' : o.win ? 'You win!' : o.draw ? 'A draw' : 'Good effort';
    shadowText(title, D.title.x, D.title.y, 40, o.win ? GOLD : CREAM, 'center', 400, D.panel.w * (D.land ? 0.5 : 0.86));
    if (sc === 'auto') {
      fitText(`${b.outs} of ${RUNNERS} runners touched`, D.body.x, D.body.y + 56, 38, D.body.w, CREAM, 'center', 800, NUM);
    } else {
      fitText(`You ${o.me}  ·  Them ${o.them}`, D.body.x, D.body.y + 52, 58, D.body.w, CREAM, 'center', 800, NUM);
      wrapIn(m.segs.map((s, i) => `Batch ${i + 1} · ${s.role === 'chase' ? 'chase' : 'run'}: ${s.outs} out`).join('\n'), R4(D.body.x - D.body.w / 2, D.body.y + 84, D.body.w, D.body.h - 60), 22, 'rgba(244,241,255,0.9)', { vc: true });
    }
    button(D.btns[0], sc === 'auto' ? 'Watch again' : 'Play again', { primary: true, size: 26 }); button(D.btns[1], sc === 'auto' ? 'Exit' : 'Menu', { size: 24 });
    drawMoreLine(ctx, D.extra.x, D.extra.y, Math.max(FL, 20));
  }

  // -------------------------------------------------------------- small illustrations for the How to play and Rules pages
  function illus(which, cx, y, k) {
    ctx.save(); ctx.translate(cx - 284 * k, y); ctx.scale(k, k);
    ctx.fillStyle = '#b8532e'; ctx.beginPath(); ctx.roundRect(0, 0, 568, 240, 18); ctx.fill();
    const g = ctx.createLinearGradient(0, 0, 0, 240); g.addColorStop(0, 'rgba(255,214,170,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0.18)'); ctx.fillStyle = g; ctx.fill();
    const chalk = 'rgba(255,252,240,0.95)';
    // the lane lies across the middle (the real court is turned on its side to fit the page)
    ctx.fillStyle = 'rgba(255,224,190,0.2)'; ctx.fillRect(0, 108, 568, 24);
    ctx.strokeStyle = chalk; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 108); ctx.lineTo(568, 108); ctx.moveTo(0, 132); ctx.lineTo(568, 132); ctx.stroke();
    ctx.lineWidth = 3; for (let i = 0; i <= 8; i++) { const x = 40 + i * 61; ctx.beginPath(); ctx.moveTo(x, 108); ctx.lineTo(x, 132); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,252,240,0.6)'; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.moveTo(40, 6); ctx.lineTo(40, 234); ctx.moveTo(528, 6); ctx.lineTo(528, 234); ctx.stroke(); ctx.setLineDash([]);
    const seatX = (i) => 70 + i * 61;
    const seated = (i, face) => { ctx.save(); ctx.translate(seatX(i), 120); ctx.rotate(-Math.PI / 2); drawSeated(ctx, 0, 0, face > 0 ? -1 : 1, { kit: CHASER, scale: 0.78, skin: skinFor(i + 2) }); ctx.restore(); };
    const man = (x, yy, ang, kit, n, sc2 = 0.9, ring) => drawAthlete(ctx, x, yy, { kit, ang, phase: 0, moving: false, scale: sc2, skin: skinFor(n), num: 0, ring });
    const arrow = (x0, y0, x1, y1, col = '#fff6dc') => { ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); const an = Math.atan2(y1 - y0, x1 - x0); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 14 * Math.cos(an - 0.5), y1 - 14 * Math.sin(an - 0.5)); ctx.lineTo(x1 - 14 * Math.cos(an + 0.5), y1 - 14 * Math.sin(an + 0.5)); ctx.closePath(); ctx.fill(); };
    const lab = (s, x, yy, col = '#fff2d0') => text(s, x, yy, 22, col, 'center', 400, DISPLAY);
    for (let i = 0; i < 8; i++) seated(i, i % 2 === 0 ? 1 : -1);
    if (which === 'court') {
      man(180, 52, 0, CHASER, 1, 1, 'rgba(70,230,212,0.95)');
      man(400, 190, 0, RUNNER, 2); man(470, 60, Math.PI / 2, RUNNER, 0);
      arrow(205, 52, 300, 52); lab('runs', 252, 36);
      lab('lane + seats', 284, 228, '#fff2d0'); lab('pole', 40, 22, '#fff2d0');
    } else if (which === 'kho') {
      man(seatX(3) - 32, 60, Math.PI, CHASER, 1, 1, 'rgba(70,230,212,0.95)');
      arrow(seatX(3) - 60, 74, seatX(3) - 8, 100); lab('Kho!', seatX(3) - 20, 40, '#fff2d0');
      arrow(seatX(3) + 8, 156, seatX(3) + 70, 200, '#9ff5e6'); lab('new chaser runs this side', 400, 218, '#9ff5e6');
    } else if (which === 'lock') {
      man(250, 70, 0, CHASER, 1, 1, 'rgba(70,230,212,0.95)');
      arrow(250, 38, 250, 8); ctx.strokeStyle = 'rgba(255,90,80,0.9)'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(220, 100); ctx.lineTo(280, 100); ctx.stroke();
      lab('cannot turn back', 400, 90, '#ffd0c8'); lab('free ahead and sideways', 400, 40, '#fff2d0');
    }
    ctx.restore();
  }
  void HINTS;
}
