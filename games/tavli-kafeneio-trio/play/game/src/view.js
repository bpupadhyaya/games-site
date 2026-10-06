// Everything drawn per frame. Reads `state` (see game.js) and changes nothing. The heavy art (table, board, checkers, dice faces)
// lives in cached sprites (art.js, sprites.js), so a frame is only a few dozen drawImage calls.
import { L, host, D, R, IN, CH, MID, PLEN, SLOT, TRAY, pointGeom, stackB, stackPos, barPos, offPos, trayCenter, toScreen, applyBoard, boardRect, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { BAR, OFF, PORTES, PLAKOTO, FEVGA, VARIANTS, pips, top, height, idxAt, distAt } from './rules.js';
import { drawStatic, rr, lin, meander } from './art.js';
import { drawChecker, drawChip, drawDie, drawLock, SET_NAMES } from './sprites.js';
import { LEVELS } from './ai.js';
import { ABOUT, HOWTO, RULES } from './text.js';
import { drawLockupImage, drawMoreLine } from './brand.js';

const FONT = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
const GREEK = '"Tavli Greek", Georgia, "Times New Roman", serif';
const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
export const GREEK_NAMES = ['Πόρτες', 'Πλακωτό', 'Φεύγα'];
const ease = (f) => f * f * (3 - 2 * f);
const rrect = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); };
const hash = (n) => { let x = Math.imul(n + 1, 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; return (x >>> 0) / 4294967296; };
const clampI = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

let MINF = 11;                                          // smallest text, in virtual units: about 11 css px on this screen

export function render(ctx, st) {
  const c = ctx, sc = st.scene, t = st.t, calm = st.calm;
  MINF = Math.min(19, Math.max(11, 11 / Math.max(0.2, host.px || 0.6)));
  drawStatic(c);
  if (!calm) { c.fillStyle = `rgba(255,200,120,${0.025 + 0.012 * Math.sin(t * 1.7) + 0.008 * Math.sin(t * 5.3)})`; c.fillRect(0, 0, L.w, Math.min(520, L.h)); }

  const text = (s, x, y, size, color = '#f6ecd0', font = UI, weight = 700, align = 'center', shadow = false) => {
    size = Math.max(size, MINF);
    c.textAlign = align; c.font = `${weight} ${size}px ${font}`;
    if (shadow) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillText(s, x + 1.5, y + 2.5); }
    c.fillStyle = color; c.fillText(s, x, y);
  };
  // shrink a single line until it fits maxW (never below the readable minimum)
  const fit = (s, maxW, size, weight = 700, font = UI) => { let z = Math.max(size, MINF); c.font = `${weight} ${z}px ${font}`; while (c.measureText(s).width > maxW && z > MINF) { z -= 1; c.font = `${weight} ${z}px ${font}`; } return z; };
  const fitText = (s, x, y, maxW, size, color, font = UI, weight = 700, align = 'center', shadow = false) => text(s, x, y, fit(s, maxW, size, weight, font), color, font, weight, align, shadow);
  const wrapLines = (s, size, maxW, weight = 600, font = UI) => {
    size = Math.max(size, MINF); c.font = `${weight} ${size}px ${font}`; const words = String(s).split(' '), lines = []; let cur = '';
    for (const w of words) {
      if (c.measureText(w).width > maxW) {                       // a word wider than the line (e.g. "dice-and-checkers" at 300%): break after a hyphen, else at a letter
        if (cur) { lines.push(cur); cur = ''; }
        let part = '';
        for (const ch of w) {
          if (part && c.measureText(part + ch).width > maxW) { const h = part.lastIndexOf('-'); if (h > 0 && h < part.length - 1) { lines.push(part.slice(0, h + 1)); part = part.slice(h + 1) + ch; } else { lines.push(part); part = ch; } } else part += ch;
        }
        cur = part; continue;
      }
      const t2 = cur ? cur + ' ' + w : w; if (c.measureText(t2).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t2;
    }
    lines.push(cur); return lines;
  };
  const wrap = (s, x, y, size, maxW, color, lh = size * 1.32, align = 'center', weight = 600) => { const ls = wrapLines(s, size, maxW, weight); ls.forEach((l, i) => text(l, x, y + i * lh, size, color, UI, weight, align)); return ls.length; };
  const button = (r, label, o = {}) => {
    c.save(); if (o.dim) c.globalAlpha = 0.45;
    const pp = st.ptr, pressed = !o.dim && pp && pp.x >= r.x && pp.x <= r.x + r.w && pp.y >= r.y && pp.y <= r.y + r.h;
    const dn = pressed || o.down ? 3 : 0, rad = Math.min(16, r.h * 0.26);
    // one fill (a very gentle top-to-bottom gradient), one crisp border, one soft shadow; pressed = sinks 3px and darkens
    c.fillStyle = 'rgba(0,0,0,0.34)'; rrect(c, r.x + 1, r.y + (dn ? 3 : 6), r.w, r.h, rad); c.fill();
    const g = c.createLinearGradient(0, r.y, 0, r.y + r.h);
    if (o.primary) { g.addColorStop(0, pressed ? '#d8a63f' : '#efc659'); g.addColorStop(1, pressed ? '#b8821f' : '#d9a640'); }
    else if (o.on) { g.addColorStop(0, pressed ? '#245f9c' : '#3a7cc0'); g.addColorStop(1, pressed ? '#164575' : '#2a64a6'); }
    else { g.addColorStop(0, pressed ? '#12426f' : '#1d5a92'); g.addColorStop(1, pressed ? '#0c335a' : '#154a7c'); }
    c.fillStyle = g; rrect(c, r.x, r.y + dn, r.w, r.h, rad); c.fill();
    c.strokeStyle = o.primary ? '#fff0b8' : o.on ? '#ffe9a0' : 'rgba(232,200,120,0.7)'; c.lineWidth = o.on ? 2.5 : 1.5; c.stroke();
    const size = fit(label, r.w - 20, Math.min(o.size ?? 28, r.h * 0.5), 700);
    const col = o.primary ? '#2a1606' : '#fbeecb';
    if (o.sub) { text(label, r.x + r.w / 2, r.y + r.h / 2 - 2, size, col, UI, 700); text(o.sub, r.x + r.w / 2, r.y + r.h / 2 + r.h * 0.28, fit(o.sub, r.w - 24, 19, 600), o.primary ? '#4a2c0c' : 'rgba(251,238,203,0.78)', UI, 600); }
    else text(label, r.x + r.w / 2, r.y + dn + r.h / 2 + size * 0.34, size, col, UI, 700);
    c.restore();
  };
  const panel = (x, y, w, h, alpha = 0.92) => {
    c.fillStyle = 'rgba(0,0,0,0.4)'; rrect(c, x + 3, y + 8, w, h, 22); c.fill();
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, `rgba(12,40,76,${alpha})`); g.addColorStop(1, `rgba(6,22,46,${alpha})`);
    c.fillStyle = g; rrect(c, x, y, w, h, 22); c.fill(); c.strokeStyle = 'rgba(240,214,140,0.8)'; c.lineWidth = 2; c.stroke();
    c.strokeStyle = 'rgba(240,214,140,0.3)'; c.lineWidth = 1; rrect(c, x + 8, y + 8, w - 16, h - 16, 16); c.stroke();
  };
  const U = { text, fit, fitText, wrap, wrapLines, button, panel };

  if (sc === 'title') drawTitle(c, st, U);
  else if (sc === 'setup') drawSetup(c, st, U);
  else if (sc === 'howto') drawDoc(c, st, U, 'How to play', HOWTO);
  else if (sc === 'about') drawDoc(c, st, U, 'About Tavli', ABOUT);
  else if (sc === 'rules') drawDoc(c, st, U, 'Rules', RULES);
  else if (sc === 'settings') drawSettings(c, st, U);
  else if (sc === 'demo-limit') drawDemoLimit(c, st, U);
  else drawBoardScene(c, st, U);
  if (st.paused) drawPause(c, st, U);
}

