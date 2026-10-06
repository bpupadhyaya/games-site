// Every button on every screen, as data. `screenButtons(state)` is used both to draw (view.js) and to hit-test (game.js),
// so what you see is exactly what you can tap. Menu-like screens are "stacks": a list of items laid out top to bottom at
// the current text zoom (up to 300%), scrolled by dragging when they are taller than their box.
import { HOW, ABOUT, RULES } from './content.js';
import { wrapLines, estW, paginate, ART_H, CHAR_W } from './text.js';
import { LEVELS, LEVEL_NAMES } from './ai.js';
import { scoreOf, tossesFor } from './rules.js';
import { curLayout, stackFrame } from './layout.js';

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const AP_THINK_STEPS = [2, 5, 8, 10]; // Auto Play THINK pause, seconds (default index 1 = 5 s, capped at 10 s)
export const zoomOf = (s) => TEXT_SCALES[s.prefs.textScaleIdx ?? 0] ?? 1;
export const ACC = '#8a1f26';

// ---- reader documents (How to play / About / Rules) -------------------------------------------------------
const DOCS = { how: HOW, about: ABOUT, rules: RULES };
const pageCache = {};
export function readerPages(sc, z, L = curLayout()) {
  const b = L.reader.body, key = `${sc}|${z}|${Math.round(b.w)}|${Math.round(b.h)}`;
  if (!pageCache[key]) { if (Object.keys(pageCache).length > 60) for (const k of Object.keys(pageCache)) delete pageCache[k]; pageCache[key] = paginate(DOCS[sc], z, b.w, b.h); }
  return pageCache[key];
}
// One continuous scrolling document (no pages): every section in order, heading + art + text, laid out at the current zoom.
const flowCache = {};
export function readerFlow(sc, z, L = curLayout()) {
  const w = Math.round(L.reader.body.w), key = sc + '|' + z + '|' + w;
  if (flowCache[key]) return flowCache[key];
  const secs = []; let y = 0;
  for (const pg of paginate(DOCS[sc], z, w, 1e9)) {
    const hs = Math.max(22, Math.round(pg.size * 0.3), Math.min(Math.round(pg.size * 1.15), Math.floor(w / (Math.max(1, String(pg.h || '').length) * CHAR_W * 1.2)))), s = { h: pg.h, art: pg.art, lines: pg.lines, size: pg.size, lh: pg.lh, hs, y };
    s.hh = Math.round(hs * 1.5) + (pg.art ? ART_H + Math.round(pg.size * 0.3) : 0) + pg.lines.reduce((a, ln) => a + ln.gap + pg.lh, 0);
    y += s.hh + Math.round(pg.size * 1.1); secs.push(s);
  }
  return (flowCache[key] = { secs, total: y });
}
export const readerMax = (s, L = curLayout()) => (s.scene === 'how' || s.scene === 'about' || s.scene === 'rules' ? Math.max(0, readerFlow(s.scene, zoomOf(s), L).total - L.reader.body.h) : 0);
export const readerIndex = (s) => (s.scene === 'how' ? s.howPage : s.scene === 'about' ? s.aboutPage : s.rulesPage);

