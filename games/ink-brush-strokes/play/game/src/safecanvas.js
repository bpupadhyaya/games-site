// Tiny viewports (the live preview window on the About page, or a transient zero-size layout during rotation)
// produce negative radii. The canvas API throws on those, and one throw stops the whole frame loop (black screen).
// Clamp them instead so a frame can never abort.
const P = typeof CanvasRenderingContext2D !== 'undefined' ? CanvasRenderingContext2D.prototype : null;
const nn = (v) => (v > 0 ? v : 0);
if (P && !P.__safe) {
  P.__safe = true;
  const ell = P.ellipse, arc = P.arc, rr = P.roundRect, at = P.arcTo;
  P.ellipse = function (x, y, rx, ry, ...r) { return ell.call(this, x, y, nn(rx), nn(ry), ...r); };
  P.arc = function (x, y, rad, ...r) { return arc.call(this, x, y, nn(rad), ...r); };
  P.arcTo = function (a, b, c, d, rad) { return at.call(this, a, b, c, d, nn(rad)); };
  if (rr) P.roundRect = function (x, y, w, h, rad) {
    const f = (v) => (typeof v === 'number' ? nn(v) : v);
    return rr.call(this, x, y, w, h, Array.isArray(rad) ? rad.map(f) : f(rad));
  };
}
