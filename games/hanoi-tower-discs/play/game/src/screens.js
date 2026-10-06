// Builds the block lists for every text screen. Both game.js (hit-testing) and view.js (drawing) call buildUi()
// with the same state, so layout and taps always agree at every text-zoom step.
import { LEVELS, CHAPTER_NAMES, CHAPTER_BLURBS, levelMin } from './levels.js';
import { TEXT_SCALES, layoutDoc } from './ui.js';
import { HOWTO, RULES, ABOUT, tr } from './content.js';
import { layoutFor } from './layout.js';

export const DEMO_LEVELS = 3;
export const UNLOCK_NEED = 3;
export const THINK_STEPS = [2, 5, 8, 10];

export const chapterLevels = (ch) => LEVELS.map((l, i) => ({ l, i })).filter((x) => x.l.ch === ch);
export const starsOf = (S, l) => S.progress.stars[l.id] ?? 0;
export const solvedIn = (S, ch) => chapterLevels(ch).filter((x) => starsOf(S, x.l) > 0).length;
export const chapterUnlocked = (S, ch) => ch === 0 || S.dev || solvedIn(S, ch - 1) >= UNLOCK_NEED;
export const totalSolved = (S) => LEVELS.filter((l) => starsOf(S, l) > 0).length;
export const totalStars = (S) => LEVELS.reduce((s, l) => s + starsOf(S, l), 0);
export const demoLocked = (S, idx) => S.demo && idx >= DEMO_LEVELS;
export const levelLocked = (S, idx) => demoLocked(S, idx) || !chapterUnlocked(S, LEVELS[idx].ch);

export function firstOpenLevel(S) {
  for (let i = 0; i < LEVELS.length; i++) if (!levelLocked(S, i) && !(starsOf(S, LEVELS[i]) > 0)) return i;
  return Math.min(S.levelIdx ?? 0, LEVELS.length - 1);
}

const pctLabel = (S) => `${Math.round(TEXT_SCALES[S.textIdx] * 100)}%`;

function fixedBar(S, D) {
  return [
    { id: 'back', rect: D.back, kind: 'normal', icon: 'back', label: tr('back'), size: 26 },
    { id: 'zoom-', rect: D.zoomDec, kind: 'normal', label: 'A-', size: 30, disabled: S.textIdx === 0 },
    { id: 'zoom+', rect: D.zoomInc, kind: 'normal', label: 'A+', size: 30, disabled: S.textIdx === TEXT_SCALES.length - 1 },
    { id: null, rect: D.pct, label: pctLabel(S), size: 28, static: true },
  ];
}

const memo = new Map();
// The Rules / How to Play / About readers never change while shown: lay them out once per (text size, screen shape).
export function buildUi(S) {
  if (S.overlay || (S.scene !== 'howto' && S.scene !== 'rules' && S.scene !== 'about')) return buildUiNow(S);
  const key = `${S.scene}|${S.textIdx}|${layoutFor().key}`;
  let ui = memo.get(key);
  if (!ui) { ui = buildUiNow(S); memo.set(key, ui); if (memo.size > 24) memo.delete(memo.keys().next().value); }
  return ui;
}

