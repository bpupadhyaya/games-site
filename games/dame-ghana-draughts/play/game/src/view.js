// Everything that is drawn each frame. Reads `state` (see game.js) and changes nothing.
// Positions come from the live layout (layout.js), so the same code serves every phone and tablet in portrait and landscape.
import { TEXT_SCALES, THINK_STEPS, host, boardGeo } from './layout.js';
import { drawTable, drawBoard, weaveRule, FRAME, SLAB, WOOD_NAMES } from './art.js';
import { drawPiece, SET_NAMES, SIDE_NAMES, pieceShadow } from './pieces.js';
import { LEVELS, VARIANTS, sqName, count } from './engine.js';
import { DIAGRAMS, RULES, HOWTO, ABOUT } from './content.js';
import { animPos, animRemoved, animEffects } from './anim.js';
import { drawCredit, drawMoreLine, edgeStroke } from './brand.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif', UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const GOLD = '#f3cf7a', CREAM = '#f6e7c1';
export const readerMetrics = { max: 0, view: 0 };
export const ui = { buttons: [] };           // every button drawn in the last frame (read by the layout checks)

const fitMemo = new Map(); let fitKey = '';
export const DOCS = { rules: { title: 'Rules', secs: RULES }, howto: { title: 'How to Play', secs: HOWTO }, about: { title: 'About', secs: ABOUT } };

export const sideName = (set, side) => SIDE_NAMES[set][side];

