// Builds the block lists for every text screen. Both game.js (hit-testing) and view.js (drawing) call buildUi() with the same state,
// so layout and taps always agree at every text-zoom step.
import { TEXT_SCALES, layoutDoc } from './ui.js';
import { HOWTO, RULES, ABOUT, STR as X, LESSON_TEXT } from './content.js';
import { CHAPTERS, chapterIds, puzzleById, LESSON_COUNT } from './puzzles.js';
import { THEMES } from './art.js';
import { docRects, menuFrame, cardFrame, isWide, screen, clamp, minText, tapMin, lockupRect, LOCK_W, LOCK_H } from './layout.js';
const isTallScreen = () => screen.h >= 1400 && !isWide();
const screenW = () => screen.w;

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

function fixedBar(S, D) {
  return [
    { id: 'back', rect: D.back, kind: 'normal', icon: 'back', label: X.back, size: 26 },
    { id: 'zoom-', rect: D.zoomDec, kind: 'normal', label: 'A-', size: 30, disabled: S.textIdx === 0 },
    { id: 'zoom+', rect: D.zoomInc, kind: 'normal', label: 'A+', size: 30, disabled: S.textIdx === TEXT_SCALES.length - 1 },
    { id: null, rect: D.pct, label: pctLabel(S), size: 28, static: true },
  ];
}

// The title menu: a single column on a tall phone, two buttons per row everywhere the height is tight. `den` shrinks it to fit.
function menuBlocks(S, dense, den) {
  const m = (v) => Math.round(v * den), sz = (v) => v * Math.max(0.78, den);
  const play = { id: 'play', label: X.playBtn, kind: S.cont ? 'normal' : 'primary', size: sz(36), sub: S.demo ? `${Math.max(0, DEMO_PUZZLES - S.demoCount)} free patterns left in this preview` : undefined, minH: m(S.cont ? 92 : 118) };
  const cont = S.cont ? { id: 'continue', label: X.continueBtn, kind: 'primary', size: sz(32), sub: `${S.cont.name} · ${S.cont.pct}%`, minH: m(104) } : null;
  const b = [];
  if (!dense) {
    if (cont) b.push({ t: 'btn', ...cont });
    b.push({ t: 'btn', ...play });
    b.push({ t: 'btn', id: 'daily', label: X.dailyBtn, size: sz(30), sub: S.dailyDone ? X.dailySolved : undefined, minH: m(92) });
    b.push({ t: 'row', size: sz(28), minH: m(92), items: [{ id: 'sandbox', label: X.sandboxBtn }, { id: 'learn', label: X.learnBtn }] });
    b.push({ t: 'btn', id: 'auto', label: X.autoBtn, size: sz(30), minH: m(92) });
  } else {
    if (cont) b.push({ t: 'btn', ...cont }, { t: 'btn', ...play, minH: m(84), size: sz(30), sub: undefined });
    else b.push({ t: 'btn', ...play, minH: m(100), size: sz(34) });
    b.push({ t: 'row', size: sz(27), minH: m(84), items: [{ id: 'daily', label: X.dailyBtn }, { id: 'sandbox', label: X.sandboxBtn }] });
    b.push({ t: 'row', size: sz(27), minH: m(84), items: [{ id: 'learn', label: X.learnBtn }, { id: 'auto', label: X.autoBtn }] });
  }
  b.push({ t: 'row', size: sz(28), minH: m(dense ? 84 : 92), items: [{ id: 'howto', label: X.howtoBtn }, { id: 'rules', label: X.rulesBtn }] });
  b.push({ t: 'row', size: sz(28), minH: m(dense ? 84 : 92), items: [{ id: 'about', label: X.aboutBtn }, { id: 'settings', label: X.settingsBtn }] });
  return b;
}