function buildUiNow(S) {
  const scale = TEXT_SCALES[S.textIdx];
  const L = layoutFor(), D = L.doc;
  const ui = { scale, fixed: [], blocks: [], panel: null, region: null, kind: 'doc', scrollKey: S.scene };
  if (S.overlay) return overlayUi(S, scale, L);

  switch (S.scene) {
    case 'title': {
      ui.kind = 'menu';
      ui.region = L.title.region;
      const solved = totalSolved(S);
      const playSub = S.demo ? tr('demoLeft', { n: Math.max(0, DEMO_LEVELS - solved) }) : (solved ? `${solved} / ${LEVELS.length} · ${totalStars(S)} ★` : undefined);
      const doneToday = S.dailyRec.day === S.today;
      const dailySub = S.demo ? tr('dailyLocked') : doneToday ? `${tr('dailyDone')}  ${tr('dailyStreak')}: ${S.dailyRec.streak}` : (S.dailyRec.streak > 0 ? `${tr('dailyStreak')}: ${S.dailyRec.streak}` : undefined);
      // the menu squeezes (button height only, never the text) until it fits the space under / beside the title art
      const mk = (f) => [
        { t: 'btn', id: 'play', label: tr('playBtn'), kind: 'primary', size: 36, sub: playSub, minH: Math.round(118 * f) },
        { t: 'btn', id: 'daily', label: tr('dailyBtn'), size: 30, sub: dailySub, disabled: S.demo, minH: Math.round(96 * f) },
        { t: 'btn', id: 'auto', label: tr('autoBtn'), size: 30, minH: Math.round(96 * f) },
        { t: 'row', size: 28, minH: Math.round(96 * f), items: [{ id: 'howto', label: tr('howtoBtn') }, { id: 'rules', label: tr('rulesBtn') }] },
        { t: 'row', size: 28, minH: Math.round(96 * f), items: [{ id: 'about', label: tr('aboutBtn') }, { id: 'settings', label: tr('settingsBtn') }] },
        { t: 'img', name: 'lockup', id: 'arcforge', h: 78, hitW: 250 },
      ];
      let blocks = mk(1), lay = layoutDoc(blocks, scale, ui.region.w);
      for (const f of [0.9, 0.8, 0.72, 0.66]) { if (lay.height <= ui.region.h) break; blocks = mk(f); lay = layoutDoc(blocks, scale, ui.region.w); }
      ui.blocks = blocks;
      break;
    }
    case 'levels': {
      ui.panel = D.panel; ui.region = D.body;
      ui.fixed = fixedBar(S, D);
      const cols = Math.max(2, Math.min(8, Math.floor(D.body.w / (156 * (0.7 + 0.3 * scale)) + 0.4)));
      const b = [];
      b.push({ t: 'p', text: `${tr('solvedCount')}: ${totalSolved(S)} / ${LEVELS.length}    ${tr('stars')}: ${totalStars(S)} / ${LEVELS.length * 3}`, size: 24, gap: 12 });
      CHAPTER_NAMES.forEach((name, ci) => {
        const items = chapterLevels(ci);
        const open = chapterUnlocked(S, ci);
        b.push({ t: 'h', text: `${ci + 1}. ${name}`, size: 30 });
        b.push({ t: 'p', text: open ? `${CHAPTER_BLURBS[ci]}  (${solvedIn(S, ci)}/${items.length})` : tr('locked'), size: 22, gap: 10 });
        b.push({
          t: 'grid', cols, aspect: 1.18,
          cells: items.map(({ l, i }) => ({
            id: `lvl:${i}`, label: String(l.n), idx: i, lvl: l,
            state: starsOf(S, l) > 0 ? 'solved' : levelLocked(S, i) ? 'locked' : 'open', stars: starsOf(S, l),
          })),
        });
        b.push({ t: 'gap', h: 14 });
      });
      ui.blocks = b;
      break;
    }
    case 'howto':
    case 'rules': {
      // ONE continuous scrolling reader (drag, wheel, arrows / Page keys, scroll bar): every page follows the last under its title.
      const isRules = S.scene === 'rules';
      const pages = isRules ? RULES : HOWTO;
      ui.panel = D.panel; ui.region = D.body;
      ui.fixed = fixedBar(S, D);
      const b = [], marks = [];
      pages.forEach((pg, i) => {
        marks.push(b.length);
        b.push({ t: 'h', text: pg.title, size: 40 });
        if (pg.art) b.push({ t: 'img', name: pg.art, h: isRules ? 360 : 380 });
        if (isRules) for (const para of pg.body) b.push({ t: 'p', text: para, size: 29 });
        else b.push({ t: 'p', text: pg.body, size: 32 });
        if (i < pages.length - 1) b.push({ t: 'gap', h: 34 });
      });
      if (!isRules) { b.push({ t: 'gap', h: 14 }); b.push({ t: 'btn', id: 'play', label: tr('playBtn'), kind: 'primary', size: 30 }); }
      ui.blocks = b; ui.pageMarks = marks;
      break;
    }
    case 'about': {
      ui.panel = D.panel; ui.region = D.body;
      ui.fixed = fixedBar(S, D);
      const b = [{ t: 'img', name: 'logo', h: 260 }];
      ABOUT.forEach((s, i) => { b.push({ t: 'h', text: s.title, size: i === 0 ? 38 : 30 }); b.push({ t: 'p', text: s.body, size: 26 }); });
      b.push({ t: 'p', text: `v${S.version}`, size: 22 });
      ui.blocks = b;
      break;
    }
    case 'settings': {
      ui.panel = D.panel; ui.region = D.body;
      ui.fixed = fixedBar(S, D);
      const b = [];
      b.push({ t: 'h', text: tr('settingsBtn'), size: 36 });
      b.push({ t: 'btn', id: 'set:sound', label: S.sound ? tr('soundOn') : tr('soundOff'), kind: S.sound ? 'on' : 'normal', size: 28 });
      b.push({ t: 'btn', id: 'set:numbers', label: S.numbers ? tr('numbersOn') : tr('numbersOff'), kind: S.numbers ? 'on' : 'normal', size: 28 });
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
      ui.blocks = [
        { t: 'img', name: 'lock', h: L.short ? 110 : 180 },
        { t: 'h', text: tr('demoLimitTitle'), size: 32 },
        { t: 'p', text: tr('demoLimitBody'), size: 26 },
        { t: 'btn', id: 'auto', label: tr('autoBtn'), kind: 'primary', size: 28 },
        { t: 'btn', id: 'menu', label: tr('quitMenu'), size: 28 },
      ];
      fitCard(ui, scale, L);
      return ui;
    }
    default:
      ui.kind = 'none';
  }
  ui.layout = layoutDoc(ui.blocks, scale, ui.region ? ui.region.w : 600);
  ui.offY = ui.kind === 'menu' ? Math.max(0, (ui.region.h - ui.layout.height) / 2) : 0;
  return ui;
}

