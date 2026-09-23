// Draws every screen from the state. Reads state only — never changes it.
import { CARDS, ELEMENTS, ELEMENT_NAMES, BEATS, BEAT_VERBS, describe } from '../data/cards.js';
import { DEBTS } from '../data/debts.js';
import { EVENTS, COVENANT } from '../data/events.js';
import { HOW_TO_PLAY, ABOUT, CREDITS, COACH } from '../data/help.js';
import { RULES_REFERENCE } from '../data/rules_reference.js';
import { ARCHERS, ARCHER_IDS, OATHS } from '../data/meta.js';
import { ENEMIES } from '../data/enemies.js';
import * as B from '../rules/battle.js';
import { STEPS_PER_ACT, REMOVE_PRICE, SKIP_REWARD_MARKS, removableTechs, campHeal } from '../rules/run.js';
import { C, W, H, SAFE_TOP, elementColor, alpha, font } from './theme.js';
import { bar, button, contactShadow, diamond, drawArcher, drawCard, drawConstruct, drawRing, drawSky, glyph, goldFoil, icon, intentBadge, panel, paragraph, roundRect, rule, setPress, text, tracked } from './draw.js';
import { ARCHER, BTN, CARD_H, CARD_W, CLOSE, CONFIRM, COVENANT_BTN, COVENANT_BTN_TOP, DETAIL, ENVOY, ENVOY_TOP, FOCUS, GRID, HEADER_CX, HEADER_W, HEADER_Y, OPTIONS, OPTIONS_TOP, RESOLVE_BAR, RING, SECONDARY, HELP_TABS, HELP_TEXT, PAGE_NAV, HOWTO_PER_PAGE, ABOUT_PER_PAGE, TEXT_SCALES, NEWRUN, TUNER_REMOVE, TUNER_TRIO_Y, choiceRects, enemySlots, titleRects, trioRects, AUTO_HUD, AUTO_STEP_DEC, AUTO_STEP_INC, AUTO_CONTENT_TOP, AUTO_SKIP, AUTO_EXIT, AUTO_AGAIN, AUTO_THINK_STEPS, autoListRects, autoTrioRects, autoHandSlots, autoEnemySlots } from './layout.js';

const TAU = Math.PI * 2;
const ease = (x) => 1 - (1 - x) * (1 - x);

const DOOR_INFO = {
  fight: { title: 'Skirmish', color: C.ink, icon: 'swords' },
  elite: { title: 'Hard Fight', color: C.damage, icon: 'skull' },
  boss: { title: 'The Last Door', color: C.goldLight, icon: 'crown' },
  camp: { title: 'Camp', color: C.good, icon: 'moon' },
  tuner: { title: 'The Tuner', color: C.gold, icon: 'fork' },
  envoy: { title: 'An Envoy', color: '#c4b3ff', icon: 'letter' },
};

function doorSub(door) {
  if (door.kind === 'fight' || door.kind === 'elite' || door.kind === 'boss') return door.encounter.map((k) => ENEMIES[k].name).join('  +  ');
  if (door.kind === 'camp') return 'Rest, lighten the quiver, or settle a Debt';
  if (door.kind === 'tuner') return 'Trade Marks for Arrows and Techniques';
  return EVENTS[door.event]?.title ?? 'Someone waits on the road';
}

function header(ctx, s, title) {
  const run = s.run;
  tracked(ctx, title, HEADER_CX, HEADER_Y, { size: 28, color: C.goldLight, spacing: 6, glow: alpha(C.gold, 0.6), maxWidth: HEADER_W });
  // the road: six steps, then the boss
  const n = STEPS_PER_ACT + 1;
  const y = HEADER_Y + 44;
  const span = 46;
  ctx.strokeStyle = alpha(C.gold, 0.3);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(HEADER_CX - ((n - 1) / 2) * span, y);
  ctx.lineTo(HEADER_CX + ((n - 1) / 2) * span, y);
  ctx.stroke();
  for (let i = 0; i < n; i++) {
    const x = HEADER_CX + (i - (n - 1) / 2) * span;
    const boss = i === n - 1;
    const here = i === run.step;
    diamond(ctx, x, y, boss ? 12 : here ? 10 : 7);
    ctx.fillStyle = i < run.step ? C.gold : here ? '#ffffff' : '#141838';
    if (here) {
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 16;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = boss ? C.damage : alpha(C.gold, 0.8);
    ctx.stroke();
  }
  button(ctx, BTN.menu, '', { quiet: true });
  icon(ctx, 'menu', BTN.menu.x + BTN.menu.w / 2, BTN.menu.y + BTN.menu.h / 2, 24, C.ink, 3);
}

function statusRow(ctx, s, y) {
  const run = s.run;
  panel(ctx, { x: 44, y, w: W - 88, h: 132 }, { r: 22 });
  const items = [
    ['RESOLVE', `${run.resolve}/${run.maxResolve}`, C.damage],
    ['MARKS', String(run.marks), C.goldLight],
    ['STANDING', null, run.unblemished ? C.good : C.muted],
  ];
  items.forEach(([label, value, color], i) => {
    const x = 150 + i * 210;
    text(ctx, label, x, y + 40, { size: 15, weight: 700, color: C.muted, display: true });
    if (value !== null) text(ctx, value, x, y + 86, { size: 36, weight: 800, color });
    else {
      for (let d = 0; d < 3; d++) {
        diamond(ctx, x + (d - 1) * 34, y + 72, 13);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        if (d < run.standing) {
          ctx.fillStyle = color;
          ctx.fill();
        }
      }
    }
    if (i < 2) {
      ctx.strokeStyle = alpha(C.gold, 0.22);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 105, y + 26);
      ctx.lineTo(x + 105, y + 106);
      ctx.stroke();
    }
  });
  if (run.unblemished) text(ctx, 'UNBLEMISHED  ·  one extra card on the first turn', W / 2, y + 120, { size: 15, color: C.good, alpha: 0.9 });
}

// The Rival's nine Arrows, in firing order. Struck-through ones are gone; the next two glow.
function drawRivalQuiver(ctx, quiver, x, y, { broken = false, horizontal = false } = {}) {
  const next = [];
  quiver.forEach((a, i) => {
    if (!a.fired && next.length < 2) next.push(i);
  });
  quiver.forEach((a, i) => {
    const cx = horizontal ? x + i * 70 : x;
    const cy = horizontal ? y : y + i * 42;
    const hot = next.includes(i);
    const foul = broken && !a.fired;
    ctx.save();
    if (a.fired) ctx.globalAlpha = 0.3;
    roundRect(ctx, cx - 32, cy - 19, 64, 38, 12);
    ctx.fillStyle = hot ? 'rgba(46, 40, 96, 0.96)' : 'rgba(8, 10, 28, 0.85)';
    ctx.fill();
    ctx.lineWidth = hot ? 2.4 : 1.2;
    ctx.strokeStyle = foul ? C.damage : hot ? C.goldLight : alpha('#b9a6ff', 0.55);
    ctx.stroke();
    glyph(ctx, a.element, cx - 15, cy, 22, { width: 2.2 });
    text(ctx, `${a.value}${a.hits > 1 ? `×${a.hits}` : ''}`, cx + 6, cy + 7, { size: 18, weight: 800, color: foul ? C.damage : '#ffffff', align: 'left' });
    if (a.fired) {
      ctx.strokeStyle = C.muted;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 28, cy);
      ctx.lineTo(cx + 28, cy);
      ctx.stroke();
    }
    ctx.restore();
  });
}

function bottomBar(ctx, s, inBattle) {
  const run = s.run;
  const b = s.battle;
  if (inBattle) button(ctx, BTN.foul, 'Foul', { danger: true, size: 22, disabled: b.foulUsed });
  const arrows = run.deck.filter((c) => CARDS[c.id].kind === 'arrow').length;
  button(ctx, BTN.quiver, `${arrows}`, { size: 28, sub: 'Arrows left', danger: arrows <= 2, display: false });
  button(ctx, BTN.spent, `${run.spent.length}`, { size: 28, sub: 'Spent', quiet: true, display: false });
  button(ctx, BTN.ledger, `${run.debts.length}`, { size: 28, sub: 'Ledger', quiet: !run.debts.length, danger: run.debts.length > 0, display: false });
  if (inBattle) {
    const idle = b.phase === 'player' && s.lock <= 0 && !b.hand.some((_, i) => B.canPlay(b, i));
    button(ctx, BTN.endTurn, 'End Turn', { size: 23, primary: idle });
  }
}

const confirmButton = (ctx, label, enabled) => button(ctx, CONFIRM, label, { size: 32, disabled: !enabled, primary: enabled });

