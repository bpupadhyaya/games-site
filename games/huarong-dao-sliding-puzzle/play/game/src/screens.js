// Builds the block lists for every text screen. Both game.js (hit-testing) and view.js (drawing) call
// buildUi() with the same state, so layout and taps always agree at every text-zoom step.
import { LEVELS } from './levels.js';
import { TEXT_SCALES, layoutDoc } from './ui.js';
import { CHAPTERS, HOWTO, RULES, ABOUT, tr } from './content.js';
import {
  DOC_BACK, ZOOM_DEC, ZOOM_INC, DOC_PANEL, DOC_BODY, DOC_BODY_NAV, NAV_PREV, NAV_NEXT, LANG_EN, LANG_ZH, MENU_REGION, OVERLAY,
} from './layout.js';

export const DEMO_LEVELS = 6;
export const UNLOCK_NEED = 6;
export const THINK_STEPS = [2, 5, 8, 10];

export const chapterLevels = (ch) => LEVELS.map((l, i) => ({ l, i })).filter((x) => x.l.ch === ch);
export const starsOf = (S, l) => S.progress.stars[l.id] ?? 0;
export const solvedIn = (S, ch) => chapterLevels(ch).filter((x) => starsOf(S, x.l) > 0).length;
export const chapterUnlocked = (S, ch) => ch === 0 || S.dev || solvedIn(S, ch - 1) >= UNLOCK_NEED;
export const totalSolved = (S) => LEVELS.filter((l) => starsOf(S, l) > 0).length;
export const totalStars = (S) => LEVELS.reduce((s, l) => s + starsOf(S, l), 0);
export const levelName = (S, l) => l.n[S.lang === 'zh' ? 1 : 0];
export const demoLocked = (S, idx) => S.demo && idx >= DEMO_LEVELS;
export const levelLocked = (S, idx) => demoLocked(S, idx) || !chapterUnlocked(S, LEVELS[idx].ch);

export function firstOpenLevel(S) {
  for (let i = 0; i < LEVELS.length; i++) {
    if (!levelLocked(S, i) && !(starsOf(S, LEVELS[i]) > 0)) return i;
  }
  return Math.min(S.levelIdx ?? 0, LEVELS.length - 1);
}

const pctLabel = (S) => `${Math.round(TEXT_SCALES[S.textIdx] * 100)}%`;

function fixedBar(S, T, backLabel = 'back') {
  const scale = TEXT_SCALES[S.textIdx];
  return [
    { id: 'back', rect: DOC_BACK, kind: 'normal', icon: 'back', label: T(backLabel), size: 26 },
    { id: 'zoom-', rect: ZOOM_DEC, kind: 'normal', label: 'A-', size: 30, disabled: S.textIdx === 0 },
    { id: 'zoom+', rect: ZOOM_INC, kind: 'normal', label: 'A+', size: 30, disabled: S.textIdx === TEXT_SCALES.length - 1 },
    { id: null, rect: { x: 480, y: 20, w: 140, h: 76 }, label: pctLabel(S), size: 28, static: true, scale },
  ];
}

export const HOWTO_ART = ['goal', 'drag', 'tap', 'think', 'stars', 'auto'];

