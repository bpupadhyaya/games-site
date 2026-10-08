// All drawing for Bonsai. Geometry comes from layout.js, art from art.js; nothing here changes game state.
import { playLayout, titleLayout, shelfLayout, docLayout, settingsLayout, overLayout, potLayout, briefLayout, pauseLayout, header, usable, TEXT_SCALES, THINK_STEPS, SPEEDS } from './layout.js';
import { SPECIES, STYLES, POTS, COMMISSIONS, SEASON_NAMES, YEAR, SEASON, potById, commissionById } from './species.js';
import { geo, makeTree, seasonIdx, wireStart, wireDrag, wireRelease, stepTree, descendants, wireCount, MAX_WIRES, SET_T } from './tree.js';
import { measure, judge, CRITERIA, CRIT_NAME } from './judge.js';
import { drawRoom, drawShelfBoard, drawPot, drawPotBack, drawSoilFront, drawTree, drawForecast, strokePoly, drawSnap, snapOf, leafState, rgb } from './art.js';
import { demoTree } from './demo.js';
import { DOCS } from './content.js';
import { drawCredit } from './brand.js';
import { C, SANS, SERIF, rr, txt, para, panel, button, toolButton, icon, stars } from './ui.js';

export const metrics = { max: 0, rect: null };
export const SETTINGS = [
  { id: 'forecast', label: 'Growth forecast lines', opts: ['On', 'Off'] },
  { id: 'think', label: 'Watch and Learn thinking time', opts: ['2 s', '5 s', '8 s', '10 s'] },
  { id: 'sound', label: 'Sound', opts: ['On', 'Off'] },
  { id: 'calm', label: 'Falling leaves and petals', opts: ['Full', 'Calm'] },
  { id: 'restore', label: 'Purchases', opts: ['Restore purchase'] },
];
export function settingIndex(S, id) {
  const p = S.prefs;
  switch (id) {
    case 'forecast': return p.forecast ? 0 : 1;
    case 'think': return p.thinkIdx;
    case 'sound': return p.sound ? 0 : 1;
    case 'calm': return p.calm ? 1 : 0;
    default: return -1;
  }
}
const scaleOf = (S) => TEXT_SCALES[S.prefs.textIdx] ?? 1;
const flashOf = (S, id) => (S.flash && S.flash.id === id ? 1 - S.flash.t / 0.25 : 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);
const PRESENT_YT = 19.5;

// ---- camera ----------------------------------------------------------------------------------------------------------------------
export function camTarget(T, pot, board, margin = 34) {
  const b = geo(T).bounds, x0 = Math.min(b.x0, -pot.w / 2) - margin, x1 = Math.max(b.x1, pot.w / 2) + margin, y0 = Math.min(b.y0, -20) - margin, y1 = Math.max(b.y1, pot.d + 52) + margin * 0.6;
  const k = clamp(Math.min(board.w / (x1 - x0), board.h / (y1 - y0)), 0.3, 2.2);
  const cy = (y1 - y0) * k < board.h ? y1 - board.h / (2 * k) + 6 / k : (y0 + y1) / 2;
  return { cx: (x0 + x1) / 2, cy, k };
}
export const toWorld = (cam, bd, sx, sy) => ({ x: cam.cx + (sx - (bd.x + bd.w / 2)) / cam.k, y: cam.cy + (sy - (bd.y + bd.h / 2)) / cam.k });
export const toScreen = (cam, bd, wx, wy) => ({ x: bd.x + bd.w / 2 + (wx - cam.cx) * cam.k, y: bd.y + bd.h / 2 + (wy - cam.cy) * cam.k });

