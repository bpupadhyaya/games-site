// Plain-data hand-off between the 2D view and the optional 3D presenter (web/view3d). No DOM, no state changes in the sim.
// When `on` (WebGL ready), paintScene() records the scene it would paint ({ rect, spec, t }) instead of painting it, and only lays the
// time-of-day grade and vignette over the lit 3D picture. `fade` (0..1) cross-fades the flat painting out while the 3D scene comes in.
// Without WebGL, with ?flat=1, or while the context is lost, `on` stays false and every scene is the flat painting.
export const v3 = { on: false, fade: 0, kitCanvas: null, scene: null };
