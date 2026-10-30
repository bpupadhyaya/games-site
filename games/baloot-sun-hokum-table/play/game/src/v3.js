// The hand-off between the flat game and the optional 3D presenter (web/view3d/presenter.js). Nothing here touches the sim.
// on      true while a WebGL scene draws the majlis (room, table, props and every card that lies on the table); the 2D layer then
//         draws only the HUD, your hand, buttons and the reading pages
// fade    0..1 while the 3D scene fades in
// cards   the cards the 2D view WOULD have drawn on the table this frame (trick, turned-up card, opponents' backs): the presenter lays them
//         on the table where the 2D layout put them. { card (-1 = back), x, y (top-left, virtual units), sc, rot, glow, dim, big, four }
// hero    the title screen's free rectangle for the 3D hero (virtual units)
// Without WebGL, with ?flat=1, in the Node tests or while the context is lost, `on` stays false and every screen is the flat 2D art.
export const v3 = { on: false, fade: 0, cards: [], hero: null, calm: false };