// ---- backgrounds ---------------------------------------------------------------------------------------------------------------
function paper(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f3ead8'); g.addColorStop(1, '#e4d7bc'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const v = ctx.createRadialGradient(w / 2, h * 0.4, Math.min(w, h) * 0.3, w / 2, h * 0.4, Math.max(w, h) * 0.8); v.addColorStop(0, 'rgba(255,255,255,0.18)'); v.addColorStop(1, 'rgba(90,60,30,0.16)'); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
}
const spaced = (ctx, str, x, y, track, o = {}) => {
  const { size = 20, weight = 600, color = C.dim, align = 'center', serif = false } = o;
  ctx.font = `${weight} ${size}px ${serif ? SERIF : SANS}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = color;
  const ws = [...str].map((ch) => ctx.measureText(ch).width), total = ws.reduce((a, b) => a + b + track, -track);
  let cx = align === 'center' ? x - total / 2 : x;
  [...str].forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += ws[i] + track; });
};

// ---- the world: shelf, pot, tree, in the current transform ----------------------------------------------------------------------------
function paintShadow(ctx, T, G, yt) {
  const ls = leafState(SPECIES[T.species], yt), a = 0.05 * Math.min(1, ls.full + 0.3);
  ctx.save(); ctx.fillStyle = `rgba(70,46,24,${a})`; ctx.lineCap = 'round';
  for (const p of G.pads) { ctx.beginPath(); ctx.arc(p.x + p.r * 0.5 + 18, p.y + p.r * 0.2 + 10, p.r * Math.pow(ls.full, 0.6), 0, 7); ctx.fill(); }
  ctx.strokeStyle = `rgba(70,46,24,${a * 1.2})`;
  for (const L of T.limbs) { ctx.lineWidth = Math.max(2, L.segs[0].th); ctx.beginPath(); L.g.pts.forEach((p, i) => (i ? ctx.lineTo(p.x + 20, p.y + 11) : ctx.moveTo(p.x + 20, p.y + 11))); ctx.stroke(); }
  ctx.restore();
}
export function paintWorld(ctx, T, pot, yt, o = {}) {
  const G = geo(T);
  const tb = pot.d + 46 + 4;
  drawShelfBoard(ctx, 0, pot.d, 3000, yt);
  const fg = ctx.createLinearGradient(0, tb, 0, tb + 400); fg.addColorStop(0, '#3a2616'); fg.addColorStop(1, '#241810'); ctx.fillStyle = fg; ctx.fillRect(-3000, tb, 6000, 4000);
  drawPot(ctx, pot, yt); drawPotBack(ctx, pot, yt);
  paintShadow(ctx, T, G, yt);
  drawTree(ctx, T, { yt, leaf: o.leaf, t: o.t, budPulse: o.budPulse, wires: o.wires });
  drawSoilFront(ctx, pot, yt, T.comId ? T.comId.charCodeAt(1) : 3);
  if (o.forecast) drawForecast(ctx, T, T.species);
}
// A framed stage showing a whole tree auto-fitted into rect r (title, pot choice, judging, figures, shelf).
export function drawStage(ctx, S, r, T, o = {}) {
  const pot = potById(o.potId ?? T.potId ?? 'drum'), yt = o.yt ?? PRESENT_YT, cam = camTarget(T, pot, r, o.margin ?? 30);
  ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, o.radius ?? 22); ctx.clip();
  drawRoom(ctx, r, yt, S.t);
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.scale(cam.k, cam.k); ctx.translate(-cam.cx, -cam.cy);
  paintWorld(ctx, T, pot, yt, { leaf: o.leaf, t: S.t, wires: o.wires });
  if (o.after) o.after(ctx, cam);
  ctx.restore();
  if (o.stroke !== false) { rr(ctx, r.x, r.y, r.w, r.h, o.radius ?? 22); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(60,40,20,0.35)'; ctx.stroke(); }
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------
function drawTitle(ctx, S, w, h) {
  paper(ctx, w, h);
  const sc = scaleOf(S), T = titleLayout(w, h, !!S.saved, sc), hero = T.hero, k = Math.min(sc, 1.35), fs = 30 * k;
  const stage = { x: hero.x + 12, y: hero.y + 8, w: hero.w - 24, h: hero.h - (T.mode === 'land' ? 130 : 150) };
  const tree = demoTree('c4', 80);
  drawStage(ctx, S, stage, tree, { potId: 'round', margin: 28 });
  const ty = stage.y + stage.h + 64;
  const ts = Math.min(hero.w * 0.13, 84);
  txt(ctx, 'BONSAI', hero.x + hero.w / 2, ty - ts * 0.1, { size: ts, weight: 700, color: C.ink, align: 'center', serif: true, maxW: hero.w - 30 });
  spaced(ctx, 'PRUNE  AND  SHAPE', hero.x + hero.w / 2, ty + ts * 0.5, ts * 0.12, { size: Math.max(15, ts * 0.2), color: C.moss, weight: 700 });
  const B = T.buttons;
  if (B.continue) { const sv = commissionById(S.saved.com); button(ctx, B.continue, 'Continue', { kind: 'gold', size: fs, sub: `${sv.name}  -  year ${S.saved.year}`, flash: flashOf(S, 'continue'), serif: true }); }
  button(ctx, B.play, 'Choose a Tree', { kind: B.continue ? 'solid' : 'gold', size: fs, flash: flashOf(S, 'play'), serif: true });
  button(ctx, B.learn, 'Watch and Learn', { size: fs * 0.92, flash: flashOf(S, 'learn'), ico: 'play' });
  button(ctx, B.howto, 'How to Play', { size: fs * 0.8, flash: flashOf(S, 'howto') });
  button(ctx, B.rules, 'Rules', { size: fs * 0.8, flash: flashOf(S, 'rules') });
  button(ctx, B.lessons, 'Lessons', { size: fs * 0.8, flash: flashOf(S, 'lessons') });
  button(ctx, B.about, 'About', { size: fs * 0.8, flash: flashOf(S, 'about') });
  button(ctx, B.settings, 'Settings', { size: fs * 0.8, flash: flashOf(S, 'settings') });
  drawCredit(ctx, T.brand.x, T.brand.y, 13, { dim: 0.9 });
}

// ---- scrolling bodies -------------------------------------------------------------------------------------------------------------------
function scrollBody(ctx, S, rect, draw) {
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  ctx.translate(0, -S.scrollY);
  const ch = draw();
  ctx.restore();
  metrics.rect = rect; metrics.max = Math.max(0, ch - rect.h);
  if (metrics.max > 0) { const bh = Math.max(40, rect.h * (rect.h / ch)), by = rect.y + (rect.h - bh) * (S.scrollY / metrics.max); rr(ctx, rect.x + rect.w - 5, by, 4, bh, 2); ctx.fillStyle = 'rgba(75,123,72,0.6)'; ctx.fill(); }
}
function head(ctx, S, H, title, o = {}) {
  button(ctx, H.back, o.backLabel ?? 'Menu', { ico: 'back', size: 26, flash: flashOf(S, 'back') });
  button(ctx, H.dec, 'A-', { size: 26, disabled: S.prefs.textIdx === 0, flash: flashOf(S, 'tdec') });
  button(ctx, H.inc, 'A+', { size: 26, disabled: S.prefs.textIdx >= TEXT_SCALES.length - 1, flash: flashOf(S, 'tinc') });
  txt(ctx, title, H.title.x + H.title.w / 2, H.title.y + H.title.h / 2, { size: 40, weight: 700, color: C.ink, align: 'center', serif: true, maxW: H.title.w, min: 20 });
}

// ---- shelf (choose a tree / showcase) ------------------------------------------------------------------------------------------------
const saplings = new Map();
function saplingSnap(id) { if (!saplings.has(id)) { const T = makeTree(id); geo(T); saplings.set(id, snapOf(T)); } return saplings.get(id); }
function drawShelf(ctx, S, w, h) {
  paper(ctx, w, h);
  const sc = scaleOf(S), SL = shelfLayout(w, h, sc, COMMISSIONS.length), ks = Math.min(sc, 2.2);
  head(ctx, S, SL, 'Choose a Tree');
  scrollBody(ctx, S, SL.body, () => {
    COMMISSIONS.forEach((com, i) => {
      const r = SL.cards[i], rec = S.stats.c[com.id], sp = SPECIES[com.species], saved = S.savedMap[com.id];
      panel(ctx, r, { radius: 22, fill: C.paper, stroke: saved ? C.moss : C.line, lw: saved ? 3 : 1.5 });
      const th = { x: r.x + 10, y: r.y + 10, w: r.w - 20, h: r.w * 0.82 };
      ctx.save(); rr(ctx, th.x, th.y, th.w, th.h, 16); ctx.clip();
      const yt = 19.5, sg = ctx.createLinearGradient(0, th.y, 0, th.y + th.h); sg.addColorStop(0, '#f6ecd6'); sg.addColorStop(1, '#e2d2b2'); ctx.fillStyle = sg; ctx.fillRect(th.x, th.y, th.w, th.h);
      const snap = rec ? rec.snap : saplingSnap(com.id), b = snap.b, tw = Math.max(60, b[2] - b[0]) + 40, tH = Math.max(80, -b[1] + 70) + 20, kk = Math.min(th.w / tw, th.h / tH) * 0.92;
      const potB = potById(rec ? rec.pot : 'drum'), cxm = th.x + th.w / 2 - ((b[0] + b[2]) / 2) * kk, base = th.y + th.h - 24 - (potB.d * kk * 0.55);
      ctx.save(); ctx.translate(cxm, base); ctx.scale(kk, kk); drawPot(ctx, potB, yt); ctx.restore();
      const ls = leafState(sp, yt); drawSnap(ctx, snap, cxm, base, kk, rec ? ls.col : [Math.max(80, ls.col[0] - 20), ls.col[1], ls.col[2] - 10], sp.bark);
      ctx.restore();
      rr(ctx, th.x, th.y, th.w, th.h, 16); ctx.lineWidth = 1.2; ctx.strokeStyle = C.line; ctx.stroke();
      const ny = th.y + th.h + 24 * ks;
      txt(ctx, com.name, r.x + r.w / 2, ny, { size: 26 * ks, weight: 700, color: C.ink, align: 'center', serif: true, maxW: r.w - 20, min: 13 });
      txt(ctx, `${STYLES[com.style].name}  -  ${sp.name}`, r.x + r.w / 2, ny + 30 * ks, { size: 19 * ks, color: C.dim, align: 'center', maxW: r.w - 20, min: 10 });
      if (rec) { stars(ctx, r.x + r.w / 2 - 54 * ks, ny + 62 * ks, 20 * ks, rec.stars); txt(ctx, `Best ${rec.best}`, r.x + r.w / 2 + 40 * ks, ny + 62 * ks, { size: 20 * ks, weight: 600, color: C.moss, align: 'left', maxW: r.w * 0.34, min: 10 }); }
      else txt(ctx, `${com.years} years`, r.x + r.w / 2, ny + 62 * ks, { size: 20 * ks, color: C.faint, align: 'center', maxW: r.w - 20, min: 10 });
      if (saved) txt(ctx, 'In progress', r.x + r.w - 16, r.y + 26, { size: 18 * ks, weight: 700, color: C.onDark, align: 'right', maxW: r.w * 0.6, min: 9 });
      if (saved) { const tw2 = Math.min(r.w * 0.6, 150 * ks); rr(ctx, r.x + r.w - 10 - tw2, r.y + 10, tw2, 32 * ks, 12); ctx.fillStyle = C.moss; ctx.fill(); txt(ctx, 'In progress', r.x + r.w - 10 - tw2 / 2, r.y + 10 + 16 * ks, { size: 17 * ks, weight: 700, color: C.onDark, align: 'center', maxW: tw2 - 10, min: 9 }); }
      const f = flashOf(S, 'card' + i); if (f > 0) { rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.fillStyle = `rgba(255,255,255,${0.5 * f})`; ctx.fill(); }
    });
    return SL.contentH;
  });
}

// ---- briefing card -------------------------------------------------------------------------------------------------------------------------
function drawBrief(ctx, S, w, h) {
  paper(ctx, w, h);
  const com = commissionById(S.briefId), st = STYLES[com.style], sp = SPECIES[com.species], sc = scaleOf(S), BL = briefLayout(w, h, sc);
  panel(ctx, BL.card, { radius: 28, fill: C.paper, stroke: C.lineHi, lw: 2 });
  const b = BL.body, k = Math.min(sc, 2.2); let y = b.y;
  scrollBody(ctx, S, { x: b.x - 4, y: b.y, w: b.w + 8, h: b.h }, () => {
    let yy = b.y;
    yy += para(ctx, com.name, b.x, yy, b.w, { size: 44 * k, weight: 700, color: C.ink, serif: true, lh: 1.15 }) + 6;
    yy += para(ctx, `${sp.name} (${sp.jp})  -  ${st.name} (${st.jp})  -  ${com.years} years`, b.x, yy, b.w, { size: 25 * k, color: C.moss, weight: 600, lh: 1.3 }) + 12;
    const hero = clamp(b.w * 0.46, 150, 300);
    const sap = makeTree(com.id); geo(sap);
    drawStage(ctx, S, { x: b.x + (b.w - hero * 1.3) / 2, y: yy, w: hero * 1.3, h: hero }, sap, { potId: 'drum', yt: 6, margin: 22, radius: 18 });
    yy += hero + 14;
    yy += para(ctx, com.line, b.x, yy, b.w, { size: 27 * k, color: C.dim, italic: true, serif: true, lh: 1.32 }) + 10;
    yy += para(ctx, st.blurb, b.x, yy, b.w, { size: 26 * k, color: C.ink, lh: 1.32 }) + 12;
    yy += para(ctx, 'Goals', b.x, yy, b.w, { size: 30 * k, weight: 700, color: C.ink, serif: true }) + 4;
    for (const g of st.goals) { ctx.beginPath(); ctx.arc(b.x + 9 * k, yy + 15 * k, 5 * k, 0, 7); ctx.fillStyle = C.moss; ctx.fill(); yy += para(ctx, g, b.x + 28 * k, yy, b.w - 28 * k, { size: 26 * k, lh: 1.3 }) + 6; }
    void y;
    return yy - b.y + 10;
  });
  button(ctx, BL.begin, 'Begin', { kind: 'gold', size: 32, serif: true, flash: flashOf(S, 'begin') });
  button(ctx, BL.back, 'Back', { size: 28, flash: flashOf(S, 'bback') });
}

// ---- documents ------------------------------------------------------------------------------------------------------------------------------
function drawDoc(ctx, S, w, h) {
  paper(ctx, w, h);
  const sc = scaleOf(S), doc = DOCS[S.doc.kind], page = doc.pages[S.doc.page], DL = docLayout(w, h, sc), n = doc.pages.length;
  head(ctx, S, DL, doc.title);
  button(ctx, DL.prev, 'Prev', { size: 26, disabled: S.doc.page === 0, flash: flashOf(S, 'prev') });
  button(ctx, DL.next, 'Next', { size: 26, kind: S.doc.page < n - 1 ? 'gold' : 'solid', disabled: S.doc.page >= n - 1, flash: flashOf(S, 'next') });
  txt(ctx, `${S.doc.page + 1} / ${n}`, DL.count.x + DL.count.w / 2, DL.count.y + DL.count.h / 2, { size: 26, weight: 600, color: C.dim, align: 'center' });
  const textBlock = (x, y, width) => {
    let yy = y;
    yy += para(ctx, page.title, x, yy, width, { size: 40 * sc, weight: 700, color: C.moss, serif: true, lh: 1.2 }) + 14 * sc;
    for (const b of page.body) {
      if (b.p) yy += para(ctx, b.p, x, yy, width, { size: 28 * sc, color: C.ink, lh: 1.36 }) + 14 * sc;
      else if (b.h) yy += para(ctx, b.h, x, yy, width, { size: 32 * sc, weight: 700, color: C.ink }) + 8 * sc;
      else if (b.note) { const hh = para(ctx, b.note, x + 18 * sc, yy + 12 * sc, width - 36 * sc, { size: 25 * sc, color: C.mossDeep, lh: 1.32, draw: false }); rr(ctx, x, yy, width, hh + 24 * sc, 14); ctx.fillStyle = 'rgba(75,123,72,0.12)'; ctx.fill(); ctx.strokeStyle = C.line; ctx.stroke(); para(ctx, b.note, x + 18 * sc, yy + 12 * sc, width - 36 * sc, { size: 25 * sc, color: C.mossDeep, lh: 1.32 }); yy += hh + 38 * sc; }
      else if (b.li) for (const it of b.li) {
        const sz = 27 * sc; ctx.beginPath(); ctx.arc(x + 9 * sc, yy + sz * 0.62, 5 * sc, 0, 7); ctx.fillStyle = C.moss; ctx.fill();
        yy += para(ctx, it, x + 30 * sc, yy, width - 30 * sc, { size: sz, color: C.ink, lh: 1.32 }) + 10 * sc;
      }
    }
    return yy - y + 24;
  };
  if (DL.split) {
    if (page.fig) drawFigure(ctx, DL.fig, page.fig, S);
    scrollBody(ctx, S, DL.text, () => textBlock(DL.text.x, DL.text.y, DL.text.w - 14));
  } else {
    scrollBody(ctx, S, DL.body, () => {
      let y = DL.body.y;
      if (page.fig) { const fh = Math.min(DL.body.w, Math.max(240, DL.body.h * (sc > 1.6 ? 0.4 : 0.52)), 520); drawFigure(ctx, { x: DL.body.x + (DL.body.w - fh) / 2, y, w: fh, h: fh }, page.fig, S); y += fh + 16; }
      return y - DL.body.y + textBlock(DL.body.x, y, DL.body.w - 14);
    });
  }
}

// ---- settings --------------------------------------------------------------------------------------------------------------------------------
function drawSettings(ctx, S, w, h) {
  paper(ctx, w, h);
  const sc = scaleOf(S), SL = settingsLayout(w, h, sc, SETTINGS.length), k = Math.min(sc, 2.4);
  head(ctx, S, SL, 'Settings', { backLabel: S.back === 'play' ? 'Back' : 'Menu' });
  scrollBody(ctx, S, SL.body, () => {
    SETTINGS.forEach((row, i) => {
      const g = SL.rows[i]; panel(ctx, g.rect, { radius: 20 });
      txt(ctx, row.label, g.rect.x + 22, g.rect.y + 16 + 22 * k, { size: 28 * k, weight: 600, color: C.ink, maxW: g.rect.w - 44, min: 14 });
      const n = row.opts.length, cw = (g.ctrl.w - 8 * (n - 1)) / n, cur = settingIndex(S, row.id);
      row.opts.forEach((o, j) => button(ctx, { x: g.ctrl.x + j * (cw + 8), y: g.ctrl.y, w: cw, h: g.ctrl.h }, o, { size: 24, active: j === cur, radius: 14, kind: row.id === 'restore' ? 'gold' : 'solid', flash: flashOf(S, 'set' + i + '.' + j) }));
    });
    return SL.contentH;
  });
}

// ---- play -----------------------------------------------------------------------------------------------------------------------------------------------
const toolHelp = {
  snip: 'Snip: press a limb, slide to the spot, release to cut. Slide away from the tree to cancel.',
  pinch: 'Pinch: tap a soft growing tip to keep it short and dense, or a bud dot to rub it off.',
  wire: 'Wire: press a limb and drag the way it should bend. Tap a wired limb to take the wire off.',
};
function drawDial(ctx, S, r, T, com) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = Math.min(r.w, r.h) / 2 - 4, cols = ['#a8cf7d', '#5d9a55', '#d58a3a', '#9cb2c8'];
  ctx.save();
  cols.forEach((c, i) => { ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2 + (i * Math.PI) / 2 + 0.03, -Math.PI / 2 + ((i + 1) * Math.PI) / 2 - 0.03); ctx.lineWidth = R * 0.26; ctx.strokeStyle = c; ctx.lineCap = 'butt'; ctx.stroke(); });
  const a = -Math.PI / 2 + (T.t / YEAR) * Math.PI * 2, hx = cx + Math.cos(a) * R, hy = cy + Math.sin(a) * R;
  ctx.beginPath(); ctx.arc(hx, hy, R * 0.2, 0, 7); ctx.fillStyle = C.paper; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.restore();
  txt(ctx, `Year`, cx, cy - R * 0.28, { size: R * 0.3, color: C.dim, align: 'center', weight: 600 });
  txt(ctx, `${T.year} / ${com.years}`, cx, cy + R * 0.18, { size: R * 0.42, color: C.ink, align: 'center', weight: 700, serif: true, maxW: R * 1.2 });
}
function drawStatus(ctx, S, L, T, com) {
  const r = L.status, land = L.mode === 'land', si = seasonIdx(T);
  let line2;
  const a = S.auto;
  if (S.act) line2 = S.act.a.short + '...';
  else if (S.msg) line2 = S.msg.text;
  else if (a.on && a.text) line2 = a.text;
  else if (S.hint) line2 = S.hint.a.why;
  else line2 = toolHelp[S.tool];
  const fs = land ? 23 : 28;
  let y = r.y;
  y += para(ctx, `${SEASON_NAMES[si]}  -  Year ${T.year} of ${com.years}`, r.x, y, r.w, { size: fs, weight: 700, color: C.ink, serif: true, lh: 1.25 }) + 2;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x - 2, r.y, r.w + 4, r.h + 4); ctx.clip();
  const hot = S.msg || S.hint || a.text || S.act;
  para(ctx, line2, r.x, y, r.w, { size: land ? 21 : 24, weight: 400, color: hot ? C.mossDeep : C.dim, lh: 1.28 });
  ctx.restore();
}
function candidateOverlay(ctx, S, T, cam) {
  const d = S.drag; if (!d || !d.cand) return;
  const c = d.cand, u = 1 / cam.k;
  if (d.tool === 'snip') {
    const L = c.limb, doomed = [];
    const pts = [{ x: c.x, y: c.y }, ...L.g.pts.slice(c.seg + 1)];
    doomed.push([pts, L.segs.slice(c.seg).map((s) => s.th + 5)]);
    for (const k of T.limbs) if (k.par === L.id && k.at >= c.seg) for (const id of descendants(T, k.id)) { const q = T.limbs.find((z) => z.id === id); doomed.push([q.g.pts, q.segs.map((s) => s.th + 5)]); }
    ctx.save();
    for (const [pp, ww] of doomed) strokePoly(ctx, pp, ww, 'rgba(200,64,40,0.62)', 1);
    const ang = L.g.ang[c.seg] + Math.PI / 2, rr0 = (L.segs[c.seg].th + 10) * 0.9 + 6 * u;
    ctx.lineCap = 'round'; ctx.lineWidth = 3 * u; ctx.strokeStyle = '#fffaf0'; ctx.setLineDash([6 * u, 5 * u]); ctx.beginPath(); ctx.moveTo(c.x - Math.cos(ang) * rr0 * 1.4, c.y - Math.sin(ang) * rr0 * 1.4); ctx.lineTo(c.x + Math.cos(ang) * rr0 * 1.4, c.y + Math.sin(ang) * rr0 * 1.4); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 1.4 * u; ctx.strokeStyle = 'rgba(40,20,10,0.7)'; ctx.beginPath(); ctx.moveTo(c.x - Math.cos(ang) * rr0 * 1.4, c.y - Math.sin(ang) * rr0 * 1.4); ctx.lineTo(c.x + Math.cos(ang) * rr0 * 1.4, c.y + Math.sin(ang) * rr0 * 1.4); ctx.stroke();
    ctx.translate(c.x + 22 * u, c.y - 26 * u); ctx.scale(u * 1.7, u * 1.7); icon(ctx, 'snip', 0, 0, 30, '#2a2620');
    ctx.restore();
  } else if (d.tool === 'pinch') {
    const a = 0.5 + 0.5 * Math.sin(S.t * 9);
    ctx.save(); ctx.lineWidth = 3 * u; ctx.strokeStyle = `rgba(255,250,230,${0.7 + 0.3 * a})`; ctx.beginPath(); ctx.arc(c.x, c.y, (11 + a * 3) * u, 0, 7); ctx.stroke(); ctx.strokeStyle = 'rgba(60,90,50,0.8)'; ctx.lineWidth = 1.4 * u; ctx.stroke(); ctx.restore();
  }
}
function drawHintMark(ctx, S, cam) {
  const a = S.act ? S.act.a : S.hint ? S.hint.a : null; if (!a || a.x === undefined) return;
  const p = 0.5 + 0.5 * Math.sin(S.t * 5), u = 1 / cam.k;
  ctx.save(); ctx.lineWidth = 3.4 * u; ctx.strokeStyle = `rgba(255,248,214,${0.8 + 0.2 * p})`; ctx.setLineDash([9 * u, 7 * u]); ctx.lineDashOffset = -S.t * 30 * u;
  ctx.beginPath(); ctx.arc(a.x, a.y, (24 + p * 7) * u, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1.6 * u; ctx.strokeStyle = 'rgba(75,123,72,0.9)'; ctx.beginPath(); ctx.arc(a.x, a.y, (24 + p * 7) * u + 3.5 * u, 0, 7); ctx.stroke(); ctx.restore();
}
function drawParts(ctx, S, T) {
  const sp = SPECIES[T.species], col = leafState(sp, T.t).col;
  for (const p of S.parts) {
    const a = 1 - p.t / p.life;
    if (p.k === 'ring') { ctx.beginPath(); ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * (1 - a * a), 0, 7); ctx.lineWidth = 3 * a + 1; ctx.strokeStyle = `rgba(255,250,225,${a * 0.9})`; ctx.stroke(); }
    else if (p.k === 'leaf') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + p.t * p.spin); ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = rgb(p.c ?? col); ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, 7); ctx.fill(); ctx.restore(); }
    else if (p.k === 'petal') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + p.t * p.spin); ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = 'rgb(250,206,214)'; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.6, 0, 0, 7); ctx.fill(); ctx.restore(); }
    else if (p.k === 'snow') { ctx.globalAlpha = Math.min(1, a * 2) * 0.9; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + a * 0.5), 0, 7); ctx.fillStyle = `rgba(255,250,225,${a})`; ctx.fill(); }
  }
  for (const f of S.fall) {
    const a = 1 - f.t / f.life; ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(f.ox, f.oy + f.t * f.t * 90); ctx.translate(f.px, f.py); ctx.rotate(f.t * f.spin); ctx.translate(-f.px, -f.py);
    strokePoly(ctx, f.pts, f.th.map((t) => t + 1), 'rgb(104,78,58)', 1);
    const e = f.pts[f.pts.length - 1]; ctx.fillStyle = rgb(col, 0.9); ctx.beginPath(); ctx.arc(e.x, e.y, 13, 0, 7); ctx.fill();
    ctx.restore();
  }
}

function drawPlay(ctx, S, w, h) {
  const T = S.T, com = commissionById(T.comId), L = playLayout(w, h, S.auto.on), bd = L.board, pot = potById(T.potId ?? 'drum'), cam = S.cam;
  paper(ctx, w, h);
  // board
  ctx.save(); rr(ctx, bd.x, bd.y, bd.w, bd.h, 22); ctx.clip();
  drawRoom(ctx, bd, T.t, S.t);
  ctx.translate(bd.x + bd.w / 2, bd.y + bd.h / 2); ctx.scale(cam.k, cam.k); ctx.translate(-cam.cx, -cam.cy);
  const pulse = S.tool === 'pinch' ? 0.5 + 0.5 * Math.sin(S.t * 6) : 0;
  paintWorld(ctx, T, pot, T.t, { t: S.t, budPulse: pulse, forecast: S.prefs.forecast && !S.paused });
  candidateOverlay(ctx, S, T, cam);
  drawHintMark(ctx, S, cam);
  drawParts(ctx, S, T);
  if (S.drag && S.drag.tool === 'wire' && S.drag.limb && S.drag.pivot) { const pv = S.drag.pivot; ctx.beginPath(); ctx.arc(pv.x, pv.y, 6 / cam.k, 0, 7); ctx.fillStyle = 'rgba(255,250,230,0.9)'; ctx.fill(); }
  ctx.restore();
  rr(ctx, bd.x, bd.y, bd.w, bd.h, 22); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(60,40,20,0.4)'; ctx.stroke();
  // header
  const nm = L.head, st = STYLES[com.style];
  txt(ctx, com.name, nm.x + 8, nm.y + 22, { size: 36, weight: 700, color: C.ink, serif: true, maxW: nm.w - 8, min: 20 });
  txt(ctx, S.auto.on ? 'Watch and Learn' : `${st.name} - ${SPECIES[com.species].name}`, nm.x + 8, nm.y + 52, { size: 22, weight: 500, color: S.auto.on ? C.moss : C.dim, maxW: nm.w - 8, min: 12, italic: !S.auto.on });
  button(ctx, L.pause, '', { ico: S.paused ? 'play' : 'pause', size: 28, flash: flashOf(S, 'pause') });
  drawDial(ctx, S, L.dial, T, com);
  drawStatus(ctx, S, L, T, com);
  const B = L.btn;
  if (S.auto.on) {
    const A = L.rail;
    button(ctx, A.exit, 'Exit', { size: 25, flash: flashOf(S, 'aexit') });
    button(ctx, A.pause, S.auto.paused ? 'Resume' : 'Pause', { size: 25, kind: 'gold', ico: S.auto.paused ? 'play' : 'pause', flash: flashOf(S, 'apause') });
    button(ctx, A.dec, 'Think -', { size: 24, disabled: S.prefs.thinkIdx === 0, flash: flashOf(S, 'adec') });
    button(ctx, A.inc, 'Think +', { size: 24, disabled: S.prefs.thinkIdx >= THINK_STEPS.length - 1, flash: flashOf(S, 'ainc') });
    button(ctx, B.speed, `Think ${THINK_STEPS[S.prefs.thinkIdx]} s`, { size: 24, disabled: true });
    button(ctx, B.present, `Wires ${wireCount(T)} of ${MAX_WIRES}`, { size: 24, disabled: true });
  } else {
    toolButton(ctx, B.snip, 'Snip', 'snip', { active: S.tool === 'snip', flash: flashOf(S, 'snip') });
    toolButton(ctx, B.pinch, 'Pinch', 'pinch', { active: S.tool === 'pinch', flash: flashOf(S, 'pinch') });
    toolButton(ctx, B.wire, `Wire ${wireCount(T)}/${MAX_WIRES}`, 'wire', { active: S.tool === 'wire', flash: flashOf(S, 'wire') });
    toolButton(ctx, B.hint, 'Hint', 'hint', { active: !!S.hint, flash: flashOf(S, 'hint') });
    button(ctx, B.speed, `Speed x${SPEEDS[S.speed]}`, { size: 26, ico: 'speed', flash: flashOf(S, 'speed') });
    button(ctx, B.present, 'Present', { size: 26, kind: 'gold', ico: 'present', disabled: !S.canPresent, flash: flashOf(S, 'present') });
  }
  if (S.paused) drawPause(ctx, S, w, h);
}
function drawPause(ctx, S, w, h) {
  ctx.fillStyle = 'rgba(30,24,14,0.55)'; ctx.fillRect(0, 0, w, h);
  const PL = pauseLayout(w, h);
  panel(ctx, PL.card, { radius: 28, fill: C.paper, stroke: C.lineHi, lw: 2 });
  txt(ctx, 'Paused', PL.card.x + PL.card.w / 2, PL.card.y + 42, { size: 40, weight: 700, color: C.ink, align: 'center', serif: true });
  button(ctx, PL.resume, 'Resume', { kind: 'gold', size: 30, ico: 'play', flash: flashOf(S, 'resume') });
  button(ctx, PL.restart, 'Restart tree', { size: 28, ico: 'restart', flash: flashOf(S, 'restart') });
  button(ctx, PL.settings, 'Settings', { size: 28, flash: flashOf(S, 'psettings') });
  button(ctx, PL.menu, 'Menu (keep my tree)', { size: 26, flash: flashOf(S, 'pmenu') });
}

// ---- pot choice ---------------------------------------------------------------------------------------------------------------------------------------------
function drawPotScene(ctx, S, w, h) {
  paper(ctx, w, h);
  const PL = potLayout(w, h), T = S.T;
  head(ctx, S, PL, 'Choose a Pot', { backLabel: 'Tree' });
  drawStage(ctx, S, PL.board, T, { potId: S.potId });
  POTS.forEach((p, i) => {
    const r = PL.cards[i], on = S.potId === p.id;
    panel(ctx, r, { radius: 16, fill: on ? '#dfeadb' : C.paper, stroke: on ? C.moss : C.line, lw: on ? 3 : 1.4 });
    const k = Math.min((r.w * 0.66) / p.w, (r.h * 0.46) / p.d);
    ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h * 0.2 + 6); ctx.scale(k, k); drawPot(ctx, p, 8); ctx.restore();
    txt(ctx, p.name, r.x + r.w / 2, r.y + r.h - 18 - Math.min(r.h * 0.04, 4), { size: Math.min(26, r.h * 0.17), weight: 600, color: C.ink, align: 'center', maxW: r.w - 10, min: 11 });
    const f = flashOf(S, 'pot' + i); if (f > 0) { rr(ctx, r.x, r.y, r.w, r.h, 16); ctx.fillStyle = `rgba(255,255,255,${0.5 * f})`; ctx.fill(); }
  });
  button(ctx, PL.go, 'Present to the judge', { kind: 'gold', size: 32, serif: true, flash: flashOf(S, 'go') });
}

// ---- judging -----------------------------------------------------------------------------------------------------------------------------------------------------
function drawOver(ctx, S, w, h) {
  paper(ctx, w, h);
  const sc = scaleOf(S), O = overLayout(w, h), R0 = S.result, k = Math.min(sc, 2.4), com = commissionById(R0.com);
  drawStage(ctx, S, O.hero, S.T, { potId: R0.pot });
  const col = O.col;
  scrollBody(ctx, S, col, () => {
    let y = col.y;
    y += para(ctx, R0.total >= 85 ? 'Beautifully done' : R0.total >= 66 ? 'A good tree' : 'A tree with promise', col.x, y, col.w, { size: 46 * k, weight: 700, color: C.ink, serif: true, lh: 1.15 }) + 4;
    y += para(ctx, `${com.name}  -  ${STYLES[com.style].name}`, col.x, y, col.w, { size: 26 * k, color: C.dim, lh: 1.3 }) + 8;
    txt(ctx, `${R0.total}`, col.x + 54 * k, y + 44 * k, { size: 84 * k, weight: 700, color: C.moss, align: 'center', serif: true });
    txt(ctx, 'out of 100' + (R0.newBest ? '  -  new best' : ''), col.x + 112 * k, y + 54 * k, { size: 24 * k, color: C.dim, align: 'left', maxW: col.w - 112 * k - 190 * k, min: 12 });
    stars(ctx, col.x + col.w - 90 * k, y + 44 * k, 44 * k, R0.stars);
    y += 104 * k;
    CRITERIA.forEach((c, i) => {
      const sc0 = R0.score[c], t = ease(clamp((S.sceneT - 0.4 - i * 0.22) / 0.8, 0, 1));
      txt(ctx, CRIT_NAME[c], col.x, y + 18 * k, { size: 30 * k, weight: 700, color: C.ink, serif: true, maxW: col.w - 110 * k, min: 14 });
      txt(ctx, `${Math.round(sc0 * t)}`, col.x + col.w - 6, y + 18 * k, { size: 30 * k, weight: 700, color: sc0 >= 80 ? C.moss : sc0 >= 55 ? C.gold : C.red, align: 'right', serif: true });
      y += 40 * k;
      rr(ctx, col.x, y, col.w - 14, 14 * k, 7 * k); ctx.fillStyle = 'rgba(80,60,36,0.14)'; ctx.fill();
      rr(ctx, col.x, y, Math.max(14 * k, (col.w - 14) * (sc0 / 100) * t), 14 * k, 7 * k); ctx.fillStyle = sc0 >= 80 ? C.moss : sc0 >= 55 ? C.gold : C.red; ctx.fill();
      y += 24 * k;
      y += para(ctx, R0.why[c], col.x, y, col.w - 14, { size: 24 * k, color: C.dim, lh: 1.3 }) + 22 * k;
    });
    return Math.max(0, y - col.y + 10);
  });
  button(ctx, O.btns.next, R0.auto ? 'Watch again' : 'Next tree', { kind: 'gold', size: 26, flash: flashOf(S, 'next') });
  button(ctx, O.btns.menu, R0.auto ? 'Menu' : 'Shelf', { size: 26, flash: flashOf(S, 'menu') });
  button(ctx, O.btns.share, 'Share', { size: 26, flash: flashOf(S, 'share') });
}

function drawDemoLimit(ctx, S, w, h) {
  paper(ctx, w, h);
  const u = usable(w, h), cw = Math.min(640, u.w - 40), x = u.x0 + (u.w - cw) / 2, y = u.y0 + u.h * 0.28;
  panel(ctx, { x, y, w: cw, h: 400 }, { radius: 28, fill: C.paper, stroke: C.lineHi, lw: 2 });
  txt(ctx, 'That is the demo', x + cw / 2, y + 70, { size: 42, weight: 700, color: C.ink, align: 'center', serif: true, maxW: cw - 40, min: 20 });
  para(ctx, 'You have trained two trees. Get the full Bonsai on iPhone and Android for all eight trees, saved progress and no limits.', x + 36, y + 120, cw - 72, { size: 28, color: C.ink, align: 'center', lh: 1.4 });
  txt(ctx, 'Tap to return to the menu', x + cw / 2, y + 350, { size: 24, color: C.dim, align: 'center' });
}

// ---- figures: real art, used by Rules / How to Play / About / Lessons ---------------------------------------------------------------------------------
function styleSnap(id) {
  const P = (arr) => arr.map(([x, y]) => [x, y]);
  const trunk = [], br = [], pads = [];
  const bez = (n, f) => { const o = []; for (let i = 0; i <= n; i++) o.push(f(i / n)); return o; };
  const add = (p0, dir, len, up = 0.3, tw = 3) => { const pts = bez(5, (t) => [p0[0] + Math.cos(dir) * len * t, p0[1] + Math.sin(dir) * len * t - up * len * t * t]); br.push({ p: P(pts), w: [tw, tw * 0.8, tw * 0.6, tw * 0.5, tw * 0.4] }); const e = pts[5]; pads.push([e[0], e[1] - 6, 22 + len * 0.1]); pads.push([pts[3][0], pts[3][1] - 4, 15]); };
  let T0;
  if (id === 'formal') { T0 = bez(8, (t) => [0, -230 * t]); [[.25, 1, 92], [.38, -1, 86], [.5, 1, 70], [.62, -1, 60], [.74, 1, 44], [.84, -1, 34]].forEach(([t, s, l]) => add([0, -230 * t], s > 0 ? -0.18 : Math.PI + 0.18, l, 0.12)); pads.push([0, -246, 26]); }
  else if (id === 'informal') { T0 = bez(10, (t) => [38 * Math.sin(t * Math.PI * 2.2), -230 * t]); [[.3, 1, 80], [.45, -1, 70], [.58, 1, 58], [.72, -1, 46], [.84, 1, 34]].forEach(([t, s, l]) => { const p = [38 * Math.sin(t * Math.PI * 2.2), -230 * t]; add(p, s > 0 ? -0.2 : Math.PI + 0.2, l, 0.12); }); pads.push([T0[10][0], -246, 24]); }
  else if (id === 'slanting') { T0 = bez(8, (t) => [150 * t, -215 * t]); [[.3, -1, 80], [.5, 1, 70], [.68, 1, 56], [.82, 1, 40]].forEach(([t, s, l]) => add([150 * t, -215 * t], s > 0 ? -0.2 : Math.PI + 0.25, l, 0.1)); pads.push([156, -228, 26]); }
  else if (id === 'windswept') { T0 = bez(8, (t) => [100 * t, -205 * t]); [.25, .4, .55, .7, .85].forEach((t, i) => add([100 * t, -205 * t], -0.06 - i * 0.04, 110 - i * 12, 0.05)); pads.push([108, -216, 24]); }
  else { T0 = bez(10, (t) => [t < 0.45 ? 70 * t : 70 * 0.45 + 150 * (t - 0.45), t < 0.45 ? -230 * t : -230 * 0.45 + 380 * (t - 0.45) * (t - 0.45) * 2.4 + 20 * (t - 0.45)]); add(T0[3], Math.PI + 0.3, 60, 0.1); add(T0[6], 0.2, 70, 0.1); pads.push([T0[10][0], T0[10][1] + 6, 26]); }
  trunk.push({ p: P(T0), w: T0.map((_, i) => 12 - i * 0.9) });
  return { l: [...trunk, ...br], d: pads, b: [-120, -260, 200, 60] };
}
function miniPlace(ctx, r, fn, bg = true) {
  ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.clip();
  if (bg) { const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); g.addColorStop(0, '#f6ecd6'); g.addColorStop(1, '#e2d2b2'); ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h); }
  fn(); ctx.restore(); rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.lineWidth = 1.5; ctx.strokeStyle = C.line; ctx.stroke();
}
const trainedFig = new Map();
function figTree(kind) {   // small real trees prepared for pictures
  if (trainedFig.has(kind)) return trainedFig.get(kind);
  let T;
  if (kind === 'wire') { T = makeTree('c2'); for (let i = 0; i < 120; i++) stepTree(T, 0.2); geo(T); const L = T.limbs[0]; wireStart(T, L, 3); wireDrag(L, 0.75); wireRelease(L); for (let i = 0; i < 40; i++) stepTree(T, 0.2); geo(T); L.wire.age = 7; L.wire.set = true; stepTree(T, 0.01); const b = T.limbs.find((q) => q.ord === 1 && q.segs.length > 2); if (b) { wireStart(T, b, 0); wireDrag(b, -0.8); wireRelease(b); for (let i = 0; i < 10; i++) stepTree(T, 0.2); b.wire.age = 3; } geo(T); }
  else if (kind === 'cut') { T = makeTree('c1'); for (let i = 0; i < 160; i++) stepTree(T, 0.2); geo(T); }
  else if (kind === 'pinch') { T = makeTree('c5'); for (let i = 0; i < 140; i++) stepTree(T, 0.2); geo(T); }
  trainedFig.set(kind, T); return T;
}
export function drawFigure(ctx, r, name, S) {
  if (!name) return;
  const t = S.t;
  if (name.startsWith('tree:')) { const id = name.slice(5); drawStage(ctx, S, r, demoTree(id, 90), { potId: potById(STYLES[commissionById(id).style].pot).id }); return; }
  if (name === 'styles') {
    const ids = ['formal', 'informal', 'slanting', 'windswept', 'cascade'], cols = r.w > r.h * 1.1 ? 3 : 2, rows = Math.ceil(5 / cols), gw = (r.w - 10 * (cols - 1)) / cols, gh = (r.h - 10 * (rows - 1)) / rows;
    ids.forEach((id, i) => {
      const rect = { x: r.x + (i % cols) * (gw + 10), y: r.y + Math.floor(i / cols) * (gh + 10), w: gw, h: gh }, snap = styleSnap(id), sp = SPECIES.maple, ls = leafState(sp, 19);
      miniPlace(ctx, rect, () => { const kk = Math.min(rect.w / 360, (rect.h - 100) / 320); ctx.save(); ctx.translate(rect.x + rect.w / 2 - (id === 'slanting' || id === 'windswept' ? 40 : id === 'cascade' ? 30 : 0) * kk, rect.y + rect.h - 62); ctx.scale(kk, kk); drawPot(ctx, potById(STYLES[id].pot), 18); ctx.restore(); drawSnap(ctx, snap, rect.x + rect.w / 2 - (id === 'slanting' || id === 'windswept' ? 40 : id === 'cascade' ? 30 : 0) * kk, rect.y + rect.h - 62, kk, [Math.max(60, ls.col[0] - 50), 120, 70], [90, 66, 48]); txt(ctx, STYLES[id].name, rect.x + rect.w / 2, rect.y + 20, { size: Math.min(22, rect.w * 0.1), weight: 700, color: C.ink, align: 'center', serif: true, maxW: rect.w - 12, min: 10 }); });
    });
    return;
  }
  if (name === 'seasons') {
    const sp = SPECIES.maple, cw = (r.w - 30) / 4;
    ['Spring', 'Summer', 'Autumn', 'Winter'].forEach((nm, i) => {
      const rect = { x: r.x + i * (cw + 10), y: r.y + r.h * 0.12, w: cw, h: r.h * 0.76 }, yt = i * 8 + 4, ls = leafState(sp, yt);
      miniPlace(ctx, rect, () => { drawRoom(ctx, rect, yt, t); const cx = rect.x + rect.w / 2, by = rect.y + rect.h - 20; ctx.lineCap = 'round'; ctx.strokeStyle = rgb(sp.bark); ctx.lineWidth = rect.w * 0.08; ctx.beginPath(); ctx.moveTo(cx - rect.w * 0.1, by); ctx.quadraticCurveTo(cx + rect.w * 0.05, by - rect.h * 0.3, cx - rect.w * 0.02, by - rect.h * 0.55); ctx.stroke(); drawSnap(ctx, { l: [], d: ls.full > 0.05 ? [[cx - rect.w * 0.02, by - rect.h * 0.62, rect.w * 0.3 * Math.pow(ls.full, 0.6)], [cx + rect.w * 0.12, by - rect.h * 0.45, rect.w * 0.2 * Math.pow(ls.full, 0.6)], [cx - rect.w * 0.16, by - rect.h * 0.4, rect.w * 0.18 * Math.pow(ls.full, 0.6)]] : [] }, 0, 0, 1, ls.col, sp.bark); });
      txt(ctx, nm, rect.x + rect.w / 2, rect.y - 22, { size: 24, weight: 700, color: C.ink, align: 'center', serif: true });
    });
    return;
  }
  if (name === 'cut' || name === 'wire' || name === 'pinch') {
    const T = figTree(name); const pot = potById('drum');
    drawStage(ctx, S, r, T, { potId: 'drum', yt: name === 'pinch' ? 6 : 12, after: (g, cam) => {
      if (name === 'cut') { const L = T.limbs.find((q) => q.ord === 1 && q.segs.length > 3) ?? T.limbs[1], i = Math.min(2, L.segs.length - 1), a = L.g.pts[i], b = L.g.pts[i + 1], p = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; const doomed = L.g.pts.slice(i + 1); strokePoly(g, [p, ...doomed], L.segs.slice(i).map((s) => s.th + 5), 'rgba(200,64,40,0.62)'); const u = 1 / cam.k; g.save(); g.lineWidth = 3 * u; g.strokeStyle = '#fffaf0'; g.setLineDash([6 * u, 5 * u]); g.beginPath(); g.moveTo(p.x - 18 * u, p.y - 16 * u); g.lineTo(p.x + 18 * u, p.y + 16 * u); g.stroke(); g.restore(); g.save(); g.translate(p.x + 20 * u, p.y - 26 * u); g.scale(u * 1.7, u * 1.7); icon(g, 'snip', 0, 0, 30, '#2a2620'); g.restore(); }
      if (name === 'pinch') { for (const L of T.limbs) if (L.ord >= 1 && L.tip) { const e = L.g.pts[L.g.pts.length - 1], u = 1 / cam.k; g.save(); g.lineWidth = 2.4 * u; g.strokeStyle = 'rgba(255,250,230,0.9)'; g.beginPath(); g.arc(e.x, e.y, 9 * u, 0, 7); g.stroke(); g.restore(); break; } }
    } });
    void pot; return;
  }
  if (name === 'taper' || name === 'balance' || name === 'space') {
    const T = demoTree(name === 'balance' ? 'c3' : name === 'space' ? 'c4' : 'c1', 90);
    drawStage(ctx, S, r, T, { potId: 'round', after: (g, cam) => {
      const m = measure(T), u = 1 / cam.k;
      if (name === 'balance') { g.save(); g.strokeStyle = 'rgba(185,67,43,0.9)'; g.lineWidth = 2.4 * u; g.setLineDash([8 * u, 6 * u]); g.beginPath(); g.moveTo(0, 20); g.lineTo(0, -m.H - 30); g.stroke(); g.setLineDash([]); g.fillStyle = 'rgba(185,67,43,0.95)'; g.beginPath(); g.arc(m.comX, m.comY, 9 * u, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2 * u; g.stroke(); g.restore(); }
      if (name === 'taper') { const L = T.limbs[0]; g.save(); g.fillStyle = 'rgba(185,67,43,0.95)'; [0, Math.floor(L.segs.length / 2), L.segs.length - 1].forEach((i) => { const p = L.g.pts[i], th = L.segs[i].th; g.strokeStyle = 'rgba(185,67,43,0.95)'; g.lineWidth = 2.2 * u; g.beginPath(); g.moveTo(p.x - th * 0.5 - 6 * u, p.y); g.lineTo(p.x + th * 0.5 + 6 * u, p.y); g.stroke(); }); g.restore(); }
      if (name === 'space') { const b = geo(T).bounds; g.save(); g.strokeStyle = 'rgba(75,123,72,0.9)'; g.lineWidth = 2.4 * u; g.setLineDash([8 * u, 6 * u]); g.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); g.restore(); }
    } });
    return;
  }
  if (name === 'pots') {
    const cols = 3, rows = 2, gw = (r.w - 10 * (cols - 1)) / cols, gh = (r.h - 10 * (rows - 1)) / rows;
    POTS.forEach((p, i) => { const rect = { x: r.x + (i % cols) * (gw + 10), y: r.y + Math.floor(i / cols) * (gh + 10), w: gw, h: gh }; miniPlace(ctx, rect, () => { const k = Math.min((rect.w * 0.7) / p.w, (rect.h * 0.46) / p.d); ctx.save(); ctx.translate(rect.x + rect.w / 2, rect.y + rect.h * 0.26); ctx.scale(k, k); drawPot(ctx, p, 8); ctx.restore(); txt(ctx, p.name, rect.x + rect.w / 2, rect.y + rect.h - 16, { size: Math.min(22, rect.h * 0.15), weight: 600, color: C.ink, align: 'center', maxW: rect.w - 8, min: 10 }); }); });
    return;
  }
  if (name === 'judge') {
    miniPlace(ctx, r, () => {
      const vals = [88, 72, 94, 64, 100, 80]; let y = r.y + r.h * 0.08; const rh = (r.h * 0.86) / 6;
      CRITERIA.forEach((c, i) => { txt(ctx, CRIT_NAME[c], r.x + 20, y + rh * 0.3, { size: Math.min(26, rh * 0.42), weight: 700, color: C.ink, serif: true, maxW: r.w - 100, min: 11 }); txt(ctx, `${vals[i]}`, r.x + r.w - 20, y + rh * 0.3, { size: Math.min(26, rh * 0.42), weight: 700, color: C.moss, align: 'right', serif: true }); rr(ctx, r.x + 20, y + rh * 0.58, r.w - 40, rh * 0.18, rh * 0.09); ctx.fillStyle = 'rgba(80,60,36,0.14)'; ctx.fill(); rr(ctx, r.x + 20, y + rh * 0.58, (r.w - 40) * vals[i] / 100, rh * 0.18, rh * 0.09); ctx.fillStyle = C.moss; ctx.fill(); y += rh; });
    });
  }
}

// ---- entry --------------------------------------------------------------------------------------------------------------------------------------------------------------
export function render(ctx, S, view) {
  const w = view.width, h = view.height;
  switch (S.scene) {
    case 'title': drawTitle(ctx, S, w, h); break;
    case 'shelf': drawShelf(ctx, S, w, h); break;
    case 'brief': drawBrief(ctx, S, w, h); break;
    case 'play': drawPlay(ctx, S, w, h); break;
    case 'pot': drawPotScene(ctx, S, w, h); break;
    case 'over': drawOver(ctx, S, w, h); break;
    case 'doc': drawDoc(ctx, S, w, h); break;
    case 'settings': drawSettings(ctx, S, w, h); break;
    case 'demo-limit': drawDemoLimit(ctx, S, w, h); break;
    default: paper(ctx, w, h);
  }
  if (S.msg && S.scene !== 'play') {
    const a = Math.min(1, S.msg.t * 6, (S.msg.hold - S.msg.t) * 4), u = usable(w, h), my = S.scene === 'pot' ? u.y0 + 92 : u.y1 - 150;
    ctx.save(); ctx.globalAlpha = Math.max(0, a); const tw = Math.min(u.w - 40, 560); rr(ctx, u.x0 + (u.w - tw) / 2, my, tw, 66, 18); ctx.fillStyle = 'rgba(38,42,34,0.95)'; ctx.fill();
    txt(ctx, S.msg.text, u.x0 + u.w / 2, my + 33, { size: 25, color: C.onDark, align: 'center', maxW: tw - 30, min: 14 }); ctx.restore();
  }
}
void header; void SET_T; void SEASON; void judge;