// ---------------------------------------------------------------- scenes
function drawTitle(ctx, s) {
  const t = s.t;
  // the wordmark
  tracked(ctx, 'One Arrow', W / 2, 400, { size: 62, weight: 500, color: C.ink, spacing: 14, glow: 'rgba(255,255,255,0.35)' });
  tracked(ctx, 'Oath', W / 2, 536, { size: 136, weight: 800, spacing: 28, fill: goldFoil(ctx, 100, 420, 620, 540), glow: alpha(C.gold, 0.7) });
  // the single arrow
  ctx.save();
  ctx.translate(W / 2, 612);
  ctx.strokeStyle = goldFoil(ctx, -260, 0, 260, 0);
  ctx.fillStyle = C.goldLight;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.shadowColor = C.gold;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(-260, 0);
  ctx.lineTo(246, 0);
  for (let i = 0; i < 4; i++) {
    ctx.moveTo(-260 + i * 17, 0);
    ctx.lineTo(-278 + i * 17, -15);
    ctx.moveTo(-260 + i * 17, 0);
    ctx.lineTo(-278 + i * 17, 15);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(272, 0);
  ctx.lineTo(238, -13);
  ctx.lineTo(246, 0);
  ctx.lineTo(238, 13);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  text(ctx, 'Nothing fires twice.', W / 2, 690, { size: 34, color: C.ink, alpha: 0.95, display: true });

  drawArcher(ctx, W / 2, 1030, t, { floating: true, pull: 0.5 + Math.sin(t * 0.8) * 0.5, scale: 1.35 });
  if (s.best > 0) text(ctx, `Best Legend   ${s.best}`, W / 2, 1112, { size: 22, color: C.gold, display: true });

  const book = ["Tuner's Book", 'Every Arrow you have loosed'];
  // 'The Covenant' and 'Auto Play' share their row as two half-width buttons (see
  // game.js's titleActionRects), so this row count and every earlier row's position never change.
  const labels = s.saved
    ? [['Continue', `Day ${s.saved.run.act ?? 1}  ·  Step ${s.saved.run.step + 1}  ·  ${s.saved.run.spent.length} spent`], ['New Run', 'Start over'], book, ['How to Play', 'and about this game'], ['The Covenant', 'Rules  ·  settings'], ['Auto Play', 'Watch it think']]
    : [['New Run', 'Take up the quiver'], book, ['How to Play', 'and about this game'], ['The Covenant', 'Rules  ·  settings'], ['Auto Play', 'Watch it think']];
  const rows = titleRects(labels.length - 1);
  const last = rows[rows.length - 1];
  const gap = 16;
  const half = (last.w - gap) / 2;
  const rects = [...rows.slice(0, -1), { x: last.x, y: last.y, w: half, h: last.h }, { x: last.x + half + gap, y: last.y, w: half, h: last.h }];
  const fullSize = labels.length - 1 >= 5 ? 24 : labels.length - 1 >= 4 ? 27 : 30;
  rects.forEach((r, i) => {
    const isHalfWidth = i >= rects.length - 2;
    button(ctx, r, labels[i][0], { size: isHalfWidth ? Math.min(fullSize, 22) : fullSize, sub: labels[i][1], primary: i === 0 });
  });
}

function drawMap(ctx, s, extra) {
  const DAYS = ['The First Day', 'The Second Day', 'The Third Day'];
  // the dots under the title already say which step; the title says which day (or the last door)
  header(ctx, s, s.run.step >= STEPS_PER_ACT ? 'The Last Door' : DAYS[s.run.act - 1]);
  statusRow(ctx, s, 226);
  tracked(ctx, 'Choose your road', W / 2, 426, { size: 20, color: C.muted, spacing: 4, weight: 600 });
  rule(ctx, W / 2, 446, 300);
  const doors = s.run.doors;
  choiceRects(doors.length).forEach((r, i) => {
    const door = doors[i];
    const info = DOOR_INFO[door.kind];
    const hot = s.ui.choice === i;
    panel(ctx, r, { hot });
    const el = door.encounter ? ENEMIES[door.encounter[0]].element : null;
    const cx = r.x + 92;
    const cy = r.y + r.h / 2;
    const col = el ? elementColor(el) : info.color;
    ctx.beginPath();
    ctx.arc(cx, cy, 52, 0, TAU);
    const mg = ctx.createRadialGradient(cx - 12, cy - 14, 4, cx, cy, 52);
    mg.addColorStop(0, alpha(col.startsWith('#') ? col : C.gold, 0.45));
    mg.addColorStop(1, '#080a22');
    ctx.fillStyle = mg;
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = goldFoil(ctx, cx - 52, cy - 52, cx + 52, cy + 52);
    ctx.stroke();
    if (el) glyph(ctx, el, cx, cy, 54, { width: 3.2, color: '#ffffff' });
    else icon(ctx, info.icon, cx, cy, 46, info.color, 3.2);
    const title = door.kind === 'boss' ? ENEMIES[door.encounter[0]].name : info.title;
    text(ctx, title, r.x + 172, r.y + 74, { size: 34, weight: 700, color: info.color, align: 'left', display: true });
    text(ctx, doorSub(door), r.x + 172, r.y + 116, { size: 21, color: C.inkSoft, align: 'left' });
    if (hot) text(ctx, 'tap again to enter', r.x + r.w - 30, r.y + r.h - 20, { size: 16, color: C.goldLight, align: 'right' });
  });
  if (s.run.act === 3 && s.run.rivalQuiver) {
    tracked(ctx, "The Rival's quiver", W / 2, 1104, { size: 16, color: '#b9a6ff', spacing: 4, weight: 600 });
    drawRivalQuiver(ctx, s.run.rivalQuiver.map((a) => ({ ...a, fired: false })), W / 2 - 4 * 70, 1150, { horizontal: true });
  }
  if (extra.demo) text(ctx, `Demo  ·  ${extra.demoLeft} battle${extra.demoLeft === 1 ? '' : 's'} left`, W / 2, 1270, { size: 20, color: C.muted });
  confirmButton(ctx, 'Enter', s.ui.choice >= 0);
  bottomBar(ctx, s, false);
}

function drawBattle(ctx, s) {
  const b = s.battle;
  const ui = s.ui;
  const t = s.t;
  const slots = enemySlots(b.enemies);
  const topIndex = ui.drag ? b.hand.findIndex((c) => c.uid === ui.drag.uid) : ui.sel;
  const sel = topIndex >= 0 ? b.hand[topIndex] : null;
  const selCard = sel ? CARDS[sel.id] : null;

  header(ctx, s, `Turn ${b.turn}`);

  // The Lure-Master is tied to each of its Lures by a slack, swaying gold thread.
  const master = b.enemies.findIndex((e) => e.shape === 'boss_lure' && !e.dead);
  if (master >= 0) {
    const from = slots[master];
    b.enemies.forEach((e, i) => {
      if (!e.decoy || e.dead) return;
      const to = slots[i];
      const sway = Math.sin(t * 1.7 + i * 2.1) * 26;
      const mx = (from.x + to.x) / 2 + sway;
      const my = (from.y + to.y) / 2 + 46 + Math.abs(sway) * 0.4;
      ctx.save();
      ctx.strokeStyle = alpha(C.gold, 0.7);
      ctx.shadowColor = C.gold;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y + from.r * 0.5);
      ctx.quadraticCurveTo(mx, my, to.x, to.y - to.r * 0.7);
      ctx.stroke();
      ctx.restore();
    });
  }

  // enemies
  const livingCount = b.enemies.filter((x) => !x.dead).length;
  b.enemies.forEach((e, i) => {
    if (e.dead) return;
    const p = slots[i];
    const bob = Math.sin(t * 1.6 + i * 1.3);
    contactShadow(ctx, p.x + p.r * 0.12, p.y + p.r * 1.3, p.r * (1.05 - bob * 0.06), p.r * 0.22, 0.42 - bob * 0.06);
    drawConstruct(ctx, e, p.x, p.y, p.r, t, { flash: ui.flash[i] ?? 0, targeted: ui.target === i && livingCount > 1 });
    intentBadge(ctx, e, p.x, p.y - p.r * 1.45 - 46, t);
    const bw = Math.max(110, p.r * 2.1);
    const shown = typeof ui.shownHp[i] === 'number' ? ui.shownHp[i] : e.hp;
    const by = p.y + p.r * 1.45 + 18;
    bar(ctx, p.x - bw / 2, by, bw, 16, shown / e.maxHp, C.damage, { colorTop: '#ffb3c0' });
    text(ctx, `${e.hp}`, p.x, by + 46, { size: 26, weight: 800, color: '#ffffff' });
    if (!e.decoy) text(ctx, e.name, p.x, by + 74, { size: 17, color: C.inkSoft, display: true });
    const chips = [];
    if (e.guard > 0) chips.push([`${e.guard}`, C.guard, 'guard']);
    if (e.strength > 0) chips.push([`+${Math.round(e.strength)}`, C.damage, 'dmg']);
    if (e.weak > 0) chips.push([`Weak ${e.weak}`, C.muted, null]);
    if (e.exposed > 0) chips.push([`Exp ${e.exposed}`, C.gold, null]);
    let sx = p.x - (chips.length * 74) / 2;
    for (const [label, color, ic] of chips) {
      if (ic) icon(ctx, ic, sx + 10, by - 16, 18, color, 2.2);
      text(ctx, label, sx + (ic ? 24 : 0), by - 9, { size: 19, weight: 800, color, align: 'left' });
      sx += 74;
    }
  });

  // quiet the landscape behind the hand so cards and numbers read cleanly
  const floor = ctx.createLinearGradient(0, 960, 0, 1240);
  floor.addColorStop(0, 'rgba(4, 5, 16, 0)');
  floor.addColorStop(1, 'rgba(4, 5, 16, 0.78)');
  ctx.fillStyle = floor;
  ctx.fillRect(0, 960, W, H - 960);

  // the Rival's quiver is face-up: nine Arrows, two glowing
  const rival = b.enemies.find((e) => e.quiver && !e.dead);
  if (rival) {
    panel(ctx, { x: 596, y: 206, w: 108, h: 30 + rival.quiver.length * 42 + 8 }, { r: 16, ornaments: false });
    text(ctx, 'QUIVER', 650, 226, { size: 13, weight: 700, color: C.muted, display: true });
    drawRivalQuiver(ctx, rival.quiver, 650, 262, { broken: rival.covenantBroken });
  }

  // the ring, lit for the chosen card and the targeted attack
  const targetEnemy = b.enemies[ui.target];
  const against = targetEnemy && !targetEnemy.dead && targetEnemy.intent?.type === 'attack' ? targetEnemy.intent.element : null;
  drawRing(ctx, RING.x, RING.y, RING.r, ELEMENTS, { from: selCard?.element ?? null, against });

  // the archer and their state
  const p = b.player;
  contactShadow(ctx, ARCHER.x + 14, ARCHER.y + 150, 120, 26, 0.4);
  drawArcher(ctx, ARCHER.x, ARCHER.y, t, { floating: s.run.unblemished, pull: ui.pull });
  if (p.guard > 0) {
    ctx.save();
    ctx.strokeStyle = C.guard;
    ctx.shadowColor = C.guard;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(ARCHER.x, ARCHER.y - 90, 128, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
    ctx.restore();
    icon(ctx, 'guard', ARCHER.x - 132, ARCHER.y - 170, 30, C.guard, 2.8);
    text(ctx, `${p.guard}`, ARCHER.x - 110, ARCHER.y - 158, { size: 34, weight: 800, color: C.guard, align: 'left' });
  }

  text(ctx, 'RESOLVE', RESOLVE_BAR.x, RESOLVE_BAR.y - 10, { size: 14, weight: 700, color: C.muted, align: 'left', display: true });
  text(ctx, `${p.resolve} / ${p.maxResolve}`, RESOLVE_BAR.x + RESOLVE_BAR.w, RESOLVE_BAR.y - 9, { size: 22, weight: 800, align: 'right', color: '#ffffff' });
  bar(ctx, RESOLVE_BAR.x, RESOLVE_BAR.y, RESOLVE_BAR.w, RESOLVE_BAR.h, ui.shownResolve / p.maxResolve, C.damage, { colorTop: '#ffb3c0' });
  const tags = [];
  if (p.aim > 0) tags.push(`Aim +${p.aim}`);
  if (p.weak > 0) tags.push(`Weak ${p.weak}`);
  if (p.exposed > 0) tags.push(`Exposed ${p.exposed}`);
  if (p.snared > 0) tags.push('Snared');
  const dueSoon = b.debtsDue.filter((d) => !d.done).length;
  if (dueSoon) tags.push(`${dueSoon} Debt${dueSoon > 1 ? 's' : ''} coming due`);
  if (tags.length) text(ctx, tags.join('   ·   '), W / 2, RESOLVE_BAR.y - 40, { size: 19, weight: 600, color: dueSoon ? C.damage : C.goldLight });

  // Focus gems
  text(ctx, 'FOCUS', FOCUS.x, FOCUS.y - 34, { size: 14, weight: 700, color: C.muted, display: true });
  const gems = Math.max(B.BASE_FOCUS, p.focus);
  for (let i = 0; i < gems; i++) {
    const gy = FOCUS.y + i * 46;
    const on = i < p.focus;
    diamond(ctx, FOCUS.x, gy, 17);
    const gg = ctx.createRadialGradient(FOCUS.x - 5, gy - 6, 1, FOCUS.x, gy, 18);
    gg.addColorStop(0, on ? '#fff3cf' : '#20254e');
    gg.addColorStop(1, on ? C.goldDeep : '#0a0c24');
    ctx.fillStyle = gg;
    if (on) {
      ctx.shadowColor = C.gold;
      ctx.shadowBlur = 14;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = on ? C.goldLight : alpha(C.gold, 0.35);
    ctx.stroke();
  }

  // detail panel: the chosen card's full text at a size a phone can read
  if (selCard) {
    panel(ctx, DETAIL, { edge: elementColor(selCard.element), r: 20, ornaments: false });
    const isArrow = selCard.kind === 'arrow';
    text(ctx, selCard.name, DETAIL.x + 26, DETAIL.y + 42, { size: 27, weight: 700, align: 'left', display: true });
    text(ctx, isArrow ? 'ARROW  ·  spent when loosed' : 'TECHNIQUE  ·  returns', DETAIL.x + DETAIL.w - 26, DETAIL.y + 40, { size: 15, weight: 700, align: 'right', color: isArrow ? C.gold : C.steel, display: true });
    const answersNow = B.wouldAnswer(b, topIndex, ui.target);
    const beaten = selCard.element ? BEATS[selCard.element] : null;
    let line = describe(selCard);
    if (answersNow) line = `ANSWERS the attack${isArrow ? ' and ripostes for +50%' : ''}. ${line}`;
    else if (beaten && !selCard.fx.ward) line = `${line} ${ELEMENT_NAMES[selCard.element]} ${BEAT_VERBS[selCard.element]} ${ELEMENT_NAMES[beaten]}.`;
    paragraph(ctx, line, DETAIL.x + 26, DETAIL.y + 78, DETAIL.w - 52, { size: 21, align: 'left', color: answersNow ? C.good : C.inkSoft, lineH: 1.25 });
  } else if (b.phase === 'player' && s.lock <= 0) {
    const coach = s.coach.key ? COACH[s.coach.key] : null;
    const hint = coach ?? (b.turn === 1 ? 'Press a card and pull it down like a bowstring' : 'Read the intent.  Answer it, or spend a legend.');
    const rect = coach ? { x: 40, y: DETAIL.y + 6, w: W - 80, h: 104 } : { x: 70, y: DETAIL.y + 30, w: W - 140, h: 60 };
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, coach ? 22 : 30);
    ctx.fillStyle = 'rgba(6, 8, 24, 0.8)';
    ctx.fill();
    ctx.lineWidth = coach ? 1.6 : 1;
    ctx.strokeStyle = alpha(C.gold, coach ? 0.7 : 0.3);
    ctx.stroke();
    if (coach) paragraph(ctx, hint, W / 2, rect.y + 42, rect.w - 60, { size: 21, color: C.goldLight, lineH: 1.3, display: true });
    else text(ctx, hint, W / 2, DETAIL.y + 68, { size: 20, color: C.inkSoft, display: true });
  }

  // hand
  const order = b.hand.map((_, i) => i);
  if (topIndex >= 0) order.push(order.splice(topIndex, 1)[0]);
  for (const i of order) {
    const inst = b.hand[i];
    const pos = ui.cardPos[inst.uid];
    if (!pos) continue;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    // a raised card throws a longer shadow down and to the right
    const lift = Math.max(0, pos.scale - 0.9);
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.rotate(pos.rot);
    ctx.scale(pos.scale, pos.scale);
    ctx.fillStyle = 'rgba(0,0,8,0.55)';
    roundRect(ctx, -CARD_W / 2 + 8 + lift * 40, -CARD_H / 2 + 12 + lift * 60, CARD_W, CARD_H, 16);
    ctx.fill();
    ctx.restore();
    ctx.rotate(pos.rot);
    ctx.scale(pos.scale, pos.scale);
    const lit = i === topIndex;
    drawCard(ctx, inst.id, CARD_W, CARD_H, { t: t + i, lit, answers: lit && B.wouldAnswer(b, i, ui.target), unaffordable: !B.canPlay(b, i), dim: s.lock > 0 });
    ctx.restore();
  }
  if (ui.drag) {
    const ready = ui.pull >= 1;
    const pos = ui.cardPos[ui.drag.uid];
    if (pos) text(ctx, ready ? 'Release to loose' : 'Pull down', pos.x, pos.y - CARD_H * 0.62, { size: 22, weight: 700, color: ready ? C.good : C.goldLight, display: true, glow: 'rgba(0,0,0,0.9)' });
  }
  bottomBar(ctx, s, true);
}

function drawReward(ctx, s) {
  header(ctx, s, 'The Field Is Yours');
  const r = s.reward;
  panel(ctx, { x: 44, y: 226, w: W - 88, h: 170 }, { r: 22 });
  text(ctx, `+${r.marks} Marks`, W / 2, 292, { size: 40, weight: 800, color: C.goldLight, glow: alpha(C.gold, 0.5) });
  text(ctx, r.spent ? `You spent ${r.spent} Arrow${r.spent > 1 ? 's' : ''} here${r.wasted >= 8 ? `  ·  ${r.wasted} damage wasted` : ''}.` : 'You spent nothing. The quiver is whole.', W / 2, 348, { size: 22, color: r.spent ? C.inkSoft : C.good });
  const lines = [];
  if (r.bonus) lines.push(`${CARDS[r.bonus].name} joins your quiver`);
  for (const n of r.notes ?? []) lines.push(n);
  lines.forEach((ln, i) => text(ctx, ln, W / 2, 418 + i * 32, { size: 22, weight: 700, color: C.good, display: true, glow: alpha(C.good, 0.5) }));
  tracked(ctx, 'Take one for the quiver', W / 2, 500, { size: 22, color: C.goldLight, spacing: 4 });
  rule(ctx, W / 2, 524, 340);
  trioRects(r.cards.length).forEach((rect, i) => {
    ctx.save();
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2 - (s.ui.choice === i ? 26 : 0));
    drawCard(ctx, r.cards[i], rect.w, rect.h, { t: s.t + i, lit: s.ui.choice === i });
    ctx.restore();
  });
  confirmButton(ctx, 'Take', s.ui.choice >= 0);
  button(ctx, SECONDARY, `Take nothing   +${SKIP_REWARD_MARKS} Marks`, { size: 21, quiet: true });
}