const scaleOf = (st) => TEXT_SCALES[clampI(st.textScaleIdx ?? 0, 0, TEXT_SCALES.length - 1)];
// the veil over the table on menu screens; on a tall portrait screen the wall (and the game title on it) stays clear above it
function veil(c, a, outer) { const y0 = outer ? Math.min(L.wall.h, L.h * 0.25) : 0; c.fillStyle = `rgba(8,22,42,${a})`; c.fillRect(0, y0, L.w, L.h - y0); }
function outerTitle(c, U, P, size = 96) { U.text('Tavli', L.w / 2, P.y - 100, size, '#f8efd2', FONT, 700, 'center', true); U.text('Τάβλι', L.w / 2, P.y - 52, 32, '#e8c56a', GREEK, 700); }

// ---- title ------------------------------------------------------------------------------------------------------------------
// Three small tiles that say what the three games are, drawn with the game's own checkers.
function miniGame(c, st, kind, r) {
  const set = st.set, { x, y, w, h } = r, sc = Math.min(1, h / 176, w / 212);
  c.save(); rrect(c, x, y, w, h, 16); c.clip();
  c.fillStyle = lin(c, x, y, x, y + h, [[0, 'rgba(16,50,92,0.95)'], [1, 'rgba(8,28,56,0.95)']]); c.fillRect(x, y, w, h);
  c.restore();
  c.strokeStyle = 'rgba(240,214,140,0.6)'; c.lineWidth = 1.5; rrect(c, x, y, w, h, 16); c.stroke();
  const cx = x + w / 2, cy = y + 52 * sc, s = 0.62 * sc, u = sc;
  if (kind === PORTES) { drawChecker(c, set, 0, cx - 20 * u, cy, s); drawChecker(c, set, 1, cx + 26 * u, cy + 4 * u, s, 6 * u); c.strokeStyle = '#ff9f7a'; c.lineWidth = 3; c.beginPath(); c.arc(cx + 26 * u, cy - 2 * u, 30 * u, 0.1, TAU - 0.1); c.stroke(); }
  else if (kind === PLAKOTO) { drawChecker(c, set, 1, cx - 10 * u, cy + 2 * u, s); drawChecker(c, set, 0, cx + 14 * u, cy, s); drawLock(c, cx - 22 * u, cy + 6 * u, 0.8 * u); }
  else { for (let i = 0; i < 3; i++) drawChecker(c, set, 0, cx - 36 * u + i * 36 * u, cy, s * 0.82); c.strokeStyle = '#e8c56a'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx - 54 * u, cy + 36 * u); c.lineTo(cx + 54 * u, cy + 36 * u); c.stroke(); }
  return sc;
}
function drawTitle(c, st, U) {
  const S = scaleOf(st), calm = st.calm, T = L.titleFor(!!st.saved);
  veil(c, 0.84, !T.wide && L.h >= 1300);
  const g = c.createRadialGradient(T.cx, T.titleY - 20, 20, T.cx, T.titleY + 60, 520); g.addColorStop(0, 'rgba(255,214,140,0.22)'); g.addColorStop(1, 'rgba(255,214,140,0)'); c.fillStyle = g; c.fillRect(0, 0, L.w, Math.min(L.h, 700));
  U.text('Tavli', T.cx + 2, T.titleY + 4, T.titleSize, 'rgba(0,0,0,0.55)', FONT, 700);
  U.text('Tavli', T.cx, T.titleY, T.titleSize, '#f8efd2', FONT, 700);
  U.text('Τάβλι', T.cx, T.greekY, T.greekSize, '#e8c56a', GREEK, 700);
  meander(c, T.meander.x, T.meander.y, T.meander.w, T.meander.h, { color: '#e8c56a', width: 1.5, shadow: false });
  T.tiles.forEach((r, i) => {
    const bob = calm ? 0 : Math.sin(st.t * 1.4 + i * 1.7) * 3, rr_ = { x: r.x, y: r.y + bob, w: r.w, h: r.h };
    const sc = miniGame(c, st, i, rr_);
    U.text(GREEK_NAMES[i], r.x + r.w / 2, rr_.y + 120 * sc, 30 * Math.max(sc, 0.8), '#f8efd2', GREEK, 700);
    U.fitText(VARIANTS[i].name, r.x + r.w / 2, rr_.y + 150 * sc, r.w - 12, 21 * Math.max(sc, 0.85), 'rgba(240,214,140,0.9)', UI, 700);
  });
  U.fitText('Hit. Pin. Block. Three games, one board.', T.tag.x, T.tag.y, T.tag.w, Math.round(T.tag.size * Math.min(S, 1.25)), '#f1e2b6', FONT, 700);
  const R_ = T.rows;
  if (R_.resume) U.button(R_.resume, 'Resume game', { primary: true, size: 30, sub: st.matchLabel || undefined });
  U.button(R_.play, 'Play', { primary: !R_.resume, size: 34 });
  U.button(R_.auto, 'Watch & Learn', { size: 28 });
  U.button(R_.howto, 'How to play', { size: 21 });
  U.button(R_.rules, 'Rules', { size: 21 });
  U.button(R_.about, 'About', { size: 21 });
  U.button(R_.settings, 'Settings', { size: 26 });
  if (st.stats.games) U.fitText(`Games played ${st.stats.games}  ·  won ${st.stats.wins}`, T.stats.x, T.stats.y, T.stats.w, Math.round(T.stats.size * Math.min(S, 1.6)), 'rgba(240,214,140,0.8)', UI, 600);
  if (st.msg) U.wrap(st.msg.text, T.msg.x, T.msg.y, Math.round(T.msg.size * Math.min(S, 1.4)), T.msg.w, '#ffe9b0', 28);
  drawLockupImage(c, T.lockup, 0.92, (st.afFlash || 0) > 0);   // the Arcforge credit (this game's themed lockup), bottom-centre under the menu
}