// ---- stack layout ---------------------------------------------------------------------------------------------------
const UI_LH = 1.3;
// Lay items out top to bottom. Returns { nodes, total } where every node has absolute x, y (scroll applied), w, h.
export function layoutStack(items, z, frame, scroll = 0, u = 1) {
  const region = { x: 0, y: 0, w: frame.w / u, h: frame.h / u }; scroll /= u;
  const nodes = []; let y = 0;
  const push = (n) => { n.y = region.y + y - scroll; n.x = n.x ?? region.x; n.w = n.w ?? region.w; nodes.push(n); y += n.h + (n.after ?? 12); };
  for (const it of items) {
    if (it.k === 'gap') { y += it.h; continue; }
    if (it.k === 'text') {
      const size = Math.round(it.size * (it.noZoom ? 1 : z)), lh = Math.round(size * UI_LH), lines = wrapLines(it.str, size, region.w - 8);
      push({ ...it, size, lh, lines, h: lines.length * lh + 4, after: it.after ?? 8 });
    } else if (it.k === 'art') push({ ...it, after: it.after ?? 10 });
    else if (it.k === 'btn') {
      const size = Math.round(it.size * z), lines = wrapLines(it.label, size, region.w - 36), h = Math.max(it.h, Math.round(lines.length * size * 1.22 + 30));
      push({ ...it, size, lines, h });
    } else if (it.k === 'chips') {
      const n = it.ids.length, gap = 12, cw = (region.w - gap * (n - 1)) / n, size = Math.round(it.size * z);
      const fits = it.labels.every((l) => estW(l, size) <= cw - 22);
      if (fits && z <= 1.6) {
        const h = it.h;
        it.ids.forEach((id, i) => nodes.push({ k: 'btn', id, label: it.labels[i], lines: [it.labels[i]], x: region.x + i * (cw + gap), y: region.y + y - scroll, w: cw, h, size, sel: it.cur === id, chip: true }));
        y += h + (it.after ?? 12);
      } else {
        it.ids.forEach((id, i) => { const lines = wrapLines(it.labels[i], size, region.w - 36), h = Math.max(it.h, Math.round(lines.length * size * 1.22 + 30)); push({ k: 'btn', id, label: it.labels[i], lines, h, size, sel: it.cur === id, chip: true, after: 10 }); });
      }
    } else if (it.k === 'stepper') {
      const size = Math.round(it.size * z), bw = 92, mw = region.w - 2 * (bw + 10), lines = wrapLines(it.label, size, mw - 6), h = Math.max(78, lines.length * Math.round(size * UI_LH) + 24);
      const base = region.y + y - scroll;
      nodes.push({ k: 'btn', id: it.idDec, label: '−', lines: ['−'], x: region.x, y: base, w: bw, h, size: 44, dim: it.decDim, step: true });
      nodes.push({ k: 'btn', id: it.idInc, label: '+', lines: ['+'], x: region.x + region.w - bw, y: base, w: bw, h, size: 44, dim: it.incDim, step: true });
      nodes.push({ k: 'text', str: it.label, size, lh: Math.round(size * UI_LH), lines, x: region.x + bw + 10, w: mw, y: base + (h - lines.length * Math.round(size * UI_LH)) / 2, h: lines.length * Math.round(size * UI_LH), color: it.color, weight: 700, align: 'center', font: 'ui' });
      y += h + (it.after ?? 12);
    }
  }
  for (const n of nodes) { // map from the stack's own units to the screen
    n.x = frame.x + n.x * u; n.y = frame.y + n.y * u; n.w *= u; n.h *= u;
    if (n.size) n.size *= u; if (n.lh) n.lh *= u;
  }
  return { nodes, total: y * u };
}

// ---- the stack for each menu-like screen ----------------------------------------------------------------------------
const LEVEL_BLURB = { beginner: 'Often hurries or holds bones at random. Good for learning.', steady: 'Always picks the best expected strides.', sharp: 'Also reads the trail: tailwinds, burrows, streams and bumps.' };

