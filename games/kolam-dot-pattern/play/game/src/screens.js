// Builds the block lists for every text screen. Both game.js (hit-testing) and view.js (drawing) call buildUi() with the same state,
// so layout and taps always agree at every text-zoom step.
import { TEXT_SCALES, layoutDoc } from './ui.js';
import { HOWTO, RULES, ABOUT, STR as X, LESSON_TEXT } from './content.js';
import { CHAPTERS, chapterIds, puzzleById, LESSON_COUNT } from './puzzles.js';
import { THEMES } from './art.js';
import { DOC_BACK, ZOOM_DEC, ZOOM_INC, DOC_PANEL, DOC_BODY, DOC_BODY_NAV, NAV_PREV, NAV_NEXT, MENU_REGION, OVERLAY } from './layout.js';

export const DEMO_PUZZLES = 3;
export const THINK_STEPS = [2, 5, 8, 10];
export const demoOver = (S) => S.demo && S.demoCount >= DEMO_PUZZLES;
export const starsOf = (S, id) => S.results[id] ?? 0;
export const chapterStats = (S, ci) => {
  const ids = chapterIds(ci);
  return { done: ids.filter((id) => starsOf(S, id) > 0).length, total: ids.length, stars: ids.reduce((a, id) => a + starsOf(S, id), 0) };
};
export const lessonsDone = (S) => Object.keys(S.lessons).length;
const pctLabel = (S) => `${Math.round(TEXT_SCALES[S.textIdx] * 100)}%`;

function fixedBar(S) {
  return [
    { id: 'back', rect: DOC_BACK, kind: 'normal', icon: 'back', label: X.back, size: 26 },
    { id: 'zoom-', rect: ZOOM_DEC, kind: 'normal', label: 'A-', size: 30, disabled: S.textIdx === 0 },
    { id: 'zoom+', rect: ZOOM_INC, kind: 'normal', label: 'A+', size: 30, disabled: S.textIdx === TEXT_SCALES.length - 1 },
    { id: null, rect: { x: 480, y: 20, w: 140, h: 76 }, label: pctLabel(S), size: 28, static: true },
  ];
}