function overlayUi(S, scale, L) {
  const ui = { scale, fixed: [], blocks: [], kind: 'card', panel: L.overlay, scrollKey: `ov:${S.overlay}`, overlay: true };
  ui.region = { x: L.overlay.x + 24, y: 0, w: L.overlay.w - 48, h: 100 };
  const b = [];
  const hs = (n) => (scale >= 2 ? n * 0.72 : n);
  if (S.overlay === 'pause') {
    b.push({ t: 'h', text: tr('paused'), size: hs(40) });
    b.push({ t: 'btn', id: 'ov:resume', label: tr('resume'), kind: 'primary', size: 30 });
    b.push({ t: 'btn', id: 'ov:restart', label: tr('restartLevel'), size: 28 });
    b.push({ t: 'btn', id: 'set:sound', label: S.sound ? tr('soundOn') : tr('soundOff'), kind: S.sound ? 'on' : 'normal', size: 26 });
    b.push({ t: 'btn', id: 'ov:levels', label: S.daily ? tr('quitMenu') : tr('levels'), size: 28 });
    if (S.dev) b.push({ t: 'btn', id: 'ov:devsolve', label: 'Dev: solve now', size: 24 });
  } else if (S.overlay === 'win') {
    const info = S.winInfo ?? { stars: 1, moves: 0, min: 0 };
    b.push({ t: 'h', text: S.daily ? tr('dailyDone') : tr('solved'), size: hs(40) });
    b.push({ t: 'img', name: 'winstars', h: L.short ? 104 : 150, data: info.stars });
    b.push({ t: 'p', text: `${tr('moves')} ${info.moves}   ${tr('minimum')} ${info.min}`, size: 30, center: true });
    if (S.daily) b.push({ t: 'p', text: `${tr('dailyStreak')}: ${S.dailyRec.streak}`, size: 24, center: true });
    b.push({ t: 'p', text: info.stars >= 3 ? tr('stars3') : info.stars === 2 ? tr('stars2') : tr('stars1'), size: 24 });
    if (!S.daily && S.levelIdx + 1 < LEVELS.length) b.push({ t: 'btn', id: 'ov:next', label: tr('nextLevel'), kind: 'primary', size: 30 });
    b.push({ t: 'btn', id: 'ov:replay', label: tr('replay'), size: 28 });
    b.push({ t: 'btn', id: 'ov:levels', label: S.daily ? tr('quitMenu') : tr('levels'), size: 28 });
  } else if (S.overlay === 'autosum') {
    b.push({ t: 'h', text: tr('autoSession'), size: hs(38) });
    b.push({ t: 'p', text: tr('autoSummary'), size: 26 });
    b.push({ t: 'btn', id: 'ov:autoagain', label: tr('autoAgain'), kind: 'primary', size: 28 });
    b.push({ t: 'btn', id: 'ov:autoexit', label: tr('autoExit'), size: 28 });
  }
  ui.blocks = b;
  fitCard(ui, scale, L);
  return ui;
}

function fitCard(ui, scale, L, all) {
  const O = L.overlay, innerW = O.w - 48;
  const bodyBlocks = ui.blocks.filter((b) => b.t !== 'btn');
  const actBlocks = ui.blocks.filter((b) => b.t === 'btn');
  const body = layoutDoc(bodyBlocks, scale, innerW);
  const act = layoutDoc(actBlocks, scale, innerW);
  if (body.height + act.height + 72 > O.maxH) {
    // too tall for this screen (big text, short window): the whole card becomes one scrolling page, buttons included
    const lay = layoutDoc(ui.blocks, scale, innerW);
    const h = O.maxH, y = Math.round(O.cy - h / 2);
    ui.panel = { x: O.x, y, w: O.w, h };
    ui.region = { x: O.x + 24, y: y + 24, w: innerW, h: h - 48 };
    ui.layout = lay; ui.fixed = [];
    return;
  }
  const h = Math.max(L.short ? 300 : 420, body.height + act.height + 72);
  const y = Math.round(O.cy - h / 2);
  const x0 = O.x + 24;
  const actTop = y + h - 28 - act.height;
  ui.panel = { x: O.x, y, w: O.w, h };
  ui.region = { x: x0, y: y + 28, w: innerW, h: Math.max(120, h - 56 - act.height - 8) };
  ui.layout = body;
  ui.fixed = act.items.flatMap((it) => it.btns.map((bt) => ({
    id: bt.id, rect: { x: x0 + bt.x, y: actTop + bt.y, w: bt.w, h: bt.h }, kind: it.b.kind ?? 'normal', lines: it.lines, size: it.size, line: it.line, disabled: bt.disabled,
  })));
}
export { levelMin };
