// Pictures and text the 3D presenter hands to the 2D screens (read-only for the game): stills of the street for the Rules figures,
// and the credits text of the 3D layer for About. When they are missing (no WebGL), the 2D drawings are used.
export const snaps = new Map();           // name -> canvas
export const credits = { blocks: null };  // About blocks built from vendor3d/LICENSES.md

// Turn the layer's LICENSES.md into About blocks: '## x' is a heading, other paragraphs are text; the title line is dropped.
export function creditBlocks(md) {
  const out = [{ sp: 1 }, { h: '3D people and motion' }];
  for (const chunk of String(md).split(/\n\s*\n/)) {
    const t = chunk.trim();
    if (!t || /^#\s/.test(t)) continue;
    if (/^##\s/.test(t)) { out.push({ h: t.replace(/^##\s+/, '').split('\n')[0] }); const rest = t.split('\n').slice(1).join(' ').trim(); if (rest) out.push({ p: rest }); }
    else out.push({ p: t.replace(/\s*\n\s*/g, ' ') });
  }
  return out;
}