export function buildUi(S) {
  const scale = TEXT_SCALES[S.textIdx];
  const ui = { scale, fixed: [], blocks: [], panel: null, region: null, kind: 'doc', scrollKey: S.scene };
  if (S.overlay) return overlayUi(S, scale);
  const D = docRects(false), DN = docRects(true);
  switch (S.scene) {
    case 'title': {
      ui.kind = 'menu';
      const F = menuFrame(), dense = F.land || !isTallScreen();
      let den = 1, lay = null, zoneH = 0;
      const avail = F.bottom - F.top;
      for (const d of [1, 0.92, 0.84, 0.76, 0.68, 0.6]) {
        den = d; ui.blocks = menuBlocks(S, dense, d); lay = layoutDoc(ui.blocks, scale, F.w, { dense, minSub: minText() });
        if (F.land) { if (lay.height <= avail) break; } else { zoneH = Math.min(640, avail - lay.height - 8); if (zoneH >= 330) break; }
      }
      if (F.land) { ui.region = { x: F.x, y: F.top, w: F.w, h: avail }; ui.zone = { ...F.zone, land: true }; }
      else { zoneH = clamp(avail - lay.height - 8, 330, 640); ui.region = { x: F.x, y: F.top + zoneH, w: F.w, h: avail - zoneH }; ui.zone = { x: 0, y: F.top, w: screenW(), h: zoneH, land: false }; }
      ui.brand = F.land ? F.brand : { x: F.brand.x, y: Math.min(F.brand.y, ui.region.y + (ui.region.h + lay.height) / 2 + 14 + LOCK_H) }; ui.den = den;
      ui.fixed = [{ id: 'arcforge', rect: lockupRect(ui.brand), lockup: { x: ui.brand.x, y: ui.brand.y - LOCK_H, w: LOCK_W, h: LOCK_H } }];   // tap: the Arcforge home
      break;
    }
    case 'chapters': {
      ui.panel = D.panel; ui.region = D.body; ui.fixed = fixedBar(S, D);
      const b = [{ t: 'h', text: X.chapters, size: 38 }];
      CHAPTERS.forEach((ch, i) => {
        const st = chapterStats(S, i);
        b.push({ t: 'btn', id: `ch:${i}`, label: `${i + 1}. ${ch.name}`, kind: st.done === st.total ? 'on' : 'normal', size: 30, sub: `${st.done} of ${st.total} patterns · ${st.stars} of ${st.total * 3} stars`, minH: 108 });
      });
      ui.blocks = b;
      break;
    }
    case 'patterns': {
      ui.panel = D.panel; ui.region = D.body; ui.fixed = fixedBar(S, D);
      const ci = S.chapterIdx, ch = CHAPTERS[ci], ids = chapterIds(ci), st = chapterStats(S, ci);
      const b = [{ t: 'h', text: `${ci + 1}. ${ch.name}`, size: 36 }, { t: 'p', text: `${ch.blurb}  ${st.done} of ${st.total} patterns · ${st.stars} of ${st.total * 3} stars`, size: 22, gap: 10 }];
      b.push({ t: 'grid', cols: clamp(Math.floor(ui.region.w / (scale <= 1 ? 150 : scale <= 1.5 ? 200 : 290)), 2, 8), aspect: scale <= 1 ? 1.2 : 1.1, cells: ids.map((id, i) => ({ id: `pz:${id}`, label: String(i + 1), pid: id, stars: starsOf(S, id), open: Boolean(S.openIds[id]), locked: S.demo && (ci !== 0 || i >= DEMO_PUZZLES) })) });
      ui.blocks = b;
      break;
    }
    case 'daily': {
      ui.kind = 'card';
      const small = scale >= 2 || isWide(), zs = (n) => (scale >= 2 ? n * 0.55 : isWide() ? n * 0.82 : n);
      ui.blocks = [
        { t: 'h', text: X.dailyHead, size: zs(38) },
        { t: 'img', name: 'dailythumb', h: small ? 150 : 300 },
        { t: 'p', text: S.dailyDone ? X.dailySolved : X.dailyBody, size: zs(26), center: true },
        { t: 'p', text: `Streak: ${S.daily.streak} days`, size: Math.max(zs(24), minText() / scale), center: true },
        { t: 'btn', id: 'daily:play', label: X.dailyPlay, kind: 'primary', size: small ? 24 : 30, minH: small ? (scale >= 2 ? 62 : tapMin(80)) : 88 },
        { t: 'btn', id: 'menu', label: X.quitMenu, size: small ? 24 : 28, minH: small ? (scale >= 2 ? 60 : tapMin(80)) : 84 },
      ];
      fitCard(ui, scale);
      return ui;
    }
    case 'learn': {
      ui.panel = D.panel; ui.region = D.body; ui.fixed = fixedBar(S, D);
      const b = [{ t: 'h', text: X.lessonsTitle, size: 36 }, { t: 'p', text: `${lessonsDone(S)} / ${LESSON_COUNT}`, size: 24, gap: 10 }];
      LESSON_TEXT.forEach((l, i) => {
        const locked = S.demo && i >= 3;
        b.push({ t: 'btn', id: `les:${i}`, label: `${i + 1}. ${l.title}`, kind: S.lessons[i] ? 'on' : 'normal', size: 28, sub: locked ? X.locked : S.lessons[i] ? X.lessonDone : undefined, disabled: locked, minH: 92 });
      });
      ui.blocks = b;
      break;
    }
    case 'lesson': {
      ui.panel = DN.panel; ui.region = DN.body; ui.fixed = fixedBar(S, DN);
      const l = LESSON_TEXT[S.lessonIdx];
      ui.nav = { counter: DN.counter, label: `${S.lessonIdx + 1} / ${LESSON_COUNT}`, prev: { id: 'les:list', rect: DN.prev, label: X.lessonList, kind: 'normal', size: 24 }, next: { id: 'les:go', rect: DN.next, label: X.lessonStart, kind: 'primary', size: 24 } };
      ui.scrollKey = `lesson:${S.lessonIdx}`;
      ui.blocks = [{ t: 'h', text: l.title, size: 40 }, { t: 'img', name: 'lesson', h: Math.round(380 * (isWide() ? 0.62 : 1)), data: { i: S.lessonIdx } }, { t: 'p', text: l.intro, size: 30 }];
      break;
    }
    case 'howto':
    case 'rules': {
      const isRules = S.scene === 'rules';
      const pages = isRules ? RULES : HOWTO;
      // ONE continuous scrolling reader (drag, wheel, arrows / Page keys, scroll bar): every page follows the last under its title.
      ui.panel = D.panel; ui.region = D.body; ui.fixed = fixedBar(S, D);
      ui.scrollKey = S.scene;
      const b = [];
      pages.forEach((pg, pi) => {
        if (pi) b.push({ t: 'gap', h: 36 });
        b.push({ t: 'h', text: pg.title, size: 40 });
        if (pg.art) b.push({ t: 'img', name: pg.art, h: Math.round((isRules ? 360 : 400) * (isWide() ? 0.62 : 1)) });
        if (isRules) for (const para of pg.body) b.push({ t: 'p', text: para, size: 29 });
        else b.push({ t: 'p', text: pg.body, size: 32 });
      });
      if (!isRules) { b.push({ t: 'gap', h: 24 }); b.push({ t: 'btn', id: 'play', label: X.playBtn, kind: 'primary', size: 30 }); }
      ui.blocks = b;
      break;
    }
    case 'about': {
      ui.panel = D.panel; ui.region = D.body; ui.fixed = fixedBar(S, D);
      const b = [{ t: 'img', name: 'logo', h: Math.round(280 * (isWide() ? 0.62 : 1)) }];
      ABOUT.forEach((s, i) => { b.push({ t: 'h', text: s.title, size: i === 0 ? 38 : 30 }); for (const para of s.body) b.push({ t: 'p', text: para, size: 26 }); });
      b.push({ t: 'p', text: `v${S.version}`, size: 22 });
      ui.blocks = b;
      break;
    }
    case 'settings': {
      ui.panel = D.panel; ui.region = D.body; ui.fixed = fixedBar(S, D);
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
      const small = scale >= 2 || isWide(), zs = (n) => (scale >= 2 ? n * 0.5 : isWide() ? n * 0.82 : n);
      ui.blocks = [
        { t: 'img', name: 'lock', h: small ? 90 : 180 },
        { t: 'h', text: X.demoLimitTitle, size: zs(32) },
        { t: 'p', text: X.demoLimitBody, size: zs(26) },
        { t: 'btn', id: 'auto', label: X.autoBtn, kind: 'primary', size: small ? 24 : 28, minH: small ? (scale >= 2 ? 60 : tapMin(80)) : 84 },
        { t: 'btn', id: 'menu', label: X.quitMenu, size: small ? 24 : 28, minH: small ? (scale >= 2 ? 60 : tapMin(80)) : 84 },
      ];
      fitCard(ui, scale);
      return ui;
    }
    default: ui.kind = 'none';
  }
  ui.layout = layoutDoc(ui.blocks, scale, ui.region ? ui.region.w : 600, { dense: ui.kind === 'menu', minSub: minText() });
  ui.offY = ui.kind === 'menu' ? Math.max(0, (ui.region.h - ui.layout.height) / 2) : 0;
  return ui;
}

