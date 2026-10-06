// Builds the block lists for every text screen. Both game.js (hit-testing) and view.js (drawing) call
// buildUi() with the same state, so layout and taps always agree at every text-zoom step.
import { LEVELS } from './levels.js';
import { TEXT_SCALES, layoutDoc } from './ui.js';
import { CHAPTERS, HOWTO, RULES, ABOUT, tr } from './content.js';
import { layout } from './layout.js';

export const DEMO_LEVELS = 6;
export const UNLOCK_NEED = 8;
export const THINK_STEPS = [2, 5, 8, 10];

export const chapterLevels = (ch) => LEVELS.map((l, i) => ({ l, i })).filter((x) => x.l.ch === ch);
export const solvedIn = (S, ch) => chapterLevels(ch).filter((x) => (S.progress.stars[x.l.id] ?? 0) > 0).length;
export const chapterUnlocked = (S, ch) => ch === 0 || S.dev || solvedIn(S, ch - 1) >= UNLOCK_NEED;
export const totalSolved = (S) => LEVELS.filter((l) => (S.progress.stars[l.id] ?? 0) > 0).length;
export const totalStars = (S) => LEVELS.reduce((s, l) => s + (S.progress.stars[l.id] ?? 0), 0);
export const levelName = (S, l) => l.n[S.lang === 'zh' ? 1 : 0];
export const demoLocked = (S, idx) => S.demo && idx >= DEMO_LEVELS;
export const levelLocked = (S, idx) => demoLocked(S, idx) || !chapterUnlocked(S, LEVELS[idx].ch);

export function firstOpenLevel(S) {
  for (let i = 0; i < LEVELS.length; i++) {
    if (!levelLocked(S, i) && !(S.progress.stars[LEVELS[i].id] > 0)) return i;
  }
  return Math.min(S.levelIdx ?? 0, LEVELS.length - 1);
}

const pctLabel = (S) => `${Math.round(TEXT_SCALES[S.textIdx] * 100)}%`;

function fixedBar(S, T, D, backLabel = 'back') {
  const scale = TEXT_SCALES[S.textIdx];
  return [
    { id: 'back', rect: D.back, kind: 'normal', icon: 'back', label: T(backLabel), size: 26 },
    { id: 'zoom-', rect: D.zoomDec, kind: 'normal', label: 'A-', size: 30, disabled: S.textIdx === 0 },
    { id: 'zoom+', rect: D.zoomInc, kind: 'normal', label: 'A+', size: 30, disabled: S.textIdx === TEXT_SCALES.length - 1 },
    { id: null, rect: D.pct, label: pctLabel(S), size: 28, static: true, scale },
  ];
}

const pieceTypeKey = { L: 'pieceL', M: 'pieceM', S: 'pieceS', SQ: 'pieceSQ', PA: 'piecePA' };
export const pieceName = (S, type) => tr(S.lang, pieceTypeKey[type]);

