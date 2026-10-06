// Builds the block lists for every text screen. Both game.js (hit-testing) and view.js (drawing) call buildUi()
// with the same state, so layout and taps always agree at every text-zoom step.
import { TEXT_SCALES, layoutDoc } from './ui.js';
import { getHowto, getRules, getAbout, tr, lvName, lvBlurb, themeName } from './content.js';
import { getLang, LANGS } from './lang.js';
import { LEVELS } from './ai.js';
import { LESSONS, lessonTitle } from './lessons.js';
import { THEMES } from './art.js';
import { lay } from './layout.js';

export const DEMO_GAMES = 3;
export const THINK_STEPS = [2, 5, 8, 10];

export const demoLevelLocked = (S, level) => S.demo && (level === 'expert' || level === 'master');
export const demoOver = (S) => S.demo && S.demoGames >= DEMO_GAMES;
export const recKey = (level, side) => `${level}:${side}`;
export const recOf = (S, level) => { const a = S.stats[recKey(level, 1)] ?? [0, 0, 0], b = S.stats[recKey(level, 2)] ?? [0, 0, 0]; return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; };
export const lessonsDone = (S) => LESSONS.filter((l) => S.lessons[l.id]).length;
export const firstOpenLesson = (S) => { const i = LESSONS.findIndex((l) => !S.lessons[l.id]); return i < 0 ? 0 : i; };

const pctLabel = (S) => `${Math.round(TEXT_SCALES[S.textIdx] * 100)}%`;

function fixedBar(S) {
  const B = lay().bar;
  return [
    { id: 'back', rect: B.back, kind: 'normal', icon: 'back', label: tr('back'), size: 26 },
    { id: 'zoom-', rect: B.zoomDec, kind: 'normal', label: 'A-', size: 30, disabled: S.textIdx === 0 },
    { id: 'zoom+', rect: B.zoomInc, kind: 'normal', label: 'A+', size: 30, disabled: S.textIdx === TEXT_SCALES.length - 1 },
    { id: null, rect: B.label, label: pctLabel(S), size: 28, static: true },
  ];
}

export function levelLabel(S) {
  if (S.setup.level === 'two') return tr('twoPlayers');
  return lvName(S.setup.level);
}

// The two language buttons: each is written in its own language, always visible, never blended.
export const LANG_LABELS = ['Play in English', 'Jugar en español', 'العب بالعربية'];
// On the title the three buttons are short (each in its own language); Settings keeps the long ones.
export const LANG_SHORT = ['English', 'Español', 'العربية'];
export const langButtons = () => LANGS.map((l, i) => ({ id: `lang:${l}`, rect: lay().title.lang[i], kind: getLang() === l ? 'on' : 'normal', label: LANG_SHORT[i], size: 24 }));

// The scroll position of a text screen, always inside its current content (the screen may have been resized or rotated).
export const scrollOf = (S, ui) => (ui.layout && ui.region ? Math.min(Math.max(0, S.scroll[ui.scrollKey] ?? 0), Math.max(0, ui.layout.height - ui.region.h)) : 0);

