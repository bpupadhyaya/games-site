// Every button on every screen, as data. `screenButtons(state)` is used both to draw (view.js) and to hit-test (game.js),
// so what you see is exactly what you can tap. Menu-like screens are "stacks": a list of items laid out top to bottom at
// the current text zoom (up to 300%), scrolled by dragging when they are taller than their box.
import { HOW, ABOUT, RULES } from './content.js';
import { wrapLines, estW, paginate } from './text.js';
import { LEVELS, LEVEL_NAMES } from './ai.js';
import { scoreOf, tossesFor } from './rules.js';
import { HUD_Y, ACT_Y } from './layout.js';

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const AP_THINK_STEPS = [2, 5, 8, 10]; // Auto Play THINK pause, seconds (default index 1 = 5 s, capped at 10 s)
export const PANEL = { x: 36, y: 100, w: 648, h: 1360 };
export const BODY = { x: 90, y: 270, w: 540, h: 890 };       // reader text box
export const zoomOf = (s) => TEXT_SCALES[s.prefs.textScaleIdx ?? 0] ?? 1;
export const ACC = '#8a1f26';

// ---- reader documents (How to play / About / Rules) -------------------------------------------------------
const DOCS = { how: HOW, about: ABOUT, rules: RULES };
const pageCache = {};
export function readerPages(sc, z) {
  const key = sc + '|' + z;
  return (pageCache[key] ||= paginate(DOCS[sc], z, BODY.w, BODY.h));
}
export const readerIndex = (s) => (s.scene === 'how' ? s.howPage : s.scene === 'about' ? s.aboutPage : s.rulesPage);

// ---- stack layout ---------------------------------------------------------------------------------------------------
const UI_LH = 1.3;
// Lay items out top to bottom. Returns { nodes, total } where every node has absolute x, y (scroll applied), w, h.
export function layoutStack(items, z, region, scroll = 0) {
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
  return { nodes, total: y };
}

// ---- the stack for each menu-like screen ----------------------------------------------------------------------------
export const REGION = {
  title: { x: 60, y: 1022, w: 600, h: 440 },
  panel: { x: 90, y: 262, w: 540, h: 1000 },
  over: { x: 90, y: 372, w: 540, h: 640 },
  menu: { x: 100, y: 500, w: 520, h: 480 },
};
const LEVEL_BLURB = { beginner: 'Often hurries or holds bones at random. Good for learning.', steady: 'Always picks the best expected strides.', sharp: 'Also reads the trail: tailwinds, burrows, streams and bumps.' };

