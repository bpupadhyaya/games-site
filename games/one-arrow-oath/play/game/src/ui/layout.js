// Screen geometry shared by input handling (game.js) and drawing (render.js), so a thing is
// always tappable exactly where it is drawn. All values are in the 720x1560 virtual space.
import { W } from './theme.js';

export const CARD_W = 156;
export const CARD_H = 232;
export const HAND_Y = 1286;
export const PULL_TO_LOOSE = 90;
export const FIELD_BOTTOM = 760; // a card dragged above this line is being thrown at the field
export const ENEMY_Y = 430;
export const ARCHER = { x: 360, y: 880 };
export const RING = { x: 104, y: 850, r: 64 };
export const FOCUS = { x: 622, y: 800 };
export const RESOLVE_BAR = { x: 170, y: 968, w: 380, h: 22 };
export const DETAIL = { x: 36, y: 1014, w: W - 72, h: 116 };
export const HEADER_Y = 128;
// The Arcforge app draws its own "Menu" button top-left, over the game. Keep every header inside
// the band between it and the game's own menu button, and centre things on that band.
export const HEADER_BAND = { left: 196, right: 624 };
export const HEADER_CX = (HEADER_BAND.left + HEADER_BAND.right) / 2;
export const HEADER_W = HEADER_BAND.right - HEADER_BAND.left;

export const BTN = {
  menu: { x: 632, y: 100, w: 64, h: 60 },
  foul: { x: 20, y: 1434, w: 120, h: 70 },
  quiver: { x: 150, y: 1434, w: 122, h: 70 },
  spent: { x: 282, y: 1434, w: 112, h: 70 },
  ledger: { x: 404, y: 1434, w: 112, h: 70 },
  endTurn: { x: 526, y: 1434, w: 174, h: 70 },
};

export function handSlots(n) {
  if (n <= 0) return [];
  // Big hands shrink a little so names and numbers are never buried under the next card.
  const scale = n <= 4 ? 1 : n === 5 ? 0.92 : n === 6 ? 0.84 : 0.76;
  const w = CARD_W * scale;
  const spacing = n === 1 ? 0 : Math.min(w + 8, (W - 24 - w) / (n - 1));
  const total = (n - 1) * spacing;
  const mid = (n - 1) / 2;
  const slots = [];
  for (let i = 0; i < n; i++) {
    const off = i - mid;
    slots.push({ x: W / 2 - total / 2 + i * spacing, y: HAND_Y + off * off * 3.5 + (1 - scale) * 50, rot: off * 0.022, scale });
  }
  return slots;
}

export function enemySlots(enemies) {
  const n = enemies.length;
  const xs = n === 1 ? [360] : n === 2 ? [210, 510] : [128, 360, 592];
  // Large enemies sit a little higher and smaller so their name and health never touch the archer.
  return enemies.map((e, i) => ({
    x: xs[Math.min(i, xs.length - 1)],
    y: e.decoy ? ENEMY_Y + 46 : e.boss ? ENEMY_Y - 30 : e.elite && n === 1 ? ENEMY_Y - 16 : n >= 3 ? ENEMY_Y - 22 : ENEMY_Y,
    r: e.boss ? 94 : e.decoy ? 42 : e.elite ? (n === 1 ? 88 : 70) : n >= 3 ? 60 : 88,
  }));
}

export const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Vertical list of wide choice panels (map doors, camp, envoy, options).
export function choiceRects(n, top = 470, h = 164, gap = 24) {
  const rects = [];
  for (let i = 0; i < n; i++) rects.push({ x: 44, y: top + i * (h + gap), w: W - 88, h });
  return rects;
}

// Three big cards side by side (rewards, shop).
export function trioRects(n, y = 600, w = 212) {
  const gap = 14;
  const total = n * w + (n - 1) * gap;
  const rects = [];
  for (let i = 0; i < n; i++) rects.push({ x: W / 2 - total / 2 + i * (w + gap), y, w, h: w * (CARD_H / CARD_W) });
  return rects;
}