function drawChoices(ctx, s, options, top, h, gap) {
  choiceRects(options.length, top, h, gap).forEach((r, i) => {
    const hot = s.ui.choice === i;
    panel(ctx, r, { hot, edge: options[i].danger && !hot ? alpha(C.damage, 0.7) : null });
    text(ctx, options[i].label, r.x + 40, r.y + r.h * 0.44, { size: 31, weight: 700, align: 'left', color: options[i].danger ? C.damage : C.ink, display: true });
    text(ctx, options[i].sub, r.x + 40, r.y + r.h * 0.74, { size: 20, align: 'left', color: C.inkSoft });
  });
}

function drawCamp(ctx, s, extra) {
  header(ctx, s, 'Camp');
  statusRow(ctx, s, 226);
  tracked(ctx, 'One thing, before the road goes on', W / 2, 426, { size: 19, color: C.muted, spacing: 3, weight: 600 });
  rule(ctx, W / 2, 446, 300);
  drawChoices(ctx, s, extra.campOptions(), 470, 164, 24);
  confirmButton(ctx, 'Do this', s.ui.choice >= 0);
  bottomBar(ctx, s, false);
}

function drawEnvoy(ctx, s) {
  const ev = EVENTS[s.envoy.event];
  header(ctx, s, ev.title);
  panel(ctx, { x: 44, y: 230, w: W - 88, h: 470 });
  icon(ctx, 'letter', W / 2, 300, 50, '#c4b3ff', 3);
  rule(ctx, W / 2, 352, 300);
  paragraph(ctx, ev.text, W / 2, 420, W - 190, { size: 28, lineH: 1.48, display: true });
  if (!s.envoy.outcome) {
    drawChoices(ctx, s, ev.options.map((o) => ({ label: o.label, sub: o.note, danger: (o.effect.standing ?? 0) < 0 })), ENVOY_TOP, ENVOY.h, ENVOY.gap);
    confirmButton(ctx, 'Decide', s.ui.choice >= 0);
    return;
  }
  const o = s.envoy.outcome;
  const lines = [];
  if (o.debt) lines.push(`You took a Debt: ${DEBTS[o.debt].name}.`);
  for (const id of o.lost) lines.push(`${CARDS[id].name} is gone.`);
  for (const id of o.gained) lines.push(`${CARDS[id].name} joins the quiver.`);
  for (const n of o.notes ?? []) lines.push(n);
  if (o.broke) lines.push('The Covenant is broken. Your Standing falls.');
  if (s.run.pending) lines.push('You must choose next.');
  if (!lines.length) lines.push('The road goes on.');
  lines.forEach((ln, i) => text(ctx, ln, W / 2, 820 + i * 56, { size: 27, color: ln.includes('Covenant') ? C.damage : C.ink, display: true }));
  confirmButton(ctx, 'Continue', true);
}