export function stackFor(s) {
  const sc = s.scene, p = s.prefs, t = s.setup;
  const label = (str, size = 26, color = '#2a1b12', extra = {}) => ({ k: 'text', str, size, color, weight: 700, align: 'left', font: 'ui', after: 6, ...extra });
  if (s.menuOpen && (sc === 'play' || sc === 'autoplay')) {
    return { key: 'menu', card: { title: 'Paused' }, footer: [], items: [
      { k: 'btn', id: 'resume', label: 'Resume', h: 80, size: 32, primary: true },
      { k: 'btn', id: 'sound', label: p.sound ? 'Sound: on' : 'Sound: off', h: 66, size: 28 },
      { k: 'btn', id: 'howmenu', label: 'How to play', h: 66, size: 28 },
      { k: 'btn', id: 'rulesmenu', label: 'Rules', h: 66, size: 28 },
      { k: 'btn', id: 'leave', label: sc === 'play' ? 'Leave race' : 'Leave', h: 66, size: 28 },
    ] };
  }
  if (sc === 'title') {
    const items = [];
    if (s.saved) { items.push({ k: 'btn', id: 'continue', label: 'Continue race', h: 78, size: 34, primary: true }, { k: 'btn', id: 'new', label: 'New race', h: 64, size: 28 }); }
    else items.push({ k: 'btn', id: 'new', label: 'Play', h: 84, size: 42, primary: true });
    items.push({ k: 'btn', id: 'autoplay', label: 'Auto Play · Watch & Learn', h: 64, size: 26 });
    items.push({ k: 'chips', ids: ['how', 'rules'], labels: ['How to Play', 'Rules'], cur: '', h: 62, size: 26 });
    items.push({ k: 'chips', ids: ['about', 'settings'], labels: ['About', 'Settings'], cur: '', h: 62, size: 26 });
    return { key: 'title', items, footer: [] };
  }
  if (sc === 'setup') {
    const lv = t.opp, ids = LEVELS.map((l) => 'opp:' + l).concat('opp:mixed');
    const items = [
      label('Riders'), { k: 'chips', ids: ['pl:2', 'pl:3', 'pl:4'], labels: ['2', '3', '4'], cur: 'pl:' + t.players, h: 66, size: 30 },
      label('Computer riders'), { k: 'chips', ids: ids.slice(0, 2), labels: ids.slice(0, 2).map((i) => LEVEL_NAMES[i.slice(4)]), cur: 'opp:' + lv, h: 62, size: 24 },
      { k: 'chips', ids: ids.slice(2), labels: ids.slice(2).map((i) => LEVEL_NAMES[i.slice(4)]), cur: 'opp:' + lv, h: 62, size: 24 },
      { k: 'text', str: lv === 'mixed' ? 'Mixed: each computer rider has a different level.' : `${LEVEL_NAMES[lv]}: ${LEVEL_BLURB[lv]}`, size: 24, color: ACC, weight: 600, align: 'center', font: 'ui' },
      { k: 'text', str: t.players === 2 ? 'You are rider 1 (blue). Naran is rider 2 (red).' : t.players === 3 ? 'You are rider 1 (blue). Naran (red) and Saran (gold) are the computers.' : 'You are rider 1 (blue). Naran (red), Saran (gold) and Tuya (green) are the computers.', size: 22, color: '#5a4636', weight: 600, align: 'center', font: 'ui' },
      { k: 'text', str: `First to the finish wins. Nothing is staked.`, size: 22, color: '#5a4636', weight: 600, align: 'center', font: 'ui' },
    ];
    return { key: 'setup', title: 'New race', items, footer: [{ id: 'start', label: 'Start race', primary: true, size: 36 }, { id: 'back', label: 'Back', size: 28 }] };
  }
  if (sc === 'settings') {
    const items = [
      { k: 'btn', id: 'set:sound', label: `Sound: ${p.sound ? 'on' : 'off'}`, h: 76, size: 28, sel: p.sound },
      { k: 'btn', id: 'set:calm', label: `Reduced motion: ${p.calm ? 'on' : 'off'}`, h: 76, size: 28, sel: p.calm },
      { k: 'btn', id: 'set:auto', label: `Auto-gallop on the last toss: ${p.auto ? 'on' : 'off'}`, h: 76, size: 28, sel: p.auto },
      label('Text size'), { k: 'stepper', idDec: 'textDec', idInc: 'textInc', label: `${Math.round(zoomOf(s) * 100)}%`, size: 32, color: ACC, decDim: (p.textScaleIdx ?? 0) <= 0, incDim: (p.textScaleIdx ?? 0) >= TEXT_SCALES.length - 1 },
      label('Auto Play thinking time'), { k: 'stepper', idDec: 'apDec', idInc: 'apInc', label: `${AP_THINK_STEPS[p.apThinkIdx ?? 1]} seconds`, size: 30, color: ACC, decDim: (p.apThinkIdx ?? 1) <= 0, incDim: (p.apThinkIdx ?? 1) >= AP_THINK_STEPS.length - 1 },
      { k: 'text', str: 'Every rider has a number as well as a colour. Races played and won are kept on this device.', size: 22, color: '#5a4636', weight: 600, align: 'center', font: 'ui' },
    ];
    return { key: 'settings', title: 'Settings', items, footer: [{ id: 'back', label: 'Back', size: 28, primary: true }] };
  }
  if (sc === 'over' || sc === 'autoplay-over') {
    const o = s.over; if (!o) return null;
    const g = s.g, items = [{ k: 'art', name: 'winner', h: 130 }];
    items.push({ k: 'text', str: o.youWon ? 'You win!' : `${g.riders[o.winner].name} wins!`, size: 54, color: ACC, weight: 700, align: 'center', font: 'display', after: 10 });
    o.rank.forEach((r, k) => items.push({ k: 'art', name: 'rank', r, rank: k, h: Math.round(56 * Math.max(1, Math.min(1.6, zoomOf(s) * 0.7))), after: 6 }));
    return { key: 'over', card: {}, items, footer: [{ id: 'again', label: sc === 'autoplay-over' ? 'Watch again' : 'Race again', primary: true, size: 34 }, { id: 'title', label: 'Menu', size: 28 }] };
  }
  if (sc === 'demo-limit') {
    return { key: 'demo', title: 'Thank you for playing', items: [
      { k: 'text', str: 'That is the end of the free web preview. Get Shagai on iPhone and Android for unlimited races, every computer level and every setting.', size: 30, color: '#2a1b12', weight: 600, align: 'center', font: 'ui' },
      { k: 'art', name: 'bones4', h: 130 },
    ], footer: [{ id: 'title', label: 'Back to menu', primary: true, size: 30 }] };
  }
  return null;
}

