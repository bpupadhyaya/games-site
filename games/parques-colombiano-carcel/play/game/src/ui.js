// Every button on every screen, as data. `screenButtons(state)` is used both to draw (view.js) and to hit-test (game.js),
// so what you see is exactly what you can tap. Menu-like screens are "stacks": a list of items laid out top to bottom at
// the current text zoom (up to 300%), scrolled by dragging when they are taller than their box.
import { HOW, ABOUT, RULES } from './content.js';
import { wrapLines, estW, paginate, ART_H, CHAR_W } from './text.js';
import { LEVELS, LEVEL_NAMES } from './ai.js';
import { PANEL, BODY, REGION, G } from './layout.js';
export { PANEL, BODY, REGION };

export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
export const AP_THINK_STEPS = [2, 5, 8, 10]; // Auto Play THINK pause, seconds (default index 1 = 5 s, capped at 10 s)
export const zoomOf = (s) => TEXT_SCALES[s.prefs.textScaleIdx ?? 0] ?? 1;

// ---- reader documents (How to play / About / Rules) -------------------------------------------------------
const DOCS = { how: HOW, about: ABOUT, rules: RULES };
const pageCache = {};
export function readerPages(sc, z) {
  const key = sc + '|' + z + '|' + BODY.w + '|' + BODY.h;
  return (pageCache[key] ||= paginate(DOCS[sc], z, BODY.w, BODY.h));
}
// One continuous scrolling document (no pages): every section in order, heading + art + text, laid out at the current zoom.
const flowCache = {};
export function readerFlow(sc, z) {
  const key = sc + '|' + z + '|' + BODY.w;
  if (flowCache[key]) return flowCache[key];
  const secs = []; let y = 0;
  for (const pg of paginate(DOCS[sc], z, BODY.w, 1e9)) {
    const hs = Math.max(22, Math.round(pg.size * 0.3), Math.min(Math.round(pg.size * 1.15), Math.floor(BODY.w / (Math.max(1, String(pg.h || '').length) * CHAR_W * 1.2)))), s = { h: pg.h, art: pg.art, lines: pg.lines, size: pg.size, lh: pg.lh, hs, y };
    y += Math.round(hs * 1.5) + (pg.art ? ART_H + Math.round(pg.size * 0.3) : 0);
    for (const ln of pg.lines) y += ln.gap + pg.lh;
    y += Math.round(pg.size * 1.1); secs.push(s);
  }
  return (flowCache[key] = { secs, total: y });
}
export const readerMax = (s) => (s.scene === 'how' || s.scene === 'about' || s.scene === 'rules' ? Math.max(0, readerFlow(s.scene, zoomOf(s)).total - BODY.h) : 0);
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
        it.ids.forEach((id, i) => nodes.push({ k: 'btn', id, label: it.labels[i], lines: [it.labels[i]], x: region.x + i * (cw + gap), y: region.y + y - scroll, w: cw, h, size, sel: it.cur === id, chip: true, locked: it.locked?.[i] }));
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
const ACC = '#8a1f26';

