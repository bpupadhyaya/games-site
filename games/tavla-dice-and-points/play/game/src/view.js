// Everything drawn per frame. Reads `state` (see game.js) and changes nothing (apart from st.docMax, the reader pages' scroll
// range, which the page measures while drawing). Every rectangle comes from the current layout `L` (layout.js), so the same code
// draws portrait, landscape and tablet shapes. The heavy art (table, board, checkers, dice faces) lives in cached sprites
// (art.js, sprites.js), so a frame is only a few dozen drawImage calls.
import { L, S, R, CH, SLOT, TRAYC, host, minText, stackPos, barPos, offPos, landing, toScreen, trayRect, barCenter, pointPoly, pointNumPos, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { BAR, OFF, pips, own } from './rules.js';
import { drawStatic } from './art.js';
import { drawChecker, drawChip, drawDie, SET_NAMES } from './sprites.js';
import { LEVELS } from './ai.js';
import { LESSONS } from './lessons.js';
import { ABOUT, HOWTO, RULES } from './text.js';
import { drawLockup, drawCredit, drawMoreLine } from './brand.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const ease = (f) => f * f * (3 - 2 * f);
const rrect = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); };
const hash = (n) => { let x = Math.imul(n + 1, 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; return (x >>> 0) / 4294967296; };
const M = (p) => toScreen(p.x, p.y);                  // a canonical position (animations keep these) to the screen

export function render(ctx, st) {
  const c = ctx, sc = st.scene, t = st.t, big = st.big, calm = st.calm, mt = minText();
  drawStatic(c, L);
  // the lamp flickers a little (steady when motion is reduced)
  if (!calm) { c.fillStyle = `rgba(255,190,110,${0.03 + 0.015 * Math.sin(t * 1.7) + 0.01 * Math.sin(t * 5.3)})`; c.fillRect(0, 0, L.w, Math.min(520, L.h)); }
  if (L.coffee) steam(c, st);

  const text = (s, x, y, size, color = '#f6e3b4', font = UI, weight = 700, align = 'center', shadow = false) => {
    if (size < mt) size = mt;
    c.textAlign = align; c.font = `${weight} ${size}px ${font}`;
    if (shadow) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillText(s, x + 1.5, y + 2.5); }
    c.fillStyle = color; c.fillText(s, x, y);
  };
  // one line, shrunk (never below the readable minimum) to fit maxW
  const fitText = (s, x, y, size, maxW, color, font = UI, weight = 700, align = 'center', shadow = false) => {
    c.font = `${weight} ${size}px ${font}`;
    while (size > mt && c.measureText(s).width > maxW) { size -= 1; c.font = `${weight} ${size}px ${font}`; }
    text(s, x, y, size, color, font, weight, align, shadow);
  };
  const wrapLines = (s, size, maxW, weight = 600) => {
    if (size < mt) size = mt;
    c.font = `${weight} ${size}px ${UI}`; const words = s.split(' '), lines = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (c.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2; }
    lines.push(cur); return lines;
  };
  const wrap = (s, x, y, size, maxW, color, lh = size * 1.32, align = 'center', weight = 600) => { const ls = wrapLines(s, size, maxW, weight); ls.forEach((l, i) => text(l, x, y + i * lh, size, color, UI, weight, align)); return ls.length; };
  const button = (r, label, o = {}) => {
    c.save(); if (o.dim) c.globalAlpha = 0.45;
    const dn = o.down ? 2 : 0, rad = Math.min(18, r.h * 0.3);
    c.fillStyle = 'rgba(0,0,0,0.45)'; rrect(c, r.x + 2, r.y + 7, r.w, r.h, rad); c.fill();
    const g = c.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { g.addColorStop(0, '#f7d98a'); g.addColorStop(0.5, '#d9a441'); g.addColorStop(1, '#a8741f'); } else { g.addColorStop(0, '#8b5630'); g.addColorStop(0.5, '#62371b'); g.addColorStop(1, '#3f2210'); }
    c.fillStyle = g; rrect(c, r.x, r.y + dn, r.w, r.h, rad); c.fill();
    c.strokeStyle = o.primary ? 'rgba(255,240,190,0.9)' : 'rgba(255,225,160,0.55)'; c.lineWidth = 2; c.stroke();
    // shrink the label to fit narrow buttons; never below the readable minimum
    let size = Math.min(o.size ?? 28, r.h * 0.5); const maxW = r.w - 20;
    c.font = `700 ${size}px ${UI}`;
    while (c.measureText(label).width > maxW && size > mt) { size -= 1; c.font = `700 ${size}px ${UI}`; }
    let sub = o.sub, subSize = Math.max(mt, Math.min(19, r.h * 0.28));
    if (sub) { c.font = `600 ${subSize}px ${UI}`; while (c.measureText(sub).width > maxW && subSize > mt) { subSize -= 1; c.font = `600 ${subSize}px ${UI}`; } if (c.measureText(sub).width > maxW) sub = null; }
    if (sub) {
      const lab = Math.min(size, r.h - subSize - 14);
      text(label, r.x + r.w / 2, r.y + dn + (r.h - lab - subSize) / 2 + lab * 0.86 - 2, lab, o.primary ? '#2a1606' : '#f8e6b8', UI, 700);
      text(sub, r.x + r.w / 2, r.y + dn + r.h - (r.h - lab - subSize) / 2 - 3, subSize, o.primary ? '#4a2c0c' : 'rgba(248,230,184,0.75)', UI, 600);
    } else text(label, r.x + r.w / 2, r.y + dn + r.h / 2 + size * 0.34, size, o.primary ? '#2a1606' : '#f8e6b8', UI, 700);
    c.restore();
  };
  const panel = (x, y, w, h, alpha = 0.9) => {
    c.fillStyle = 'rgba(0,0,0,0.4)'; rrect(c, x + 3, y + 8, w, h, 22); c.fill();
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, `rgba(48,26,14,${alpha})`); g.addColorStop(1, `rgba(24,12,6,${alpha})`);
    c.fillStyle = g; rrect(c, x, y, w, h, 22); c.fill(); c.strokeStyle = 'rgba(232,196,106,0.75)'; c.lineWidth = 2; c.stroke();
    if (w > 80 && h > 80) { c.strokeStyle = 'rgba(232,196,106,0.3)'; c.lineWidth = 1; rrect(c, x + 8, y + 8, w - 16, h - 16, 16); c.stroke(); }
  };
  const ctxU = { text, fitText, wrap, wrapLines, button, panel, mt };

  if (sc === 'title') return drawTitle(c, st, ctxU);
  if (sc === 'howto') return drawDoc(c, st, ctxU, 'How to play', HOWTO, st.page || 0);
  if (sc === 'about') return drawDoc(c, st, ctxU, 'About Tavla', ABOUT, st.page || 0);
  if (sc === 'rules') return drawDoc(c, st, ctxU, 'Rules', RULES, st.page || 0);
  if (sc === 'settings') return drawSettings(c, st, ctxU);
  if (sc === 'demo-limit') return drawDemoLimit(c, st, ctxU);
  drawBoardScene(c, st, ctxU);
}