// Title menu: three to five buttons, sized so the last one always clears the home indicator.
export function titleRects(n) {
  const h = n >= 5 ? 70 : n >= 4 ? 84 : 98;
  const gap = n >= 5 ? 12 : n >= 4 ? 14 : 18;
  const top = n >= 5 ? 1104 : n >= 4 ? 1126 : 1140;
  const rects = [];
  for (let i = 0; i < n; i++) rects.push({ x: 104, y: top + i * (h + gap), w: W - 208, h });
  return rects;
}
// The New Run picker: choose who you are and how heavy a vow you carry.
export const NEWRUN = {
  panel: { x: 36, y: 200, w: W - 72, h: 1100 },
  archerPrev: { x: 66, y: 470, w: 84, h: 84 },
  archerNext: { x: W - 150, y: 470, w: 84, h: 84 },
  oathPrev: { x: 66, y: 860, w: 84, h: 84 },
  oathNext: { x: W - 150, y: 860, w: 84, h: 84 },
  begin: { x: 140, y: 1096, w: 440, h: 96 },
  cancel: { x: 190, y: 1218, w: 340, h: 60 },
};
// Was a 2-column row (How to Play | About); now 3 columns at the same y and overall span
// (60..660), to make room for the Rules tab (Rules-page addition; nothing else moves).
export const HELP_TABS = [{ x: 60, y: 236, w: 192, h: 76 }, { x: 264, y: 236, w: 192, h: 76 }, { x: 468, y: 236, w: 192, h: 76 }];
// Pagination for every tab of the help overlay (How to Play/About/Rules all paginate their own
// content) — a Back/Next row above the overlay's own Close button.
export const PAGE_NAV = { back: { x: 60, y: 1258, w: 294, h: 80 }, next: { x: 366, y: 1258, w: 294, h: 80 } };
// How many How to Play tips / About paragraphs share one page, so bigger text (below) never
// overflows the panel: pace new content to these budgets rather than shrinking font size.
// Lowered from 3/2 to 1/1 for the 300% top step (owner request, 2026-09-22, raised from an
// earlier 200% target mid-pass): one tip/paragraph per page is already the shortest this pacing
// constant can express - reaching 300% relies on further splitting the content itself too (see
// help.js / rules_reference.js).
export const HOWTO_PER_PAGE = 1;
export const ABOUT_PER_PAGE = 1;
// Text-size steps for the help overlay's reference pages (How to Play/About/Rules). Index into
// this, never a raw float, so "min"/"max" are exact and the stepper can cleanly disable at either
// end. Every page's content is paced (help.js / rules_reference.js) to fit even at the top step.
// Raised to a 300% top step (owner request, 2026-09-22): evenly spaced 0.5 steps rather than the
// old [1, 1.15, 1.3] spacing, since reaching 300% needed real headroom, not one more notch.
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
// "A-"/"A+" text-size stepper: a header row of its own, above the title and the How to Play/
// About/Rules tab row, so it never crowds either. Symmetric either side of the centred title.
export const HELP_TEXT = { dec: { x: 46, y: 150, w: 96, h: 60 }, inc: { x: 578, y: 150, w: 96, h: 60 } };
export const COVENANT_BTN_TOP = 960;
export const COVENANT_BTN = { h: 84, gap: 16 };
export const OPTIONS_TOP = 520;
export const OPTIONS = { h: 132, gap: 18 };
export const ENVOY_TOP = 760;
export const ENVOY = { h: 140, gap: 20 };
export const TUNER_TRIO_Y = 520;
export const TUNER_REMOVE = { x: 90, y: 960, w: 540, h: 92 };

export const CONFIRM = { x: 140, y: 1300, w: 440, h: 96 };
export const SECONDARY = { x: 190, y: 1416, w: 340, h: 72 };

// Scrollable card grid used by the Quiver / Spent / pick-a-card overlays.
export const GRID = { x: 24, y: 300, w: W - 48, h: 1000, cols: 4, cellW: 168, cellH: 250 };
export const CLOSE = { x: 190, y: 1360, w: 340, h: 84 };

