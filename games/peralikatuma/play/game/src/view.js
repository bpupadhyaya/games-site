// Everything that is drawn each frame. Reads `state` (game.js) and changes nothing. All positions come from the live layout (layout.js).
import { TEXT_SCALES, THINK_STEPS, host, inRect, R, clamp, boardAt, BOARD_CELLS } from './layout.js';
import { drawTable, drawBoard, drawPiece, drawDiagram, diagramSize, blob, WOODS, woodPattern } from './art.js';
import { v3 } from './v3.js';
import { RULES, HOWTO, ABOUT, LESSONS } from './content.js';
import { settingsItems } from './settings.js';
import { VARIANTS, NAMES, START, pieceCount, sideOf, newGame } from './rules.js';
import { LEVELS } from './ai.js';
import { drawCredit, drawLockup, drawMoreLine, drawBadgeStack, edgeStroke } from './brand.js';

const FONT = '"Cormorant Garamond", "Hiragino Mincho ProN", Georgia, "Times New Roman", serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const GOLD = '#f2d08a', CREAM = '#fff6e0', DIM = 'rgba(242,208,138,0.78)', VERM = '#0f7d70';
const TAU = Math.PI * 2;
export const ui = { hits: [], buttons: [] };
export const docMetrics = { max: 0, view: 0 };
export const readerStats = { fits: 0 };
const fitMemo = new Map(); let fitFontsKey = '';
const ease = (f) => f * f * (3 - 2 * f);
const HERO = (() => { const b = newGame('classic').board; b[22] = 0; b[4] = 0; b[48] = 2; b[31] = 2; return b; })();   // the title's demonstration position