// Footer buttons sit at the bottom of their card / panel: stacked, or side by side on a wide panel (primary on the right).
function footerRects(footer, f, u) {
  const out = [];
  if (f.row && footer.length > 1) {
    const n = footer.length, gap = 12 * u, w = (f.w - gap * (n - 1)) / n, h = 70 * u, y = f.bottom - h;
    footer.forEach((fo, i) => out.push({ ...fo, x: f.x + (n - 1 - i) * (w + gap), y, w, h, lines: [fo.label] }));
    return { rects: out, top: y - 10 * u };
  }
  let y = f.bottom;
  for (let i = footer.length - 1; i >= 0; i--) { const fo = footer[i], h = (i === 0 ? 76 : 64) * u; y -= h; out.unshift({ ...fo, x: f.x, y, w: f.w, h, lines: [fo.label] }); y -= 10 * u; }
  return { rects: out, top: y };
}

// The whole layout of a stack screen at the current zoom and scroll: { nodes, footer, region, total, maxScroll }.
export function screenLayout(s, L = curLayout()) {
  const st = stackFor(s); if (!st) return null;
  const z = zoomOf(s), fr = stackFrame(L, st.key);
  let region = { ...fr.region }, u = fr.u, foot = [];
  if (st.footer.length) {
    const f = footerRects(st.footer, fr.footer, fr.u);
    region.h = Math.min(region.h || 1e9, f.top - region.y - 6 * fr.u);
    foot = f.rects.map((r) => { const size = r.size * Math.min(z, 1.5) * fr.u; return { ...r, size, lines: wrapLines(r.label, size, r.w - 30) }; });
  }
  if (fr.panel && z <= 1) { // panels: at the normal text size shrink the list a little (never below 85%) so it fits without scrolling
    const t = layoutStack(st.items, z, region, 0, 1).total;
    if (t > region.h) u = Math.max(0.85, region.h / t);
  }
  const first = layoutStack(st.items, z, region, 0, u);
  const maxScroll = Math.max(0, first.total - region.h), scroll = Math.min(Math.max(s.scroll || 0, 0), maxScroll);
  const lay = scroll ? layoutStack(st.items, z, region, scroll, u) : first;
  return { st, frame: fr, nodes: lay.nodes, footer: foot, region, total: first.total, maxScroll, scroll, u };
}

