// Drawing for every screen. render() is the single entry point; the painting screens live in playview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, CJK, rgba, drawBackdrop, paperImage, drawMount, paintSeal, drawBrush, drawStar, mk } from './art.js';
import { txt, button, panel, rrect, chip, icon, wrap } from './ui.js';
import { renderDoc } from './docview.js';
import { renderPlay } from './playview.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { LESSONS, GROUPS, PAGE, CHAR_BOX, TYPES, targetPath } from './lessons.js';
import { BRUSH, synthSamples, paintSamples, toneAlpha } from './brush.js';
import { makeLayer, replay, drawLayer } from './ink.js';
import { lessonItems } from './layout.js';
import { drawCredit, drawMoreLine, edgeStroke, drawLockup } from './brand.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function titleText(ctx, cx, y, size, label, sub) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${size}px ${DISPLAY}`;
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  g.addColorStop(0, '#fff6dc'); g.addColorStop(0.55, '#ecd08a'); g.addColorStop(1, '#b78f3c');
  ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.1; ctx.strokeStyle = '#0b0f10'; ctx.strokeText(label, cx, y);
  ctx.shadowColor = 'rgba(236,208,138,0.35)'; ctx.shadowBlur = size * 0.2; ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.restore();
  if (sub) txt(ctx, sub, cx, y + size * 0.62, Math.max(22, size * 0.2), PAL.text, { align: 'center', weight: 600, maxW: ctx.measureText(label).width * 1.2 });
}

// A small picture of a lesson's model (cached): the strokes painted with the game's own brush on a paper tile.
const modelCache = new Map();
export function modelImage(lesson, px) {
  const key = lesson.id + '|' + px;
  if (modelCache.has(key)) return modelCache.get(key);
  const asp = lesson.box.w / lesson.box.h === 1 ? 1 : 0.75, W = Math.round(px * asp), H = px, c = mk(W * 2, H * 2);
  if (c) {
    const g = c.getContext('2d'); g.scale(2, 2);
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#f3ead3'); gr.addColorStop(1, '#e6d9bb');
    g.fillStyle = gr; g.beginPath(); g.roundRect(0, 0, W, H, 8); g.fill();
    const k = lesson.box.w === CHAR_BOX.w ? W / CHAR_BOX.w : W / PAGE.w, ox = lesson.box.w === CHAR_BOX.w ? CHAR_BOX.x : 0, oy = lesson.box.w === CHAR_BOX.w ? CHAR_BOX.y : 0;
    lesson.strokes.forEach((s, i) => {
      const P = targetPath(lesson, i).map((p) => [(p[0] - ox) * k, (p[1] - oy) * k]);
      const smp = synthSamples(P, s.type, lesson.base * k * (lesson.box.w === CHAR_BOX.w ? 0.9 : 1), {});
      const t = mk(W * 2, H * 2), tg = t.getContext('2d'); tg.scale(2, 2); paintSamples(tg, smp, 1, i);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = toneAlpha(s.tone ? { dark: 0.9, mid: 0.55, pale: 0.25 }[s.tone] : 0.92); g.drawImage(t, 0, 0); g.restore();
    });
  }
  modelCache.set(key, c);
  return c;
}

// The saved work (gallery): paper plus ink composed once.
export function workImage(h, w) {
  let e = h.fx.thumbs.get(w.id);
  if (e) return e;
  const free = w.kind === 'free', pw = free ? PAGE.w * 3 : PAGE.w, res = free ? 0.5 : 0.8;
  const L = makeLayer(pw, PAGE.h, res);
  replay(L, w.strokes, w.seals);
  const c = mk(pw * res, PAGE.h * res);
  if (c) {
    const g = c.getContext('2d'), pimg = paperImage(pw, PAGE.h, free ? 1 : 1.25, 7);
    if (pimg) g.drawImage(pimg, 0, 0, c.width, c.height);
    g.globalCompositeOperation = 'multiply'; if (L.ink) g.drawImage(L.ink, 0, 0);
  }
  e = { c, aspect: pw / PAGE.h };
  h.fx.thumbs.set(w.id, e);
  return e;
}