function drawTuner(ctx, s) {
  header(ctx, s, 'The Tuner');
  statusRow(ctx, s, 226);
  tracked(ctx, 'Every one of these is the only one', W / 2, 426, { size: 19, color: C.muted, spacing: 3, weight: 600 });
  rule(ctx, W / 2, 446, 300);
  const stock = s.door.stock ?? [];
  trioRects(stock.length, TUNER_TRIO_Y).forEach((rect, i) => {
    const item = stock[i];
    ctx.save();
    ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
    drawCard(ctx, item.id, rect.w, rect.h, { t: s.t + i, lit: s.ui.choice === i, dim: item.sold });
    ctx.restore();
    text(ctx, item.sold ? 'Sold' : `${item.price} Marks`, rect.x + rect.w / 2, rect.y + rect.h + 44, { size: 25, weight: 800, color: item.sold ? C.muted : s.run.marks >= item.price ? C.goldLight : C.damage });
  });
  const canRemove = !s.door.removed && s.run.marks >= REMOVE_PRICE && removableTechs(s.run).length > 1;
  button(ctx, TUNER_REMOVE, s.door.removed ? 'Technique removed' : `Remove a Technique  ·  ${REMOVE_PRICE} Marks`, { size: 23, disabled: !canRemove });
  confirmButton(ctx, 'Buy', s.ui.choice >= 0 && !stock[s.ui.choice]?.sold);
  // With nothing affordable the only move is to leave; say so, and make that button the obvious one.
  const cheapest = Math.min(...stock.filter((it) => !it.sold).map((it) => it.price), canRemove ? 0 : REMOVE_PRICE);
  const broke = s.run.marks < cheapest;
  if (broke) {
    text(ctx, `You have ${s.run.marks} Marks. Nothing here is affordable yet.`, W / 2, 1236, { size: 22, color: C.muted, weight: 600 });
    text(ctx, 'Tap Leave to go on. Marks come from fights and events.', W / 2, 1270, { size: 22, color: C.muted, weight: 600 });
  }
  button(ctx, SECONDARY, 'Leave', { size: 24, quiet: !broke, primary: broke });
}

function drawRunover(ctx, s) {
  const won = s.run.result === 'won';
  tracked(ctx, won ? 'The Day Is Won' : 'The Quiver Falls Silent', W / 2, 190, { size: 36, color: won ? C.goldLight : C.damage, spacing: 5, glow: alpha(won ? C.gold : C.damage, 0.6) });
  rule(ctx, W / 2, 222, 380, won ? C.gold : C.damage);
  text(ctx, 'LEGEND', W / 2, 290, { size: 18, weight: 700, color: C.muted, display: true });
  tracked(ctx, String(s.legend), W / 2, 400, { size: 110, weight: 800, spacing: 6, fill: goldFoil(ctx, 200, 300, 520, 400), glow: alpha(C.gold, 0.6) });
  if (s.legend >= s.best && s.legend > 0) text(ctx, 'A new best', W / 2, 446, { size: 22, color: C.goldLight, display: true });
  if (s.run.oath > 0) text(ctx, `Oath ${s.run.oath}  ·  ${OATHS[s.run.oath].name}`, W / 2, 466, { size: 18, color: C.muted, display: true });
  const arrowsLeft = s.run.deck.filter((c) => CARDS[c.id].kind === 'arrow').length;
  text(ctx, `${arrowsLeft} Arrows unspent   ·   Standing ${s.run.standing}/3   ·   ${s.run.debts.length} Debts owed`, W / 2, 500, { size: 21, color: C.inkSoft });

  (s.unlocked ?? []).forEach((line, i) => text(ctx, line, W / 2, 528 + i * 26, { size: 21, weight: 700, color: C.good, display: true, glow: alpha(C.good, 0.4) }));
  panel(ctx, { x: 44, y: 566, w: W - 88, h: 694 });
  tracked(ctx, 'The Spent', W / 2, 620, { size: 24, spacing: 5, color: C.goldLight });
  rule(ctx, W / 2, 644, 260);
  const spent = s.run.spent;
  if (!spent.length) text(ctx, 'Not one Arrow left your bow.', W / 2, 730, { size: 25, color: C.good, display: true });
  const shown = spent.slice(0, 12);
  shown.forEach((c, i) => {
    const y = 700 + i * 42;
    const card = CARDS[c.id];
    glyph(ctx, card.element, 96, y - 8, 24, { width: 2.2 });
    text(ctx, card.name, 126, y, { size: 22, weight: 700, align: 'left', display: true });
    text(ctx, c.where, W - 80, y, { size: 16, color: C.muted, align: 'right' });
  });
  if (spent.length > shown.length) text(ctx, `…and ${spent.length - shown.length} more`, W / 2, 700 + shown.length * 42, { size: 20, color: C.muted });
  confirmButton(ctx, 'New Run', true);
  button(ctx, SECONDARY, 'Share', { size: 24, quiet: true });
}

function drawDemoLimit(ctx, s) {
  tracked(ctx, 'One Arrow Oath', W / 2, 470, { size: 44, spacing: 7, fill: goldFoil(ctx, 120, 430, 600, 480), glow: alpha(C.gold, 0.6) });
  rule(ctx, W / 2, 504, 380);
  panel(ctx, { x: 56, y: 560, w: W - 112, h: 460 });
  paragraph(ctx, 'That is the end of the demo. The war goes on — three days, every Arrow, every Debt — in the full game on iPhone and Android.', W / 2, 660, W - 210, { size: 29, lineH: 1.5, display: true });
  const n = s.run ? s.run.spent.length : 0;
  text(ctx, `You spent ${n} Arrow${n === 1 ? '' : 's'}. Nothing fires twice.`, W / 2, 960, { size: 23, color: C.muted });
}

// ---------------------------------------------------------------- overlays
function shade(ctx) {
  ctx.fillStyle = C.shade;
  ctx.fillRect(0, 0, W, H);
}

