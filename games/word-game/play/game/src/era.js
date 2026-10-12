// Era words and memory prompts (web/data/kb/era.json): the everyday words of each decade, each with a plain meaning and a question to talk about.
// Written with an AI tool and not yet reviewed by a person (design/ai-authored-review.md section 7). Installed by platform.js after the first frame.
let D = [];
export const install = (json) => { D = Array.isArray(json?.decades) ? json.decades.filter((d) => d && typeof d.id === 'string' && Array.isArray(d.words)) : []; };
export const decades = () => D;
export const decade = (id) => D.find((d) => d.id === id) ?? null;
export const ready = () => D.length > 0;