// ---- setup ------------------------------------------------------------------------------------------------------------------
function drawSetup(c, st, U) {
  const S = Math.min(scaleOf(st), 1.35), su = st.setup, SU = L.setup, P = SU.panel, k2 = SU.modeScale;
  veil(c, 0.84, SU.outer);
  if (SU.outer) outerTitle(c, U, P);
  U.panel(P.x, P.y, P.w, P.h, 0.94);
  U.text('New game', SU.heading.x, SU.heading.y, SU.heading.size, '#f8efd2', FONT, 700, 'center', true);
  const names = ['Portes', 'Plakoto', 'Fevga', 'The Greek match'];
  const blurb = [VARIANTS[0].blurb, VARIANTS[1].blurb, VARIANTS[2].blurb, 'All three in turn'];
  SU.modes.forEach((r, i) => {
    const sel = su.mode === i, cxm = r.x + r.w / 2;
    U.button(r, '', { on: sel });
    const yg = r.y + r.h * (SU.showBlurb ? 0.32 : 0.4), yn = r.y + r.h * (SU.showBlurb ? 0.54 : 0.72);
    if (i < 3) U.text(GREEK_NAMES[i], cxm, yg, Math.round(34 * Math.min(S, 1.1) * Math.max(k2, 0.8)), '#fff3cf', GREEK, 700);
    else { const gs = fit3(c, 'Πόρτες · Πλακωτό · Φεύγα', r.w - 20, 24, GREEK); c.font = `700 ${Math.max(gs, MINF)}px ${GREEK}`; if (c.measureText('Πόρτες · Πλακωτό · Φεύγα').width <= r.w - 14) U.text('Πόρτες · Πλακωτό · Φεύγα', cxm, yg, gs, '#fff3cf', GREEK, 700); }
    U.fitText(names[i], cxm, yn, r.w - 24, Math.round(22 * S), '#f1d98f', UI, 800);
    if (SU.showBlurb) {
      const bs = Math.round(17 * S), ls = U.wrapLines(blurb[i], bs, r.w - 28, 600);
      ls.slice(0, 2).forEach((l, kk) => U.text(l, cxm, r.y + r.h * 0.72 + kk * Math.round(19 * S), bs, 'rgba(251,238,203,0.85)', UI, 600));
    }
  });
  U.text('Match to', SU.labels.match.x, SU.labels.match.y, 22, '#e8c46a', UI, 800, 'left');
  [5, 7].forEach((n, i) => U.button(SU.match[i], `${n} points`, { size: 26, on: su.target === n, dim: su.mode !== 3 }));
  U.text('Opponent', SU.labels.opp.x, SU.labels.opp.y, 22, '#e8c46a', UI, 800, 'left');
  ['The computer', 'Two players'].forEach((n, i) => U.button(SU.opp[i], n, { size: 26, on: su.two === (i === 1) }));
  U.text('Computer level', SU.labels.level.x, SU.labels.level.y, 22, '#e8c46a', UI, 800, 'left');
  LEVELS.forEach((Lv, i) => U.button(SU.levels[i], Lv.name, { size: 21, on: su.level === i, dim: su.two }));
  U.wrap(su.two ? 'Two players share this phone.' : LEVELS[su.level].blurb, SU.hint.x, SU.hint.y, SU.hint.size, SU.hint.w, 'rgba(246,236,208,0.88)', SU.hint.lh);
  U.button(SU.start, 'Start', { primary: true, size: 34 });
  U.button(SU.back, 'Back', { size: 28 });
}
function fit3(c, s, maxW, size, font) { let z = size; c.font = `700 ${z}px ${font}`; while (c.measureText(s).width > maxW && z > 11) { z -= 1; c.font = `700 ${z}px ${font}`; } return z; }