export function buildUi(S) {
  const scale = TEXT_SCALES[S.textIdx];
  const ui = { scale, fixed: [], blocks: [], panel: null, region: null, kind: 'doc', scrollKey: S.scene };
  if (S.overlay) return overlayUi(S, scale);
  switch (S.scene) {
    case 'title': {
      ui.kind = 'menu'; ui.region = MENU_REGION;
      const b = [];
      if (S.cont) b.push({ t: 'btn', id: 'continue', label: X.continueBtn, kind: 'primary', size: 32, sub: `${S.cont.name} · ${S.cont.pct}%`, minH: 104 });
      b.push({ t: 'btn', id: 'play', label: X.playBtn, kind: S.cont ? 'normal' : 'primary', size: 36, sub: S.demo ? `${Math.max(0, DEMO_PUZZLES - S.demoCount)} free patterns left in this preview` : undefined, minH: S.cont ? 92 : 118 });
      b.push({ t: 'btn', id: 'daily', label: X.dailyBtn, size: 30, sub: S.dailyDone ? X.dailySolved : undefined, minH: 92 });
      b.push({ t: 'row', size: 28, minH: 92, items: [{ id: 'sandbox', label: X.sandboxBtn }, { id: 'learn', label: X.learnBtn }] });
      b.push({ t: 'btn', id: 'auto', label: X.autoBtn, size: 30, minH: 92 });
      b.push({ t: 'row', size: 28, minH: 92, items: [{ id: 'howto', label: X.howtoBtn }, { id: 'rules', label: X.rulesBtn }] });
      b.push({ t: 'row', size: 28, minH: 92, items: [{ id: 'about', label: X.aboutBtn }, { id: 'settings', label: X.settingsBtn }] });
      ui.blocks = b;
      break;
    }
    case 'chapters': {
      ui.panel = DOC_PANEL; ui.region = DOC_BODY; ui.fixed = fixedBar(S);
      const b = [{ t: 'h', text: X.chapters, size: 38 }];
      CHAPTERS.forEach((ch, i) => {
        const st = chapterStats(S, i);
        b.push({ t: 'btn', id: `ch:${i}`, label: `${i + 1}. ${ch.name}`, kind: st.done === st.total ? 'on' : 'normal', size: 30, sub: `${st.done} of ${st.total} patterns · ${st.stars} of ${st.total * 3} stars`, minH: 108 });
      });
      ui.blocks = b;
      break;
    }
    case 'patterns': {
      ui.panel = DOC_PANEL; ui.region = DOC_BODY; ui.fixed = fixedBar(S);
      const ci = S.chapterIdx, ch = CHAPTERS[ci], ids = chapterIds(ci), st = chapterStats(S, ci);
      const b = [{ t: 'h', text: `${ci + 1}. ${ch.name}`, size: 36 }, { t: 'p', text: `${ch.blurb}  ${st.done} of ${st.total} patterns · ${st.stars} of ${st.total * 3} stars`, size: 22, gap: 10 }];
      b.push({ t: 'grid', cols: scale <= 1 ? 4 : scale <= 1.5 ? 3 : 2, aspect: scale <= 1 ? 1.2 : 1.1, cells: ids.map((id, i) => ({ id: `pz:${id}`, label: String(i + 1), pid: id, stars: starsOf(S, id), open: Boolean(S.openIds[id]), locked: S.demo && (ci !== 0 || i >= DEMO_PUZZLES) })) });
      ui.blocks = b;
      break;
    }
    case 'daily': {
      ui.kind = 'card';
      const zs = (n) => (scale >= 2 ? n * 0.55 : n);
      ui.blocks = [
        { t: 'h', text: X.dailyHead, size: zs(38) },
        { t: 'img', name: 'dailythumb', h: scale >= 2 ? 150 : 300 },
        { t: 'p', text: S.dailyDone ? X.dailySolved : X.dailyBody, size: zs(26), center: true },
        { t: 'p', text: `Streak: ${S.daily.streak} days`, size: zs(24), center: true },
        { t: 'btn', id: 'daily:play', label: X.dailyPlay, kind: 'primary', size: scale >= 2 ? 22 : 30, minH: scale >= 2 ? 58 : 88 },
        { t: 'btn', id: 'menu', label: X.quitMenu, size: scale >= 2 ? 22 : 28, minH: scale >= 2 ? 56 : 84 },
      ];
      fitCard(ui, scale);
      return ui;
    }
    case 'learn': {
      ui.panel = DOC_PANEL; ui.region = DOC_BODY; ui.fixed = fixedBar(S);
      const b = [{ t: 'h', text: X.lessonsTitle, size: 36 }, { t: 'p', text: `${lessonsDone(S)} / ${LESSON_COUNT}`, size: 24, gap: 10 }];
      LESSON_TEXT.forEach((l, i) => {
        const locked = S.demo && i >= 3;
        b.push({ t: 'btn', id: `les:${i}`, label: `${i + 1}. ${l.title}`, kind: S.lessons[i] ? 'on' : 'normal', size: 28, sub: locked ? X.locked : S.lessons[i] ? X.lessonDone : undefined, disabled: locked, minH: 92 });
      });
      ui.blocks = b;
      break;
    }
    case 'lesson': {
      ui.panel = DOC_PANEL; ui.region = DOC_BODY_NAV; ui.fixed = fixedBar(S);
      const l = LESSON_TEXT[S.lessonIdx];
      ui.nav = { label: `${S.lessonIdx + 1} / ${LESSON_COUNT}`, prev: { id: 'les:list', rect: NAV_PREV, label: X.lessonList, kind: 'normal', size: 24 }, next: { id: 'les:go', rect: NAV_NEXT, label: X.lessonStart, kind: 'primary', size: 24 } };
      ui.scrollKey = `lesson:${S.lessonIdx}`;
      ui.blocks = [{ t: 'h', text: l.title, size: 40 }, { t: 'img', name: 'lesson', h: 380, data: { i: S.lessonIdx } }, { t: 'p', text: l.intro, size: 30 }];
      break;
    }
    case 'howto':
    case 'rules': {
      const isRules = S.scene === 'rules';
      const pages = isRules ? RULES : HOWTO;
      const pi = Math.min(S.page[S.scene], pages.length - 1), pg = pages[pi];
      ui.panel = DOC_PANEL; ui.region = DOC_BODY_NAV; ui.fixed = fixedBar(S);
      ui.nav = { label: `${pi + 1} / ${pages.length}`, prev: { id: 'prev', rect: NAV_PREV, label: X.prev, disabled: pi === 0, kind: 'normal', size: 26 }, next: { id: 'next', rect: NAV_NEXT, label: isRules || pi < pages.length - 1 ? X.next : X.playBtn, disabled: isRules && pi === pages.length - 1, kind: 'primary', size: 26 } };
      ui.scrollKey = `${S.scene}:${pi}`;
      const b = [{ t: 'h', text: pg.title, size: 40 }];
      if (pg.art) b.push({ t: 'img', name: pg.art, h: isRules ? 360 : 400 });
      if (isRules) for (const para of pg.body) b.push({ t: 'p', text: para, size: 29 });
      else b.push({ t: 'p', text: pg.body, size: 32 });
      ui.blocks = b;
      break;
    }
    case 'about': {
      ui.panel = DOC_PANEL; ui.region = DOC_BODY; ui.fixed = fixedBar(S);
      const b = [{ t: 'img', name: 'logo', h: 280 }];
      ABOUT.forEach((s, i) => { b.push({ t: 'h', text: s.title, size: i === 0 ? 38 : 30 }); for (const para of s.body) b.push({ t: 'p', text: para, size: 26 }); });
      b.push({ t: 'p', text: `v${S.version}`, size: 22 });
      ui.blocks = b;
      break;
    }
    case 'settings': {
      ui.panel = DOC_PANEL; ui.region = DOC_BODY; ui.fixed = fixedBar(S);
      const b = [{ t: 'h', text: X.settingsBtn, size: 36 }, { t: 'p', text: X.look, size: 24, gap: 6 }];
      for (const th of THEMES) b.push({ t: 'btn', id: `theme:${th.id}`, label: th.name, kind: S.themeId === th.id ? 'on' : 'normal', size: 28 });
      b.push({ t: 'btn', id: 'set:sound', label: S.sound ? X.soundOn : X.soundOff, kind: S.sound ? 'on' : 'normal', size: 28 });
      b.push({ t: 'btn', id: 'set:guide', label: S.check ? X.guideOn : X.guideOff, kind: S.check ? 'on' : 'normal', size: 28 });
      b.push({ t: 'p', text: `${X.thinkTime}: ${THINK_STEPS[S.thinkIdx]}${X.seconds}`, size: 24, gap: 6 });
      b.push({ t: 'row', size: 30, items: [{ id: 'set:think-', label: '-', disabled: S.thinkIdx === 0 }, { id: 'set:think+', label: '+', disabled: S.thinkIdx === THINK_STEPS.length - 1 }] });
      if (!S.demo) {
        if (S.owns) b.push({ t: 'p', text: X.owned, size: 24 });
        else b.push({ t: 'btn', id: 'set:unlock', label: S.price ? `${X.unlock} · ${S.price}` : X.unlock, kind: 'primary', size: 28 });
        b.push({ t: 'btn', id: 'set:restore', label: X.restore, size: 26 });
      }
      b.push({ t: 'btn', id: 'set:reset', label: S.resetArm ? X.resetConfirm : X.resetProgress, kind: 'danger', size: 26 });
      ui.blocks = b;
      break;
    }
    case 'demo-limit': {
      ui.kind = 'card';
      const zs = (n) => (scale >= 2 ? n * 0.5 : n);
      ui.blocks = [
        { t: 'img', name: 'lock', h: scale >= 2 ? 90 : 180 },
        { t: 'h', text: X.demoLimitTitle, size: zs(32) },
        { t: 'p', text: X.demoLimitBody, size: zs(26) },
        { t: 'btn', id: 'auto', label: X.autoBtn, kind: 'primary', size: scale >= 2 ? 20 : 28, minH: scale >= 2 ? 56 : 84 },
        { t: 'btn', id: 'menu', label: X.quitMenu, size: scale >= 2 ? 20 : 28, minH: scale >= 2 ? 56 : 84 },
      ];
      fitCard(ui, scale);
      return ui;
    }
    default: ui.kind = 'none';
  }
  ui.layout = layoutDoc(ui.blocks, scale, ui.region ? ui.region.w : 600);
  ui.offY = ui.kind === 'menu' ? Math.max(0, (ui.region.h - ui.layout.height) / 2) : 0;
  return ui;
}

