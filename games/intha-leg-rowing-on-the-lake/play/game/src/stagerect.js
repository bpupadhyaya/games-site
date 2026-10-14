// Where the lake is shown on each screen (virtual units). Shared by the 2D backdrop and the 3D presenter so both frame the same area.
export function stageRectFor(st, L, w, h) {
  if (st.scene === 'play') return L.play.stage;
  if (st.scene === 'title') {
    const T = L.title;
    if (L.mode === 'wide') return { x: 0, y: 0, w: T.play.x - 24, h };
    return { x: 0, y: 0, w, h: T.hero.y + T.hero.h + 14 };
  }
  return { x: 0, y: 0, w, h };
}