// ---- reference pages ----------------------------------------------------------------------------------------------------------
function ruleArt(c, st, art, cx, y) {
  const set = st.set;
  if (art === 'checkers') { drawChecker(c, set, 0, cx - 140, y + 46, 1.3); drawChecker(c, set, 1, cx + 140, y + 46, 1.3); return 130; }
  if (art === 'dice') { drawDie(c, 5, cx - 60, y + 50, { rot: -0.1, ivory: true }); drawDie(c, 3, cx + 60, y + 50, { rot: 0.12, ivory: false }); return 130; }
  if (art === 'pin') { drawChecker(c, set, 1, cx - 34, y + 50, 1.2); drawChecker(c, set, 0, cx + 16, y + 50, 1.2); drawLock(c, cx - 62, y + 56, 1.25); return 130; }
  if (art === 'wall') { for (let i = 0; i < 6; i++) drawChecker(c, set, i % 2, cx - 215 + i * 86, y + 48, 0.95); c.strokeStyle = '#e8c56a'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx - 255, y + 98); c.lineTo(cx + 255, y + 98); c.stroke(); return 124; }
  return 0;
}
// One continuous scrolling reader: every entry of the document in order (art, headings, text) laid out at the size the reader chose
// (28 px x the text zoom, up to 300%). Drag, mouse wheel, keys and the scroll thumb move it.
const docCache = new Map();
function docFlow(U, c, doc, key, body, scale, art) {
  let f = docCache.get(key); if (f) return f;
  const size = Math.round(28 * scale), hSize = Math.round(33 * Math.min(scale, 1.3));
  const items = []; let y = 4;
  doc.forEach((pg, pi) => {
    const it = { pi, y, art: pg.art, parts: [] };
    if (pg.art) y += pg.art === 'wall' ? 124 : 130;
    y += Math.round(0.3 * size);
    for (const blk of pg.blocks) {
      const hl = blk.h ? U.wrapLines(blk.h, hSize, body.w, 800) : null, pl = U.wrapLines(blk.p, size, body.w, 500);
      it.parts.push({ hl, pl, y });
      if (hl) y += hl.length * hSize * 1.15 + size * 0.35;
      y += pl.length * size * 1.4 + size * 0.7;
    }
    it.h = y - it.y; y += size * 0.5; items.push(it);
  });
  f = { items, total: y, size, hSize }; docCache.set(key, f); if (docCache.size > 30) docCache.delete(docCache.keys().next().value);
  return f;
}
function drawDoc(c, st, U, title, doc) {
  const Dd = L.doc, P = Dd.panel, scale = scaleOf(st);
  veil(c, 0.6, Dd.outer);
  if (Dd.outer) outerTitle(c, U, P);
  U.panel(P.x, P.y, P.w, P.h, 0.95);
  const ts = Math.round(Dd.title.size * Math.min(scale, 1.15));
  U.fitText(title, Dd.title.x, Dd.title.y + ts * 0.2, Dd.title.maxW, ts, '#f8efd2', FONT, 700, 'center', true);
  U.button(Dd.dec, 'A−', { size: 28, dim: st.textScaleIdx === 0 });
  U.button(Dd.inc, 'A+', { size: 28, dim: st.textScaleIdx === TEXT_SCALES.length - 1 });
  c.save(); c.strokeStyle = 'rgba(240,214,140,0.4)'; c.lineWidth = 2; c.beginPath(); c.moveTo(Dd.rule.x0, Dd.rule.y); c.lineTo(Dd.rule.x1, Dd.rule.y); c.stroke(); c.restore();
  U.text(`Text size ${Math.round(scale * 100)}%`, Dd.cap.x, Dd.cap.y, 17, 'rgba(240,214,140,0.7)', UI, 700);
  const body = Dd.body, cx = body.x + body.w / 2;
  const F = docFlow(U, c, doc, `${st.scene}|${scale}|${Math.round(body.w)}`, body, scale), size = F.size, hSize = F.hSize;
  const maxScroll = Math.max(0, F.total - body.h + 6); st.docMax = maxScroll;
  if (st.jump != null) { const it = F.items[Math.min(st.jump, F.items.length - 1)]; st.scroll = Math.min(maxScroll, it ? it.y : 0); st.jump = null; }
  const sy = Math.min(st.scroll || 0, maxScroll);
  c.save(); c.beginPath(); c.rect(body.x - 6, body.y, body.w + 12, body.h); c.clip();
  for (const it of F.items) {
    const top = body.y + it.y - sy;
    if (top > body.y + body.h || top + it.h < body.y) continue;
    let y = top;
    if (it.art) y += ruleArt(c, st, it.art, cx, y);
    const base = body.y + it.y - sy;
    it.parts.forEach((pt) => {
      let yy = base + pt.y - it.y + Math.round(0.5 * (pt.hl ? hSize : size));
      if (pt.hl) { pt.hl.forEach((l, j) => U.text(l, body.x, yy + 6 + j * hSize * 1.15, hSize, '#e8c46a', UI, 800, 'left')); yy += pt.hl.length * hSize * 1.15 + size * 0.35; }
      pt.pl.forEach((l, j) => U.text(l, body.x, yy + j * size * 1.4, size, '#f6ecd4', UI, 500, 'left'));
    });
  }
  c.restore();
  if (maxScroll > 0) {                                  // scroll cue: a thin thumb on the right edge and a soft fade where more text continues
    const tr = body.h - 8, th = Math.max(36, tr * body.h / (F.total + 6)), ty = body.y + 4 + (tr - th) * (sy / maxScroll);
    c.fillStyle = 'rgba(240,214,140,0.5)'; rrect(c, body.x + body.w + 2, ty, 5, th, 2.5); c.fill();
    if (sy < maxScroll - 2) { const g = c.createLinearGradient(0, body.y + body.h - 40, 0, body.y + body.h); g.addColorStop(0, 'rgba(6,22,46,0)'); g.addColorStop(1, 'rgba(6,22,46,0.9)'); c.fillStyle = g; c.fillRect(body.x - 6, body.y + body.h - 40, body.w + 12, 40); }
  }
  U.text(maxScroll > 0 ? (sy >= maxScroll - 2 ? 'End' : 'Scroll: drag, wheel or arrow keys') : '', Dd.page.x, Dd.page.y, 18, 'rgba(240,214,140,0.6)', UI, 600);
  U.button(Dd.back, 'Back', { primary: true, size: 30 });
  U.button(Dd.next, 'Top', { size: 30, dim: sy < 4 });
}

function drawSettings(c, st, U) {
  const S = scaleOf(st), SS = L.settings, P = SS.panel;
  veil(c, 0.84, SS.outer);
  if (SS.outer) outerTitle(c, U, P);
  U.panel(P.x, P.y, P.w, P.h, 0.94);
  U.text('Settings', SS.heading.x, SS.heading.y, SS.heading.size, '#f8efd2', FONT, 700, 'center', true);
  const on = (b) => (b ? 'On' : 'Off');
  const sub = (s) => (S > 1.6 || SS.rows.sound.h < 70 ? undefined : s);
  U.button(SS.rows.sound, `Sound: ${on(st.sound)}`, { size: 30, sub: sub('Dice and checker clacks') });
  U.button(SS.rows.calm, `Reduced motion: ${on(st.calm)}`, { size: 30, sub: sub('Quicker moves, no bobbing') });
  U.button(SS.rows.set, `Checkers: ${SET_NAMES[st.set]}`, { size: 28, sub: sub('Tap to change') });
  U.button(SS.rows.auto, `Play forced moves for me: ${on(st.auto)}`, { size: 28, sub: sub('When only one move exists') });
  U.button(SS.text.dec, 'A−', { size: 30, dim: st.textScaleIdx === 0 });
  U.button(SS.text.inc, 'A+', { size: 30, dim: st.textScaleIdx === TEXT_SCALES.length - 1 });
  U.text(`Text size ${Math.round(S * 100)}%`, SS.text.mid.x + SS.text.mid.w / 2, SS.text.mid.y + SS.text.mid.h / 2 + 10, Math.round(26 * Math.min(S, 1.25)), '#f6ecd4', UI, 800);
  for (let i = 0; i < 2; i++) drawChecker(c, st.set, i, SS.sample.x - 60 + i * 120, SS.sample.y + 4, 1.1 * SS.k2);
  U.fitText('The sample text below grows with the setting.', SS.line.x, SS.line.y + 50 * SS.k2, SS.line.w, Math.round(24 * Math.min(S, 1.6)), 'rgba(246,236,208,0.85)', UI, 600);
  U.button(SS.back, 'Back', { primary: true, size: 30 });
}

function drawDemoLimit(c, st, U) {
  const Dm = L.demo, P = Dm.panel;
  c.fillStyle = 'rgba(8,22,42,0.86)'; c.fillRect(0, 0, L.w, L.h);
  U.panel(P.x, P.y, P.w, P.h, 0.96);
  U.fitText('That is the free preview', L.w / 2, Dm.titleY, P.w - 40, 46, '#f8efd2', FONT, 700);
  U.wrap('The full Tavli is on iPhone and Android: all three games, the Greek match, four computer levels, Watch and Learn and no ads.', L.w / 2, Dm.bodyY, Dm.size, Dm.bodyW, '#f6ecd4', Dm.size * 1.3);
  U.button(Dm.button, 'Back to the menu', { primary: true, size: 28 });
}

// ---- pause overlay ------------------------------------------------------------------------------------------------------------
function drawPause(c, st, U) {
  const Pz = L.pause, P = Pz.panel;
  c.fillStyle = 'rgba(4,12,26,0.72)'; c.fillRect(0, 0, L.w, L.h);
  U.panel(P.x, P.y, P.w, P.h, 0.97);
  U.text('Paused', L.w / 2, Pz.titleY, Pz.size, '#f8efd2', FONT, 700, 'center', true);
  U.fitText(st.autoMode ? 'Watch & Learn is frozen exactly where it stopped.' : 'The game is frozen exactly where it stopped.', L.w / 2, Pz.subY, P.w - 40, 21, 'rgba(240,214,140,0.85)', UI, 600);
  U.button(Pz.resume, 'Resume', { primary: true, size: 32 });
  U.button(Pz.restart, st.autoMode ? 'Watch again' : 'Abandon game', { size: 26 });
  U.button(Pz.menu, 'Menu', { size: 26 });
}