// The Rules tab of the help overlay: an exhaustive systems reference, paginated. Additive to,
// and separate from, the brief HOW_TO_PLAY tips and the ABOUT lore text on the other two tabs.
// `scale` is the text-size stepper's current step (TEXT_SCALES[idx] ?? 1) — only text grows with
// it, never the demo card/ring art, so the illustrations stay a fixed size like the rest of the
// game's iconography.
function drawRulesPage(ctx, o, scale) {
  const page = RULES_REFERENCE[o.rulesPage % RULES_REFERENCE.length];
  rule(ctx, W / 2, 350, 380);
  // Shrinks to fit if a title would otherwise run past the panel at the top text-size step -
  // titles are kept short by content, but this is a hard guarantee against it ever bleeding out.
  const baseTitleSize = 30 * scale;
  let titleSize = baseTitleSize;
  ctx.font = font(titleSize, 700, true);
  const titleMax = W - 140;
  const titleW = ctx.measureText(page.title).width;
  if (titleW > titleMax) titleSize *= titleMax / titleW;
  text(ctx, page.title, W / 2, 396, { size: titleSize, weight: 700, color: C.goldLight, display: true });
  // Gap below the title scales with the CURRENT text-size step, not the title's own (possibly
  // shrunk) size - a long title that had to shrink to fit its width still needs the same room
  // below it as a short one at that step, or the gap collapses along with the shrink.
  let y = 396 + baseTitleSize * 1.5;
  if (page.demo === 'cards') {
    ctx.save();
    ctx.translate(W / 2 - 110, y + 116);
    drawCard(ctx, 'first_promise', CARD_W, CARD_H, { t: 0, lit: true });
    ctx.restore();
    ctx.save();
    ctx.translate(W / 2 + 110, y + 116);
    drawCard(ctx, 'reed', CARD_W, CARD_H, { t: 0.3, lit: true });
    ctx.restore();
    text(ctx, 'An Arrow', W / 2 - 110, y + 250, { size: 18, color: C.goldLight });
    text(ctx, 'A Technique', W / 2 + 110, y + 250, { size: 18, color: C.inkSoft });
    y += 300;
  } else if (page.demo === 'ring') {
    drawRing(ctx, W / 2, y + 74, 64, ELEMENTS, {});
    y += 176;
  }
  for (const line of page.lines) y += paragraph(ctx, line, W / 2, y, W - 190, { size: 27 * scale, color: C.inkSoft, lineH: 1.42 }) + 22 * scale;
  // The page indicator sits right below the actual content, not at a fixed y, so it can never be
  // overrun by a page's wrapped text growing taller at a bigger text-size step.
  text(ctx, `Page ${(o.rulesPage % RULES_REFERENCE.length) + 1} of ${RULES_REFERENCE.length}`, W / 2, y + 14, { size: 18, color: C.muted });
}

function drawInspect(ctx, id, t) {
  shade(ctx);
  ctx.save();
  ctx.translate(W / 2, 640);
  drawCard(ctx, id, 440, 654, { t, lit: true });
  ctx.restore();
  const card = CARDS[id];
  const note = card.kind === 'arrow' ? 'A named Arrow. Loose it and it is Spent for the rest of the run.' : 'A Technique. It returns to you, fight after fight.';
  paragraph(ctx, note, W / 2, 1060, W - 160, { size: 24, color: card.kind === 'arrow' ? C.goldLight : C.inkSoft, lineH: 1.4, display: true });
  text(ctx, 'tap to close', W / 2, 1200, { size: 20, color: C.muted });
}