export function render(ctx, st, L, view, meta, h) {
  const { w, h: hh } = L, sc = st.scene;
  if (sc === 'practice' || sc === 'free') { renderPlay(ctx, st, L, view, meta, h); drawToast(ctx, st, L); return; }
  meta.previewBadge = null;
  drawBackdrop(ctx, w + 20, hh + 20, st.t, st.prefs.calm ? 1 : 0);
  if (sc === 'title') renderTitle(ctx, st, L, h);
  else if (sc === 'lessons') renderLessons(ctx, st, L, h);
  else if (sc === 'gallery') renderGallery(ctx, st, L, h);
  else if (sc === 'work') renderWork(ctx, st, L, h);
  else if (sc === 'about') renderDoc(ctx, st, L, { key: 'about', title: 'About', blocks: ABOUT });
  else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: 'How to Play', blocks: HOWTO });
  else if (sc === 'rules') { const p = RULES[st.rulesPage]; renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: `${st.rulesPage + 1}/${RULES.length}  ${p.title}`, blocks: p.blocks, nav: true, page: st.rulesPage, pages: RULES.length }); }
  else if (sc === 'settings') renderDoc(ctx, st, L, { key: 'settings', title: 'Settings', blocks: settingsBlocks(st) });
  else if (sc === 'demo-limit') renderDemoLimit(ctx, st, L);
  drawToast(ctx, st, L);
}

export function drawToast(ctx, st, L) {
  if (!st.toast) return;
  const a = clamp(Math.min(st.toast.t / 0.2, (st.toast.hold - st.toast.t) / 0.3), 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 150, st.toast.text, 28, { align: 'center', fill: 'rgba(14,22,24,0.92)', stroke: 'rgba(236,208,138,0.5)' });
  ctx.restore();
}

function settingsBlocks(st) {
  const p = st.prefs;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('size', 'Brush size', 'cycle', () => BRUSH.sizes[p.size].name, 'Small, medium or large'),
    row('guide', 'Guide', 'cycle', () => ['Full', 'Light', 'Off'][p.guide], 'Ghost strokes, start points, or none'),
    row('think', 'Think time (s)', 'stepper', () => p.think, 'Watch and Learn pauses this long before each stroke'),
    row('tip', 'Breathing tip', 'toggle', () => p.tip, 'A calm reminder in the first lesson tip'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'Stops the drifting mist'),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    { sp: 1 },
    { p: 'Text size: use the A- and A+ buttons at the top of this screen.' },
  ];
}

// ---- title ---------------------------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L, h) {
  const T = L.title, S = L.S, wide = L.mode === 'wide', hero = T.hero;
  // hero: a mounted sheet on which the brush paints a character by itself
  drawMount(ctx, hero, Math.max(10, hero.w * 0.03));
  const pimg = paperImage(PAGE.w, PAGE.h, 1.25);
  if (pimg) ctx.drawImage(pimg, hero.x, hero.y, hero.w, hero.h);
  else { ctx.fillStyle = PAL.paper; ctx.fillRect(hero.x, hero.y, hero.w, hero.h); }
  const hl = h.layer('hero'); drawLayer(ctx, hl, hero);
  const k = hero.w / PAGE.w;
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; paintSeal(ctx, 'ink', hero.x + hero.w * 0.84, hero.y + hero.h * 0.9, hero.w * 0.15, 0.04, 3, 1); ctx.restore();
  if (st.hero.end <= 0 && st.hero.pause <= 0 && !st.prefs.calm) drawBrush(ctx, hero.x + st.hero.x * k, hero.y + st.hero.y * k, hero.w * 0.035, 0.9, 0.95, true);
  const tcx = T.titleX, size = T.size;
  titleText(ctx, tcx, T.titleY, size, 'INK BRUSH', null);
  txt(ctx, 'Grind the ink. Load the brush. Make the stroke.', tcx, T.titleY + size * 0.72, Math.max(24, size * 0.19), PAL.text, { align: 'center', weight: 600, stroke: 5, maxW: (wide ? T.col.x - S.x : S.w) - 40 });
  button(ctx, T.play, 'Lessons', { kind: 'primary', size: 40, icon: 'brush' });
  button(ctx, T.free, 'Free Scroll', { kind: 'quiet', size: L.mode === 'compact' ? 28 : 32, icon: 'seal' });
  button(ctx, T.gallery, 'Gallery', { kind: 'quiet', size: L.mode === 'compact' ? 28 : 32, icon: 'eye' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'ghost', size: L.mode === 'compact' ? 26 : 30, icon: 'play' });
  const sm = L.mode === 'compact' ? 24 : 26;
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: sm }); button(ctx, T.rules, 'Rules', { kind: 'ghost', size: sm });
  button(ctx, T.about, 'About', { kind: 'ghost', size: sm }); button(ctx, T.settings, 'Settings', { kind: 'ghost', size: sm });
  const lw = Math.min(300, S.w * 0.55), lh = lw * 327 / 1200;
  if (!drawLockup(ctx, { x: T.credit.x - lw / 2, y: T.credit.y - lh + 8, w: lw, h: lh })) drawCredit(ctx, T.credit.x, T.credit.y, 12);
}