// ---- the board scenes ---------------------------------------------------------------------------------------------------------
// text drawn along a tray: turned with the board so it runs the length of the tray
function trayText(c, str, bx, by, size, color, weight = 700, align = 'center', shadow = false) {
  const p = toScreen(bx, by), z = Math.max(size * Math.max(L.s, 0.8), MINF);
  c.save(); c.translate(p.x, p.y); if (L.rot) c.rotate(-Math.PI / 2);
  c.textAlign = align; c.font = `${weight} ${z}px ${UI}`;
  if (shadow) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillText(str, 1.5, 2.5); }
  c.fillStyle = color; c.fillText(str, 0, 0); c.restore();
}
function homeBars(c, st) {
  const v = st.g.v;
  c.save(); applyBoard(c);
  const bar = (x, y0, y1, col) => { c.fillStyle = col; rrect(c, x, y0, 5, y1 - y0, 2.5); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 1; c.stroke(); };
  bar(CH.x0 - 9, IN.y0 + 6 * SLOT + 6, IN.y1 - 6, '#f4ecd2');                       // your home: points 1-6 (left column, bottom)
  if (v === FEVGA) bar(CH.x1 + 4, IN.y0 + 6, IN.y0 + 6 * SLOT - 6, '#3a2d22');        // the rival's home: points 13-18
  else bar(CH.x1 + 4, IN.y0 + 6 * SLOT + 6, IN.y1 - 6, '#3a2d22');                  // points 19-24
  c.restore();
  if (v === FEVGA) {
    c.font = `800 ${Math.max(11, MINF * 0.8)}px ${UI}`; c.textAlign = 'center'; c.fillStyle = 'rgba(255,240,200,0.8)';
    for (const i of [23, 11]) { const gm = pointGeom(i), p = toScreen(gm.edge + gm.dir * (PLEN + 15), gm.y + (L.rot ? 0 : 17)); c.fillText('HEAD', p.x, p.y + (L.rot ? 5 : 0)); }
  }
}