function overlayUi(S, scale) {
  const ui = { scale, fixed: [], blocks: [], kind: 'card', panel: OVERLAY, scrollKey: `ov:${S.overlay}`, overlay: true };
  ui.region = { x: OVERLAY.x + 24, y: OVERLAY.y + 24, w: OVERLAY.w - 48, h: OVERLAY.h - 48 };
  const b = [];
  const f = scale <= 1.5 ? 1 : scale <= 2 ? 0.72 : scale <= 2.5 ? 0.58 : 0.5;
  const hs = (n) => n * f, ps = (n) => n * f * 0.9, bs = (n) => n * f;
  const bmin = scale <= 1.5 ? 84 : scale <= 2 ? 62 : 52;
  if (S.overlay === 'pause') {
    b.push({ t: 'h', text: X.pauseTitle, size: hs(40) });
    b.push({ t: 'p', text: `${X.textSize}: ${pctLabel(S)}`, size: ps(22), center: true, gap: 4 });
    b.push({ t: 'btn', id: 'ov:resume', label: X.resume, kind: 'primary', size: bs(30), minH: bmin });
    b.push({ t: 'btn', id: 'ov:restart', label: X.restart, size: bs(28), minH: bmin });
    b.push({ t: 'btn', id: 'set:sound', label: S.sound ? X.soundOn : X.soundOff, kind: S.sound ? 'on' : 'normal', size: bs(26), minH: bmin });
    b.push({ t: 'row', size: bs(28), minH: bmin, items: [{ id: 'zoom-', label: 'A-', disabled: S.textIdx === 0 }, { id: 'zoom+', label: 'A+', disabled: S.textIdx === TEXT_SCALES.length - 1 }] });
    b.push({ t: 'btn', id: 'ov:list', label: S.match && S.match.sandbox ? X.quitMenu : X.list, size: bs(26), minH: bmin });
    if (!(S.match && S.match.sandbox)) b.push({ t: 'btn', id: 'ov:menu', label: X.quitMenu, size: bs(28), minH: bmin });
  } else if (S.overlay === 'end') {
    const e = S.endInfo ?? { head: '', body: '', stars: 0 };
    b.push({ t: 'h', text: e.head, size: hs(38) });
    b.push({ t: 'img', name: 'endstars', h: scale >= 2 ? 80 : 130, data: e });
    b.push({ t: 'p', text: e.body, size: ps(26), center: true });
    if (e.lesson) {
      b.push({ t: 'btn', id: 'ov:lessonnext', label: e.last ? X.lessonList : X.lessonNext, kind: 'primary', size: bs(30), minH: bmin });
      b.push({ t: 'btn', id: 'ov:lessons', label: X.lessonList, size: bs(28), minH: bmin });
    } else {
      if (e.next) b.push({ t: 'btn', id: 'ov:nextpic', label: X.endNext, kind: 'primary', size: bs(30), minH: bmin });
      b.push({ t: 'btn', id: 'ov:again', label: X.endAgain, kind: e.next ? 'normal' : 'primary', size: bs(28), minH: bmin });
      b.push({ t: 'btn', id: 'ov:list', label: X.list, size: bs(28), minH: bmin });
      b.push({ t: 'btn', id: 'ov:menu', label: X.endMenu, size: bs(28), minH: bmin });
    }
  } else if (S.overlay === 'why') {
    const e = S.match && S.match.hint ? S.match.hint : { head: '', why: '' };
    b.push({ t: 'h', text: e.head, size: hs(34) });
    b.push({ t: 'p', text: e.why, size: ps(28) });
    if (e.seg && e.seg.length) b.push({ t: 'btn', id: 'ov:hintdo', label: X.hintApply, kind: 'primary', size: bs(30), minH: bmin });
    b.push({ t: 'btn', id: 'ov:hintclose', label: X.back, size: bs(28), minH: bmin });
  } else if (S.overlay === 'autosum') {
    b.push({ t: 'h', text: X.autoSession, size: hs(38) });
    b.push({ t: 'p', text: X.autoSummary, size: ps(26) });
    b.push({ t: 'btn', id: 'ov:autoagain', label: X.autoAgain, kind: 'primary', size: bs(28), minH: bmin });
    b.push({ t: 'btn', id: 'ov:autoexit', label: X.autoExit, size: bs(28), minH: bmin });
  }
  ui.blocks = b;
  fitCard(ui, scale, S.overlay === 'end' && !(S.endInfo && S.endInfo.lesson));
  return ui;
}

