// Screens of the teaching system: the demo overlay, the in-play coach, the pause menu and the
// Controls page. Pure drawing (game.js owns the logic and the buttons).
import { W, H, GOLD, clamp, smooth, rr } from './stage.js';
import { font, SERIF, SANS, panel, button } from './ui.js';
import { demoCaption, hand, ripple, holdArc, dragTrail, dragPath, pill, coachStrip, icon, rich, richLines, stepRow, stepRowHeight, normStep, DARK, GOLD_HI } from './howto.js';

export const DEMO_SKIP = { x: W - 226, y: 30, w: 196, h: 68, label: '' };

// ---- demo overlay ------------------------------------------------------------------------------
export function renderDemo(ctx, { T, n, d, spec, dur, showKeys, cutAlpha = 0 }) {
  const H_ = T.howto, ch = H_.ch[n - 1];
  // progress
  ctx.fillStyle = 'rgba(12,4,10,0.6)'; ctx.fillRect(0, 0, W, 8);
  ctx.fillStyle = GOLD_HI; ctx.fillRect(0, 0, W * clamp(d.t / dur, 0, 1), 8);
  const cap = demoCaption(ctx, { kicker: `${H_.title}  ·  ${H_.watch}`, steps: ch.steps, active: d.step, kbd: showKeys && ch.kbd ? ch.kbd : null, y: 116, bottom: spec.capBottom, size: spec.compact ? 27 : 30 });
  // Labels stay clear of the caption panel
  for (const L of spec.labels?.(d) ?? []) pill(ctx, ch.labels[L.k] ?? L.k, L.x, spec.capBottom ? Math.min(L.y, cap.top - 44) : Math.max(L.y, cap.bottom + 44), L.tx, L.ty);
  // the hand and its effects
  const p = d.ptr, sinceUp = d.t - d.lastRelease, sinceDown = d.t - d.lastPress;
  for (const tp of d.taps) { const u = (d.t - tp.t) / 0.7; if (u > 0 && u < 1) ripple(ctx, tp.x, tp.y, u); }
  if (d.lastPress >= 0) {
    const vis = p.down ? 1 : clamp(1 - (sinceUp - 0.3) / 0.3, 0, 1), appear = smooth(clamp(sinceDown / 0.2, 0, 1));
    if (p.down && d.from) {
      let len = 0; for (let i = 1; i < d.path.length; i++) len += Math.hypot(d.path[i].x - d.path[i - 1].x, d.path[i].y - d.path[i - 1].y);
      if (len > 40) dragPath(ctx, d.path);
      else if (d.downT > 0.12) holdArc(ctx, p.x, p.y, d.downT / 2, spec.secs ? d.downT : null);
    }
    hand(ctx, p.x + (1 - appear) * 40, p.y + (1 - appear) * 60, { down: p.down && appear > 0.9, alpha: vis * (0.3 + 0.7 * appear) });
  }
  if (cutAlpha > 0) { ctx.fillStyle = `rgba(6,2,8,${cutAlpha})`; ctx.fillRect(0, 0, W, H); }
}

// ---- coaching in real play -----------------------------------------------------------------------
export function renderCoach(ctx, { T, n, coach, s, sceneT, t, doneFade, cs }) {
  const ch = T.howto.ch[n - 1];
  const stripA = clamp(Math.min(sceneT * 2, 7.5 - sceneT), 0, 1);
  if (stripA > 0) coachStrip(ctx, ch.short, coach.y ?? 1470, stripA, coach.dir);
  const h = doneFade < 1 ? coach.hand(s, cs) : null;
  if (!h) return;
  const a = clamp(Math.min(sceneT * 2, 1) * (1 - doneFade), 0, 1);
  const u = (t % 2.4) / 2.4;
  if (h.mode === 'tap') {
    const k = (t % 1.6) / 1.6, press = k > 0.5 && k < 0.7, hov = smooth(clamp(k / 0.5, 0, 1));
    if (k > 0.5) ripple(ctx, h.x, h.y, (k - 0.5) / 0.5);
    hand(ctx, h.x + (1 - hov) * 36, h.y + (1 - hov) * 56, { down: press, alpha: a * 0.95 });
  } else if (h.mode === 'hold') {
    holdArc(ctx, h.x, h.y, (t % 2) / 2, null);
    hand(ctx, h.x, h.y, { down: true, alpha: a * 0.95 });
  } else if (h.mode === 'drag') {
    const f = smooth(clamp(u / 0.65, 0, 1)), x = h.x + (h.to.x - h.x) * f, y = h.y + (h.to.y - h.y) * f;
    ctx.save(); ctx.globalAlpha = a; dragTrail(ctx, h.x, h.y, x, y); ctx.restore();
    hand(ctx, x, y, { down: true, alpha: a * 0.95 });
  }
}