function drawBoardScene(c, st, U) {
  const g = st.g, set = st.set, sc = st.scene, t = st.t, calm = st.calm, a = st.anim, v = g.v, sS = L.s, Hd = L.hdr;
  const pulse = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * 5);
  const S = Math.min(scaleOf(st), 1.5);
  const twoUp = st.two || st.autoMode;

  // ---- header --------------------------------------------------------------------------------------------------------------
  U.text(VARIANTS[v].name, Hd.titleX, Hd.titleY, Hd.titleSize, '#f8efd2', FONT, 700, 'center', true);
  U.text(GREEK_NAMES[v], Hd.titleX, Hd.greekY, Hd.greekSize, '#e8c56a', GREEK, 700);
  if (Hd.mode === 'stack') {
    U.text(`${twoUp ? 'Light' : 'You'}  ${pips(g, 0)}`, Hd.pipX, Hd.pip1, Hd.pipSize, '#f6ecd0', UI, 700, 'right');
    U.text(`${twoUp ? 'Dark' : 'Rival'}  ${pips(g, 1)}`, Hd.pipX, Hd.pip2, Hd.pipSize, '#e8b98a', UI, 700, 'right');
    U.text('pips to go', Hd.pipX, Hd.pip3, 16, 'rgba(246,236,208,0.6)', UI, 600, 'right');
  } else {
    U.text(`${twoUp ? 'Light' : 'You'}  ${pips(g, 0)}`, Hd.pipX, Hd.pip1, Hd.pipSize, '#f6ecd0', UI, 700, 'left');
    U.text(`${twoUp ? 'Dark' : 'Rival'}  ${pips(g, 1)}`, Hd.pipX2, Hd.pip1, Hd.pipSize, '#e8b98a', UI, 700, 'right');
    U.text('pips to go', (Hd.pipX + Hd.pipX2) / 2, Hd.pip3, 16, 'rgba(246,236,208,0.6)', UI, 600, 'center');
  }
  const M = st.match;
  if (M) {
    const lab = M.mode === 3 ? `Match to ${M.target}  ·  ${twoUp ? 'Light' : 'You'} ${M.score[0]} – ${M.score[1]} ${twoUp ? 'Dark' : 'Rival'}  ·  game ${M.n + 1}` : 'Single game';
    const full = st.autoMode ? `Watch & Learn  ·  think time ${THINK_STEPS[st.autoThinkIdx]}s  ·  ${lab}` : lab;
    if (Hd.labelWrap) {
      // the narrow side panel: Watch & Learn's think time gets its own line, the match score wraps below it
      let y = Hd.labelY;
      if (st.autoMode) { U.fitText(`Watch & Learn  ·  think ${THINK_STEPS[st.autoThinkIdx]}s`, Hd.labelX, y, Hd.labelW, 18, '#e8c46a', UI, 800); y += 22; }
      U.wrap(st.autoMode ? lab.replace(/\s+·\s+game \d+$/, '') : lab, Hd.labelX, y, 18, Hd.labelW, '#e8c46a', 22, 'center', 800);
    } else U.fitText(full, Hd.labelX, Hd.labelY, Hd.labelW, 20, '#e8c46a', UI, 800);
  }
  // message banner
  const msg = st.msg?.text ?? st.status ?? '';
  const bn = Hd.banner, bw = bn.w, bh = bn.h;
  U.panel(bn.x, bn.y, bw, bh, 0.88);
  let size = Math.round(22 * S), ls = U.wrapLines(msg, size, bw - 36);
  const minS = Math.round(MINF);
  while (ls.length > Math.max(2, Math.floor((bh - 10) / (minS * 1.24))) && size > minS) { size -= 1; ls = U.wrapLines(msg, size, bw - 36); }
  while (ls.length * size * 1.24 > bh - 10 && size > minS) { size -= 1; ls = U.wrapLines(msg, size, bw - 36); }
  const lh = size * 1.22, y0 = bn.y + bh / 2 - ((ls.length - 1) * lh) / 2 + size * 0.34;
  ls.forEach((l, i) => U.text(l, bn.x + bw / 2, y0 + i * lh, size, '#fff3d6', UI, 600));

  // ---- trays ----------------------------------------------------------------------------------------------------------------
  const bearOff = st.dests.some((d) => d.to === OFF);
  for (let s = 0; s < 2; s++) {
    let n = g.off[s]; if (a && a.hide && a.hide.kind === 'off' && a.hide.side === s && !a.done) n -= 1;
    for (let k = 0; k < n; k++) {
      const p = offPos(s, k);
      c.save(); c.translate(p.x, p.y); if (L.rot) c.rotate(-Math.PI / 2); c.scale(Math.max(sS, 0.5), Math.max(sS, 0.5)); drawChip(c, set, s, 0, 0); c.restore();
    }
    const T = s === 0 ? TRAY.me : TRAY.opp, cyT = T.y + T.h / 2;
    if (!g.off[s] && !(s === 0 && bearOff)) trayText(c, twoUp ? `${s ? 'Dark' : 'Light'} bear-off tray` : s === 0 ? 'Your bear-off tray' : 'Rival’s bear-off tray', T.x + T.w / 2, cyT + 6, 17, 'rgba(255,235,190,0.34)');
    if (g.off[s] && g.off[s] < 10) trayText(c, `${g.off[s]} off`, T.x + T.w - 14, cyT + 8, 22, 'rgba(255,240,200,0.92)', 700, 'right', true);
  }
  if (bearOff) {
    const T = TRAY.me; c.save(); applyBoard(c);
    c.fillStyle = `rgba(255,222,120,${0.16 + pulse * 0.2})`; rrect(c, T.x - 4, T.y - 4, T.w + 8, T.h + 8, 12); c.fill();
    c.strokeStyle = `rgba(255,232,140,${0.6 + pulse * 0.4})`; c.lineWidth = 2.5 / Math.max(sS, 0.6); c.stroke(); c.restore();
    if (g.off[0] < 12) trayText(c, 'BEAR OFF HERE', T.x + T.w / 2, T.y + T.h / 2 + 8, 22, 'rgba(255,244,210,0.95)', 800, 'center', true);
  }
  homeBars(c, st);

  // ---- highlights on the points -----------------------------------------------------------------------------------------------
  if (st.dests.some((d) => d.to < 24)) {
    c.save(); applyBoard(c);
    for (const d of st.dests) if (d.to < 24) {
      const gm = pointGeom(d.to), y0 = gm.y - SLOT / 2 + 3, y1 = gm.y + SLOT / 2 - 3, tx = gm.edge + gm.dir * PLEN;
      c.beginPath(); c.moveTo(gm.edge, y0); c.lineTo(tx, gm.y - 1.5); c.lineTo(tx, gm.y + 1.5); c.lineTo(gm.edge, y1); c.closePath();
      c.fillStyle = `rgba(255,222,120,${0.2 + pulse * 0.22})`; c.fill(); c.strokeStyle = `rgba(255,236,150,${0.55 + pulse * 0.4})`; c.lineWidth = 2 / Math.max(sS, 0.6); c.stroke();
    }
    c.restore();
  }

  // ---- checkers ---------------------------------------------------------------------------------------------------------------
  const dragFrom = st.drag && st.drag.on ? st.drag.from : -9;
  const sources = new Set(st.sources || []);
  const rR = R * sS, lw = Math.max(1.5, 2.5 * Math.max(sS, 0.7));
  const drawStack = (idx) => {
    const val = g.board[idx]; if (!val) return;
    const side = val > 0 ? 0 : 1, nTop = Math.abs(val), pinS = g.pin[idx], H_ = nTop + (pinS ? 1 : 0), base = pinS ? 1 : 0;
    if (pinS) { const p0 = stackPos(idx, 0, H_, true); drawChecker(c, set, pinS - 1, p0.x, p0.y, sS); }
    for (let k = 0; k < nTop; k++) {
      const kk = k + base;
      if (k === nTop - 1 && a && !a.done && a.hide && a.hide.kind === 'pt' && a.hide.idx === idx && a.hide.side === side) continue;
      if (dragFrom === idx && k === nTop - 1) continue;
      const p = stackPos(idx, kk, H_, !!pinS), topC = k === nTop - 1;
      const lift = topC && st.sel === idx ? 12 * sS : 0;
      drawChecker(c, set, side, p.x, p.y, sS, lift);
      if (topC && H_ > 5) badge(c, p.x, p.y, H_, sS);
      if (topC && sources.has(idx) && st.sel !== idx && !calm && !st.drag?.on) { c.strokeStyle = `rgba(255,232,140,${0.25 + pulse * 0.5})`; c.lineWidth = lw; c.beginPath(); c.arc(p.x, p.y, rR + 3, 0, TAU); c.stroke(); }
      if (topC && st.sel === idx) { c.strokeStyle = 'rgba(255,240,160,0.95)'; c.lineWidth = lw * 1.2; c.beginPath(); c.arc(p.x, p.y - lift, rR + 3, 0, TAU); c.stroke(); }
    }
    if (pinS) { const b0 = stackB(idx, 0, H_, true), g0 = pointGeom(idx), lp = toScreen(b0.x - g0.dir * 18, b0.y + 22); drawLock(c, lp.x, lp.y, 0.9 * sS); }
  };
  for (let i = 0; i < 24; i++) drawStack(i);
  if (a && !a.done && a.ghost && a.t < a.dur) drawChecker(c, set, a.ghost.side, a.ghost.pos.x, a.ghost.pos.y, sS);
  for (let s = 0; s < 2; s++) {
    const n = g.bar[s], hideOne = a && !a.done && a.hit && a.hit.side === s ? 1 : 0;
    for (let k = 0; k < n - hideOne; k++) {
      if (st.drag?.on && dragFrom === BAR && s === 0 && k === n - 1) continue;
      const p = barPos(s, k, n), topC = k === n - 1;
      drawChecker(c, set, s, p.x, p.y, sS, topC && st.sel === BAR && s === 0 ? 12 * sS : 0);
      if (topC && n > 5) badge(c, p.x, p.y, n, sS);
      if (topC && s === 0 && sources.has(BAR)) { c.strokeStyle = `rgba(255,232,140,${0.4 + pulse * 0.5})`; c.lineWidth = lw * 1.2; c.beginPath(); c.arc(p.x, p.y - (st.sel === BAR ? 12 * sS : 0), rR + 3, 0, TAU); c.stroke(); }
    }
  }
  if (v === PORTES && g.bar[0] + g.bar[1] > 0) { const p = toScreen(CH.cx, MID + 4); U.text('BAR', p.x, p.y + (L.rot ? 5 : 0), 15 * Math.max(sS, 0.85), 'rgba(240,214,140,0.75)', UI, 800); }
  // landing markers: where the checker would sit, and HIT / PIN tags
  for (const d of st.dests) if (d.to < 24) {
    const p = landSlot(g, 0, d.to);
    c.strokeStyle = `rgba(255,240,170,${0.6 + pulse * 0.4})`; c.lineWidth = lw * 1.2; c.setLineDash([7, 6]); c.beginPath(); c.arc(p.x, p.y, rR - 2, 0, TAU); c.stroke(); c.setLineDash([]);
    const dd = (st.legal || []).find((x) => x.from === d.from && x.to === d.to);
    const tz = Math.max(15 * Math.max(sS, 0.8), MINF);
    if (dd && dd.hit) { c.fillStyle = 'rgba(255,100,70,0.95)'; c.font = `800 ${tz}px ${UI}`; c.textAlign = 'center'; c.fillText('HIT', p.x, p.y + tz * 0.33); }
    if (dd && dd.pin) { c.fillStyle = 'rgba(255,214,110,0.98)'; c.font = `800 ${tz}px ${UI}`; c.textAlign = 'center'; c.fillText('PIN', p.x, p.y + tz * 0.33); }
  }
  const ring = (f, to, col = '#7dffb0') => {
    c.strokeStyle = col; c.lineWidth = lw * 1.6; c.beginPath(); c.arc(f.x, f.y, rR + 5, 0, TAU); c.stroke();
    c.setLineDash([10, 8]); c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(to.x, to.y); c.stroke(); c.setLineDash([]);
    c.fillStyle = `rgba(125,255,176,${0.25 + pulse * 0.3})`; c.beginPath(); c.arc(to.x, to.y, rR + 4, 0, TAU); c.fill(); c.strokeStyle = col; c.beginPath(); c.arc(to.x, to.y, rR + 4, 0, TAU); c.stroke();
  };
  // Auto Play's REVEAL: every step of the move about to be played
  if (st.autoReveal) { const { side, steps } = st.autoReveal; for (const h of steps) ring(topSlot(g, side, h.from), landSlot(g, side, h.to)); }
  if (st.hint) { const h = st.hint; ring(topSlot(g, 0, h.from), landSlot(g, 0, h.to)); }
  if (st.drag && st.drag.on) drawChecker(c, set, 0, st.drag.x, st.drag.y, 1.14 * sS, 16 * sS);
  if (a && !a.done) drawMover(c, st, a, set);
  if (st.cursorOn && st.cursor != null) { const p = cursorPos(st.cursor, g); c.strokeStyle = '#7de0ff'; c.lineWidth = lw * 1.4; c.setLineDash([6, 5]); c.beginPath(); c.arc(p.x, p.y, rR + 8, 0, TAU); c.stroke(); c.setLineDash([]); }
  drawFx(c, st);

  // ---- dice and buttons ---------------------------------------------------------------------------------------------------------
  drawDice(c, st, U, pulse);
  const B = st.autoMode ? L.abtn : L.btn, Dc = L.dice;
  if (st.autoMode) {
    U.button(B.menu, 'Menu', { size: 24 });
    U.button(B.pause, 'Pause', { size: 24 });
    U.button(B.less, '− Think', { size: 22, dim: st.autoThinkIdx <= 0 });
    U.button(B.more, 'Think +', { size: 22, dim: st.autoThinkIdx >= THINK_STEPS.length - 1 });
    if (st.autoPhase === 'think') statusLine(U, Dc, `Thinking… ${Math.ceil(st.autoTimer)}s`, 'rgba(255,230,170,0.9)');
    if (st.autoPhase === 'reveal') statusLine(U, Dc, 'Here is the move it chose', '#9dffc4');
  } else if (sc !== 'over') {
    U.button(B.menu, 'Menu', { size: 26 });
    U.button(B.undo, 'Undo', { size: 26, dim: !st.canUndo });
    U.button(B.hint, `Hint (${st.hintsLeft})`, { size: 26, dim: st.hintsLeft <= 0 });
    U.button(B.pause, 'Pause', { size: 26 });
  }
  if (st.thinking && !calm && !st.autoMode) { const n = 1 + (Math.floor(t * 3) % 3); statusLine(U, Dc, 'Thinking' + '.'.repeat(n), 'rgba(255,230,170,0.85)'); }
  if (sc === 'over') drawOver(c, st, U);
}
// a one-line status under the dice (above the buttons); in the side panel it takes the dice card's lower line
function statusLine(U, Dc, str, color) {
  const q = Dc.think;
  U.text(str, q.x, q.y, 18, color, UI, 700, q.align);
}