export function stackFor(s) {
  const sc = s.scene, p = s.prefs, t = s.setup;
  const label = (str, size = 26, color = '#2a1b12', extra = {}) => ({ k: 'text', str, size, color, weight: 700, align: 'left', font: 'ui', after: 6, ...extra });
  if (s.menuOpen && (sc === 'play' || sc === 'autoplay')) {
    return { key: 'menu', region: REGION.menu, card: G.cards.menu, footer: [], items: [
      { k: 'btn', id: 'resume', label: 'Resume', h: 80, size: 32, primary: true },
      { k: 'btn', id: 'sound', label: p.sound ? 'Sound: on' : 'Sound: off', h: 66, size: 28 },
      { k: 'btn', id: 'howmenu', label: 'How to play', h: 66, size: 28 },
      { k: 'btn', id: 'rulesmenu', label: 'Rules', h: 66, size: 28 },
      { k: 'btn', id: 'leave', label: sc === 'play' ? 'Leave game' : 'Leave', h: 66, size: 28 },
    ] };
  }
  if (sc === 'title') {
    const items = [];
    if (s.saved) { items.push({ k: 'btn', id: 'continue', label: 'Continue game', h: 78, size: 34, primary: true }, { k: 'btn', id: 'new', label: 'New game', h: 64, size: 28 }); }
    else items.push({ k: 'btn', id: 'new', label: 'Play', h: 84, size: 42, primary: true });
    items.push({ k: 'btn', id: 'autoplay', label: 'Auto Play · Watch & Learn', h: 64, size: 26 });
    items.push({ k: 'chips', ids: ['how', 'rules'], labels: ['How to Play', 'Rules'], cur: '', h: 62, size: 26 });
    items.push({ k: 'chips', ids: ['about', 'settings'], labels: ['About', 'Settings'], cur: '', h: 62, size: 26 });
    return { key: 'title', region: REGION.title, items, footer: [] };
  }
  if (sc === 'setup') {
    const lv = t.opp;
    const ids = LEVELS.map((l) => 'opp:' + l).concat('opp:mixed');
    const pass = t.mode === 'pass';
    const items = [
      label('Mode'), { k: 'chips', ids: ['mode:cpu', 'mode:pass'], labels: ['Vs computer', 'Pass and play'], cur: 'mode:' + t.mode, h: 62, size: 24 },
      label('Players'), { k: 'chips', ids: ['pl:2', 'pl:3', 'pl:4'], labels: ['2', '3', '4'], cur: 'pl:' + t.players, h: 66, size: 30 },
    ];
    if (!pass) items.push(
      label('Computer opponents'), { k: 'chips', ids: ids.slice(0, 3), labels: ids.slice(0, 3).map((i) => LEVEL_NAMES[i.slice(4)]), cur: 'opp:' + lv, h: 62, size: 24 },
      { k: 'chips', ids: ids.slice(3), labels: ids.slice(3).map((i) => LEVEL_NAMES[i.slice(4)]), cur: 'opp:' + lv, h: 62, size: 24 },
      { k: 'text', str: lv === 'mixed' ? 'Mixed: each computer player has a different personality.' : `${LEVEL_NAMES[lv]}: ${LEVEL_BLURB[lv]}`, size: 24, color: ACC, weight: 600, align: 'center', font: 'ui' },
    );
    const seats = t.players === 2 ? 'Yellow (bottom) and Red (top)' : t.players === 3 ? 'Yellow, Blue and Red' : 'Yellow, Blue, Red and Green';
    items.push({ k: 'text', str: pass ? `Everyone shares this phone: ${seats}. The message at the top says whose turn it is. Pass the phone on when it changes. Yellow starts.` : t.players === 2 ? 'You are Yellow, at the bottom. The computer is Red.' : t.players === 3 ? 'You are Yellow. The computers are Blue and Red.' : 'You are Yellow. The computers are Blue, Red and Green.', size: 22, color: '#5a4636', weight: 600, align: 'center', font: 'ui' });
    return { key: 'setup', title: 'New game', region: REGION.panel, items, footer: [{ id: 'start', label: 'Start game', primary: true, size: 36 }, { id: 'back', label: 'Back', size: 28 }] };
  }
  if (sc === 'settings') {
    const items = [
      { k: 'btn', id: 'set:sound', label: `Sound: ${p.sound ? 'on' : 'off'}`, h: 76, size: 28, sel: p.sound },
      { k: 'btn', id: 'set:calm', label: `Reduced motion: ${p.calm ? 'on' : 'off'}`, h: 76, size: 28, sel: p.calm },
      { k: 'btn', id: 'set:auto', label: `Auto-move a single choice: ${p.auto ? 'on' : 'off'}`, h: 76, size: 28, sel: p.auto },
      label('Text size'), { k: 'stepper', idDec: 'textDec', idInc: 'textInc', label: `${Math.round(zoomOf(s) * 100)}%`, size: 32, color: ACC, decDim: (p.textScaleIdx ?? 0) <= 0, incDim: (p.textScaleIdx ?? 0) >= TEXT_SCALES.length - 1 },
      label('Auto Play thinking time'), { k: 'stepper', idDec: 'apDec', idInc: 'apInc', label: `${AP_THINK_STEPS[p.apThinkIdx ?? 1]} seconds`, size: 30, color: ACC, decDim: (p.apThinkIdx ?? 1) <= 0, incDim: (p.apThinkIdx ?? 1) >= AP_THINK_STEPS.length - 1 },
      { k: 'text', str: 'Every colour also has its own emblem on its pieces: disc, diamond, triangle, star. Progress is kept on this device.', size: 22, color: '#5a4636', weight: 600, align: 'center', font: 'ui' },
    ];
    return { key: 'settings', title: 'Settings', region: REGION.panel, items, footer: [{ id: 'back', label: 'Back', size: 28, primary: true }] };
  }
  if (sc === 'over' || sc === 'autoplay-over') {
    const o = s.over; if (!o) return null;
    const g = s.g, items = [{ k: 'art', name: 'winner', h: 130 }];
    items.push({ k: 'text', str: o.youWon ? 'You win!' : `${g.players[o.winner].name} wins!`, size: 54, color: ACC, weight: 700, align: 'center', font: 'display', after: 10 });
    o.rank.forEach((r, k) => items.push({ k: 'art', name: 'rank', r, rank: k, h: Math.round(56 * Math.max(1, Math.min(1.6, zoomOf(s) * 0.7))), after: 6 }));
    return { key: 'over', region: REGION.over, card: G.cards.over, items, footer: [{ id: 'again', label: sc === 'autoplay-over' ? 'Watch again' : 'Play again', primary: true, size: 34 }, { id: 'title', label: 'Menu', size: 28 }] };
  }
  if (sc === 'demo-limit') {
    return { key: 'demo', title: 'Thank you for playing', region: REGION.panel, items: [
      { k: 'text', str: 'That is the end of the free web preview. Get Parqués on iPhone and Android for unlimited games, every opponent level and every setting.', size: 30, color: '#2a1b12', weight: 600, align: 'center', font: 'ui' },
      { k: 'art', name: 'pieces4', h: 120 },
    ], footer: [{ id: 'title', label: 'Back to menu', primary: true, size: 30 }] };
  }
  return null;
}
const LEVEL_BLURB = { beginner: 'Often plays any legal move. Good for learning.', cautious: 'Hides on seguros, builds barriers, avoids risk.', balanced: 'Weighs risk, captures and progress.', bold: 'Hunts captures and sprints, ignoring risk.' };

