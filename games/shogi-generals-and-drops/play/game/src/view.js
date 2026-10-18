// Everything drawn each frame. Reads `state` (game.js) and changes nothing. The table, the stands, the board and
// every piece are cached sprites/layers (art.js, pieces.js), so a frame is cheap. All positions come from the live
// layout (layout.js `layoutFor`), so one drawing path serves every phone and tablet in portrait and landscape.
import { sqCenter, STAND_ORDER, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { drawTable, drawBoard, drawStand } from './art.js';
import { drawPiece, fontReady, JP } from './pieces.js';
import { LETTER, NAME, base, mFrom, mTo, isDrop, mDrop, inCheck } from './rules.js';
import { LEVELS } from './engine.js';
import { LESSONS } from './lessons.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { titleGeom } from './ui.js';
import { drawLockup, drawMoreLine } from './brand.js';

const DISPLAY = '"Cormorant Garamond", "Noto Serif JP", Georgia, "Times New Roman", serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Serif JP", sans-serif';
const TAU = Math.PI * 2, GOLD = '#f2d590', PAPER = '#f7ecd2', VERMILION = '#c0392b';
const RANKS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const PIECE_SCALE = 0.48;          // master sprite scale on a 68-point cell
const ease = (f) => f * f * (3 - 2 * f);

// The Rules/How to play/About body scrolls when it does not fit; game.js reads these to clamp the offset and to hit-test drags.
export const readerMetrics = { max: 0, view: 0, vp: null };

// Consecutive content entries with the same heading are one section of the continuous reader.
const sectionCache = new Map();
export function readerSections(list) {
  if (sectionCache.has(list)) return sectionCache.get(list);
  const out = [];
  for (const e of list) {
    const last = out[out.length - 1];
    if (last && last.title === e.title) { last.lines.push(...e.lines); if (e.piece !== undefined && last.piece === undefined) last.piece = e.piece; }
    else out.push({ title: e.title, lines: e.lines.slice(), piece: e.piece });
  }
  sectionCache.set(list, out);
  return out;
}
const wrapCache = new Map();
export function render(ctx, state, h) {
  const { L, B, flip, bottomSide, buttons } = h, G = B ? B.g : null;
  const t = state.t, calm = state.prefs.calm, big = state.prefs.big ? 1.16 : 1;
  const T = calm ? 0 : t;                       // ambient time (frozen when motion is reduced)
  const lang = state.prefs.lang === 'en' ? 'en' : 'jp';
  const minU = L.minU;                          // smallest type (units) that is still ~11 css px
  // In English mode the piece already shows the Western letter as its primary glyph, so the small helper
  // overlay ("Western letters on pieces") only applies in 日本語 mode, where it sits under the kanji.
  const pieceOpts = (tt) => ({ label: lang === 'jp' && state.prefs.labels ? LETTER[tt] : undefined, lang });
  fontReady(ctx);

  const text = (str, x, y, size, color = PAPER, font = UI, weight = 600, align = 'center') => { ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(str, x, y); };
  // one line that shrinks until it fits maxW
  const fitLine = (str, x, y, size, maxW, color = PAPER, font = DISPLAY, weight = 700, align = 'center') => {
    let s = size; ctx.font = `${weight} ${s}px ${font}`;
    while (ctx.measureText(str).width > maxW && s > 14) { s -= 1; ctx.font = `${weight} ${s}px ${font}`; }
    text(str, x, y, s, color, font, weight, align); return s;
  };
  const wrapLines = (str, maxW, size, font, weight) => {
    const key = `${str}|${Math.round(maxW)}|${size}|${font}|${weight}`;
    let r = wrapCache.get(key);
    if (r) return r;
    ctx.font = `${weight} ${size}px ${font}`;
    const words = str.split(' '), lines = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
    lines.push(cur); wrapCache.set(key, lines); if (wrapCache.size > 600) wrapCache.clear();
    return lines;
  };
  // wrap into a box, shrinking the type until it fits (never below the ~11 css px floor)
  const fitText = (str, x, y, maxW, maxH, size, color = PAPER, align = 'center', font = UI, weight = 500) => {
    const floor = Math.min(size, Math.max(15, minU)); let s = size, lines = wrapLines(str, maxW, s, font, weight);
    while (lines.length * s * 1.28 > maxH && s > floor) { s -= 1; lines = wrapLines(str, maxW, s, font, weight); }
    lines.forEach((ln, i) => text(ln, x, y + s + i * s * 1.28, s, color, font, weight, align));
    return lines.length * s * 1.28;
  };
  const panel = (x, y, w, hh, alpha = 0.78, r = 20) => {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.beginPath(); ctx.roundRect(x, y, w, hh, r); ctx.fillStyle = `rgba(22,13,7,${alpha})`; ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(242,213,144,0.5)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.roundRect(x + 0.8, y + 0.8, w - 1.6, hh - 1.6, r); ctx.stroke();
  };
  const button = (b) => {
    ctx.save();
    if (b.dim) ctx.globalAlpha = 0.45;
    const rad = Math.min(18, b.h * 0.2), pk = Math.min(1, b.h / 84);
    ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.roundRect(b.x + 2, b.y + 7, b.w, b.h, rad); ctx.fill();
    const primary = b.primary, sel = b.toggle || b.pill;
    const gr = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    if (primary) { gr.addColorStop(0, '#d7473a'); gr.addColorStop(1, '#8b1a12'); }
    else if (sel) { gr.addColorStop(0, '#9a6a2c'); gr.addColorStop(1, '#5e3c14'); }
    else { gr.addColorStop(0, '#5f4127'); gr.addColorStop(1, '#33200f'); }
    ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, rad); ctx.fill();
    ctx.strokeStyle = primary ? 'rgba(255,214,150,0.85)' : sel ? 'rgba(255,224,150,0.9)' : 'rgba(242,213,144,0.45)'; ctx.lineWidth = primary || sel ? 2.4 : 1.6;
    ctx.beginPath(); ctx.roundRect(b.x + 0.8, b.y + 0.8, b.w - 1.6, b.h - 1.6, rad - 1); ctx.stroke();
    const size = Math.min((b.small ? 26 : b.tile ? 27 : 34) * (b.tile ? 1 : big > 1 ? 1.08 : 1), b.h * 0.42);
    const reserve = b.pill !== undefined ? 130 * pk + 20 : 34;
    ctx.font = `700 ${size}px ${DISPLAY}`;
    let sz = size; while (ctx.measureText(b.label).width > b.w - reserve && sz > 15) { sz -= 1; ctx.font = `700 ${sz}px ${DISPLAY}`; }
    text(b.label, b.x + (b.w - (b.pill !== undefined ? 120 * pk : 0)) / 2 + (b.pill !== undefined ? 6 : 0), b.y + b.h / 2 + sz * 0.3, sz, primary ? '#fff2d8' : PAPER, DISPLAY, 700, 'center');
    if (b.pill !== undefined) {
      const pw = 84 * pk, ph = 40 * pk, px = b.x + b.w - pw - 32 * pk, py = b.y + b.h / 2 - ph / 2;
      ctx.fillStyle = b.pill ? '#2f7a45' : '#3a2a1a'; ctx.beginPath(); ctx.roundRect(px, py, pw, ph, ph / 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,230,170,0.6)'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = b.pill ? '#e9ffd8' : '#a98d68'; ctx.beginPath(); ctx.arc(b.pill ? px + pw - 22 * pk : px + 22 * pk, py + ph / 2, 15 * pk, 0, TAU); ctx.fill();
    }
    if (b.stars) { for (let i = 0; i < b.stars; i++) { ctx.fillStyle = b.toggle ? '#ffe9a8' : 'rgba(242,213,144,0.55)'; ctx.beginPath(); ctx.arc(b.x + 30 + i * 20, b.y + b.h - Math.max(10, 18 * pk), 5.5, 0, TAU); ctx.fill(); } }
    if (b.done) { ctx.strokeStyle = '#9be27a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(b.x + b.w - 40, b.y + 22 * pk); ctx.lineTo(b.x + b.w - 30, b.y + 34 * pk); ctx.lineTo(b.x + b.w - 14, b.y + 12 * pk); ctx.stroke(); }
    ctx.restore();
  };
  const drawButtons = (filter) => { for (const b of buttons) if (!filter || filter(b)) button(b); };

  // ---- background: table, petals, lantern glow ---------------------------------------------------------------------
  drawTable(ctx, L.w, L.h);
  petals(ctx, T, L.w, L.h);

  const scene = state.scene;
  const onBoard = scene === 'play' || scene === 'lesson' || scene === 'puzzle' || scene === 'auto';

  if (onBoard) drawBoardScene();
  else if (scene === 'title') drawTitle();
  else drawPages();

  // ---- overlays -----------------------------------------------------------------------------------------------------
  if (state.promo) drawPromo();
  else if (state.menu) { dim(0.62); const M = L.menuStack(buttons.length); text('Paused', M.title.x, M.title.y, M.title.size, GOLD, DISPLAY, 700); }
  drawButtons((b) => b.kind !== 'promo');

  // =====================================================================================================================
  function dim(a) { ctx.fillStyle = `rgba(6,3,1,${a})`; ctx.fillRect(0, 0, L.w, L.h); }

  function drawTitle() {
    const tg = titleGeom({ saved: state.saved, prefs: state.prefs }, L), TL = tg.T;
    for (const l of TL.lanterns) lantern(ctx, l.x, l.y, l.s, T, l.ph);
    // the mark
    const ms = TL.markSize, k = ms / 190;
    ctx.save(); ctx.shadowColor = 'rgba(255,150,70,0.55)'; ctx.shadowBlur = 40 * k;
    ctx.textAlign = 'center'; ctx.font = `700 ${ms}px ${JP}`; ctx.lineWidth = 8 * k; ctx.strokeStyle = '#3a1608'; ctx.strokeText('将棋', TL.cx, TL.markY);
    const g = ctx.createLinearGradient(0, TL.markY - ms * 0.74, 0, TL.markY); g.addColorStop(0, '#f0604c'); g.addColorStop(1, '#a4241a'); ctx.fillStyle = g; ctx.fillText('将棋', TL.cx, TL.markY);
    ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.55; ctx.font = `700 ${ms}px ${JP}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,220,180,0.35)'; ctx.fillText('将棋', TL.cx - 2, TL.markY - 4); ctx.restore();
    text('Shogi', TL.cx, TL.shogiY, TL.shogiSize, GOLD, DISPLAY, 700);
    fitLine('Japan\'s game of generals and drops', TL.cx, TL.tagY, TL.tagSize, (L.land ? TL.split - L.U.x0 : L.U.w) - 40, PAPER, UI, 500);
    // three koma that float
    if (TL.parade) {
      const P = TL.parade, parade = [[7, 15, -P.dx], [8, 8, 0], [1, 9, P.dx]];
      parade.forEach(([a, b2, dx], i) => {
        const bob = Math.sin(T * 1.3 + i * 2.1) * 6, tilt = Math.sin(T * 0.9 + i) * 0.05 + (i === 0 ? -0.1 : i === 2 ? 0.1 : 0);
        const flipT = ((T * 0.35 + i * 0.33) % 1);
        const pc = flipT < 0.5 ? a : b2;
        ctx.save(); ctx.translate(TL.cx + dx, P.y + bob); ctx.rotate(tilt);
        drawPiece(ctx, pc, 0, 0, 0, 0, P.s, { lang });
        ctx.restore();
      });
    }
    // The decorative text is placed off the list's own geometry (it grows by one row with a saved game), never a fixed number.
    const lx = TL.x + TL.fullW / 2;
    text('Language', lx, tg.labelY - 4, Math.max(22, minU), 'rgba(247,236,210,0.55)', UI, 600);
    const bits = [];
    if (state.stats.played > 0) bits.push(`Played ${state.stats.played} · Won ${state.stats.wins}`);
    if (state.daily.streak > 0) bits.push(`Streak ${state.daily.streak}d`);
    const limit = L.land ? L.U.y1 - 6 : TL.lockupY - 4;
    if (bits.length && tg.afterY + 26 <= limit) fitLine(bits.join('   '), lx, tg.afterY + 22, 25, TL.fullW + 40, 'rgba(247,236,210,0.7)', UI, 500);
    { const lw = TL.lockupH * 1200 / 327, pad = TL.lockupH * 0.12; ctx.save(); ctx.globalAlpha = state.lockPress > 0 ? 0.7 : 1; ctx.fillStyle = 'rgba(10,8,24,0.55)'; ctx.beginPath(); ctx.roundRect(TL.lockupX - lw / 2 - pad, TL.lockupY - pad, lw + 2 * pad, TL.lockupH + 2 * pad, (TL.lockupH + 2 * pad) * 0.3); ctx.fill(); ctx.restore(); }
    drawLockup(ctx, TL.lockupX, TL.lockupY, TL.lockupH, { alpha: state.lockPress > 0 ? 0.7 : 1 });
  }

  // text pages: the panel, then the screen's own content
  function drawPages() {
    if (scene === 'setup') {
      const S = L.setup(); panel(S.P.x, S.P.y, S.P.w, S.P.h, 0.55, 26);
      fitLine(state.variant === 'mini' ? 'Mini shogi' : 'New game', S.title.x, S.title.y, S.title.size, S.title.maxW, GOLD);
      fitLine(state.variant === 'mini' ? 'A quick 5x5 game: the gentlest way in' : 'Choose your opponent', S.sub.x, S.sub.y, S.sub.size, S.P.w - 60, PAPER, UI, 500);
      fitText(LEVELS[state.level].blurb, S.blurb.x, S.blurb.y, S.blurb.w, S.blurb.h, S.blurb.size * big, PAPER, 'center');
      text('Your side', S.sideLabel.x, S.sideLabel.y, S.sideLabel.size, 'rgba(242,213,144,0.85)', UI, 600);
    } else if (scene === 'settings') {
      const S = L.settings(); panel(S.P.x, S.P.y, S.P.w, S.P.h, 0.55, 26);
      fitLine('Settings', S.title.x, S.title.y, S.title.size, S.title.maxW, GOLD);
      text('Language', S.langLabel.x, S.langLabel.y, S.langLabel.size, 'rgba(242,213,144,0.85)', UI, 600);
      fitText('Reduced motion stops bobbing and shortens moves. Large text makes messages bigger. Western letters print P, R, B under the pieces to help while you learn the characters in 日本語 mode. Play (日本語) shows the real kanji; Play (English) relabels every piece in English.', S.note.x, S.note.y, S.note.w, S.note.h, S.note.size * big, 'rgba(247,236,210,0.8)');
    } else if (scene === 'learn') {
      const S = L.learn(LESSONS.length); panel(S.P.x, S.P.y, S.P.w, S.P.h, 0.55, 26);
      fitLine('Learn to play', S.title.x, S.title.y, S.title.size, S.title.maxW, GOLD);
      fitLine('Twelve short lessons: you make every move yourself', S.sub.x, S.sub.y, S.sub.size, S.P.w - 60, PAPER, UI, 500);
      const done = state.lessonsDone.filter(Boolean).length;
      text(`${done} of ${LESSONS.length} complete`, S.count.x, S.count.y, S.count.size, 'rgba(242,213,144,0.85)', UI, 600);
    } else if (scene === 'about' || scene === 'howto' || scene === 'rules') drawReader();
    else if (scene === 'demo-limit') {
      const S = L.limit(); panel(S.P.x, S.P.y, S.P.w, S.P.h, 0.55, 26);
      fitLine('Preview complete', S.title.x, S.title.y, S.title.size, S.P.w - 60, GOLD);
      fitText('You have used the free web preview. The full game for iPhone and Android has every lesson, all five computer levels, unlimited games and a new puzzle every day.', S.text.x, S.text.y, S.text.w, S.text.h, S.text.size, PAPER);
    }
  }

  // About / How to play / Rules: ONE continuous scrolling document (drag, wheel, keys, scroll bar). Consecutive entries with the same
  // heading are one section; every section is drawn in order with its heading, the real Sente/Gote sprites on piece sections, and
  // its paragraphs. Next scrolls a screenful (ui.js), Back/Done leave.
  function drawReader() {
    const secs = readerSections(scene === 'about' ? ABOUT : scene === 'howto' ? HOWTO : RULES);
    const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;       // falls back to 1 for any out-of-range index
    const RL = L.reader(scale, false), P = RL.P;
    panel(P.x, P.y, P.w, P.h, 0.55, 26);
    fitLine(scene === 'about' ? 'About shogi' : scene === 'howto' ? 'How to play' : 'Rules', L.cx, RL.titleY, RL.titleSize, L.topMaxW, GOLD);
    ctx.strokeStyle = 'rgba(242,213,144,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(RL.ruleX0, RL.ruleY); ctx.lineTo(RL.ruleX1, RL.ruleY); ctx.stroke();
    const titleSz = Math.max(24, Math.round(RL.pageTitle.size * RL.pageTitle.scale)), ps = Math.round(21 * Math.min(scale, 1.15));
    const lnSize = (scene === 'rules' ? 28 : 30) * scale, lnGap = Math.round((scene === 'rules' ? 16 : 20) * scale);
    const top = RL.pageTitle.top, vp = { x: RL.textX, y: top, w: RL.textW, h: Math.max(60, RL.bodyBottom - top) };
    const sc0 = Math.max(0, state.scroll || 0);
    const visible = (y0, y1) => y1 - sc0 >= vp.y - 80 && y0 - sc0 <= vp.y + vp.h + 80;
    const pieceH = 196;
    ctx.save(); ctx.beginPath(); ctx.rect(vp.x - 6, vp.y - 4, vp.w + 12, vp.h + 8); ctx.clip();
    let y = vp.y + 6;
    secs.forEach((sec, si) => {
      if (si) y += Math.round(30 * scale);
      ctx.font = `700 ${titleSz}px ${DISPLAY}`;
      const tl = wrapLines(sec.title, vp.w - 18, titleSz, DISPLAY, 700), th = tl.length * titleSz * 1.2;
      if (visible(y, y + th)) tl.forEach((l, i) => text(l, vp.x + vp.w / 2, y - sc0 + titleSz * 0.95 + i * titleSz * 1.2, titleSz, PAPER, DISPLAY, 700));
      y += th + 14;
      if (sec.piece !== undefined) {
        if (visible(y, y + pieceH)) {
          const footY = y - sc0 + 74, dx = 110, p2 = 0.92, cx = vp.x + vp.w / 2;
          drawPiece(ctx, sec.piece, 0, 0, cx - dx, footY, p2, { lang });
          drawPiece(ctx, sec.piece, 1, 1, cx + dx, footY, p2, { lang });
          text('Sente', cx - dx, footY + 82, ps, 'rgba(247,236,210,0.6)', UI, 600);
          text('Gote', cx + dx, footY + 82, ps, 'rgba(247,236,210,0.6)', UI, 600);
        }
        y += pieceH;
      }
      for (const ln of sec.lines) {
        const lines = wrapLines(ln, vp.w - 18, lnSize, UI, 500), h = lines.length * lnSize * 1.28;
        if (visible(y, y + h)) lines.forEach((l, i) => text(l, vp.x, y - sc0 + lnSize + i * lnSize * 1.28, lnSize, 'rgba(247,236,210,0.94)', UI, 500, 'left'));
        y += h + lnGap;
      }
    });
    ctx.restore();
    const total = y - lnGap - vp.y;
    readerMetrics.vp = vp; readerMetrics.view = vp.h; readerMetrics.max = total - vp.h <= 6 ? 0 : Math.ceil(total - vp.h);
    const sc = Math.max(0, Math.min(sc0, readerMetrics.max));
    if (readerMetrics.max > 0) {                                     // scroll bar
      const th = Math.max(48, vp.h * vp.h / total), ty = vp.y + (sc / readerMetrics.max) * (vp.h - th);
      ctx.fillStyle = 'rgba(247,236,210,0.14)'; ctx.beginPath(); ctx.roundRect(vp.x + vp.w - 4, vp.y, 8, vp.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(247,236,210,0.7)'; ctx.beginPath(); ctx.roundRect(vp.x + vp.w - 6, ty, 12, th, 6); ctx.fill();
    }
  }

  // ---- the board scenes ------------------------------------------------------------------------------------------------
  function drawBoardScene() {
    const g = G, n = g.n, pos = state.game, bs = bottomSide, cell = g.cell, ps = (cell / 68) * PIECE_SCALE, s = g.s;
    const topSide = 1 - bs, lw = (v) => v * Math.max(0.6, Math.min(1, s));
    const lessonScene = scene === 'lesson', puzzleScene = scene === 'puzzle', autoScene = scene === 'auto';
    // header
    drawHeader();
    const flying = state.anim && state.anim.cap ? state.anim : null;
    const drawTray = (st, owner, which) => {
      const hand = pos.hand[owner], rot = which === 'top' ? 1 : 0;
      drawStand(ctx, st, which === 'top');
      STAND_ORDER.forEach((tt, i) => {
        let cnt = hand[tt] - (flying && flying.by === owner && base(flying.cap & 15) === tt ? 1 : 0);
        if (cnt <= 0) return;
        const p = st.slot(i), sel = state.sel && state.sel.drop === tt && pos.turn === owner;
        const hinted = state.hint && isDrop(state.hint.m) && mDrop(state.hint.m) === tt && pos.turn === owner;
        const rr = 54 * Math.max(0.7, st.k);
        if (sel || hinted) { const gl = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, rr); gl.addColorStop(0, `rgba(255,220,120,${0.55 + (calm ? 0 : 0.2 * Math.sin(t * 6))})`); gl.addColorStop(1, 'rgba(255,220,120,0)'); ctx.fillStyle = gl; ctx.fillRect(p.x - rr - 6, p.y - rr - 6, 2 * rr + 12, 2 * rr + 12); }
        drawPiece(ctx, tt, owner, rot, p.x, p.y - (sel ? 8 : 0), st.ps * (sel ? 1.08 : 1), pieceOpts(tt));
        if (cnt > 1) {
          const bx = p.x + (rot ? -24 : 24) * st.k, by = p.y + (rot ? -26 : 26) * st.k, br = 15 * Math.max(0.8, st.k);
          ctx.fillStyle = '#7d1a12'; ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill(); ctx.strokeStyle = GOLD; ctx.lineWidth = 1.8; ctx.stroke();
          text(String(cnt), bx, by + br * 0.47, br * 1.33, '#fff2d8', UI, 700);
        }
      });
    };
    const nameSz = (nm) => Math.max(nm.size, Math.min(minU, nm.size + 2));
    const turnSide = state.result ? -1 : pos.turn;
    const dot = (nm, side) => { if (turnSide === side) { ctx.fillStyle = `rgba(255,214,120,${0.7 + (calm ? 0 : 0.3 * Math.sin(t * 5))})`; ctx.beginPath(); ctx.arc(nm.dotX, nm.y - 8, 6, 0, TAU); ctx.fill(); } };
    // in a lesson or puzzle the opponent's tray is covered by the teaching card
    if (!lessonScene && !puzzleScene) {
      drawTray(B.top, topSide, 'top');
      const nameTop = autoScene ? 'Computer (Gote)' : state.two ? 'Gote' : `Computer  ·  ${LEVELS[state.level].name}`;
      const nameBot = autoScene ? 'Computer (Sente)' : state.two ? 'Sente' : 'You';
      const nmW = (B.mode === 'wide' ? B.pw - 40 : L.U.w - 160);
      fitLine(nameTop, B.nameTop.x, B.nameTop.y, nameSz(B.nameTop), nmW, 'rgba(247,236,210,0.85)', UI, 600, 'left'); dot(B.nameTop, topSide);
      fitLine(nameBot, B.nameBot.x, B.nameBot.y, nameSz(B.nameBot), nmW, 'rgba(247,236,210,0.85)', UI, 600, 'left'); dot(B.nameBot, bs);
      const think = state.thinking ? 'Thinking' : autoScene && state.autoPhase ? (state.autoPhase === 'think' ? 'Thinking' : 'This is the move') : null;
      if (think) {
        const dots = calm ? 3 : 1 + (Math.floor(t * 3) % 3);
        text(think === 'Thinking' ? 'Thinking' + '.'.repeat(dots) : think, B.think.x, B.think.y, Math.max(B.think.size, minU), GOLD, UI, 600, B.think.align);
      }
    } else {
      const c = B.card; panel(c.x, c.y, c.w, c.h, 0.9, 20);
      const body = lessonScene ? LESSONS[state.lesson.i].text : state.pz.status === 'solved' ? 'Solved! You found the mate. A new puzzle arrives tomorrow; practice with "Another puzzle".' : `You play the bottom pieces and must give checkmate in ${state.pz.pz.n === 1 ? 'one move' : 'three moves'}. Every attacking move is a check. Pieces on your stand can be dropped.`;
      fitText(body, c.x + c.w / 2, c.y + 12, c.w - 36, c.h - 24, 27 * big, PAPER);
      nameLabel(B.nameBot, 'You', bs);
    }
    drawTray(B.bot, bs, 'bot');
    if (lessonScene || puzzleScene) { /* names drawn above */ }

    // the board
    drawBoard(ctx, n, g);
    // coordinates on the margin of the slab
    const cs = Math.max(14, 21 * s), rs = Math.max(14, 20 * s);
    for (let i = 0; i < n; i++) {
      const cx = g.gx + (i + 0.5) * g.cell, r = flip ? n - 1 - i : i, c = flip ? i + 1 : n - i;
      text(String(c), cx, g.gy - 9 * s, cs, 'rgba(48,28,8,0.72)', DISPLAY, 700);
      // rank letters: the kanji numerals 一..九 in 日本語 mode, plain 1..9 in English (a board label, so it follows the language choice too)
      text(lang === 'en' ? String(r + 1) : RANKS[r], g.gx + g.gw + 15 * s, g.gy + (i + 0.5) * g.cell + 8 * s, rs, 'rgba(48,28,8,0.72)', lang === 'en' ? DISPLAY : JP, 700);
    }
    const sq = (i) => sqCenter(g, i, flip);
    const rect = (i, inset = 2) => { const p = sq(i); return [p.x - cell / 2 + inset, p.y - cell / 2 + inset, cell - inset * 2, cell - inset * 2]; };
    const sh = (v) => v * cell / 68;                  // an offset tuned on the 68-unit cell, scaled to the live cell

    // last move
    if (state.lastMove !== null && scene === 'play') {
      const m = state.lastMove;
      ctx.fillStyle = 'rgba(200,100,30,0.26)';
      if (!isDrop(m)) { const r = rect(mFrom(m)); ctx.fillRect(...r); }
      const r2 = rect(mTo(m)); ctx.fillRect(...r2); ctx.strokeStyle = 'rgba(190,80,20,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(...r2);
    }
    // lesson marks
    if (lessonScene && !state.lesson.done) for (const [r, c] of LESSONS[state.lesson.i].mark) {
      const p = sq(r * n + c), pulse = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 4);
      ctx.strokeStyle = `rgba(192,57,43,${0.6 + 0.4 * pulse})`; ctx.lineWidth = lw(4); ctx.beginPath(); ctx.roundRect(p.x - cell / 2 + 3, p.y - cell / 2 + 3, cell - 6, cell - 6, 8); ctx.stroke();
      ctx.fillStyle = `rgba(192,57,43,${0.10 + 0.14 * pulse})`; ctx.fill();
    }
    // check
    for (const sd of [0, 1]) if (pos.kings[sd] >= 0 && !state.result && inCheck(pos, sd)) {
      const p = sq(pos.kings[sd]), pulse = calm ? 0.6 : 0.6 + 0.4 * Math.sin(t * 7);
      const gl = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, cell * 0.85); gl.addColorStop(0, `rgba(230,50,30,${0.55 * pulse + 0.15})`); gl.addColorStop(1, 'rgba(230,50,30,0)');
      ctx.fillStyle = gl; ctx.fillRect(p.x - cell, p.y - cell, cell * 2, cell * 2);
    }
    // selection
    if (state.sel && state.sel.sq !== undefined) {
      const r = rect(state.sel.sq); ctx.fillStyle = 'rgba(255,214,110,0.5)'; ctx.fillRect(...r); ctx.strokeStyle = 'rgba(255,190,60,0.95)'; ctx.lineWidth = lw(3); ctx.strokeRect(...r);
    }
    // legal points
    for (const to of state.targets) {
      const p = sq(to), c = pos.b[to], pulse = calm ? 0.6 : 0.6 + 0.4 * Math.sin(t * 5 + to);
      if (c) {
        ctx.strokeStyle = `rgba(226,70,40,${0.65 + 0.3 * pulse})`; ctx.lineWidth = lw(4); ctx.beginPath(); ctx.roundRect(p.x - cell / 2 + 3, p.y - cell / 2 + 3, cell - 6, cell - 6, 8); ctx.stroke();
        ctx.fillStyle = 'rgba(226,70,40,0.22)'; ctx.fill();
      } else {
        const gl = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, cell * 0.3); gl.addColorStop(0, `rgba(255,236,150,${0.95 * pulse})`); gl.addColorStop(0.55, `rgba(240,170,50,${0.55 * pulse})`); gl.addColorStop(1, 'rgba(240,170,50,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.3, 0, TAU); ctx.fill();
      }
    }
    // Auto Play's REVEAL phase: every legal destination for the piece about to move is drawn above (the loop just before this
    // one, same as a normal selection); this ring marks the ONE the engine is actually about to play, distinctly (cyan-white).
    if (autoScene && state.autoPhase === 'reveal' && state.autoChosenTo >= 0) {
      const p = sq(state.autoChosenTo), pulse = calm ? 0.75 : 0.65 + 0.35 * Math.sin(t * 7);
      ctx.save(); ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(120,220,255,${0.55 * pulse})`; ctx.lineWidth = lw(10);
      ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.46, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.85 + 0.15 * pulse})`; ctx.lineWidth = lw(4);
      ctx.beginPath(); ctx.arc(p.x, p.y, cell * 0.46, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    // hint
    if (state.hint) {
      const m = state.hint.m, pulse = calm ? 0.7 : 0.6 + 0.4 * Math.sin(t * 6), tt = sq(mTo(m));
      ctx.strokeStyle = `rgba(255,224,110,${0.6 + 0.4 * pulse})`; ctx.lineWidth = lw(5);
      ctx.beginPath(); ctx.roundRect(tt.x - cell / 2 + 2, tt.y - cell / 2 + 2, cell - 4, cell - 4, 8); ctx.stroke();
      if (!isDrop(m)) {
        const ff = sq(mFrom(m)); ctx.beginPath(); ctx.roundRect(ff.x - cell / 2 + 2, ff.y - cell / 2 + 2, cell - 4, cell - 4, 8); ctx.stroke();
        ctx.setLineDash([10, 9]); ctx.lineDashOffset = -T * 30; ctx.beginPath(); ctx.moveTo(ff.x, ff.y); ctx.lineTo(tt.x, tt.y); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    // keyboard cursor
    if (state.kb) { const r = rect(state.cursor, 5); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.setLineDash([8, 6]); ctx.lineWidth = 2.5; ctx.strokeRect(...r); ctx.setLineDash([]); }

    // pieces
    const a = state.anim;
    for (let i = 0; i < pos.b.length; i++) {
      const c = pos.b[i];
      if (!c) continue;
      if (a && a.kind !== 'refuse' && a.to === i) continue;          // drawn by the animation
      if (a && a.kind === 'refuse' && a.from === i) continue;
      const p = sq(i), owner = c >> 4, tt = c & 15, lifted = state.sel && state.sel.sq === i;
      if (lifted) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(p.x + sh(4), p.y + sh(24), cell * 0.3, cell * 0.11, 0, 0, TAU); ctx.fill(); }
      drawPiece(ctx, tt, owner, owner === bs ? 0 : 1, p.x, p.y - sh(1) - (lifted ? sh(8) : 0), ps * (lifted ? 1.08 : 1), pieceOpts(tt));
    }
    if (a) drawAnim(a, ps, sh);

    drawMessage();
  }

  function nameLabel(nm, str, side) {
    fitLine(str, nm.x, nm.y, nm.size, 300, 'rgba(247,236,210,0.85)', UI, 600, 'left');
    if (!state.result && state.game.turn === side) { ctx.fillStyle = `rgba(255,214,120,${0.7 + (calm ? 0 : 0.3 * Math.sin(t * 5))})`; ctx.beginPath(); ctx.arc(nm.dotX, nm.y - 8, 6, 0, TAU); ctx.fill(); }
  }

  // the title / subtitle above the board (a card of its own in landscape)
  function drawHeader() {
    const H = B.hdr, lessonScene = scene === 'lesson', puzzleScene = scene === 'puzzle', autoScene = scene === 'auto';
    const sub = autoScene ? `Watch & Learn  ·  think time ${THINK_STEPS[state.autoThinkIdx]}s` : lessonScene ? `Lesson ${state.lesson.i + 1} of ${LESSONS.length}` : puzzleScene ? (state.pz.extra ? 'Practice puzzle' : `Same puzzle for everyone today${state.daily.streak ? '   ·   streak ' + state.daily.streak : ''}`) : state.two ? 'Two players on one phone' : `${state.variant === 'mini' ? 'Mini shogi   ·   ' : ''}${LEVELS[state.level].name}   ·   you are ${state.human === 0 ? 'Sente (first)' : 'Gote (second)'}`;
    if (autoScene) fitLine('Auto Play', H.cx, H.titleY, H.titleSize * 0.9, H.maxW, GOLD);
    else if (lessonScene) fitLine(LESSONS[state.lesson.i].title, H.cx, H.titleY, H.titleSize * 0.84, H.maxW, GOLD);
    else if (puzzleScene) fitLine(`Puzzle of the day: mate in ${state.pz.pz.n}`, H.cx, H.titleY, H.titleSize * 0.8, H.maxW, GOLD);
    else {
      // 将棋 + Shogi side by side, centred
      ctx.font = `700 ${H.titleSize * 0.74}px ${JP}`; const wj = ctx.measureText('将棋').width;
      ctx.font = `700 ${H.titleSize}px ${DISPLAY}`; const ws = ctx.measureText('Shogi').width, tot = wj + 18 + ws, k = Math.min(1, H.maxW / tot);
      const x0 = H.cx - (tot * k) / 2;
      text('将棋', x0, H.titleY, H.titleSize * 0.74 * k, VERMILION, JP, 700, 'left'); text('Shogi', x0 + (wj + 18) * k, H.titleY, H.titleSize * k, GOLD, DISPLAY, 700, 'left');
    }
    if (H.wide) fitText(sub, H.cx, H.subY - 20, H.maxW, 76, Math.max(H.subSize, minU), 'rgba(247,236,210,0.8)', 'center', UI, 500);
    else fitLine(sub, H.cx, H.subY, Math.max(H.subSize, Math.min(minU, H.subSize + 2)), L.U.w - 60, 'rgba(247,236,210,0.8)', UI, 500);
  }

  function drawAnim(a, ps, sh) {
    const g = G, bs = bottomSide, cell = g.cell;
    const lab = state.prefs.labels ? LETTER[a.cell & 15] : undefined;
    const mdur = a.cap ? 0.22 : a.dur, f = Math.min(1, a.t / mdur), e = ease(f);
    const to = sqCenter(g, a.to, flip);
    const stand = (by) => (by === bs ? B.bot : B.top), slotOf = (by, tt) => stand(by).slot(Math.max(0, STAND_ORDER.indexOf(tt)));
    const sps = B.bot.ps;
    if (a.kind === 'refuse') {
      const from = a.from >= 0 ? sqCenter(g, a.from, flip) : slotOf(a.by, a.cell & 15);
      const ff = Math.min(1, a.t / a.dur), out = ff < 0.38 ? ff / 0.38 : ff < 0.62 ? 1 : 1 - (ff - 0.62) / 0.38, oe = ease(out) * 0.62;
      const shake = calm ? 0 : ff >= 0.34 && ff < 0.66 ? Math.sin(ff * 100) * 5 : 0;
      const x = from.x + (to.x - from.x) * oe + shake, y = from.y + (to.y - from.y) * oe;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + sh(3), y + sh(22), cell * 0.28, cell * 0.1, 0, 0, TAU); ctx.fill();
      drawPiece(ctx, a.cell & 15, a.by, a.by === bs ? 0 : 1, x, y - sh(8), ps * (a.from >= 0 ? 1.06 : 0.9), { label: lab, lang });
      // a small red x at the refused point
      const d = Math.max(9, cell * 0.2);
      ctx.strokeStyle = `rgba(226,70,40,${0.9 * (1 - Math.abs(ff - 0.5) * 1.4)})`; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(to.x - d, to.y - d); ctx.lineTo(to.x + d, to.y + d); ctx.moveTo(to.x + d, to.y - d); ctx.lineTo(to.x - d, to.y + d); ctx.stroke();
      return;
    }
    let from, scale0 = ps;
    if (a.kind === 'drop') { from = slotOf(a.by, a.cell & 15); scale0 = sps; } else from = sqCenter(g, a.from, flip);
    const x = from.x + (to.x - from.x) * e, y = from.y + (to.y - from.y) * e, lift = Math.sin(Math.PI * f) * sh(12) * (calm ? 0.4 : 1);
    ctx.fillStyle = `rgba(0,0,0,${0.25 * (1 - Math.abs(f - 0.5) * 0.6)})`; ctx.beginPath(); ctx.ellipse(x + sh(4), y + sh(22), cell * 0.3, cell * 0.11, 0, 0, TAU); ctx.fill();
    const settle = f >= 1 && !calm ? 1 + 0.06 * Math.sin(Math.min(1, (a.t - mdur) / 0.14) * Math.PI) : 1;
    const tt = a.promo && f > 0.75 ? (a.cell & 15) + 8 : a.cell & 15;
    drawPiece(ctx, tt, a.by, a.by === bs ? 0 : 1, x, y - sh(1) - lift, (scale0 + (ps - scale0) * e) * (1 + 0.06 * Math.sin(Math.PI * f)) * settle, { label: lab, lang });
    if (a.promo && f > 0.75 && !calm) { ctx.strokeStyle = `rgba(255,120,80,${1 - (f - 0.75) * 4})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(to.x, to.y, cell * (0.35 + (f - 0.75) * 1.2), 0, TAU); ctx.stroke(); }
    // the captured piece flies to the capturer's stand
    if (a.cap && a.t > 0.12) {
      const cf = Math.min(1, (a.t - 0.12) / (a.dur - 0.12)), ce = ease(cf), capT = base(a.cap & 15);
      const dst = slotOf(a.by, capT);
      const cx = to.x + (dst.x - to.x) * ce, cy = to.y + (dst.y - to.y) * ce - Math.sin(Math.PI * cf) * sh(40);
      drawPiece(ctx, capT, a.by, a.by === bs ? 0 : 1, cx, cy, ps + (sps - ps) * ce, { alpha: 1, lang });
    }
  }

  function drawMessage() {
    const m = B.msg, pad = 12;
    panel(m.x, m.y, m.w, m.h, 0.72, 20);
    let s = state.msg && (state.msg.t < state.msg.hold + 0.001) ? state.msg.text : null;
    if (!s) {
      s = state.result ? '' : state.thinking ? 'The computer is thinking…' : scene === 'lesson' ? LESSONS[state.lesson.i].how : scene === 'puzzle' ? 'Your move: find the check that wins.' : state.two ? `${state.game.turn === 0 ? 'Sente' : 'Gote'} to move.` : 'Your move. TAP a piece.';
    }
    const a = state.msg && state.msg.t < 0.25 ? 0.6 + state.msg.t * 1.6 : 1;
    // a result also carries the quiet Arcforge line along the foot of the panel (text only; it never interrupts play)
    const more = state.result && m.h >= 84, moreH = more ? Math.max(26, minU + 6) : 0;
    ctx.globalAlpha = a; fitText(s, m.x + m.w / 2, m.y + pad, m.w - 2 * pad - 8, m.h - pad - 6 - moreH, B.msgSize * big, state.result ? GOLD : PAPER); ctx.globalAlpha = 1;
    if (more) drawMoreLine(ctx, m.x + m.w / 2, m.y + m.h - 12, Math.max(15, Math.min(19, minU - 4)));
  }

  function drawPromo() {
    dim(0.7);
    const P = L.promo(), pr = state.promo, tt = pr.piece;
    ctx.save(); ctx.translate(P.cx - 360 * P.k, P.top); ctx.scale(P.k, P.k);
    text('Promote?', 360, 84, 84, GOLD, DISPLAY, 700);
    fitText(`Your ${NAME[tt].toLowerCase()} may promote and become a ${NAME[tt + 8].toLowerCase()}: stronger, and its character turns red. A promoted piece can never change back.`, 360, 108, 560, 124, 28, PAPER);
    for (const b of buttons) if (b.kind === 'promo') {
      const d = b.d;
      panel(d.x, d.y, d.w, d.h, 0.9, 22);
      const yes = b.id === 'promoYes', pieceT = yes ? tt + 8 : tt;
      if (yes) { const gl = ctx.createRadialGradient(d.x + d.w / 2, d.y + 130, 10, d.x + d.w / 2, d.y + 130, 150); gl.addColorStop(0, 'rgba(255,120,80,0.35)'); gl.addColorStop(1, 'rgba(255,120,80,0)'); ctx.fillStyle = gl; ctx.fillRect(d.x, d.y, d.w, 260); }
      drawPiece(ctx, pieceT, pr.owner, pr.owner === bottomSide ? 0 : 1, d.x + d.w / 2, d.y + 132 + (calm ? 0 : Math.sin(t * 2 + (yes ? 0 : 2)) * 4), 1.1, pieceOpts(pieceT));
      text(yes ? 'Promote' : 'Keep', d.x + d.w / 2, d.y + 268, 40, yes ? '#ffb8a8' : PAPER, DISPLAY, 700);
      text(NAME[pieceT], d.x + d.w / 2, d.y + 302, 22, 'rgba(247,236,210,0.7)', UI, 500);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// ambient life
function petals(ctx, T, W, H) {
  for (let i = 0; i < 16; i++) {
    const sp = 22 + (i * 7) % 19, x0 = (i * 137) % W, ph = i * 1.7;
    const x = ((x0 + Math.sin(T * 0.5 + ph) * 34 + T * 8) % (W + 40) + (W + 40)) % (W + 40) - 20, y = ((i * 211 + T * sp) % (H + 80)) - 40;
    ctx.save(); ctx.translate(x, y); ctx.rotate(T * 0.6 + ph); ctx.scale(1, 0.62 + 0.38 * Math.sin(T * 1.4 + ph));
    ctx.fillStyle = `rgba(255,${176 + (i % 4) * 12},${190 + (i % 3) * 14},${0.34 + (i % 3) * 0.07})`;
    ctx.beginPath(); ctx.ellipse(0, 0, 7 + (i % 3), 4, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
}
function lantern(ctx, x, y, s, T, ph) {
  const sw = Math.sin(T * 0.9 + ph) * 0.05, fl = 0.85 + 0.15 * Math.sin(T * 3.1 + ph * 2);
  ctx.save(); ctx.translate(x, 0);
  ctx.strokeStyle = 'rgba(30,18,8,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, y); ctx.stroke();
  ctx.translate(0, y); ctx.rotate(sw);
  const glow = ctx.createRadialGradient(0, 60 * s, 8, 0, 60 * s, 190 * s); glow.addColorStop(0, `rgba(255,190,100,${0.5 * fl})`); glow.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = glow; ctx.fillRect(-200 * s, -140 * s, 400 * s, 400 * s);
  const body = ctx.createRadialGradient(-8 * s, 56 * s, 6, 0, 60 * s, 52 * s); body.addColorStop(0, `rgba(255,${228 * fl | 0},150,1)`); body.addColorStop(0.65, '#f08a3a'); body.addColorStop(1, '#a8391a');
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 62 * s, 40 * s, 52 * s, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(120,40,10,0.55)'; ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(0, 62 * s, Math.abs(i) * 16 * s + 1, 52 * s, 0, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = '#20120a'; ctx.beginPath(); ctx.roundRect(-22 * s, 6 * s, 44 * s, 12 * s, 4); ctx.fill(); ctx.beginPath(); ctx.roundRect(-22 * s, 104 * s, 44 * s, 12 * s, 4); ctx.fill();
  ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 116 * s); ctx.lineTo(0, 150 * s + Math.sin(T * 2 + ph) * 3); ctx.stroke();
  ctx.restore();
}