// where the top checker of a stack / bar currently sits, and where a checker of `side` would land on `to`
function topSlot(g, side, from) {
  if (from === BAR) return barPos(side, Math.max(0, g.bar[side] - 1), Math.max(1, g.bar[side]));
  const H_ = Math.max(1, height(g, from));
  return stackPos(from, H_ - 1, H_, !!g.pin[from]);
}
function landSlot(g, side, to) {
  if (to === OFF) return offPos(side, g.off[side]);
  const own = top(g, side, to), opp = top(g, 1 - side, to);
  if (opp === 1 && g.v === PLAKOTO && !g.pin[to]) return stackPos(to, 1, 2, true);       // pins the lone checker: sits on top of it
  if (opp === 1 && g.v === PORTES) return stackPos(to, 0, 1);                           // a hit replaces it
  const n = own + (g.pin[to] ? 1 : 0);
  return stackPos(to, n, n + 1, !!g.pin[to]);
}
export { topSlot, landSlot };

function badge(c, x, y, n, sS = 1) {
  const r = 15 * Math.max(sS, 0.8);
  c.fillStyle = 'rgba(8,22,44,0.88)'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.strokeStyle = '#e6c56a'; c.lineWidth = 1.5; c.stroke();
  const z = Math.max(18 * Math.max(sS, 0.8), MINF);
  c.font = `800 ${z}px ${UI}`; c.textAlign = 'center'; c.fillStyle = '#fff1c8'; c.fillText(String(n), x, y + z * 0.36);
}
function cursorPos(cu, g) {
  if (cu === BAR) return barPos(0, 0, 1);
  if (cu === OFF) return trayCenter(0);
  return topSlot(g, 0, cu);
}

function drawMover(c, st, a, set) {
  const sS = L.s, rR = R * sS;
  if (a.t < a.dur) {
    const f = Math.min(1, a.t / a.dur), e = a.kind === 'refuse' ? refuseCurve(f, a) : ease(f);
    const shake = a.kind === 'refuse' && !st.calm && f > 0.36 && f < 0.64 ? Math.sin(f * 90) * 5 : 0;
    const x = a.from.x + (a.to.x - a.from.x) * e + shake, y = a.from.y + (a.to.y - a.from.y) * e;
    const lift = (Math.sin(Math.PI * Math.min(1, f)) * (a.kind === 'refuse' ? 14 : 30) + 8) * sS;
    drawChecker(c, set, a.side, x, y, 1.06 * sS, lift);
    if (a.kind === 'move' && (a.hit || a.pin) && f > 0.86) { c.strokeStyle = `rgba(255,220,120,${(f - 0.86) * 7})`; c.lineWidth = 3; c.beginPath(); c.arc(a.to.x, a.to.y, rR * (1 + (f - 0.86) * 5), 0, TAU); c.stroke(); }
  } else if (a.hit) {
    const f = Math.min(1, (a.t - a.dur) / a.hitDur), e = ease(f), h = a.hit;
    const x = h.from.x + (h.to.x - h.from.x) * e, y = h.from.y + (h.to.y - h.from.y) * e;
    drawChecker(c, set, h.side, x, y, 1.02 * sS, (Math.sin(Math.PI * f) * 44 + 4) * sS);
    c.strokeStyle = `rgba(255,220,120,${0.7 * (1 - f)})`; c.lineWidth = 3; c.beginPath(); c.arc(a.to.x, a.to.y, rR * (1.4 + f * 1.2), 0, TAU); c.stroke();
  }
}
const refuseCurve = (f) => { const out = f < 0.4 ? f / 0.4 : f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4; return ease(out) * 0.7; };