export function render(ctx, state, L) {
  { ctx.font = `700 40px ${FONT}`; const a = ctx.measureText('Hamburgefonstiv').width; ctx.font = `600 40px ${UI}`; const k = a + '/' + ctx.measureText('Hamburgefonstiv').width; if (k !== fitFontsKey || fitMemo.size > 3000) { fitMemo.clear(); fitFontsKey = k; } }
  const memo = (key, fn) => { let v = fitMemo.get(key); if (v === undefined) { readerStats.fits++; v = fn(); fitMemo.set(key, v); } return v; };
  ui.hits.length = 0; ui.buttons.length = 0;
  const scene = state.scene, scale = TEXT_SCALES[state.textScaleIdx] ?? 1, big = scale > 1, g = state.game, a = state.anim, B = L.board;
  const minU = Math.max(12, 11 / (host.px || 0.6));
  const wood = state.wood, style = state.style;

  // ---------------------------------------------------------------- helpers
  const text = (str, x, y, size, color = CREAM, font = UI, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const fitText = (str, x, y, size, maxW, color, font = UI, weight = 700, align = 'center', min = minU) => {
    const s = memo(`f|${str}|${size}|${maxW}|${font}|${weight}|${min}`, () => { let q = size; ctx.font = `${weight} ${q}px ${font}`; while (q > min && ctx.measureText(str).width > maxW) { q -= 1; ctx.font = `${weight} ${q}px ${font}`; } return q; });
    text(str, x, y, s, color, font, weight, align); return s;
  };
  const lines = (str, size, maxW, weight = 600, font = UI) => memo(`l|${weight}|${size}|${maxW}|${font}|${str}`, () => {
    ctx.font = `${weight} ${size}px ${font}`; const words = str.split(' '), out = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { out.push(cur); cur = w; } else cur = t2; }
    out.push(cur); return out;
  });
  const wrapBox = (str, r, size, lhRatio, color, align = 'center', min = minU, valign = 'middle') => {
    const s = memo(`b|${str}|${size}|${r.w}|${r.h}|${lhRatio}|${min}`, () => { let q = size, l2 = lines(str, q, r.w); while (q > min && (l2.length * q * lhRatio > r.h || l2.some((l) => ctx.measureText(l).width > r.w + 0.5))) { q -= 1; l2 = lines(str, q, r.w); } return q; });
    const ls = lines(str, s, r.w), lh = s * lhRatio, x = align === 'center' ? r.x + r.w / 2 : align === 'right' ? r.x + r.w : r.x;
    const y0 = valign === 'middle' ? r.y + (r.h - ls.length * lh) / 2 : r.y;
    ls.forEach((ln, i) => text(ln, x, y0 + s * 0.85 + i * lh, s, color, UI, 600, align));
    return ls.length;
  };
  // ---- carved HUD: teak plaques with a brass inlay line and corner studs, lacquered buttons with a lit face, a thick side and a pressed state
  const alphaOf = (c) => { const m = /,\s*([\d.]+)\)\s*$/.exec(c || ''); return m ? Number(m[1]) : 1; };
  const panel = (r, rad = 18, fill = 'rgba(4,26,31,0.66)', stroke = 'rgba(242,208,138,0.22)', brand = true) => {
    const hot = alphaOf(stroke) >= 0.4, f = Math.min(8, Math.max(4, r.h * 0.07)), fa = Math.min(0.97, 0.55 + alphaOf(fill) * 0.45);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 7;
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = '#24110a'; ctx.fill();
    ctx.restore();
    const wp = woodPattern(ctx);
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad);
    if (wp) { ctx.fillStyle = wp; ctx.fill(); } else { const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h); g.addColorStop(0, '#6a3a1c'); g.addColorStop(1, '#3a1d0e'); ctx.fillStyle = g; ctx.fill(); }
    const shade = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); shade.addColorStop(0, 'rgba(255,214,160,0.16)'); shade.addColorStop(0.45, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = shade; ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,160,0.38)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(r.x + 0.75, r.y + 0.75, r.w - 1.5, r.h - 1.5, rad); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(r.x - 0.5, r.y - 0.5, r.w + 1, r.h + 1, rad + 0.5); ctx.stroke();
    // brass inlay line
    const bg = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h); bg.addColorStop(0, hot ? '#fff0b0' : '#e9c46a'); bg.addColorStop(0.5, hot ? '#e0a830' : '#a8801f'); bg.addColorStop(1, hot ? '#fff0b0' : '#d6ad4a');
    ctx.strokeStyle = bg; ctx.lineWidth = hot ? 2.6 : 2; ctx.beginPath(); ctx.roundRect(r.x + f, r.y + f, r.w - 2 * f, r.h - 2 * f, Math.max(4, rad - f)); ctx.stroke();
    if (hot) { ctx.save(); ctx.shadowColor = 'rgba(255,214,120,0.7)'; ctx.shadowBlur = 14; ctx.stroke(); ctx.restore(); }
    // the recessed slate: dark base, a warm tint on top, and an inner shadow along the top and left
    const q = f + 4, ir = { x: r.x + q, y: r.y + q, w: r.w - 2 * q, h: r.h - 2 * q }, irad = Math.max(3, rad - q);
    ctx.beginPath(); ctx.roundRect(ir.x, ir.y, ir.w, ir.h, irad); ctx.fillStyle = '#0c0705'; ctx.fill(); ctx.fillStyle = hot ? `rgba(46,30,12,${fa})` : `rgba(20,11,6,${fa})`; ctx.fill();
    ctx.save(); ctx.clip();
    const is = ctx.createLinearGradient(0, ir.y, 0, ir.y + Math.min(26, ir.h * 0.4)); is.addColorStop(0, 'rgba(0,0,0,0.5)'); is.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = is; ctx.fillRect(ir.x, ir.y, ir.w, Math.min(26, ir.h * 0.4));
    const il = ctx.createLinearGradient(ir.x, 0, ir.x + 18, 0); il.addColorStop(0, 'rgba(0,0,0,0.35)'); il.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = il; ctx.fillRect(ir.x, ir.y, 18, ir.h);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,220,160,0.2)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(ir.x, ir.y, ir.w, ir.h, irad); ctx.stroke();
    if (r.h > 60 && r.w > 120) {                                           // four small brass studs at the corners
      ctx.fillStyle = bg;
      for (const [sx, sy] of [[r.x + f + 7, r.y + f + 7], [r.x + r.w - f - 7, r.y + f + 7], [r.x + f + 7, r.y + r.h - f - 7], [r.x + r.w - f - 7, r.y + r.h - f - 7]]) { ctx.beginPath(); ctx.arc(sx, sy, 2.6, 0, TAU); ctx.fill(); }
    }
    if (brand) edgeStroke(ctx, r, rad, 0.22);
  };
  const button = (r, label, o = {}) => {
    ui.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label });
    const pr = v3.pressed, pressed = !!pr && !o.dim && inRect(r, pr.x, pr.y);
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const rad = Math.min(18, r.h / 3), dep = Math.max(4, Math.min(9, r.h * 0.11)), dy = pressed ? dep * 0.7 : 0;
    const face = { x: r.x, y: r.y + dy, w: r.w, h: r.h - dep };
    const pal2 = o.primary ? { a: '#f0623e', b: '#a3220f', side: '#4a0c05', edge: '#ffd9a0' } : o.on ? { a: '#d7a949', b: '#7c5519', side: '#43290a', edge: '#fff0b8' } : { a: '#7a4424', b: '#3e1f0e', side: '#1c0c05', edge: '#d9b25a' };
    // contact shadow, side and face
    ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + dep + 5, r.w - 2, r.h - dep, rad); ctx.fill();
    ctx.fillStyle = pal2.side; ctx.beginPath(); ctx.roundRect(r.x, r.y + (pressed ? dep * 0.7 : dep), r.w, r.h - dep, rad); ctx.fill();
    ctx.beginPath(); ctx.roundRect(face.x, face.y, face.w, face.h, rad);
    const wp = !o.primary && !o.on ? woodPattern(ctx) : null;
    if (wp) { ctx.fillStyle = wp; ctx.fill(); const dk = ctx.createLinearGradient(0, face.y, 0, face.y + face.h); dk.addColorStop(0, 'rgba(255,214,160,0.14)'); dk.addColorStop(1, 'rgba(0,0,0,0.42)'); ctx.fillStyle = dk; ctx.fill(); }
    else { const gr = ctx.createLinearGradient(0, face.y, 0, face.y + face.h); gr.addColorStop(0, pal2.a); gr.addColorStop(1, pal2.b); ctx.fillStyle = gr; ctx.fill(); }
    // lacquer sheen on the upper half, a bright top edge, a dark lower edge
    ctx.save(); ctx.beginPath(); ctx.roundRect(face.x, face.y, face.w, face.h, rad); ctx.clip();
    const sh = ctx.createLinearGradient(0, face.y, 0, face.y + face.h * 0.55); sh.addColorStop(0, 'rgba(255,255,255,0.26)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sh; ctx.fillRect(face.x, face.y, face.w, face.h * 0.55);
    const bt = ctx.createLinearGradient(0, face.y + face.h - 14, 0, face.y + face.h); bt.addColorStop(0, 'rgba(0,0,0,0)'); bt.addColorStop(1, 'rgba(0,0,0,0.3)'); ctx.fillStyle = bt; ctx.fillRect(face.x, face.y + face.h - 14, face.w, 14);
    ctx.restore();
    ctx.strokeStyle = pal2.edge; ctx.globalAlpha *= o.primary ? 0.95 : 0.7; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(face.x + 1, face.y + 1, face.w - 2, face.h - 2, rad); ctx.stroke(); ctx.globalAlpha = o.dim ? 0.5 : 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(face.x + 4, face.y + 4, face.w - 8, face.h - 8, Math.max(2, rad - 4)); ctx.stroke();
    const size = o.size ?? 28, maxW = r.w - 24, col = o.primary ? '#fff8e4' : GOLD, cy = face.y + face.h / 2;
    const w1 = (str, s) => { ctx.font = `700 ${s}px ${FONT}`; return ctx.measureText(str).width; };
    let s1 = size; while (s1 > minU && w1(label, s1) > maxW) s1 -= 1;
    let best = { s: s1, ls: [label] };
    if (s1 < size * 0.74) {
      const ws = label.split(' ');
      for (let cut = 1; cut < ws.length; cut++) {
        const ls = [ws.slice(0, cut).join(' '), ws.slice(cut).join(' ')]; let s2 = size;
        while (s2 > minU && (Math.max(w1(ls[0], s2), w1(ls[1], s2)) > maxW || s2 * 2.25 > face.h)) s2 -= 1;
        if (s2 > best.s) best = { s: s2, ls };
      }
    }
    const lab = (str, x, y, sz) => { ctx.textAlign = 'center'; ctx.font = `700 ${sz}px ${FONT}`; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(str, x, y + Math.max(1.5, sz * 0.07)); ctx.fillStyle = col; ctx.fillText(str, x, y); };
    if (o.sub && best.ls.length === 1) { lab(label, r.x + r.w / 2, cy + best.s * 0.1 - 6, best.s); fitText(o.sub, r.x + r.w / 2, cy + best.s * 0.1 + Math.max(minU, size * 0.62) + 2, Math.round(size * 0.62), maxW, o.primary ? 'rgba(255,248,228,0.85)' : DIM, UI, 500, 'center', minU); }
    else if (best.ls.length === 1) lab(label, r.x + r.w / 2, cy + best.s * 0.35, best.s);
    else best.ls.forEach((ln, i) => lab(ln, r.x + r.w / 2, cy + best.s * 0.35 + (i - 0.5) * best.s * 1.15, best.s));
    ctx.restore();
  };
  const hit = (r, id, v) => ui.hits.push({ r, id, v });

  // ---------------------------------------------------------------- scenes
  if (v3.on) {                                                       // the 3D verandah is behind this canvas: clear to it and add a soft vignette
    ctx.clearRect(0, 0, L.w, L.h);
    const vg = ctx.createRadialGradient(L.w / 2, L.h * 0.5, Math.min(L.w, L.h) * 0.42, L.w / 2, L.h * 0.5, Math.max(L.w, L.h) * 0.8);
    vg.addColorStop(0, 'rgba(10,4,0,0)'); vg.addColorStop(1, 'rgba(10,4,0,0.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, L.w, L.h);
  } else { drawTable(ctx, L, state.t); if (!state.calm) motes(ctx, L, state.t); }

  if (scene === 'title' || scene === 'demo-limit') drawTitle();
  else if (scene === 'doc') drawDocument();
  else drawPlayScreen();

  // screens fade in from the table's dark instead of cutting
  if (state.sceneT < 0.22) { ctx.fillStyle = `rgba(14,7,3,${(1 - state.sceneT / 0.22) * 0.85})`; ctx.fillRect(0, 0, L.w, L.h); }

  // ================================================================ title
  function drawTitle() {
    const T = L.title(!!state.saved), Rr = T.rows;
    if (T.card) panel(T.card, 24, 'rgba(4,26,31,0.58)');
    hero(T.hero);
    if (scene === 'demo-limit') {
      const r = T.card || R(L.U.x0 + 30, L.h * 0.52, L.U.w - 60, L.h * 0.4);
      if (!T.card) panel(r, 24, 'rgba(4,26,31,0.72)');
      const cx = r.x + r.w / 2;
      fitText('That was the free taste.', cx, r.y + r.h * 0.34, 46, r.w - 40, GOLD, FONT, 700);
      wrapBox('Get Peralikatuma on iPhone and Android for unlimited games, both rule sets and every level.', R(r.x + 24, r.y + r.h * 0.42, r.w - 48, r.h * 0.4), 28, 1.3, CREAM);
    } else {
      if (Rr.resume) button(Rr.resume, 'Continue your game', { primary: true, size: 30 });
      button(Rr.play, 'Play the computer', { primary: !Rr.resume, size: 32, sub: `${VARIANTS[state.variant].name} · ${LEVELS[state.level].name} · as ${NAMES[state.humanSide]}` });
      button(Rr.two, 'Two players', { size: 26 }); button(Rr.learn, state.learned ? 'Learn' : 'Learn to play', { size: 26, primary: false });
      button(Rr.auto, 'Auto Play · Watch & Learn', { size: 26 });
      button(Rr.rules, 'Rules', { size: 26 }); button(Rr.how, 'How to Play', { size: 26 });
      button(Rr.about, 'About', { size: 26 }); button(Rr.settings, 'Settings', { size: 26 });
      if (state.msg) fitText(state.msg.text, L.w / 2, T.rows.play.y - 14, 24, L.w - 40, GOLD, UI, 600);
    }
    // the Arcforge lockup, bottom centre under the menu
    const lk = T.lockup; state.lockupRect = drawLockup(ctx, lk.x, lk.y + 4, 50);
  }

  function hero(r) {
    const cx = r.x + r.w / 2;
    const ts = clamp(Math.min(r.w / 6.2, r.h / 4.6), 40, 112);
    const y0 = r.y + ts * 0.95;
    // embossed brass lettering: a dark drop, a deep outline, a lit gold face and a thin bright upper edge
    const tfs = memo(`t|${ts}|${r.w}`, () => { let q = ts; ctx.font = `700 ${q}px ${FONT}`; while (q > minU && ctx.measureText('Peralikatuma').width > r.w - 10) { q -= 1; ctx.font = `700 ${q}px ${FONT}`; } return q; });
    ctx.save(); ctx.font = `700 ${tfs}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
    ctx.strokeStyle = '#2a1004'; ctx.lineWidth = tfs * 0.16; ctx.strokeText('Peralikatuma', cx, y0);
    ctx.shadowColor = 'transparent';
    const grad = ctx.createLinearGradient(0, y0 - tfs * 0.78, 0, y0 + tfs * 0.1); grad.addColorStop(0, '#fff6d6'); grad.addColorStop(0.45, '#f1c860'); grad.addColorStop(0.55, '#c98f2a'); grad.addColorStop(1, '#f6d98a');
    ctx.fillStyle = grad; ctx.fillText('Peralikatuma', cx, y0);
    ctx.strokeStyle = 'rgba(255,248,214,0.7)'; ctx.lineWidth = Math.max(1, tfs * 0.02); ctx.strokeText('Peralikatuma', cx, y0 - tfs * 0.012);
    ctx.restore();
    const sub = Math.max(minU, ts * 0.3);
    ctx.save();
    const pw = Math.min(r.w * 0.64, ts * 5.4), py = y0 + ts * 0.34, ph = sub * 1.7;
    const bg2 = ctx.createLinearGradient(0, py, 0, py + ph); bg2.addColorStop(0, '#d8642a'); bg2.addColorStop(1, '#8a2c0c');
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    ctx.beginPath(); ctx.roundRect(cx - pw / 2, py, pw, ph, ph / 2); ctx.fillStyle = bg2; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#e9c46a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    ctx.font = `700 ${sub}px ${UI}`; ctx.fillStyle = CREAM; ctx.textAlign = 'center';
    ctx.fillText('S R I   L A N K A', cx, py + sub * 1.2);
    fitText('The leaping game of the octagon', cx, py + sub * 1.7 + ts * 0.36, ts * 0.3, r.w - 20, 'rgba(242,208,138,0.88)', FONT, 700);
    // the animated demonstration: a chain of three leaps and a crowning, forever
    const top = py + sub * 1.7 + ts * 0.62, room = r.y + r.h - top;
    if (room > 90) { if (v3.on) v3.heroRect = R(r.x, top + 6, r.w, room - 22); else heroBoard(R(r.x, top + 6, r.w, room - 22)); }
  }

  // The title's demonstration: on the real board, a Ruby man leaps three Sapphire men in one chain and is crowned on the far row.
  function heroBoard(r) {
    const cell = clamp(Math.min(r.w / BOARD_CELLS, r.h / (BOARD_CELLS + 0.22)), 24, 120);
    const Bg = boardAt(r.x + r.w / 2, r.y + (r.h - (BOARD_CELLS + 0.22) * cell) / 2, cell, false);
    const T = state.calm ? 4.5 : state.t % 9.5, pos = (i) => Bg.sq(i);
    drawBoard(ctx, Bg, wood);
    const path = [56, 40, 22, 4], victims = [48, 31, 13];
    const start = 1.2, hop = 0.8, endT = start + hop * 3, resetT = 8.2;
    const op = T < 0.5 ? T / 0.5 : T > resetT ? Math.max(0, 1 - (T - resetT) / 0.8) : 1;
    ctx.save(); ctx.globalAlpha = op;
    for (let i = 0; i < 81; i++) {
      const k = HERO[i]; if (!k || i === path[0] || victims.includes(i)) continue;
      const p = pos(i); drawPiece(ctx, k, style, p.x, p.y, cell);
    }
    victims.forEach((q, k) => {
      const p = pos(q), tk = start + hop * (k + 0.5);
      if (T < tk) drawPiece(ctx, 2, style, p.x, p.y, cell);
      else { const f = (T - tk) / 0.55; if (f < 1) capFx(ctx, style, 2, p.x, p.y, cell, f, false, state.calm, k + 3); }
    });
    let mp, lift = 0;
    if (T < start) { mp = pos(path[0]); lift = T > 0.7 ? clamp((T - 0.7) / 0.5, 0, 1) * 0.5 : 0; }
    else if (T >= endT) mp = pos(path[3]);
    else {
      const k = Math.min(2, Math.floor((T - start) / hop)), f = ((T - start) - k * hop) / hop, e = ease(clamp(f, 0, 1)), a = pos(path[k]), b = pos(path[k + 1]);
      mp = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }; lift = Math.sin(Math.PI * f) * 0.9 + 0.2;
    }
    const crowned = T > endT + 0.1;
    drawPiece(ctx, crowned ? 3 : 1, style, mp.x, mp.y, cell, { lift, glow: T > 0.7 && T < start ? 0.6 : crowned ? 0.5 : 0.3, scale: crowned ? 1 + 0.12 * Math.max(0, 1 - (T - endT - 0.1) / 0.4) : 1 });
    if (crowned && !state.calm && T < endT + 0.9) { const f = (T - endT) / 0.8; ctx.strokeStyle = `rgba(255,222,120,${0.9 * (1 - f)})`; ctx.lineWidth = 4 * (1 - f) + 1; ctx.beginPath(); ctx.arc(mp.x, mp.y, cell * (0.35 + 0.9 * f), 0, TAU); ctx.stroke(); }
    ctx.restore();
  }

  // ================================================================ play / over / lesson
  function drawPlayScreen() {
    const isLesson = scene === 'lesson', over = scene === 'over';
    const pal = WOODS[wood] || WOODS.kaya, cell = B.cell;
    // side cards in landscape
    if (L.land) { if (L.leftCard) panel(L.leftCard, 18); panel(L.rightCard, 18); }

    // ---- the board scene (shaken a little when a chain lands). With the 3D board (v3.on) the board, pieces, markers and effects are
    // recorded for the presenter instead of painted; the numbers and badges that sit on top are still drawn here at the projected points.
    const T3 = v3.on;
    const put = (code, x, y, o = {}) => { if (T3) v3.pieces.push({ code, x, y, lift: o.lift || 0, scale: o.scale, tilt: o.tilt, cell: o.cell, drag: o.drag, squash: o.squash, spin: o.spin }); else drawPiece(ctx, code, style, x, y, cell, o); };
    const mark = (kind, p, o = {}) => v3.marks.push({ kind, x: p.x, y: p.y, a: o.a, x0: o.x0, y0: o.y0 });
    const sqp = (i) => (T3 && v3.sq ? v3.sq(i) : { ...L.sq(i), s: cell });
    ctx.save();
    if (!T3 && a && a.caps.length && !state.calm && a.t > a.glide && a.t < a.glide + 0.35) { const f = (a.t - a.glide) / 0.35; ctx.translate(Math.sin(f * 46) * (1 - f) * cell * 0.045, Math.cos(f * 38) * (1 - f) * cell * 0.03); }
    if (!T3) drawBoard(ctx, B, wood);
    const dot = (q, rad, fill, line) => { const p = L.sq(q); ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, TAU); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (line) { ctx.strokeStyle = line; ctx.stroke(); } };
    // last move: the path of the chain, softly
    const last = a ? null : g.last;
    if (last && !isLesson) {
      if (T3) {
        let prev = L.sq(last.from);
        for (const q of last.path) { const p = L.sq(q); mark('lastline', p, { x0: prev.x, y0: prev.y }); prev = p; }
        for (const q of [last.from, last.to]) mark('last', L.sq(q));
      } else {
        ctx.save(); ctx.strokeStyle = 'rgba(255,214,110,0.4)'; ctx.lineWidth = cell * 0.09; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        last.path.forEach((q, k) => { const p = L.sq(q); k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }); ctx.stroke(); ctx.restore();
        for (const q of [last.from, last.to]) dot(q, cell * 0.44, 'rgba(255,214,110,0.20)');
      }
    }
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 5);
    // lesson target
    if (isLesson && LESSONS[state.lesson.i].target !== undefined && !state.lesson.done) {
      const p = L.sq(LESSONS[state.lesson.i].target);
      if (T3) mark('lesson', p, { a: pulse }); else { ctx.strokeStyle = `rgba(214,64,31,${0.6 + 0.4 * pulse})`; ctx.lineWidth = cell * 0.07; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.38, 0, TAU); ctx.stroke(); }
    }
    // selected piece: legal points
    const badges = [];
    if (state.sel >= 0 && !a && !over) {
      if (T3) mark('sel', L.sq(state.sel), { a: pulse }); else { ctx.lineWidth = cell * 0.05; dot(state.sel, cell * 0.46, `rgba(255,224,120,${0.26 + pulse * 0.14})`); }
      for (const m of state.selMoves) {
        const p = L.sq(m.to);
        if (m.caps) {
          if (T3) { mark('cap', p, { a: pulse }); badges.push({ to: m.to, n: m.caps }); }
          else {
            ctx.strokeStyle = `rgba(226,60,36,${0.7 + pulse * 0.3})`; ctx.lineWidth = cell * 0.07; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.36, 0, TAU); ctx.stroke();
            ctx.fillStyle = 'rgba(226,60,36,0.2)'; ctx.fill();
            const s2 = Math.round(cell * 0.3); ctx.fillStyle = '#e23c24'; ctx.beginPath(); ctx.arc(p.x + cell * 0.3, p.y - cell * 0.3, s2 * 0.56, 0, TAU); ctx.fill();
            text(String(m.caps), p.x + cell * 0.3, p.y - cell * 0.3 + s2 * 0.2, s2 * 0.72, '#fff', UI, 800);
          }
        } else if (T3) mark('move', p, { a: pulse });
        else { ctx.fillStyle = `rgba(255,248,214,${0.6 + pulse * 0.2})`; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.14, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(40,24,6,0.55)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
    }
    if (state.hint && !a) {
      const h0 = L.sq(state.hint.from), h1 = L.sq(state.hint.to);
      if (T3) { mark('hint', h0, { a: pulse }); mark('hint', h1, { a: pulse }); mark('hintline', h1, { x0: h0.x, y0: h0.y }); }
      else {
        for (const q of [state.hint.from, state.hint.to]) { ctx.lineWidth = 3; dot(q, cell * 0.44, `rgba(90,230,150,${0.3 + pulse * 0.2})`, 'rgba(90,230,150,0.95)'); }
        ctx.save(); ctx.strokeStyle = 'rgba(90,230,150,0.8)'; ctx.setLineDash([cell * 0.16, cell * 0.14]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(h0.x, h0.y); ctx.lineTo(h1.x, h1.y); ctx.stroke(); ctx.restore();
      }
    }
    // pieces, far rows first (a lower piece overlaps the one above it)
    const order = []; for (let rr = 0; rr < 9; rr++) for (let cc = 0; cc < 9; cc++) order.push((L.flip ? 8 - rr : rr) * 9 + (L.flip ? 8 - cc : cc));
    const movingTo = a ? a.to : -1;
    const dragging = state.drag && state.sel >= 0;
    const capGone = (k) => { let t0 = 0; for (let j = 0; j < k; j++) t0 += a.hops[j]; return t0 + a.hops[k] * 0.5; };   // the mover is over the piece
    const mustNow = !a && !over && !state.autoMode && state.must && state.must.size && (state.two || g.turn === state.humanSide) ? state.must : null;
    for (const i of order) {
      const k = g.board[i]; if (!k || i === movingTo) continue;
      if (dragging && i === state.sel) continue;
      const p = L.sq(i), sel = state.sel === i;
      let lift = sel ? 0.45 + (state.calm ? 0 : Math.sin(state.t * 3) * 0.06) : 0;
      const must = mustNow && mustNow.has(i) && state.sel < 0;
      if (must && !state.calm) lift = 0.08 + 0.1 * pulse;
      if (T3 && must) mark('movable', p, { a: pulse });
      put(k, p.x, p.y, { lift, glow: sel ? 0.8 : must ? 0.35 + 0.35 * pulse : 0, cell: i });
      if (state.marks && !over && !a && state.danger && state.danger.has(i)) { const q = sqp(i); dangerMark(q.x + q.s * 0.3, q.y - q.s * (T3 ? 0.62 : 0.42), q.s); }
    }
    // the captured pieces stay until the mover passes over them, then flash and fly off
    if (a) for (const [n, q] of a.caps.entries()) {
      const p = L.sq(q), tk = capGone(n), code = a.capCodes[n];
      if (a.t < tk) put(code, p.x, p.y, { cell: -1 });
      else { const f = (a.t - tk) / 0.55; if (f < 1) { if (T3) v3.fx.push({ kind: 'cap', code, x: p.x, y: p.y, f, id: n + q }); else capFx(ctx, style, code, p.x, p.y, cell, f, L.flip, state.calm, n + q); } }
    }
    // a golden burst and a floating count where the chain landed
    if (a && a.caps.length && !state.calm && a.t > a.glide) {
      const f = (a.t - a.glide) / 0.8;
      if (f < 1) {
        const p1 = T3 ? sqp(a.to) : L.sq(a.to), e2 = ease(Math.min(1, f * 1.4)), cs = T3 ? p1.s : cell;
        if (!T3) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const rg = ctx.createRadialGradient(p1.x, p1.y, 0, p1.x, p1.y, cell * (0.4 + 1.3 * f)); rg.addColorStop(0, `rgba(255,220,140,${0.5 * (1 - f)})`); rg.addColorStop(1, 'rgba(255,200,100,0)');
          ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(p1.x, p1.y, cell * (0.4 + 1.3 * f), 0, TAU); ctx.fill(); ctx.restore();
        } else { const lp = L.sq(a.to); v3.fx.push({ kind: 'land', x: lp.x, y: lp.y, f, id: 'l' }); }
        const fs = Math.round(cs * 0.62);
        ctx.save(); ctx.globalAlpha = Math.min(1, (1 - f) * 2.2);
        ctx.lineWidth = fs * 0.14; ctx.strokeStyle = 'rgba(30,10,4,0.9)'; ctx.lineJoin = 'round'; ctx.font = `800 ${fs}px ${UI}`; ctx.textAlign = 'center';
        const tx = p1.x, ty = p1.y - cs * (T3 ? 0.95 : 0.7) - cs * 0.8 * e2;
        ctx.strokeText(`+${a.caps.length}`, tx, ty); ctx.fillStyle = '#ffd24a'; ctx.fillText(`+${a.caps.length}`, tx, ty); ctx.restore();
      }
    }
    // the moving piece: hop by hop along the chain
    if (a) {
      let t = a.t, k = 0; while (k < a.hops.length - 1 && t >= a.hops[k]) { t -= a.hops[k]; k++; }
      const pa = L.sq(a.path[k]), pb = L.sq(a.path[k + 1]), f = clamp(t / a.hops[k], 0, 1), e = ease(f), settled = a.t >= a.glide;
      const x = settled ? pb.x : pa.x + (pb.x - pa.x) * e, y = settled ? pb.y : pa.y + (pb.y - pa.y) * e;
      const dist = Math.hypot(pb.x - pa.x, pb.y - pa.y) / cell, big = a.caps[k] !== undefined;
      const lift = !settled ? Math.sin(Math.PI * f) * (big ? 1.0 : 0.35 + Math.min(0.3, dist * 0.04)) + 0.2 * (k === 0 ? 1 - f : 0) : Math.max(0, 0.2 * (1 - (a.t - a.glide) / 0.12));
      const showStar = a.crowned && a.t >= a.glide + 0.1, code = showStar ? a.code + 2 : a.code;
      const sc = showStar ? 1 + 0.16 * Math.max(0, 1 - (a.t - a.glide - 0.1) / 0.35) : 1;
      const since = settled ? a.t - a.glide : k > 0 ? t : 9, squash = !state.calm && since < 0.3 ? (1 - since / 0.3) * 0.15 * Math.cos(since * 24) : 0;   // a gem lands with a small squash and wobble
      put(code, x, y, { lift, glow: 0.5, scale: sc, cell: -1, squash, spin: settled ? 0 : f * 0.9 });
      if (a.t > a.glide && a.t < a.glide + 0.45 && !state.calm) {
        const ff = (a.t - a.glide) / 0.45;
        if (T3) v3.fx.push({ kind: 'land', x: pb.x, y: pb.y, f: ff, id: 'm' });
        else { ctx.strokeStyle = `rgba(255,240,200,${0.75 * (1 - ff)})`; ctx.lineWidth = cell * 0.07 * (1 - ff) + 1; ctx.beginPath(); ctx.ellipse(pb.x, pb.y + cell * 0.2, cell * (0.3 + 0.8 * ff), cell * (0.14 + 0.34 * ff), 0, 0, TAU); ctx.stroke(); }
      }
      if (a.crowned && !state.calm && a.t > a.glide && a.t < a.glide + 0.9) {
        const ff = (a.t - a.glide) / 0.9;
        if (T3) v3.fx.push({ kind: 'crown', x: pb.x, y: pb.y, f: ff, id: a.to });
        else {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          for (let j = 0; j < 8; j++) { const ang = j * Math.PI / 4 + 0.4, r2 = cell * (0.3 + 0.9 * ff); ctx.fillStyle = `rgba(255,222,120,${0.9 * (1 - ff)})`; ctx.beginPath(); ctx.arc(pb.x + Math.cos(ang) * r2, pb.y + Math.sin(ang) * r2 * 0.8 - cell * 0.1, cell * 0.06 * (1 - ff) + 1.5, 0, TAU); ctx.fill(); }
          ctx.restore();
        }
      }
    }
    // a dragged piece follows the finger
    if (dragging) put(g.board[state.sel] || g.turn, state.drag.x, state.drag.y - cell * 0.15, { lift: 0.9, glow: 0.9, drag: true });
    if (state.kb && !over) { const p = L.sq(state.cursor); if (T3) mark('kb', p); else { ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.46, 0, TAU); ctx.stroke(); } }
    ctx.restore();
    // capture-count badges on the glowing destination points (3D board): drawn on top at the projected point
    for (const bd of badges) { const q = sqp(bd.to), s2 = Math.round(q.s * 0.3); ctx.fillStyle = '#e23c24'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x + q.s * 0.34, q.y - q.s * 0.36, s2 * 0.62, 0, TAU); ctx.fill(); ctx.stroke(); text(String(bd.n), q.x + q.s * 0.34, q.y - q.s * 0.36 + s2 * 0.22, s2 * 0.78, '#fff', UI, 800); }

    // ---- furniture
    if (isLesson) lessonBox(); else plates();
    buttonsFor();
    if (over) overlay();
  }

  function dangerMark(x, y, cell) {
    const r = cell * 0.17;
    ctx.fillStyle = '#e23c24'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(x - r * 0.12, y - r * 0.55, r * 0.24, r * 0.7); ctx.fillRect(x - r * 0.12, y + r * 0.28, r * 0.24, r * 0.24);
  }

  function plateInfo(side) {
    const opp = 3 - side, flying = a && a.t < a.glide + 0.3 ? a.caps.length : 0;     // while a capture plays, the trays still show the old numbers
    let stars = 0; for (let i = 0; i < 81; i++) { const c = g.board[i]; if (c > 2 && sideOf(c) === side) stars++; }
    return { got: g.lost[opp] - (a && a.side === side ? flying : 0), left: pieceCount(g, side) + (a && a.side !== side ? flying : 0), stars };
  }
  function plate(r, side) {
    const human = !state.two && !state.autoMode && side === state.humanSide;
    const name = state.autoMode ? `${NAMES[side]} · computer` : state.two ? NAMES[side] : human ? 'You' : 'Computer';
    const sub = state.autoMode ? LEVELS[Math.max(2, state.level)].name : state.two || human ? NAMES[side] : `${LEVELS[state.level].name} · ${NAMES[side]}`;
    const turn = !g.winner && g.turn === side && scene !== 'over';
    panel(r, 16, turn ? 'rgba(34,40,22,0.8)' : 'rgba(4,26,31,0.64)', turn ? 'rgba(242,208,138,0.85)' : 'rgba(242,208,138,0.2)', true);
    const info = plateInfo(side);
    if (r.h < 112) {                                                  // compact: one line of text, the captured pieces on the right
      const ic2 = clamp(r.h * 0.6, 34, 70), ix2 = r.x + 12 + ic2 * 0.55, iy2 = r.y + r.h * 0.5 + ic2 * 0.16;
      drawPiece(ctx, side, style, ix2, iy2, ic2, { flip: L.flip, glow: turn ? 0.7 : 0 });
      const tx2 = r.x + 12 + ic2 * 1.1 + 12, ns2 = clamp(r.h * 0.27, 18, 30), tcw = Math.min(r.w * 0.34, 260);
      const st = turn ? (state.autoMode ? (state.autoPaused ? 'Paused' : 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3))) : state.two ? 'To move' : human ? 'Your move' : 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3))) : sub;
      fitText(`${name} · ${st}`, tx2, r.y + r.h * 0.42, ns2, r.x + r.w - 36 - tx2 - tcw, turn ? CREAM : DIM, UI, 800, 'left');
      fitText(`Taken ${info.got} · ${info.left} left${info.stars ? ` · ★${info.stars}` : ''}`, tx2, r.y + r.h * 0.75, Math.round(ns2 * 0.78), r.x + r.w - 36 - tx2 - tcw, DIM, UI, 600, 'left');
      const tc2 = clamp(r.h * 0.5, 24, 40), per2 = Math.max(1, Math.floor(tcw / (tc2 * 0.6)));
      for (let k = 0; k < Math.min(info.got, 18); k++) drawPiece(ctx, 3 - side, style, r.x + r.w - 14 - tcw + tc2 * 0.4 + (k % per2) * tc2 * 0.6, r.y + r.h * 0.5 + tc2 * 0.28 + Math.floor(k / per2) * tc2 * 0.3 - (info.got > per2 ? tc2 * 0.15 : 0), tc2, { flip: L.flip, alpha: 0.95 });
      return;
    }
    const ns = clamp(r.h * 0.22, 18, 46), ic = clamp(Math.min(r.h * 0.6, r.w * 0.22), 38, 132);
    const ix = r.x + 14 + ic * 0.55, iy = r.y + 12 + ic * 0.62;
    drawPiece(ctx, side, style, ix, iy, ic, { flip: L.flip, glow: turn ? 0.7 : 0, lift: turn && !state.calm ? 0.12 + Math.sin(state.t * 3) * 0.05 : 0 });
    const tx = r.x + 14 + ic * 1.1 + 14, tw = r.x + r.w - 14 - tx;
    const y1 = r.y + 10 + ns * 0.85, y2 = y1 + ns * 0.84, y3 = y2 + ns * 0.8;
    fitText(name, tx, y1, ns, tw, CREAM, UI, 800, 'left');
    const status = turn ? (state.autoMode ? (state.autoPaused ? 'Paused' : state.autoPhase === 'reveal' ? 'The move' : 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3))) : state.two ? 'To move' : human ? 'Your move' : state.thinking || state.think > 0 ? 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3)) : 'Moving') : sub;
    fitText(status, tx, y2, Math.round(ns * 0.72), tw, turn ? GOLD : DIM, UI, 600, 'left');
    fitText(`Taken ${info.got} of ${START} · ${info.left} left${info.stars ? ` · ★${info.stars}` : ''}`, tx, y3, Math.round(ns * 0.62), tw, DIM, UI, 600, 'left');
    const slots = START, cols = 8, availH = r.y + r.h - (y3 + 8) - 4;
    const tc = Math.min(clamp(availH / 1.5, 0, 56), tw / (0.62 * cols + 0.35));          // one row of slots must fit the plate's width
    if (tc >= 18) {
      const at = (k) => ({ x: tx + tc * 0.4 + (k % cols) * tc * 0.62, y: y3 + 8 + tc * 0.5 + Math.floor(k / cols) * tc * 0.62 });
      ctx.strokeStyle = 'rgba(242,208,138,0.2)'; ctx.lineWidth = 1.5;
      for (let k = info.got; k < slots; k++) { const p = at(k); ctx.beginPath(); ctx.ellipse(p.x, p.y + tc * 0.05, tc * 0.2, tc * 0.28, 0, 0, TAU); ctx.stroke(); }   // empty slots show what is still to win
      for (let k = 0; k < Math.min(info.got, 18); k++) { const p = at(k); drawPiece(ctx, 3 - side, style, p.x, p.y, tc * 0.9, { flip: L.flip, alpha: 0.95 }); }
    }
  }
  function plates() {
    const topSide = L.flip ? 1 : 2, botSide = L.flip ? 2 : 1;
    plate(L.plateTop, topSide); plate(L.plateBot, botSide);
    // message
    const M = L.msg, al = state.msg ? Math.min(1, state.msg.t / 0.15) * Math.min(1, (state.msg.hold - state.msg.t) / 0.5) : 0;
    const mustMsg = state.must && state.must.size && !state.autoMode && (state.two || g.turn === state.humanSide);
    const base = scene === 'over' ? '' : state.autoMode ? 'Auto Play: the computer plays both sides.' : g.winner ? '' : state.two || g.turn === state.humanSide ? (mustMsg ? 'A capture is compulsory: leap with a pulsing piece.' : 'Tap a piece, then a glowing point.') : '';
    if (state.msg && al > 0) {
      ctx.save(); ctx.globalAlpha = clamp(al, 0, 1);
      panel(R(M.x, M.y + 4, M.w, M.h - 8), 14, 'rgba(4,20,26,0.96)', 'rgba(242,208,138,0.75)', false);
      wrapBox(state.msg.text, R(M.x + 14, M.y + 8, M.w - 28, M.h - 16), big ? 30 : 25, 1.18, CREAM);
      ctx.restore();
    } else if (base) { wrapBox(base, R(M.x + 8, M.y, M.w - 16, M.h), 24, 1.2, DIM); }
    if (L.land && L.rightHead) fitText(VARIANTS[state.variant].long, L.rightHead.x + L.rightHead.w / 2, L.rightHead.y + 34, 26, L.rightHead.w, GOLD, FONT, 700);
    if (L.badge && L.badge.show) drawBadgeStack(ctx, L.badge.cx, L.badge.bottom, L.badge.w);
  }
  function lessonBox() {
    const l = LESSONS[state.lesson.i], r = L.lessonBox;
    panel(r, 16, 'rgba(4,26,31,0.74)', 'rgba(242,208,138,0.45)');
    const pad = 16;
    text(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}`, r.x + pad, r.y + 30, Math.max(minU, 20), DIM, UI, 600, 'left');
    fitText(l.title, r.x + pad, r.y + 30 + 40, 38, r.w - 2 * pad, GOLD, FONT, 700, 'left');
    const body = state.lesson.done ? l.done : state.msg ? state.msg.text : l.text;
    wrapBox(body, R(r.x + pad, r.y + 82, r.w - 2 * pad, r.h - 92), big ? 32 : 27, 1.25, state.lesson.done ? '#c9f7c0' : CREAM, 'left', minU, 'top');
  }
  function buttonsFor() {
    const BTN = L.BTN, sz = 26;
    if (scene === 'play') {
      if (state.autoMode) {
        button(BTN.auto.exit, 'Exit', { size: 24 }); button(BTN.auto.pause, state.autoPaused ? 'Resume' : 'Pause', { size: 24, primary: state.autoPaused });
        button(BTN.auto.dec, '- Think', { size: 22, dim: state.autoThinkIdx <= 0 }); button(BTN.auto.inc, 'Think +', { size: 22, dim: state.autoThinkIdx >= THINK_STEPS.length - 1 });
        if (L.land && L.rightHead) fitText(`think time ${THINK_STEPS[state.autoThinkIdx]} s`, L.rightHead.x + L.rightHead.w / 2, BTN.auto.inc.y + BTN.auto.inc.h + 36, 22, L.rightHead.w, DIM, UI, 600);
      } else {
        button(BTN.menu, 'Menu', { size: sz }); button(BTN.undo, 'Take back', { size: sz, dim: !state.undo.length }); button(BTN.hint, `Hint (${state.hintsLeft})`, { size: sz, dim: state.hintsLeft <= 0, primary: !!state.hint });
      }
    } else if (scene === 'lesson') { button(BTN.menu, 'Menu', { size: sz }); if (state.lesson.done) button(BTN.next, state.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 }); }
    else if (scene === 'over') { /* the card has its own buttons */ }
  }
  function overlay() {
    ctx.fillStyle = 'rgba(6,2,0,0.72)'; ctx.fillRect(0, 0, L.w, L.h);
    const O = L.over, c = O.card, cx = c.x + c.w / 2;
    panel(c, 26, 'rgba(6,30,36,0.93)', 'rgba(242,208,138,0.55)');
    const res = state.result || { winner: g.winner, reason: g.reason }, w = res.winner;
    const title = w === 3 ? 'A draw' : state.autoMode ? `${NAMES[w]} wins` : state.two ? `${NAMES[w]} wins` : w === state.humanSide ? 'You win!' : 'The computer wins';
    const k = Math.min(1, (O.again.y - c.y - 16) / 430), cw2 = c.w / k;
    ctx.save(); ctx.translate(cx, c.y); ctx.scale(k, k);
    if (w !== 3) drawPiece(ctx, w + 2, style, 0, 118, 118, { glow: 0.9, lift: 0.4 + Math.sin(state.t * 2.5) * 0.08 });
    else { drawPiece(ctx, 1, style, -56, 118, 96, {}); drawPiece(ctx, 2, style, 56, 118, 96, {}); }
    fitText(title, 0, 238, 62, cw2 - 40, GOLD, FONT, 700);
    wrapBox(res.reason || '', R(-cw2 / 2 + 30, 252, cw2 - 60, 70), 26, 1.25, CREAM);
    fitText(`${Math.ceil(g.moves / 2)} moves · Ruby took ${g.lost[2]}, Sapphire took ${g.lost[1]}`, 0, 346, 22, cw2 - 40, DIM, UI, 500);
    if (!state.two && !state.autoMode && w === state.humanSide) { fitText(`★ ${LEVELS[state.level].name} beaten at ${VARIANTS[state.variant].name}`, 0, 390, 24, cw2 - 40, '#ffd24a', UI, 700); confetti(c, 0); }
    ctx.restore();
    button(O.again, state.autoMode ? 'Watch another' : 'Play again', { primary: true, size: 32 }); button(O.back, 'Menu', { size: 28 });
    drawMoreLine(ctx, cx, O.back.y + O.back.h + 32, 22);
  }
  function confetti(c, cx) {
    if (state.calm) return;
    for (let k = 0; k < 22; k++) {
      const ph = (state.t * 0.32 + k * 0.0917) % 1, x = cx + Math.sin(k * 2.4 + state.t) * (60 + 170 * ph), y = 210 - ph * 190 + ph * ph * 120;
      ctx.fillStyle = k % 3 === 0 ? `rgba(255,214,110,${0.9 * (1 - ph)})` : k % 3 === 1 ? `rgba(255,150,150,${0.8 * (1 - ph)})` : `rgba(255,246,224,${0.8 * (1 - ph)})`;
      ctx.save(); ctx.translate(x, y); ctx.rotate(k + state.t * 2); ctx.fillRect(-5, -2.5, 10, 5); ctx.restore();
    }
  }

  // ================================================================ documents (rules, how to play, about, settings)
  function drawDocument() {
    const D = L.doc, panelR = D.panel, vp = D.viewport, kind = state.doc.kind;
    ctx.fillStyle = 'rgba(8,4,1,0.5)'; ctx.fillRect(0, 0, L.w, L.h);
    panel(panelR, 26, 'rgba(8,34,38,0.93)', 'rgba(242,208,138,0.3)', true);
    const heading = { rules: 'Rules', how: 'How to Play', about: 'About', settings: 'Settings' }[kind];
    const hx = L.ins.back && panelR.x < L.backBox.x + L.backBox.w + 8 && panelR.y < L.backBox.y + L.backBox.h ? L.backBox.x + L.backBox.w + 6 : panelR.x + 34;
    fitText(heading, hx, panelR.y + 56, 44, panelR.x + panelR.w - 2 * (D.header.textDec.w * 2 + 90) - hx, GOLD, FONT, 700, 'left');
    ctx.strokeStyle = 'rgba(242,208,138,0.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(panelR.x + 28, panelR.y + 82); ctx.lineTo(panelR.x + panelR.w - 28, panelR.y + 82); ctx.stroke();
    const secs = kind === 'rules' ? RULES : kind === 'how' ? HOWTO : kind === 'about' ? ABOUT : [{ title: '', items: settingsItems(state) }];
    const sc0 = Math.max(0, Math.min(state.doc.scroll || 0, docMetrics.max));
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x - 6, vp.y, vp.w + 12, vp.h); ctx.clip();
    const bodyW = D.bodyW, cxp = vp.x + vp.w / 2, left = cxp - bodyW / 2;
    const size = Math.round(27 * scale), lh = Math.round(size * 1.38), gap = Math.round(12 * scale);
    let y = vp.y - sc0 + 4;
    const vis = (y0, h) => y0 + h > vp.y - 40 && y0 < vp.y + vp.h + 40;
    secs.forEach((sec, si) => {
      if (sec.title) {
        const t0 = Math.round(34 * Math.min(scale, 2)), ty = y + t0 * 0.9;
        if (si > 0) y += Math.round(18 * Math.min(scale, 2));
        const ty2 = y + t0 * 0.9; if (vis(y, t0)) fitText(sec.title, cxp, ty2, t0, bodyW, '#ffd24a', UI, 800, 'center', 18);
        y += t0 * 1.35 + 6;
      }
      for (const it of sec.items) {
        if (it.k === 'p') {
          const ls = lines(it.t, size, bodyW); if (vis(y, ls.length * lh)) ls.forEach((ln, i) => text(ln, cxp, y + size * 0.9 + i * lh, size, CREAM, UI, 600, 'center'));
          y += ls.length * lh + gap;
        } else if (it.k === 'h') {
          const hs = Math.round(30 * Math.min(scale, 2)); y += 8; if (vis(y, hs)) text(it.t, cxp, y + hs * 0.9, hs, '#ffd24a', UI, 800, 'center'); y += hs * 1.3 + 4;
        } else if (it.k === 'd') {
          const spec = it.spec, C = spec.rows[0].length, cp = Math.min((spec.cell || 44) * (1 + (Math.min(scale, 2) - 1) * 0.35), (bodyW - 24) / (C + 0.36)), ds = diagramSize(spec, cp);
          if (vis(y, ds.h)) drawDiagram(ctx, spec, cxp - ds.w / 2, y, cp, wood, style);
          y += ds.h + gap + 6;
        } else if (it.k === 'btn') {
          const bs = Math.round(26 * Math.min(scale, 2.2)), bh = Math.round(72 * Math.min(scale, 2.2)), rr = R(left, y, bodyW, bh);
          if (vis(y, bh)) button(rr, it.label, { size: bs, dim: !!it.disabled });
          if (!it.disabled) ui.hits.push({ r: rr, id: it.id, v: 0, clip: vp });
          y += bh + gap;
        } else if (it.k === 'seg') {
          const ls = lines(it.label, Math.round(25 * Math.min(scale, 2.2)), bodyW, 600);
          const fs = Math.round(25 * Math.min(scale, 2.2)); if (vis(y, ls.length * fs * 1.3)) ls.forEach((ln, i) => text(ln, cxp, y + fs * 0.9 + i * fs * 1.3, fs, DIM, UI, 600, 'center'));
          y += ls.length * fs * 1.3 + 6;
          const n = it.opts.length, os = Math.round(25 * Math.min(scale, 2.2)), bh = Math.round(66 * Math.min(scale, 2.2));
          let per = n; ctx.font = `700 ${os}px ${UI}`;
          const fitsRow = (p) => it.opts.every((o) => ctx.measureText(o.l + (o.locked ? ' (locked)' : '')).width + 28 <= (bodyW - (p - 1) * 10) / p);
          while (per > 1 && !fitsRow(per)) per--;
          const bw = (bodyW - (per - 1) * 10) / per;
          it.opts.forEach((o, k) => {
            const rx = left + (k % per) * (bw + 10), ry = y + Math.floor(k / per) * (bh + 10), rr = R(rx, ry, bw, bh);
            if (vis(ry, bh)) button(rr, o.locked ? `${o.l} (locked)` : o.l, { size: os, on: o.v === it.cur && !o.locked, primary: o.v === it.cur && !o.locked, dim: o.locked });
            ui.hits.push({ r: rr, id: it.id, v: o.v, locked: o.locked, need: o.need, clip: vp });
          });
          y += Math.ceil(n / per) * (bh + 10) + gap;
        }
      }
    });
    ctx.restore();
    const contentH = y - (vp.y - sc0) + 10;
    if (contentH - vp.h > 8) {
      const fade = (y0, y1, a0, a1) => { const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(8,38,44,${a0})`); gr.addColorStop(1, `rgba(8,38,44,${a1})`); ctx.fillStyle = gr; ctx.fillRect(vp.x - 6, Math.min(y0, y1), vp.w + 12, Math.abs(y1 - y0)); };
      if (sc0 < contentH - vp.h - 2) fade(vp.y + vp.h - 34, vp.y + vp.h, 0, 0.95);
      if (sc0 > 2) fade(vp.y + 22, vp.y, 0, 0.95);
    }
    docMetrics.max = contentH - vp.h <= 8 ? 0 : Math.ceil(contentH - vp.h); docMetrics.view = vp.h;
    if (docMetrics.max > 0) {
      const sb = D.scrollbar, th = Math.max(48, sb.h * vp.h / contentH), ty = sb.y + (sc0 / docMetrics.max) * (sb.h - th);
      ctx.fillStyle = 'rgba(242,208,138,0.14)'; ctx.beginPath(); ctx.roundRect(sb.x + 7, sb.y, 8, sb.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(242,208,138,0.7)'; ctx.beginPath(); ctx.roundRect(sb.x + 5, ty, 12, th, 6); ctx.fill();
    }
    text(docMetrics.max > 0 ? (sc0 >= docMetrics.max - 1 ? 'End' : 'Scroll, or tap Next') : '', D.cx, D.counterY, 21, 'rgba(242,208,138,0.65)', UI, 500);
    button(D.header.textDec, 'A−', { size: 28, dim: state.textScaleIdx === 0 }); button(D.header.textInc, 'A+', { size: 28, dim: state.textScaleIdx === TEXT_SCALES.length - 1 });
    fitText(`${Math.round(scale * 100)}%`, D.header.textDec.x - 14, D.header.textDec.y + 42, 22, 70, DIM, UI, 600, 'right');
    if (state.msg) { const r = R(panelR.x + 30, vp.y + vp.h - 96, panelR.w - 60, 84); panel(r, 14, 'rgba(4,20,26,0.98)', 'rgba(242,208,138,0.8)', false); wrapBox(state.msg.text, R(r.x + 14, r.y + 6, r.w - 28, r.h - 12), 26, 1.2, CREAM); }
    button(D.nav.back, 'Back', { size: 28 }); button(D.nav.next, docMetrics.max <= 0 || sc0 >= docMetrics.max - 1 ? 'Done' : 'Next', { size: 28, primary: true });
  }
}

// ---------------------------------------------------------------- effects
// A captured piece: a flash, then it tilts, rises and fades with a few gem shards thrown off. f runs 0..1. `code` is the piece code (1..4).
export function capFx(ctx, style, code, x, y, cell, f, flip, calm, k) {
  const dirn = k % 2 ? 1 : -1, side = ((code - 1) & 1) + 1;
  if (f < 0.22) { const e = f / 0.22; drawPiece(ctx, code, style, x, y, cell, { scale: 1 + 0.1 * e, flash: 0.75 * e, lift: 0.1 * e }); return; }
  const g = (f - 0.22) / 0.78, e = ease(g);
  drawPiece(ctx, code, style, x, y - e * cell * 0.7, cell, { alpha: 1 - g, scale: 1.1 - 0.35 * e, tilt: calm ? 0 : dirn * e * 0.8, lift: 0.2 });
  if (calm) return;
  ctx.save();
  for (let j = 0; j < 7; j++) {
    const ang = k * 1.7 + j * 0.9, sp = cell * (0.5 + 0.45 * ((j * 5 + k) % 3) / 2);
    const px = x + Math.cos(ang) * sp * g, py = y - cell * 0.1 - Math.abs(Math.sin(ang)) * sp * 1.1 * g + g * g * cell * 0.9;
    ctx.globalAlpha = Math.max(0, 1 - g * 1.15); ctx.fillStyle = side === 1 ? (j % 2 ? '#ff7d8c' : '#9a1230') : (j % 2 ? '#8fc4ff' : '#1c4cb0');
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang + g * 6); const s2 = cell * (0.05 + 0.025 * (j % 3)); ctx.beginPath(); ctx.moveTo(0, -s2 * 1.3); ctx.lineTo(s2, 0); ctx.lineTo(0, s2 * 1.3); ctx.lineTo(-s2, 0); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}

function motes(ctx, L, t) {
  for (let k = 0; k < 14; k++) {
    const sp = 6 + (k % 4) * 3, x = (((k * 211.7 + t * sp) % (L.w + 80)) + L.w + 80) % (L.w + 80) - 40, y = (k * 137.3 + Math.sin(t * 0.25 + k) * 40 + L.h * 2) % L.h, r = 2 + (k % 5), a = 0.04 + 0.03 * Math.sin(t * 0.6 + k * 1.7);
    ctx.fillStyle = `rgba(190,240,230,${Math.max(0, a)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
}
