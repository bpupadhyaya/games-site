// Everything drawn each frame. Reads `state` (game.js) and changes nothing. The court is a cached layer (art.js); every position comes
// from the layout `L` for the live screen size (layout.js) and the court is drawn in canonical space through one transform.
import { CW, CX, CELL, GX, PAD, courtDims, cellX, cellY, TEXT_SCALES, AUTO_THINK_STEPS } from './layout.js';
import { drawBackdrop, drawCourt, drawPlayer, drawGlyph, skinFor, KIND_COLORS, RUNNER_COLORS } from './art.js';
import { W, MID, REACH, RUNNERS, ROUNDS, LEVELS, onGrid, plans, canMove, DIRS, remaining } from './engine.js';
import { flowOf } from './pages.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { gl } from './glhook.js';

const DISPLAY = '"Fredoka", "Trebuchet MS", system-ui, sans-serif', BODY = '"Barlow", "Trebuchet MS", system-ui, sans-serif', NUM = '"Barlow Condensed", "Barlow", system-ui, sans-serif';
const TAU = Math.PI * 2, GOLD = '#ffd24a', CREAM = '#fff8e6', INK = '#1d1608', PLATE = '5,24,19';
const R4 = (x, y, w, h) => ({ x, y, w, h });
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

// How far the current reader page overflows its viewport (set while drawing; game.js clamps scrolling with it).
export const reader = { max: 0 };
const flowCache = new Map();
const faceMaps = new WeakMap();
const faceFor = (r) => { let f = faceMaps.get(r); if (!f) { f = {}; faceMaps.set(r, f); } return f; };