function fitCard(ui, scale, bottom = false) {
  const innerW = OVERLAY.w - 48;
  const bodyBlocks = ui.blocks.filter((b) => b.t !== 'btn' && b.t !== 'row');
  const actBlocks = ui.blocks.filter((b) => b.t === 'btn' || b.t === 'row');
  const body = layoutDoc(bodyBlocks, scale, innerW), act = layoutDoc(actBlocks, scale, innerW);
  const h = Math.min(OVERLAY.h + 120, Math.max(420, body.height + act.height + 72));
  const y = bottom ? 1560 - 28 - h : Math.round(780 - h / 2);
  const x0 = OVERLAY.x + 24;
  const actTop = y + h - 28 - act.height;
  ui.panel = { x: OVERLAY.x, y, w: OVERLAY.w, h };
  ui.region = { x: x0, y: y + 28, w: innerW, h: Math.max(160, h - 56 - act.height - 8) };
  ui.layout = body;
  ui.fixed = act.items.flatMap((it) => it.btns.map((bt) => ({ id: bt.id, rect: { x: x0 + bt.x, y: actTop + bt.y, w: bt.w, h: bt.h }, kind: bt.kind ?? it.b.kind ?? 'normal', lines: bt.lines ?? it.lines, size: it.size, line: it.line, disabled: bt.disabled, static: bt.id == null, label: bt.label })));
}
export { puzzleById };