// ---------------------------------------------------------------- Auto Play (assisted learning)
// THINK (board still, nothing shown) -> REVEAL (~2s, legal options dim, the one about to be taken
// lit) -> ACT (the real rules/battle functions run) -> loop, for a whole run. Think-time is an
// INDEX into this array, never a raw float, so the stepper can cleanly clamp at either end and a
// saved index from a shorter/longer build can never go out of range. Default index 1 (5s); the
// last step (10s) is the hard cap.
export const AUTO_THINK_STEPS = [2, 5, 8, 10];
export const AUTO_REVEAL_SECONDS = 2;
export const AUTO_ACT_SECONDS = 0.9;
// A dedicated layout, not the real screens'. The real ones are built entirely around a human's
// taps (drag-to-loose, half a dozen small buttons) that Auto Play never needs, so it gets its own
// caption/stepper band top and bottom and hands the rest of the canvas to whatever is being
// decided, rather than fighting the real header/bottomBar for room.
export const AUTO_HUD = { x: 40, y: 100, w: W - 80, h: 172 };
export const AUTO_STEP_DEC = { x: 66, y: 212, w: 78, h: 54 };
export const AUTO_STEP_INC = { x: W - 144, y: 212, w: 78, h: 54 };
export const AUTO_CONTENT_TOP = 300;
export const AUTO_CONTENT_BOTTOM = 1404;
// Three even buttons across the same span the old Skip/Exit pair used (was two 300-wide buttons
// with a 40px gap; AUTO_PAUSE is the addition, for the owner's "freeze the whole loop, resume
// exactly where it froze" request - still a comfortable tap target at 200 wide).
export const AUTO_SKIP = { x: 40, y: 1420, w: 200, h: 84 };
export const AUTO_PAUSE = { x: 260, y: 1420, w: 200, h: 84 };
export const AUTO_EXIT = { x: 480, y: 1420, w: 200, h: 84 };
export const AUTO_AGAIN = { x: 140, y: 1300, w: 440, h: 96 };
export const AUTO_OVER_EXIT = { x: 190, y: 1416, w: 340, h: 72 };

// Vertical list of wide panels (map doors, camp options, envoy options) inside the content band.
export function autoListRects(n, top = AUTO_CONTENT_TOP, h = 158, gap = 22) {
  const rects = [];
  for (let i = 0; i < n; i++) rects.push({ x: 44, y: top + i * (h + gap), w: W - 88, h });
  return rects;
}
// Cards side by side (reward, the Tuner's stock) inside the content band.
export function autoTrioRects(n, y = AUTO_CONTENT_TOP + 30, w = 196) {
  const gap = 16;
  const total = n * w + (n - 1) * gap;
  const rects = [];
  for (let i = 0; i < n; i++) rects.push({ x: W / 2 - total / 2 + i * (w + gap), y, w, h: w * (CARD_H / CARD_W) });
  return rects;
}
// The hand, laid flat near the bottom of the content band (no drag-to-loose to animate here).
export function autoHandSlots(n, y = AUTO_CONTENT_BOTTOM - 150) {
  if (n <= 0) return [];
  const w = n <= 5 ? 122 : 104;
  const spacing = n === 1 ? 0 : Math.min(w + 10, (W - 48 - w) / (n - 1));
  const total = (n - 1) * spacing;
  const slots = [];
  for (let i = 0; i < n; i++) slots.push({ x: W / 2 - total / 2 + i * spacing, y, w });
  return slots;
}
// The enemy row, near the top of the content band.
export function autoEnemySlots(enemies, y = AUTO_CONTENT_TOP + 150) {
  const n = enemies.length;
  const xs = n === 1 ? [360] : n === 2 ? [220, 500] : [140, 360, 580];
  return enemies.map((e, i) => ({ x: xs[Math.min(i, xs.length - 1)], y, r: n >= 3 ? 60 : e.boss ? 80 : 72 }));
}
