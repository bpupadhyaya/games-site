// Builds the block lists for every text screen. Both game.js (hit-testing) and view.js (drawing) call buildUi() with the same
// state, so layout and taps always agree at every text-zoom step.
import { TEXT_SCALES, layoutDoc } from './ui.js';
import { HOWTO, RULES, ABOUT, tr, L, nameOf } from './content.js';
import { CHAPTERS, CHAPTER_PUZZLES, TOTAL } from './chapters.js';
import { LESSONS } from './lessons.js';
import { THEMES } from './art.js';
import { docRects, titleRects, cardFrame, lockupHit } from './layout.js';

export const DEMO_PUZZLES = 3;
export const THINK_STEPS = [2, 5, 8, 10];
export const demoOver = (S) => S.demo && S.demoCount >= DEMO_PUZZLES;
export const starsOf = (S, id) => S.results[id] ?? 0;
export const chapterStats = (S, ci) => {
  const list = CHAPTER_PUZZLES[ci];
  return { done: list.filter((p) => starsOf(S, p.id) > 0).length, total: list.length, stars: list.reduce((a, p) => a + starsOf(S, p.id), 0) };
};
export const lessonsDone = (S) => LESSONS.filter((l) => S.lessons[l.id]).length;
export const firstOpenLesson = (S) => { const i = LESSONS.findIndex((l) => !S.lessons[l.id]); return i < 0 ? 0 : i; };
const pctLabel = (S) => `${Math.round(TEXT_SCALES[S.textIdx] * 100)}%`;

function fixedBar(S) {
  const D = docRects();
  return [
    { id: 'back', rect: D.back, kind: 'normal', icon: 'back', label: tr('back'), size: 26 },
    { id: 'zoom-', rect: D.dec, kind: 'normal', label: 'A-', size: 30, disabled: S.textIdx === 0 },
    { id: 'zoom+', rect: D.inc, kind: 'normal', label: 'A+', size: 30, disabled: S.textIdx === TEXT_SCALES.length - 1 },
    { id: null, rect: D.pct, label: pctLabel(S), size: 28, static: true },
  ];
}

// The title menu. `dense` pairs the buttons two across (short screens: landscape, tablets).
function titleBlocks(S, dense) {
  const b = [];
  const mh = dense ? 76 : 92;
  const dailyLabel = tr('dailyBtn') + (dense && S.dailyDone ? '  ✓' : '');
  if (S.cont) b.push({ t: 'btn', id: 'continue', label: tr('continueBtn'), kind: 'primary', size: 32, sub: tr('continueSub', { name: S.cont.name, pct: S.cont.pct }), minH: dense ? 92 : 104 });
  b.push({ t: 'btn', id: 'play', label: tr('playBtn'), kind: S.cont ? 'normal' : 'primary', size: 36, sub: S.demo ? tr('demoLeft', { n: Math.max(0, DEMO_PUZZLES - S.demoCount) }) : undefined, minH: dense ? (S.cont ? 80 : 96) : (S.cont ? 92 : 118) });
  if (dense) {
    b.push({ t: 'row', size: 28, minH: mh, items: [{ id: 'daily', label: dailyLabel }, { id: 'learn', label: `${tr('learnBtn')}  ${lessonsDone(S)}/${LESSONS.length}` }] });
    b.push({ t: 'row', size: 28, minH: mh, items: [{ id: 'auto', label: tr('autoBtn') }, { id: 'howto', label: tr('howtoBtn') }] });
    b.push({ t: 'row', size: 28, minH: mh, items: [{ id: 'rules', label: tr('rulesBtn') }, { id: 'about', label: tr('aboutBtn') }] });
    b.push({ t: 'btn', id: 'settings', label: tr('settingsBtn'), size: 28, minH: mh });
  } else {
    b.push({ t: 'btn', id: 'daily', label: tr('dailyBtn'), size: 30, sub: S.dailyDone ? tr('dailySolved') : undefined, minH: 92 });
    b.push({ t: 'btn', id: 'learn', label: tr('learnBtn'), size: 30, sub: `${lessonsDone(S)} / ${LESSONS.length}`, minH: 92 });
    b.push({ t: 'btn', id: 'auto', label: tr('autoBtn'), size: 30, minH: 92 });
    b.push({ t: 'row', size: 28, minH: 92, items: [{ id: 'howto', label: tr('howtoBtn') }, { id: 'rules', label: tr('rulesBtn') }] });
    b.push({ t: 'row', size: 28, minH: 92, items: [{ id: 'about', label: tr('aboutBtn') }, { id: 'settings', label: tr('settingsBtn') }] });
  }
  b.push({ t: 'row', size: 26, minH: dense ? 70 : 84, items: [{ id: 'lang:en', label: 'Play in English', kind: S.lang === 'en' ? 'on' : 'normal' }, { id: 'lang:ja', label: '日本語で遊ぶ', kind: S.lang === 'ja' ? 'on' : 'normal' }] });
  return b;
}

