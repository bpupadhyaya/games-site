// Extension points the optional 3D presenter (web/view3d/presenter.js) fills in. The simulation never reads anything back from here.
// scene(ctx, fig): draws the whole background of the play screen / title (courtyard, pit, athlete, clubs, trails) and returns true; false = use the 2D art.
// backdrop(ctx, w, h): draws a still courtyard picture behind the other screens and returns true; false = use the painted 2D backdrop.
export const hooks = { scene: null, backdrop: null };