// little bursts for hits, pins, bearing off and wins (positions and angles are hashed from a counter: deterministic)
function drawFx(c, st) {
  const k = Math.max(L.s, 0.6);
  for (const f of st.fx || []) {
    const u = f.t / f.dur; if (u >= 1) continue;
    if (f.kind === 'ring') { c.strokeStyle = `rgba(${f.col},${0.8 * (1 - u)})`; c.lineWidth = 4 * (1 - u) + 1; c.beginPath(); c.arc(f.x, f.y, (14 + u * 70) * k, 0, TAU); c.stroke(); continue; }
    for (let i = 0; i < 12; i++) {
      const ang = hash(f.seed + i) * TAU, sp = (40 + hash(f.seed + 50 + i) * 90) * k, d = sp * ease(u);
      c.fillStyle = `rgba(${f.col},${0.9 * (1 - u)})`; c.beginPath(); c.arc(f.x + Math.cos(ang) * d, f.y + Math.sin(ang) * d - 20 * u, 4 * (1 - u) + 1, 0, TAU); c.fill();
    }
  }
}

// ---- dice -------------------------------------------------------------------------------------------------------------------------
function drawDice(c, st, U, pulse) {
  const d = st.dice, Dc = L.dice, REST = Dc.rest;
  if (!d.vals) {
    for (let i = 0; i < 2; i++) drawDie(c, [4, 2][i], REST[i], Dc.cy, { rot: i ? 0.12 : -0.1, ivory: st.g.turn === 0 || st.two });
    if (st.phase === 'roll') {
      c.fillStyle = `rgba(255,225,130,${0.14 + pulse * 0.16})`; rrect(c, Dc.x + 12, Dc.y + 12, Dc.w - 24, Dc.h - 24, 10); c.fill();
      const mine = st.g.turn === 0 || st.two, pr = Dc.prompt;
      const label = !mine ? '' : st.two ? `${st.g.turn === 0 ? 'Light' : 'Dark'}: TAP THE DICE` : 'TAP THE DICE TO ROLL';
      if (Dc.mode === 'row') {
        const ls = U.wrapLines(label, 21, pr.maxW, 800);
        ls.slice(0, 2).forEach((l, i) => U.text(l, pr.x, pr.y - 6 + i * 26, 21, '#ffe9a8', UI, 800, 'left'));
      } else {
        U.fitText(label, pr.x, pr.y, pr.maxW, 19, '#ffe9a8', UI, 800, 'center');
        if (!st.two && mine) U.text('or press Space', pr.x, pr.y2, 15, 'rgba(255,233,168,0.8)', UI, 600, 'center');
      }
    }
    return;
  }
  const roll = d.roll, vals = d.vals;
  for (let i = 0; i < 2; i++) {
    const rest = REST[i];
    let x = rest, y = Dc.cy, rot = i ? 0.1 : -0.08, sq = 1, lift = 0, face = vals[i];
    if (roll && roll.t < roll.dur) {
      const u = roll.t / roll.dur, k = 1 - u;
      const xs = Dc.start + i * 24, ys = Dc.cy + (i ? 18 : -18);
      x = xs + (rest - xs) * (1 - k * k * k); y = ys + (Dc.cy - ys) * u;
      lift = Math.abs(Math.sin(u * Math.PI * 3.2 + i)) * k * 54; rot = k * k * (9 + i * 5) * (i ? -1 : 1) + (i ? 0.1 : -0.08); sq = 1 - 0.16 * Math.abs(Math.sin(u * 24 + i * 2)) * k;
      if (u < 0.82) face = 1 + Math.floor(hash(Math.floor(u * 22) * 3 + i) * 6);
    }
    const used = st.left && st.phase !== 'rolling' && !st.left.includes(vals[i]) && vals[0] !== vals[1];
    drawDie(c, face, x, y, { rot, sq, lift, dim: !!used, ivory: d.side === 0 });
  }
  if (vals[0] === vals[1] && st.left && !(roll && roll.t < roll.dur)) U.text(`× ${st.left.length}`, Dc.mul.x, Dc.mul.y, 30, '#ffe9a8', UI, 800, 'left', true);
}

function drawOver(c, st, U) {
  const S = Math.min(scaleOf(st), 2), res = st.result, O = L.over, P = O.panel;
  c.fillStyle = 'rgba(4,12,26,0.66)'; c.fillRect(0, 0, L.w, L.h);
  U.panel(P.x, P.y, P.w, P.h, 0.97);
  U.fitText(res.title, O.titleX, O.titleY, O.titleW, Math.round(64 * Math.min(S, 1.2) * Math.max(O.q, 0.8)), '#f8efd2', FONT, 700, 'center', true);
  const bs = Math.round(25 * S * Math.max(O.q, 0.8));
  const n = U.wrap(res.body, O.bodyX, O.bodyY, bs, O.bodyW, '#f6ecd4', bs * 1.32);
  let y = O.bodyY + n * bs * 1.32 + 24;
  if (res.matchLine) { const ml = U.wrap(res.matchLine, O.bodyX, y, Math.round(26 * Math.min(S, 1.5) * Math.max(O.q, 0.8)), O.bodyW, '#e8c46a', 34, 'center', 800); y += ml * 34; }
  const gy = Math.max(y + 70, O.glyphMin);
  if (res.w >= 0 && gy + 80 < Math.min(O.glyphMax + 80, O.again.y - 10)) { drawChecker(c, st.set, res.w, O.glyphX, gy, 1.7); if (!st.calm) { c.strokeStyle = `rgba(255,224,140,${0.35 + 0.25 * Math.sin(st.t * 3)})`; c.lineWidth = 4; c.beginPath(); c.arc(O.glyphX, gy, 76, 0, TAU); c.stroke(); } }
  const again = res.next ? `Next: ${res.next}` : res.matchOver ? 'New match' : 'Play again';
  U.button(O.again, again, { primary: true, size: 30 });
  U.button(O.menu, 'Menu', { size: 26 });
  U.button(O.share, 'Share', { size: 26 });
  drawMoreLine(c, O.more.x, O.more.y, Math.max(16, MINF));        // quiet brand line (text only: it must never pull the player away)
}