export function buildUi(S) {
  const scale = TEXT_SCALES[S.textIdx];
  const D = docRects(), land = D.land;
  const ui = { scale, fixed: [], blocks: [], panel: null, region: null, kind: 'doc', scrollKey: S.scene };
  if (S.overlay) return overlayUi(S, scale);

  switch (S.scene) {
    case 'title': {
      ui.kind = 'menu';
      const T = titleRects();
      ui.region = T.region;
      let b = titleBlocks(S, false);
      if (layoutDoc(b, scale, ui.region.w).height > ui.region.h) b = titleBlocks(S, true);
      ui.blocks = b;
      ui.fixed = [{ id: 'arcforge', rect: lockupHit(T), lockup: T.lockup }];   // the Arcforge lockup under the menu: a tap opens the Arcforge home
      break;
    }
    case 'chapters': {
      ui.panel = D.panelFull; ui.region = D.body;
      ui.fixed = fixedBar(S);
      const b = [{ t: 'h', text: tr('chapters'), size: 38 }];
      CHAPTERS.forEach((ch, i) => {
        const st = chapterStats(S, i);
        b.push({ t: 'btn', id: `ch:${i}`, label: `${i + 1}. ${L(ch.name)}`, kind: st.done === st.total ? 'on' : 'normal', size: 30, sub: `${tr('sizeLabel', { w: ch.size, h: ch.size })} · ${tr('picturesDone', { a: st.done, b: st.total })} · ${tr('starsOf', { a: st.stars, b: st.total * 3 })}`, minH: 108 });
      });
      ui.blocks = b;
      break;
    }
    case 'pictures': {
      ui.panel = D.panelFull; ui.region = D.body;
      ui.fixed = fixedBar(S);
      const ci = S.chapterIdx, ch = CHAPTERS[ci], list = CHAPTER_PUZZLES[ci];
      const st = chapterStats(S, ci);
      const b = [{ t: 'h', text: `${ci + 1}. ${L(ch.name)}`, size: 36 }, { t: 'p', text: `${L(ch.blurb)}  ${tr('picturesDone', { a: st.done, b: st.total })} · ${tr('starsOf', { a: st.stars, b: st.total * 3 })}`, size: 22, gap: 10 }];
      b.push({
        t: 'grid', cols: Math.max(2, Math.min(8, Math.round(ui.region.w / (scale <= 1 ? 150 : scale <= 1.5 ? 200 : 270)))), aspect: scale <= 1 ? 1.2 : 1.1,
        cells: list.map((p, i) => ({ id: `pz:${p.id}`, label: String(i + 1), puz: p, stars: starsOf(S, p.id), open: Boolean(S.openIds[p.id]), locked: S.demo && (ci !== 0 || i >= DEMO_PUZZLES) })),
      });
      ui.blocks = b;
      break;
    }
    case 'daily': {
      ui.kind = 'card';
      const zs = (n) => (scale >= 2 ? n * 0.55 : n);
      ui.blocks = [
        { t: 'h', text: tr('dailyHead'), size: zs(38) },
        { t: 'img', name: 'dailythumb', h: land ? 150 : scale >= 2 ? 150 : 300 },
        { t: 'p', text: S.dailyDone ? tr('dailySolved') : tr('dailyBody'), size: zs(26), center: true },
        { t: 'p', text: tr('dailyStreak', { n: S.daily.streak }), size: zs(24), center: true },
        { t: 'btn', id: 'daily:play', label: tr('dailyPlay'), kind: 'primary', size: scale >= 2 ? 22 : 30, minH: scale >= 2 ? 58 : 88 },
        { t: 'btn', id: 'menu', label: tr('quitMenu'), size: scale >= 2 ? 22 : 28, minH: scale >= 2 ? 56 : 84 },
      ];
      fitCard(ui, scale);
      return ui;
    }
    case 'learn': {
      ui.panel = D.panelFull; ui.region = D.body;
      ui.fixed = fixedBar(S);
      const b = [{ t: 'h', text: tr('lessonsTitle'), size: 36 }, { t: 'p', text: `${lessonsDone(S)} / ${LESSONS.length}`, size: 24, gap: 10 }];
      LESSONS.forEach((l, i) => {
        const locked = S.demo && i >= 3;
        b.push({ t: 'btn', id: `les:${i}`, label: `${i + 1}. ${L(l.title)}`, kind: S.lessons[l.id] ? 'on' : 'normal', size: 28, sub: locked ? tr('locked') : S.lessons[l.id] ? tr('lessonDone') : undefined, disabled: locked, minH: 92 });
      });
      ui.blocks = b;
      break;
    }
    case 'lesson': {
      ui.panel = D.panel; ui.region = D.bodyNav;
      ui.fixed = fixedBar(S);
      const l = LESSONS[S.lessonIdx];
      ui.nav = { label: `${S.lessonIdx + 1} / ${LESSONS.length}`, prev: { id: 'les:list', rect: D.navPrev, label: tr('lessonList'), kind: 'normal', size: 24 }, next: { id: 'les:go', rect: D.navNext, label: tr('lessonStart'), kind: 'primary', size: 24 } };
      ui.scrollKey = `lesson:${S.lessonIdx}`;
      ui.blocks = [{ t: 'h', text: L(l.title), size: 40 }, { t: 'img', name: l.art, h: land ? Math.min(380, Math.round(ui.region.h * 0.6)) : 380 }, { t: 'p', text: L(l.intro), size: 30 }];
      break;
    }
    // How to Play and Rules are one continuous scrolling reader (drag, wheel, keys, scroll bar), so large text never means many tiny pages.
    case 'howto':
    case 'rules': {
      const isRules = S.scene === 'rules';
      const pages = isRules ? RULES : HOWTO;
      ui.fixed = fixedBar(S);
      if (isRules) { ui.panel = D.panelFull; ui.region = D.body; }
      else {
        ui.panel = D.panel; ui.region = D.bodyNav;
        ui.nav = { label: '', prev: null, next: { id: 'play', rect: D.navWide, label: tr('playBtn'), kind: 'primary', size: 28 } };
      }
      const artH = (h) => (land ? Math.min(h, Math.round(ui.region.h * 0.6)) : h);
      const b = [];
      pages.forEach((pg, pi) => {
        if (pi) b.push({ t: 'gap', h: 36 });
        b.push({ t: 'h', text: L(pg.title), size: 40, page: pi });
        if (pg.art) b.push({ t: 'img', name: pg.art, h: artH(isRules ? 380 : 400) });
        if (isRules) for (const para of pg.body) b.push({ t: 'p', text: L(para), size: 29 });
        else b.push({ t: 'p', text: L(pg.body), size: 32 });
      });
      ui.blocks = b;
      break;
    }
    case 'about': {
      ui.panel = D.panelFull; ui.region = D.body;
      ui.fixed = fixedBar(S);
      const b = [{ t: 'img', name: 'logo', h: land ? 200 : 280 }];
      ABOUT.forEach((s, i) => { b.push({ t: 'h', text: L(s.title), size: i === 0 ? 38 : 30 }); for (const para of s.body.length === 2 && typeof s.body[0] === 'string' ? [L(s.body)] : s.body) b.push({ t: 'p', text: para, size: 26 }); });
      b.push({ t: 'p', text: `v${S.version}`, size: 22 });
      ui.blocks = b;
      break;
    }
    case 'settings': {
      ui.panel = D.panelFull; ui.region = D.body;
      ui.fixed = fixedBar(S);
      const b = [];
      b.push({ t: 'h', text: tr('settingsBtn'), size: 36 });
      b.push({ t: 'p', text: tr('language'), size: 24, gap: 6 });
      b.push({ t: 'row', size: 26, items: [{ id: 'lang:en', label: 'Play in English', kind: S.lang === 'en' ? 'on' : 'normal' }, { id: 'lang:ja', label: '日本語で遊ぶ', kind: S.lang === 'ja' ? 'on' : 'normal' }] });
      b.push({ t: 'p', text: tr('theme'), size: 24, gap: 6 });
      for (const th of THEMES) b.push({ t: 'btn', id: `theme:${th.id}`, label: S.lang === 'ja' ? th.jaName : th.name, kind: S.themeId === th.id ? 'on' : 'normal', size: 28 });
      b.push({ t: 'btn', id: 'set:sound', label: S.sound ? tr('soundOn') : tr('soundOff'), kind: S.sound ? 'on' : 'normal', size: 28 });
      b.push({ t: 'btn', id: 'set:check', label: S.check ? tr('checkOn') : tr('checkOff'), kind: S.check ? 'on' : 'normal', size: 28 });
      b.push({ t: 'p', text: `${tr('thinkTime')}: ${THINK_STEPS[S.thinkIdx]}${tr('seconds')}`, size: 24, gap: 6 });
      b.push({ t: 'row', size: 30, items: [{ id: 'set:think-', label: '-', disabled: S.thinkIdx === 0 }, { id: 'set:think+', label: '+', disabled: S.thinkIdx === THINK_STEPS.length - 1 }] });
      if (!S.demo) {
        if (S.owns) b.push({ t: 'p', text: tr('owned'), size: 24 });
        else b.push({ t: 'btn', id: 'set:unlock', label: S.price ? `${tr('unlock')} · ${S.price}` : tr('unlock'), kind: 'primary', size: 28 });
        b.push({ t: 'btn', id: 'set:restore', label: tr('restore'), size: 26 });
      }
      b.push({ t: 'btn', id: 'set:reset', label: S.resetArm ? tr('resetConfirm') : tr('resetProgress'), kind: 'danger', size: 26 });
      ui.blocks = b;
      break;
    }
    case 'demo-limit': {
      ui.kind = 'card';
      const zs = (n) => (scale >= 2 ? n * 0.5 : n);
      ui.blocks = [
        { t: 'img', name: 'lock', h: land ? 90 : scale >= 2 ? 90 : 180 },
        { t: 'h', text: tr('demoLimitTitle'), size: zs(32) },
        { t: 'p', text: tr('demoLimitBody'), size: zs(26) },
        { t: 'btn', id: 'auto', label: tr('autoBtn'), kind: 'primary', size: scale >= 2 ? 20 : 28, minH: scale >= 2 ? 56 : 84 },
        { t: 'btn', id: 'menu', label: tr('quitMenu'), size: scale >= 2 ? 20 : 28, minH: scale >= 2 ? 56 : 84 },
      ];
      fitCard(ui, scale);
      return ui;
    }
    default:
      ui.kind = 'none';
  }
  ui.layout = layoutDoc(ui.blocks, scale, ui.region ? ui.region.w : 600);
  if (S.scene === 'rules' || S.scene === 'howto') ui.pageY = ui.layout.items.filter((it) => it.b.page !== undefined).map((it) => it.y);
  ui.offY = ui.kind === 'menu' ? Math.max(0, (ui.region.h - ui.layout.height) / 2) : 0;
  return ui;
}

