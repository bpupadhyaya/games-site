// Everything that is drawn each frame. Reads `state` (game.js) and changes nothing. All positions come from the live layout (layout.js).
import { TEXT_SCALES, THINK_STEPS, host, inRect, R, clamp, LONG, boardGeom } from './layout.js';
import { setFaces, drawTable, drawBoard, drawPiece, drawDiagram, diagramSize, blob, WOODS, woodPattern } from './art.js';
import { v3 } from './v3.js';
import { RULES, HOWTO, ABOUT, LESSONS } from './content.js';
import { settingsItems } from './settings.js';
import { VARIANTS, NAMES, START, pieceCount, QUICK_GOAL } from './rules.js';
import { LEVELS } from './ai.js';
import { drawCredit, drawLockup, drawMoreLine, drawBadgeStack, edgeStroke } from './brand.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const GOLD = '#f2d08a', CREAM = '#fff6e0', DIM = 'rgba(242,208,138,0.78)', VERM = '#d9661c';
const TAU = Math.PI * 2;
export const ui = { hits: [], buttons: [] };
export const docMetrics = { max: 0, view: 0 };
export const readerStats = { fits: 0 };
const fitMemo = new Map(); let fitFontsKey = '';
const ease = (f) => f * f * (3 - 2 * f);

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
  // ---- carved HUD: teak plaques with an ivory chalk inlay line and a deep indigo slate, glazed buttons with a lit face, a thick side and a pressed state
  const alphaOf = (c) => { const m = /,\s*([\d.]+)\)\s*$/.exec(c || ''); return m ? Number(m[1]) : 1; };
  const panel = (r, rad = 18, fill = 'rgba(8,10,34,0.66)', stroke = 'rgba(242,208,138,0.22)', brand = true) => {
    const hot = alphaOf(stroke) >= 0.4, f = Math.min(8, Math.max(4, r.h * 0.07));
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 7;
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fillStyle = '#2b1409'; ctx.fill();
    ctx.restore();
    const wp = woodPattern(ctx);
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad);
    if (wp) { ctx.fillStyle = wp; ctx.fill(); } else { const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h); g.addColorStop(0, '#6a3a1e'); g.addColorStop(1, '#3a1c0e'); ctx.fillStyle = g; ctx.fill(); }
    const shade = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); shade.addColorStop(0, 'rgba(255,224,170,0.16)'); shade.addColorStop(0.45, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = shade; ctx.fill();
    ctx.strokeStyle = 'rgba(255,226,170,0.38)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(r.x + 0.75, r.y + 0.75, r.w - 1.5, r.h - 1.5, rad); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(r.x - 0.5, r.y - 0.5, r.w + 1, r.h + 1, rad + 0.5); ctx.stroke();
    // the chalk inlay line (ivory, a little uneven like hand-drawn chalk)
    ctx.save(); ctx.strokeStyle = hot ? '#fff6dc' : 'rgba(255,244,222,0.78)'; ctx.lineWidth = hot ? 2.6 : 2; ctx.setLineDash(hot ? [] : [11, 3]);
    ctx.beginPath(); ctx.roundRect(r.x + f, r.y + f, r.w - 2 * f, r.h - 2 * f, Math.max(4, rad - f)); ctx.stroke();
    if (hot) { ctx.shadowColor = 'rgba(255,214,120,0.8)'; ctx.shadowBlur = 14; ctx.stroke(); }
    ctx.restore();
    // the recessed slate: dark base, the tint on top, and an inner shadow along the top and left
    const q = f + 4, ir = { x: r.x + q, y: r.y + q, w: r.w - 2 * q, h: r.h - 2 * q }, irad = Math.max(3, rad - q);
    ctx.beginPath(); ctx.roundRect(ir.x, ir.y, ir.w, ir.h, irad); ctx.fillStyle = '#080a1e'; ctx.fill(); ctx.fillStyle = fill; ctx.fill();
    ctx.save(); ctx.clip();
    const is = ctx.createLinearGradient(0, ir.y, 0, ir.y + Math.min(26, ir.h * 0.4)); is.addColorStop(0, 'rgba(0,0,0,0.5)'); is.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = is; ctx.fillRect(ir.x, ir.y, ir.w, Math.min(26, ir.h * 0.4));
    const il = ctx.createLinearGradient(ir.x, 0, ir.x + 18, 0); il.addColorStop(0, 'rgba(0,0,0,0.35)'); il.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = il; ctx.fillRect(ir.x, ir.y, 18, ir.h);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,226,170,0.2)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(ir.x, ir.y, ir.w, ir.h, irad); ctx.stroke();
    if (brand) edgeStroke(ctx, r, rad, 0.2);
  };
  // little line icons for the menu buttons (drawn, no image files)
  const glyph = (kind, cx, cy, s, col) => {
    ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(2, s * 0.11); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const u = s / 2;
    if (kind === 'play' || kind === 'resume') { ctx.beginPath(); ctx.moveTo(-u * 0.5, -u * 0.8); ctx.lineTo(u * 0.8, 0); ctx.lineTo(-u * 0.5, u * 0.8); ctx.closePath(); ctx.fill(); }
    else if (kind === 'two') { for (const dx of [-u * 0.42, u * 0.42]) { ctx.beginPath(); ctx.arc(dx, -u * 0.35, u * 0.3, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(dx, u * 0.85, u * 0.55, Math.PI, 0); ctx.fill(); } }
    else if (kind === 'learn') { ctx.beginPath(); ctx.moveTo(0, -u * 0.55); ctx.lineTo(0, u * 0.7); ctx.moveTo(0, -u * 0.55); ctx.quadraticCurveTo(-u * 0.5, -u * 0.8, -u * 0.95, -u * 0.55); ctx.lineTo(-u * 0.95, u * 0.5); ctx.quadraticCurveTo(-u * 0.5, u * 0.3, 0, u * 0.7); ctx.quadraticCurveTo(u * 0.5, u * 0.3, u * 0.95, u * 0.5); ctx.lineTo(u * 0.95, -u * 0.55); ctx.quadraticCurveTo(u * 0.5, -u * 0.8, 0, -u * 0.55); ctx.stroke(); }
    else if (kind === 'auto') { ctx.beginPath(); ctx.arc(0, 0, u * 0.7, -0.4, Math.PI * 1.15); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-u * 0.9, -u * 0.05); ctx.lineTo(-u * 0.6, -u * 0.7); ctx.lineTo(-u * 0.3, -u * 0.1); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(0, 0, u * 0.12, 0, TAU); ctx.fill(); }
    else if (kind === 'rules') { for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(-u * 0.7, k * u * 0.5); ctx.lineTo(u * 0.7, k * u * 0.5); ctx.stroke(); } ctx.beginPath(); ctx.roundRect(-u * 0.95, -u * 0.95, u * 1.9, u * 1.9, u * 0.3); ctx.stroke(); }
    else if (kind === 'how') { ctx.font = `800 ${s * 1.15}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('?', 0, s * 0.4); }
    else if (kind === 'about') { ctx.beginPath(); ctx.arc(0, 0, u * 0.9, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -u * 0.42, u * 0.1, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(0, -u * 0.12); ctx.lineTo(0, u * 0.5); ctx.stroke(); }
    else if (kind === 'settings') { ctx.beginPath(); ctx.arc(0, 0, u * 0.42, 0, TAU); ctx.stroke(); for (let k = 0; k < 8; k++) { const a = k * TAU / 8; ctx.beginPath(); ctx.moveTo(Math.cos(a) * u * 0.62, Math.sin(a) * u * 0.62); ctx.lineTo(Math.cos(a) * u * 0.95, Math.sin(a) * u * 0.95); ctx.stroke(); } }
    ctx.restore();
  };
  const button = (r, label, o = {}) => {
    ui.buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label });
    const pr = v3.pressed, pressed = !!pr && !o.dim && inRect(r, pr.x, pr.y);
    ctx.save(); if (o.dim) ctx.globalAlpha = 0.5;
    const rad = Math.min(18, r.h / 3), dep = Math.max(4, Math.min(9, r.h * 0.11)), dy = pressed ? dep * 0.7 : 0;
    const face = { x: r.x, y: r.y + dy, w: r.w, h: r.h - dep };
    // glazed buttons: saffron for the main action, indigo for the rest, brass for a chosen option
    const pal = o.primary ? { a: '#ffbf3f', b: '#d2561a', side: '#6e2a08', edge: '#fff0b8', txt: '#2a0f02' } : o.on ? { a: '#d7a949', b: '#7c5519', side: '#43290a', edge: '#fff0b8', txt: '#fff6e0' } : { a: '#3a56c0', b: '#18267a', side: '#0a1038', edge: '#d9c27a', txt: '#fff6e0' };
    ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + dep + 5, r.w - 2, r.h - dep, rad); ctx.fill();
    ctx.fillStyle = pal.side; ctx.beginPath(); ctx.roundRect(r.x, r.y + (pressed ? dep * 0.7 : dep), r.w, r.h - dep, rad); ctx.fill();
    ctx.beginPath(); ctx.roundRect(face.x, face.y, face.w, face.h, rad);
    const gr = ctx.createLinearGradient(0, face.y, 0, face.y + face.h); gr.addColorStop(0, pal.a); gr.addColorStop(1, pal.b); ctx.fillStyle = gr; ctx.fill();
    // glaze sheen on the upper half, a bright top edge, a dark lower edge
    ctx.save(); ctx.beginPath(); ctx.roundRect(face.x, face.y, face.w, face.h, rad); ctx.clip();
    const sh = ctx.createLinearGradient(0, face.y, 0, face.y + face.h * 0.55); sh.addColorStop(0, 'rgba(255,255,255,0.32)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = sh; ctx.fillRect(face.x, face.y, face.w, face.h * 0.55);
    const bt = ctx.createLinearGradient(0, face.y + face.h - 14, 0, face.y + face.h); bt.addColorStop(0, 'rgba(0,0,0,0)'); bt.addColorStop(1, 'rgba(0,0,0,0.3)'); ctx.fillStyle = bt; ctx.fillRect(face.x, face.y + face.h - 14, face.w, 14);
    ctx.restore();
    ctx.strokeStyle = pal.edge; ctx.globalAlpha *= o.primary ? 0.95 : 0.65; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(face.x + 1, face.y + 1, face.w - 2, face.h - 2, rad); ctx.stroke(); ctx.globalAlpha = o.dim ? 0.5 : 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(face.x + 4, face.y + 4, face.w - 8, face.h - 8, Math.max(2, rad - 4)); ctx.stroke();
    const size = o.size ?? 28, icoW = o.icon ? Math.min(face.h * 0.42, 30) : 0, maxW = r.w - 24 - (icoW ? icoW + 16 : 0), col = o.primary ? pal.txt : pal.txt === '#fff6e0' && !o.on ? GOLD : pal.txt, cy = face.y + face.h / 2;
    const cxL = r.x + r.w / 2 + (icoW ? (icoW + 10) / 2 : 0);
    const w1 = (str, s) => { ctx.font = `700 ${s}px ${UI}`; return ctx.measureText(str).width; };
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
    if (icoW) glyph(o.icon, r.x + 16 + icoW / 2, cy, icoW, o.primary ? pal.txt : GOLD);
    const lab = (str, x, y, sz) => { ctx.textAlign = 'center'; ctx.font = `700 ${sz}px ${UI}`; if (!o.primary) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(str, x, y + Math.max(1.5, sz * 0.07)); } else { ctx.fillStyle = 'rgba(255,240,190,0.45)'; ctx.fillText(str, x, y + Math.max(1, sz * 0.05)); } ctx.fillStyle = col; ctx.fillText(str, x, y); };
    if (o.sub && best.ls.length === 1) { lab(label, cxL, cy + best.s * 0.1 - 6, best.s); fitText(o.sub, cxL, cy + best.s * 0.1 + Math.max(minU, size * 0.62) + 2, Math.round(size * 0.62), maxW, o.primary ? 'rgba(60,24,4,0.85)' : DIM, UI, 600, 'center', minU); }
    else if (best.ls.length === 1) lab(label, cxL, cy + best.s * 0.35, best.s);
    else best.ls.forEach((ln, i) => lab(ln, cxL, cy + best.s * 0.35 + (i - 0.5) * best.s * 1.15, best.s));
    ctx.restore();
  };
  const hit = (r, id, v) => ui.hits.push({ r, id, v });

  // ---------------------------------------------------------------- scenes
  if (v3.on) {                                                       // the 3D courtyard is behind this canvas: clear to it and add a soft vignette
    ctx.clearRect(0, 0, L.w, L.h);
    const vg = ctx.createRadialGradient(L.w / 2, L.h * 0.5, Math.min(L.w, L.h) * 0.4, L.w / 2, L.h * 0.5, Math.max(L.w, L.h) * 0.78);
    vg.addColorStop(0, 'rgba(10,4,16,0)'); vg.addColorStop(1, 'rgba(10,4,16,0.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, L.w, L.h);
  } else { drawTable(ctx, L, state.t); if (!state.calm) motes(ctx, L, state.t); }

  if (scene === 'title' || scene === 'demo-limit') drawTitle();
  else if (scene === 'doc') drawDocument();
  else drawPlayScreen();

  // screens fade in from the table's dark instead of cutting
  if (state.sceneT < 0.22) { ctx.fillStyle = `rgba(14,6,18,${(1 - state.sceneT / 0.22) * 0.85})`; ctx.fillRect(0, 0, L.w, L.h); }

  // ================================================================ title
  function drawTitle() {
    const T = L.title(!!state.saved), Rr = T.rows;
    if (T.card) panel(T.card, 24, 'rgba(8,10,34,0.58)');
    hero(T.hero);
    if (scene === 'demo-limit') {
      const r = T.card || R(L.U.x0 + 30, L.h * 0.52, L.U.w - 60, L.h * 0.4);
      if (!T.card) panel(r, 24, 'rgba(8,10,34,0.72)');
      const cx = r.x + r.w / 2;
      fitText('That was the free taste.', cx, r.y + r.h * 0.34, 46, r.w - 40, GOLD, FONT, 700);
      wrapBox('Get Sholo Guti on iPhone and Android for unlimited games, all three rule sets and every level.', R(r.x + 24, r.y + r.h * 0.42, r.w - 48, r.h * 0.4), 28, 1.3, CREAM);
    } else {
      if (Rr.resume) button(Rr.resume, 'Continue your game', { primary: true, size: 30, icon: 'resume' });
      button(Rr.play, 'Play the computer', { primary: !Rr.resume, size: 32, icon: 'play', sub: `${VARIANTS[state.variant].name} · ${LEVELS[state.level].name} · as ${NAMES[state.humanSide]}` });
      button(Rr.two, 'Two players', { size: 26, icon: 'two' }); button(Rr.learn, state.learned ? 'Learn' : 'Learn to play', { size: 26, primary: false, icon: 'learn' });
      button(Rr.auto, 'Auto Play · Watch & Learn', { size: 26, icon: 'auto' });
      button(Rr.rules, 'Rules', { size: 26, icon: 'rules' }); button(Rr.how, 'How to Play', { size: 26, icon: 'how' });
      button(Rr.about, 'About', { size: 26, icon: 'about' }); button(Rr.settings, 'Settings', { size: 26, icon: 'settings' });
      if (state.msg) fitText(state.msg.text, L.w / 2, T.rows.play.y - 14, 24, L.w - 40, GOLD, UI, 600);
    }
    // the Arcforge lockup, bottom centre under the menu
    const lk = T.lockup; state.lockupRect = drawLockup(ctx, lk.x, lk.y + 4, 50);
  }

  function hero(r) {
    // title text: embossed saffron-gold lettering with an indigo outline, over the live courtyard
    const cx = r.x + r.w / 2;
    const ts = clamp(Math.min(r.w / 5.4, r.h / 4.4), 40, 120);
    const y0 = r.y + ts * 0.95;
    const tfs = memo(`t|${ts}|${r.w}`, () => { let q = ts; ctx.font = `700 ${q}px ${FONT}`; while (q > minU && ctx.measureText('Sholo Guti').width > r.w - 10) { q -= 1; ctx.font = `700 ${q}px ${FONT}`; } return q; });
    ctx.save(); ctx.font = `700 ${tfs}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
    ctx.strokeStyle = '#1a1250'; ctx.lineWidth = tfs * 0.17; ctx.strokeText('Sholo Guti', cx, y0);
    ctx.shadowColor = 'transparent';
    const grad = ctx.createLinearGradient(0, y0 - tfs * 0.78, 0, y0 + tfs * 0.1); grad.addColorStop(0, '#fff7d8'); grad.addColorStop(0.45, '#ffc23c'); grad.addColorStop(0.55, '#e0731a'); grad.addColorStop(1, '#ffd88a');
    ctx.fillStyle = grad; ctx.fillText('Sholo Guti', cx, y0);
    ctx.strokeStyle = 'rgba(255,250,222,0.75)'; ctx.lineWidth = Math.max(1, tfs * 0.02); ctx.strokeText('Sholo Guti', cx, y0 - tfs * 0.012);
    ctx.restore();
    const sub = Math.max(minU, ts * 0.3);
    ctx.save();
    const pw = Math.min(r.w * 0.66, ts * 5.6), py = y0 + ts * 0.34, ph = sub * 1.7;
    const bg2 = ctx.createLinearGradient(0, py, 0, py + ph); bg2.addColorStop(0, '#ee5a2a'); bg2.addColorStop(1, '#a52a0e');
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    ctx.beginPath(); ctx.roundRect(cx - pw / 2, py, pw, ph, ph / 2); ctx.fillStyle = bg2; ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#ffd98a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    ctx.font = `700 ${sub}px ${UI}`; ctx.fillStyle = CREAM; ctx.textAlign = 'center';
    ctx.fillText('S I X T E E N   S T O N E S', cx, py + sub * 1.2);
    fitText('The jumping game of Bengal', cx, py + sub * 1.7 + ts * 0.36, ts * 0.3, r.w - 20, 'rgba(255,217,138,0.95)', FONT, 700);
    // the animated demonstration: a double jump, forever
    const top = py + sub * 1.7 + ts * 0.62, room = r.y + r.h - top;
    if (room > 90) { if (v3.on) v3.heroRect = R(r.x, top + 6, r.w, room - 22); else heroBoard(R(r.x, top + 6, r.w, room - 22)); }
  }

  function heroBoard(r) {
    // a small board on its side: Ivory jumps twice in one turn (22 -> 12 -> 4), then the position resets
    const cell = clamp(Math.min((r.w - 30) / LONG, (r.h - 14) / 5.4, 100), 18, 100);
    const Bm = boardGeom(r.x + (r.w - LONG * cell) / 2, r.y + (r.h - 5.32 * cell) / 2 + 2, cell, true, false);
    const T = state.calm || state.frozen ? 3.2 : state.t % 7.4;
    const op = T < 0.5 ? T / 0.5 : T > 6.8 ? Math.max(0, 1 - (T - 6.8) / 0.6) : 1;
    const ivory = [15, 16, 18, 20, 24, 31, 32, 33, 34, 35, 36], indigo = [0, 1, 2, 3, 6, 25, 26, 27, 28, 29, 30];
    ctx.save(); ctx.globalAlpha = op;
    drawBoard(ctx, Bm, wood);
    const stones = [];
    for (const i of ivory) stones.push({ i, s: 1 });
    for (const i of indigo) stones.push({ i, s: 2 });
    const t1 = 1.3, t2 = 2.2, seg = 0.8;                       // jump 1 starts at t1, jump 2 at t2
    stones.push({ i: 17, s: 2, cap: t1 + seg * 0.55 }, { i: 8, s: 2, cap: t2 + seg * 0.55 });
    stones.sort((p, q) => Bm.pt(p.i).y - Bm.pt(q.i).y);
    for (const st of stones) {
      const p = Bm.pt(st.i);
      if (st.cap === undefined) drawPiece(ctx, st.s, style, p.x, p.y, cell);
      else if (T < st.cap) drawPiece(ctx, st.s, style, p.x, p.y, cell);
      else { const f = (T - st.cap) / 0.6; if (f < 1) capFx(ctx, style, 2, p.x, p.y, cell, f, false, state.calm, st.i); }
    }
    const A = Bm.pt(22), B1 = Bm.pt(12), C = Bm.pt(4);
    let mx = A.x, my = A.y, lift = 0, f;
    if (T >= t1 && T < t2) { f = clamp((T - t1) / seg, 0, 1); const e = ease(f); mx = A.x + (B1.x - A.x) * e; my = A.y + (B1.y - A.y) * e; lift = Math.sin(Math.PI * f) * 0.9; }
    else if (T >= t2) { f = clamp((T - t2) / seg, 0, 1); const e = ease(f); mx = B1.x + (C.x - B1.x) * e; my = B1.y + (C.y - B1.y) * e; lift = Math.sin(Math.PI * f) * 0.9; }
    else lift = T > 0.8 ? clamp((T - 0.8) / 0.4, 0, 1) * 0.45 : 0;
    drawPiece(ctx, 1, style, mx, my, cell, { lift, glow: T > 0.8 && T < t1 ? 0.6 : 0 });
    ctx.restore();
  }

  // ================================================================ play / over / lesson
  function drawPlayScreen() {
    const isLesson = scene === 'lesson', over = scene === 'over';
    const pal = WOODS[wood] || WOODS.kaya, cell = B.cell;
    // side cards in landscape
    if (L.land) { if (L.leftCard) panel(L.leftCard, 18); panel(L.rightCard, 18); }

    // ---- the board scene. With the 3D courtyard (v3.on) the board, stones, markers and effects are recorded for the presenter instead
    // of painted; the numbers and badges that sit on top are still drawn here at the projected positions.
    const T3 = v3.on;
    const put = (side, x, y, o = {}) => { if (T3) v3.pieces.push({ side, x, y, lift: o.lift || 0, scale: o.scale, tilt: o.tilt, rock: o.rock, drag: o.drag }); else drawPiece(ctx, side, style, x, y, cell, o); };
    const mark = (kind, p, o = {}) => v3.marks.push({ kind, x: p.x, y: p.y, a: o.a, x0: o.x0, y0: o.y0 });
    const sqp = (i) => (T3 && v3.sq ? v3.sq(i) : { ...L.sq(i), s: cell });
    ctx.save();
    if (!T3 && a && a.caps.length && !state.calm && a.t > a.glide && a.t < a.glide + 0.35) { const f = (a.t - a.glide) / 0.35; ctx.translate(Math.sin(f * 46) * (1 - f) * cell * 0.045, Math.cos(f * 38) * (1 - f) * cell * 0.03); }
    if (!T3) drawBoard(ctx, B, wood);
    // last move
    const last = a ? null : g.last;
    if (last && !isLesson) {
      if (!T3 && last.path && last.path.length > 1) { ctx.strokeStyle = 'rgba(255,214,110,0.4)'; ctx.lineWidth = cell * 0.06; ctx.lineJoin = 'round'; ctx.setLineDash([cell * 0.12, cell * 0.14]); ctx.beginPath(); last.path.forEach((q, k) => { const p = L.sq(q); if (k) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.stroke(); ctx.setLineDash([]); }
      for (const q of [last.from, last.to]) { const p = L.sq(q); if (T3) mark('last', p); else { ctx.fillStyle = 'rgba(255,214,110,0.26)'; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.42, 0, TAU); ctx.fill(); } }
    }
    const pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(state.t * 5);
    // lesson target
    if (isLesson && LESSONS[state.lesson.i].target !== undefined && !state.lesson.done) { const p = L.sq(LESSONS[state.lesson.i].target); if (T3) mark('lesson', p, { a: pulse }); else { ctx.strokeStyle = `rgba(214,64,31,${0.6 + 0.4 * pulse})`; ctx.lineWidth = cell * 0.07; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.38, 0, TAU); ctx.stroke(); } }
    // selected piece: legal squares
    const badges = [];
    if (state.sel >= 0 && !a && !over) {
      const sp = L.sq(state.sel); if (T3) mark('sel', sp, { a: pulse }); else { ctx.fillStyle = `rgba(255,224,120,${0.28 + pulse * 0.14})`; ctx.beginPath(); ctx.arc(sp.x, sp.y, cell * 0.44, 0, TAU); ctx.fill(); }
      for (const m of state.selMoves) {
        const p = L.sq(m.to);
        if (m.caps) {
          if (T3) { mark('cap', p, { a: pulse }); badges.push({ to: m.to, n: m.caps }); }
          else {
            ctx.strokeStyle = `rgba(226,60,36,${0.7 + pulse * 0.3})`; ctx.lineWidth = cell * 0.07; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.36, 0, TAU); ctx.stroke();
            ctx.fillStyle = 'rgba(226,60,36,0.2)'; ctx.fill();
            const s = Math.round(cell * 0.3); ctx.fillStyle = '#e23c24'; ctx.beginPath(); ctx.arc(p.x + cell * 0.3, p.y - cell * 0.3, s * 0.56, 0, TAU); ctx.fill();
            text(String(m.caps), p.x + cell * 0.3, p.y - cell * 0.3 + s * 0.2, s * 0.72, '#fff', UI, 800);
          }
        } else if (T3) mark('move', p, { a: pulse });
        else { ctx.fillStyle = `rgba(255,248,214,${0.55 + pulse * 0.2})`; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.13, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(70,40,10,0.45)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
    }
    if (state.hint && !a) for (const q of [state.hint.from, state.hint.to]) {
      const p = L.sq(q);
      if (T3) mark('hint', p, { a: pulse });
      else { ctx.fillStyle = `rgba(90,230,150,${0.3 + pulse * 0.2})`; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.44, 0, TAU); ctx.fill(); ctx.strokeStyle = `rgba(90,230,150,${0.9})`; ctx.lineWidth = 3; ctx.stroke(); }
    }
    // pieces, far rows first (a lower piece overlaps the one above it)
    const order = []; for (let i = 0; i < 37; i++) order.push(i); order.sort((p0, q0) => L.sq(p0).y - L.sq(q0).y);
    const movingTo = a ? a.to : -1;
    const dragging = state.drag && state.sel >= 0;
    for (const i of order) {
      const k = g.board[i]; if (!k || i === movingTo) continue;
      if (dragging && i === state.sel) continue;
      const p = L.sq(i), sel = state.sel === i;
      const lift = sel ? 0.45 + (state.calm ? 0 : Math.sin(state.t * 3) * 0.06) : 0;
      put(k, p.x, p.y, { lift, glow: sel ? 0.8 : 0 });
      if (state.marks && !over && !a && state.danger && state.danger.has(i)) { const q = sqp(i); dangerMark(q.x + q.s * 0.3, q.y - q.s * (T3 ? 0.36 : 0.3), q.s); }
    }
    // the captured pieces: they stay until the mover passes over them, then are flicked off the board
    if (a) for (const [n, q] of a.caps.entries()) {
      const p = L.sq(q), t0 = a.segT * (n + 0.55);
      if (a.t < t0) put(3 - a.side, p.x, p.y, {});
      else { const f = (a.t - t0) / 0.55; if (f < 1) { if (T3) v3.fx.push({ kind: 'cap', side: 3 - a.side, x: p.x, y: p.y, f, id: n + q }); else capFx(ctx, style, 3 - a.side, p.x, p.y, cell, f, L.flip, state.calm, n + q); } }
    }
    // a golden burst and a floating count where the sandwich closed
    if (a && a.caps.length && !state.calm && a.t > a.glide) {
      const f = (a.t - a.glide) / 0.8;
      if (f < 1) {
        const p1 = T3 ? sqp(a.to) : L.sq(a.to), e2 = ease(Math.min(1, f * 1.4)), cs = T3 ? p1.s : cell;
        if (!T3) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const rg = ctx.createRadialGradient(p1.x, p1.y, 0, p1.x, p1.y, cell * (0.4 + 1.3 * f)); rg.addColorStop(0, `rgba(255,220,140,${0.5 * (1 - f)})`); rg.addColorStop(1, 'rgba(255,200,100,0)');
          ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(p1.x, p1.y, cell * (0.4 + 1.3 * f), 0, TAU); ctx.fill(); ctx.restore();
        }
        const fs = Math.round(cs * 0.62);
        ctx.save(); ctx.globalAlpha = Math.min(1, (1 - f) * 2.2);
        ctx.lineWidth = fs * 0.14; ctx.strokeStyle = 'rgba(40,16,4,0.9)'; ctx.lineJoin = 'round'; ctx.font = `800 ${fs}px ${UI}`; ctx.textAlign = 'center';
        const tx = p1.x, ty = p1.y - cs * (0.7 + 0.8 * e2);
        ctx.strokeText(`+${a.caps.length}`, tx, ty); ctx.fillStyle = '#ffd24a'; ctx.fillText(`+${a.caps.length}`, tx, ty); ctx.restore();
      }
    }
    // the moving stone: along its path, one landing point at a time, hopping over what it captures
    if (a) {
      const segs = Math.max(1, a.path.length - 1), u = clamp(a.t / a.segT, 0, segs), k = Math.min(segs - 1, Math.floor(u)), f = u - k, e = ease(f);
      const p0 = L.sq(a.path[k]), p1 = L.sq(a.path[k + 1]);
      const x = p0.x + (p1.x - p0.x) * e, y = p0.y + (p1.y - p0.y) * e, dist = Math.hypot(p1.x - p0.x, p1.y - p0.y) / cell;
      const done = a.t >= a.glide;
      const lift = !done ? Math.sin(Math.PI * f) * (a.jump ? 1.0 : 0.35 + Math.min(0.3, dist * 0.04)) + 0.15 : Math.max(0, 0.15 * (1 - (a.t - a.glide) / 0.12));
      put(a.side, x, y, { lift, glow: 0.5, rock: done ? clamp((a.t - a.glide) / 0.7, 0, 1) : undefined });
      const pe = L.sq(a.to);
      if (a.t > a.glide && a.t < a.glide + 0.45 && !state.calm) {
        const ff = (a.t - a.glide) / 0.45;
        if (T3) v3.fx.push({ kind: 'land', x: pe.x, y: pe.y, f: ff, id: 'l' + a.to });
        else { ctx.strokeStyle = `rgba(255,240,200,${0.75 * (1 - ff)})`; ctx.lineWidth = cell * 0.07 * (1 - ff) + 1; ctx.beginPath(); ctx.ellipse(pe.x, pe.y + cell * 0.2, cell * (0.3 + 0.8 * ff), cell * (0.14 + 0.34 * ff), 0, 0, TAU); ctx.stroke(); }
      } else if (T3 && !done && !state.calm && f > 0.9 && a.jump) { const ff = (f - 0.9) / 0.1; v3.fx.push({ kind: 'land', x: p1.x, y: p1.y, f: ff * 0.3, id: 'h' + k + a.to }); }
    }
    // a dragged piece follows the finger
    if (dragging) put(g.board[state.sel] || g.turn, state.drag.x, state.drag.y - cell * 0.15, { lift: 0.9, glow: 0.9, drag: true });
    if (state.kb && !over) { const p = L.sq(state.cursor); if (T3) mark('kb', p); else { ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.46, 0, TAU); ctx.stroke(); } }
    ctx.restore();
    // capture-count badges on the ringed destination points (3D board): drawn on top at the projected point
    for (const b of badges) { const q = sqp(b.to), s = Math.round(q.s * 0.3); ctx.fillStyle = '#e23c24'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x + q.s * 0.3, q.y - q.s * 0.32, s * 0.62, 0, TAU); ctx.fill(); ctx.stroke(); text(String(b.n), q.x + q.s * 0.3, q.y - q.s * 0.32 + s * 0.22, s * 0.78, '#fff', UI, 800); }

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
    return { got: g.lost[opp] - (a && a.side === side ? flying : 0), left: pieceCount(g, side) + (a && a.side !== side ? flying : 0) };
  }
  function plate(r, side) {
    const human = !state.two && !state.autoMode && side === state.humanSide;
    const name = state.autoMode ? `${NAMES[side]} · computer` : state.two ? NAMES[side] : human ? 'You' : 'Computer';
    const sub = state.autoMode ? LEVELS[Math.max(2, state.level)].name : state.two || human ? NAMES[side] : `${LEVELS[state.level].name} · ${NAMES[side]}`;
    const turn = !g.winner && g.turn === side && scene !== 'over';
    panel(r, 16, turn ? 'rgba(58,38,10,0.8)' : 'rgba(8,10,34,0.66)', turn ? 'rgba(242,208,138,0.85)' : 'rgba(242,208,138,0.2)', true);
    const info = plateInfo(side), v = state.variant, goalN = v === 'quick' ? QUICK_GOAL : START;
    if (r.h < 112) {                                                  // compact: one line of text, the captured pieces on the right
      const ic2 = clamp(r.h * 0.74, 36, 80), ix2 = r.x + 12 + ic2 * 0.55, iy2 = r.y + r.h * 0.5 + ic2 * 0.3;
      drawPiece(ctx, side, style, ix2, iy2, ic2, { flip: L.flip, glow: turn ? 0.7 : 0 });
      const tx2 = r.x + 12 + ic2 * 1.1 + 12, ns2 = clamp(r.h * 0.27, 18, 30), tcw = r.w > 560 ? Math.min(r.w * 0.34, 260) : 0;
      const st = turn ? (state.autoMode ? (state.autoPaused ? 'Paused' : 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3))) : state.two ? 'To move' : human ? 'Your move' : 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3))) : sub;
      fitText(`${name} · ${st}`, tx2, r.y + r.h * 0.42, ns2, r.x + r.w - 22 - tx2 - tcw, turn ? CREAM : DIM, UI, 800, 'left');
      const goal2 = `Captured ${info.got} of ${goalN}`;
      fitText(`${goal2} · ${info.left} left`, tx2, r.y + r.h * 0.75, Math.round(ns2 * 0.78), r.x + r.w - 22 - tx2 - tcw, DIM, UI, 600, 'left');
      if (!tcw) return;
      const tc2 = clamp(r.h * 0.5, 24, 40), per2 = Math.max(1, Math.floor(tcw / (tc2 * 0.6)));
      for (let k = 0; k < Math.min(info.got, 18); k++) drawPiece(ctx, 3 - side, style, r.x + r.w - 14 - tcw + tc2 * 0.4 + (k % per2) * tc2 * 0.6, r.y + r.h * 0.5 + tc2 * 0.28 + Math.floor(k / per2) * tc2 * 0.3 - (info.got > per2 ? tc2 * 0.15 : 0), tc2, { flip: L.flip, alpha: 0.95 });
      return;
    }
    const ns = clamp(r.h * 0.22, 18, 46), ic = clamp(Math.min(r.h * 0.6, r.w * 0.22), 38, 132);
    const ix = r.x + 14 + ic * 0.55, iy = r.y + 12 + ic * 0.62;
    drawPiece(ctx, side, style, ix, iy, ic, { flip: L.flip, glow: turn ? 0.7 : 0, lift: turn && !state.calm ? 0.12 + Math.sin(state.t * 3) * 0.05 : 0 });
    const tx = r.x + 14 + ic * 1.1 + 14, tw = r.x + r.w - 26 - tx;
    const y1 = r.y + 10 + ns * 0.85, y2 = y1 + ns * 0.84, y3 = y2 + ns * 0.8;
    fitText(name, tx, y1, ns, tw, CREAM, UI, 800, 'left');
    const status = turn ? (state.autoMode ? (state.autoPaused ? 'Paused' : state.autoPhase === 'reveal' ? 'The move' : 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3))) : state.two ? 'To move' : human ? 'Your move' : state.thinking || state.think > 0 ? 'Thinking' + '.'.repeat(1 + (Math.floor(state.t * 3) % 3)) : 'Moving') : sub;
    fitText(status, tx, y2, Math.round(ns * 0.72), tw, turn ? GOLD : DIM, UI, 600, 'left');
    const goalFull = `Captured ${info.got} of ${goalN} · ${info.left} left`;
    ctx.font = `600 ${minU}px ${UI}`;
    fitText(ctx.measureText(goalFull).width > tw ? `${info.got}/${goalN} captured · ${info.left} left` : goalFull, tx, y3, Math.round(ns * 0.62), tw, DIM, UI, 600, 'left');
    const slots = goalN, cols = 8, availH = r.y + r.h - (y3 + 8) - 4;
    const rowsN = Math.ceil(slots / cols), tc = Math.min(clamp(availH / (1 + 0.62 * (rowsN - 1)), 0, 56), tw / (0.62 * cols + 0.35));          // one row of slots must fit the plate's width
    if (tc >= 18) {
      const at = (k) => ({ x: tx + tc * 0.4 + (k % cols) * tc * 0.62, y: y3 + 8 + tc * 0.55 + Math.floor(k / cols) * tc * 0.62 });
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
    const base = scene === 'over' ? '' : state.autoMode ? 'Auto Play: the computer plays both sides.' : g.winner ? '' : state.two || g.turn === state.humanSide ? 'Tap a stone, then a glowing point.' : '';
    if (state.msg && al > 0) {
      ctx.save(); ctx.globalAlpha = clamp(al, 0, 1);
      ctx.beginPath(); ctx.roundRect(M.x, M.y + 4, M.w - (L.msgPill || 0), M.h - 8, 14); ctx.fillStyle = 'rgba(22,12,6,0.92)'; ctx.fill(); ctx.strokeStyle = 'rgba(242,208,138,0.75)'; ctx.lineWidth = 2; ctx.stroke();
      wrapBox(state.msg.text, R(M.x + 14, M.y + 8 + (L.msgTop || 0), M.w - 28 - (L.msgPill || 0), M.h - 16 - (L.msgTop || 0)), big ? 30 : 25, 1.18, CREAM);
      ctx.restore();
    } else if (base) { wrapBox(base, R(M.x + 8, M.y + (L.msgTop || 0), M.w - 16 - (L.msgPill || 0), M.h - (L.msgTop || 0)), 24, 1.2, DIM); }
    if (L.land && L.rightHead) fitText(VARIANTS[state.variant].long, L.rightHead.x + L.rightHead.w / 2, L.rightHead.y + 34, 26, L.rightHead.w, GOLD, FONT, 700);
    if (L.badge && L.badge.show) drawBadgeStack(ctx, L.badge.cx, L.badge.bottom, L.badge.w);
  }
  function lessonBox() {
    const l = LESSONS[state.lesson.i], r = L.lessonBox;
    panel(r, 16, 'rgba(8,10,34,0.74)', 'rgba(242,208,138,0.45)');
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
    ctx.fillStyle = 'rgba(8,4,16,0.72)'; ctx.fillRect(0, 0, L.w, L.h);
    const O = L.over, c = O.card, cx = c.x + c.w / 2;
    panel(c, 26, 'rgba(20,14,52,0.95)', 'rgba(242,208,138,0.55)');
    const res = state.result || { winner: g.winner, reason: g.reason }, w = res.winner;
    const title = w === 3 ? 'A draw' : state.autoMode ? `${NAMES[w]} wins` : state.two ? `${NAMES[w]} wins` : w === state.humanSide ? 'You win!' : 'The computer wins';
    const k = Math.min(1, (O.again.y - c.y - 16) / 430), cw2 = c.w / k;
    ctx.save(); ctx.translate(cx, c.y); ctx.scale(k, k);
    if (w !== 3) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';                         // a slow sunburst behind the winning stone (alpona rays)
      for (let k = 0; k < 12; k++) { ctx.save(); ctx.translate(0, 118); ctx.rotate(k * TAU / 12 + (state.calm ? 0 : state.t * 0.12)); const rg = ctx.createLinearGradient(0, 0, 0, -150); rg.addColorStop(0, 'rgba(255,214,120,0.34)'); rg.addColorStop(1, 'rgba(255,214,120,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.lineTo(24, -150); ctx.lineTo(-24, -150); ctx.closePath(); ctx.fill(); ctx.restore(); }
      ctx.restore();
      drawPiece(ctx, w, style, 0, 124, 150, { glow: 0.5, lift: 0.4 + Math.sin(state.t * 2.5) * 0.08 });
    }
    else { drawPiece(ctx, 1, style, -56, 118, 96, {}); drawPiece(ctx, 2, style, 56, 118, 96, {}); }
    fitText(title, 0, 238, 62, cw2 - 40, GOLD, FONT, 700);
    wrapBox(res.reason || '', R(-cw2 / 2 + 30, 252, cw2 - 60, 70), 26, 1.25, CREAM);
    fitText(`${Math.ceil(g.moves / 2)} moves · captured ${g.lost[2]} Indigo, ${g.lost[1]} Ivory`, 0, 346, 22, cw2 - 40, DIM, UI, 500);
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
    ctx.fillStyle = 'rgba(8,4,16,0.5)'; ctx.fillRect(0, 0, L.w, L.h);
    ctx.beginPath(); ctx.roundRect(panelR.x, panelR.y, panelR.w, panelR.h, 26);
    const pg = ctx.createLinearGradient(0, panelR.y, 0, panelR.y + panelR.h); pg.addColorStop(0, 'rgba(38,28,82,0.9)'); pg.addColorStop(1, 'rgba(14,10,36,0.95)');
    ctx.fillStyle = pg; ctx.fill(); ctx.strokeStyle = 'rgba(242,208,138,0.32)'; ctx.lineWidth = 2; ctx.stroke();
    edgeStroke(ctx, panelR, 26, 0.4);
    const heading = { rules: 'Rules', how: 'How to Play', about: 'About', settings: 'Settings' }[kind];
    const hx = L.ins.back && panelR.x < L.backBox.x + L.backBox.w + 8 && panelR.y < L.backBox.y + L.backBox.h ? L.backBox.x + L.backBox.w + 6 : panelR.x + 34;
    fitText(heading, hx, panelR.y + 56, 44, D.header.textDec.x - 84 - hx, GOLD, FONT, 700, 'left');
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
          const spec = it.spec, cp = Math.min((spec.cell || 40) * (1 + (Math.min(scale, 2) - 1) * 0.35), (bodyW - 24) / LONG), ds = diagramSize(spec, cp);
          if (vis(y, ds.h)) drawDiagram(ctx, spec, cxp - ds.w / 2, y, cp, wood, style);
          y += ds.h + gap + 10;
        } else if (it.k === 'btn') {
          const fs = Math.round(25 * Math.min(scale, 2.2)), bh = Math.round(66 * Math.min(scale, 2.2)), rr = R(left, y, bodyW, bh);
          if (vis(y, bh)) button(rr, state.restoreBusy ? 'Checking...' : it.label, { size: fs, dim: !!it.disabled, primary: !it.disabled });
          if (!it.disabled) ui.hits.push({ r: rr, id: it.id, v: 0, clip: vp });
          y += bh + 8;
          const ls = lines(it.sub || '', Math.round(22 * Math.min(scale, 2.2)), bodyW, 500), sfs = Math.round(22 * Math.min(scale, 2.2));
          if (vis(y, ls.length * sfs * 1.3)) ls.forEach((ln, i) => text(ln, cxp, y + sfs * 0.9 + i * sfs * 1.3, sfs, DIM, UI, 500, 'center'));
          y += ls.length * sfs * 1.3 + gap;
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
      const fade = (y0, y1, a0, a1) => { const gr = ctx.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(22,16,52,${a0})`); gr.addColorStop(1, `rgba(22,16,52,${a1})`); ctx.fillStyle = gr; ctx.fillRect(vp.x - 6, Math.min(y0, y1), vp.w + 12, Math.abs(y1 - y0)); };
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
    if (state.msg) { const r = R(panelR.x + 30, vp.y + vp.h - 96, panelR.w - 60, 84); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 14); ctx.fillStyle = 'rgba(22,12,6,0.95)'; ctx.fill(); ctx.strokeStyle = 'rgba(242,208,138,0.8)'; ctx.lineWidth = 2; ctx.stroke(); wrapBox(state.msg.text, R(r.x + 14, r.y + 6, r.w - 28, r.h - 12), 26, 1.2, CREAM); }
    button(D.nav.back, 'Back', { size: 28 }); button(D.nav.next, docMetrics.max <= 0 || sc0 >= docMetrics.max - 1 ? 'Done' : 'Next', { size: 28, primary: true });
  }
}

// ---------------------------------------------------------------- effects
// A captured piece: a flash, then it tilts, rises and fades with a few wood chips thrown off. f runs 0..1.
export function capFx(ctx, style, side, x, y, cell, f, flip, calm, k) {
  const dirn = k % 2 ? 1 : -1;
  if (f < 0.22) { const e = f / 0.22; drawPiece(ctx, side, style, x, y, cell, { flip, scale: 1 + 0.1 * e, flash: 0.75 * e, lift: 0.1 * e }); return; }
  const g = (f - 0.22) / 0.78, e = ease(g);
  drawPiece(ctx, side, style, x, y - e * cell * 0.7, cell, { flip, alpha: 1 - g, scale: 1.1 - 0.35 * e, tilt: calm ? 0 : dirn * e * 0.8, lift: 0.2 });
  if (calm) return;
  ctx.save();
  for (let j = 0; j < 6; j++) {
    const ang = k * 1.7 + j * 1.05, sp = cell * (0.5 + 0.45 * ((j * 5 + k) % 3) / 2);
    const px = x + Math.cos(ang) * sp * g, py = y - cell * 0.1 - Math.abs(Math.sin(ang)) * sp * 1.1 * g + g * g * cell * 0.9;
    ctx.globalAlpha = Math.max(0, 1 - g * 1.15); ctx.fillStyle = j % 2 ? '#e9c27c' : '#8a5a2c';
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang + g * 6); const s = cell * (0.05 + 0.025 * (j % 3)); ctx.fillRect(-s, -s * 0.5, s * 2, s); ctx.restore();
  }
  ctx.restore();
}

function motes(ctx, L, t) {
  for (let k = 0; k < 14; k++) {
    const sp = 6 + (k % 4) * 3, x = (((k * 211.7 + t * sp) % (L.w + 80)) + L.w + 80) % (L.w + 80) - 40, y = (k * 137.3 + Math.sin(t * 0.25 + k) * 40 + L.h * 2) % L.h, r = 2 + (k % 5), a = 0.04 + 0.03 * Math.sin(t * 0.6 + k * 1.7);
    ctx.fillStyle = `rgba(255,214,150,${Math.max(0, a)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
}