// ---- steam over the coffee pot and cup --------------------------------------------------------------------------------
function steam(c, st) {
  if (st.calm) return;
  const t = st.t;
  for (const [bx, by, n] of [[48, 34, 3], [128, 82, 2]]) for (let i = 0; i < n; i++) {
    const p = ((t * 0.28 + i / n + bx * 0.01) % 1), x = bx + Math.sin(p * 7 + i * 2 + bx) * (5 + p * 6), y = by - p * 34;
    c.fillStyle = `rgba(255,240,220,${0.16 * Math.sin(p * Math.PI)})`; c.beginPath(); c.arc(x, y, 5 + p * 8, 0, TAU); c.fill();
  }
}

// a checker in screen space: sizes follow the board scale S
const chk = (c, set, side, x, y, k = 1, lift = 0) => drawChecker(c, set, side, x, y, k * S, lift * S);

// ---- title ------------------------------------------------------------------------------------------------------------
function drawTitle(c, st, U) {
  const T = L.title(!!st.saved), RC = T.rects, lv = LEVELS[st.level];
  for (let i = 0; i < 24; i++) { const v = st.g.board[i], n = Math.abs(v); for (let k = 0; k < n; k++) { const p = stackPos(i, k, n); chk(c, st.set, v > 0 ? 0 : 1, p.x, p.y, 1); } }
  c.fillStyle = 'rgba(14,7,3,0.86)'; c.fillRect(0, 0, L.w, L.h);
  const g = c.createRadialGradient(T.titleX, T.titleY - 40, 20, T.titleX, T.titleY, 520); g.addColorStop(0, 'rgba(255,190,110,0.22)'); g.addColorStop(1, 'rgba(255,190,110,0)'); c.fillStyle = g; c.fillRect(0, 0, L.w, Math.max(700, T.titleY + 300));
  U.text('Tavla', T.titleX + 2, T.titleY + 4, T.titleSize, 'rgba(0,0,0,0.55)', FONT, 700);
  U.text('Tavla', T.titleX, T.titleY, T.titleSize, '#f6dfae', FONT, 700);
  U.fitText('The dice game of the coffeehouse', T.titleX, T.tagY, 32, (T.wide ? T.lw : L.U.w) - 40, '#e8c88a', FONT, 700);
  // hero: two dice that tumble now and then
  const cyc = (st.t % 6) / 6, tum = cyc < 0.16 ? cyc / 0.16 : 1;
  for (let i = 0; i < 2; i++) {
    const rest = T.diceX + i * 120, xs = rest - 130 + i * 40;
    const u = tum, x = Math.max(L.U.x0 + 40, xs + (rest - xs) * (1 - (1 - u) * (1 - u))), lift = Math.abs(Math.sin(u * Math.PI * 3)) * (1 - u) * 60;
    const face = u < 0.85 ? 1 + Math.floor(hash(Math.floor(st.t * 14) + i * 7) * 6) : [5, 3][i];
    drawDie(c, face, x, T.diceY, { rot: (1 - u) * (5 + i * 2) + (i ? -0.12 : 0.1), sq: 1, lift, ivory: i === 0 });
  }
  // discreet Arcforge credit: the themed lockup, small and quiet (the plain credit line until it has loaded)
  const lh = T.lock ? drawLockup(c, T.lock.cx, T.lock.y, T.lock.w, 0.9, (st.afFlash || 0) > 0) : 0;
  if (T.lock && !lh) drawCredit(c, T.lock.cx, T.lock.y + 22, 15, { dim: 0.85 });

  const sub = (txt, r, short) => (r.w < 330 && short ? short : txt);
  if (RC.resume) U.button(RC.resume, 'Resume game', { primary: true, size: 30 });
  U.button(RC.play, 'Play the computer', { primary: !RC.resume, size: 30, sub: `${lv.name}${st.cube.on ? ' · cube' : ''}` });
  U.button(RC.learn, 'Learn to play', { size: 30, sub: st.learned ? 'Nine hands-on lessons · done' : 'Nine hands-on lessons' });
  U.button(RC.two, 'Two players', { size: 30, sub: 'Pass the phone' });
  U.button(RC.daily, 'Daily puzzle', { size: 30, sub: st.daily.streak ? `Streak ${st.daily.streak} day${st.daily.streak === 1 ? '' : 's'}` : 'Find the best move' });
  U.button(RC.auto, 'Auto Play', { size: 30, sub: sub('Watch & Learn - both sides computer-played', RC.auto, 'Watch & Learn') });
  const lvFull = `Level: ${lv.name}`;
  U.button(RC.level, lvFull, { size: 24 });
  U.button(RC.cube, `Cube: ${st.cube.on ? 'On' : 'Off'}`, { size: 24 });
  U.button(RC.gammon, `Gammons: ${st.gammon ? 'On' : 'Off'}`, { size: 24 });
  U.button(RC.settings, 'Settings', { size: 24 });
  U.button(RC.howto, 'How to play', { size: 24 });
  U.button(RC.about, 'About Tavla', { size: 24 });
  U.button(RC.rules, 'Rules', { size: 24 });
  const X = T.text, cx = X.x + X.w / 2;
  const n = U.wrap(lv.blurb, cx, X.y + 22, st.big ? 27 : 22, X.w - 10, 'rgba(246,227,180,0.85)', st.big ? 30 : 26);
  let y = X.y + 22 + n * (st.big ? 30 : 26) + 6;
  if (st.stats.games) { U.text(`Games played ${st.stats.games}  ·  won ${st.stats.wins}`, cx, y, 21, 'rgba(232,200,140,0.75)', UI, 600); y += 28; }
  if (st.msg) U.wrap(st.msg.text, cx, y, 24, X.w - 10, '#ffe9b0', 28);
}