function drawOverlay(ctx, s, extra) {
  const o = s.overlay;
  if (o.type === 'inspect') {
    drawInspect(ctx, o.id, s.t);
    return;
  }
  shade(ctx);
  if (o.type === 'help') {
    // Falls back to 1 for any out-of-range index (e.g. a save from a build with more steps).
    const scale = TEXT_SCALES[s.textScaleIdx] ?? 1;
    panel(ctx, { x: 36, y: SAFE_TOP + 40, w: W - 72, h: 1330 });
    // Text-size stepper: its own row above the title, so it never crowds the How to Play/About/
    // Rules tabs below it. Only body/title text is multiplied by `scale` — nav chrome, icons and
    // illustrations stay a fixed size, matching the rest of the game's own primitives.
    button(ctx, HELP_TEXT.dec, 'A−', { quiet: true, size: 24, disabled: s.textScaleIdx === 0 });
    button(ctx, HELP_TEXT.inc, 'A+', { quiet: true, size: 24, disabled: s.textScaleIdx === TEXT_SCALES.length - 1 });
    tracked(ctx, 'One Arrow Oath', W / 2, 200, { size: 30 * Math.min(scale, 1.15), spacing: 6, maxWidth: 380, fill: goldFoil(ctx, 160, 170, 560, 200), glow: alpha(C.gold, 0.5) });
    HELP_TABS.forEach((r, i) => button(ctx, r, ['How to Play', 'About', 'Rules'][i], { size: 22, primary: o.page === i, quiet: o.page !== i }));
    if (o.page === 0) {
      // Tips are paced HOWTO_PER_PAGE at a time (layout.js) and paginated with the same Back/Next
      // row Rules uses, so a bigger text-size step gets a shorter page instead of a cramped one.
      // The element-ring diagram gets its own final page (tipPages + 1) rather than riding on the
      // last tip page, where it would compete for room and could silently vanish at the top step.
      const tipPages = Math.ceil(HOW_TO_PLAY.length / HOWTO_PER_PAGE);
      const howtoPages = tipPages + 1;
      const pageIdx = o.howtoPage % howtoPages;
      let y = 356;
      if (pageIdx < tipPages) {
        const items = HOW_TO_PLAY.slice(pageIdx * HOWTO_PER_PAGE, pageIdx * HOWTO_PER_PAGE + HOWTO_PER_PAGE);
        const rowGap = 26 * scale;
        items.forEach((step) => {
          let titleSize = 27 * scale;
          const bodySize = 24 * scale;
          // Shrinks to fit if a title would otherwise run past the panel at the top text-size
          // step - the same hard guarantee drawRulesPage uses, so a title can never bleed out.
          ctx.font = font(titleSize, 700, true);
          const titleMax = W - 172 - 60;
          const titleW = ctx.measureText(step.title).width;
          if (titleW > titleMax) titleSize *= titleMax / titleW;
          const titleY = y + titleSize;
          const iconY = titleY - titleSize * 0.3;
          diamond(ctx, 112, iconY, 34);
          ctx.fillStyle = '#0a0c24';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = goldFoil(ctx, 78, iconY - 34, 146, iconY + 34);
          ctx.stroke();
          icon(ctx, step.icon, 112, iconY, 28, C.goldLight, 2.8);
          text(ctx, step.title, 172, titleY, { size: titleSize, weight: 700, align: 'left', color: C.goldLight, display: true });
          const bodyY = titleY + bodySize * 1.25;
          const bh = paragraph(ctx, step.text, 172, bodyY, W - 250, { size: bodySize, align: 'left', color: C.inkSoft, lineH: 1.36 });
          y = Math.max(bodyY + bh, iconY + 34) + rowGap;
        });
      } else {
        // Same hard-guarantee shrink-to-fit as every other single-line title in this overlay, plus
        // a gap below it that grows with the (possibly shrunk) size - a fixed +30/+190/+300 only
        // ever worked for the scale-1 title size and let a big title bleed into the tab row above.
        const baseRingTitleSize = 28 * scale;
        let ringTitleSize = baseRingTitleSize;
        ctx.font = font(ringTitleSize, 700, true);
        const ringTitleMax = W - 140;
        const ringTitleW = ctx.measureText('The element ring').width;
        if (ringTitleW > ringTitleMax) ringTitleSize *= ringTitleMax / ringTitleW;
        const titleY = y + Math.max(30, baseRingTitleSize * 0.6);
        text(ctx, 'The element ring', W / 2, titleY, { size: ringTitleSize, weight: 700, color: C.goldLight, display: true });
        const ringY = titleY + 160;
        drawRing(ctx, W / 2, ringY, 64, ELEMENTS, {});
        text(ctx, 'Each element beats the next one around the ring.', W / 2, ringY + 110, { size: 19, color: C.muted });
        y = ringY + 150;
      }
      text(ctx, `Page ${pageIdx + 1} of ${howtoPages}`, W / 2, y + 14, { size: 18, color: C.muted });
    } else if (o.page === 1) {
      // Version/credits get their own final page (paraPages + 1) rather than riding on the last
      // paragraph page — a long last paragraph plus that footer could together overflow at the
      // top text-size step, so they never have to compete with paragraph text for room.
      const paraPages = Math.ceil(ABOUT.length / ABOUT_PER_PAGE);
      const aboutPages = paraPages + 1;
      const pageIdx = o.aboutPage % aboutPages;
      rule(ctx, W / 2, 350, 380);
      let y = 410;
      if (pageIdx < paraPages) {
        const paras = ABOUT.slice(pageIdx * ABOUT_PER_PAGE, pageIdx * ABOUT_PER_PAGE + ABOUT_PER_PAGE);
        paras.forEach((para) => {
          const lead = !!para.lead;
          y += paragraph(ctx, para.text, W / 2, y, W - 170, { size: (lead ? 30 : 27) * scale, lineH: 1.44, color: lead ? C.goldLight : C.inkSoft, display: lead }) + 28 * scale;
        });
      } else {
        text(ctx, `Version ${extra.manifest?.version ?? ''}`, W / 2, y + 40, { size: 18, color: C.muted });
        text(ctx, CREDITS, W / 2, y + 74, { size: 17, color: C.muted });
        y += 74;
      }
      text(ctx, `Page ${pageIdx + 1} of ${aboutPages}`, W / 2, y + 30, { size: 18, color: C.muted });
    } else {
      drawRulesPage(ctx, o, scale);
    }
    button(ctx, PAGE_NAV.back, 'Back', { size: 26 });
    button(ctx, PAGE_NAV.next, 'Next', { size: 26, primary: true });
    button(ctx, CLOSE, 'Close', { size: 26, primary: true });
    return;
  }
  if (o.type === 'newrun') {
    const id = ARCHER_IDS[o.archer];
    const archer = ARCHERS[id];
    const open = s.meta.archers.includes(id);
    panel(ctx, NEWRUN.panel);
    tracked(ctx, 'Choose your road', W / 2, 290, { size: 34, spacing: 6, fill: goldFoil(ctx, 160, 250, 560, 290), glow: alpha(C.gold, 0.5) });
    rule(ctx, W / 2, 324, 380);
    text(ctx, 'WHO YOU ARE', W / 2, 398, { size: 15, weight: 700, color: C.muted, display: true });
    button(ctx, NEWRUN.archerPrev, '‹', { quiet: true, size: 48 });
    button(ctx, NEWRUN.archerNext, '›', { quiet: true, size: 48 });
    text(ctx, archer.name, W / 2, 500, { size: 34, weight: 700, color: open ? C.goldLight : C.muted, display: true });
    paragraph(ctx, open ? archer.blurb : `Locked. ${archer.unlock}`, W / 2, 552, W - 320, { size: 20, color: open ? C.inkSoft : C.damage, lineH: 1.3 });
    const arrows = archer.quiver.filter((c) => CARDS[c].kind === 'arrow').length;
    text(ctx, `${archer.quiver.length} cards  ·  ${arrows} Arrows`, W / 2, 690, { size: 19, color: C.muted });
    rule(ctx, W / 2, 740, 300);
    text(ctx, 'HOW HEAVY A VOW', W / 2, 800, { size: 15, weight: 700, color: C.muted, display: true });
    button(ctx, NEWRUN.oathPrev, '−', { quiet: true, size: 44, disabled: o.oath <= 0 });
    button(ctx, NEWRUN.oathNext, '+', { quiet: true, size: 40, disabled: o.oath >= s.meta.oaths - 1 });
    text(ctx, o.oath === 0 ? 'No extra vow' : `Oath ${o.oath}: ${OATHS[o.oath].name}`, W / 2, 900, { size: 27, weight: 700, display: true });
    paragraph(ctx, OATHS[o.oath].text, W / 2, 946, W - 320, { size: 20, color: C.inkSoft, lineH: 1.3 });
    if (o.oath > 1) text(ctx, `and every vow before it`, W / 2, 1010, { size: 17, color: C.muted });
    const best = s.meta.best[o.oath];
    if (best) text(ctx, `Best Legend at this Oath: ${best}`, W / 2, 1052, { size: 19, color: C.gold, display: true });
    button(ctx, NEWRUN.begin, open ? 'Begin' : 'Locked', { size: 32, primary: open, disabled: !open });
    button(ctx, NEWRUN.cancel, 'Back', { size: 22, quiet: true });
    return;
  }
  if (o.type === 'confirmFoul') {
    panel(ctx, { x: 50, y: 480, w: W - 100, h: 780 }, { edge: C.damage });
    tracked(ctx, 'Break the Covenant?', W / 2, 570, { size: 31, color: C.damage, spacing: 4, glow: alpha(C.damage, 0.5) });
    rule(ctx, W / 2, 604, 360, C.damage);
    paragraph(ctx, `A Foul Shot deals ${Math.round(B.FOUL_FRACTION * 100)}% of the target's full health. It cannot be answered or guarded.`, W / 2, 690, W - 210, { size: 26, lineH: 1.45 });
    paragraph(ctx, s.run.unblemished ? 'You are Unblemished. Do this and you never will be again: the platform settles to the ground, and the extra first-turn card is gone for good.' : 'Your Standing will fall again. It does not return.', W / 2, 880, W - 210, { size: 23, color: C.goldLight, lineH: 1.45, display: true });
    button(ctx, CONFIRM, 'Break it', { danger: true, size: 30 });
    button(ctx, SECONDARY, 'Keep the Covenant', { size: 22, primary: true });
    return;
  }
  if (o.type === 'covenant') {
    panel(ctx, { x: 36, y: SAFE_TOP + 40, w: W - 72, h: 1300 });
    tracked(ctx, 'The Covenant', W / 2, 240, { size: 38, spacing: 7, fill: goldFoil(ctx, 160, 200, 560, 240), glow: alpha(C.gold, 0.5) });
    rule(ctx, W / 2, 276, 380);
    text(ctx, 'Five rules both sides swore before the first day.', W / 2, 336, { size: 22, color: C.inkSoft });
    COVENANT.forEach((ruleText, i) => {
      const y = 430 + i * 78;
      diamond(ctx, 116, y - 10, 20);
      ctx.fillStyle = '#0a0c24';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = goldFoil(ctx, 96, y - 30, 136, y + 10);
      ctx.stroke();
      text(ctx, `${i + 1}`, 116, y - 1, { size: 22, weight: 800, color: C.goldLight });
      text(ctx, ruleText, 164, y, { size: 28, align: 'left', display: true });
    });
    paragraph(ctx, 'Keep them and you stay Unblemished. Break one and you win the moment — and your Standing never comes back.', W / 2, 850, W - 200, { size: 22, color: C.inkSoft, lineH: 1.45 });
    const rects = choiceRects(4, COVENANT_BTN_TOP, COVENANT_BTN.h, COVENANT_BTN.gap).map((r) => ({ x: r.x + 50, y: r.y, w: r.w - 100, h: r.h }));
    button(ctx, rects[0], s.muted ? 'Sound: off' : 'Sound: on', { size: 26 });
    button(ctx, rects[1], s.meta.reduceMotion ? 'Motion: reduced' : 'Motion: full', { size: 26 });
    button(ctx, rects[2], 'Abandon this run', { size: 26, danger: true, disabled: !(s.run && !s.run.result && s.scene !== 'title') });
    button(ctx, rects[3], 'Close', { size: 26, primary: true });
    return;
  }
  if (o.type === 'options') {
    tracked(ctx, o.title, W / 2, 330, { size: 36, spacing: 6, color: C.goldLight, glow: alpha(C.gold, 0.5) });
    rule(ctx, W / 2, 364, 340);
    paragraph(ctx, o.text, W / 2, 430, W - 170, { size: 23, color: C.inkSoft, lineH: 1.4 });
    choiceRects(o.options.length, OPTIONS_TOP, OPTIONS.h, OPTIONS.gap).forEach((r, i) => {
      panel(ctx, r, { hot: !!o.options[i].act });
      text(ctx, o.options[i].label, r.x + 36, r.y + 54, { size: 28, weight: 700, align: 'left', display: true });
      text(ctx, o.options[i].sub, r.x + 36, r.y + 98, { size: 19, align: 'left', color: C.inkSoft });
    });
    button(ctx, CLOSE, 'Close', { size: 26, primary: true });
    return;
  }
  if (o.type === 'cards') {
    tracked(ctx, o.title, W / 2, 190, { size: 36, spacing: 6, color: C.goldLight, glow: alpha(C.gold, 0.5) });
    rule(ctx, W / 2, 222, 340);
    text(ctx, o.note, W / 2, 268, { size: 22, color: o.pick ? C.goldLight : C.inkSoft });
    ctx.save();
    ctx.beginPath();
    ctx.rect(GRID.x - 12, GRID.y - 12, GRID.w + 24, GRID.h + 24);
    ctx.clip();
    o.items.forEach((item, i) => {
      const col = i % GRID.cols;
      const row = Math.floor(i / GRID.cols);
      const x = GRID.x + col * GRID.cellW + GRID.cellW / 2;
      const y = GRID.y + row * GRID.cellH - o.scroll + GRID.cellH / 2;
      if (y < GRID.y - GRID.cellH || y > GRID.y + GRID.h + GRID.cellH) return;
      ctx.save();
      ctx.translate(x, y);
      drawCard(ctx, item.id, CARD_W, CARD_H, { t: s.t + i, dim: item.dim ?? !!item.note, lit: o.selected === item.uid });
      if (item.count > 0) {
        ctx.beginPath();
        ctx.arc(CARD_W / 2 - 10, -CARD_H / 2 + 14, 20, 0, TAU);
        ctx.fillStyle = '#0a0d22';
        ctx.fill();
        ctx.strokeStyle = C.gold;
        ctx.lineWidth = 2;
        ctx.stroke();
        text(ctx, `×${item.count}`, CARD_W / 2 - 10, -CARD_H / 2 + 21, { size: 18, weight: 800, color: C.goldLight });
      }
      ctx.restore();
    });
    ctx.restore();
    if (!o.items.length) text(ctx, 'Nothing here yet.', W / 2, 720, { size: 27, color: C.muted, display: true });
    if (o.pick === 'pending') button(ctx, CLOSE, 'Choose this one', { size: 26, primary: o.selected !== null, disabled: o.selected === null });
    else button(ctx, CLOSE, o.pick ? 'Cancel' : 'Close', { size: 26, primary: !o.pick });
    if (o.inspect !== null) drawInspect(ctx, o.inspect, s.t);
  }
}