// Footer buttons sit at the bottom of their card / panel: a row in landscape, stacked in portrait.
export function footerRects(stack, footer) {
  const reg = stack.region, box = stack.card || PANEL, bottom = box.y + box.h - (stack.card ? 36 : 30);
  if (G.footRow) {
    const n = footer.length, gap = 12, w = (reg.w - gap * (n - 1)) / n, h = 68, y = bottom - h;
    return { rects: footer.map((f, i) => ({ ...f, x: reg.x + i * (w + gap), y, w, h, lines: [f.label] })), top: y - 10 };
  }
  const out = []; let y = bottom;
  for (let i = footer.length - 1; i >= 0; i--) { const f = footer[i], h = i === 0 ? 76 : 64; y -= h; out.unshift({ ...f, x: reg.x, y, w: reg.w, h, lines: [f.label] }); y -= 10; }
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

export function screenButtons(s) {
  const sc = s.scene, B = [];
  if (sc === 'how' || sc === 'about' || sc === 'rules') {
    const ti = s.prefs.textScaleIdx ?? 0, rd = G.reader;
    B.push({ id: 'textDec', ...rd.dec, label: 'A−', size: 26, dim: ti <= 0, lines: ['A−'] }, { id: 'textInc', ...rd.inc, label: 'A+', size: 26, dim: ti >= TEXT_SCALES.length - 1, lines: ['A+'] });
    B.push({ id: 'back', ...rd.back, label: 'Back', size: 30, lines: ['Back'] }, { id: 'page', ...rd.next, label: 'Top', primary: true, dim: (s.scroll || 0) < 4, size: 30, lines: ['Top'] });
    return B;
  }
  const lay = screenLayout(s);
  if (lay) {
    for (const n of lay.nodes) if (n.k === 'btn' && visible(n, lay.region)) B.push({ ...n, clip: lay.region });
    for (const f of lay.footer) B.push(f);
    return B;
  }
  if (sc === 'pass') return B;
  if (sc === 'play' || sc === 'autoplay') {
    if (sc === 'autoplay') {
      const ti = s.prefs.apThinkIdx ?? 1, ap = s.ap, A = G.btns.auto;
      const row = [['menu', 'Menu', A.menu], [ap.paused ? 'apresume' : 'appause', ap.paused ? 'Resume' : 'Pause', A.pause], ['apDec', 'Think −', A.dec], ['apInc', 'Think +', A.inc]];
      for (const [id, label, r] of row) B.push({ id, ...r, label, size: 24, lines: [label], primary: id === 'apresume', dim: (id === 'apDec' && ti <= 0) || (id === 'apInc' && ti >= AP_THINK_STEPS.length - 1) });
    } else {
      const P = G.btns.play;
      B.push({ id: 'menu', ...P.menu, label: 'Menu', size: 28, lines: ['Menu'] });
      B.push({ id: 'hint', ...P.hint, label: 'Hint', size: 28, lines: ['Hint'], dim: !(s.phase === 'choose' && s.g.players[s.g.turn].human) });
      B.push({ id: 'sound', ...P.sound, label: s.prefs.sound ? 'Sound on' : 'Sound off', size: 28, lines: [s.prefs.sound ? 'Sound on' : 'Sound off'] });
    }
  }
  return B;
}
