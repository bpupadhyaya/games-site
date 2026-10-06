// Builds the block lists for every text screen. Both game.js (hit-testing) and view.js (drawing) call
// buildUi() with the same state, so layout and taps always agree at every text-zoom step.
import { LEVELS } from './levels.js';
import { TEXT_SCALES, layoutDoc } from './ui.js';
import { CHAPTERS, HOWTO, RULES, ABOUT, tr } from './content.js';
import {
  DOC_BACK, ZOOM_DEC, ZOOM_INC, ZOOM_PCT, DOC_PANEL, DOC_BODY, DOC_BODY_NAV, NAV_PREV, NAV_NEXT, LANG_EN, LANG_ZH, MENU_REGION, LAY,
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
    { id: null, rect: ZOOM_PCT, label: pctLabel(S), size: 28, static: true, scale },
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
      const cp = LAY.title.compact, tn = cp === 2, tp = LAY.tap;   // every title button is at least ~44 css px tall (tp, in units)
      b.push({ t: 'btn', id: 'play', label: T('playBtn'), kind: 'primary', size: cp ? 32 : 36, sub: playSub, minH: Math.max(tp, tn ? 84 : cp ? 96 : 118) });
      b.push({ t: 'btn', id: 'auto', label: T('autoBtn'), size: cp ? 28 : 30, minH: Math.max(tp, tn ? 64 : cp ? 76 : 96) });
      b.push({ t: 'row', size: cp ? 26 : 28, minH: Math.max(tp, tn ? 64 : cp ? 76 : 96), items: [{ id: 'howto', label: T('howtoBtn') }, { id: 'rules', label: T('rulesBtn') }] });
      b.push({ t: 'row', size: cp ? 26 : 28, minH: Math.max(tp, tn ? 64 : cp ? 76 : 96), items: [{ id: 'about', label: T('aboutBtn') }, { id: 'settings', label: T('settingsBtn') }] });
      b.push({ t: 'img', name: 'lockup', id: 'arcforge', h: 78, hitW: 250 });
      ui.blocks = b;
      ui.fixed = [
        { id: 'lang:en', rect: LANG_EN, kind: S.lang === 'en' ? 'on' : 'normal', label: 'Play in English', size: 25 },
        { id: 'lang:zh', rect: LANG_ZH, kind: S.lang === 'zh' ? 'on' : 'normal', label: '中文 游戏', size: 27 },
      ];
      break;
    }
    case 'levels': {
      ui.panel = DOC_PANEL; ui.region = DOC_BODY;
      ui.fixed = fixedBar(S, T);
      const tgt = scale <= 1 ? 140 : scale <= 2 ? 190 : 300;
      const cols = Math.max(1, Math.floor((DOC_BODY.w + 14) / (tgt + 14)));
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
    case 'rules': {
      // Rules: one continuous scrolling reader (drag, wheel, keys, scroll bar) instead of many short pages.
      const pages = RULES[S.lang];
      ui.panel = LAY.doc.panelFull; ui.region = LAY.doc.bodyFull;
      ui.fixed = fixedBar(S, T);
      ui.scrollKey = `rules:${S.lang}`;
      const b = [];
      pages.forEach((pg, pi) => {
        if (pi) b.push({ t: 'gap', h: 30 });
        b.push({ t: 'h', text: pg.title, size: 40 });
        if (pg.art) b.push({ t: 'img', name: pg.art, h: 300 });
        for (const para of pg.body) b.push({ t: 'p', text: para, size: 29 });
      });
      ui.blocks = b;
      break;
    }
    case 'howto': {
      // How to Play: one continuous scrolling reader (drag, wheel, keys, scroll bar). Prev/Next move a screenful; Next reads Done at the end.
      const pages = HOWTO[S.lang];
      ui.panel = DOC_PANEL; ui.region = DOC_BODY_NAV;
      ui.fixed = fixedBar(S, T);
      ui.scrollKey = `howto:${S.lang}`;
      const b = [];
      pages.forEach((pg, pi) => {
        if (pi) b.push({ t: 'gap', h: 30 });
        b.push({ t: 'h', text: pg.title, size: 40 });
        const art = HOWTO_ART[pi];
        if (art) b.push({ t: 'img', name: art, h: 340 });
        b.push({ t: 'p', text: pg.body, size: 32 });
      });
      ui.blocks = b;
      const lay = layoutDoc(b, scale, ui.region.w), max = Math.max(0, lay.height - ui.region.h), sc = Math.min(S.scroll[ui.scrollKey] ?? 0, max);
      ui.nav = { label: max > 0 ? `${Math.round(100 * sc / max)}%` : '', inBar: LAY.doc.inBar, prev: { id: 'prev', rect: NAV_PREV, label: T('prev'), disabled: sc <= 0, kind: 'normal', size: 26 }, next: { id: 'next', rect: NAV_NEXT, label: sc >= max - 1 ? T('done') : T('next'), kind: 'primary', size: 26 } };
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
      b.push({ t: 'row', size: 28, items: [{ id: 'lang:en', label: 'Play in English', kind: S.lang === 'en' ? 'on' : 'normal' }, { id: 'lang:zh', label: '中文 游戏', kind: S.lang === 'zh' ? 'on' : 'normal' }] });
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
  const OV = LAY.ov.rect;
  const ui = { scale, fixed: [], blocks: [], kind: 'card', panel: OV, scrollKey: `ov:${S.overlay}`, overlay: true };
  ui.region = { x: OV.x + 24, y: OV.y + 24, w: OV.w - 48, h: OV.h - 48 };
  const b = [];
  const hs = (n) => (scale >= 2 ? n * 0.72 : n); // card headings stay readable without eating the whole card at 200%+
  const acts = [];
  const act = (id, label, kind, size) => acts.push({ id, label, kind, size });
  if (S.overlay === 'pause') {
    b.push({ t: 'h', text: T('paused'), size: hs(40) });
    act('ov:resume', T('resume'), 'primary', 30);
    act('ov:restart', T('restartLevel'), 'normal', 28);
    act('set:sound', S.sound ? T('soundOn') : T('soundOff'), S.sound ? 'on' : 'normal', 26);
    act('ov:levels', T('levels'), 'normal', 28);
    if (S.dev) act('ov:devsolve', 'Dev: solve now', 'normal', 24);
  } else if (S.overlay === 'win') {
    const info = S.winInfo ?? { stars: 1, moves: 0, min: 0, best: false };
    b.push({ t: 'h', text: T('solved'), size: hs(40) });
    b.push({ t: 'img', name: 'winstars', h: LAY.ov.row ? 110 : 150, data: info.stars });
    b.push({ t: 'p', text: S.puz ? levelName(S, S.puz.level) : '', size: 28, center: true });
    b.push({ t: 'p', text: T('solvedIn', { n: info.moves }) + `  ·  ${T('minimum')}: ${info.min}`, size: 24, center: true });
    b.push({ t: 'p', text: info.moves <= info.min ? T('perfect') : info.stars >= 3 ? T('stars3') : info.stars === 2 ? T('stars2') : T('stars1'), size: 24 });
    if (info.best) b.push({ t: 'p', text: T('newBest'), size: 24, center: true });
    if (info.newChapter != null) b.push({ t: 'p', text: `${T('chapter')}: ${CHAPTERS[info.newChapter][S.lang]}`, size: 24 });
    b.push({ t: 'img', name: 'more', h: 30 });
    const nxt = S.levelIdx + 1;
    if (nxt < LEVELS.length) act('ov:next', T('nextLevel'), 'primary', 30);
    act('ov:replay', T('replay'), 'normal', 28);
    act('ov:levels', T('levels'), 'normal', 28);
  } else if (S.overlay === 'autosum') {
    b.push({ t: 'h', text: T('autoSession'), size: hs(38) });
    b.push({ t: 'p', text: T('autoSummary'), size: 26 });
    act('ov:autoagain', T('autoAgain'), 'primary', 28);
    act('ov:autoexit', T('autoExit'), 'normal', 28);
  }
  ui.blocks = b;
  ui.acts = acts;
  fitCard(ui, scale);
  return ui;
}

// Size a centred card to its content (never taller than the screen allows). The buttons are pinned to the
// bottom of the card and never scroll away; everything above them scrolls when the text is large.
// In landscape the buttons sit side by side in rows so the card stays short.
function actBlocks(acts, rowMode) {
  if (!rowMode || acts.length < 2) return acts.map((a) => ({ t: 'btn', id: a.id, label: a.label, kind: a.kind, size: a.size }));
  const per = acts.length <= 3 ? acts.length : Math.ceil(acts.length / 2);
  const rows = [];
  for (let i = 0; i < acts.length; i += per) rows.push({ t: 'row', size: Math.min(...acts.slice(i, i + per).map((a) => a.size)), items: acts.slice(i, i + per).map((a) => ({ id: a.id, label: a.label, kind: a.kind })) });
  return rows;
}

function fitCard(ui, scale) {
  const OV = LAY.ov;
  const innerW = OV.w - 48;
  const bodyBlocks = ui.blocks.filter((b) => b.t !== 'btn');
  const acts = ui.acts ?? ui.blocks.filter((b) => b.t === 'btn').map((b) => ({ id: b.id, label: b.label, kind: b.kind, size: b.size }));
  const actB = actBlocks(acts, OV.row);
  const body = layoutDoc(bodyBlocks, scale, innerW);
  const act = layoutDoc(actB, scale, innerW);
  if (act.height > (Math.min(OV.maxH, 1180) - 56) * 0.5) {
    // large text: the buttons would not fit pinned under the text, so the whole card is one scrolling page
    const all = layoutDoc([...bodyBlocks, ...actB], scale, innerW);
    const hh = Math.min(OV.maxH, 1180, all.height + 56);
    const yy = Math.round(OV.cy - hh / 2);
    ui.panel = { x: OV.rect.x, y: yy, w: OV.rect.w, h: hh };
    ui.region = { x: OV.rect.x + 24, y: yy + 28, w: innerW, h: hh - 56 };
    ui.layout = all; ui.fixed = [];
    return;
  }
  const h = Math.min(OV.maxH, 1180, Math.max(Math.min(420, OV.maxH), body.height + act.height + 72));
  const y = Math.round(OV.cy - h / 2);
  const x0 = OV.rect.x + 24;
  const actTop = y + h - 28 - act.height;
  ui.panel = { x: OV.rect.x, y, w: OV.rect.w, h };
  ui.region = { x: x0, y: y + 28, w: innerW, h: Math.max(120, h - 56 - act.height - 8) };
  ui.layout = body;
  ui.fixed = act.items.flatMap((it) => it.btns.map((bt) => ({
    id: bt.id, rect: { x: x0 + bt.x, y: actTop + bt.y, w: bt.w, h: bt.h }, kind: bt.kind ?? it.b.kind ?? 'normal', lines: bt.lines ?? it.lines, size: it.size, line: it.line, disabled: bt.disabled,
  })));
}