// ---- lessons -----------------------------------------------------------------------------------------------------------------------------------------------
function renderLessons(ctx, st, L, h) {
  const G = L.lessons, S = L.S, it = lessonItems(L, LESSONS, GROUPS);
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Choose a lesson', S.x + S.w / 2, G.titleY, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: S.w - 2 * (G.back.w + 30) });
  ctx.save(); ctx.beginPath(); ctx.rect(G.view.x, G.view.y, G.view.w, G.view.h); ctx.clip();
  ctx.translate(G.view.x, G.view.y - st.listScroll);
  for (const hd of it.heads) {
    const group = GROUPS.find((g) => g[1] === hd.text)[0], n = LESSONS.filter((l) => l.group === group).length;
    txt(ctx, hd.text, 12, hd.y + 24, 32, PAL.gold, { font: DISPLAY, weight: 700 });
    txt(ctx, `${n}`, 28 + ctxWidth(ctx, hd.text, 32), hd.y + 26, 24, PAL.dim, { weight: 600 });
    ctx.fillStyle = 'rgba(236,208,138,0.25)'; ctx.fillRect(12, hd.y + 48, G.view.w - 40, 2);
  }
  for (const q of it.items) {
    const l = LESSONS.find((x) => x.id === q.id), r = q.r;
    if (r.y + r.h < st.listScroll - 10 || r.y > st.listScroll + G.view.h + 10) continue;
    const idx = LESSONS.indexOf(l), locked = st.demo && idx >= h.DEMO_LESSONS, stars = st.stars[l.id] ?? 0;
    panel(ctx, r, { fill: 'rgba(14,24,26,0.8)' }); if (stars) edgeStroke(ctx, r, 24, 0.22);
    const th = Math.min(r.h - 28, r.w < 330 ? 108 : 128), img = modelImage(l, th);
    if (img) ctx.drawImage(img, r.x + 16, r.y + (r.h - th) / 2, img.width / 2, img.height / 2);
    const tx = r.x + 16 + (l.box.w === CHAR_BOX.w ? th : th * 0.75) + 18, tw = r.w - (tx - r.x) - 14, narrow = tw < 240;
    txt(ctx, l.cn, tx, r.y + r.h * 0.24, 44, PAL.gold, { font: CJK, weight: 700 });
    if (narrow) {
      txt(ctx, l.title, tx, r.y + r.h * 0.5, 28, PAL.text, { weight: 700, maxW: tw });
    } else {
      txt(ctx, l.title, tx + 64, r.y + r.h * 0.25, 28, PAL.text, { weight: 700, maxW: tw - 64 });
      const lines = (() => { ctx.font = `500 22px ${UI}`; return wrap(ctx, l.blurb, tw); })().slice(0, 2);
      lines.forEach((ln, i) => txt(ctx, ln, tx, r.y + r.h * 0.48 + i * 26, 22, PAL.dim, { weight: 500, maxW: tw }));
    }
    for (let s = 0; s < 3; s++) drawStar(ctx, tx + 16 + s * 36, r.y + r.h - 28, 15, s < stars, 0);
    if (st.mastered[l.id]) { ctx.save(); ctx.globalCompositeOperation = 'source-over'; paintSeal(ctx, 'ink', r.x + r.w - 34, r.y + 34, 40, 0.05, 3, 1); ctx.restore(); }
    if (locked) { ctx.fillStyle = 'rgba(6,10,12,0.66)'; rrect(ctx, r, 24); ctx.fill(); txt(ctx, 'Full game', r.x + r.w / 2, r.y + r.h / 2, 28, PAL.gold, { align: 'center', weight: 700 }); }
  }
  ctx.restore();
}
function ctxWidth(ctx, s, size) { ctx.font = `700 ${size}px ${DISPLAY}`; return ctx.measureText(s).width; }

