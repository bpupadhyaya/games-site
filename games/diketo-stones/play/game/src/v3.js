// Hand-off between the 2D layer and the optional lit 3D scene that main.js may put behind the 2D canvas (web/view3d).
// Presentation only: the sim, the rules and the saves never read this object.
//   on     the lit scene exists, has a live WebGL context and is showing (set by the presenter)
//   frame  what the 2D layer drew this frame (stones, throwing stone, hole size) in world units (same coordinates as sim.js)
//   setup  set by the presenter: places the camera for this frame and returns the world -> virtual-unit affine for the overlays
export const v3 = { on: false, frame: null, setup: null, scene: '' };

// Enter the yard's world space on `ctx`: the flat 2D mapping, or (3D on) the affine that matches the tilted camera, so rings,
// routes, badges and particles still land exactly on the lit stones. Returns the local scale (units on screen per world unit).
export function applyView(ctx, ox, oy, s, mode = 'play') {
  v3.frame = { ox, oy, s, mode, pitR: 0, items: [], ghos: [] };
  const m = v3.on && v3.setup ? v3.setup(v3.frame) : null;
  if (m) { ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]); return Math.hypot(m[0], m[1]); }
  ctx.translate(ox, oy); ctx.scale(s, s); return s;
}