// ---- About, How to play and Rules: one reference-page renderer --------------------------------------------------------------------
// A framed reader card holds the title, the text-size stepper and the body. The stepper (A-/A+) is an index into TEXT_SCALES. The
// body is picked from a ladder of sizes (the largest whose wrapped text fits), and when even the smallest does not fit - the top
// text-size steps, or a short landscape screen - the body scrolls (drag, wheel, arrow keys); the range is left in st.docMax.
// Height of the piece illustration block in the Rules reader: checkers centred 58 down, their captions at 78 below that, then room for the
// caption's descenders plus a clear gap before the heading that follows (the heading's cap top sits about 0.75 x its size above its baseline).
export const DOC_ART_LABEL = { cy: 58, labelDy: 78 };
export const docArtH = (hSize) => DOC_ART_LABEL.cy + DOC_ART_LABEL.labelDy + Math.round(hSize * 0.9) - 30 + 24;
function layoutBody(U, pg, scale, bodyW, room, st) {
  const capH = Math.round(33 * Math.min(scale, 1.3)), hSize = capH;
  const lblSize = Math.round(20 * Math.min(scale, 1.15));
  const artH = pg.piece ? docArtH(capH) : 0;
  const ladder = [28, 26, 24, 22, 20, 18].map((s) => Math.round(s * scale));
  let best = null;
  for (const size of ladder) {
    let h = artH;
    for (const blk of pg.blocks) {
      if (blk.h) h += U.wrapLines(blk.h, hSize, bodyW, 800).length * hSize * 1.15 + size * 0.35;
      h += U.wrapLines(blk.p, size, bodyW, 500).length * size * 1.4 + size * 0.7;
    }
    best = { size, hSize, height: h, artH, lblSize };
    if (h <= room) break;
  }
  void st;
  return best;
}
function drawDoc(c, st, U, title, doc, page) {
  const Dc = L.doc, P = Dc.panel, scale = TEXT_SCALES[st.textScaleIdx] ?? 1;
  c.fillStyle = 'rgba(14,7,3,0.55)'; c.fillRect(0, 0, L.w, L.h);
  U.panel(P.x, P.y, P.w, P.h, 0.94);
  const titleSize = Math.round(60 * Math.min(scale, 1.15));
  U.fitText(title, Dc.title.x, P.y + 42 + titleSize * 0.32, titleSize, Dc.title.maxW, '#f6dfae', FONT, 700, 'center', true);
  U.button(Dc.dec, 'A−', { size: 28, dim: st.textScaleIdx === 0 });
  U.button(Dc.inc, 'A+', { size: 28, dim: st.textScaleIdx === TEXT_SCALES.length - 1 });
  c.save(); c.strokeStyle = 'rgba(232,196,106,0.35)'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(P.x + 40, P.y + Dc.hdrH); c.lineTo(P.x + P.w - 40, P.y + Dc.hdrH); c.stroke(); c.restore();

  const B = Dc.body;
  // ONE scrolling document: every authored page in order (a heading is drawn where it changes), at the size the text-size stepper gives.
  const size = Math.round(28 * scale), hSize = Math.round(33 * Math.min(scale, 1.3)), lblSize = Math.round(20 * Math.min(scale, 1.15)), bodyW = B.w - 12;
  const ckey = `${title}|${size}|${Math.round(bodyW)}`;
  if (docLayoutCache.key !== ckey) {
    const items = []; let y = 0, prevH = null;
    doc.forEach((pg) => {
      const it = { y, blocks: [], art: pg.piece ? docArtH(hSize) : 0, piece: !!pg.piece }; y += it.art;
      for (const blk of pg.blocks) {
        const showH = blk.h && blk.h !== prevH; if (blk.h) prevH = blk.h;
        let hh = 0;
        if (showH) { hh = U.wrapLines(blk.h, hSize, bodyW, 800).length * hSize * 1.15 + size * 0.35; }
        const ph = U.wrapLines(blk.p, size, bodyW, 500).length * size * 1.4 + size * 0.7;
        it.blocks.push({ h: showH ? blk.h : null, p: blk.p, hh, y }); y += hh + ph;
      }
      it.end = y; items.push(it);
    });
    docLayoutCache.key = ckey; docLayoutCache.items = items; docLayoutCache.total = y;
  }
  const { items, total } = docLayoutCache;
  const max = Math.max(0, Math.ceil(total - B.h + 8));
  st.docMax = max; st.docScroll = Math.max(0, Math.min(st.docScroll || 0, max));
  c.save(); c.beginPath(); c.rect(B.x - 6, B.y, B.w + 12, B.h); c.clip();
  c.translate(0, -st.docScroll);
  for (const it of items) {
    if (B.y + it.end < B.y + st.docScroll - 80 || B.y + it.y > B.y + st.docScroll + B.h + 80) continue;
    if (it.piece) {
      // a piece page: the real in-game checker, both colours, drawn with this game's own checker sprite.
      const cy = B.y + it.y + DOC_ART_LABEL.cy, lx = B.x + B.w * 0.26, rx = B.x + B.w * 0.74;
      drawChecker(c, st.set, 0, lx, cy, 1.35); drawChecker(c, st.set, 1, rx, cy, 1.35);
      U.text('Yours', lx, cy + DOC_ART_LABEL.labelDy, lblSize, 'rgba(246,227,180,0.8)', UI, 700);
      U.text('Rival’s', rx, cy + DOC_ART_LABEL.labelDy, lblSize, 'rgba(246,227,180,0.8)', UI, 700);
    }
    for (const b of it.blocks) {
      let y = B.y + b.y;
      if (b.h) U.wrap(b.h, B.x, y + hSize, hSize, bodyW, '#e8c46a', hSize * 1.15, 'left', 800);
      y += b.hh;
      U.wrap(b.p, B.x, y + size, size, bodyW, '#f6ead0', size * 1.4, 'left', 500);
    }
  }
  c.restore();
  if (max > 0) {                                        // scroll indicator
    const th = Math.max(36, B.h * B.h / (B.h + max)), ty = B.y + (B.h - th) * (st.docScroll / max);
    c.fillStyle = 'rgba(232,196,106,0.5)'; rrect(c, B.x + B.w + 8, ty, 5, th, 3); c.fill();
    U.text(`${Math.round(100 * st.docScroll / max)}%`, P.x + P.w / 2, Dc.countY + 4, 20, 'rgba(246,227,180,0.6)', UI, 600);
  }
  // An equal-width Back/Next pair: Back pages up (exits to the title from the top); Next pages down and reads "Done" (exits) at the end.
  const atEnd = max <= 1 || st.docScroll >= max - 1;
  void page;
  U.button(Dc.back, 'Back', { size: 30 });
  U.button(Dc.next, atEnd ? 'Done' : 'Next', { primary: true, size: 30 });
}
const docLayoutCache = { key: '', items: [], total: 0 };

