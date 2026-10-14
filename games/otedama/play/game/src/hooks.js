// Extension point the optional 3D presenter (web/view3d/presenter.js) fills in. The simulation never reads anything back from here:
// `hands` is called by the play screen and the title hero with the geometry of the two hands and returns true when it drew the
// performer (false = the 2D hands in art.js are drawn instead).
export const hooks = { hands: null };
