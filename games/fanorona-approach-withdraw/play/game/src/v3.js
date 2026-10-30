// The hand-off between the flat game and the optional 3D presenter (web/view3d/presenter.js). Nothing here touches the sim.
// on      true while a WebGL scene draws the baobab sunset, the board and the stones (the 2D layer then draws only the HUD and menus)
// fade    0..1 while the 3D scene fades in
// marks   rings / glows the 2D view asked for this frame: { x, y, r, rgb: 'r,g,b', a, dot } in canonical board units (the view's own board frame)
// hero    the title screen's free rectangle for the 3D hero (virtual units); heroDemo: the opening capture the title plays
// cv(cx, cy, lift)  screen point (virtual units) of a canonical board point through the 3D camera
// k       virtual px per canonical unit near the board centre (sizes the 2D arrows / badges that ride on the 3D board)
// pick(x, y, flip, tolFrac)  nearest board point to a screen tap through the 3D camera (-1 = none)
// Without WebGL, with ?flat=1, in the Node tests or while the context is lost, `on` stays false and every screen is the flat art.
export const v3 = { on: false, fade: 0, marks: [], hero: null, heroDemo: null, cv: null, k: 1, pick: null, area: null };