// ---- pause menu --------------------------------------------------------------------------------
export function renderPause(ctx, { T, buttons, muted }) {
  ctx.fillStyle = 'rgba(6,2,8,0.72)'; ctx.fillRect(0, 0, W, H);
  // Panel height grew from 690 to fit the added Chapter Guide row below Leave (see game.js
  // pauseButtons) without moving Resume/How to play/Controls/Sound/Leave, which keep their exact
  // original positions.
  panel(ctx, 70, 420, W - 140, 792, 0.92);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff1cf'; ctx.font = font(60);
  ctx.fillText(T.howto.paused, W / 2, 520);
  for (const b of buttons) button(ctx, b, { primary: b.primary, size: b.size ?? 34 });
}

// ---- the Controls page -----------------------------------------------------------------------
// Draws the whole scrolling document and returns its height (game.js clamps the scroll with it).
// `scale` (from TEXT_SCALES, via the header "A-"/"A+" stepper - see game.js/ui.js TEXT_STEP) grows
// every body/heading font here; every panel height below is computed from the SAME scaled size that
// is later drawn with, so a page that fits at scale 1 keeps fitting - it just wraps into more, taller
// rows at the top step instead of clipping.
export function renderControls(ctx, { T, scroll, showKeys, scale = 1 }) {
  const H_ = T.howto, x = 40, w = W - 80;
  const S = (n) => Math.round(n * scale);
  const hScale = Math.min(scale, 1.15); // the big page title is already far above the target size; cap its own growth so a long heading can never crowd the canvas edges
  ctx.save(); ctx.translate(0, -scroll);
  let y = 150;
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff1cf'; ctx.font = font(Math.round(64 * hScale)); ctx.fillText(H_.controls, W / 2, y + 40); y += 84;
  // the legend
  ctx.fillStyle = 'rgba(14,5,12,0.62)';
  const legend = H_.legend.filter((_, i) => showKeys || i < 4);
  // headH must clear the TALLEST icon glyph drawn in the header row (the 'release' icon reaches
  // r*0.85 below its own centre, taller than its siblings) with real margin before the description
  // starts below it - found by actually rendering: RELEASE's icon (arrow + ground line) struck
  // through the first word of its own description ("Lift your finger.") at the old, tighter headH.
  const legSize = S(28), legLh = Math.round(legSize * 1.34), headSize = S(30), headH = S(72), descW = w - S(48);
  const lh = legend.map(([, txt]) => headH + richLines(ctx, txt, descW, legSize).length * legLh + S(18));
  const legendH = S(78) + lh.reduce((a, b) => a + b, 0);
  panel(ctx, x - 10, y, w + 20, legendH, 0.86);
  ctx.textAlign = 'center'; ctx.fillStyle = GOLD; ctx.font = font(22, SANS, 700); ctx.fillText(H_.legendHead.toUpperCase().split('').join(' '), W / 2, y + 44);
  let ly = y + S(66);
  const kinds = ['tap', 'hold', 'drag', 'release', 'key'];
  legend.forEach(([cmd, txt], i) => {
    if (kinds[i] === 'key') { rich(ctx, '[SPACE]', x + S(24), ly + S(34), descW, { size: headSize }); } else { icon(ctx, kinds[i], x + S(40), ly + S(20), S(28), { dir: 'right' }); rich(ctx, cmd, x + S(80), ly + S(30), descW - S(56), { size: headSize }); }
    rich(ctx, txt, x + S(24), ly + headH + S(2), descW, { size: legSize, lh: legLh, color: '#e8d3ac' });
    ly += lh[i];
  });
  y += legendH + S(40);
  // every chapter
  T.chapters.forEach((C, i) => {
    const ch = H_.ch[i];
    const stepSize = S(28), noteSize = S(28), noteLh = Math.round(noteSize * 1.34), kbdSize = S(26), kbdLh = Math.round(kbdSize * 1.34);
    const rowH = ch.steps.map((st) => stepRowHeight(ctx, st, w - 20, stepSize));
    // noteW/kbdW must subtract the SAME S()-scaled left offset the actual rich() draw call below
    // uses (x + S(30)) - leaving it as a fixed, unscaled margin let the wrap width outrun the real
    // remaining panel width at the top text-size step and run text off the right edge of the canvas.
    const noteW = w - S(30) - 20, kbdW = w - S(30) - S(30);
    const noteH = ch.note ? richLines(ctx, ch.note, noteW, noteSize).length * noteLh + S(8) : 0;
    const kbdH = showKeys && ch.kbd ? richLines(ctx, ch.kbd, kbdW, kbdSize).length * kbdLh + S(22) : 0;
    const h = S(92) + rowH.reduce((a, b) => a + b + S(6), 0) + noteH + kbdH + S(12);
    if (y - scroll < H + 40 && y - scroll + h > -40) {
      panel(ctx, x - 10, y, w + 20, h, 0.84);
      ctx.textAlign = 'left'; ctx.fillStyle = GOLD; ctx.font = font(S(30), SANS, 800); ctx.fillText(String(i + 1), x + S(24), y + S(62));
      // Shrink-to-fit: a one-line chapter title (e.g. "The Forest Years") drawn at the full S(44) ran
      // off the panel's right edge at the top text-size step - unlike the body/description text
      // (fixed by wrapping+panel-height math above), a single heading has nowhere to wrap to without
      // a second line changing the row's whole height math, so it shrinks only as far as it must to
      // stay on the panel, same principle as the page's own capped `hScale` above.
      ctx.fillStyle = '#fff1cf';
      const availTitleW = w - S(74) - 20;
      let chTitleSize = S(44);
      ctx.font = font(chTitleSize);
      const chTitleW = ctx.measureText(C.title).width;
      // The floor is a small FIXED pixel size, not S()-scaled: at the top text-size step a scaled
      // floor (e.g. S(22)) is itself too large to guarantee a fit for the longest titles paired with
      // a two-digit chapter number ("11  The War for Lanka" ran off the panel with a scaled floor).
      if (chTitleW > availTitleW) { chTitleSize = Math.max(24, Math.floor(chTitleSize * availTitleW / chTitleW)); ctx.font = font(chTitleSize); }
      ctx.fillText(C.title, x + S(74), y + S(62));
      let ry = y + S(84);
      ch.steps.forEach((st, k) => { stepRow(ctx, st, k, x + 6, ry, w - 20, { active: false, dim: false, size: stepSize, numbered: ch.steps.length > 1 }); ry += rowH[k] + S(6); });
      if (ch.note) { rich(ctx, ch.note, x + S(30), ry + S(26), noteW, { size: noteSize, lh: noteLh, color: '#d9c39a' }); ry += noteH; }
      if (kbdH) { ctx.strokeStyle = 'rgba(242,196,106,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + S(30), ry + S(6)); ctx.lineTo(x + w - 20, ry + S(6)); ctx.stroke(); rich(ctx, ch.kbd, x + S(30), ry + S(36), kbdW, { size: kbdSize, lh: kbdLh }); }
    }
    y += h + S(26);
  });
  ctx.restore();
  return y + 140;
}

export { DARK };