function overlayUi(S, scale) {
  const land = cardFrame().land;
  const ui = { scale, fixed: [], blocks: [], kind: 'card', panel: null, scrollKey: `ov:${S.overlay}`, overlay: true };
  const b = [];
  const f = scale <= 1.5 ? 1 : scale <= 2 ? 0.72 : scale <= 2.5 ? 0.58 : 0.5;
  const hs = (n) => n * f;
  const ps = (n) => n * f * 0.9;
  const bs = (n) => n * f;
  const bmin = land ? (scale <= 1.5 ? (S.overlay === 'end' ? 52 : 64) : scale <= 2 ? 56 : 50) : scale <= 1.5 ? 84 : scale <= 2 ? 62 : 52;
  if (S.overlay === 'pause') {
    b.push({ t: 'h', text: tr('pauseTitle'), size: hs(40) });
    b.push({ t: 'p', text: `${tr('textSize')}: ${pctLabel(S)}`, size: ps(22), center: true, gap: 4 });
    b.push({ t: 'btn', id: 'ov:resume', label: tr('resume'), kind: 'primary', size: bs(30), minH: bmin });
    b.push({ t: 'btn', id: 'ov:restart', label: tr('restart'), size: bs(28), minH: bmin });
    b.push({ t: 'btn', id: 'set:sound', label: S.sound ? tr('soundOn') : tr('soundOff'), kind: S.sound ? 'on' : 'normal', size: bs(26), minH: bmin });
    b.push({ t: 'row', size: bs(28), minH: bmin, items: [{ id: 'zoom-', label: 'A-', disabled: S.textIdx === 0 }, { id: 'zoom+', label: 'A+', disabled: S.textIdx === TEXT_SCALES.length - 1 }] });
    b.push({ t: 'btn', id: 'ov:list', label: tr('chapterList'), size: bs(26), minH: bmin });
    b.push({ t: 'btn', id: 'ov:menu', label: tr('quitMenu'), size: bs(28), minH: bmin });
  } else if (S.overlay === 'end') {
    const e = S.endInfo ?? { head: '', body: '', stars: 0 };
    b.push({ t: 'h', text: e.head, size: hs(38) });
    b.push({ t: 'img', name: 'endstars', h: land ? (scale >= 2 ? 56 : 70) : scale >= 2 ? 80 : 130, data: e });
    b.push({ t: 'p', text: e.body, size: ps(26), center: true });
    if (!e.lesson) b.push({ t: 'img', name: 'more', h: land ? 58 : 40 });
    if (e.lesson) {
      b.push({ t: 'btn', id: 'ov:lessonnext', label: e.last ? tr('lessonList') : tr('lessonNext'), kind: 'primary', size: bs(30), minH: bmin });
      b.push({ t: 'btn', id: 'ov:lessons', label: tr('lessonList'), size: bs(28), minH: bmin });
    } else {
      if (e.next) b.push({ t: 'btn', id: 'ov:nextpic', label: tr('endNext'), kind: 'primary', size: bs(30), minH: bmin });
      b.push({ t: 'btn', id: 'ov:again', label: tr('endAgain'), kind: e.next ? 'normal' : 'primary', size: bs(28), minH: bmin });
      b.push({ t: 'btn', id: 'ov:list', label: tr('chapterList'), size: bs(28), minH: bmin });
      b.push({ t: 'btn', id: 'ov:menu', label: tr('endMenu'), size: bs(28), minH: bmin });
    }
  } else if (S.overlay === 'why') {
    const e = S.match && S.match.hint ? S.match.hint : { head: '', why: '' };
    b.push({ t: 'h', text: e.head, size: hs(34) });
    b.push({ t: 'p', text: e.why, size: ps(28) });
    if (e.step) b.push({ t: 'btn', id: 'ov:hintdo', label: tr('hintApply'), kind: 'primary', size: bs(30), minH: bmin });
    b.push({ t: 'btn', id: 'ov:hintclose', label: tr('back'), size: bs(28), minH: bmin });
  } else if (S.overlay === 'autosum') {
    b.push({ t: 'h', text: tr('autoSession'), size: hs(38) });
    b.push({ t: 'p', text: tr('autoSummary'), size: ps(26) });
    b.push({ t: 'btn', id: 'ov:autoagain', label: tr('autoAgain'), kind: 'primary', size: bs(28), minH: bmin });
    b.push({ t: 'btn', id: 'ov:autoexit', label: tr('autoExit'), size: bs(28), minH: bmin });
  }
  ui.blocks = b;
  fitCard(ui, scale, S.overlay === 'end' && !(S.endInfo && S.endInfo.lesson) ? 'end' : 'card');
  return ui;
}

