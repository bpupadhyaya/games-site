// The Chapter Guide: a scrollable reference for how each of the 13 chapters actually works (its
// mechanic, and how it is won or lost), plus the systems that carry across the whole journey
// (stars, unlocking, the Kishkindha ally bonus). Purely additive alongside the Controls page
// (teach.js): it never repeats or restyles that page, and reuses the same TAP/HOLD/DRAG/RELEASE
// vocabulary (via howto.js's rich(), so command words get the same gold treatment everywhere)
// instead of inventing a second one. Every chapter's real art comes from portraits.js - the same
// bust already used on its story card and its token on the road - so nothing here is a separate,
// invented icon set. Draws the whole document and returns its height, exactly like renderControls.
import { W, H, GOLD, clamp } from './stage.js';
import { font, SERIF, SANS, panel, paragraph } from './ui.js';
import { portrait } from './portraits.js';
import { rich, richLines } from './howto.js';

const PR = 56;                       // portrait radius used on this page
const PORT_TOP = 135 * (PR / 90), PORT_BOT = 112 * (PR / 90);   // portrait's own vertical reach (portraits.js)

function label(ctx, text, x, y, size = 21, maxW = Infinity) {
  // Shrink-to-fit against maxW: the letter-spaced caption ("M E C H A N I C") has nowhere
  // to wrap - it is meant to read as one word - so at the top text-size step it shrinks just
  // enough to stay inside the field's own column instead of running under the panel's border
  // (found by actually rendering "MECHANIC", the longest of these captions).
  const spaced = text.toUpperCase().split('').join(' ');
  ctx.textAlign = 'left'; ctx.fillStyle = GOLD;
  ctx.font = font(size, SANS, 700);
  const w0 = ctx.measureText(spaced).width;
  if (w0 > maxW) size = Math.max(14, Math.floor(size * maxW / w0));
  ctx.font = font(size, SANS, 700);
  ctx.fillText(spaced, x, y);
}

// One "LABEL / wrapped body" field. Returns the height it used. The label caption and the gap above
// the body are kept proportional to `size` (ratios tuned against the field's original 25px base:
// 28/25, 30/25, 8/25) so a bigger `size` (the text-size stepper) grows every part of a field together
// - fieldHeight (used to lay out the panel before anything is drawn) and drawField (which actually
// draws it) must always agree on the height a field takes, or a field could overlap the next one.
function fieldHeight(ctx, text, w, size) { return size * 1.12 + richLines(ctx, text, w, size).length * size * 1.34 + size * 0.32; }
function drawField(ctx, capt, text, x, y, w, size) {
  label(ctx, capt, x, y, Math.round(size * 0.84), w);
  const h = rich(ctx, text, x, y + size * 1.2, w, { size, lh: size * 1.34 });
  return size * 1.12 + h + size * 0.32;
}