function drawSettings(c, st, U) {
  const Sx = L.set, P = Sx.panel;
  c.fillStyle = 'rgba(14,7,3,0.55)'; c.fillRect(0, 0, L.w, L.h);
  U.panel(P.x, P.y, P.w, P.h, 0.94);
  U.fitText('Settings', Sx.title.x, Sx.title.y, 60, P.w - 260, '#f6dfae', FONT, 700, 'center', true);
  const on = (b) => (b ? 'On' : 'Off'), r = Sx.rows;
  U.button(r.sound, `Sound: ${on(st.sound)}`, { size: 30, sub: 'Dice and checker clacks' });
  U.button(r.calm, `Reduced motion: ${on(st.calm)}`, { size: 30, sub: 'Quicker moves, no bobbing or steam' });
  U.button(r.big, `Large text: ${on(st.big)}`, { size: 30, sub: 'Bigger messages and panels' });
  U.button(r.set, `Checkers: ${SET_NAMES[st.set]}`, { size: 28, sub: 'Tap to change' });
  U.button(r.auto, `Auto-play forced moves: ${on(st.auto)}`, { size: 28, sub: 'When only one move exists, it is played for you' });
  U.button(r.moves, `Rules: Standard`, { size: 30, sub: 'Regional rule sets can be added later' });
  for (let i = 0; i < 2; i++) drawChecker(c, st.set, i, Sx.sample.xs[i], Sx.sample.y, Sx.sample.k);
  U.button(Sx.back, 'Back', { primary: true, size: 30 });
}

function drawDemoLimit(c, st, U) {
  const O = L.over, P = O.dpanel;
  c.fillStyle = 'rgba(14,7,3,0.75)'; c.fillRect(0, 0, L.w, L.h);
  U.panel(P.x, P.y, P.w, P.h, 0.96);
  U.fitText('That is the free preview', O.cx, O.dTitleY, 46, P.w - 40, '#f6dfae', FONT, 700);
  U.wrap('The full Tavla is on iPhone and Android: every lesson, all four computer levels, the daily puzzle, the doubling cube and no ads.', O.cx, O.dBodyY, 26, O.dBodyW, '#f6ead0', 34);
  U.button(O.dback, 'Back to the menu', { primary: true, size: 28 });
}

