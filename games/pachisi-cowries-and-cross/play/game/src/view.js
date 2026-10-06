// Everything drawn each frame. Reads `state` (game.js) and changes nothing. The heavy art is cached (art.js, pieces.js).
import { W, H, L, MAT, BOARD, host, cellSize, posXY, yardOffset, gridXY, hopPath, throwGeo } from './layout.js';
import { geo, homeCount, trackIndex, COLOUR_NAMES } from './rules.js';
import { drawStatic, drawFloorOnly, drawPanel, star, ARM_COLOURS, ARM_LIGHT, lcg } from './art.js';
import { drawPawn, drawCowry, drawDie } from './pieces.js';
import { screenButtons, titleGeo, setupGeo, learnGeo, settingsGeo, readerGeo, overlayGeo, HOW_PAGES, ABOUT_PAGES, RULES_PAGES, TEXT_SCALES } from './ui.js';
import { drawLockupImage, drawMoreLine, drawBadgeStack, edgeStroke } from './brand.js';
import { LESSONS } from './lessons.js';
import { LEVEL_NAMES, LEVEL_BLURB } from './ai.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const INK = '#3a1c0e';

const ease = (f) => f * f * (3 - 2 * f);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Reader layout cache (wrapped lines + total height). readerStats.layouts counts rebuilds (tests read it).
const readerCache = { key: '', items: [], total: 0 };
export const readerStats = { layouts: 0 };
// The laid-out reader (item baselines in document units) and its sizes, for the layout test: every heading, art block and line is strictly top to bottom.
export const readerDebug = () => ({ items: readerCache.items, sz: readerCache.sz, hs: readerCache.hs, artH: RULES_ART_H });

