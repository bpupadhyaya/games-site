// Credits text of the 3D person layer, handed to About by the 3D presenter (web/view3d) once it has loaded vendor3d/LICENSES.md.
// Without the 3D layer (no WebGL) About simply has no such section.
import { ABOUT } from './content.js';
export const credits = { blocks: null, list: null };
// '## x' headings become section titles, other paragraphs are text; the title line is dropped.
export function setCredits(md) {
  const out = [{ title: '3D people and motion', p: [] }];
  for (const chunk of String(md).split(/\n\s*\n/)) {
    const t = chunk.trim();
    if (!t || /^#\s/.test(t)) continue;
    if (/^##\s/.test(t)) {
      const lines = t.split('\n');
      out.push({ title: lines[0].replace(/^##\s+/, ''), p: [] });
      const rest = lines.slice(1).join(' ').replace(/\s+/g, ' ').trim();
      if (rest) out[out.length - 1].p.push(rest);
    } else out[out.length - 1].p.push(t.replace(/\s*\n\s*/g, ' '));
  }
  const blocks = out.filter((b) => b.p.length);
  if (blocks.length) { credits.blocks = blocks; credits.list = ABOUT.concat(blocks); }
}
export const aboutList = () => credits.list || ABOUT;