// ---- the board scenes ---------------------------------------------------------------------------------------------------
function drawBoardScene(c, st, U) {
  const g = st.g, set = st.set, sc = st.scene, t = st.t, calm = st.calm, a = st.anim, mt = U.mt;
  const pulse = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 5);
  const HD = L.head;

  // ---- header ----------------------------------------------------------------------------------------------------------
  U.text('Tavla', HD.title.x, HD.title.y, HD.title.size, '#f6dfae', FONT, 700, 'center', true);
  if (sc !== 'lesson') {
    const twoUp = (st.two || st.autoMode) && sc === 'play', n1 = `${twoUp ? 'Player 1' : 'You'}  ${pips(g, 0)}`, n2 = `${twoUp ? 'Player 2' : 'Rival'}  ${pips(g, 1)}`;
    if (HD.pips.stacked) {
      U.text(n1, HD.pips.x, HD.pips.y - 34, 22, '#f6e3b4', UI, 700, 'right'); U.text(n2, HD.pips.x, HD.pips.y - 6, 22, '#e8b98a', UI, 700, 'right');
      U.text('pips to go', HD.pips.x, HD.pips.y + 18, 16, 'rgba(246,227,180,0.6)', UI, 600, 'right');
    } else {
      const px = HD.pips.x, pw = HD.pips.w;
      U.fitText(n1, px + 18, HD.pips.y, 22, pw / 2 - 20, '#f6e3b4', UI, 700, 'left'); U.fitText(n2, px + pw - 18, HD.pips.y, 22, pw / 2 - 20, '#e8b98a', UI, 700, 'right');
      U.text('pips to go', px + pw / 2, HD.pips.y + 22, 16, 'rgba(246,227,180,0.6)', UI, 600);
    }
  }
  // message banner
  let msg = st.msg?.text ?? st.status ?? '';
  if (sc === 'lesson') { const l = LESSONS[st.lesson.i]; msg = st.msg?.text ?? (st.lesson.done ? l.done : l.text); }
  if (st.autoMode && st.autoPaused) msg = 'Paused. Tap Resume to carry on watching.';
  const B = HD.banner;
  U.panel(B.x, B.y, B.w, B.h, 0.86);
  const cap = sc === 'lesson' ? `Lesson ${st.lesson.i + 1} of ${LESSONS.length}: ${LESSONS[st.lesson.i].title}` : sc === 'puzzle' && st.pz?.puzzle ? `Daily puzzle · streak ${st.daily.streak}` : st.autoMode ? `Auto Play  ·  think time ${THINK_STEPS[st.autoThinkIdx]}s` : '';
  if (cap) U.fitText(cap, HD.caption.x, HD.caption.y, 22, B.w - 20, '#e8c46a', UI, 800);
  // the largest size (down to the readable minimum) whose wrapped message fits the banner
  let size = st.big ? 26 : 23, ls = U.wrapLines(msg, size, B.w - 40);
  while (size > mt && ls.length * size * 1.26 > B.h - 14) { size -= 1; ls = U.wrapLines(msg, size, B.w - 40); }
  const lh = size * 1.26, y0 = B.y + B.h / 2 - ((ls.length - 1) * lh) / 2 + size * 0.34;
  const mc = st.lesson && st.lesson.done && sc === 'lesson' && !st.msg ? '#c9f7c0' : '#fff3d6';
  ls.forEach((l, i) => U.text(l, B.x + B.w / 2, y0 + i * lh, size, mc, UI, 600));

  // ---- trays: the checkers borne off, in edge-on chips -----------------------------------------------------------------------
  const vertical = L.orient === 'h';
  for (let s = 0; s < 2; s++) {
    let n = g.off[s]; if (a && a.hide && a.hide.kind === 'off' && a.hide.side === s && !a.done) n -= 1;
    for (let k = 0; k < n; k++) { const p = offPos(s, k); drawChip(c, set, s, p.x, p.y, S); }
    const T = trayRect(s), cx = T.x + T.w / 2, cy = T.y + T.h / 2;
    const label = (str, size, color, weight = 700, shadow = false, off = 0) => {
      c.save();
      if (vertical) { c.translate(cx, cy + off); c.rotate(-Math.PI / 2); U.text(str, 0, size * 0.34, size, color, UI, weight, 'center', shadow); } else U.text(str, cx + off, cy + size * 0.34, size, color, UI, weight, 'center', shadow);
      c.restore();
    };
    if (!g.off[s] && !(s === 0 && st.dests.some((d) => d.to === OFF))) label(st.autoMode ? `Player ${s + 1}’s bear-off tray` : s === 0 ? 'Your bear-off tray' : 'Rival’s bear-off tray', Math.max(17, mt * 0.9), 'rgba(255,225,170,0.32)');
    if (g.off[s] && g.off[s] < 10) {
      const str = `${g.off[s]} off`, sz = Math.max(22, mt);
      c.save(); if (vertical) { c.translate(cx, s === 0 ? T.y + sz * 1.2 : T.y + T.h - sz * 1.2); c.rotate(-Math.PI / 2); U.text(str, 0, sz * 0.34, sz, 'rgba(255,235,190,0.9)', UI, 700, 'center', true); } else U.text(str, T.x + T.w - 14, cy + 8, sz, 'rgba(255,235,190,0.9)', UI, 700, 'right', true); c.restore();
    }
  }
  if (st.dests.some((d) => d.to === OFF)) {
    const T = trayRect(0); c.fillStyle = `rgba(255,220,110,${0.16 + pulse * 0.2})`; rrect(c, T.x - 4, T.y - 4, T.w + 8, T.h + 8, 12); c.fill();
    c.strokeStyle = `rgba(255,230,140,${0.6 + pulse * 0.4})`; c.lineWidth = 2.5; c.stroke();
    if (g.off[0] < 12) {
      c.save(); const cx = T.x + T.w / 2, cy = T.y + T.h / 2;
      if (vertical) { c.translate(cx, cy); c.rotate(-Math.PI / 2); U.text('BEAR OFF HERE', 0, 8, Math.max(22, mt), 'rgba(255,240,200,0.95)', UI, 800, 'center', true); } else U.text('BEAR OFF HERE', cx, cy + 8, Math.max(22, mt), 'rgba(255,240,200,0.95)', UI, 800, 'center', true);
      c.restore();
    }
  }

  // ---- point numbers (small, engraved, at the tip of each point) ---------------------------------------------------------------
  { const nsz = Math.max(15, mt * 0.8) * Math.min(1, 0.6 + S * 0.5); c.font = `600 ${nsz}px ${UI}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i < 24; i++) { const p = pointNumPos(i); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillText(String(i + 1), p.x + 0.8, p.y + 1); c.fillStyle = 'rgba(250,232,190,0.72)'; c.fillText(String(i + 1), p.x, p.y); }
    c.textBaseline = 'alphabetic'; }

  // ---- highlights on the points ----------------------------------------------------------------------------------------------
  for (const d of st.dests) if (d.to < 24) {
    const q = pointPoly(d.to); c.beginPath(); c.moveTo(q[0].x, q[0].y); for (let i = 1; i < 4; i++) c.lineTo(q[i].x, q[i].y); c.closePath();
    c.fillStyle = `rgba(255,222,120,${0.2 + pulse * 0.22})`; c.fill(); c.strokeStyle = `rgba(255,236,150,${0.55 + pulse * 0.4})`; c.lineWidth = 2; c.stroke();
  }

  // ---- checkers --------------------------------------------------------------------------------------------------------------
  const hidden = (kind, idx, side, k, n) => a && !a.done && a.hide && a.hide.kind === kind && a.hide.idx === idx && a.hide.side === side && k === n - 1;
  const dragFrom = st.drag && st.drag.on ? st.drag.from : -9;
  const sources = new Set(st.sources || []);
  const Rr = (k = 0) => (R + k) * S;
  const drawStack = (idx) => {
    const v = g.board[idx]; if (!v) return;
    const side = v > 0 ? 0 : 1, n = Math.abs(v);
    for (let k = 0; k < n; k++) {
      if (hidden('pt', idx, side, k, n)) continue;
      if (dragFrom === idx && k === n - 1) continue;
      const p = stackPos(idx, k, n), top = k === n - 1;
      const lift = top && st.sel === idx ? 12 : 0;
      chk(c, set, side, p.x, p.y, 1, lift);
      if (top && n > 5) badge(c, p.x, p.y, n, mt);
      if (top && sources.has(idx) && st.sel !== idx && !calm && !st.drag?.on) { c.strokeStyle = `rgba(255,232,140,${0.25 + pulse * 0.5})`; c.lineWidth = 2.5; c.beginPath(); c.arc(p.x, p.y, Rr(3), 0, TAU); c.stroke(); }
      if (top && st.sel === idx) { c.strokeStyle = 'rgba(255,240,160,0.95)'; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y - lift * S, Rr(3), 0, TAU); c.stroke(); }
    }
  };
  for (let i = 0; i < 24; i++) drawStack(i);
  // ghost of a checker being hit: it is still on the point while the hitter lands
  if (a && !a.done && a.ghost && a.t < a.dur) { const gp = M(a.ghost.pos); chk(c, set, a.ghost.side, gp.x, gp.y, 1); }
  for (let s = 0; s < 2; s++) {
    let n = g.bar[s]; const hideOne = a && !a.done && a.hit && a.hit.side === s ? 1 : 0;
    for (let k = 0; k < n - hideOne; k++) {
      if (st.drag?.on && dragFrom === BAR && s === 0 && k === n - 1) continue;
      const p = barPos(s, k, n), top = k === n - 1;
      chk(c, set, s, p.x, p.y, 1, top && st.sel === BAR && s === 0 ? 12 : 0);
      if (top && n > 5) badge(c, p.x, p.y, n, mt);
      if (top && s === 0 && sources.has(BAR)) { c.strokeStyle = `rgba(255,232,140,${0.4 + pulse * 0.5})`; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y - (st.sel === BAR ? 12 * S : 0), Rr(3), 0, TAU); c.stroke(); }
    }
  }
  if (g.bar[0] + g.bar[1] > 0) { const bc = barCenter(); U.text('BAR', bc.x, bc.y + 4, 15, 'rgba(232,196,106,0.7)', UI, 800); }
  // landing markers
  for (const d of st.dests) if (d.to < 24) {
    const n = Math.abs(g.board[d.to]); const p = stackPos(d.to, n === 0 || own(g, 0, d.to) < 0 ? 0 : n, n + 1);
    c.strokeStyle = `rgba(255,240,170,${0.6 + pulse * 0.4})`; c.lineWidth = 3; c.setLineDash([7, 6]); c.beginPath(); c.arc(p.x, p.y, Rr(-2), 0, TAU); c.stroke(); c.setLineDash([]);
    if (own(g, 0, d.to) < 0) U.text('HIT', p.x, p.y + 5, 15, 'rgba(255,90,60,0.95)', UI, 800);
  }
  // Auto Play's REVEAL: every step of the move about to be played, ringed the same way Hint rings a single suggested move.
  const ringMove = (side, h) => {
    const f = h.from === BAR ? barPos(side, Math.max(0, g.bar[side] - 1), Math.max(1, g.bar[side])) : stackPos(h.from, Math.max(0, Math.abs(g.board[h.from]) - 1), Math.abs(g.board[h.from]) || 1);
    const to = landing(h.to, h.to === OFF ? g.off[side] : h.to === BAR ? 0 : Math.abs(g.board[h.to]) && own(g, side, h.to) > 0 ? Math.abs(g.board[h.to]) : 0, side);
    c.strokeStyle = '#7dffb0'; c.lineWidth = 4; c.beginPath(); c.arc(f.x, f.y, Rr(5), 0, TAU); c.stroke();
    c.setLineDash([10, 8]); c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(to.x, to.y); c.stroke(); c.setLineDash([]);
    c.fillStyle = `rgba(125,255,176,${0.25 + pulse * 0.3})`; c.beginPath(); c.arc(to.x, to.y, Rr(4), 0, TAU); c.fill(); c.strokeStyle = '#7dffb0'; c.beginPath(); c.arc(to.x, to.y, Rr(4), 0, TAU); c.stroke();
  };
  if (st.autoReveal) for (const h of st.autoReveal.steps) ringMove(st.autoReveal.side, h);
  if (st.hint) ringMove(0, st.hint);
  // a piece being dragged
  if (st.drag && st.drag.on) chk(c, set, 0, st.drag.x, st.drag.y, 1.14, 16);
  // the moving checker
  if (a && !a.done) drawMover(c, st, a, set, Rr);
  if (st.cursorOn && st.cursor != null) { const p = cursorPos(st.cursor, g); c.strokeStyle = '#7de0ff'; c.lineWidth = 3.5; c.setLineDash([6, 5]); c.beginPath(); c.arc(p.x, p.y, Rr(8), 0, TAU); c.stroke(); c.setLineDash([]); }

  // ---- dice, cube, buttons -----------------------------------------------------------------------------------------------------
  drawDice(c, st, U, pulse);
  drawCube(c, st, U, pulse);
  const BT = L.btn;
  if (st.autoMode) {
    if (sc !== 'over') {
      U.button(BT.menu, 'Menu', { size: 26 });
      U.button(BT.pause, st.autoPaused ? 'Resume' : 'Pause', { size: 26, primary: !!st.autoPaused });
      U.button(BT.thinkDec, '− Think', { size: 24, dim: st.autoThinkIdx <= 0 });
      U.button(BT.thinkInc, 'Think +', { size: 24, dim: st.autoThinkIdx >= THINK_STEPS.length - 1 });
    }
  } else {
    if (sc !== 'over') U.button(BT.menu, 'Menu', { size: 26 });
    const fin = (st.lesson && sc === 'lesson' && st.lesson.done) || (sc === 'puzzle' && st.pz?.status === 'solved');
    if (!fin && (sc === 'play' || sc === 'lesson' || sc === 'puzzle')) {
      U.button(BT.undo, 'Undo', { size: 26, dim: !st.canUndo });
      U.button(BT.hint, sc === 'puzzle' ? 'Reset' : `Hint (${st.hintsLeft})`, { size: 26, dim: sc !== 'puzzle' && st.hintsLeft <= 0 });
    }
  }
  if (st.thinking && !calm && !(st.phase === 'roll')) { const n = 1 + (Math.floor(t * 3) % 3), k = L.dice.think; U.text('Thinking' + '.'.repeat(n), k.x, k.y, 18, 'rgba(255,230,170,0.85)', UI, 700, k.align); }

  // ---- overlays ------------------------------------------------------------------------------------------------------------
  if (st.phase === 'cubeask') drawCubeAsk(c, st, U);
  if (st.lesson && sc === 'lesson' && st.lesson.done && !st.anim) U.button(L.done, st.lesson.i + 1 < LESSONS.length ? 'Next lesson' : 'Finish', { primary: true, size: 28 });
  if (sc === 'puzzle' && st.pz?.status === 'solved') U.button(L.done, 'Back to menu', { primary: true, size: 28 });
  if (sc === 'over') drawOver(c, st, U);
}

function badge(c, x, y, n, mt) {
  const r = Math.max(15, mt * 0.62);
  c.fillStyle = 'rgba(20,8,2,0.85)'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.strokeStyle = '#e6c56a'; c.lineWidth = 1.5; c.stroke();
  c.font = `800 ${Math.round(r * 1.2)}px ${UI}`; c.textAlign = 'center'; c.fillStyle = '#fff1c8'; c.fillText(String(n), x, y + r * 0.43);
}
function cursorPos(cu, g) {
  if (cu === BAR) return barPos(0, 0, 1);
  if (cu === OFF) { const T = trayRect(0); return { x: T.x + T.w / 2, y: T.y + T.h / 2 }; }
  const n = Math.abs(g.board[cu]); return stackPos(cu, Math.max(0, n - 1), Math.max(1, n));
}

// the animation keeps CANONICAL positions (so a rotation in mid-move cannot strand it); they are mapped to the screen here
function drawMover(c, st, a, set, Rr) {
  if (a.t < a.dur) {
    const f = Math.min(1, a.t / a.dur), e = a.kind === 'refuse' ? refuseCurve(f, a) : ease(f), A = M(a.from), Bp = M(a.to);
    const shake = a.kind === 'refuse' && !st.calm && f > 0.36 && f < 0.64 ? Math.sin(f * 90) * 5 * S : 0;
    const x = A.x + (Bp.x - A.x) * e + shake, y = A.y + (Bp.y - A.y) * e;
    const lift = Math.sin(Math.PI * Math.min(1, f)) * (a.kind === 'refuse' ? 14 : 30) + 8;
    chk(c, set, a.side, x, y, 1.06, lift);
    if (a.kind === 'move' && a.hit && f > 0.86) { c.strokeStyle = `rgba(255,220,120,${(f - 0.86) * 7})`; c.lineWidth = 3; c.beginPath(); c.arc(Bp.x, Bp.y, Rr() * (1 + (f - 0.86) * 5), 0, TAU); c.stroke(); }
  } else if (a.hit) {
    const f = Math.min(1, (a.t - a.dur) / a.hitDur), e = ease(f), h = a.hit, A = M(h.from), Bp = M(h.to), To = M(a.to);
    const x = A.x + (Bp.x - A.x) * e, y = A.y + (Bp.y - A.y) * e;
    chk(c, set, h.side, x, y, 1.02, Math.sin(Math.PI * f) * 44 + 4);
    c.strokeStyle = `rgba(255,220,120,${0.7 * (1 - f)})`; c.lineWidth = 3; c.beginPath(); c.arc(To.x, To.y, Rr() * (1.4 + f * 1.2), 0, TAU); c.stroke();
  }
}
const refuseCurve = (f) => { const out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4; return ease(out) * 0.7; };

// ---- dice ---------------------------------------------------------------------------------------------------------------
function drawDice(c, st, U, pulse) {
  const d = st.dice, DI = L.dice;
  if (!d.vals) {
    // waiting to be rolled: two resting dice and a call to action
    for (let i = 0; i < 2; i++) drawDie(c, [4, 2][i], DI.rest[i], DI.cy, { rot: i ? 0.12 : -0.1, ivory: st.g.turn === 0 || st.two });
    if (st.phase === 'roll' && (st.scene !== 'over')) {
      c.fillStyle = `rgba(255,225,130,${0.14 + pulse * 0.16})`; rrect(c, DI.x + 12, DI.y + 12, DI.w - 24, DI.h - 24, 10); c.fill();
      const k = DI.rollTxt, maxW = k.align === 'center' ? DI.w - 24 : DI.x + DI.w - 14 - k.x;
      U.fitText(st.g.turn === 0 || st.two ? 'TAP THE DICE TO ROLL' : '', k.x, k.y, 22, maxW, '#ffe9a8', UI, 800, k.align);
      U.fitText(st.two ? (st.g.turn === 0 ? 'Player 1' : 'Player 2') : 'or press Space', k.x, k.y2, 17, maxW, 'rgba(255,233,168,0.8)', UI, 600, k.align);
    }
    return;
  }
  const roll = d.roll, vals = d.vals;
  for (let i = 0; i < 2; i++) {
    const rest = DI.rest[i];
    let x = rest, y = DI.cy, rot = i ? 0.1 : -0.08, sq = 1, lift = 0, face = vals[i];
    if (roll && roll.t < roll.dur) {
      const u = roll.t / roll.dur, k = 1 - u;
      const xs = DI.from[i], ys = DI.cy + (i ? 18 : -18);
      x = xs + (rest - xs) * (1 - k * k * k); y = ys + (DI.cy - ys) * u;
      lift = Math.abs(Math.sin(u * Math.PI * 3.2 + i)) * k * 54; rot = k * k * (9 + i * 5) * (i ? -1 : 1) + (i ? 0.1 : -0.08); sq = 1 - 0.16 * Math.abs(Math.sin(u * 24 + i * 2)) * k;
      if (u < 0.82) face = 1 + Math.floor(hash(Math.floor(u * 22) * 3 + i) * 6);
    }
    const used = st.left && st.phase !== 'rolling' && !st.left.includes(vals[i]) && vals[0] !== vals[1];
    drawDie(c, face, x, y, { rot, sq, lift, dim: !!used, ivory: d.side === 0 });
  }
  if (vals[0] === vals[1] && st.left && !(roll && roll.t < roll.dur)) U.text(`× ${st.left.length}`, DI.mult.x, DI.mult.y, 30, '#ffe9a8', UI, 800, 'left', true);
}
function drawCube(c, st, U, pulse) {
  const cb = st.cube; if (!cb.on) return;
  const { x, y, s } = L.cube, can = st.phase === 'roll' && st.canDouble;
  c.save(); c.translate(x, y);
  c.fillStyle = 'rgba(0,0,0,0.4)'; rrect(c, -s / 2 + 4, -s / 2 + 8, s, s, 10); c.fill();
  const g = c.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2); g.addColorStop(0, '#fffaea'); g.addColorStop(1, '#d6bd86'); c.fillStyle = g; rrect(c, -s / 2, -s / 2, s, s, 10); c.fill();
  c.strokeStyle = can ? `rgba(255,214,90,${0.6 + pulse * 0.4})` : 'rgba(110,74,20,0.8)'; c.lineWidth = can ? 4 : 1.5; c.stroke();
  const v = cb.owner === -1 ? 64 : cb.v;
  c.font = `800 ${v >= 10 ? 26 : 32}px ${FONT}`; c.textAlign = 'center'; c.fillStyle = '#5a1219'; c.fillText(String(v), 0, 11);
  c.restore();
  const narrow = L.narrowDice;
  U.text(cb.owner === -1 ? 'Cube' : cb.owner === 0 ? 'Yours' : 'Rival’s', x, narrow ? y + s / 2 + 22 : y + 52, 15, 'rgba(255,233,168,0.85)', UI, 700);
  if (can) U.text('TAP to double', x + 12, y - 42, 15, '#ffe9a8', UI, 800, narrow ? 'left' : 'center');
}
function drawCubeAsk(c, st, U) {
  const O = L.over, P = O.cpanel;
  c.fillStyle = 'rgba(8,4,2,0.55)'; c.fillRect(0, 0, L.w, L.h);
  U.panel(P.x, P.y, P.w, P.h, 0.97);
  U.fitText(st.cubeAsk.title, O.cx, O.cTitleY, 40, P.w - 40, '#f6dfae', FONT, 700, 'center', true);
  U.wrap(st.cubeAsk.body, O.cx, O.cBodyY, st.big ? 27 : 24, O.cBodyW, '#f6ead0', 33);
  U.button(O.take, 'Take', { primary: true, size: 30, sub: 'play on' });
  U.button(O.drop, 'Drop', { size: 30, sub: 'give up this game' });
}
function drawOver(c, st, U) {
  const O = L.over, P = O.panel;
  c.fillStyle = 'rgba(8,4,2,0.6)'; c.fillRect(0, 0, L.w, L.h);
  U.panel(P.x, P.y, P.w, P.h, 0.97);
  U.fitText(st.result.title, O.cx, O.titleY, 60, P.w - 40, '#f6dfae', FONT, 700, 'center', true);
  const lines = U.wrap(st.result.body, O.cx, O.bodyY, st.big ? 28 : 25, O.bodyW, '#f6ead0', 34);
  void lines;
  U.button(O.again, 'Play again', { primary: true, size: 30 });
  U.button(O.menu, 'Menu', { size: 26 });
  U.button(O.share, 'Share', { size: 26 });
  drawMoreLine(c, O.cx, O.moreY, Math.max(15, U.mt));
}
