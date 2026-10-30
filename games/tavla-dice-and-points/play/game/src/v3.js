// The hand-off between the flat game and the optional 3D presenter (web/view3d/presenter.js). Nothing here touches the sim.
// on      true while a WebGL scene draws the board, pieces and dice (the 2D layer then draws only the HUD and labels)
// rec     what view.js recorded for the board this frame (pieces, glows, rings, mover); null on screens without a board
// tray    the dice tray this frame (rect, dice, cube); hero  the title's free art rectangle
// Without WebGL, with ?flat=1, in the Node tests or while the context is lost, `on` stays false and every screen is the flat art.
export const v3 = { on: false, fade: 0, rec: null, tray: null, hero: null };