export function render(ctx, state, L) { gl.frame = null; ctx.clearRect(0, 0, L.w, L.h); ctx.save(); draw(ctx, state, L); ctx.restore(); }

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
  const shadowText = (str, x, y, size, color, align = 'center', weight = 600, maxW = 0, fam = DISPLAY) => { const s = maxW ? fit(str, maxW, Math.max(size, FL), weight, fam) : size; text(str, x + 2, y + 4, s, 'rgba(0,10,6,0.65)', align, weight, fam); text(str, x, y, s, color, align, weight, fam); };
  // Glyphs for the menu buttons: drawn, never text, so they stay crisp at any size (c = centre, s = half size)
  const glyph = (kind, cx, cy, s, col) => {
    ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(2, s * 0.17); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (kind === 'level') { ctx.beginPath(); ctx.moveTo(-s * 0.45, s); ctx.lineTo(-s * 0.45, -s); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 0.45, -s); ctx.lineTo(s * 0.9, -s * 0.5); ctx.lineTo(-s * 0.45, 0); ctx.closePath(); ctx.fill(); }
    else if (kind === 'auto') { ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.5); ctx.lineTo(s * 0.55, 0); ctx.lineTo(-s * 0.3, s * 0.5); ctx.closePath(); ctx.fill(); }
    else if (kind === 'howto') { ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.stroke(); ctx.font = `800 ${s * 1.35}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillText('?', 0, s * 0.48); }
    else if (kind === 'about') { ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -s * 0.42, s * 0.14, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, -s * 0.1); ctx.lineTo(0, s * 0.55); ctx.stroke(); }
    else if (kind === 'rules') { ctx.beginPath(); ctx.roundRect(-s * 0.7, -s, s * 1.4, s * 2, s * 0.18); ctx.stroke(); for (const y of [-0.45, 0, 0.45]) { ctx.beginPath(); ctx.moveTo(-s * 0.38, s * y); ctx.lineTo(s * 0.38, s * y); ctx.stroke(); } }
    else if (kind === 'settings') { ctx.beginPath(); ctx.arc(0, 0, s * 0.42, 0, TAU); ctx.stroke(); for (let i = 0; i < 8; i++) { const a2 = i * TAU / 8; ctx.beginPath(); ctx.moveTo(Math.cos(a2) * s * 0.66, Math.sin(a2) * s * 0.66); ctx.lineTo(Math.cos(a2) * s, Math.sin(a2) * s); ctx.stroke(); } }
    else if (kind === 'play') { ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.8); ctx.lineTo(s * 0.8, 0); ctx.lineTo(-s * 0.5, s * 0.8); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  };
  // A lacquered, bevelled plaque: dark lip for depth, brass-and-bamboo edge, light on the upper edge, deeper when pressed.
  const plaque = (r, rad, o = {}) => {
    const press = o.press ? 4 : 0, dep = o.press ? 3 : 7;
    ctx.save();
    ctx.fillStyle = 'rgba(0,8,4,0.55)'; ctx.beginPath(); ctx.roundRect(r.x + 1, r.y + dep + 3, r.w, r.h, rad); ctx.fill();
    ctx.fillStyle = o.lip ?? '#06241a'; ctx.beginPath(); ctx.roundRect(r.x, r.y + dep + press, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    for (const [p, c] of o.stops) gr.addColorStop(p, c);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y + press, r.w, r.h, rad); ctx.fill();
    // bevel: bright upper rim, dark lower rim, thin brass keyline
    ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y + press, r.w, r.h, rad); ctx.clip();
    const hg = ctx.createLinearGradient(0, r.y + press, 0, r.y + press + r.h * 0.5); hg.addColorStop(0, 'rgba(255,255,255,0.34)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg; ctx.fillRect(r.x, r.y + press, r.w, r.h * 0.5);
    const sg = ctx.createLinearGradient(0, r.y + press + r.h * 0.55, 0, r.y + press + r.h); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.30)');
    ctx.fillStyle = sg; ctx.fillRect(r.x, r.y + press + r.h * 0.55, r.w, r.h * 0.45);
    ctx.restore();
    ctx.strokeStyle = o.edge ?? 'rgba(240,206,120,0.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(r.x + 1, r.y + press + 1, r.w - 2, r.h - 2, rad - 1); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(r.x + 5, r.y + press + 5, r.w - 10, r.h - 10, Math.max(4, rad - 5)); ctx.stroke();
    ctx.restore();
  };
  const button = (r, label, o = {}) => {
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const press = o.press ? 4 : 0, rad = Math.min(r.h * 0.3, 26);
    let stops, edge, lip;
    if (o.primary) { stops = [[0, '#fff0a0'], [0.5, '#ffc928'], [1, '#e48c00']]; edge = 'rgba(255,252,222,0.95)'; lip = '#8a4f00'; }
    else if (o.hot) { stops = [[0, '#ff9070'], [0.55, '#e0402c'], [1, '#a81c10']]; edge = 'rgba(255,220,200,0.9)'; lip = '#5a0c06'; }
    else { stops = [[0, o.tone ?? '#2f7a60'], [0.55, '#195440'], [1, '#0e3a2c']]; edge = 'rgba(226,196,112,0.8)'; lip = '#04201a'; }
    plaque(r, rad, { press: o.press, stops, edge, lip });
    const want = (o.size ?? (r.h > 80 ? 32 : 26)) * (o.noscale ? 1 : Math.min(bs, 1.08)), sub = o.sub && r.h >= 74 ? o.sub : '';
    const ig = o.icon ? Math.min(r.h * 0.2, 17) : 0, gap = ig ? ig * 2 + 10 : 0;
    const s = label ? fit(label, r.w - 26 - gap, want, 600, DISPLAY) : want, cy = r.y + press + (sub ? r.h * 0.42 : r.h / 2);
    if (label) {
      ctx.font = font(600, s, DISPLAY); const tw = ctx.measureText(label).width, cx = r.x + r.w / 2 + gap / 2;
      if (ig) glyph(o.icon, cx - tw / 2 - ig - 6, cy, ig, o.primary ? INK : 'rgba(255,236,170,0.95)');
      ctx.textAlign = 'center'; ctx.fillStyle = o.primary ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)'; ctx.fillText(label, cx + 0, cy + s * 0.34 + (o.primary ? 1.5 : 2));
      ctx.fillStyle = o.primary ? INK : CREAM; ctx.fillText(label, cx, cy + s * 0.34);
    }
    if (sub) { ctx.font = font(600, FL); if (ctx.measureText(sub).width <= r.w - 20) text(sub, r.x + r.w / 2, r.y + r.h - 14 + press, FL, o.primary ? 'rgba(29,22,8,0.72)' : 'rgba(255,248,230,0.7)', 'center', 600); }
    ctx.restore();
  };
  // a carved plaque panel (cards, toasts, reader pages); `a` is how much the village shows through
  const panel = (r, a = 0.8, rad = 26) => {
    ctx.save();
    ctx.fillStyle = 'rgba(0,8,4,0.5)'; ctx.beginPath(); ctx.roundRect(r.x + 1, r.y + 6, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); gr.addColorStop(0, `rgba(10,46,36,${a})`); gr.addColorStop(1, `rgba(3,22,16,${Math.min(1, a + 0.06)})`);
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = 'rgba(226,196,112,0.78)'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.roundRect(r.x + 5, r.y + 5, r.w - 10, r.h - 10, Math.max(4, rad - 5)); ctx.stroke();
    ctx.restore();
  };
  const inCourt = (cx, cy, f, ch, shake, fn) => { gl.xf = { cx: cx + (shake?.x ?? 0), cy: cy + (shake?.y ?? 0), f, ch }; ctx.save(); ctx.translate(cx + (shake?.x ?? 0), cy + (shake?.y ?? 0)); ctx.scale(f, f); ctx.translate(-CX, -ch / 2); fn(); ctx.restore(); };

  // -------------------------------------------------------------- the court scene (title attract, play, auto)
  // `a` is the animation progress 0..1 of the last beat (positions glide from the previous cell to the new one).
  const courtScene = (r, a, o) => {
    const ln = r.lines, cal = state.calm, pit = o.pitch ?? CELL, cY = (row) => cellY(row, ln, pit);
    const G3 = gl.active ? (gl.frame = { xf: gl.xf, W_, H_, pitch: pit, ln, r, zones: [], people: [], t }) : null;
    if (!G3) drawCourt(ctx, ln, pit);
    const P = plans(r), e = ease(a);
    const gx = (g) => lerp(cellX(g.pc ?? g.c), cellX(g.c), e);
    // labels
    text('HOME', CX, courtDims(ln, pit).ch - PAD + 18 + 38, 24, 'rgba(255,238,190,0.95)', 'center', 700, DISPLAY);
    text('FAR END', GX + 78, cY(r.top) - pit / 2 + 22, 15, 'rgba(14,70,45,0.7)', 'center', 700, DISPLAY);
    // touch zones under the players: where each guard touches right now (solid) and where it goes next (dashed)
    const zone = (x0, y0, w, h, alpha, dashed, col) => {
      if (G3 && !dashed) { G3.zones.push({ x: x0, y: y0, w, h, alpha }); return; }
      ctx.save();
      if (dashed) { ctx.setLineDash([9, 8]); ctx.strokeStyle = `rgba(${col},${0.85 * alpha})`; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 14); ctx.stroke(); }
      else { ctx.fillStyle = `rgba(${col},${alpha})`; ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 14); ctx.fill(); ctx.strokeStyle = `rgba(${col},${Math.min(1, alpha * 3.2)})`; ctx.lineWidth = 2.5; ctx.stroke(); }
      ctx.restore();
    };
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    r.guards.forEach((g, i) => {
      const y = cY(g.row), x = gx(g);
      { const zx0 = Math.max(GX, x - CELL * (REACH + 0.5)), zx1 = Math.min(GX + W * CELL, x + CELL * (REACH + 0.5)); zone(zx0 + 4, y - pit / 2 + 8, zx1 - zx0 - 8, pit - 16, cal ? 0.2 : 0.17 + 0.07 * pulse, false, '255,84,60'); }
      if (o.guide && !r.result) {
        const p = P.guards[i];
        if (p.to !== g.c || p.sweep.length > 1) { const lo = Math.min(...p.sweep) - REACH, hi = Math.max(...p.sweep) + REACH, x0 = cellX(Math.max(0, lo)) - CELL / 2, x1 = cellX(Math.min(W - 1, hi)) + CELL / 2; zone(x0 + 6, y - pit / 2 + 12, x1 - x0 - 12, pit - 24, 1, true, '255,230,170'); }
      }
    });
    {
      const s = r.sodor, y = lerp(cY(s.prow ?? s.row), cY(s.row), e), x = cellX(MID);
      zone(x - CELL * 1.5 + 4, y - pit * 1.5 + 4, CELL * 3 - 8, pit * 3 - 8, cal ? 0.2 : 0.14 + 0.07 * pulse, false, '255,84,60');
      if (o.guide && !r.result) { const py = cY(P.sodor.to); if (P.sodor.to !== s.row) zone(x - CELL * 1.5 + 8, py - pit * 1.5 + 8, CELL * 3 - 16, pit * 3 - 16, 1, true, '255,230,170'); }
    }
    // players sorted by depth
    const items = [];
    const face = faceFor(r);
    const faceOf = (key, dx, dy, dflt) => { if (dx || dy) face[key] = Math.atan2(dx, -dy); return face[key] ?? dflt; };
    r.runners.forEach((ru) => {
      if (ru.phase === 'home') { if (G3) G3.people.push({ key: 'r' + ru.id, role: 'runner', id: ru.id, X: cellX(ru.c), Y: cY(0), state: 'home', cell: true }); return; }
      if (ru.phase === 'out') {
        const bx = GX + 40 + ru.id * 56, by = cY(0) + pit / 2 + 22;
        if (G3) { G3.people.push({ key: 'r' + ru.id, role: 'runner', id: ru.id, X: bx, Y: by, state: 'out', cell: false }); return; }
        items.push({ y: by, d: () => drawPlayer(ctx, bx, by, { ...RUNNER_COLORS, skin: skinFor(ru.id), ang: Math.PI * 0.55, phase: 0, moving: false, scale: 0.62, alpha: 0.5 }) });
        return;
      }
      const x = lerp(cellX(ru.pc), cellX(ru.c), e), y = lerp(cY(ru.prow), cY(ru.row), e);
      const mv = a < 1 && (ru.pc !== ru.c || ru.prow !== ru.row);
      const ang = faceOf('r' + ru.id, ru.c - ru.pc, ru.row - ru.prow, ru.phase === 'down' ? Math.PI : 0);
      const sel = o.sel === ru.id;
      if (G3) G3.people.push({ key: 'r' + ru.id, role: 'runner', id: ru.id, X: cellX(ru.c), Y: cY(ru.row), state: ru.phase, cell: true, face: ru.phase === 'down' ? 'home' : 'far' });
      items.push({ y, d: () => {
        if (sel) { const al = 0.6 + 0.35 * Math.sin(t * 6); ctx.strokeStyle = `rgba(255,236,140,${al})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y + 2, 38, 0, TAU); ctx.stroke(); }
        const dx0 = G3 ? cellX(ru.c) : x, dy0 = G3 ? cY(ru.row) : y;   // 3D: the person walks there on its own clock; the marks sit on the cell
        if (G3) { const hu = gl.headUp; ctx.save(); ctx.font = font(800, Math.max(22, FL), NUM); ctx.textAlign = 'center'; if (o.numbers) { ctx.fillStyle = 'rgba(6,28,20,0.78)'; ctx.beginPath(); ctx.arc(dx0, dy0 - hu - 22, 17, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffd24a'; ctx.fillText(String(ru.id + 1), dx0, dy0 - hu - 14); } if (ru.phase === 'down') { ctx.fillStyle = '#35d49a'; ctx.beginPath(); ctx.arc(dx0 + 24, dy0 - hu - 40, 8, 0, TAU); ctx.fill(); ctx.strokeStyle = '#06301f'; ctx.lineWidth = 2; ctx.stroke(); } ctx.restore(); return; }
        drawPlayer(ctx, x, y, { ...RUNNER_COLORS, skin: skinFor(ru.id), ang, phase: t * 1.1 + ru.id, moving: mv, scale: 1.18, num: o.numbers ? ru.id + 1 : 0 });
        if (ru.phase === 'down') { ctx.save(); ctx.fillStyle = '#35d49a'; ctx.beginPath(); ctx.arc(x + 20, y - 18, 7, 0, TAU); ctx.fill(); ctx.strokeStyle = '#06301f'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
      } });
    });
    r.guards.forEach((g, i) => {
      const x = gx(g), y = cY(g.row), C = KIND_COLORS[g.kind], p = P.guards[i];
      const mv = a < 1 && g.pc !== g.c;
      const ang = faceOf('g' + g.id, g.c - g.pc, 0, g.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      if (G3) G3.people.push({ key: 'g' + g.id, role: 'guard', id: g.id, kind: g.kind, X: cellX(g.c), Y: cY(g.row), state: 'guard', cell: true, dash: !!(g.kind === 'sprinter' && p.dash && !r.result), dir: g.dir });
      items.push({ y, d: () => {
        if (g.kind === 'sprinter' && p.dash && !r.result) { ctx.strokeStyle = `rgba(255,226,122,${0.5 + 0.4 * pulse})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y + 2, 32, 0, TAU); ctx.stroke(); }
        if (G3) drawGlyph(ctx, g.kind, cellX(g.c), y - gl.headUp - 18, 0.78, 0.95);
        else { drawPlayer(ctx, x, y, { ...C, skin: skinFor(g.id + 1), hair: '#14100c', ang, phase: t * 1.2 + g.id, moving: mv || (g.kind === 'walker' && !r.result), scale: 1.2 });
        drawGlyph(ctx, g.kind, x, y - 42, 0.78, 0.95); }
        if (o.guide && p.target >= 0 && !r.result) { const ru = r.runners[p.target]; if (ru && onGrid(ru)) { ctx.save(); ctx.setLineDash([3, 9]); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,200,150,0.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cellX(ru.c), cY(ru.row)); ctx.stroke(); ctx.restore(); } }
        if (o.guide && !r.result && p.to !== g.c && !p.dash) { const dx = p.to > g.c ? 1 : -1; ctx.fillStyle = 'rgba(255,240,200,0.92)'; ctx.beginPath(); ctx.moveTo(x + dx * 52, y); ctx.lineTo(x + dx * 36, y - 11); ctx.lineTo(x + dx * 36, y + 11); ctx.closePath(); ctx.fill(); }
      } });
    });
    {
      const s = r.sodor, x = cellX(MID), y = lerp(cY(s.prow ?? s.row), cY(s.row), e);
      const ang = faceOf('s', 0, (s.row - (s.prow ?? s.row)) * -1, s.dir > 0 ? 0 : Math.PI);
      const mv = a < 1 && s.prow !== s.row;
      if (G3) G3.people.push({ key: 's', role: 'sodor', id: 9, kind: 'sodor', X: cellX(MID), Y: cY(s.row), state: 'guard', cell: true, dir: s.dir });
      items.push({ y, d: () => {
        if (G3) drawGlyph(ctx, 'sodor', x, y - gl.headUp - 18, 0.82, 0.95);
        else { drawPlayer(ctx, x, y, { ...KIND_COLORS.sodor, skin: skinFor(2), hair: '#0a0806', ang, phase: t * 1.2, moving: mv || s.kind === 'walker', scale: 1.4 });
        drawGlyph(ctx, 'sodor', x, y - 48, 0.82, 0.95); }
        if (o.guide && !r.result) { const P2 = P.sodor; if (P2.to !== s.row) { const dy = P2.to > s.row ? -1 : 1; ctx.fillStyle = 'rgba(255,240,200,0.92)'; ctx.beginPath(); ctx.moveTo(x, y + dy * 54); ctx.lineTo(x - 11, y + dy * 38); ctx.lineTo(x + 11, y + dy * 38); ctx.closePath(); ctx.fill(); } }
      } });
    }
    items.sort((p, q) => p.y - q.y).forEach((it) => it.d());
    // legal steps of the picked runner
    if (o.sel != null && o.moves) {
      const ru = r.runners[o.sel];
      if (ru && onGrid(ru)) for (const [dc, dr] of DIRS) if (canMove(r, ru, dc, dr)) {
        const x = cellX(ru.c + dc), y = cY(ru.row + dr), hint = o.hint && o.hint.runner === ru.id && o.hint.dc === dc && o.hint.dr === dr;
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(dc, -dr));
        ctx.globalAlpha = hint ? 0.7 + 0.3 * Math.sin(t * 8) : 0.78;
        ctx.fillStyle = hint ? '#ffd24a' : 'rgba(255,255,255,0.88)'; ctx.strokeStyle = 'rgba(10,30,20,0.7)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(15, 8); ctx.lineTo(0, 2); ctx.lineTo(-15, 8); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      }
    }
    // effects
    for (const f of state.fx) {
      const k = f.t / f.dur;
      if (f.type === 'ring') { ctx.strokeStyle = `rgba(255,248,220,${0.8 * (1 - k)})`; ctx.lineWidth = 4 * (1 - k) + 1; ctx.beginPath(); ctx.arc(f.x, f.y, (10 + k * 60 * f.s) * (cal ? 0.6 : 1), 0, TAU); ctx.stroke(); }
      else if (f.type === 'dust') { ctx.fillStyle = `rgba(250,226,170,${0.55 * (1 - k)})`; ctx.beginPath(); ctx.arc(f.x + f.vx * f.t, f.y + f.vy * f.t, 5 + k * 12, 0, TAU); ctx.fill(); }
      else if (f.type === 'star') { ctx.save(); ctx.translate(f.x + f.vx * f.t, f.y + f.vy * f.t + 140 * f.t * f.t); ctx.rotate(f.t * 6); ctx.globalAlpha = Math.max(0, 1 - k); ctx.fillStyle = f.color; ctx.beginPath(); for (let i = 0; i < 5; i++) { const aa = i * TAU / 5 - Math.PI / 2; ctx.lineTo(Math.cos(aa) * 10, Math.sin(aa) * 10); ctx.lineTo(Math.cos(aa + TAU / 10) * 4.2, Math.sin(aa + TAU / 10) * 4.2); } ctx.closePath(); ctx.fill(); ctx.restore(); }
      else if (f.type === 'pop') { ctx.globalAlpha = Math.min(1, 2 - k * 2); if (f.down) { const bx = Math.max(120, Math.min(CW - 120, f.x)), by = f.y + 70 + k * 40; ctx.fillStyle = 'rgba(6,28,20,0.82)'; ctx.beginPath(); ctx.roundRect(bx - 96, by - 36, 192, 54, 27); ctx.fill(); } text(f.text, Math.max(120, Math.min(CW - 120, f.x)), (f.down ? f.y + 70 + k * 40 : f.y - 44 - k * 54), 38, f.color ?? GOLD, 'center', 700, DISPLAY); ctx.globalAlpha = 1; }
      else if (f.type === 'flash') { ctx.fillStyle = `rgba(255,70,50,${0.2 * (1 - k)})`; ctx.fillRect(0, 0, CW, courtDims(ln, pit).ch); }
    }
  };

  // -------------------------------------------------------------- TITLE
  if (sc === 'title') {
    const T = L.title(false), d = state.demo, tt0 = T.titleText;
    if (!gl.active) drawBackdrop(ctx, W_, H_);
    if (d.r) inCourt(T.hero.cx, T.hero.cy, T.hero.sc, courtDims(d.r.lines).ch, null, () => courtScene(d.r, d.a, { guide: false, sel: null }));
    if (!L.land) {
      const gh = gl.active ? tt0.y + 70 : T.brand.y + 90, gr = ctx.createLinearGradient(0, 0, 0, gh); gr.addColorStop(0, `rgba(${PLATE},${gl.active ? 0.55 : 0.9})`); gr.addColorStop(1, `rgba(${PLATE},0)`); ctx.fillStyle = gr; ctx.fillRect(0, 0, W_, gh);
      const dm = T.dim, gr2 = ctx.createLinearGradient(0, dm.y - 70, 0, dm.y); gr2.addColorStop(0, `rgba(${PLATE},0)`); gr2.addColorStop(1, `rgba(${PLATE},${gl.active ? 0.82 : 0.92})`); ctx.fillStyle = gr2; ctx.fillRect(0, dm.y - 70, W_, 70); ctx.fillStyle = `rgba(${PLATE},${gl.active ? 0.82 : 0.92})`; ctx.fillRect(0, dm.y, W_, dm.h + 2); ctx.fillStyle = 'rgba(226,196,112,0.55)'; ctx.fillRect(0, dm.y - 1, W_, 2);
    } else {
      const gr = ctx.createLinearGradient(0, 0, 0, 200); gr.addColorStop(0, `rgba(${PLATE},0.78)`); gr.addColorStop(1, `rgba(${PLATE},0)`); ctx.fillStyle = gr; ctx.fillRect(0, 0, T.card.x, 200);
      panel(T.card, 0.88);
    }
    const tt = T.titleText;
    {
      const tsz = fit('GOBAK SODOR', Math.min(L.w - 40, L.land ? T.card.x - 40 : L.w - 40), tt.size * 0.72, 700, DISPLAY), TT = 'GOBAK SODOR';
      ctx.save(); ctx.font = font(700, tsz, DISPLAY); ctx.textAlign = 'center'; ctx.lineJoin = 'round';
      const dep = Math.max(4, tsz * 0.075);
      ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillText(TT, tt.x + dep * 0.5, tt.y + dep * 2.2);                         // cast shadow
      for (let i = dep; i >= 1; i--) { ctx.fillStyle = i > dep * 0.5 ? '#6a3a00' : '#9a5a06'; ctx.fillText(TT, tt.x, tt.y + i); }   // the carved depth, bottom to top
      ctx.strokeStyle = '#4a2600'; ctx.lineWidth = Math.max(3, tsz * 0.06); ctx.strokeText(TT, tt.x, tt.y);
      const tg = ctx.createLinearGradient(0, tt.y - tsz * 0.78, 0, tt.y + 2); tg.addColorStop(0, '#fffbd0'); tg.addColorStop(0.35, '#ffe066'); tg.addColorStop(0.62, '#ffb81c'); tg.addColorStop(1, '#e78a00');
      ctx.fillStyle = tg; ctx.fillText(TT, tt.x, tt.y);
      ctx.save(); ctx.beginPath(); ctx.rect(0, tt.y - tsz * 0.8, L.w, tsz * 0.34); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.6; ctx.strokeText(TT, tt.x, tt.y - 1); ctx.restore();   // lit upper edge
      ctx.restore();
    }
    fitText('Slip past the guards on the chalk lines', T.tag.x, T.tag.y, T.tag.size, L.land ? (T.card.x - 16 - L.U.x0) - 40 : W_ - 40, 'rgba(230,255,240,0.95)', 'center', 600);
    { const bh = T.brand.w * 0.2725; ctx.save(); ctx.fillStyle = 'rgba(4,14,12,0.62)'; ctx.beginPath(); ctx.roundRect(T.brand.x - T.brand.w / 2 - 10, T.brand.y - bh / 2 - 6, T.brand.w + 20, bh + 12, (bh + 12) / 2); ctx.fill(); ctx.restore(); }
    drawLockup(ctx, T.brand.x, T.brand.y + (state.lkDown ? 1 : 0), T.brand.w * (state.lkDown ? 0.96 : 1), state.lkDown ? 0.7 : 1);
    const B = T.rows;
    button(B.play, 'Play', { primary: true, size: 38, icon: 'play', sub: state.stats.rounds ? `${state.stats.stars} stars in ${state.stats.rounds} rounds` : `${ROUNDS} rounds, ${RUNNERS} runners` });
    button(B.level, 'Level: ' + LEVELS[state.level].name, { size: 26, icon: 'level' });
    button(B.auto, 'Auto Play', { size: 26, icon: 'auto' });
    button(B.howto, 'How to play', { size: 22, icon: 'howto' }); button(B.about, 'About', { size: 22, icon: 'about' }); button(B.rules, 'Game Rules', { size: 22, icon: 'rules' });
    button(B.settings, 'Settings', { size: 26, icon: 'settings' });
    if (state.dev) text('dev', T.dev.x, T.dev.y, 20, '#9f9', 'right');
    return;
  }

  // -------------------------------------------------------------- PAGES
  const backdrop = () => { drawBackdrop(ctx, W_, H_, 0.1); ctx.fillStyle = `rgba(${PLATE},0.6)`; ctx.fillRect(0, 0, W_, H_); };
  if (sc === 'howto' || sc === 'about' || sc === 'rules') {
    backdrop();
    const RD = L.reader;
    panel(RD.panel, 0.92);
    const heading = sc === 'about' ? 'About' : sc === 'rules' ? 'Game Rules' : 'How to play';
    shadowText(heading, RD.title.x, RD.title.y + 14, 38, GOLD, 'left', 700, RD.dec.x - RD.title.x - 12);
    button(RD.dec, 'A−', { dim: state.textScaleIdx === 0, size: 30, noscale: true });
    button(RD.inc, 'A+', { dim: state.textScaleIdx === TEXT_SCALES.length - 1, size: 30, noscale: true });
    const vp = RD.viewport, tw = RD.textW, x0 = vp.x + 4, cxv = vp.x + vp.w / 2;
    const credits = sc === 'about' ? gl.licenses : '', fkey = `${sc}|${ts}|${Math.round(tw)}|${credits.length}`;
    let F = flowCache.get(fkey);
    if (!F) {
      const items = []; let y = 4;
      for (const sec of flowOf(sc, credits)) {
        const tsz = 36 * Math.min(ts, 1.2), tlh = tsz * 1.15, tl = lines(sec.name, tsz, tw, 700);
        items.push({ k: 'rtitle', y, lines: tl, size: tsz, lh: tlh }); y += tl.length * tlh + 18;
        if (sec.illus) { items.push({ k: 'illus', y, which: sec.illus }); y += 250 * Math.min(1, tw / 568) + 14; }
        for (const item of sec.items) {
          if (item.h) { const sz = 31 * ts, lh = sz * 1.18, ls = lines(item.h, sz, tw, 700); items.push({ k: 'text', y, lines: ls, size: sz, lh, color: GOLD, weight: 700 }); y += ls.length * lh + 10; }
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
      else if (it.k === 'rtitle') it.lines.forEach((ln, i) => text(ln, x0, it.y + it.size * 0.95 + i * it.lh, it.size, GOLD, 'left', 700));
      else if (it.k === 'illus') illus(it.which, cxv, it.y, Math.min(1, tw / 568));
    }
    ctx.restore();
    if (max > 0) { const sb = RD.scrollbar, th = Math.max(36, sb.h * vp.h / (vp.h + max)), ty = sb.y + (sb.h - th) * (off / max); ctx.fillStyle = 'rgba(255,240,205,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x, sb.y, sb.w, sb.h, 5); ctx.fill(); ctx.fillStyle = 'rgba(255,210,74,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x, ty, sb.w, th, 5); ctx.fill(); }
    text(max > 0 ? (off >= max - 2 ? 'End' : 'Scroll: drag, wheel or arrow keys') : '', RD.counter.x, RD.counter.y, 22, 'rgba(255,248,230,0.7)');
    button(RD.nav.prev, 'Top', { dim: off < 4, size: 24 });
    button(RD.nav.next, 'More', { dim: off >= max - 2, size: 24 });
    button(RD.nav.back, 'Done', { primary: true, size: 26 });
    return;
  }
  if (sc === 'settings') {
    backdrop(); const S0 = L.settings, rows = S0.rows;
    shadowText('Settings', S0.title.x, S0.title.y, S0.title.size * 0.8, GOLD, 'center', 700);
    const items = [
      ['Sound', state.sound ? 'On' : 'Off', state.sound],
      ['Reduced motion', state.calm ? 'On' : 'Off', state.calm],
      ['Text size', Math.round((TEXT_SCALES[state.textScaleIdx] ?? 1) * 100) + '%', state.textScaleIdx > 0],
      ['Left-handed layout', state.left ? 'On' : 'Off', state.left],
      ['Show guard moves', state.guide ? 'On' : 'Off', state.guide],
      ['Restore purchase', '', false],
    ];
    const demoOnly = state.demoMode, ownsIt = !!state.owned;
    if (demoOnly) items.pop();
    else {
      const rs = items[5];
      if (ownsIt) { rs[0] = 'Full game unlocked'; rs[1] = 'Owned'; rs[2] = true; }
      else if (state.restoreBusy) rs[0] = 'Checking with the store...';
      else if (state.restoreMsg) rs[0] = state.restoreMsg;
    }
    items.forEach((it, i) => {
      const r = rows[i]; button(r, '', { size: 28 }); const vw = it[1] ? 130 : 0;
      fitText(it[0], r.x + 28, r.y + r.h / 2 + 10, 28, r.w - 56 - vw, CREAM, 'left', 700);
      if (it[1]) fitText(it[1], r.x + r.w - 28, r.y + r.h / 2 + 10, 28, vw, it[2] ? '#9cf29a' : GOLD, 'right', 700);
    });
    if (S0.noteFits) text('Tap a row to change it.', S0.note.x, S0.note.y, 24, 'rgba(255,248,230,0.7)');
    button(S0.done, 'Done', { primary: true, size: 28 }); return;
  }
  if (sc === 'demo-limit') {
    backdrop(); const D = L.demo; shadowText('Enjoying the preview?', D.title.x, D.title.y, D.title.size * 0.7, GOLD, 'center', 700, L.U.w - 40);
    wrap('The free web preview ends here. Get the full game on iPhone and Android for unlimited matches on all three courts.', D.body.x, D.body.y, 30, D.body.w, CREAM, 42); button(D.back, 'Back', { primary: true, size: 28 }); return;
  }

  // -------------------------------------------------------------- PLAY / AUTO
  const r = state.r, m = state.match;
  const P = L.play(sc, r.lines);
  if (!gl.active) drawBackdrop(ctx, W_, H_);
  const a = state.anim.dur > 0 ? Math.min(1, state.anim.t / state.anim.dur) : 1;
  const hint = state.hint && state.hint.t < 3.5 ? state.hint.action : null;
  inCourt(P.cx, P.cy, P.f, P.ch, state.shake, () => courtScene(r, a, {
    pitch: P.pitch, guide: state.guide, sel: sc === 'play' && state.stage === 'live' ? state.sel : (sc === 'auto' && state.auto && state.auto.dec && !state.auto.dec.wait ? state.auto.dec.runner : null),
    moves: (sc === 'play' && state.stage === 'live') || (sc === 'auto' && state.auto && state.auto.sub === 'reveal'), hint: hint && !hint.wait ? hint : (sc === 'auto' && state.auto?.sub === 'reveal' && state.auto.dec && !state.auto.dec.wait ? state.auto.dec : null),
    numbers: sc === 'play',
  }));
  // ---- score card
  {
    const c = P.card, rad = 24, pad = Math.min(18, c.w * 0.05);
    panel(c, gl.active ? 0.58 : 0.86, rad);
    const rowA = c.y + c.h * 0.27, rowB = c.y + c.h * 0.58, rowC = c.y + c.h * 0.86;
    const rn = Math.min(ROUNDS, m.n + (state.stage === 'result' || state.stage === 'over' ? 0 : 1));
    const starsNow = m.stars.reduce((x, y) => x + y, 0) + (state.stage === 'live' || state.stage === 'intro' ? r.home : 0);
    fitText(`Round ${Math.max(1, rn)} of ${ROUNDS}`, c.x + pad, rowA + 8, 28 * Math.min(bs, 1.1), c.w * 0.5 - pad, CREAM, 'left', 700, DISPLAY);
    fitText(`${sc === 'auto' ? 'Watch and learn' : LEVELS[state.level].name}`, c.x + c.w - pad, rowA + 6, 22 * Math.min(bs, 1.1), c.w * 0.45 - pad, 'rgba(255,248,230,0.8)', 'right', 600);
    // beats left bar
    const left = Math.max(0, r.budget - r.beat), bx = c.x + pad, bw2 = c.w - 2 * pad - 130 * Math.min(bs, 1.1);
    text(`${left} beats`, c.x + c.w - pad, rowB + 8, 24 * Math.min(bs, 1.1), left <= 6 ? '#ff9a80' : CREAM, 'right', 700, NUM);
    if (bw2 > 40) { const u = left / r.budget; ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.roundRect(bx, rowB - 7, bw2, 14, 7); ctx.fill(); ctx.fillStyle = u < 0.2 ? '#ff6a50' : '#ffd24a'; ctx.beginPath(); ctx.roundRect(bx, rowB - 7, Math.max(10, bw2 * u), 14, 7); ctx.fill(); }
    // runner chips + stars
    const sp = Math.min(54, (c.w * 0.55 - pad) / RUNNERS);
    r.runners.forEach((ru, k) => {
      const cx = c.x + pad + 20 + k * sp, cy = rowC - 8, sel = state.sel === ru.id && sc === 'play' && ru.phase !== 'out' && ru.phase !== 'home';
      ctx.fillStyle = ru.phase === 'out' ? 'rgba(255,255,255,0.14)' : ru.phase === 'home' ? '#35d49a' : ru.phase === 'down' ? '#9de8c8' : '#ffd24a';
      ctx.beginPath(); ctx.arc(cx, cy, 17, 0, TAU); ctx.fill();
      ctx.strokeStyle = sel ? '#fff' : 'rgba(0,20,10,0.55)'; ctx.lineWidth = sel ? 3.5 : 2; ctx.stroke();
      if (ru.phase === 'out') { ctx.strokeStyle = '#ff6a50'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(cx - 8, cy - 8); ctx.lineTo(cx + 8, cy + 8); ctx.moveTo(cx + 8, cy - 8); ctx.lineTo(cx - 8, cy + 8); ctx.stroke(); }
      else text(ru.phase === 'home' ? '✓' : String(ru.id + 1), cx, cy + 7, 20, INK, 'center', 800, NUM);
    });
    fitText(`Stars ${starsNow}`, c.x + c.w - pad, rowC, 30 * Math.min(bs, 1.05), c.w * 0.4, GOLD, 'right', 800, NUM);
  }
  // ---- toast
  const mg = state.msg;
  if (mg) { const al = Math.min(1, (mg.hold - mg.t) * 2, mg.t * 6 + 0.2); ctx.globalAlpha = Math.max(0, al); panel(P.msg, 0.86, 18); wrapIn(mg.text, P.msg, 24 * bs, CREAM, { vc: true }); ctx.globalAlpha = 1; }
  // ---- buttons
  if (sc === 'play') {
    const pb = P.btn;
    button(pb.menu, 'Menu', { size: 26 });
    button(pb.hint, state.hintsLeft > 0 ? `Hint ${state.hintsLeft}` : 'Hint', { size: 26, dim: state.hintsLeft <= 0 || state.stage !== 'live' });
    button(pb.act, 'Wait', { size: 28, dim: state.stage !== 'live' });
  } else if (sc === 'auto' && state.auto) {
    const pb = P.btn, A = state.auto, AU = P.auto, ended = state.stage === 'result' || state.stage === 'over';
    button(pb.menu, 'Exit', { size: 26 });
    if (!ended) button(pb.hint, A.paused ? 'Resume' : 'Pause', { size: 26 });
    if (!ended) button(pb.act, 'Skip', { size: 26, dim: A.sub !== 'think' && A.sub !== 'reveal' });
    panel(AU.bar, 0.8, 22);
    const label = A.paused ? 'Paused' : A.sub === 'think' ? A.what + ' · thinking' : A.sub === 'reveal' ? A.what + ' · here it is' : ended ? 'Round complete' : 'Watch the play';
    const lw = L.land ? AU.bar.w - 24 : AU.think.x - AU.label.x - 130;
    fitText(label, AU.label.x, AU.label.y + 9, 24, L.land ? lw : Math.max(120, lw), A.paused ? '#ffd08a' : GOLD, AU.label.align, 700);
    fitText(`Think ${AUTO_THINK_STEPS[state.autoThinkIdx]}s`, AU.think.x, AU.think.y + 8, 22, L.land ? AU.inc.x - AU.dec.x - AU.dec.w - 16 : 150, CREAM, AU.think.align, 600);
    button(AU.dec, '-', { size: 30, noscale: true, dim: state.autoThinkIdx === 0 }); button(AU.inc, '+', { size: 30, noscale: true, dim: state.autoThinkIdx === AUTO_THINK_STEPS.length - 1 });
  }
  // ---- intro banner
  if (state.stage === 'intro') {
    ctx.fillStyle = `rgba(${PLATE},0.62)`; ctx.fillRect(0, 0, W_, H_);
    const cy = H_ / 2 - 40, bw = Math.min(W_ - 40, 640);
    panel(R4(W_ / 2 - bw / 2, cy - 110, bw, 250), 0.93);
    text(`Round ${m.n + 1} of ${ROUNDS} · ${sc === 'auto' ? 'Village' : LEVELS[state.level].name}`, W_ / 2, cy - 50, 28, 'rgba(255,248,230,0.85)', 'center', 700);
    shadowText(sc === 'auto' ? 'Watch the runners' : 'Lead them home', W_ / 2, cy + 26, 52, GOLD, 'center', 700, bw - 40);
    wrap(sc === 'auto' ? 'The computer leads the team: watch how it times each crossing.' : 'Cross every line, touch the far end, then come back. Guards touch you on their line.', W_ / 2, cy + 82, 25, bw - 60, CREAM, 32);
  }
  // ---- overlays
  const dim = (al) => { ctx.fillStyle = `rgba(${PLATE},${al})`; ctx.fillRect(0, 0, W_, H_); };
  if (state.menu) {
    const M = L.menu; dim(0.78); shadowText('Paused', M.title.x, M.title.y, M.title.size * 0.8, GOLD, 'center', 700);
    button(M.resume, 'Resume', { primary: true, size: 30 }); button(M.restart, 'New match', { size: 30 }); button(M.settings, 'Settings', { size: 30 }); button(M.quit, 'Leave', { size: 30 });
  }
  const starRow = (n, x, y, size) => { for (let i = 0; i < RUNNERS; i++) text(i < n ? '★' : '☆', x + (i - (RUNNERS - 1) / 2) * size * 1.15, y, size, i < n ? GOLD : 'rgba(255,248,230,0.45)', 'center', 700); };
  if (state.stage === 'result' && r.result) {
    dim(0.62); const D = L.dialog('round'), res = r.result, last = !!m.over;
    const title = res.kind === 'done' ? (res.home === RUNNERS ? 'Everyone home!' : 'Round won') : res.kind === 'caught' ? 'All caught' : 'Time up';
    panel(D.panel, 0.95);
    shadowText(title, D.title.x, D.title.y, 56, res.home > 0 ? GOLD : '#ff9f80', 'center', 700, D.panel.w * (D.land ? 0.5 : 0.86));
    starRow(res.home, D.body.x, D.body.y + 34, 46);
    const why = res.kind === 'done' ? `${res.home} of ${RUNNERS} runners got home${res.out ? `, ${res.out} touched.` : '.'}` : res.kind === 'caught' ? `Every runner was touched on the way.` : `Time ran out with ${res.home} home and ${res.out} touched.`;
    wrapIn(why, R4(D.body.x - D.body.w / 2, D.body.y + 64, D.body.w, 60), 26, CREAM, { vc: true });
    fitText(`Total ${m.stars.reduce((x, y) => x + y, 0)} of ${ROUNDS * RUNNERS}`, D.body.x, D.body.y + 150, 34, D.body.w, GOLD, 'center', 800, NUM);
    button(D.btns[0], last ? 'See result' : (sc === 'auto' ? 'Close' : 'Next round'), { primary: true, size: 30 }); button(D.btns[1], sc === 'auto' ? 'Exit' : 'Menu', { size: 26 });
    drawMoreLine(ctx, D.extra.x, D.extra.y, Math.max(FL, 20));
  }
  if (state.stage === 'over' && m.over) {
    dim(0.7); const D = L.dialog('over'), o = m.over;
    if (!state.calm && sc === 'play' && o.total >= 5) for (let i = 0; i < 26; i++) { const aa = i * 2.4 + t * 0.6, y = (t * 90 + i * 53) % H_, x = W_ / 2 + Math.cos(aa + i) * (W_ * 0.46); ctx.fillStyle = ['#ffd24a', '#ff6a5c', '#38c9a8', '#6f7cff'][i % 4]; ctx.beginPath(); ctx.roundRect(x, y, 10, 6, 2); ctx.fill(); }
    panel(D.panel, 0.95);
    const title = o.total >= 7 ? 'Flawless match!' : o.total >= 5 ? 'You win!' : 'Good effort';
    shadowText(title, D.title.x, D.title.y, 56, GOLD, 'center', 700, D.panel.w * (D.land ? 0.5 : 0.86));
    fitText(`${o.total} of ${ROUNDS * RUNNERS} stars`, D.body.x, D.body.y + 36, 42, D.body.w, CREAM, 'center', 800, NUM);
    wrapIn(m.stars.map((s, i) => `Round ${i + 1}: ${'★'.repeat(s)}${'☆'.repeat(RUNNERS - s)}`).join('\n'), R4(D.body.x - D.body.w / 2, D.body.y + 58, D.body.w, D.body.h - 40), 26, 'rgba(255,248,230,0.9)', { vc: true });
    button(D.btns[0], sc === 'auto' ? 'Watch again' : 'Play again', { primary: true, size: 30 }); button(D.btns[1], sc === 'auto' ? 'Exit' : 'Menu', { size: 26 });
    drawMoreLine(ctx, D.extra.x, D.extra.y, Math.max(FL, 20));
  }

  // -------------------------------------------------------------- small illustrations for the How to play and Rules pages
  function illus(which, cx, y, k) {
    ctx.save(); ctx.translate(cx - 284 * k, y); ctx.scale(k, k);
    ctx.fillStyle = 'rgba(236,206,142,0.9)'; ctx.beginPath(); ctx.roundRect(0, 0, 568, 240, 18); ctx.fill();
    const cell = 64, colX = (c) => 60 + c * cell, rowY = (rw) => 214 - rw * 50;   // 7 columns, rows 0..4
    const chalk = 'rgba(255,253,244,0.95)';
    ctx.strokeStyle = chalk; ctx.lineWidth = 5;
    for (const rw of [1, 3]) { ctx.beginPath(); ctx.moveTo(30, rowY(rw)); ctx.lineTo(538, rowY(rw)); ctx.stroke(); }
    ctx.fillStyle = 'rgba(70,150,170,0.25)'; ctx.fillRect(0, rowY(0) - 25, 568, 50); ctx.fillStyle = 'rgba(60,170,110,0.28)'; ctx.fillRect(0, rowY(4) - 25, 568, 50);
    ctx.save(); ctx.setLineDash([2, 12]); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,253,244,0.7)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(colX(3), rowY(4)); ctx.lineTo(colX(3), rowY(0)); ctx.stroke(); ctx.restore();
    const zone = (c, rw, al = 0.28) => { ctx.fillStyle = `rgba(255,84,60,${al})`; ctx.strokeStyle = 'rgba(255,84,60,0.8)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.roundRect(colX(c - 1) - 30, rowY(rw) - 21, cell * 3 - 4, 42, 10); ctx.fill(); ctx.stroke(); };
    const run = (c, rw, n = 0, sc2 = 0.62) => drawPlayer(ctx, colX(c), rowY(rw), { ...RUNNER_COLORS, skin: skinFor(n), ang: 0, phase: 0, moving: false, scale: sc2, num: 0 });
    const grd = (c, rw, kind, sc2 = 0.66) => drawPlayer(ctx, colX(c), rowY(rw), { ...KIND_COLORS[kind], skin: skinFor(n3(kind)), ang: Math.PI / 2, phase: 0, moving: false, scale: sc2 });
    const n3 = (kd) => (kd === 'walker' ? 1 : kd === 'shadow' ? 2 : 3);
    const arrow = (x0, y0, x1, y1, col = '#fff6dc') => { ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); const an = Math.atan2(y1 - y0, x1 - x0); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 14 * Math.cos(an - 0.5), y1 - 14 * Math.sin(an - 0.5)); ctx.lineTo(x1 - 14 * Math.cos(an + 0.5), y1 - 14 * Math.sin(an + 0.5)); ctx.closePath(); ctx.fill(); };
    const lab = (s, x, yy, col = '#6b2f00') => text(s, x, yy, 22, col, 'center', 700, DISPLAY);
    if (which === 'court') {
      zone(5, 1); zone(1, 3);
      grd(5, 1, 'walker'); grd(1, 3, 'shadow'); run(1, 0, 0); run(3, 0, 1); run(5, 0, 2);
      arrow(colX(1), rowY(0) - 22, colX(1), rowY(2) + 10);
      lab('far end', 480, rowY(4) + 8, '#0d4a2c'); lab('home', 480, rowY(0) + 8);
    } else if (which === 'cross') {
      zone(5, 1, 0.3); grd(5, 1, 'walker');
      run(1, 2); arrow(colX(1), rowY(2) - 20, colX(1), rowY(1) + 10); lab('step on now', colX(1) + 4, rowY(2) - 30, '#6b2f00');
      ctx.strokeStyle = 'rgba(80,40,0,0.9)'; ctx.setLineDash([8, 7]); ctx.lineWidth = 3.5; ctx.beginPath(); ctx.roundRect(colX(6) - 30, rowY(1) - 21, cell - 4 + 28, 42, 10); ctx.stroke(); ctx.setLineDash([]);
      arrow(colX(5) + 30, rowY(1) - 28, colX(6) + 20, rowY(1) - 28, '#7a1a0f'); lab('next cell', colX(5) + 12, rowY(1) - 36, '#7a1a0f');
      run(5, 0, 2); run(3, 0, 1);
    } else if (which === 'decoy') {
      zone(2, 1, 0.3); grd(2, 1, 'shadow');
      run(2, 2, 3); lab('decoy', colX(2) - 78, rowY(2) + 8);
      run(6, 0, 0); arrow(colX(6), rowY(0) - 22, colX(6), rowY(2) + 8); lab('crosses', colX(6) - 6, rowY(2) - 12, '#6b2f00');
      dotLine(colX(2) + 20, rowY(1), colX(2), rowY(2) + 20);
    }
    ctx.restore();
    function dotLine(x0, y0, x1, y1) { ctx.save(); ctx.setLineDash([3, 8]); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(180,40,20,0.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.restore(); }
  }
  void remaining; void W;
}