function overlayUi(S, scale) {
  const ui = { scale, fixed: [], blocks: [], kind: 'card', panel: null, scrollKey: `ov:${S.overlay}`, overlay: true };
  const wide = isWide();
  const b = [];
  const f = scale <= 1.5 ? 1 : scale <= 2 ? 0.72 : scale <= 2.5 ? 0.58 : 0.5;
  const hs = (n) => n * f * (wide ? 0.9 : 1), ps = (n) => n * f * 0.9, bs = (n) => n * f;
  const bmin = wide ? (scale <= 1.5 ? tapMin(80) : scale <= 2 ? 50 : 34) : (scale <= 1.5 ? 84 : scale <= 2 ? 62 : 52);
  if (S.overlay === 'pause') {
    b.push({ t: 'h', text: X.pauseTitle, size: hs(40) });
    b.push({ t: 'p', text: `${X.textSize}: ${pctLabel(S)}`, size: Math.max(ps(22), minText()), center: true, gap: 4 });
    b.push({ t: 'btn', id: 'ov:resume', label: X.resume, kind: 'primary', size: bs(30), minH: bmin });
    const listLabel = S.match && S.match.sandbox ? X.quitMenu : X.list, sandbox = S.match && S.match.sandbox;
    if (wide) {
      b.push({ t: 'row', size: bs(26), minH: bmin, items: [{ id: 'ov:restart', label: X.restart }, { id: 'set:sound', label: S.sound ? X.soundOn : X.soundOff, kind: S.sound ? 'on' : 'normal' }] });
      b.push({ t: 'row', size: bs(28), minH: bmin, items: [{ id: 'zoom-', label: 'A-', disabled: S.textIdx === 0 }, { id: 'zoom+', label: 'A+', disabled: S.textIdx === TEXT_SCALES.length - 1 }] });
      b.push({ t: 'row', size: bs(26), minH: bmin, items: sandbox ? [{ id: 'ov:list', label: listLabel }] : [{ id: 'ov:list', label: listLabel }, { id: 'ov:menu', label: X.quitMenu }] });
    } else {
      b.push({ t: 'btn', id: 'ov:restart', label: X.restart, size: bs(28), minH: bmin });
      b.push({ t: 'btn', id: 'set:sound', label: S.sound ? X.soundOn : X.soundOff, kind: S.sound ? 'on' : 'normal', size: bs(26), minH: bmin });
      b.push({ t: 'row', size: bs(28), minH: bmin, items: [{ id: 'zoom-', label: 'A-', disabled: S.textIdx === 0 }, { id: 'zoom+', label: 'A+', disabled: S.textIdx === TEXT_SCALES.length - 1 }] });
      b.push({ t: 'btn', id: 'ov:list', label: listLabel, size: bs(26), minH: bmin });
      if (!sandbox) b.push({ t: 'btn', id: 'ov:menu', label: X.quitMenu, size: bs(28), minH: bmin });
    }
  } else if (S.overlay === 'end') {
    const e = S.endInfo ?? { head: '', body: '', stars: 0 };
    b.push({ t: 'h', text: e.head, size: hs(38) });
    if (!(wide && scale >= 2.5)) b.push({ t: 'img', name: 'endstars', h: (scale >= 2 ? 80 : 130) * (wide ? 0.75 : 1), data: e });   // the stars are also spelled out in the text below
    b.push({ t: 'p', text: e.body, size: ps(26), center: true });
    if (e.lesson) {
      b.push({ t: 'btn', id: 'ov:lessonnext', label: e.last ? X.lessonList : X.lessonNext, kind: 'primary', size: bs(30), minH: bmin });
      b.push({ t: 'btn', id: 'ov:lessons', label: X.lessonList, size: bs(28), minH: bmin });
    } else {
      if (e.next) b.push({ t: 'btn', id: 'ov:nextpic', label: X.endNext, kind: 'primary', size: bs(30), minH: bmin });
      if (wide) {
        b.push({ t: 'row', size: bs(26), minH: bmin, items: [{ id: 'ov:again', label: X.endAgain, kind: e.next ? 'normal' : 'primary' }, { id: 'ov:list', label: X.list }] });
        b.push({ t: 'btn', id: 'ov:menu', label: X.endMenu, size: bs(26), minH: bmin });
      } else {
        b.push({ t: 'btn', id: 'ov:again', label: X.endAgain, kind: e.next ? 'normal' : 'primary', size: bs(28), minH: bmin });
        b.push({ t: 'btn', id: 'ov:list', label: X.list, size: bs(28), minH: bmin });
        b.push({ t: 'btn', id: 'ov:menu', label: X.endMenu, size: bs(28), minH: bmin });
      }
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
  fitCard(ui, scale, S.overlay === 'end' && !(S.endInfo && S.endInfo.lesson) ? 'end' : 'mid');
  return ui;
}

function fitCard(ui, scale, kind = 'mid') {
  const C = cardFrame(kind, scale), innerW = C.w - 48, opts = { dense: C.wide };
  const bodyBlocks = ui.blocks.filter((b) => b.t !== 'btn' && b.t !== 'row');
  const actBlocks = ui.blocks.filter((b) => b.t === 'btn' || b.t === 'row');
  const body = layoutDoc(bodyBlocks, scale, innerW, opts), act = layoutDoc(actBlocks, scale, innerW, opts);
  const extra = kind === 'end' ? 38 : 0;                              // room for the quiet Arcforge line under the buttons
  const h = Math.min(C.maxH, Math.max(C.wide ? 300 : 420, body.height + act.height + 72 + extra));
  const y = kind === 'end' && !C.wide ? Math.round(C.bottomY - h) : Math.round(C.cy - h / 2);
  const x0 = C.x + 24, actTop = y + h - 28 - extra - act.height;
  ui.panel = { x: C.x, y, w: C.w, h };
  ui.region = { x: x0, y: y + 28, w: innerW, h: Math.max(100, h - 56 - extra - act.height - 8) };
  ui.layout = body;
  ui.fixed = act.items.flatMap((it) => it.btns.map((bt) => ({ id: bt.id, rect: { x: x0 + bt.x, y: actTop + bt.y, w: bt.w, h: bt.h }, kind: bt.kind ?? it.b.kind ?? 'normal', lines: bt.lines ?? it.lines, size: it.size, line: it.line, disabled: bt.disabled, static: bt.id == null, label: bt.label })));
}
export { puzzleById };
