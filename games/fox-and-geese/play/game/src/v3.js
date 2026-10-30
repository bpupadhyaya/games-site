// The hand-off between the flat game and the optional 3D presenter (web/view3d/presenter.js). Nothing here touches the sim.
// on      true while a WebGL scene draws the frozen clearing, the board and the pieces (the 2D layer then draws only the HUD and menus)
// fade    0..1 while the 3D scene fades in over the flat art
// marks   glows the 2D view asked for this frame: { i: point, rgb: 'r,g,b', a: 0..1 }
// hero    the title / board-look screens' free rectangle for the 3D hero (virtual units); over: the result portrait rectangle
// pt(i)   the screen point (virtual units) of board point i through the 3D camera: { x, y, s, hy } (hy = the height of a piece's head)
// Without WebGL, with ?flat=1, in the Node tests or while the context is lost, `on` stays false and every screen is the flat art.
export const v3 = { on: false, fade: 0, marks: [], hero: null, over: null, pt: null };