export function buildUi(S) {
  const T = (k, v) => tr(S.lang, k, v);
  const scale = TEXT_SCALES[S.textIdx];
  const ui = { scale, fixed: [], blocks: [], panel: null, region: null, kind: 'doc', scrollKey: S.scene };
  const L = layout(), D = L.doc;

  if (S.overlay) return overlayUi(S, T, scale, L);

  switch (S.scene) {
    case 'title': {
      ui.kind = 'menu';
      ui.region = L.title.menu;
      ui.panel = null;
      const b = [];
      const playSub = S.demo ? T('demoLeft', { n: Math.max(0, DEMO_LEVELS - totalSolved(S)) }) : (totalSolved(S) ? `${totalSolved(S)} / ${LEVELS.length} · ${totalStars(S)} ★` : undefined);
      const doneToday = S.dailyRec.day === S.today;
      const dailySub = S.demo ? T('dailyLocked') : doneToday ? `${T('dailyDone')}  ${T('dailyStreak')}: ${S.dailyRec.streak}` : (S.dailyRec.streak > 0 ? `${T('dailyStreak')}: ${S.dailyRec.streak}` : undefined);
      if (L.title.compact) {
        // tablets, short phones and landscape: two buttons per row so the menu stays short
        b.push({ t: 'btn', id: 'play', label: T('playBtn'), kind: 'primary', size: 34, sub: playSub, minH: 104 });
        b.push({ t: 'row', size: 26, minH: 84, items: [{ id: 'daily', label: T('dailyBtn'), disabled: S.demo }, { id: 'auto', label: T('autoBtn') }] });
        b.push({ t: 'row', size: 26, minH: 84, items: [{ id: 'howto', label: T('howtoBtn') }, { id: 'rules', label: T('rulesBtn') }] });
        b.push({ t: 'row', size: 26, minH: 84, items: [{ id: 'about', label: T('aboutBtn') }, { id: 'settings', label: T('settingsBtn') }] });
        b.push({ t: 'img', name: 'lockup', id: 'arcforge', h: 78, hitW: 250 });
      } else {
        b.push({ t: 'btn', id: 'play', label: T('playBtn'), kind: 'primary', size: 36, sub: playSub, minH: 118 });
        b.push({ t: 'btn', id: 'daily', label: T('dailyBtn'), size: 30, sub: dailySub, disabled: S.demo, minH: 96 });
        b.push({ t: 'btn', id: 'auto', label: T('autoBtn'), size: 30, minH: 96 });
        b.push({ t: 'row', size: 28, minH: 96, items: [{ id: 'howto', label: T('howtoBtn') }, { id: 'rules', label: T('rulesBtn') }] });
        b.push({ t: 'row', size: 28, minH: 96, items: [{ id: 'about', label: T('aboutBtn') }, { id: 'settings', label: T('settingsBtn') }] });
        b.push({ t: 'img', name: 'lockup', id: 'arcforge', h: 78, hitW: 250 });
      }
      ui.blocks = b;
      ui.fixed = [
        { id: 'lang:en', rect: L.title.chips.en, kind: S.lang === 'en' ? 'on' : 'normal', label: 'English', size: 25 },
        { id: 'lang:zh', rect: L.title.chips.zh, kind: S.lang === 'zh' ? 'on' : 'normal', label: '中文', size: 27 },
      ];
      break;
    }
    case 'levels': {
      ui.panel = D.panel; ui.region = D.body;
      ui.fixed = fixedBar(S, T, D);
      const base = scale <= 1 ? 4 : scale <= 2 ? 3 : 2;
      const cols = Math.min(9, Math.max(base, Math.round(base * D.body.w / 624)));
      const b = [];
      b.push({ t: 'p', text: `${T('solvedCount')}: ${totalSolved(S)} / ${LEVELS.length}    ${T('stars')}: ${totalStars(S)} / ${LEVELS.length * 3}`, size: 24, gap: 12 });
      CHAPTERS.forEach((c, ci) => {
        const items = chapterLevels(ci);
        if (!items.length) return;
        const open = chapterUnlocked(S, ci);
        b.push({ t: 'h', text: `${ci + 1}. ${c[S.lang]}`, size: 30 });
        b.push({ t: 'p', text: open ? `${c.blurb[S.lang]}  (${solvedIn(S, ci)}/${items.length})` : T('locked'), size: 22, gap: 10 });
        b.push({
          t: 'grid', cols,
          cells: items.map(({ l, i }) => ({
            id: `lvl:${i}`, label: String(i + 1), name: levelName(S, l), idx: i,
            state: (S.progress.stars[l.id] ?? 0) > 0 ? 'solved' : levelLocked(S, i) ? 'locked' : 'open',
            stars: S.progress.stars[l.id] ?? 0, lvl: l,
          })),
        });
        b.push({ t: 'gap', h: 14 });
      });
      ui.blocks = b;
      break;
    }
    case 'howto':
    case 'rules': {
      // One continuous scrolling reader (drag, wheel, arrows, PageUp / PageDown, scroll bar) instead of many short pages,
      // so 300 % text works on every screen shape.
      const isRules = S.scene === 'rules';
      const pages = isRules ? RULES[S.lang] : HOWTO[S.lang];
      ui.panel = D.panel; ui.region = D.body;
      ui.fixed = fixedBar(S, T, D);
      ui.scrollKey = `${S.scene}:${S.lang}`;
      const b = [];
      pages.forEach((pg, pi) => {
        b.push({ t: 'h', text: isRules || pages.length < 2 ? pg.title : `${pi + 1} / ${pages.length}  ${pg.title}`, size: pi === 0 ? 40 : 36 });
        const art = isRules ? pg.art : ['target', 'drag', 'rotate', 'flip', 'hint', 'chapters'][pi];
        if (art) b.push({ t: 'img', name: art, h: isRules ? 290 : 330 });
        if (isRules) for (const para of pg.body) b.push({ t: 'p', text: para, size: 29 });
        else b.push({ t: 'p', text: pg.body, size: 32 });
        b.push({ t: 'gap', h: 26 });
      });
      if (!isRules) b.push({ t: 'btn', id: 'play', label: T('playBtn'), kind: 'primary', size: 30 });
      ui.blocks = b;
      break;
    }
    case 'about': {
      ui.panel = D.panel; ui.region = D.body;
      ui.fixed = fixedBar(S, T, D);
      const b = [{ t: 'img', name: 'logo', h: 230 }];
      ABOUT[S.lang].forEach((s, i) => { b.push({ t: 'h', text: s.title, size: i === 0 ? 38 : 30 }); b.push({ t: 'p', text: s.body, size: 26 }); });
      b.push({ t: 'p', text: `v${S.version}`, size: 22 });
      ui.blocks = b;
      break;
    }
    case 'settings': {
      ui.panel = D.panel; ui.region = D.body;
      ui.fixed = fixedBar(S, T, D);
      const b = [];
      b.push({ t: 'h', text: T('settingsBtn'), size: 36 });
      b.push({ t: 'p', text: T('language'), size: 24, gap: 6 });
      b.push({ t: 'row', size: 28, items: [{ id: 'lang:en', label: 'English', kind: S.lang === 'en' ? 'on' : 'normal' }, { id: 'lang:zh', label: '中文', kind: S.lang === 'zh' ? 'on' : 'normal' }] });
      b.push({ t: 'btn', id: 'set:sound', label: S.sound ? T('soundOn') : T('soundOff'), kind: S.sound ? 'on' : 'normal', size: 28 });
      b.push({ t: 'btn', id: 'set:glow', label: S.glow ? T('glowOn') : T('glowOff'), kind: S.glow ? 'on' : 'normal', size: 28 });
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

function overlayUi(S, T, scale, L) {
  const ui = { scale, fixed: [], blocks: [], kind: 'card', panel: null, scrollKey: `ov:${S.overlay}`, overlay: true };
  const b = [];
  const hs = (n) => (scale >= 2 ? n * 0.72 : n); // card headings stay readable without eating the whole card at 200%+
  if (S.overlay === 'pause') {
    b.push({ t: 'h', text: T('paused'), size: hs(40) });
    b.push({ t: 'btn', id: 'ov:resume', label: T('resume'), kind: 'primary', size: 30 });
    b.push({ t: 'btn', id: 'ov:restart', label: T('restartLevel'), size: 28 });
    b.push({ t: 'btn', id: 'set:sound', label: S.sound ? T('soundOn') : T('soundOff'), kind: S.sound ? 'on' : 'normal', size: 26 });
    b.push({ t: 'btn', id: 'ov:levels', label: S.daily ? T('quitMenu') : T('levels'), size: 28 });
    if (S.dev) b.push({ t: 'btn', id: 'ov:devsolve', label: 'Dev: solve now', size: 24 });
  } else if (S.overlay === 'win') {
    const info = S.winInfo ?? { stars: 1 };
    b.push({ t: 'h', text: S.daily ? T('dailyDone') : T('solved'), size: hs(40) });
    b.push({ t: 'img', name: 'winstars', h: 150, data: info.stars });
    b.push({ t: 'p', text: S.daily ? `${T('dailyStreak')}: ${S.dailyRec.streak}` : (S.puz ? levelName(S, S.puz.level) : ''), size: 28, center: true });
    b.push({ t: 'p', text: info.stars >= 3 ? T('stars3') : info.stars === 2 ? T('stars2') : T('stars1'), size: 24 });
    if (info.newChapter != null) b.push({ t: 'p', text: `${T('chapter')}: ${CHAPTERS[info.newChapter][S.lang]}`, size: 24 });
    if (!S.daily) {
      const nxt = S.levelIdx + 1;
      if (nxt < LEVELS.length) b.push({ t: 'btn', id: 'ov:next', label: T('nextLevel'), kind: 'primary', size: 30 });
    }
    b.push({ t: 'btn', id: 'ov:replay', label: T('replay'), size: 28 });
    b.push({ t: 'btn', id: 'ov:levels', label: S.daily ? T('quitMenu') : T('levels'), size: 28 });
  } else if (S.overlay === 'autosum') {
    b.push({ t: 'h', text: T('autoSession'), size: hs(38) });
    b.push({ t: 'p', text: T('autoSummary'), size: 26 });
    b.push({ t: 'btn', id: 'ov:autoagain', label: T('autoAgain'), kind: 'primary', size: 28 });
    b.push({ t: 'btn', id: 'ov:autoexit', label: T('autoExit'), size: 28 });
  }
  ui.blocks = b;
  fitCard(ui, scale, L);
  return ui;
}

// Size a centred card to its content (never taller than the screen allows). The buttons are pinned to the
// bottom of the card and never scroll away; everything above them scrolls when the text is large.
function fitCard(ui, scale, L) {
  const O = L.overlay, innerW = O.w - 48;
  const bodyBlocks = ui.blocks.filter((b) => b.t !== 'btn');
  const actBlocks = ui.blocks.filter((b) => b.t === 'btn');
  const body = layoutDoc(bodyBlocks, scale, innerW);
  const act = layoutDoc(actBlocks, scale, innerW);
  const h = Math.min(O.maxH, Math.max(Math.min(420, O.maxH), body.height + act.height + 72));
  const y = Math.round(O.cy - h / 2);
  const x0 = O.x + 24;
  const actTop = y + h - 28 - act.height;
  ui.panel = { x: O.x, y, w: O.w, h };
  ui.region = { x: x0, y: y + 28, w: innerW, h: Math.max(80, h - 56 - act.height - 8) };
  ui.layout = body;
  ui.fixed = act.items.flatMap((it) => it.btns.map((bt) => ({
    id: bt.id, rect: { x: x0 + bt.x, y: actTop + bt.y, w: bt.w, h: bt.h }, kind: it.b.kind ?? 'normal', lines: it.lines, size: it.size, line: it.line, disabled: bt.disabled,
  })));
}