// `scale` (from TEXT_SCALES, via the header "A-"/"A+" stepper - see game.js/ui.js TEXT_STEP) grows
// every body/heading font here; every panel height below is computed from the SAME scaled size that
// is later drawn with, so a page that fits at scale 1 keeps fitting - it just wraps into more, taller
// rows at the top step instead of clipping.
export function renderRules(ctx, { T, scroll, t = 0, scale = 1 }) {
  const R = T.rules, x = 40, w = W - 80;
  const S = (n) => Math.round(n * scale);
  const hScale = Math.min(scale, 1.15); // the big page title is already far above the target size; cap its own growth so a long heading can never crowd the canvas edges
  ctx.save(); ctx.translate(0, -scroll);
  let y = 150;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff1cf'; ctx.font = font(Math.round(64 * hScale)); ctx.fillText(R.title, W / 2, y + 40);
  // This gap was a fixed 84px - fine while the intro paragraph below was a similarly-fixed small
  // size, but once its own font (introSize) grows with `scale`, a fixed gap left the intro's first
  // line so close to the title that its ascenders overlapped the title's own descenders at the top
  // text-size step. Scale the gap the same way so it grows with the text it is actually clearing.
  y += S(84);

  const introSize = S(28), introLh = S(36);
  ctx.font = font(introSize, SERIF, 600); ctx.fillStyle = 'rgba(255,241,207,0.8)';
  y += paragraph(ctx, R.intro, W / 2, y + S(10), w - 60, introLh) + S(26);

  // ---- campaign-wide systems, one panel with a heading per section ----
  // Each section reserves: 30px down to its heading baseline, 36px more down to the body start,
  // the body's own wrapped height, then 30px of gap before the next heading (or the panel edge) -
  // all scaled together with the body text so the ratios (and the fit) hold at every text size.
  // secW must subtract the SAME S()-scaled left offset the draw call below uses (x + S(20)) - a
  // fixed, unscaled margin here let the wrap width outrun the real remaining panel width at the top
  // text-size step and run text off the right edge of the panel.
  const secSize = S(28), secW = w - S(20) - 20, secLh = Math.round(secSize * 1.34);
  const secH = R.campaign.map((c) => S(66) + richLines(ctx, c.t, secW, secSize).length * secLh + S(30));
  const campH = S(74) + secH.reduce((a, b) => a + b, 0) + S(16);
  panel(ctx, x - 10, y, w + 20, campH, 0.86);
  ctx.textAlign = 'center'; ctx.fillStyle = GOLD; ctx.font = font(S(23), SANS, 700);
  ctx.fillText(R.campaignHead.toUpperCase().split('').join(' '), W / 2, y + S(46));
  let sy = y + S(74);
  R.campaign.forEach((c, i) => {
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff1cf';
    // Shrink-to-fit: a one-line section heading (e.g. "The road opens one step at a time") drawn at
    // the full S(30) with no wrap or width check ran off the panel's right edge at the top text-size
    // step - same fix as the per-chapter titles above, for the same reason (a single heading has
    // nowhere to wrap to without changing this section's whole height math).
    let headSize = S(30);
    ctx.font = font(headSize);
    const headW = ctx.measureText(c.h).width;
    if (headW > secW) { headSize = Math.max(20, Math.floor(headSize * secW / headW)); ctx.font = font(headSize); }
    ctx.fillText(c.h, x + S(20), sy + S(30));
    rich(ctx, c.t, x + S(20), sy + S(66), secW, { size: secSize, lh: secLh, color: '#e8d3ac' });
    sy += secH[i];
  });
  y += campH + S(40);

  // ---- one panel per chapter: portrait + mechanic / win / lose / stars ----
  T.chapters.forEach((C, i) => {
    const ch = R.ch[i];
    const fieldSize = S(28);
    // contentW must mirror EVERY scaled term contentX adds (S(30) was missing here, letting field
    // text wrap assume more room than truly remained right of the portrait at the top text-size step).
    const contentX = x + S(30) + PR * 2 + S(24), contentW = w - 20 - (S(30) + PR * 2 + S(24)) - 20;
    // The portrait itself never scales with `scale` (it's a fixed illustration), so at the top text
    // step the fields' first line (y + S(92)) already starts well BELOW the portrait's own fixed
    // vertical reach - keeping every field squeezed into the narrow portrait-width column regardless
    // was real, measured overflow: ordinary 8-9 letter words ("judgement", "hermitage", "kingdom's")
    // ran off the panel's right edge because that column is barely 326px wide at the top step, plenty
    // for the small original font but not for an 84px one. Fix: once a field's own start position has
    // already cleared the portrait's bottom (fixed pixels, not scaled), give IT the full row width -
    // never shrinking the font, just stopping an unnecessary indent once there's nothing left beside.
    // The buffer (not just the portrait's own reach) has to clear the drawn text's ASCENT too - a
    // label/word drawn AT y=relY visually starts well above that baseline. A too-small buffer let
    // MECHANIC (the first field, which always starts close to this line) draw its own opening word
    // straight over the portrait's bottom corner (found by actually rendering it, at the top step,
    // for a chapter whose mechanic paragraph is short enough that relY was only barely past the
    // portrait's raw reach). 100px comfortably clears that for every field size this page uses.
    const fullX = x + S(20), fullW = w - S(20) - 20;
    const portraitBottomRel = 84 + PORT_TOP + 6 + PORT_BOT + 100; // relative to this panel's own y
    const widthAt = (relY) => (relY >= portraitBottomRel ? { cx: fullX, cw: fullW } : { cx: contentX, cw: contentW });
    const fields = [['Mechanic', ch.mechanic], ['Win', ch.win], ch.lose ? ['Lose', ch.lose] : null, ['Stars', ch.stars]].filter(Boolean);
    const fh = []; { let relY = S(92); for (const [, txt] of fields) { const fv = fieldHeight(ctx, txt, widthAt(relY).cw, fieldSize); fh.push(fv); relY += fv; } }
    const textH = fh.reduce((a, b) => a + b, 0);
    const portH = PORT_TOP + PORT_BOT + 30;
    const h = S(92) + Math.max(textH, portH) + S(20);
    if (y - scroll < H + 60 && y - scroll + h > -60) {
      panel(ctx, x - 10, y, w + 20, h, 0.84);
      ctx.textAlign = 'left'; ctx.fillStyle = GOLD; ctx.font = font(S(30), SANS, 800); ctx.fillText(String(i + 1), x + S(24), y + S(62));
      // Shrink-to-fit: a one-line chapter title (e.g. "The Forest Years") drawn at the full S(42) ran
      // off the panel's right edge at the top text-size step - a single heading has nowhere to wrap
      // to without a second line changing the row's whole height math, so it shrinks only as far as
      // it must to stay on the panel (same principle as the page's own capped `hScale` above).
      ctx.fillStyle = '#fff1cf';
      const availTitleW = w - S(74) - 20;
      let chTitleSize = S(42);
      ctx.font = font(chTitleSize);
      const chTitleW = ctx.measureText(C.title).width;
      // The floor is a small FIXED pixel size, not S()-scaled: at the top text-size step a scaled
      // floor (e.g. S(22)) is itself too large to guarantee a fit for the longest titles paired with
      // a two-digit chapter number ("11  The War for Lanka" ran off the panel with a scaled floor).
      if (chTitleW > availTitleW) { chTitleSize = Math.max(24, Math.floor(chTitleSize * availTitleW / chTitleW)); ctx.font = font(chTitleSize); }
      ctx.fillText(C.title, x + S(74), y + S(62));
      portrait(ctx, { who: C.portrait, x: x + 30 + PR, y: y + 84 + PORT_TOP + 6, r: PR, t });
      let fy = y + S(92), fyRel = S(92);
      fields.forEach(([capt, txt], k) => { const { cx, cw } = widthAt(fyRel); const used = drawField(ctx, capt, txt, cx, fy, cw, fieldSize); fy += used; fyRel += used; });
    }
    y += h + S(26);
  });

  ctx.restore();
  return y + 140;
}