export function render(ctx, state) {
  const sc = state.scene, T = state.t, big = state.prefs.big, g = state.g;
  // Falls back to 1 for any out-of-range index (e.g. a save from a build with more/fewer steps).
  const textScale = TEXT_SCALES[state.prefs.textScaleIdx ?? 0] ?? 1;
  const panelScene = ['setup', 'learn', 'settings', 'how', 'about', 'rules', 'demo-limit'].includes(sc);
  const boardScene = !panelScene;
  const isTitle = sc === 'title', has = !!state.saved;
  const mode = boardScene && !isTitle ? g.mode : 'pachisi';
  const minSz = Math.max(14, Math.ceil(11 / (host.px || 0.6)));   // text never below ~11 css px

  const text = (str, x, y, size, color = '#f6dfae', font = UI, weight = 700, align = 'center') => { ctx.textAlign = align; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  const shadowText = (str, x, y, size, color, font = FONT, align = 'center', maxW = 0) => {
    if (maxW) { while (size > 20 && (ctx.font = `700 ${size}px ${font}`, ctx.measureText(str).width > maxW)) size -= 2; }
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3; text(str, x, y, size, color, font, 700, align); ctx.restore();
  };
  const wrapLines = (str, maxW, size, weight = 600, font = UI) => {
    ctx.font = `${weight} ${size}px ${font}`;
    const lines = []; let curL = '';
    for (const w of str.split(' ')) { const t2 = curL ? curL + ' ' + w : w; if (ctx.measureText(t2).width > maxW && curL) { lines.push(curL); curL = w; } else curL = t2; }
    lines.push(curL); return lines;
  };
  const wrap = (str, x, y, size, maxW, color, lh = size * 1.32, align = 'center', font = UI, weight = 600, maxLines = 99) => {
    const lines = wrapLines(str, maxW, size, weight, font);
    lines.slice(0, maxLines).forEach((ln, i) => text(ln, x, y + i * lh, size, color, font, weight, align));
    return lines.length;
  };
  const fitWrap = (str, x, y, maxW, maxH, sMax, sMin, color, align = 'center', lhk = 1.28) => {
    for (let sz = sMax; sz >= sMin; sz -= 1) {
      const n = wrapLines(str, maxW, sz).length;
      if (n * sz * lhk <= maxH || sz === sMin) { const lh = sz * lhk, top = y + (maxH - n * lh) / 2 + sz * 0.95; wrap(str, x, top, sz, maxW, color, lh, align); return; }
    }
  };
  const fitSize = (str, size, maxW, weight = 700) => { let sz = size; ctx.font = `${weight} ${sz}px ${UI}`; while (sz > minSz && ctx.measureText(str).width > maxW) { sz -= 1; ctx.font = `${weight} ${sz}px ${UI}`; } return sz; };
  const button = (r) => {
    ctx.save(); if (r.dim) ctx.globalAlpha = 0.5;
    const sel = r.sel, prim = r.primary, rad = Math.min(18, r.h * 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 6, r.w, r.h, rad); ctx.fill();
    const gr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (prim || (sel && r.chip)) { gr.addColorStop(0, '#f6d987'); gr.addColorStop(1, '#c48a26'); } else if (sel) { gr.addColorStop(0, '#5d9a55'); gr.addColorStop(1, '#2f6b35'); } else { gr.addColorStop(0, '#7a4a24'); gr.addColorStop(1, '#43240f'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,170,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    let size = (r.size ?? (r.chip ? 27 : 30)) * (big ? 1.12 : 1);
    const dark = prim || (sel && r.chip), col = dark ? '#2a1606' : '#f6dfae';
    if (r.toggle) {
      size = Math.min(size, fitSize(r.label + '   ' + r.value, size, r.w - 56));
      text(r.label, r.x + 28, r.y + r.h / 2 + size * 0.35, size, col, UI, 700, 'left'); text(r.value, r.x + r.w - 28, r.y + r.h / 2 + size * 0.35, size, r.sel ? '#d9ffc8' : '#e8b7a4', UI, 700, 'right');
    } else if (r.left) {
      size = Math.min(size * 0.95, fitSize(r.label, size * 0.95, r.w - 48 - (r.locked ? 110 : 60)));
      text(r.label, r.x + 24, r.y + r.h / 2 + size * 0.35, size, col, UI, 700, 'left');
      const k = Math.min(1, r.h / 82), cy = r.y + r.h / 2;
      if (r.locked) text('full game', r.x + r.w - 22, cy + 8, 22, '#e8b7a4', UI, 600, 'right');
      else if (r.done) { ctx.strokeStyle = '#a6f0a0'; ctx.lineWidth = 6 * k; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(r.x + r.w - 62 * k, cy); ctx.lineTo(r.x + r.w - 46 * k, cy + 16 * k); ctx.lineTo(r.x + r.w - 20 * k, cy - 16 * k); ctx.stroke(); }
    } else { size = Math.min(size, fitSize(r.label, size, r.w - 20)); text(r.label, r.x + r.w / 2, r.y + r.h / 2 + size * 0.35, size, col, UI, 700); }
    ctx.restore();
  };
  const plaque = (x, y, w, h) => {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
    const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#3b2213'); gr.addColorStop(1, '#1e0f07');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.fill(); ctx.restore();
    ctx.strokeStyle = '#c9982f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,225,150,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x + 6, y + 6, w - 12, h - 12, 11); ctx.stroke();
  };
  const scrim = (a = 0.62) => { ctx.fillStyle = `rgba(12,5,2,${a})`; ctx.fillRect(0, 0, W, H); };
  const buttonsNow = () => { for (const b of screenButtons(state)) button(b); };
  const O = overlayGeo(state);

  // ---- ground --------------------------------------------------------------------------------------
  const savedBoard = isTitle ? { ...BOARD } : null;
  if (isTitle) Object.assign(BOARD, L.title.board(has));
  const noBoard = isTitle && BOARD.S <= 1;
  if (panelScene || noBoard) drawFloorOnly(ctx); else drawStatic(ctx, mode, isTitle ? 'title' : '', !isTitle);
  motes(ctx, T);

  if (boardScene && !noBoard) {
    drawYards(ctx, state, text, mode);
    drawPieces(ctx, state);
    if (!isTitle) drawCowries(ctx, state, text);
  }
  if (savedBoard) Object.assign(BOARD, savedBoard);

  // ---- header + message ------------------------------------------------------------------------------
  const play = sc === 'play' || sc === 'lesson' || sc === 'daily' || sc === 'pass' || sc === 'over' || sc === 'autoplay' || sc === 'autoplay-over';
  if (play) {
    const hk = L.head.size / 68, hx = L.col ? L.col.x + L.col.w / 2 : L.cx, hw = (L.col ? L.col.w : L.w) - 40;
    if (sc === 'lesson' && state.lesson) shadowText(`Lesson ${state.lesson.i + 1} of ${LESSONS.length}: ${LESSONS[state.lesson.i].title}`, hx, L.head.y - 8 * hk, (big ? 36 : 40) * hk, '#f6dfae', FONT, 'center', hw);
    else if (sc === 'daily') shadowText(`Daily race  ·  score ${state.dl ? state.dl.score : 0}`, hx, L.head.y - 8 * hk, 46 * hk, '#f6dfae', FONT, 'center', hw);
    else if (sc === 'autoplay' || sc === 'autoplay-over') shadowText('Auto Play · Watch & Learn', hx, L.head.y - 8 * hk, 36 * hk, '#f6dfae', FONT, 'center', hw);
    else shadowText('Pachisi', hx, L.head.y, L.head.size, '#f6dfae');
    const Pq = L.plaque; plaque(Pq.x, Pq.y, Pq.w, Pq.h);
    const msg = state.apPaused && sc === 'autoplay' ? 'Paused. Tap Resume to carry on watching.' : state.msg || '';
    fitWrap(msg, Pq.x + Pq.w / 2, Pq.y + 4, Pq.w - 56, Pq.h - 8, big ? 34 : 29, minSz, '#fff2d0');
    if (L.card && sc !== 'pass' && sc !== 'over' && sc !== 'autoplay-over') drawCard(ctx, state, text, plaque);
  }

  if (isTitle) { drawTitle(ctx, state, text, shadowText); buttonsNow(); }

  if (boardScene && play && sc !== 'over' && sc !== 'pass' && sc !== 'autoplay-over') {
    drawMedallion(ctx, state, text);
    if (!state.menuOpen && !(sc === 'lesson' && state.lesson?.complete) && !(sc === 'daily' && state.dl?.finished)) buttonsNow();
  }

  // ---- panels --------------------------------------------------------------------------------------
  if (panelScene) {
    const P = L.panel;
    drawPanel(ctx, P.x, P.y, P.w, P.h);
    edgeStroke(ctx, { x: P.x + 3, y: P.y + 3, w: P.w - 6, h: P.h - 6 }, 20, 0.28);
    const readerPage = sc === 'how' || sc === 'about' || sc === 'rules';
    const rg = readerPage ? readerGeo(state) : null, cxP = P.x + P.w / 2, wide = L.panelWide;
    // The reference-page header is capped well below the body-text scale (same cap as the old top step, 1.3x). Beside the host's floating
    // back button the title must also stay clear of it.
    const hdr = sc === 'setup' ? 'Set up a game' : sc === 'learn' ? 'Learn to play' : sc === 'settings' ? 'Settings' : sc === 'how' ? 'How to Play' : sc === 'about' ? 'About' : sc === 'rules' ? 'Rules' : 'Thank you for playing';
    const tSize = rg ? Math.round(rg.titleSize * Math.min(textScale, 1.3)) : wide ? 54 : 66, tY = rg ? rg.titleY : P.y + (wide ? 62 : 78);
    const clear = L.ins.back ? Math.max(0, L.backBox.x + L.backBox.w - P.x) : 0;
    ctxTitle(ctx, text, hdr, tY, tSize, cxP, P.w - 96 - Math.max(0, 2 * (clear - 16)));
    if (sc === 'setup') {
      const G = setupGeo(state);
      for (const l of G.labels) text(l.text, l.x, l.y, l.size * (big ? 1.1 : 1), INK, UI, 700, 'left');
      for (const t of G.texts) wrap(t.str, t.x, t.y, t.size * (big && t.color === 'ink' ? 1.1 : 1), t.w, t.color === 'ink' ? INK : '#7a1a20', t.lh, t.left ? 'left' : 'center');
    } else if (sc === 'learn') {
      const G = learnGeo(state);
      wrap('Nine short lessons. You make every move yourself; nothing is skipped until you do it.', cxP, G.introY, 24, Math.min(560, P.w - 80), INK, 30);
    } else if (sc === 'settings') {
      const G = settingsGeo(state);
      wrap('Every pawn colour also has its own shape: ball, spire, crown, cube.', cxP, G.textY, 24, Math.min(560, P.w - 80), INK, 32);
      wrap('Progress is kept on this device.', cxP, G.textY + 62, 22, Math.min(560, P.w - 80), '#7a1a20', 30);
    } else if (readerPage) {
      const pages = sc === 'how' ? HOW_PAGES : sc === 'about' ? ABOUT_PAGES : RULES_PAGES;
      const sz = Math.round(28 * textScale * (big ? 1.06 : 1)), lh = Math.round(sz * 1.4), gap = Math.round((sc === 'rules' ? 18 : 22) * textScale), Rg = rg.region;
      const hs = Math.round(34 * Math.min(textScale, 1.6)), top0 = Math.max((wide ? 16 : 28) + (textScale - 1) * 14, 0.82 * sz);
      // ONE scrolling document: every authored page in order, a heading wherever the section changes, the art where a page carries it.
      // Wrapped lines + total height are laid out once per (scene, text size, width, font) and reused; a frame draws only the visible slice.
      ctx.font = `800 40px ${UI}`; const fk1 = ctx.measureText('Hamburgefonstiv').width;   // changes when a web font finishes loading
      ctx.font = `800 40px ${FONT}`; const fk2 = ctx.measureText('Hamburgefonstiv').width;
      const rkey = [sc, sz, hs, gap, top0, Rg.w, fk1, fk2].join('|');
      if (readerCache.key !== rkey) {
        readerStats.layouts++;
        const items = []; let y = top0 - Math.round(sz * 0.3), prev = null;
        for (const page of pages) {
          if (page[0] !== prev) { prev = page[0]; if (items.length) y += Math.round(gap * 0.8); wrapLines(page[0], Rg.w, hs).forEach((hl, i) => items.push({ k: 'h', s: hl, y: y + hs * 0.8 + i * hs * 1.1 })); y += Math.round(hs * 1.25) + Math.round((wrapLines(page[0], Rg.w, hs).length - 1) * hs * 1.1) + Math.round(sz * 0.35); }   // the first body line's capitals rise 0.25 body-sizes above its start: leave room under the heading at every text size
          if (sc === 'rules' && page[2]) { items.push({ k: 'art', a: page[2], y: y + 95 }); y += RULES_ART_H + Math.round(sz * 0.3); }
          for (const para of page[1]) { const ln = wrapLines(para, Rg.w, sz); ln.forEach((t2, i) => items.push({ k: 'l', s: t2, y: y + Math.round(sz * 0.5) + i * lh })); y += ln.length * lh + gap; }
        }
        readerCache.key = rkey; readerCache.sz = sz; readerCache.hs = hs; readerCache.items = items; readerCache.total = y - gap + sz * 0.6;
      }
      const items = readerCache.items;
      const total = readerCache.total, scrollMax = Math.max(0, total - Rg.h);
      state.scrollMax = scrollMax;
      const scroll = Math.min(Math.max(state.scroll || 0, 0), scrollMax); state.scroll = scroll;
      ctx.save(); ctx.beginPath(); ctx.rect(Rg.x - 14, Rg.y, Rg.w + 28, Rg.h); ctx.clip(); ctx.translate(0, Rg.y - scroll);
      for (const it of items) {
        if (it.y - scroll < -260 || it.y - scroll > Rg.h + 80) continue;
        if (it.k === 'h') text(it.s, Rg.x, it.y, hs, '#8e1b22', FONT, 700, 'left');
        else if (it.k === 'l') text(it.s, Rg.x, it.y, sz, INK, UI, 600, 'left');
        else drawRulesArt(ctx, it.a, T, cxP, it.y);
      }
      ctx.restore();
      if (scrollMax > 0) { // a slim scroll bar on the right of the page
        const bx = P.x + P.w - 30, th = Math.max(36, Rg.h * Rg.h / total), ty = Rg.y + (Rg.h - th) * (scroll / scrollMax);
        ctx.save(); ctx.fillStyle = 'rgba(120,28,32,0.18)'; ctx.beginPath(); ctx.roundRect(bx, Rg.y, 6, Rg.h, 3); ctx.fill(); ctx.fillStyle = 'rgba(142,27,34,0.75)'; ctx.beginPath(); ctx.roundRect(bx, ty, 6, th, 3); ctx.fill(); ctx.restore();
      }
      if (scrollMax > 0) text(`${Math.round(100 * scroll / scrollMax)}%`, rg.counterX, rg.counterY, 22, '#7a1a20', UI, 600);
    } else if (sc === 'demo-limit') {
      const tw = Math.min(540, P.w - 108);
      wrap('That is the end of the free web preview. Get Pachisi on iPhone and Android for unlimited games, all nine lessons, the daily race and every setting.', cxP, P.y + (wide ? 150 : 282), wide ? 28 : 32, tw, INK, wide ? 38 : 44);
      pawnRow(ctx, cxP, P.y + (wide ? Math.min(P.h * 0.6, 430) : 782));
    }
    buttonsNow();
  }

  // ---- overlays --------------------------------------------------------------------------------------
  if (state.menuOpen && !panelScene) { scrim(0.6); const P = O.pause; drawPanel(ctx, P.x, P.y, P.w, P.h); ctxTitle(ctx, text, 'Paused', P.y + 75, 60, P.x + P.w / 2, P.w - 60); buttonsNow(); }
  if (sc === 'lesson' && state.lesson?.complete) { const P = O.lesson; plate(ctx, P.x, P.y, P.w, P.h); text('Lesson complete', P.x + P.w / 2, P.y + 46, 40, '#f6dfae', FONT); buttonsNow(); }
  if (sc === 'daily' && state.dl?.finished) drawDailyDone(ctx, state, text, wrap, buttonsNow, O.daily);
  if (sc === 'over' || sc === 'autoplay-over') drawOver(ctx, state, text, buttonsNow, scrim, O.over);
  if (sc === 'pass') {
    scrim(0.72); const { c, P } = O.pass; drawPanel(ctx, P.x, P.y, P.w, P.h);
    const p = state.pass ? g.players[state.pass.pl] : g.players[g.turn], arm = p.arm, mx = P.x + P.w / 2;
    ctxTitle(ctx, text, 'Pass the phone to', P.y + 80 * c, 56, mx, P.w - 60);
    drawPawn(ctx, arm, mx, P.y + 280 * c, 2.6 * Math.min(1, c + 0.1), Math.sin(T * 3) * 6);
    text(p.name, mx, P.y + 380 * c, 66, INK, FONT, 700);
    wrap(`${COLOUR_NAMES[arm]} pawns. Hand the phone over, then TAP the button.`, mx, P.y + 430 * c, 24, 480, '#7a1a20', 32);
    buttonsNow();
  }

  // a soft lamp flicker over everything
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.05 + 0.02 * Math.sin(T * 7.3) + 0.015 * Math.sin(T * 11.9 + 1);
  const gr = ctx.createRadialGradient(90, 120, 10, 90, 120, 800); gr.addColorStop(0, 'rgba(255,170,70,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, Math.min(H, 900)); ctx.restore();
}

function ctxTitle(ctx, text, str, y, size, cx, maxW) {
  // Shrink-to-fit: a long page title (Rules/About/How to play headings) must never run off either
  // edge of the panel, however large the requested display size is.
  let s = size;
  ctx.font = `700 ${s}px ${FONT}`;
  while (s > 30 && ctx.measureText(str).width > maxW) { s -= 2; ctx.font = `700 ${s}px ${FONT}`; }
  text2(ctx, str, cx, y, s, '#7a1a20', FONT);
}
function text2(ctx, str, x, y, size, color, font, align = 'center') { ctx.textAlign = align; ctx.font = `700 ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); }
function plate(ctx, x, y, w, h) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 20; ctx.fillStyle = 'rgba(28,14,8,0.97)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 20); ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#c9982f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x, y, w, h, 20); ctx.stroke();
}

// warm dust drifting in the lamp light
function motes(ctx, T) {
  ctx.save();
  for (let i = 0; i < 16; i++) {
    const s = i * 97.3, x = (s * 7.7 + Math.sin(T * 0.3 + i) * 30 + T * (4 + (i % 4))) % W, y = (H - ((s * 13.1 + T * (10 + (i % 5) * 3)) % H)), a = 0.10 + 0.08 * Math.sin(T * 1.7 + i * 2);
    ctx.globalAlpha = a; ctx.fillStyle = '#ffdca0'; ctx.beginPath(); ctx.arc(x, y, 1.6 + (i % 3) * 0.8, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function pawnRow(ctx, cx, y) { for (let a = 0; a < 4; a++) drawPawn(ctx, a, cx - 150 + a * 100, y, 1.8, 0); }

// ---- Rules page art: real in-game sprites, drawn in isolation on the reference panel -----------------
const RULES_ART_H = 190;
function swatch(ctx, x, y, s, fill) { ctx.save(); ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x - s / 2, y - s / 2, s, s, 8); ctx.fill(); ctx.strokeStyle = 'rgba(120,28,32,0.7)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
function drawRulesArt(ctx, kind, T, cx, y) {
  if (kind === 'pawns') {
    const xs = [150, 290, 430, 570], names = ['Red', 'Green', 'Gold', 'Indigo'];
    xs.forEach((x, a) => { drawPawn(ctx, a, cx + x - 360, y, 1.7, Math.abs(Math.sin(T * 2 + a)) * 4); ctxSmall(ctx, names[a], cx + x - 360, y + 44); });
  } else if (kind === 'safe') {
    swatch(ctx, cx - 100, y - 20, 84, '#e6bd66'); star(ctx, cx - 100, y - 20, 22, '#8e1b22', 3.5);
    ctxSmall(ctx, 'Safe square', cx - 100, y + 46);
    swatch(ctx, cx + 100, y - 20, 84, ARM_COLOURS[0]); star(ctx, cx + 100, y - 20, 19, '#fbe7b0', 3.5);
    ctxSmall(ctx, 'Start square (also safe)', cx + 100, y + 46);
  } else if (kind === 'block') {
    drawPawn(ctx, 1, cx - 7, y - 2, 1.6, 0); drawPawn(ctx, 1, cx + 7, y + 2, 1.6, 0);
    ctxSmall(ctx, 'Two Green pawns: a block', cx, y + 46);
  } else if (kind === 'cowries') {
    drawCowry(ctx, cx - 90, y - 10, 0.3, Math.PI, 0, 1.7);
    ctxSmall(ctx, 'Mouth up', cx - 90, y + 64);
    drawCowry(ctx, cx + 90, y - 10, -0.2, 0, 0, 1.7);
    ctxSmall(ctx, 'Mouth down', cx + 90, y + 64);
  } else if (kind === 'ludo') {
    drawDie(ctx, cx, y - 10, 0.15, 6, 0, 1.7);
    ctxSmall(ctx, 'A throw of 6', cx, y + 70);
  } else if (kind === 'capture') {
    drawPawn(ctx, 1, cx + 60, y - 30, 1.1, 46, 0.4);
    drawPawn(ctx, 0, cx - 20, y, 1.7, 0);
    ctxSmall(ctx, 'Red lands on Green: Green goes home', cx, y + 46);
  }
}
function ctxSmall(ctx, str, x, y) { ctx.textAlign = 'center'; ctx.font = `600 ${Math.max(20, Math.ceil(11 / (host.px || 0.6)))}px ${UI}`; ctx.fillStyle = '#7a1a20'; ctx.fillText(str, x, y); }

// ---- yards: labels and turn glow ---------------------------------------------------------------------------
function drawYards(ctx, state, text, mode) {
  const g = state.g, cs = cellSize(mode), rad = (geo(mode).R / 2 - 0.5) * cs, T = state.t, z = clamp(Math.max(cs / 30, Math.ceil(11 / (host.px || 0.6)) / 22), 0.62, 1);
  for (let a = 0; a < 4; a++) {
    const pl = g.players.findIndex((p) => p.arm === a), [ux, uy] = yardOffset(mode, a), p = gridXY(mode, ux, uy);
    if (pl < 0) { ctx.fillStyle = 'rgba(15,6,2,0.45)'; ctx.beginPath(); ctx.arc(p.x, p.y, rad * 0.92, 0, TAU); ctx.fill(); continue; }
    const turn = state.scene !== 'title' && g.turn === pl && g.winner < 0;
    if (turn) {
      ctx.save(); ctx.strokeStyle = `rgba(255,224,130,${0.55 + 0.35 * Math.sin(T * 4)})`; ctx.lineWidth = 6; ctx.shadowColor = '#ffd066'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.arc(p.x, p.y, rad * 1.02, 0, TAU); ctx.stroke(); ctx.restore();
    }
    const pw = g.players[pl], label = `${pw.name}`, h = homeCount(g, pl);
    const ly = p.y > BOARD.cy ? p.y + rad + 34 * z : p.y - rad - 18 * z;
    ctx.save(); ctx.fillStyle = 'rgba(20,8,4,0.78)'; ctx.beginPath(); ctx.roundRect(p.x - 84 * z, ly - 28 * z, 168 * z, 46 * z, 23 * z); ctx.fill(); ctx.strokeStyle = ARM_LIGHT[a]; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();
    text(label + ' · ' + h + '/' + g.n, p.x, ly + 2 * z, 22 * z, '#fff2d0', UI, 700);
  }
}

// ---- pawns -----------------------------------------------------------------------------------------------------
function drawPieces(ctx, state) {
  const g = state.g, G = geo(g.mode), T = state.t, list = [], PK = cellSize(g.mode) / 31, Z = BOARD.S / 680;
  const flying = new Set(state.fly.map((f) => f.pl + ',' + f.i)), hop = state.hop;
  // REVEAL (Auto Play): the same destination-ring/selection-glow a human turn uses, shown once the
  // chosen move is picked (state.sel set in game.js's 'apthink' -> 'apreveal' transition), never
  // during 'apthink' itself so THINK still shows a bare board.
  const choose = (state.phase === 'choose' || state.phase === 'apreveal') && state.opts.length && (g.players[g.turn].human || state.scene !== 'play');
  const selMove = choose && state.sel >= 0 ? state.opts.find((o) => o.i === state.sel) : null;
  const froms = choose ? new Set(state.opts.map((o) => o.from)) : new Set();
  const groups = new Map();
  g.pos.forEach((ps, pl) => ps.forEach((p, i) => {
    if (flying.has(pl + ',' + i) || (hop && hop.pl === pl && hop.i === i)) return;
    const s = posXY(g, pl, i, p), onBoard = p >= 0 && p < G.END, key = onBoard ? `${Math.round(s.x)},${Math.round(s.y)}` : `s${pl}_${i}`;
    const it = { pl, i, p, x: s.x, y: s.y, k: PK, n: 1, idx: 0, movable: choose && pl === g.turn && froms.has(p) };
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it); list.push(it);
  }));
  for (const gr of groups.values()) if (gr.length > 1) gr.forEach((it, j) => { const off = (gr.length === 2 ? [-7, 7][j] : (j - (gr.length - 1) / 2) * 8) * Z; it.x += off; it.k = PK * 0.86; it.y += (j % 2 ? 2 : -2) * Z; });
  // destination rings for everything that can move
  if (choose) {
    for (const m of state.opts) {
      const d = posXY(g, m.pl, m.i, m.to), sel = selMove && selMove.i === m.i, pulse = 0.5 + 0.5 * Math.sin(T * 5);
      ctx.save(); ctx.strokeStyle = m.caps.length ? `rgba(255,110,90,${0.7 + 0.3 * pulse})` : `rgba(255,224,130,${sel ? 1 : 0.45 + 0.25 * pulse})`; ctx.lineWidth = sel ? 5 : 3;
      if (!sel) ctx.setLineDash([5, 6]);
      ctx.beginPath(); ctx.ellipse(d.x, d.y + 2 * Z, (17 + pulse * 2) * Z, (12 + pulse) * Z, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
  }
  // pawns, back to front
  list.sort((a, b) => a.y - b.y || a.x - b.x);
  const drawOne = (it) => {
    let lift = 0, x = it.x, y = it.y + 6 * Z;
    if (it.movable) {
      const sel = selMove && selMove.from === it.p && (state.sel === it.i || (it.p < 0));
      ctx.save(); ctx.globalAlpha = 0.5 + 0.3 * Math.sin(T * 5 + it.i); const g2 = ctx.createRadialGradient(x, y, 2, x, y, 26 * Z); g2.addColorStop(0, sel ? 'rgba(255,240,160,1)' : 'rgba(255,214,110,0.95)'); g2.addColorStop(1, 'rgba(255,190,60,0)');
      ctx.fillStyle = g2; ctx.beginPath(); ctx.ellipse(x, y + 2 * Z, 26 * Z, 16 * Z, 0, 0, TAU); ctx.fill(); ctx.restore();
      lift = ((sel ? 9 : 0) + (state.prefs.calm ? 0 : Math.abs(Math.sin(T * 4 + it.i)) * 3)) * Z;
    }
    if (state.shake && state.shake.pl === it.pl && state.shake.i === it.i) x += Math.sin(state.shake.t * 60) * 5 * (1 - state.shake.t / 0.55) * Z;
    drawPawn(ctx, g.players[it.pl].arm, x, y, it.k, lift);
  };
  for (const it of list) drawOne(it);
  // ghost, path and tag for the selected move
  if (selMove) {
    const pts = hopPath(g, selMove.pl, selMove.i, selMove.from, selMove.to), d = pts[pts.length - 1];
    ctx.save(); ctx.strokeStyle = 'rgba(255,236,170,0.75)'; ctx.lineWidth = 3; ctx.setLineDash([2, 8]); ctx.lineCap = 'round'; ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.restore();
    drawPawn(ctx, g.players[selMove.pl].arm, d.x, d.y + 6 * Z, PK, 0, 0.55 + 0.2 * Math.sin(T * 6));
    const tag = selMove.caps.length ? 'Capture!' : selMove.enter ? 'Enter' : selMove.to === G.END ? 'Home!' : (() => { const t = trackIndex(g, selMove.pl, selMove.to); return t != null && G.safe.has(t) ? 'Safe' : ''; })();
    if (tag) { ctx.save(); const tsz = Math.max(20, Math.ceil(11 / (host.px || 0.6))); ctx.font = `700 ${tsz}px ${UI}`; const w = ctx.measureText(tag).width + 22, ty = Math.max(4, d.y - 66 * Z); ctx.fillStyle = selMove.caps.length ? '#b3202a' : '#2d6a35'; ctx.beginPath(); ctx.roundRect(d.x - w / 2, ty, w, 28, 14); ctx.fill(); ctx.strokeStyle = '#fbe7b0'; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(tag, d.x, ty + 21 + (tsz - 20) * 0.5); ctx.restore(); }
  }
  // the hopping pawn
  if (hop) {
    const a = hop.pts[Math.min(hop.seg, hop.n)], b = hop.pts[Math.min(hop.seg + 1, hop.n)], f = hop.seg >= hop.n ? 1 : clamp(hop.t / hop.per, 0, 1), e = ease(f);
    const x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e;
    drawPawn(ctx, g.players[hop.pl].arm, x, y + 6 * Z, PK * (hop.m.enter ? 1.08 : 1.05), Math.sin(Math.PI * f) * (hop.m.enter ? 30 : 16) * Z);
  }
  // captured pawns flying home
  for (const f of state.fly) {
    const u = ease(clamp(f.t / f.dur, 0, 1));
    drawPawn(ctx, g.players[f.pl].arm, f.from.x + (f.to.x - f.from.x) * u, f.from.y + (f.to.y - f.from.y) * u + 6 * Z, PK, (Math.sin(Math.PI * u) * 90 + 6) * Z, 1);
    if (f.t < 0.35) { ctx.save(); ctx.globalAlpha = 1 - f.t / 0.35; ctx.strokeStyle = '#ffdca0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(f.from.x, f.from.y, (14 + f.t * 90) * Z, 0, TAU); ctx.stroke(); ctx.restore(); }
  }
}

// ---- cowries / die -------------------------------------------------------------------------------------------
// Items keep their landing spot as a spot index plus a jitter (fractions), so a mid-throw rotation re-lays them on the live rug.
export function throwItemXY(it, G, die, k) {
  const sp = die ? G.dieXY : G.spots[it.spot ?? k], zk = G.k / 1.3;
  return { x0: G.cx - 60 + (die ? 60 : k * 24), y0: MAT.y + MAT.h + 140, tx: sp[0] + (it.jx || 0) * 50 * zk, ty: sp[1] + (it.jy || 0) * 22 * zk };
}
function drawCowries(ctx, state, text) {
  const R = state.roll, T = state.t, g = state.g, die = g.mode === 'ludo', G = throwGeo();
  const yours = state.phase === 'throw' && (g.players[g.turn].human || state.scene === 'lesson' || state.scene === 'daily') && state.scene !== 'pass';
  if (yours) { // a soft glow calls for the throw
    ctx.save(); const pulse = 0.5 + 0.5 * Math.sin(T * 4); const gl = G.glow, gr = ctx.createRadialGradient(gl.cx, gl.cy, 20, gl.cx, gl.cy, gl.rx); gr.addColorStop(0, `rgba(255,214,110,${0.25 + 0.2 * pulse})`); gr.addColorStop(1, 'rgba(255,190,60,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(gl.cx, gl.cy, gl.rx, gl.ry, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  if (!R) {
    // resting shells, waiting to be thrown
    if (die) drawDie(ctx, G.dieXY[0], G.dieXY[1], 0.3, 5, 0, G.dieK);
    else G.spots.forEach(([x, y], k) => drawCowry(ctx, x + (k % 2) * 6 - 3, y + Math.sin(T * 2 + k) * 1.5, k * 1.1 + 0.3, k * 0.4, 0, G.k));
  } else {
    const rolling = state.phase === 'roll';
    R.items.forEach((it, k) => {
      const P = throwItemXY(it, G, die, k), D = R.dur - 0.28, u = rolling ? clamp((R.t - it.dl) / D, 0, 1) : 1;
      const e1 = ease(clamp(u / 0.72, 0, 1)), x = P.x0 + (P.tx - P.x0) * e1, y = P.y0 + (P.ty - P.y0) * e1;
      const bounce = (a, b, h) => (u > a && u < b ? h * 4 * ((u - a) / (b - a)) * (1 - (u - a) / (b - a)) : 0);
      let z = u < 0.72 ? 190 * 4 * (u / 0.72) * (1 - u / 0.72) : bounce(0.72, 0.88, 26) + bounce(0.88, 1, 8);
      if (state.prefs.calm) z = 0;
      const rot = it.r0 + (it.r1 - it.r0) * (1 - (1 - u) * (1 - u)), phiEnd = Math.PI * (2 * it.flips + (it.mouth ? 1 : 0)), phi = phiEnd * (1 - Math.pow(1 - clamp(u / 0.85, 0, 1), 2));
      if (die) { const face = u < 0.85 ? ((Math.floor(R.t * 16) + it.face0) % 6) + 1 : R.value; drawDie(ctx, x, y, rot, face, z * (G.k / 1.3), G.dieK * 0.96); }
      else drawCowry(ctx, x, y, rot, phi, z * (G.k / 1.3), G.k);
    });
  }
  // swipe / tap hint
  if (yours) {
    const a = 0.5 + 0.5 * Math.sin(T * 5), p = G.pill, y = G.pillY, str = die ? 'TAP the die to throw' : 'TAP or SWIPE the cowries to throw';
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4; ctx.fillStyle = 'rgba(28,14,8,0.92)'; ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 31); ctx.fill(); ctx.restore();
    ctx.strokeStyle = `rgba(255,224,130,${0.6 + 0.4 * a})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 31); ctx.stroke();
    let sz = 25; ctx.font = `700 ${sz}px ${UI}`; while (sz > 16 && ctx.measureText(str).width > p.w - 36) { sz -= 1; ctx.font = `700 ${sz}px ${UI}`; }
    text(str, G.cx, y + 8, sz, '#fff2d0', UI, 700);
    if (G.arrowY != null) {
      ctx.strokeStyle = `rgba(255,236,170,${0.4 + 0.5 * a})`; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const cy = G.arrowY - a * 8; ctx.beginPath(); ctx.moveTo(G.cx - 20, cy + 9); ctx.lineTo(G.cx, cy - 3); ctx.lineTo(G.cx + 20, cy + 9); ctx.stroke();
    }
    ctx.restore();
  }
}
function drawMedallion(ctx, state, text) {
  const R = state.roll; if (!R || state.phase === 'roll' || state.phase === 'throw') return;
  const v = R.value, G = throwGeo(), p = G.medal, y = G.pillY, left = p.x + 46;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
  ctx.fillStyle = 'rgba(28,14,8,0.92)'; ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 31); ctx.fill(); ctx.restore();
  ctx.strokeStyle = R.grace ? '#ffe28a' : '#c9982f'; ctx.lineWidth = R.grace ? 4 : 3; ctx.beginPath(); ctx.roundRect(p.x, p.y, p.w, p.h, 31); ctx.stroke();
  const g = ctx.createRadialGradient(left, y - 8, 4, left, y - 4, 34); g.addColorStop(0, '#fff0b0'); g.addColorStop(1, '#c48a26');
  ctx.beginPath(); ctx.arc(left, y - 3, 28, 0, TAU); ctx.fillStyle = g; ctx.fill();
  text(String(v), left, y + 9, v > 9 ? 30 : 36, '#3a1c0e', FONT, 700);
  const str = R.die ? (R.grace ? 'Six: throw again' : `You get ${v}`) : (R.grace ? `${R.up} up: grace, throw again` : `${R.up} mouths up`);
  let sz = 24; ctx.font = `700 ${sz}px ${UI}`; while (sz > 16 && ctx.measureText(str).width > p.w - 100) { sz -= 1; ctx.font = `700 ${sz}px ${UI}`; }
  text(str, left + 44 + (p.w - 100) / 2, y + 6, sz, '#f6dfae', UI, 700);
}

// ---- the players card (wide screens only): who is playing, whose turn, how many are home --------------------------------
function drawCard(ctx, state, text, plaque) {
  const C = L.card, g = state.g, T = state.t; if (!C) return;
  plaque(C.x, C.y, C.w, C.h);
  edgeStroke(ctx, { x: C.x + 2, y: C.y + 2, w: C.w - 4, h: C.h - 4 }, 14, 0.4);
  text('Players', C.x + C.w / 2, C.y + 46, 30, '#f6dfae', FONT, 700);
  const n = g.players.length, avail = C.h - 150, pitch = Math.min(112, avail / n), x = C.x + 24;
  g.players.forEach((p, i) => {
    const y = C.y + 70 + i * pitch, turn = g.turn === i && g.winner < 0 && state.scene !== 'lesson' && state.scene !== 'daily';
    ctx.save(); ctx.fillStyle = turn ? 'rgba(255,214,110,0.16)' : 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.roundRect(x - 8, y, C.w - 32, pitch - 10, 14); ctx.fill();
    ctx.strokeStyle = turn ? `rgba(255,224,130,${0.6 + 0.3 * Math.sin(T * 4)})` : ARM_LIGHT[p.arm]; ctx.lineWidth = turn ? 3 : 2; ctx.stroke(); ctx.restore();
    drawPawn(ctx, p.arm, x + 36, y + pitch * 0.62, 1.15, 0);
    text(p.name, x + 76, y + pitch * 0.4, 25, '#fff2d0', UI, 700, 'left');
    text(`${homeCount(g, i)} of ${g.n} home`, x + 76, y + pitch * 0.4 + 28, 21, '#e8c98a', UI, 600, 'left');
  });
  drawBadgeStack(ctx, C.x + C.w / 2, C.y + C.h - 14, Math.min(150, C.w - 80));
}

// ---- title ----------------------------------------------------------------------------------------------------------
function drawTitle(ctx, state, text, shadowText) {
  const T = state.t, Tt = L.title, has = !!state.saved, cx = L.col ? L.col.x + L.col.w / 2 : L.cx, half = Math.min(210, (L.col ? L.col.w : L.w) / 2 - 36);
  ctx.save(); ctx.shadowColor = 'rgba(255,190,80,0.6)'; ctx.shadowBlur = 30 + 8 * Math.sin(T * 2);
  text('Pachisi', cx, Tt.y, Tt.size, '#f8e3a8', FONT, 700); ctx.restore();
  shadowText('The royal race of the cross', cx, Tt.tagY, Tt.tagSize, '#f0c56a', FONT);
  ctx.save(); ctx.strokeStyle = '#c9982f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - half, Tt.orn); ctx.lineTo(cx + half, Tt.orn); ctx.stroke();
  for (const x of [cx - half, cx, cx + half]) { ctx.beginPath(); ctx.moveTo(x, Tt.orn - 8); ctx.lineTo(x + 8, Tt.orn); ctx.lineTo(x, Tt.orn + 8); ctx.lineTo(x - 8, Tt.orn); ctx.closePath(); ctx.fillStyle = '#e0b04a'; ctx.fill(); } ctx.restore();
  drawLockupImage(ctx, Tt.lock.cx, Tt.lock.y, Tt.lock.h, 0.9, (state.afFlash || 0) > 0);   // the Arcforge credit in this game's colours, bottom-centre under the menu
  const G = titleGeo(state), P = G.plate;
  plate(ctx, P.x, P.y, P.w, P.h);
  const s = state.stats; text(s.played ? `${s.played} played · ${s.wins} won` : 'Free preview: 5 minutes of play', P.x + P.w / 2, G.footY, 22, '#c9a86a', UI, 600);
  void has;
}

// ---- end screens ----------------------------------------------------------------------------------------------------
function drawOver(ctx, state, text, buttonsNow, scrim, OG) {
  const o = state.over, g = state.g, T = state.t; if (!o) return;
  scrim(0.66);
  for (let i = 0; i < 46; i++) { // gold petals
    const r = lcg(i * 7919 + 3), x = r() * W, sp = 60 + r() * 120, y = ((T * sp + r() * H) % (H + 40)) - 20, rot = T * (1 + r() * 2) + i;
    ctx.save(); ctx.translate(x + Math.sin(T + i) * 20, y); ctx.rotate(rot); ctx.fillStyle = [ '#f3cc59', '#e0525a', '#f6e8c0', '#5fb072', '#6577c4'][i % 5]; ctx.globalAlpha = 0.85; ctx.fillRect(-5, -3, 10, 6); ctx.restore();
  }
  const P = OG.P, w = g.players[o.winner], c = OG.c || 1, msg = o.youWon ? 'You win!' : `${w.name} wins!`;
  drawPanel(ctx, P.x, P.y, P.w, P.h);
  edgeStroke(ctx, { x: P.x + 3, y: P.y + 3, w: P.w - 6, h: P.h - 6 }, 20, 0.28);
  if (OG.wide) {
    const lx = P.x + 200;
    drawPawn(ctx, w.arm, lx, P.y + 190, 3.0, Math.abs(Math.sin(T * 3)) * 22);
    let sz = 70; ctx.font = `700 ${sz}px ${FONT}`; while (sz > 36 && ctx.measureText(msg).width > 340) { sz -= 2; ctx.font = `700 ${sz}px ${FONT}`; }
    text(msg, lx, P.y + 300, sz, '#7a1a20', FONT, 700);
    let y = P.y + 100; const rx = P.x + 410;
    o.rank.forEach((r, k) => { const p = g.players[r.pl]; drawPawn(ctx, p.arm, rx, y + 8, 0.9, 0); text(`${k + 1}.  ${p.name}`, rx + 40, y - 4, 27, INK, UI, 700, 'left'); text(`${r.home} of ${g.n} home`, P.x + P.w - 40, y - 4, 24, '#7a1a20', UI, 600, 'right'); y += 52; });
    drawMoreLine(ctx, P.x + P.w / 2, P.y + P.h - 26, Math.max(19, Math.ceil(11 / (host.px || 0.6))));
  } else {
    const mx = P.x + P.w / 2;
    drawPawn(ctx, w.arm, mx, P.y + 240 * c, 3.2 * Math.min(1, c + 0.12), Math.abs(Math.sin(T * 3)) * 22);
    text(msg, mx, P.y + 350 * c, 78 * Math.min(1, c + 0.1), '#7a1a20', FONT, 700);
    let y = P.y + 430 * c;
    o.rank.forEach((r, k) => { const p = g.players[r.pl]; drawPawn(ctx, p.arm, P.x + 90, y + 8, 0.9, 0); text(`${k + 1}.  ${p.name}`, P.x + 130, y - 4, 27, INK, UI, 700, 'left'); text(`${r.home} of ${g.n} home`, P.x + P.w - 40, y - 4, 24, '#7a1a20', UI, 600, 'right'); y += 58 * c; });
    drawMoreLine(ctx, mx, P.y + P.h - 38, Math.max(19, Math.ceil(11 / (host.px || 0.6))));
  }
  buttonsNow();
}
function drawDailyDone(ctx, state, text, wrap, buttonsNow, DG) {
  const D = state.dl, s = state.stats, P = DG.P, c = DG.c || 1, mx = P.x + P.w / 2; plate(ctx, P.x, P.y, P.w, P.h);
  const star3 = (px, py, k) => { ctx.save(); ctx.translate(px, py); ctx.beginPath(); for (let j = 0; j < 10; j++) { const r = (j % 2 ? 22 : 50) * k, a = -Math.PI / 2 + j * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); return ctx; };
  const detail = `${D.caps} capture${D.caps === 1 ? '' : 's'}, ${D.homes} pawn${D.homes === 1 ? '' : 's'} home. Streak: ${s.streak} day${s.streak === 1 ? '' : 's'}. A new race tomorrow.`;
  if (DG.wide) {
    text('Daily race complete', mx, P.y + 64, 50, '#f6dfae', FONT);
    text(`Your score ${D.score}`, mx, P.y + 128, 44, '#fff2d0', UI, 700);
    text(`Best possible today: ${D.best}`, mx, P.y + 168, 28, '#f0c56a', UI, 600);
    for (let k = 0; k < 3; k++) { const q = star3(mx - 110 + k * 110, P.y + 250, 0.8); q.fillStyle = k < D.stars ? '#f6d045' : 'rgba(255,255,255,0.14)'; q.fill(); q.strokeStyle = '#c9982f'; q.lineWidth = 3; q.stroke(); q.restore(); }
    wrap(detail, mx, P.y + 350, 26, P.w - 120, '#f6dfae', 34);
  } else {
    text('Daily race complete', mx, P.y + 72 * c, 50, '#f6dfae', FONT);
    text(`Your score ${D.score}`, mx, P.y + 160 * c, 46, '#fff2d0', UI, 700);
    text(`Best possible today: ${D.best}`, mx, P.y + 208 * c, 28, '#f0c56a', UI, 600);
    for (let k = 0; k < 3; k++) { const q = star3(mx - 130 + k * 130, P.y + 300 * c, Math.min(1, c + 0.1)); q.fillStyle = k < D.stars ? '#f6d045' : 'rgba(255,255,255,0.14)'; q.fill(); q.strokeStyle = '#c9982f'; q.lineWidth = 3; q.stroke(); q.restore(); }
    wrap(detail, mx, P.y + 420 * c, 26, Math.min(560, P.w - 88), '#f6dfae', 34);
  }
  buttonsNow();
}
