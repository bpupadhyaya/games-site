// ARCFORGE brand: one small, quiet lockup on the title screen (the themed PNG from the brand kit). DOM-free: main.js loads the
// image and hands it over with setLockup(); until it loads (or if it is missing) nothing is drawn. Never recolours the game.
let lockup = null;
export const setLockup = (img) => { lockup = img; };

// Draws the lockup centred on (x, y), `w` units wide, quietly (low alpha).
export function drawLockup(ctx, x, y, w, alpha = 0.85) {
  if (!(lockup && lockup.width)) return;
  const h = (w * lockup.height) / lockup.width;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(lockup, x - w / 2, y - h / 2, w, h);
  ctx.restore();
}