export function stackFor(s) {
  const sc = s.scene, p = s.prefs, t = s.setup;
  const label = (str, size = 26, color = '#2a1b12', extra = {}) => ({ k: 'text', str, size, color, weight: 700, align: 'left', font: 'ui', after: 6, ...extra });
  if (s.menuOpen && (sc === 'play' || sc === 'autoplay')) {
    return { key: 'menu', region: REGION.menu, card: { x: 80, y: 430, w: 560, h: 640, title: 'Paused' }, footer: [], items: [
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
    return { key: 'title', region: REGION.title, items, footer: [] };
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
    return { key: 'setup', title: 'New race', region: REGION.panel, items, footer: [{ id: 'start', label: 'Start race', primary: true, size: 36 }, { id: 'back', label: 'Back', size: 28 }] };
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
    return { key: 'settings', title: 'Settings', region: REGION.panel, items, footer: [{ id: 'back', label: 'Back', size: 28, primary: true }] };
  }
  if (sc === 'over' || sc === 'autoplay-over') {
    const o = s.over; if (!o) return null;
    const g = s.g, items = [{ k: 'art', name: 'winner', h: 130 }];
    items.push({ k: 'text', str: o.youWon ? 'You win!' : `${g.riders[o.winner].name} wins!`, size: 54, color: ACC, weight: 700, align: 'center', font: 'display', after: 10 });
    o.rank.forEach((r, k) => items.push({ k: 'art', name: 'rank', r, rank: k, h: Math.round(56 * Math.max(1, Math.min(1.6, zoomOf(s) * 0.7))), after: 6 }));
    return { key: 'over', region: REGION.over, card: { x: 60, y: 330, w: 600, h: 840 }, items, footer: [{ id: 'again', label: sc === 'autoplay-over' ? 'Watch again' : 'Race again', primary: true, size: 34 }, { id: 'title', label: 'Menu', size: 28 }] };
  }
  if (sc === 'demo-limit') {
    return { key: 'demo', title: 'Thank you for playing', region: REGION.panel, items: [
      { k: 'text', str: 'That is the end of the free web preview. Get Shagai on iPhone and Android for unlimited races, every computer level and every setting.', size: 30, color: '#2a1b12', weight: 600, align: 'center', font: 'ui' },
      { k: 'art', name: 'bones4', h: 130 },
    ], footer: [{ id: 'title', label: 'Back to menu', primary: true, size: 30 }] };
  }
  return null;
}

// Footer buttons sit in a fixed row at the bottom of their card / panel.
export function footerRects(stack, footer) {
  const card = stack.card, bottom = card ? card.y + card.h - 40 : PANEL.y + PANEL.h - 56, w = card ? card.w - 80 : 540, x = card ? card.x + 40 : 90;
  const out = []; let y = bottom;
  for (let i = footer.length - 1; i >= 0; i--) { const f = footer[i], h = i === 0 ? 76 : 64; y -= h; out.unshift({ ...f, x, y, w, h, lines: [f.label] }); y -= 10; }
  return { rects: out, top: y };
}

// The whole layout of a stack screen at the current zoom and scroll: { nodes, footer, region, total, maxScroll }.
export function screenLayout(s) {
  const st = stackFor(s); if (!st) return null;
  const z = zoomOf(s);
  let region = st.region;
  const f = footerRects(st, st.footer);
  if (st.footer.length) region = { ...region, h: Math.min(region.h, f.top - region.y - 6) };
  const first = layoutStack(st.items, z, region, 0);
  const maxScroll = Math.max(0, first.total - region.h), scroll = Math.min(Math.max(s.scroll || 0, 0), maxScroll);
  const lay = scroll ? layoutStack(st.items, z, region, scroll) : first;
  const foot = f.rects.map((r) => ({ ...r, size: Math.round(r.size * Math.min(z, 1.5)), lines: wrapLines(r.label, Math.round(r.size * Math.min(z, 1.5)), r.w - 30) }));
  return { st, nodes: lay.nodes, footer: foot, region, total: first.total, maxScroll, scroll };
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

export function screenButtons(s) {
  const sc = s.scene, B = [];
  if (sc === 'how' || sc === 'about' || sc === 'rules') {
    const pages = readerPages(sc, zoomOf(s)), last = readerIndex(s) >= pages.length - 1, ti = s.prefs.textScaleIdx ?? 0;
    B.push({ id: 'textDec', x: 90, y: 1262, w: 110, h: 52, label: 'A−', size: 26, dim: ti <= 0, lines: ['A−'] }, { id: 'textInc', x: 520, y: 1262, w: 110, h: 52, label: 'A+', size: 26, dim: ti >= TEXT_SCALES.length - 1, lines: ['A+'] });
    B.push({ id: 'back', x: 90, y: 1336, w: 262, h: 78, label: 'Back', size: 30, lines: ['Back'] }, { id: 'page', x: 368, y: 1336, w: 262, h: 78, label: last ? 'Done' : 'Next page', primary: true, size: 30, lines: [last ? 'Done' : 'Next page'] });
    return B;
  }
  const lay = screenLayout(s);
  if (lay) {
    for (const n of lay.nodes) if (n.k === 'btn' && visible(n, lay.region)) B.push({ ...n, clip: lay.region });
    for (const f of lay.footer) B.push(f);
    return B;
  }
  if (sc === 'play' || sc === 'autoplay') {
    if (sc === 'autoplay') {
      const ti = s.prefs.apThinkIdx ?? 1, ap = s.ap;
      const row = [['menu', 'Menu'], [ap.paused ? 'apresume' : 'appause', ap.paused ? 'Resume' : 'Pause'], ['apDec', 'Think −'], ['apInc', 'Think +']];
      row.forEach(([id, label], i) => B.push({ id, x: 24 + i * 172, y: HUD_Y, w: 156, h: 82, label, size: 24, lines: [label], primary: id === 'apresume', dim: (id === 'apDec' && ti <= 0) || (id === 'apInc' && ti >= AP_THINK_STEPS.length - 1) }));
    } else {
      const ri = rideInfo(s);
      B.push({ id: 'toss', x: 36, y: ACT_Y, w: 316, h: 84, label: ri.mine ? `Toss again (${ri.left})` : 'Toss again', size: 30, lines: [ri.mine ? `Toss again (${ri.left})` : 'Toss again'], dim: !ri.canToss });
      B.push({ id: 'gallop', x: 368, y: ACT_Y, w: 316, h: 84, label: ri.mine ? `Gallop +${ri.strides}` : 'Gallop', size: 32, lines: [ri.mine ? `Gallop +${ri.strides}` : 'Gallop'], primary: true, dim: !ri.canGallop });
      B.push({ id: 'menu', x: 38, y: HUD_Y, w: 200, h: 82, label: 'Menu', size: 28, lines: ['Menu'] });
      B.push({ id: 'hint', x: 260, y: HUD_Y, w: 200, h: 82, label: 'Hint', size: 28, lines: ['Hint'], dim: !ri.mine });
      B.push({ id: 'sound', x: 482, y: HUD_Y, w: 200, h: 82, label: s.prefs.sound ? 'Sound on' : 'Sound off', size: 28, lines: [s.prefs.sound ? 'Sound on' : 'Sound off'] });
    }
  }
  return B;
}