export function buildUi(S) {
  const T = (k, v) => tr(S.lang, k, v);
  const scale = TEXT_SCALES[S.textIdx];
  const ui = { scale, fixed: [], blocks: [], panel: null, region: null, kind: 'doc', scrollKey: S.scene };

  if (S.overlay) return overlayUi(S, T, scale);

  switch (S.scene) {
    case 'title': {
      ui.kind = 'menu';
      ui.region = MENU_REGION;
      ui.panel = null;
      const b = [];
      const solved = totalSolved(S);
      const playSub = S.demo ? T('demoLeft', { n: Math.max(0, DEMO_LEVELS - solved) }) : (solved ? `${solved} / ${LEVELS.length} · ${totalStars(S)} ★` : undefined);
      b.push({ t: 'btn', id: 'play', label: T('playBtn'), kind: 'primary', size: 36, sub: playSub, minH: 118 });
      b.push({ t: 'btn', id: 'auto', label: T('autoBtn'), size: 30, minH: 96 });
      b.push({ t: 'row', size: 28, minH: 96, items: [{ id: 'howto', label: T('howtoBtn') }, { id: 'rules', label: T('rulesBtn') }] });
      b.push({ t: 'row', size: 28, minH: 96, items: [{ id: 'about', label: T('aboutBtn') }, { id: 'settings', label: T('settingsBtn') }] });
      ui.blocks = b;
      ui.fixed = [
        { id: 'lang:en', rect: LANG_EN, kind: S.lang === 'en' ? 'on' : 'normal', label: 'English', size: 25 },
        { id: 'lang:zh', rect: LANG_ZH, kind: S.lang === 'zh' ? 'on' : 'normal', label: '中文', size: 27 },
      ];
      break;
    }
    case 'levels': {
      ui.panel = DOC_PANEL; ui.region = DOC_BODY;
      ui.fixed = fixedBar(S, T);
      const cols = scale <= 1 ? 4 : scale <= 2 ? 3 : 2;
      const b = [];
      b.push({ t: 'p', text: `${T('solvedCount')}: ${totalSolved(S)} / ${LEVELS.length}    ${T('stars')}: ${totalStars(S)} / ${LEVELS.length * 3}`, size: 24, gap: 12 });
      CHAPTERS.forEach((c, ci) => {
        const items = chapterLevels(ci);
        if (!items.length) return;
        const open = chapterUnlocked(S, ci);
        b.push({ t: 'h', text: `${ci + 1}. ${c[S.lang]}`, size: 30 });
        b.push({ t: 'p', text: open ? `${c.blurb[S.lang]}  (${solvedIn(S, ci)}/${items.length})` : T('locked'), size: 22, gap: 10 });
        b.push({
          t: 'grid', cols, aspect: 1.1,
          cells: items.map(({ l, i }) => ({
            id: `lvl:${i}`, label: String(i + 1), name: levelName(S, l), idx: i,
            state: starsOf(S, l) > 0 ? 'solved' : levelLocked(S, i) ? 'locked' : 'open',
            stars: starsOf(S, l), lvl: l, best: S.progress.best[l.id] ?? 0,
          })),
        });
        b.push({ t: 'gap', h: 14 });
      });
      ui.blocks = b;
      break;
    }
    case 'howto':
    case 'rules': {
      const isRules = S.scene === 'rules';
      const pages = isRules ? RULES[S.lang] : HOWTO[S.lang];
      const pi = Math.min(S.page[S.scene], pages.length - 1);
      const pg = pages[pi];
      ui.panel = DOC_PANEL; ui.region = DOC_BODY_NAV;
      ui.fixed = fixedBar(S, T);
      ui.nav = { label: `${pi + 1} / ${pages.length}`, prev: { id: 'prev', rect: NAV_PREV, label: T('prev'), disabled: pi === 0, kind: 'normal', size: 26 }, next: { id: 'next', rect: NAV_NEXT, label: isRules || pi < pages.length - 1 ? T('next') : T('playBtn'), disabled: isRules && pi === pages.length - 1, kind: 'primary', size: 26 } };
      ui.scrollKey = `${S.scene}:${pi}:${S.lang}`;
      const b = [];
      b.push({ t: 'h', text: pg.title, size: 40 });
      const art = isRules ? pg.art : HOWTO_ART[pi];
      if (art) b.push({ t: 'img', name: art, h: isRules ? 300 : 340 });
      if (isRules) for (const para of pg.body) b.push({ t: 'p', text: para, size: 29 });
      else b.push({ t: 'p', text: pg.body, size: 32 });
      ui.blocks = b;
      break;
    }
    case 'about': {
      ui.panel = DOC_PANEL; ui.region = DOC_BODY;
      ui.fixed = fixedBar(S, T);
      const b = [{ t: 'img', name: 'logo', h: 250 }];
      ABOUT[S.lang].forEach((s, i) => { b.push({ t: 'h', text: s.title, size: i === 0 ? 38 : 30 }); b.push({ t: 'p', text: s.body, size: 26 }); });
      b.push({ t: 'p', text: `v${S.version}`, size: 22 });
      ui.blocks = b;
      break;
    }
    case 'settings': {
      ui.panel = DOC_PANEL; ui.region = DOC_BODY;
      ui.fixed = fixedBar(S, T);
      const b = [];
      b.push({ t: 'h', text: T('settingsBtn'), size: 36 });
      b.push({ t: 'p', text: T('language'), size: 24, gap: 6 });
      b.push({ t: 'row', size: 28, items: [{ id: 'lang:en', label: 'English', kind: S.lang === 'en' ? 'on' : 'normal' }, { id: 'lang:zh', label: '中文', kind: S.lang === 'zh' ? 'on' : 'normal' }] });
      b.push({ t: 'btn', id: 'set:sound', label: S.sound ? T('soundOn') : T('soundOff'), kind: S.sound ? 'on' : 'normal', size: 28 });
      b.push({ t: 'p', text: `${T('thinkTime')}: ${THINK_STEPS[S.thinkIdx]}${T('seconds')}`, size: 24, gap: 6 });
      b.push({ t: 'row', size: 30, items: [{ id: 'set:think-', label: '-', disabled: S.thinkIdx === 0 }, { id: 'set:think+', label: '+', disabled: S.thinkIdx === THINK_STEPS.length - 1 }] });
      if (!S.demo) {
        if (S.owns) b.push({ t: 'p', text: T('owned'), size: 24 });
        else b.push({ t: 'btn', id: 'set:unlock', label: S.price ? `${T('unlock')} · ${S.price}` : T('unlock'), kind: 'primary', size: 28 });
        b.push({ t: 'btn', id: 'set:restore', label: T('restore'), size: 26 });
      }
      b.push({ t: 'btn', id: 'set:reset', label: S.resetArm ? T('resetConfirm') : T('resetProgress'), kind: 'danger', size: 26 });
      ui.blocks = b;
      break;
    }
    case 'demo-limit': {
      ui.kind = 'card';
      ui.blocks = [
        { t: 'img', name: 'lock', h: 180 },
        { t: 'h', text: T('demoLimitTitle'), size: 32 },
        { t: 'p', text: T('demoLimitBody'), size: 26 },
        { t: 'btn', id: 'auto', label: T('autoBtn'), kind: 'primary', size: 28 },
        { t: 'btn', id: 'menu', label: T('quitMenu'), size: 28 },
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

function overlayUi(S, T, scale) {
  const ui = { scale, fixed: [], blocks: [], kind: 'card', panel: OVERLAY, scrollKey: `ov:${S.overlay}`, overlay: true };
  ui.region = { x: OVERLAY.x + 24, y: OVERLAY.y + 24, w: OVERLAY.w - 48, h: OVERLAY.h - 48 };
  const b = [];
  const hs = (n) => (scale >= 2 ? n * 0.72 : n); // card headings stay readable without eating the whole card at 200%+
  if (S.overlay === 'pause') {
    b.push({ t: 'h', text: T('paused'), size: hs(40) });
    b.push({ t: 'btn', id: 'ov:resume', label: T('resume'), kind: 'primary', size: 30 });
    b.push({ t: 'btn', id: 'ov:restart', label: T('restartLevel'), size: 28 });
    b.push({ t: 'btn', id: 'set:sound', label: S.sound ? T('soundOn') : T('soundOff'), kind: S.sound ? 'on' : 'normal', size: 26 });
    b.push({ t: 'btn', id: 'ov:levels', label: T('levels'), size: 28 });
    if (S.dev) b.push({ t: 'btn', id: 'ov:devsolve', label: 'Dev: solve now', size: 24 });
  } else if (S.overlay === 'win') {
    const info = S.winInfo ?? { stars: 1, moves: 0, min: 0, best: false };
    b.push({ t: 'h', text: T('solved'), size: hs(40) });
    b.push({ t: 'img', name: 'winstars', h: 150, data: info.stars });
    b.push({ t: 'p', text: S.puz ? levelName(S, S.puz.level) : '', size: 28, center: true });
    b.push({ t: 'p', text: T('solvedIn', { n: info.moves }) + `  ·  ${T('minimum')}: ${info.min}`, size: 24, center: true });
    b.push({ t: 'p', text: info.moves <= info.min ? T('perfect') : info.stars >= 3 ? T('stars3') : info.stars === 2 ? T('stars2') : T('stars1'), size: 24 });
    if (info.best) b.push({ t: 'p', text: T('newBest'), size: 24, center: true });
    if (info.newChapter != null) b.push({ t: 'p', text: `${T('chapter')}: ${CHAPTERS[info.newChapter][S.lang]}`, size: 24 });
    const nxt = S.levelIdx + 1;
    if (nxt < LEVELS.length) b.push({ t: 'btn', id: 'ov:next', label: T('nextLevel'), kind: 'primary', size: 30 });
    b.push({ t: 'btn', id: 'ov:replay', label: T('replay'), size: 28 });
    b.push({ t: 'btn', id: 'ov:levels', label: T('levels'), size: 28 });
  } else if (S.overlay === 'autosum') {
    b.push({ t: 'h', text: T('autoSession'), size: hs(38) });
    b.push({ t: 'p', text: T('autoSummary'), size: 26 });
    b.push({ t: 'btn', id: 'ov:autoagain', label: T('autoAgain'), kind: 'primary', size: 28 });
    b.push({ t: 'btn', id: 'ov:autoexit', label: T('autoExit'), size: 28 });
  }
  ui.blocks = b;
  fitCard(ui, scale);
  return ui;
}

// Size a centred card to its content (never taller than the screen allows). The buttons are pinned to the
// bottom of the card and never scroll away; everything above them scrolls when the text is large.
function fitCard(ui, scale) {
  const innerW = OVERLAY.w - 48;
  const bodyBlocks = ui.blocks.filter((b) => b.t !== 'btn');
  const actBlocks = ui.blocks.filter((b) => b.t === 'btn');
  const body = layoutDoc(bodyBlocks, scale, innerW);
  const act = layoutDoc(actBlocks, scale, innerW);
  const h = Math.min(OVERLAY.h + 120, Math.max(420, body.height + act.height + 72));
  const y = Math.round(780 - h / 2);
  const x0 = OVERLAY.x + 24;
  const actTop = y + h - 28 - act.height;
  ui.panel = { x: OVERLAY.x, y, w: OVERLAY.w, h };
  ui.region = { x: x0, y: y + 28, w: innerW, h: Math.max(160, h - 56 - act.height - 8) };
  ui.layout = body;
  ui.fixed = act.items.flatMap((it) => it.btns.map((bt) => ({
    id: bt.id, rect: { x: x0 + bt.x, y: actTop + bt.y, w: bt.w, h: bt.h }, kind: it.b.kind ?? 'normal', lines: it.lines, size: it.size, line: it.line, disabled: bt.disabled,
  })));
}