export function render(ctx, state, L, aux) {
  const tr = ctx.getTransform?.(), px = tr && tr.a ? Math.max(1, tr.a) : 2;
  { ctx.font = `700 40px ${FONT}`; const a = ctx.measureText('Hamburgefonstiv').width; ctx.font = `600 40px ${UI}`; const k = `${a}/${ctx.measureText('Hamburgefonstiv').width}`; if (k !== fitKey || fitMemo.size > 3000) { fitMemo.clear(); fitKey = k; } }
  const memo = (key, fn) => { let v = fitMemo.get(key); if (v === undefined) { v = fn(); fitMemo.set(key, v); } return v; };
  ui.buttons.length = 0;
  const scene = state.scene, set = state.set, g = state.game, n = g.n;
  const minU = Math.max(13, 11.5 / (host.px || 0.5));
  const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;

  // ---------------------------------------------------------------- text helpers
  const text = (str, x, y, size, color = CREAM, font = UI, weight = 600, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const fitSize = (str, size, maxW, font = UI, weight = 600, min = minU) => memo(`f|${str}|${size}|${maxW}|${font}|${weight}|${min}`, () => { let q = size; ctx.font = `${weight} ${q}px ${font}`; while (q > min && ctx.measureText(str).width > maxW) { q -= 1; ctx.font = `${weight} ${q}px ${font}`; } return q; });
  const fit = (str, x, y, size, maxW, color, font = UI, weight = 600, align = 'center', min = minU) => text(str, x, y, fitSize(str, size, maxW, font, weight, min), color, font, weight, align);
  const lines = (str, size, maxW, weight = 600, font = UI) => memo(`l|${weight}|${size}|${maxW}|${font}|${str}`, () => {
    ctx.font = `${weight} ${size}px ${font}`; const words = str.split(' '), out = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
  });
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.3, align = 'center', weight = 600) => { const ls = lines(str, size, maxW, weight); ls.forEach((ln, i) => text(ln, x, y + i * lh, size, color, UI, weight, align)); return ls.length; };
  // wrap into a box, shrinking until it fits its height; vertically centred
  const wrapBox = (str, r, size, color, align = 'center', min = minU, weight = 600) => {
    const s = memo(`b|${str}|${size}|${r.w}|${r.h}|${min}|${weight}`, () => { let q = size, l2 = lines(str, q, r.w, weight); while (q > min && l2.length * q * 1.25 > r.h) { q -= 1; l2 = lines(str, q, r.w, weight); } return q; });
    const ls = lines(str, s, r.w, weight), lh = s * 1.25, top = r.y + (r.h - ls.length * lh) / 2 + s * 0.88;
    const x = align === 'center' ? r.x + r.w / 2 : align === 'right' ? r.x + r.w : r.x;
    ls.forEach((ln, i) => text(ln, x, top + i * lh, s, color, UI, weight, align));
  };
  const panel = (r, rad = 20, fill = 'rgba(18,10,5,0.62)', brand = true) => {
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = 'rgba(246,223,174,0.22)'; ctx.lineWidth = 2; ctx.stroke();
    if (brand) edgeStroke(ctx, r, rad, 0.3);
  };
  const button = (r, label, o = {}) => {
    ui.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label });
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.45;
    const rad = Math.min(18, r.h / 3);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 5, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { gr.addColorStop(0, '#f6d684'); gr.addColorStop(1, '#cf9a32'); } else if (o.active) { gr.addColorStop(0, '#f6d684'); gr.addColorStop(1, '#d8a540'); } else { gr.addColorStop(0, '#7b4b26'); gr.addColorStop(1, '#4a2a12'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,170,0.55)'; ctx.lineWidth = 2; ctx.stroke();
    const size = o.size ?? 28, maxW = r.w - 20, col = o.primary || o.active ? '#2a1606' : CREAM, cy = r.y + r.h / 2;
    const w1 = (s, sz) => { ctx.font = `700 ${sz}px ${UI}`; return ctx.measureText(s).width; };
    let s1 = size; while (s1 > minU && w1(label, s1) > maxW) s1 -= 1;
    let best = { s: s1, ls: [label] };
    if (s1 < size * 0.74 && label.includes(' ')) {
      const ws = label.split(' ');
      for (let cut = 1; cut < ws.length; cut++) {
        const ls = [ws.slice(0, cut).join(' '), ws.slice(cut).join(' ')]; let s2 = size;
        while (s2 > minU && (Math.max(w1(ls[0], s2), w1(ls[1], s2)) > maxW || s2 * 2.3 > r.h)) s2 -= 1;
        if (s2 > best.s) best = { s: s2, ls };
      }
    }
    if (best.ls.length === 1) text(label, r.x + r.w / 2, cy + best.s * 0.35, best.s, col, UI, 700);
    else best.ls.forEach((ln, i) => text(ln, r.x + r.w / 2, cy + best.s * 0.35 + (i - 0.5) * best.s * 1.15, best.s, col, UI, 700));
    ctx.restore();
  };
  // a row of choices; `labels[i]` drawn in equal segments, `sel` highlighted
  const seg = (r, labels, sel, size = 24) => {
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(r.x, r.y + 4, r.w, r.h, 16); ctx.fill(); ctx.restore();
    const sw = r.w / labels.length;
    labels.forEach((lb, i) => {
      const cell = { x: r.x + i * sw, y: r.y, w: sw, h: r.h };
      ui.buttons.push({ ...cell, label: lb });
      ctx.beginPath(); ctx.roundRect(cell.x + 1, cell.y, cell.w - 2, cell.h, 14);
      const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      if (i === sel) { gr.addColorStop(0, '#f6d684'); gr.addColorStop(1, '#d8a540'); } else { gr.addColorStop(0, '#6a3f1e'); gr.addColorStop(1, '#43250f'); }
      ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = i === sel ? 'rgba(255,240,190,0.9)' : 'rgba(255,230,170,0.35)'; ctx.lineWidth = 2; ctx.stroke();
      const sz = fitSize(lb, size, sw - 14, UI, 700);
      text(lb, cell.x + sw / 2, r.y + r.h / 2 + sz * 0.35, sz, i === sel ? '#2a1606' : CREAM, UI, 700);
    });
  };

  drawTable(ctx, L.w, L.h, px);

  // ---------------------------------------------------------------- scenes
  if (scene === 'title') drawTitle();
  else if (scene === 'play' || scene === 'over') { drawPlay(); if (scene === 'over') drawOver(); }
  else if (scene === 'reader') drawReader();
  else if (scene === 'settings') drawSettings();
  else if (scene === 'demo-limit') drawDemoLimit();
  if (state.sceneT < 0.2) { ctx.fillStyle = `rgba(10,5,2,${(1 - state.sceneT / 0.2) * 0.85})`; ctx.fillRect(0, 0, L.w, L.h); }

  // ================================================================ title
  function heroBoard(cx, cy, bs) {                    // a tilted board with a capture in progress
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.07 + Math.sin(state.t * 0.5) * (state.calm ? 0 : 0.012));
    drawBoard(ctx, state.wood, 8, -bs / 2, -bs / 2, bs, px);
    const cell = (bs * 0.848) / 8, ox = -bs / 2 + bs * 0.076, oy = -bs / 2 + bs * 0.076, at = (r, c) => ({ x: ox + (c + 0.5) * cell, y: oy + (r + 0.5) * cell });
    const R2 = cell * 0.4;
    for (const [r, c, sd, k] of [[1, 2, -1, 0], [2, 5, -1, 0], [3, 2, -1, 0], [0, 5, -1, 0], [6, 1, 1, 0], [5, 4, 1, 0], [6, 5, 1, 0], [7, 2, 1, 0]]) { const p = at(r, c); drawPiece(ctx, p.x, p.y, R2, sd, !!k, set); }
    const kp = at(4, 3), bob = state.calm ? 0 : Math.sin(state.t * 2) * 0.1;
    drawPiece(ctx, kp.x, kp.y, R2 * 1.02, 1, true, set, { lift: 0.4 + bob, glow: '255,220,120' });
    ctx.restore();
  }
  function heroArt(H) {
    if (!H || H.w < 80 || H.h < 80) return;
    const wide = H.w >= H.h * 1.45 && H.h >= 240;
    if (wide) {                                         // title left, board right
      const lx = H.x + H.w * 0.28, s = Math.min(H.h / 400, (H.w * 0.5) / 520, 1.4), tsz = 150 * s;
      text('WEST AFRICAN DRAUGHTS', lx, H.y + H.h * 0.5 - tsz * 0.62, Math.max(minU, 25 * s), 'rgba(246,223,174,0.85)', UI, 700);
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5; text('Dame', lx, H.y + H.h * 0.5 + tsz * 0.3, tsz, GOLD, FONT, 700); ctx.restore();
      text('Flying kings. Backward captures.', lx, H.y + H.h * 0.5 + tsz * 0.3 + 56 * s, Math.max(minU, 28 * s), CREAM, FONT, 700);
      const bs = Math.min(H.h * 0.94, H.w * 0.42); heroBoard(H.x + H.w * 0.72, H.y + H.h / 2, bs);
      return;
    }
    const s = Math.min(H.w / 620, H.h / 520, 1.5), cx = H.x + H.w / 2;
    const small = H.h < 300 * 1 || s < 0.5;
    const ty = H.y + (small ? H.h * 0.46 : 112 * s);
    text('WEST AFRICAN DRAUGHTS', cx, H.y + (small ? H.h * 0.14 : 26 * s) + 12, Math.max(minU, 25 * s), 'rgba(246,223,174,0.85)', UI, 700);
    const tsz = (small ? Math.min(H.h * 0.42, 120) : 150 * s);
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
    text('Dame', cx, ty + tsz * 0.5, tsz, GOLD, FONT, 700); ctx.restore();
    if (!small) text('Flying kings. Backward captures.', cx, ty + 150 * s * 0.5 + 56 * s, Math.max(minU, 28 * s), CREAM, FONT, 700);
    if (small) return;
    const bs = Math.min(H.w * 0.72, 330 * s * 1.2, H.h - (ty - H.y) - 150 * s * 0.5 - 90 * s), by = ty + 150 * s * 0.5 + 84 * s;
    if (bs < 110) return;
    heroBoard(cx, by + bs / 2, bs);
  }
  function drawTitle() {
    const T = L.menu(!!state.saved), rows = T.rows;
    if (T.card) panel(T.card, 26, 'rgba(14,8,4,0.55)');
    heroArt(T.hero);
    if (rows.resume) button(rows.resume, 'Continue your game', { primary: true, size: 30 });
    button(rows.play, 'Play', { primary: !rows.resume, size: 38 });
    seg(rows.variant, ['Damii 10×10', 'Dame 8×8'], state.variant === 'damii' ? 0 : 1, 25);
    seg(rows.level, LEVELS.map((l, i) => l.name + (state.stats.badges[state.variant + i] ? ' ★' : '')), state.level, 23);
    seg(rows.side, ['You move first', 'Computer first'], state.human === 1 ? 0 : 1, 24);
    button(rows.auto, 'Auto Play · Watch & Learn', { size: 26 });
    button(rows.howto, 'How to Play', { size: 25 }); button(rows.rules, 'Rules', { size: 25 });
    button(rows.settings, 'Settings', { size: 25 }); button(rows.about, 'About', { size: 25 });
    const b = T.brand, cs = Math.max(10, Math.min(24, (T.card ? T.card.x - 30 - L.U.x0 : L.U.w - 24) / 26));
    ui.credit = lockup(b.x, b.y, cs, true);
    if (state.msg) wrap(state.msg.text, L.w / 2, L.h - 70, 24, Math.min(560, L.w - 40), '#ffe9b0');
  }

  // The game's own Arcforge lockup: a teak plate with a woven edge and a gold and a red cap either side of the credit.
  function lockup(cx, y, cs, tappable) {
    const pw = Math.min(cs * 25, L.U.w - 24), ph = cs * 3.1, plate = { x: cx - pw / 2, y: y - cs * 2.1, w: pw, h: ph };
    ctx.save(); ctx.beginPath(); ctx.roundRect(plate.x, plate.y, plate.w, plate.h, ph / 2);
    const pg2 = ctx.createLinearGradient(0, plate.y, 0, plate.y + ph); pg2.addColorStop(0, 'rgba(92,56,28,0.92)'); pg2.addColorStop(1, 'rgba(34,18,8,0.95)');
    ctx.fillStyle = pg2; ctx.fill(); ctx.strokeStyle = 'rgba(243,207,122,0.55)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.roundRect(plate.x + 4, plate.y + 4, plate.w - 8, ph - 8, ph / 2 - 4); ctx.clip();
    weaveRule(ctx, plate.x, plate.y + ph - 7, plate.w, 7); ctx.restore();
    drawPiece(ctx, plate.x + ph * 0.62, plate.y + ph * 0.46, ph * 0.28, 1, false, set); drawPiece(ctx, plate.x + plate.w - ph * 0.62, plate.y + ph * 0.46, ph * 0.28, -1, false, set);
    drawCredit(ctx, cx, y, cs * 0.92);
    return tappable ? plate : null;
  }

  // ================================================================ playing
  function boardFrame() {
    const B = L.board, geo = boardGeo(L, n, state.human === -1);
    drawBoard(ctx, state.wood, n, B.x, B.y, B.s, px);
    if (!state.calm) {                                     // a slow glint of lamp light crossing the lacquered board
      const ph = ((state.t * 0.045) % 1.8) - 0.4, gx = geo.gx, gy = geo.gy, s = geo.size;
      ctx.save(); ctx.beginPath(); ctx.rect(gx, gy, s, s); ctx.clip();
      const gr = ctx.createLinearGradient(gx + s * (ph - 0.18), gy, gx + s * (ph + 0.18) + s * 0.3, gy + s);
      gr.addColorStop(0, 'rgba(255,244,214,0)'); gr.addColorStop(0.5, 'rgba(255,244,214,0.09)'); gr.addColorStop(1, 'rgba(255,244,214,0)');
      ctx.fillStyle = gr; ctx.fillRect(gx, gy, s, s); ctx.restore();
    }
    return geo;
  }
  function labels(geo) {
    const flip = state.human === -1, size = Math.max(10, geo.cell * 0.24);
    if (geo.cell * (host.px || 0.5) < 26) return;
    const kb = L.board.s / SLAB, top = geo.gy + geo.size + 14 * kb + size * 0.25;
    ctx.save(); ctx.globalAlpha = 0.8;
    for (let c = 0; c < n; c++) { const lc = flip ? n - 1 - c : c; text('abcdefghij'[lc], geo.gx + (c + 0.5) * geo.cell, top + size * 0.35, size, '#f1e2bd', UI, 700); }
    const left = geo.gx - 14 * kb;
    for (let r = 0; r < n; r++) { const lr = flip ? r + 1 : n - r; text(String(lr), left, geo.gy + (r + 0.5) * geo.cell + size * 0.35, size, '#f1e2bd', UI, 700); }
    ctx.restore();
  }
  function drawPlay() {
    const geo = boardFrame(); labels(geo);
    const a = state.anim, pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 5.5);
    const human = state.human, R2 = geo.cell * 0.425;
    // square tints: the last move, then selection, destinations, hint
    const tint = (i, col) => { const r = geo.rect(i); ctx.fillStyle = col; ctx.fillRect(r.x, r.y, r.w, r.h); };
    if (g.last && !a) { tint(g.last.from, 'rgba(255,214,110,0.18)'); tint(g.last.to, 'rgba(255,214,110,0.3)'); }
    if (scene === 'play' && !a && !state.autoMode) {
      if (aux.mustCap && state.sel < 0 && aux.humanTurn) for (const i of aux.capFrom) { const c = geo.center(i); ctx.strokeStyle = `rgba(255,120,80,${0.55 + pulse * 0.4})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(c.x, c.y, R2 * (1.12 + pulse * 0.08), 0, TAU); ctx.stroke(); }
      if (state.sel >= 0) {
        tint(state.sel, 'rgba(120,255,170,0.3)');
        let at = state.sel; // the trail of landings already chosen
        for (const s of state.path) { const p0 = geo.center(at), p1 = geo.center(s); ctx.strokeStyle = 'rgba(255,236,150,0.8)'; ctx.lineWidth = 5; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); ctx.setLineDash([]); at = s; }
        if (state.marks !== false) for (const i of aux.dests) {
          const c = geo.center(i), cap = aux.mustCap;
          ctx.fillStyle = cap ? `rgba(255,120,80,${0.5 + pulse * 0.3})` : `rgba(255,236,150,${0.45 + pulse * 0.25})`;
          ctx.beginPath(); ctx.arc(c.x, c.y, R2 * 0.42, 0, TAU); ctx.fill();
          ctx.strokeStyle = cap ? 'rgba(255,170,130,0.9)' : 'rgba(255,248,210,0.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(c.x, c.y, R2 * 0.58, 0, TAU); ctx.stroke();
        }
      }
    }
    if (state.hint && !a) { for (const i of [state.hint.from, ...state.hint.path]) { const c = geo.center(i); ctx.strokeStyle = `rgba(120,255,170,${0.55 + pulse * 0.4})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(c.x, c.y, R2 * 1.1, 0, TAU); ctx.stroke(); } }

    // pieces, top row to bottom row. During an animation the board shows the position BEFORE the move, minus pieces already jumped.
    const cells = a ? a.pre : g.cells;
    const removed = a ? animRemoved(a) : null;
    const hidden = new Set(state.path.length && state.sel >= 0 ? aux.partialCaps : []);
    const drawAt = (i, v, o = {}) => {
      const c = geo.center(i);
      drawPiece(ctx, c.x, c.y, R2, Math.sign(v), Math.abs(v) === 2, set, o);
    };
    const order = []; for (let i = 0; i < cells.length; i++) if (cells[i]) order.push(i);
    order.sort((x, y) => geo.center(x).y - geo.center(y).y);
    for (const i of order) {
      if (a && i === a.move.from) continue;
      if (removed && removed.has(i)) continue;
      const v = cells[i];
      const mine = Math.sign(v) === human;
      const sel = state.sel === i && !state.path.length;
      const hop = state.sel === i && state.path.length;
      if (hop) continue;
      const o = { lift: sel ? 0.55 + (state.calm ? 0 : Math.sin(state.t * 3.2) * 0.07) : 0 };
      if (hidden.has(i)) o.alpha = 0.35;
      if (state.marks !== false && scene === 'play' && !a && aux.humanTurn && mine && aux.mustCap && aux.capFrom.has(i) && state.sel < 0) o.glow = '255,150,100';
      drawAt(i, v, o);
    }
    if (state.sel >= 0 && state.path.length && !a) {   // the piece mid-chain, shown on its last chosen landing
      const last = state.path[state.path.length - 1], c = geo.center(last), v = g.cells[state.sel];
      drawPiece(ctx, c.x, c.y, R2, Math.sign(v), Math.abs(v) === 2, set, { lift: 0.5 });
    }
    if (a) {
      const p = animPos(a, geo);
      {
        drawPiece(ctx, p.x, p.y, R2, a.side, p.king, set, { lift: p.lift });
        if (p.stamp > 0) { ctx.strokeStyle = `rgba(255,236,160,${0.8 * p.stamp})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, R2 * (1 + (1 - p.stamp) * 1.2), 0, TAU); ctx.stroke(); }
      }
      for (const fx of animEffects(a, geo)) {
        if (fx.type === 'ring') { ctx.strokeStyle = `rgba(255,236,190,${0.7 * fx.a})`; ctx.lineWidth = 5 * fx.a + 1; ctx.beginPath(); ctx.ellipse(fx.x, fx.y, R2 * (0.5 + fx.k * 1.1), R2 * (0.45 + fx.k * 0.95), 0, 0, TAU); ctx.stroke(); }
        else if (fx.type === 'chip') { drawPiece(ctx, fx.x, fx.y, R2 * fx.s, fx.side, false, set, { alpha: fx.a, shadow: false, lift: fx.lift }); }
        else if (fx.type === 'spark') { ctx.fillStyle = `rgba(255,214,110,${fx.a})`; ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r, 0, TAU); ctx.fill(); }
      }
    }
    if (state.kb && scene === 'play') { const c = geo.center(state.cursor); ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 4; ctx.strokeRect(c.x - geo.cell / 2 + 3, c.y - geo.cell / 2 + 3, geo.cell - 6, geo.cell - 6); }

    // ---- cards, message, buttons
    const mine = (side) => side === human;
    const nameOf = (side) => state.autoMode ? (side === 1 ? `${sideName(set, 1)} computer` : `${sideName(set, -1)} computer`) : state.vsComputer === false ? sideName(set, side) : mine(side) ? 'You' : 'Computer';
    const subOf = (side) => `${sideName(set, side)}${state.autoMode || !mine(side) ? ' · ' + LEVELS[state.level].name : ''}`;
    const takenBy = (side) => { const init = g.n === 10 ? 20 : 12; return init - count(g, -side); };
    const leftOf = (side) => count(g, side);
    const turnSide = g.winner ? 0 : g.turn;
    const card = (r, side, padL = 0) => {
      const active = turnSide === side && scene === 'play';
      panel(r, 20, active ? 'rgba(52,32,10,0.78)' : 'rgba(18,10,5,0.62)', false);
      if (active) { ctx.save(); ctx.strokeStyle = `rgba(243,207,122,${0.55 + pulse * 0.35})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 19); ctx.stroke(); ctx.restore(); }
      else edgeStroke(ctx, r, 20, 0.22);
      const tall = r.h >= 165;
      const ir = Math.min(30, r.h * 0.28, r.w * 0.12), ix = r.x + 22 + padL + ir, iy = tall ? r.y + 22 + ir : r.y + Math.min(r.h * 0.38, 12 + ir + 6);
      drawPiece(ctx, ix, iy, ir * 1.0, side, false, set, { shadow: true });
      const tx = ix + ir + 14, tw = (tall || r.w < 440 ? r.x + r.w - 90 : r.x + r.w * (r.w > r.h * 2.2 ? 0.5 : 0.68) - 8) - tx;
      fit(nameOf(side), tx, iy - 2, 34, tw, '#ffffff', FONT, 700, 'left', 18);
      fit(subOf(side), tx, iy + 26, 22, tw, 'rgba(246,223,174,0.85)', UI, 600, 'left', minU);
      // captured tray
      const nCap = takenBy(side), init = g.n === 10 ? 20 : 12, rr = Math.min(24, tall ? 17 : r.w < 440 ? r.h * 0.12 : r.h * 0.17);
      let tx0, ty0, tw0;
      if (tall) { tx0 = r.x + 20; ty0 = iy + ir + 34; tw0 = r.w - 40; text(`Captured ${nCap} · ${leftOf(side)} left`, r.x + 20, ty0, Math.max(minU, 22), CREAM, UI, 600, 'left'); ty0 += 26; }
      else if (r.w < 440) { tx0 = r.x + 20; tw0 = r.w - 40; ty0 = r.y + r.h - rr - 12; text(`${leftOf(side)} left`, r.x + r.w - 20, r.y + 28, Math.max(minU, 22), CREAM, UI, 600, 'right'); }
      else { tx0 = r.x + r.w * (r.w > r.h * 2.2 ? 0.5 : 0.68); ty0 = r.y + r.h * 0.5 - (r.h > 120 ? 8 : 0); tw0 = r.x + r.w - 18 - tx0; text(`${leftOf(side)} left`, r.x + r.w - 20, r.y + 28, Math.max(minU, 22), CREAM, UI, 600, 'right'); ty0 = r.y + Math.max(r.h * 0.5, 52); }
      let rr2 = rr, step = 0, perRow = 1;
      for (let tries = 0; tries < 12; tries++) {            // shrink the tray discs until every captured piece fits inside the card
        step = Math.min(rr2 * 1.35, Math.max(5, tw0 / Math.max(1, Math.min(init, 10)))); perRow = Math.max(1, Math.floor((tw0 - 2 * rr2) / step) + 1);
        const rowsNeeded = Math.max(1, Math.ceil(nCap / perRow)), room = r.y + r.h - 10 - (ty0 - rr2);
        if (rr2 <= 7 || (rowsNeeded - 1) * rr2 * 1.5 + rr2 * 2 <= room) break;
        rr2 -= 1.5;
      }
      for (let k = 0; k < nCap; k++) {
        const col = k % perRow, row = Math.floor(k / perRow);
        drawPiece(ctx, tx0 + rr2 + col * step, ty0 + row * rr2 * 1.5, rr2, -side, false, set, { shadow: false, alpha: 0.95 });
      }
    };
    const padFor = (r) => (L.backBox.w && r.x < L.backBox.x + L.backBox.w && r.y < L.backBox.y + L.backBox.h ? L.backBox.x + L.backBox.w - r.x - 10 : 0);
    // top card = the side that is NOT at the bottom
    card(L.opp, -human, padFor(L.opp));
    card(L.you, human, padFor(L.you));
    if (L.info) infoCard(L.info);
    const statusText = () => {
      if (scene === 'over') return '';
      if (state.autoMode) return state.autoPaused ? 'Paused' : state.autoPhase === 'reveal' ? 'This is the move it chose' : `${sideName(set, g.turn)} is thinking${'.'.repeat(1 + (Math.floor(state.t * 3) % 3))} (think time ${THINK_STEPS[state.autoThinkIdx]} s)`;
      if (aux.humanTurn) return aux.mustCap ? 'Your move: capture is compulsory' : 'Your move';
      return `The computer is thinking${'.'.repeat(1 + (Math.floor(state.t * 3) % 3))}`;
    };
    // message strip
    const M = L.msg, mAlpha = state.msg ? Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5) : 0;
    const status = statusText();
    if (L.mode === 'port') {
      const mr = { x: M.x, y: M.y + 2, w: M.w, h: M.h - 4 };
      ctx.save(); ctx.beginPath(); ctx.roundRect(mr.x, mr.y, mr.w, mr.h, 14); ctx.fillStyle = state.msg && mAlpha > 0 ? 'rgba(10,5,2,0.75)' : 'rgba(0,0,0,0.25)'; ctx.fill();
      if (state.msg && mAlpha > 0) { ctx.strokeStyle = `rgba(243,207,122,${0.8 * mAlpha})`; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.restore();
      wrapBox(state.msg && mAlpha > 0.05 ? state.msg.text : status, { x: mr.x + 10, y: mr.y + 2, w: mr.w - 20, h: mr.h - 4 }, scale > 1 ? 28 : 25, state.msg && mAlpha > 0.05 ? '#fff3d6' : GOLD);
    } else {
      const base = L.info ? M : M;
      ctx.beginPath(); ctx.roundRect(base.x, base.y, base.w, base.h, 16); ctx.fillStyle = 'rgba(10,5,2,0.55)'; ctx.fill(); ctx.strokeStyle = state.msg && mAlpha > 0 ? `rgba(243,207,122,${0.8 * mAlpha})` : 'rgba(246,223,174,0.2)'; ctx.lineWidth = 2; ctx.stroke();
      wrapBox(state.msg && mAlpha > 0.05 ? state.msg.text : status, { x: base.x + 12, y: base.y + 4, w: base.w - 24, h: base.h - 8 }, 26, state.msg && mAlpha > 0.05 ? '#fff3d6' : GOLD);
    }
    const BTN = L.BTN, bsz = L.land ? 25 : 26;
    if (scene === 'play') {
      if (state.autoMode) {
        button(BTN.auto.exit, 'Exit', { size: 24 });
        button(BTN.auto.pause, state.autoPaused ? '▶ Resume' : '❙❙ Pause', { size: 24, primary: state.autoPaused });
        button(BTN.auto.dec, '− Think', { size: 22, dim: state.autoThinkIdx <= 0 });
        button(BTN.auto.inc, 'Think +', { size: 22, dim: state.autoThinkIdx >= THINK_STEPS.length - 1 });
      } else {
        button(BTN.menu, 'Menu', { size: bsz });
        button(BTN.undo, 'Take back', { size: bsz, dim: !state.undo.length });
        button(BTN.hint, state.thinking && state.hintBusy ? 'Thinking…' : 'Hint', { size: bsz });
      }
    }
    function infoCard(r) {
      panel(r, 20, 'rgba(18,10,5,0.55)');
      const vr = VARIANTS[state.variant], x = r.x + 20, w = r.w - 40; let y = r.y + 42;
      fit(vr.name, x, y, 34, w, '#fff', FONT, 700, 'left', 20); y += 12;
      const flags = [state.autoMode ? `Auto Play · think ${THINK_STEPS[state.autoThinkIdx]} s` : `Computer: ${LEVELS[state.level].name}`, g.lone ? 'Last piece loses' : 'No last-piece rule', g.majority ? 'Most pieces must be taken' : 'Free choice of captures'];
      for (const t of flags) { y += 30; fit(t, x, y, 22, w, 'rgba(246,223,174,0.9)', UI, 600, 'left', minU); }
      y += 16; weaveRule(ctx, x, y, w, 8); y += 34;
      text('Moves', x, y, Math.max(minU, 22), GOLD, UI, 700, 'left');
      // the move list: pairs "1. c3-d4  d6-c5", newest at the bottom, as many as fit
      const log = g.log || [], lh = Math.max(minU, 22) * 1.45, avail = Math.floor((r.y + r.h - 16 - (y + 10)) / lh), pairs = Math.ceil(log.length / 2);
      const first = Math.max(0, pairs - Math.max(1, avail));
      for (let p = first, row = 0; p < pairs; p++, row++) {
        const yy = y + 10 + (row + 1) * lh - lh * 0.25, a1 = log[p * 2], a2 = log[p * 2 + 1], newest = p === pairs - 1;
        text(`${p + 1}.`, x, yy, Math.max(minU, 21), 'rgba(246,223,174,0.55)', UI, 600, 'left');
        fit(a1 || '', x + 44, yy, 22, (w - 44) / 2 - 6, newest && !a2 ? '#ffe9a0' : '#fff', UI, 600, 'left', 13);
        if (a2) fit(a2, x + 44 + (w - 44) / 2, yy, 22, (w - 44) / 2 - 6, newest ? '#ffe9a0' : '#fff', UI, 600, 'left', 13);
      }
      if (!log.length) text('No moves yet', x, y + 40, Math.max(minU, 21), 'rgba(246,223,174,0.6)', UI, 500, 'left');
    }
  }

  // ================================================================ result
  function drawOver() {
    const O = L.over, c = O.card;
    ctx.fillStyle = 'rgba(8,4,2,0.62)'; ctx.fillRect(0, 0, L.w, L.h);
    panel(c, 26, 'rgba(26,14,6,0.94)');
    const human = state.human, win = g.winner === human, draw = g.winner === 2;
    const head = draw ? 'A draw' : state.autoMode ? `${sideName(set, g.winner)} wins` : win ? 'You win!' : 'The computer wins';
    const cx = c.x + c.w / 2;
    if (!draw) drawPiece(ctx, cx, c.y + 78, 46, g.winner, true, set, { glow: '255,214,110' });
    fit(head, cx, c.y + 168, Math.round(66 * Math.min(scale, 1.2)), c.w - 40, GOLD, FONT, 700);
    const rs = Math.round(29 * Math.min(scale, 1.4)); const ln = wrap(g.reason, cx, c.y + 208, rs, c.w - 60, '#fff3d6', rs * 1.25, 'center', 600);
    text(`${g.moves} moves · ${count(g, 1)} v ${count(g, -1)} pieces left`, cx, c.y + 208 + ln * rs * 1.25 + 24, Math.max(minU, 26), 'rgba(246,223,174,0.85)', UI, 500);
    if (win && !state.autoMode) text(`★ ${LEVELS[state.level].name} beaten`, cx, c.y + 208 + ln * rs * 1.25 + 66, 30, '#ffd24a', UI, 700);
    if (win && !state.calm) for (let k = 0; k < 14; k++) { const ph = (state.t * 0.35 + k * 0.137) % 1, x = cx + Math.sin(k * 2.4) * (130 + 90 * ph), y = c.y + 90 - ph * 150; ctx.fillStyle = `rgba(255,214,110,${0.8 * (1 - ph)})`; ctx.beginPath(); ctx.arc(x, y, 3 + (k % 3) * 2, 0, TAU); ctx.fill(); }
    button(O.again, 'Play again', { primary: true, size: 34 }); button(O.menu, 'Menu', { size: 28 });
    drawMoreLine(ctx, O.more.x, O.more.y, Math.max(minU, 24));
  }

  // ================================================================ reader
  function diagram(d, x, y, w) {
    const D = DIAGRAMS[d], cs = Math.min(w / D.n, 62), S = cs * D.n, x0 = x + (w - S) / 2;
    ctx.save(); ctx.beginPath(); ctx.roundRect(x0 - 8, y - 8, S + 16, S + 16, 12); ctx.fillStyle = state.wood === 'ebony' ? '#2a1a10' : '#6e4220'; ctx.fill(); ctx.restore();
    for (let r = 0; r < D.n; r++) for (let c = 0; c < D.n; c++) { ctx.fillStyle = (r + c) % 2 ? '#5b3517' : '#ecd5a3'; ctx.fillRect(x0 + c * cs, y + r * cs, cs, cs); }
    const P = (r, c) => ({ x: x0 + (c + 0.5) * cs, y: y + (r + 0.5) * cs });
    for (const [r, c] of D.dots || []) { const p = P(r, c); ctx.fillStyle = 'rgba(255,236,150,0.85)'; ctx.beginPath(); ctx.arc(p.x, p.y, cs * 0.17, 0, TAU); ctx.fill(); }
    if (D.from) {
      let at = D.from; ctx.strokeStyle = 'rgba(120,255,170,0.95)'; ctx.fillStyle = 'rgba(120,255,170,0.95)'; ctx.lineWidth = 4;
      for (const s of D.path) { const p0 = P(...at), p1 = P(...s); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); const an = Math.atan2(p1.y - p0.y, p1.x - p0.x); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p1.x - Math.cos(an - 0.5) * 14, p1.y - Math.sin(an - 0.5) * 14); ctx.lineTo(p1.x - Math.cos(an + 0.5) * 14, p1.y - Math.sin(an + 0.5) * 14); ctx.closePath(); ctx.fill(); at = s; }
    }
    for (const [r, c, sd, k] of D.pcs) { const p = P(r, c); drawPiece(ctx, p.x, p.y, cs * 0.4, sd, !!k, set); }
    for (const [r, c] of D.caps || []) { const p = P(r, c); ctx.strokeStyle = '#ff6a50'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(p.x - cs * 0.28, p.y - cs * 0.28); ctx.lineTo(p.x + cs * 0.28, p.y + cs * 0.28); ctx.moveTo(p.x + cs * 0.28, p.y - cs * 0.28); ctx.lineTo(p.x - cs * 0.28, p.y + cs * 0.28); ctx.stroke(); }
    const lsz = Math.max(minU, 22 * Math.min(scale, 1.4)), ls = lines(D.label, lsz, w);
    ls.forEach((ln, i) => text(ln, x + w / 2, y + S + 16 + lsz + i * lsz * 1.3, lsz, 'rgba(246,223,174,0.88)', UI, 600));
    return S + 16 + 14 + ls.length * lsz * 1.3 + 10;
  }
  // ---- illustrated blocks for the About page: each returns its height; `x, y, w` is the box it may use
  function artH(kind, w) {
    if (kind === 'hero') return Math.max(340, Math.min(560, w * 0.9, L.reader.viewport.h * 0.92));
    if (kind === 'caps') return Math.min(150, w / 4) + 30;
    if (kind === 'sets') return Math.min(330, w * 0.7) + 20;
    if (kind === 'lockup') return 110;
    return 0;
  }
  function artDraw(kind, x, y, w) {
    const h = artH(kind, w), cx = x + w / 2;
    if (kind === 'hero') { heroArt({ x, y, w, h }); return h; }
    if (kind === 'caps') {
      const r = Math.min(46, w / 9);
      [[1, 0], [-1, 0], [1, 1], [-1, 0], [1, 0]].forEach(([sd, k], i) => drawPiece(ctx, cx + (i - 2) * r * 2.25, y + r * 1.4 + (i % 2) * r * 0.35, r, sd, !!k, set, { lift: i === 2 ? 0.4 : 0 }));
      return h;
    }
    if (kind === 'sets') {
      const cw = Math.min(w / 2 - 12, 260), r = Math.min(40, cw / 5);
      [['caps', 'Bottle caps'], ['wood', 'Carved wood']].forEach(([st, nm], j) => {
        const bx = cx + (j ? 1 : -1) * (cw / 2 + 6), by = y + 6, bw = cw, bh = h - 14;
        ctx.save(); ctx.beginPath(); ctx.roundRect(bx - bw / 2, by, bw, bh, 18); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.strokeStyle = 'rgba(246,223,174,0.25)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
        // a little board strip under the pieces
        const sw = bw - 28, sq = sw / 6, sy = by + bh * 0.52;
        for (let c = 0; c < 6; c++) { ctx.fillStyle = c % 2 ? (j ? '#3a271a' : '#6b4120') : '#ecd5a3'; ctx.fillRect(bx - sw / 2 + c * sq, sy, sq, sq); ctx.fillStyle = (c + 1) % 2 ? (j ? '#3a271a' : '#6b4120') : '#ecd5a3'; ctx.fillRect(bx - sw / 2 + c * sq, sy + sq, sq, sq); }
        drawPiece(ctx, bx - sq * 1.5, sy + sq * 0.5, sq * 0.4, 1, false, st); drawPiece(ctx, bx + sq * 0.5, sy + sq * 1.5, sq * 0.4, -1, false, st); drawPiece(ctx, bx + sq * 1.5, sy + sq * 0.5, sq * 0.42, 1, true, st);
        text(nm, bx, by + bh * 0.22, Math.max(minU, 24), GOLD, UI, 700);
        text(j ? 'Light and dark' : 'Gold and red', bx, by + bh * 0.22 + 28, Math.max(minU, 19), 'rgba(246,223,174,0.75)', UI, 500);
      });
      return h;
    }
    if (kind === 'lockup') { lockup(cx, y + 70, 22, false); return h; }
    return 0;
  }
  function diagH(d, w) { const D = DIAGRAMS[d], cs = Math.min(w / D.n, 62), lsz = Math.max(minU, 22 * Math.min(scale, 1.4)); return cs * D.n + 16 + 14 + lines(D.label, lsz, w).length * lsz * 1.3 + 10; }
  function drawReader() {
    const RL = L.reader, p = RL.panel, vp = RL.viewport, doc = DOCS[state.doc] ?? DOCS.rules, sc0 = Math.max(0, Math.min(state.readerScroll || 0, readerMetrics.max));
    ctx.fillStyle = 'rgba(6,3,1,0.45)'; ctx.fillRect(0, 0, L.w, L.h);
    ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 26);
    const pg = ctx.createLinearGradient(0, p.y, 0, p.y + p.h); pg.addColorStop(0, 'rgba(58,38,20,0.9)'); pg.addColorStop(1, 'rgba(22,13,6,0.94)');
    ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = 'rgba(246,223,174,0.32)'; ctx.lineWidth = 2; ctx.stroke();
    edgeStroke(ctx, p, 26, 0.3);
    fit(doc.title, RL.titleX, p.y + 54, 46, RL.header.textDec.x - RL.titleX - 90, GOLD, FONT, 700, 'left', 28);
    weaveRule(ctx, p.x + 24, p.y + RL.headH - 4, p.w - 48, 10);
    const side = vp.w >= 820, bodyW = side ? Math.min(vp.w * 0.5, 640) : Math.min(vp.w - 20, 820), size = Math.round(28 * scale), lh = Math.round(size * 1.38), gap = Math.round(12 * scale);
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x - 6, vp.y, vp.w + 12, vp.h); ctx.clip();
    let y = vp.y - sc0;
    const textX = side ? vp.x + 14 : vp.x + (vp.w - bodyW) / 2;
    doc.secs.forEach((sec, i) => {
      const t0 = Math.round(34 * Math.min(scale, 2)), tw = side ? vp.w - 28 : bodyW;
      if (sec.art === 'hero') {                                                     // a full-width illustration, no heading
        const hh = artH('hero', vp.w); if (y + hh > vp.y - 40 && y < vp.y + vp.h + 40) artDraw('hero', vp.x, y, vp.w); y += hh + 4;
      } else {
        const tSize = fitSize(sec.title, t0, tw, UI, 700, 22);
        if (i > 0) y += Math.round(26 * Math.min(scale, 2));
        const ty0 = y + Math.max(30, tSize * 0.9);
        if (ty0 > vp.y - 80 && ty0 < vp.y + vp.h + 80) text(sec.title, textX, ty0, tSize, '#ffd24a', UI, 700, 'left');
        y = ty0 + 14;
      }
      const top = y;
      let dh = 0;
      if (sec.art && sec.art !== 'hero' && side) {
        const dw = vp.w - bodyW - 60; dh = artH(sec.art, dw) + 8;
        if (top + dh > vp.y - 40 && top < vp.y + vp.h + 40) artDraw(sec.art, textX + bodyW + 30, top + 12, dw);
      } else if (sec.art && sec.art !== 'hero') {
        const dw = Math.min(vp.w - 20, 520); dh = artH(sec.art, dw) + 8;
        if (top + dh > vp.y - 40 && top < vp.y + vp.h + 40) artDraw(sec.art, vp.x + (vp.w - dw) / 2, top + 12, dw);
        y = top + dh + 12;
      } else if (sec.diagram && side) {
        const dw = vp.w - bodyW - 60; dh = diagH(sec.diagram, dw) + 8;
        if (top + dh > vp.y - 40 && top < vp.y + vp.h + 40) diagram(sec.diagram, textX + bodyW + 30, top + 12, dw);
      } else if (sec.diagram) {
        const dw = Math.min(vp.w - 20, 460); dh = diagH(sec.diagram, dw) + 8;
        if (top + dh > vp.y - 40 && top < vp.y + vp.h + 40) diagram(sec.diagram, vp.x + (vp.w - dw) / 2, top + 12, dw);
        y = top + dh + 12;
      }
      let ty2 = (side ? top : y) + Math.round(size * 1.05);
      for (const line of sec.lines) {
        const ls = lines(line, size, bodyW);
        if (ty2 + ls.length * lh > vp.y - 80 && ty2 - size < vp.y + vp.h + 80) ls.forEach((ln, k) => text(ln, textX, ty2 + k * lh, size, '#ffffff', UI, 600, 'left'));
        ty2 += ls.length * lh + gap;
      }
      y = side ? Math.max(ty2 - size, top + dh) : ty2 - size * 0.4;
    });
    ctx.restore();
    const contentH = y - (vp.y - sc0) + 24;
    if (contentH - vp.h > 8) {
      const fade = (y0, y1, a0, a1) => { const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(30,18,9,${a0})`); gr.addColorStop(1, `rgba(30,18,9,${a1})`); ctx.fillStyle = gr; ctx.fillRect(vp.x - 6, Math.min(y0, y1), vp.w + 12, Math.abs(y1 - y0)); };
      if (sc0 < contentH - vp.h - 2) fade(vp.y + vp.h - 36, vp.y + vp.h, 0, 0.96);
      if (sc0 > 2) fade(vp.y + 24, vp.y, 0, 0.96);
    }
    readerMetrics.max = contentH - vp.h <= 8 ? 0 : Math.ceil(contentH - vp.h); readerMetrics.view = vp.h;
    if (readerMetrics.max > 0) {
      const sb = RL.scrollbar, th = Math.max(48, sb.h * vp.h / contentH), ty = sb.y + (sc0 / readerMetrics.max) * (sb.h - th);
      ctx.fillStyle = 'rgba(246,223,174,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x + 7, sb.y, 8, sb.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(246,223,174,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x + 5, ty, 12, th, 6); ctx.fill();
    }
    text(readerMetrics.max > 0 ? (sc0 >= readerMetrics.max - 1 ? 'End' : 'Scroll or tap Next for more') : '', RL.cx, RL.counterY, Math.max(minU, 21), 'rgba(246,223,174,0.65)', UI, 500);
    button(RL.header.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 });
    button(RL.header.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    text(`${Math.round(scale * 100)}%`, RL.header.textDec.x - 12, RL.header.textDec.y + RL.header.textDec.h / 2 + 8, Math.max(minU, 20), 'rgba(246,223,174,0.8)', UI, 600, 'right');
    button(RL.nav.back, 'Back', { size: 28 });
    button(RL.nav.next, readerMetrics.max <= 0 || sc0 >= readerMetrics.max - 1 ? 'Done' : 'Next', { size: 28, primary: true });
  }

  // ================================================================ settings
  function drawSettings() {
    const S = L.settings, p = S.panel;
    ctx.fillStyle = 'rgba(6,3,1,0.45)'; ctx.fillRect(0, 0, L.w, L.h);
    panel(p, 26, 'rgba(34,20,9,0.93)');
    fit('Settings', S.titleX, p.y + 54, 46, p.w - 60 - (S.titleX - p.x), GOLD, FONT, 700, 'left', 28);
    weaveRule(ctx, p.x + 24, p.y + 68, p.w - 48, 10);
    const items = settingsItems(state);
    const cols = S.cols, gap = 12, rowsN = Math.ceil(items.length / cols), area = S.area;
    const rh = Math.max(56, Math.min(132, (area.h - (rowsN - 1) * gap - 16) / rowsN)), cw = (area.w - (cols - 1) * gap) / cols;
    state.settingsRects = items.map((it, i) => ({ key: it.key, rect: { x: area.x + (i % cols) * (cw + gap), y: area.y + Math.floor(i / cols) * (rh + gap) + 8, w: cw, h: rh } }));
    state.settingsRects.forEach((sr, i) => {
      const it = items[i];
      if (it.kind === 'text') {
        const r = sr.rect, bw = 96; ui.buttons.push({ ...r, label: it.label });
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.fill();
        fit(it.label, r.x + 16, r.y + r.h / 2 + 8, 25, r.w - 2 * bw - 40, CREAM, UI, 600, 'left');
        sr.dec = { x: r.x + r.w - 2 * bw - 14, y: r.y + 6, w: bw, h: r.h - 12 }; sr.inc = { x: r.x + r.w - bw - 8, y: r.y + 6, w: bw, h: r.h - 12 };
        button(sr.dec, 'A−', { size: 26, dim: state.textScaleIdx === 0 }); button(sr.inc, 'A+', { size: 26, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
      } else toggle(sr.rect, it);
    });
  }

  function toggle(r, it) {
    ui.buttons.push({ ...r, label: it.label });
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.roundRect(r.x + 2, r.y + 5, r.w, r.h, 16); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (it.on) { gr.addColorStop(0, '#f6d684'); gr.addColorStop(1, '#d8a540'); } else { gr.addColorStop(0, '#6a3f1e'); gr.addColorStop(1, '#43250f'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 16); ctx.fill(); ctx.strokeStyle = 'rgba(255,230,170,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    const col = it.on ? '#2a1606' : CREAM;
    if (r.h >= 66 || r.w < 420) {
      fit(it.label, r.x + 18, r.y + r.h * 0.38, 22, r.w - 36, it.on ? 'rgba(42,22,6,0.8)' : 'rgba(246,223,174,0.8)', UI, 600, 'left');
      fit(it.value, r.x + 18, r.y + r.h * 0.76, 30, r.w - 36, col, UI, 700, 'left');
    } else { fit(it.label, r.x + 18, r.y + r.h / 2 + 8, 24, r.w * 0.55, col, UI, 600, 'left'); fit(it.value, r.x + r.w - 18, r.y + r.h / 2 + 9, 26, r.w * 0.4, col, UI, 700, 'right'); }
  }

  function drawDemoLimit() {
    const c = L.over.card; panel(c, 26, 'rgba(26,14,6,0.94)');
    const cx = c.x + c.w / 2;
    drawPiece(ctx, cx, c.y + 100, 58, 1, true, set, { glow: '255,214,110' });
    fit('That was the free taste.', cx, c.y + 220, 48, c.w - 40, GOLD, FONT, 700);
    wrap('Get Dame on iPhone and Android for unlimited games.', cx, c.y + 270, 27, c.w - 60, '#fff3d6', 34);
    button(L.over.menu, 'Menu', { size: 28 });
  }
}

// The Settings items in one place: drawn by the view, acted on by game.js.
export function settingsItems(state) {
  const loneTxt = { auto: 'Variant default', on: 'On', off: 'Off' }[state.loneOpt];
  return [
    { key: 'sound', label: 'Sound', value: state.sound ? 'On' : 'Off', on: state.sound },
    { key: 'calm', label: 'Reduced motion', value: state.calm ? 'On' : 'Off', on: state.calm },
    { key: 'marks', label: 'Show legal moves', value: state.marks ? 'On' : 'Off', on: state.marks },
    { key: 'wood', label: 'Board', value: WOOD_NAMES[state.wood], on: false },
    { key: 'set', label: 'Pieces', value: SET_NAMES[state.set], on: false },
    { key: 'lone', label: 'Last piece loses', value: loneTxt, on: state.loneOpt === 'on' },
    { key: 'majority', label: 'Take the most pieces', value: state.majority ? 'On' : 'Off', on: state.majority },
    { key: 'text', kind: 'text', label: `Text size ${Math.round((TEXT_SCALES[state.textScaleIdx] ?? 1) * 100)}%` },
  ];
}