export function buildUi(S) {
  const scale = TEXT_SCALES[S.textIdx];
  const L = lay();
  const ui = { scale, fixed: [], blocks: [], panel: null, region: null, kind: 'doc', scrollKey: S.scene };
  if (S.overlay) return overlayUi(S, scale);
  // illustrations are shortened where the screen is short (landscape), never taller than about half the text area
  const capH = (n) => (L.wide && ui.region ? Math.min(n, Math.max(150, Math.floor(ui.region.h * 0.55))) : n);

  switch (S.scene) {
    case 'title': {
      ui.kind = 'menu';
      ui.region = L.title.menu;
      const dn = L.title.dens, mh = (n) => Math.round(n * dn);
      const b = [];
      if (S.save) b.push({ t: 'btn', id: 'continue', label: tr('continueBtn'), kind: 'primary', size: 32, sub: S.save.two ? tr('twoPlayers') : `${tr('vsComputer')} · ${lvName(S.save.level)}`, minH: mh(104) });
      const playSub = S.demo ? tr('demoLeft', { n: Math.max(0, DEMO_GAMES - S.demoGames) }) : undefined;
      b.push({ t: 'btn', id: 'play', label: tr('playBtn'), kind: S.save ? 'normal' : 'primary', size: 36, sub: playSub, minH: mh(S.save ? 92 : 118) });
      b.push({ t: 'btn', id: 'learn', label: tr('learnBtn'), size: 30, sub: `${lessonsDone(S)} / ${LESSONS.length}`, minH: mh(96) });
      b.push({ t: 'btn', id: 'auto', label: tr('autoBtn'), size: 30, minH: mh(92) });
      b.push({ t: 'row', size: 28, minH: mh(92), items: [{ id: 'howto', label: tr('howtoBtn') }, { id: 'rules', label: tr('rulesBtn') }] });
      b.push({ t: 'row', size: 28, minH: mh(92), items: [{ id: 'about', label: tr('aboutBtn') }, { id: 'settings', label: tr('settingsBtn') }] });
      ui.blocks = b;
      ui.fixed = langButtons();
      break;
    }
    case 'setup': {
      ui.panel = L.start.panel; ui.region = L.start.body;
      ui.fixed = [...fixedBar(S), { id: 'start', rect: L.start.btn, kind: 'primary', label: tr('startGame'), size: L.start.btn.h < 90 ? 28 : 34 }];
      const b = [];
      const lv = S.setup.level;
      if (scale <= 1.5 && !L.wide) b.push({ t: 'img', name: 'setupart', h: 300 });
      b.push({ t: 'h', text: tr('opponentTitle'), size: 32 });
      const rows = [[LEVELS[0], LEVELS[1]], [LEVELS[2], LEVELS[3]], [LEVELS[4], { id: 'two', name: tr('twoPlayers') }]];
      for (const r of rows) {
        b.push({ t: 'row', size: 28, minH: 84, items: r.map((l) => ({ id: `lv:${l.id}`, label: l.id === 'two' ? l.name : lvName(l.id), kind: lv === l.id ? 'on' : 'normal', disabled: demoLevelLocked(S, l.id) })) });
      }
      const lvInfo = lv === 'two' ? tr('twoInfo') : lvBlurb(lv);
      b.push({ t: 'p', text: lvInfo, size: 24, gap: 10 });
      if (lv !== 'two') {
        b.push({ t: 'h', text: tr('sideTitle'), size: 32 });
        b.push({ t: 'btn', id: 'side:1', label: tr('playL'), kind: S.setup.side === 1 ? 'on' : 'normal', size: 26, minH: 84 });
        b.push({ t: 'btn', id: 'side:2', label: tr('playD'), kind: S.setup.side === 2 ? 'on' : 'normal', size: 26, minH: 84 });
        b.push({ t: 'p', text: S.setup.side === 1 ? tr('sideInfo1') : tr('sideInfo2'), size: 22, gap: 10 });
        const rec = recOf(S, lv);
        b.push({ t: 'p', text: tr('recordLine', { label: tr('record'), level: lvName(lv), w: rec[0], d: rec[1], l: rec[2] }), size: 22, gap: 12 });
      }
      ui.blocks = b;
      break;
    }
    case 'learn': {
      ui.panel = L.doc.panel; ui.region = L.doc.body;
      ui.fixed = fixedBar(S);
      const b = [{ t: 'h', text: tr('lessonsTitle'), size: 36 }, { t: 'p', text: `${lessonsDone(S)} / ${LESSONS.length}`, size: 24, gap: 10 }];
      LESSONS.forEach((l, i) => {
        const locked = S.demo && i >= 3;
        b.push({ t: 'btn', id: `les:${i}`, label: `${i + 1}. ${lessonTitle(l)}`, kind: S.lessons[l.id] ? 'on' : 'normal', size: 28, sub: locked ? tr('locked') : S.lessons[l.id] ? tr('lessonDone') : l.type === 'game' ? tr('lessonGame') : tr('lessonMove'), disabled: locked, minH: 92 });
      });
      ui.blocks = b;
      break;
    }
    case 'howto':
    case 'rules': {
      const isRules = S.scene === 'rules';
      // One continuous scrolling reader: every page of the old paginated reader is a section here, in the same order,
      // each with its own heading and illustration (drag, wheel, keys; 100-300 percent text).
      const pages = isRules ? getRules() : getHowto();
      ui.panel = L.doc.panel; ui.region = L.doc.body;
      ui.fixed = fixedBar(S);
      ui.scrollKey = S.scene;
      const b = [];
      pages.forEach((pg, i) => {
        b.push({ t: 'h', text: pg.title, size: i === 0 ? 40 : 34 });
        if (pg.art) b.push({ t: 'img', name: pg.art, h: capH(isRules ? 380 : 400) });
        if (isRules) for (const para of pg.body) b.push({ t: 'p', text: para, size: 29 });
        else b.push({ t: 'p', text: pg.body, size: 32 });
      });
      if (!isRules) b.push({ t: 'btn', id: 'play', label: tr('playBtn'), kind: 'primary', size: 28, minH: 90 });
      ui.blocks = b;
      break;
    }
    case 'about': {
      ui.panel = L.doc.panel; ui.region = L.doc.body;
      ui.fixed = fixedBar(S);
      const b = [{ t: 'img', name: 'logo', h: capH(280) }];
      getAbout().forEach((s, i) => { b.push({ t: 'h', text: s.title, size: i === 0 ? 38 : 30 }); b.push({ t: 'p', text: s.body, size: 26 }); });
      b.push({ t: 'p', text: `v${S.version}`, size: 22 });
      ui.blocks = b;
      break;
    }
    case 'settings': {
      ui.panel = L.doc.panel; ui.region = L.doc.body;
      ui.fixed = fixedBar(S);
      const b = [];
      b.push({ t: 'h', text: tr('settingsBtn'), size: 36 });
      b.push({ t: 'p', text: tr('theme'), size: 24, gap: 6 });
      for (const th of THEMES) b.push({ t: 'btn', id: `theme:${th.id}`, label: themeName(th.id), kind: S.themeId === th.id ? 'on' : 'normal', size: 28 });
      b.push({ t: 'p', text: tr('language'), size: 24, gap: 6 });
      for (let i = 0; i < LANGS.length; i++) b.push({ t: 'btn', id: `lang:${LANGS[i]}`, label: LANG_LABELS[i], kind: getLang() === LANGS[i] ? 'on' : 'normal', size: 26 });
      b.push({ t: 'btn', id: 'set:sound', label: S.sound ? tr('soundOn') : tr('soundOff'), kind: S.sound ? 'on' : 'normal', size: 28 });
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
        { t: 'img', name: 'lock', h: scale >= 2 || L.wide ? 90 : 180 },
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
  ui.offY = ui.kind === 'menu' ? Math.max(0, (ui.region.h - ui.layout.height) / 2) : 0;
  return ui;
}

function overlayUi(S, scale) {
  const ui = { scale, fixed: [], blocks: [], kind: 'card', panel: null, scrollKey: `ov:${S.overlay}`, overlay: true };
  const b = [];
  const hs = (n) => (scale >= 2 ? n * 0.66 : n);
  const ps = (n) => (scale >= 2 ? n * 0.5 : n);
  const bs = (n) => (scale >= 2 ? n * 0.7 : n);
  const bmin = scale >= 2 ? 56 : 84;
  if (S.overlay === 'pause') {
    b.push({ t: 'h', text: tr('paused'), size: hs(40) });
    b.push({ t: 'p', text: getLang() === 'ar' ? `${tr('textSize')}: ${Math.round(TEXT_SCALES[S.textIdx] * 100)} بالمئة` : `${tr('textSize')}: ${pctLabel(S)}`, size: ps(22), center: true, gap: 4 });
    b.push({ t: 'btn', id: 'ov:resume', label: tr('resume'), kind: 'primary', size: bs(30), minH: bmin });
    b.push({ t: 'btn', id: 'ov:restart', label: tr('restart'), size: bs(28), minH: bmin });
    b.push({ t: 'btn', id: 'set:sound', label: S.sound ? tr('soundOn') : tr('soundOff'), kind: S.sound ? 'on' : 'normal', size: bs(26), minH: bmin });
    b.push({ t: 'row', size: bs(28), minH: bmin, items: [{ id: 'zoom-', label: 'A-', disabled: S.textIdx === 0 }, { id: 'zoom+', label: 'A+', disabled: S.textIdx === TEXT_SCALES.length - 1 }] });
    b.push({ t: 'btn', id: 'ov:menu', label: tr('quitMenu'), size: bs(28), minH: bmin });
  } else if (S.overlay === 'end') {
    const e = S.endInfo ?? { head: '', body: '', rec: '' };
    b.push({ t: 'h', text: e.head, size: hs(40) });
    b.push({ t: 'img', name: 'endmark', h: scale >= 2 || lay().wide ? 100 : 150, data: e });
    b.push({ t: 'p', text: e.body, size: ps(26), center: true });
    if (e.rec) b.push({ t: 'p', text: e.rec, size: ps(22), center: true });
    if (!(S.match && S.match.lesson)) b.push({ t: 'img', name: 'more', h: scale >= 2 ? 36 : 44 });
    if (S.match && S.match.lesson) {
      if (e.lessonOk) b.push({ t: 'btn', id: 'ov:lessonnext', label: tr('lessonNext'), kind: 'primary', size: bs(30), minH: bmin });
      else b.push({ t: 'btn', id: 'ov:lessonagain', label: tr('lessonRetry'), kind: 'primary', size: bs(30), minH: bmin });
      b.push({ t: 'btn', id: 'ov:lessons', label: tr('lessonList'), size: bs(28), minH: bmin });
    } else {
      b.push({ t: 'btn', id: 'ov:again', label: tr('again'), kind: 'primary', size: bs(30), minH: bmin });
      if (lay().wide) b.push({ t: 'row', size: bs(26), minH: bmin, items: [{ id: 'ov:setup', label: tr('newSetup') }, { id: 'ov:menu', label: tr('quitMenu') }] });
      else {
        b.push({ t: 'btn', id: 'ov:setup', label: tr('newSetup'), size: bs(28), minH: bmin });
        b.push({ t: 'btn', id: 'ov:menu', label: tr('quitMenu'), size: bs(28), minH: bmin });
      }
    }
  } else if (S.overlay === 'lesson') {
    const e = S.lessonInfo ?? { ok: false, head: '', body: '' };
    b.push({ t: 'h', text: e.head, size: hs(38) });
    b.push({ t: 'p', text: e.body, size: ps(25) });
    if (e.ok) {
      b.push({ t: 'btn', id: 'ov:lessonnext', label: S.lessonIdx + 1 < LESSONS.length ? tr('lessonNext') : tr('lessonList'), kind: 'primary', size: bs(30), minH: bmin });
      b.push({ t: 'btn', id: 'ov:lessons', label: tr('lessonList'), size: bs(28), minH: bmin });
    } else {
      b.push({ t: 'btn', id: 'ov:lessonretry', label: tr('lessonRetry'), kind: 'primary', size: bs(30), minH: bmin });
      b.push({ t: 'btn', id: 'ov:lessons', label: tr('lessonList'), size: bs(28), minH: bmin });
    }
  } else if (S.overlay === 'autosum') {
    b.push({ t: 'h', text: tr('autoSession'), size: hs(38) });
    b.push({ t: 'p', text: tr('autoSummary'), size: ps(26) });
    b.push({ t: 'btn', id: 'ov:autoagain', label: tr('autoAgain'), kind: 'primary', size: bs(28), minH: bmin });
    b.push({ t: 'btn', id: 'ov:autoexit', label: tr('autoExit'), size: bs(28), minH: bmin });
  }
  ui.blocks = b;
  fitCard(ui, scale);
  return ui;
}

function fitCard(ui, scale) {
  const C = lay().card;
  const innerW = C.w - 48;
  const bodyBlocks = ui.blocks.filter((b) => b.t !== 'btn' && b.t !== 'row');
  let actBlocks = ui.blocks.filter((b) => b.t === 'btn' || b.t === 'row');
  let body = layoutDoc(bodyBlocks, scale, innerW);
  let act = layoutDoc(actBlocks, scale, innerW);
  // a short screen (landscape) with big text: shrink the buttons (never below the 100 percent size) until the card fits
  for (let sc = scale - 0.25; sc >= 1 && act.height + 120 + 72 > C.maxH; sc -= 0.25) act = layoutDoc(actBlocks, sc, innerW);
  if (act.height + 120 + 72 > C.maxH) {
    actBlocks = actBlocks.map((b) => ({ ...b, minH: Math.round((b.minH ?? 84) * 0.7) }));
    act = layoutDoc(actBlocks, 1, innerW);
  }
  // the same for the text above the buttons: it shrinks toward the 100 percent size before it would have to scroll
  for (let sc = scale - 0.25; sc >= 1 && body.height + act.height + 72 > C.maxH; sc -= 0.25) body = layoutDoc(bodyBlocks, sc, innerW);
  const h = Math.min(C.maxH, Math.max(Math.min(420, C.maxH), body.height + act.height + 72));
  const y = Math.round(C.cy - h / 2);
  const px = Math.round(C.cx - C.w / 2), x0 = px + 24;
  const actTop = y + h - 28 - act.height;
  ui.panel = { x: px, y, w: C.w, h };
  ui.region = { x: x0, y: y + 28, w: innerW, h: Math.max(100, h - 56 - act.height - 8) };
  ui.layout = body;
  ui.fixed = act.items.flatMap((it) => it.btns.map((bt) => ({
    id: bt.id, rect: { x: x0 + bt.x, y: actTop + bt.y, w: bt.w, h: bt.h }, kind: bt.kind ?? it.b.kind ?? 'normal', lines: bt.lines ?? it.lines, size: it.size, line: it.line, disabled: bt.disabled, static: bt.id == null, label: bt.label,
  })));
}