// Landscape cards are wide and short: consecutive plain buttons go two across.
function pairButtons(blocks) {
  const out = [];
  let pend = null;
  const flush = () => { if (pend) { out.push(pend); pend = null; } };
  for (const b of blocks) {
    if (b.t !== 'btn') { flush(); out.push(b); continue; }
    if (!pend) { pend = b; continue; }
    out.push({ t: 'row', size: Math.min(pend.size, b.size), minH: Math.max(pend.minH ?? 84, b.minH ?? 84), items: [{ id: pend.id, label: pend.label, kind: pend.kind, disabled: pend.disabled }, { id: b.id, label: b.label, kind: b.kind, disabled: b.disabled }] });
    pend = null;
  }
  flush();
  return out;
}

// kind 'end' = a result card (bottom of a portrait screen, left side of a landscape one); 'card' = centred.
function fitCard(ui, scale, kind = 'card') {
  const C = cardFrame(kind);
  const innerW = C.w - 48;
  const bodyBlocks = ui.blocks.filter((b) => b.t !== 'btn' && b.t !== 'row');
  let actBlocks = ui.blocks.filter((b) => b.t === 'btn' || b.t === 'row');
  if (C.land && !C.side) actBlocks = pairButtons(actBlocks);
  const body = layoutDoc(bodyBlocks, scale, innerW);
  const act = layoutDoc(actBlocks, scale, innerW);
  const maxH = C.y1 - C.y0;
  if (body.height + act.height + 72 > maxH) {
    // Too much for a short landscape screen at this text size: the whole card becomes one scrolling page (buttons included).
    const all = layoutDoc(C.land && !C.side ? [...bodyBlocks, ...actBlocks] : ui.blocks, scale, innerW);
    const hh = Math.min(maxH, Math.max(Math.min(420, maxH), all.height + 56));
    ui.panel = { x: C.x, y: Math.round(C.y0 + (maxH - hh) / 2), w: C.w, h: hh };
    ui.region = { x: C.x + 24, y: ui.panel.y + 28, w: innerW, h: hh - 56 };
    ui.layout = all; ui.fixed = [];
    return;
  }
  const h = Math.min(maxH, Math.max(Math.min(420, maxH), body.height + act.height + 72));
  const y = C.bottom ? C.y1 - 4 - h : Math.round(C.y0 + (maxH - h) / 2);
  const x0 = C.x + 24;
  const actTop = y + h - 28 - act.height;
  ui.panel = { x: C.x, y, w: C.w, h };
  ui.region = { x: x0, y: y + 28, w: innerW, h: Math.max(100, h - 56 - act.height - 8) };
  ui.layout = body;
  ui.fixed = act.items.flatMap((it) => it.btns.map((bt) => ({
    id: bt.id, rect: { x: x0 + bt.x, y: actTop + bt.y, w: bt.w, h: bt.h }, kind: bt.kind ?? it.b.kind ?? 'normal', lines: bt.lines ?? it.lines, size: it.size, line: it.line, disabled: bt.disabled, static: bt.id == null, label: bt.label,
  })));
}
export { TOTAL };