// ---- gallery -----------------------------------------------------------------------------------------------------------------------------------------------
function renderGallery(ctx, st, L, h) {
  const G = L.gallery, S = L.S;
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Gallery', S.x + S.w / 2, G.titleY, 44, PAL.gold, { align: 'center', font: DISPLAY, weight: 700, stroke: 6, maxW: S.w - 2 * (G.back.w + 30) });
  if (!st.gallery.length) {
    txt(ctx, 'Nothing here yet.', S.x + S.w / 2, S.y + S.h * 0.4, 36, PAL.text, { align: 'center', font: DISPLAY, weight: 700 });
    const lines = wrap((ctx.font = `500 26px ${UI}`, ctx), 'Finish a lesson and press Stamp and keep, or keep your free scroll, and your sealed work will hang here.', Math.min(S.w - 80, 560));
    lines.forEach((ln, i) => txt(ctx, ln, S.x + S.w / 2, S.y + S.h * 0.4 + 56 + i * 34, 26, PAL.dim, { align: 'center', weight: 500 }));
    return;
  }
  const c = G.cell;
  ctx.save(); ctx.beginPath(); ctx.rect(G.view.x, G.view.y, G.view.w, G.view.h); ctx.clip();
  for (const cell of h.galCells()) {
    const y = G.view.y + cell.y - st.galScroll;
    if (y + c.h < G.view.y - 10 || y > G.view.y + G.view.h + 10) continue;
    const r = { x: cell.x, y, w: c.w, h: c.h - 44 }, e = workImage(h, cell.w);
    const ar = e.aspect, fw = Math.min(r.w - 24, (r.h - 24) * ar), fh = fw / ar, fr = { x: r.x + (r.w - fw) / 2, y: r.y + (r.h - fh) / 2, w: fw, h: fh };
    panel(ctx, r, { fill: 'rgba(14,24,26,0.8)', rad: 16 });
    drawMount(ctx, fr, 6);
    if (e.c) ctx.drawImage(e.c, fr.x, fr.y, fr.w, fr.h);
    txt(ctx, cell.w.title, r.x + r.w / 2, y + c.h - 22, 24, PAL.text, { align: 'center', weight: 700, maxW: c.w - 10 });
    if (cell.w.stars) for (let s = 0; s < 3; s++) drawStar(ctx, r.x + 20 + s * 24, r.y + 18, 9, s < cell.w.stars, 0);
  }
  ctx.restore();
}
function renderWork(ctx, st, L, h) {
  const G = L.gallery, S = L.S, w = st.gallery.find((q) => q.id === st.work);
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  if (!w) return;
  txt(ctx, w.title, S.x + S.w / 2, G.titleY, 40, PAL.gold, { align: 'center', font: CJK, weight: 700, stroke: 6, maxW: S.w - 2 * (G.back.w + 30) });
  const e = workImage(h, w), box = G.work, ar = e.aspect, fw = Math.min(box.w, box.h * ar), fh = fw / ar, fr = { x: box.x + (box.w - fw) / 2, y: box.y + (box.h - fh) / 2, w: fw, h: fh };
  drawMount(ctx, fr, 14);
  if (e.c) ctx.drawImage(e.c, fr.x, fr.y, fr.w, fr.h);
  button(ctx, G.del, 'Remove', { kind: 'danger', size: 26 });
}

// ---- demo limit -------------------------------------------------------------------------------------------------------------------------------------------
function renderDemoLimit(ctx, st, L) {
  const S = L.S, cx = S.x + S.w / 2, w = Math.min(S.w - 60, 620), y = S.y + S.h * 0.3;
  titleText(ctx, cx, y, Math.min(86, w / 5.5), 'INK BRUSH', null);
  const lines = (ctx.font = `600 32px ${UI}`, wrap(ctx, 'That is the end of the free preview in the browser. The full game has every lesson, the free scroll, the seals and the gallery. Get Ink Brush on iPhone and Android.', w));
  lines.forEach((ln, i) => txt(ctx, ln, cx, y + 90 + i * 44, 32, PAL.text, { align: 'center', weight: 600 }));
  txt(ctx, 'Tap to go back to the menu', cx, y + 120 + lines.length * 44, 26, PAL.dim, { align: 'center', weight: 500 });
}