// ---------------------------------------------------------------- effects
function drawFx(ctx, s) {
  for (const f of s.fx) {
    if (f.delay > 0) continue;
    const k = Math.min(1, f.t / f.dur);
    if (f.k === 'streak') {
      const head = ease(k);
      const tail = Math.max(0, head - 0.4);
      const hx = f.x0 + (f.x1 - f.x0) * head;
      const hy = f.y0 + (f.y1 - f.y0) * head;
      const tx = f.x0 + (f.x1 - f.x0) * tail;
      const ty = f.y0 + (f.y1 - f.y0) * tail;
      ctx.save();
      const sg = ctx.createLinearGradient(tx, ty, hx, hy);
      sg.addColorStop(0, alpha(f.color.startsWith('#') ? f.color : '#ffffff', 0));
      sg.addColorStop(1, '#ffffff');
      ctx.strokeStyle = sg;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 26;
      ctx.lineWidth = f.thick + 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(hx, hy, f.thick, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (f.k === 'num') {
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.55 : 1.15 - Math.min(0.15, (k - 0.15) * 0.6);
      text(ctx, f.text, f.x, f.y - ease(k) * 80, { size: f.size * pop, weight: 800, color: f.color, alpha: k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3, glow: 'rgba(0,0,0,0.95)' });
    } else if (f.k === 'ring') {
      ctx.save();
      ctx.strokeStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 20;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 7 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 24 + ease(k) * 140, 0, TAU);
      ctx.stroke();
      ctx.restore();
    } else if (f.k === 'shards' || f.k === 'burst') {
      const n = f.k === 'burst' ? 18 : 10;
      ctx.save();
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 14;
      ctx.globalAlpha = 1 - k;
      for (let i = 0; i < n; i++) {
        const a = (i * TAU) / n + 0.3 + (i % 2) * 0.2;
        const dist = (f.k === 'burst' ? 30 : 14) + ease(k) * (f.k === 'burst' ? 170 + (i % 3) * 40 : 70);
        const px = f.x + Math.cos(a) * dist;
        const py = f.y + Math.sin(a) * dist + (f.k === 'burst' ? k * k * 90 : 0);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(a + k * 5);
        diamond(ctx, 0, 0, (f.k === 'burst' ? 9 : 6) * (1 - k * 0.6));
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    } else if (f.k === 'ember') {
      const e = ease(k);
      const x = f.x0 + (f.x1 - f.x0) * e;
      const y = f.y0 + (f.y1 - f.y0) * e - Math.sin(k * Math.PI) * 140;
      ctx.save();
      ctx.globalAlpha = 1 - k * 0.5;
      ctx.fillStyle = C.goldLight;
      ctx.shadowColor = C.gold;
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(x, y, 8 * (1 - k * 0.5), 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (f.k === 'banner') {
      const a = k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      const by = 600;
      const bg = ctx.createLinearGradient(0, by, 0, by + 200);
      bg.addColorStop(0, 'rgba(4, 5, 16, 0)');
      bg.addColorStop(0.18, 'rgba(4, 5, 16, 0.92)');
      bg.addColorStop(0.82, 'rgba(4, 5, 16, 0.92)');
      bg.addColorStop(1, 'rgba(4, 5, 16, 0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, by, W, 200);
      rule(ctx, W / 2, by + 36, 520, f.color);
      rule(ctx, W / 2, by + 164, 520, f.color);
      tracked(ctx, f.title, W / 2, by + 102, { size: 36, color: f.color, spacing: 6, glow: alpha(f.color.startsWith('#') ? f.color : C.gold, 0.7) });
      text(ctx, f.sub, W / 2, by + 142, { size: 22, color: C.ink, display: true });
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- entry
export function render(ctx, view, s, extra) {
  setPress(s.ui.press ? { x: s.ui.press.x, y: s.ui.press.y } : null);
  const tintEnemy = s.scene === 'battle' && s.battle ? s.battle.enemies.find((e) => !e.dead && !e.decoy) : null;
  ctx.save();
  if (s.shake > 0) ctx.translate(Math.sin(s.t * 90) * s.shake, Math.cos(s.t * 70) * s.shake);
  const moonAt = s.scene === 'title' || s.scene === 'demo-limit' || s.scene === 'runover' ? { x: 570, y: 250, r: 78 } : { x: 74, y: 138, r: 38 };
  drawSky(ctx, extra.sky, s.t, tintEnemy && tintEnemy.element ? elementColor(tintEnemy.element) : null, moonAt, s.meta.reduceMotion);
  if (s.scene === 'title') drawTitle(ctx, s);
  else if (s.scene === 'map') drawMap(ctx, s, extra);
  else if (s.scene === 'battle' && s.battle) drawBattle(ctx, s);
  else if (s.scene === 'reward' && s.reward) drawReward(ctx, s);
  else if (s.scene === 'camp') drawCamp(ctx, s, extra);
  else if (s.scene === 'envoy' && s.envoy) drawEnvoy(ctx, s);
  else if (s.scene === 'tuner' && s.door) drawTuner(ctx, s);
  else if (s.scene === 'runover') drawRunover(ctx, s);
  else if (s.scene === 'demo-limit') drawDemoLimit(ctx, s);
  drawFx(ctx, s);
  ctx.restore();
  if (s.overlay) drawOverlay(ctx, s, extra);
  // every scene change fades in from the night
  if (s.fade > 0) {
    ctx.fillStyle = `rgba(3, 4, 12, ${Math.min(1, s.fade)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// ---------------------------------------------------------------- Auto Play (assisted learning)
// A private run (`A`) driven by rules/*.js directly, never s.run/s.battle. Its own layout, not the
// real screens': the real ones are built around a human's taps, which nothing needs here. Reuses
// the same drawing primitives (drawCard, drawConstruct, drawArcher, panel, bar, drawRing…) as the
// real scenes so a card, an enemy or the ring still look and read exactly the way play teaches you
// to recognise them — only the chrome around them (header, bottomBar, hand physics) is skipped.
function autoHud(ctx, s, A) {
  panel(ctx, AUTO_HUD, { r: 24 });
  tracked(ctx, 'Auto Play · Watch & Learn', W / 2, AUTO_HUD.y + 36, { size: 18, color: C.goldLight, spacing: 3, glow: alpha(C.gold, 0.5) });
  const thinking = A.phase === 'think';
  const caption = thinking ? 'Thinking…' : A.phase === 'over' ? (A.result === 'won' ? 'The day is won.' : 'The quiver falls silent.') : A.caption || '…';
  paragraph(ctx, caption, W / 2, AUTO_HUD.y + 70, AUTO_HUD.w - 200, { size: 21, weight: 700, color: C.ink, lineH: 1.2, display: true });
  button(ctx, AUTO_STEP_DEC, '−', { quiet: true, size: 28, disabled: s.autoThinkIdx === 0 });
  button(ctx, AUTO_STEP_INC, '+', { quiet: true, size: 24, disabled: s.autoThinkIdx === AUTO_THINK_STEPS.length - 1 });
  text(ctx, `Think time: ${AUTO_THINK_STEPS[s.autoThinkIdx]}s  (max ${AUTO_THINK_STEPS[AUTO_THINK_STEPS.length - 1]}s)`, W / 2, AUTO_HUD.y + 148, { size: 17, color: C.muted, weight: 600 });
}

function autoControls(ctx, A) {
  const canSkip = A.phase === 'think' || A.phase === 'reveal';
  button(ctx, AUTO_SKIP, 'Skip wait', { size: 23, quiet: !canSkip, disabled: !canSkip });
  button(ctx, AUTO_EXIT, 'Exit', { size: 23, primary: true });
}

function autoMap(ctx, A) {
  const doors = A.run.doors;
  const rects = autoListRects(doors.length);
  doors.forEach((door, i) => {
    const r = rects[i];
    const info = DOOR_INFO[door.kind];
    const hot = A.ui.choice === i && A.phase !== 'think';
    panel(ctx, r, { hot });
    const el = door.encounter ? ENEMIES[door.encounter[0]].element : null;
    const cx = r.x + 80;
    const cy = r.y + r.h / 2;
    if (el) glyph(ctx, el, cx, cy, 44, { width: 3, color: '#ffffff' });
    else icon(ctx, info.icon, cx, cy, 38, info.color, 3);
    const title = door.kind === 'boss' ? ENEMIES[door.encounter[0]].name : info.title;
    text(ctx, title, r.x + 148, r.y + r.h * 0.42, { size: 27, weight: 700, color: info.color, align: 'left', display: true });
    text(ctx, doorSub(door), r.x + 148, r.y + r.h * 0.72, { size: 18, color: C.inkSoft, align: 'left' });
  });
}

// Mirrors game.js's campOptions() — kept as its own small copy since Auto Play never touches the
// real s.run, so it cannot call the closure that reads it.
function autoCampOptions(run) {
  const list = [{ id: 'rest', label: 'Rest', sub: `Heal ${campHeal(run)} Resolve` }];
  if (removableTechs(run).length > 1) list.push({ id: 'drop', label: 'Lighten the quiver', sub: 'Remove one Technique for good' });
  if (run.debts.length) list.push({ id: 'settle', label: 'Settle a Debt', sub: 'Costs 5 maximum Resolve' });
  return list;
}

function autoCamp(ctx, A) {
  const options = autoCampOptions(A.run);
  const rects = autoListRects(options.length);
  options.forEach((o, i) => {
    const hot = A.ui.choice === i && A.phase !== 'think';
    panel(ctx, rects[i], { hot });
    text(ctx, o.label, rects[i].x + 40, rects[i].y + rects[i].h * 0.44, { size: 27, weight: 700, align: 'left', color: C.ink, display: true });
    text(ctx, o.sub, rects[i].x + 40, rects[i].y + rects[i].h * 0.74, { size: 19, align: 'left', color: C.inkSoft });
  });
}

function autoEnvoy(ctx, A) {
  const ev = EVENTS[A.envoy.event];
  tracked(ctx, ev.title, W / 2, AUTO_CONTENT_TOP + 26, { size: 24, color: C.goldLight, spacing: 3, glow: alpha(C.gold, 0.4) });
  rule(ctx, W / 2, AUTO_CONTENT_TOP + 46, 300);
  paragraph(ctx, ev.text, W / 2, AUTO_CONTENT_TOP + 92, W - 150, { size: 21, lineH: 1.35, display: true });
  const optTop = AUTO_CONTENT_TOP + 250;
  const remaining = 1404 - optTop;
  const gap = 16;
  const h = Math.min(130, (remaining - (ev.options.length - 1) * gap) / ev.options.length);
  const rects = autoListRects(ev.options.length, optTop, h, gap);
  ev.options.forEach((o, i) => {
    const hot = A.ui.choice === i && A.phase !== 'think';
    const danger = (o.effect.standing ?? 0) < 0;
    panel(ctx, rects[i], { hot, edge: danger && !hot ? alpha(C.damage, 0.7) : null });
    text(ctx, o.label, rects[i].x + 36, rects[i].y + rects[i].h * 0.4, { size: 23, weight: 700, align: 'left', color: danger ? C.damage : C.ink, display: true });
    text(ctx, o.note, rects[i].x + 36, rects[i].y + rects[i].h * 0.72, { size: 16, align: 'left', color: C.inkSoft });
  });
}

function autoTuner(ctx, A) {
  const stock = A.door.stock ?? [];
  const rects = autoTrioRects(stock.length);
  stock.forEach((item, i) => {
    const r = rects[i];
    const hot = A.ui.choice === i && A.phase !== 'think' && !A.leaving;
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    drawCard(ctx, item.id, r.w, r.h, { t: 0, lit: hot, dim: item.sold });
    ctx.restore();
    text(ctx, item.sold ? 'Sold' : `${item.price} Marks`, r.x + r.w / 2, r.y + r.h + 36, { size: 20, weight: 800, color: item.sold ? C.muted : A.run.marks >= item.price ? C.goldLight : C.damage });
  });
  if (A.leaving && A.phase !== 'think') text(ctx, 'Leaving the Tuner — nothing else is worth the Marks', W / 2, (rects[0]?.y ?? AUTO_CONTENT_TOP) + (rects[0]?.h ?? 0) + 84, { size: 20, color: C.goldLight, weight: 700, display: true });
}

function autoReward(ctx, A) {
  const r = A.reward;
  text(ctx, `+${r.marks} Marks`, W / 2, AUTO_CONTENT_TOP + 36, { size: 30, weight: 800, color: C.goldLight, glow: alpha(C.gold, 0.5) });
  const rects = autoTrioRects(r.cards.length, AUTO_CONTENT_TOP + 96);
  r.cards.forEach((id, i) => {
    const hot = A.ui.choice === i && A.phase !== 'think';
    ctx.save();
    ctx.translate(rects[i].x + rects[i].w / 2, rects[i].y + rects[i].h / 2 - (hot ? 18 : 0));
    drawCard(ctx, id, rects[i].w, rects[i].h, { t: 0, lit: hot });
    ctx.restore();
  });
}

function autoBattle(ctx, s, A) {
  const b = A.battle;
  const t = s.t;
  const slots = autoEnemySlots(b.enemies);
  b.enemies.forEach((e, i) => {
    if (e.dead) return;
    const p = slots[i];
    contactShadow(ctx, p.x, p.y + p.r * 1.3, p.r, p.r * 0.22, 0.4);
    drawConstruct(ctx, e, p.x, p.y, p.r, t, { targeted: A.ui.target === i && A.phase !== 'think' && b.enemies.length > 1 });
    intentBadge(ctx, e, p.x, p.y - p.r * 1.4 - 40, t);
    const bw = Math.max(100, p.r * 2);
    bar(ctx, p.x - bw / 2, p.y + p.r * 1.4 + 14, bw, 14, e.hp / e.maxHp, C.damage, { colorTop: '#ffb3c0' });
    text(ctx, `${e.hp}`, p.x, p.y + p.r * 1.4 + 44, { size: 20, weight: 800, color: '#ffffff' });
    if (!e.decoy) text(ctx, e.name, p.x, p.y + p.r * 1.4 + 66, { size: 15, color: C.inkSoft, display: true });
  });

  // A boss (or any single large enemy) has a taller name/HP block below it than the usual row — the
  // status line beneath must clear the tallest one actually on the field, not a fixed offset that
  // only worked for the common (smaller) enemies.
  const maxR = Math.max(60, ...slots.map((p) => p.r));
  const midY = Math.max(AUTO_CONTENT_TOP + 350, (AUTO_CONTENT_TOP + 150) + maxR * 1.4 + 156);
  text(ctx, `Turn ${b.turn}`, W / 2, midY - 44, { size: 19, weight: 700, color: C.muted, display: true });
  text(ctx, `RESOLVE ${b.player.resolve}/${b.player.maxResolve}   ·   FOCUS ${b.player.focus}   ·   GUARD ${b.player.guard}`, W / 2, midY, { size: 19, weight: 600, color: C.ink });
  if (A.caption && A.phase !== 'think') paragraph(ctx, A.caption, W / 2, midY + 46, W - 150, { size: 21, color: C.goldLight, lineH: 1.3, display: true });

  const hslots = autoHandSlots(b.hand.length);
  b.hand.forEach((inst, i) => {
    const pos = hslots[i];
    const lit = A.ui.sel === i && A.phase !== 'think';
    ctx.save();
    ctx.translate(pos.x, pos.y - (lit ? 22 : 0));
    drawCard(ctx, inst.id, pos.w, pos.w * (CARD_H / CARD_W), { t: t + i, lit, unaffordable: !B.canPlay(b, i) });
    ctx.restore();
  });
}

function autoOver(ctx, A) {
  const won = A.result === 'won';
  tracked(ctx, won ? 'The Day Is Won' : 'The Quiver Falls Silent', W / 2, AUTO_CONTENT_TOP + 40, { size: 30, color: won ? C.goldLight : C.damage, spacing: 4, glow: alpha(won ? C.gold : C.damage, 0.6) });
  rule(ctx, W / 2, AUTO_CONTENT_TOP + 68, 340, won ? C.gold : C.damage);
  text(ctx, 'LEGEND', W / 2, AUTO_CONTENT_TOP + 128, { size: 16, weight: 700, color: C.muted, display: true });
  tracked(ctx, String(A.legend ?? 0), W / 2, AUTO_CONTENT_TOP + 218, { size: 86, weight: 800, spacing: 5, fill: goldFoil(ctx, 200, AUTO_CONTENT_TOP + 140, 520, AUTO_CONTENT_TOP + 218), glow: alpha(C.gold, 0.6) });
  const arrowsLeft = A.run.deck.filter((c) => CARDS[c.id].kind === 'arrow').length;
  text(ctx, `${arrowsLeft} Arrows unspent   ·   Standing ${A.run.standing}/3   ·   ${A.run.debts.length} Debts owed`, W / 2, AUTO_CONTENT_TOP + 262, { size: 19, color: C.inkSoft });
  button(ctx, AUTO_AGAIN, 'Watch another run', { size: 27, primary: true });
}

export function renderAuto(ctx, s, A, extra) {
  drawSky(ctx, extra.sky, s.t, null, { x: 74, y: 138, r: 38 }, s.meta.reduceMotion);
  if (A.scene === 'map') autoMap(ctx, A);
  else if (A.scene === 'battle' && A.battle) autoBattle(ctx, s, A);
  else if (A.scene === 'reward' && A.reward) autoReward(ctx, A);
  else if (A.scene === 'camp') autoCamp(ctx, A);
  else if (A.scene === 'envoy' && A.envoy) autoEnvoy(ctx, A);
  else if (A.scene === 'tuner' && A.door) autoTuner(ctx, A);
  else if (A.scene === 'runover') autoOver(ctx, A);
  autoHud(ctx, s, A);
  autoControls(ctx, A);
  if (s.fade > 0) {
    ctx.fillStyle = `rgba(3, 4, 12, ${Math.min(1, s.fade)})`;
    ctx.fillRect(0, 0, W, H);
  }
}