const visible = (n, region) => n.y + n.h > region.y && n.y < region.y + region.h;

// the ride's current choices, shared by the buttons and the key handlers
export function rideInfo(s) {
  const R = s.ride, g = s.g;
  if (!R || !R.faces) return { canToss: false, canGallop: false, strides: 0 };
  const left = R.left, mine = s.scene === 'play' && g.riders[g.turn].human && s.phase === 'decide';
  const free = R.hold.some((h) => !h);
  return { mine, canToss: mine && left > 0 && free, canGallop: mine, strides: scoreOf(R.faces).total, left, total: tossesFor(g, g.turn) };
}

export function screenButtons(s, L = curLayout()) {
  const sc = s.scene, B = [];
  if (sc === 'how' || sc === 'about' || sc === 'rules') {
    const ti = s.prefs.textScaleIdx ?? 0, rb = L.reader.btn;
    B.push({ id: 'textDec', ...rb.textDec, label: 'A−', size: 26, dim: ti <= 0, lines: ['A−'] }, { id: 'textInc', ...rb.textInc, label: 'A+', size: 26, dim: ti >= TEXT_SCALES.length - 1, lines: ['A+'] });
    B.push({ id: 'back', ...rb.back, label: 'Back', size: 30, lines: ['Back'] }, { id: 'page', ...rb.page, label: 'Top', primary: true, dim: (s.scroll || 0) < 4, size: 30, lines: ['Top'] });
    return B;
  }
  const lay = screenLayout(s, L);
  if (lay) {
    for (const n of lay.nodes) if (n.k === 'btn' && visible(n, lay.region)) B.push({ ...n, clip: lay.region });
    for (const f of lay.footer) B.push(f);
    return B;
  }
  if (sc === 'play' || sc === 'autoplay') {
    const pb = L.play.btn, fs = pb.fs, mk = (id, r, label, size, extra = {}) => B.push({ id, ...r, label, size: size * fs, lines: [label], ...extra });
    if (sc === 'autoplay') {
      const ti = s.prefs.apThinkIdx ?? 1, ap = s.ap;
      const row = [['menu', 'Menu'], [ap.paused ? 'apresume' : 'appause', ap.paused ? 'Resume' : 'Pause'], ['apDec', 'Think −'], ['apInc', 'Think +']];
      row.forEach(([id, label], i) => mk(id, pb.ap[i], label, 24, { primary: id === 'apresume', dim: (id === 'apDec' && ti <= 0) || (id === 'apInc' && ti >= AP_THINK_STEPS.length - 1) }));
    } else {
      const ri = rideInfo(s), tl = ri.mine ? `Toss again (${ri.left})` : 'Toss again', gl = ri.mine ? `Gallop +${ri.strides}` : 'Gallop';
      mk('toss', pb.toss, tl, 30, { dim: !ri.canToss }); mk('gallop', pb.gallop, gl, 32, { primary: true, dim: !ri.canGallop });
      mk('menu', pb.menu, 'Menu', 28); mk('hint', pb.hint, 'Hint', 28, { dim: !ri.mine }); mk('sound', pb.sound, s.prefs.sound ? 'Sound on' : 'Sound off', 28);
    }
  }
  return B;
}
