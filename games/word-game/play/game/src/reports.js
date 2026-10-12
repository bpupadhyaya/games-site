// Printable and shareable documents (hub audit O4 P3 Y4 Y6 T11): a progress report, a certificate, a weekly progress sheet, a study-word
// worksheet, a lesson plan, a homeschool log and a life-story book. Each one is a list of plain "blocks" built from a data object R, so the
// same content becomes a PDF (renderBlocks) or a text file (blocksText). Pure: nothing here reads the game, the clock or the screen.
import { createPdf, isoDate, longDate, pdfDate } from './pdf.js';

const pc = (f) => `${Math.round(f * 100)}%`;
const secs = (ms) => (ms ? `${(ms / 1000).toFixed(1)} s` : 'none yet');
const plural = (n, s) => `${n} ${s}${n === 1 ? '' : 's'}`;
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// ---- block builders -------------------------------------------------------------------------------------------------------------------
export function reportBlocks(R) {
  const st = R.stats, b = [
    { t: 'title', text: 'Progress report', sub: `${R.name}   -   ${longDate(R.day)}` },
    { t: 'p', text: `${R.levelLine}. This report is made on this device from the player's own practice. It is a guide to learning, not a test score or a certificate of any school.` },
    { t: 'h', text: 'At a glance' },
    { t: 'kv', rows: [
      ['Words met', String(st.met)], ['Words known reliably', String(st.reliable)],
      ['Answers right', st.right + st.wrong ? `${pc(st.acc)} of ${st.right + st.wrong}` : 'none yet'], ['Average answer time', secs(st.avgMs)],
      ['Days played this week', `${st.daysWeek} of 7`], ['Current streak', plural(st.streak, 'day')], ['Due for review today', String(st.due)],
      ...(R.est ? [['Estimated vocabulary', `about ${R.est.total} words (likely ${R.est.lo} to ${R.est.hi})`]] : []),
    ] },
    { t: 'h', text: 'How well the words are known' },
    { t: 'bars', rows: R.stages.map((s) => [`${cap(s.k)}: ${s.n}`, R.stageMax ? s.n / R.stageMax : 0]) },
  ];
  if (R.facets?.some((f) => f.words > 0)) {
    b.push({ t: 'h', text: 'Ways of knowing a word' },
      { t: 'p', text: 'Knowing a word has several sides. Each is practised and scheduled on its own.' },
      { t: 'table', head: ['Way of knowing', 'Words practised', 'Right', 'Answer time', 'Due now'], widths: [58, 34, 28, 30, 28], rows: R.facets.map((f) => [f.name, String(f.words), f.words ? pc(f.acc) : '-', f.words ? secs(f.avgMs) : '-', String(f.due)]) });
  }
  if (R.bands?.length) b.push({ t: 'h', text: 'By level' }, { t: 'bars', rows: R.bands.map((x) => [`${x.label}: ${x.known} of ${x.size}`, x.size ? x.known / x.size : 0]) });
  if (R.strands) b.push({ t: 'h', text: 'Balance this week' }, { t: 'bars', rows: R.strands.map((x) => [`${x.name}: ${x.n}`, R.strandMax ? x.n / R.strandMax : 0]) });
  if (R.sessions?.length) b.push({ t: 'h', text: 'Recent sessions' }, { t: 'table', head: ['Date', 'Kind', 'Right', 'Score'], widths: [40, 60, 40, 38], rows: R.sessions.slice(-10).reverse().map((s) => [isoDate(s.day), s.preset ?? 'play', `${s.right}/${s.n}`, String(s.score ?? '')]) });
  if (R.weak?.length) b.push({ t: 'h', text: 'Words to practise' }, { t: 'p', text: R.weak.slice(0, 24).join(', ') });
  b.push({ t: 'rule' }, { t: 'p', text: 'Made with Word Game. Stays on this device unless you share it.', small: true });
  return b;
}

export function sheetBlocks(R) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return [
    { t: 'title', text: 'My word week', sub: `${R.name}   -   week of ______________` },
    { t: 'p', text: `My goal: ${R.goal} answers a day. Colour a box each time I play. The words I want to learn this week are listed below.` },
    { t: 'table', head: ['Day', 'I played', 'Minutes', 'Words I learned', 'How it felt'], widths: [22, 28, 28, 70, 30], rowH: 11, rows: days.map((d) => [d, '', '', '', '']), boxes: [1] },
    { t: 'h', text: 'Words to learn' },
    { t: 'table', head: ['Word', 'What it means (in my words)', 'I can use it'], widths: [40, 100, 38], rowH: 9.5, rows: (R.set?.length ? R.set.slice(0, 6).map((w) => [w.w, '', '']) : Array.from({ length: 6 }, () => ['', '', ''])), boxes: [2] },
    { t: 'h', text: 'My best sentence this week' },
    { t: 'lines', n: 2 },
    { t: 'p', text: 'This week I am proud of: ____________________________________________', small: true },
  ];
}

export function worksheetBlocks(R) {
  const set = R.set ?? [];
  const b = [{ t: 'title', text: 'Word worksheet', sub: `${R.name}   -   ${longDate(R.day)}` }];
  if (!set.length) return [...b, { t: 'p', text: 'There are no words yet. Make a study set in the game, then make this sheet again.' }];
  const A = set.slice(0, 10);
  b.push({ t: 'h', text: '1. Match each word to its meaning' }, { t: 'p', text: 'Write the letter of the meaning next to the word.', small: true });
  const shifted = A.map((_, i) => A[(i + 3) % A.length]);                    // a fixed shuffle so the sheet is the same every time
  b.push({ t: 'table', head: ['Word', 'Letter', 'Meanings'], widths: [44, 22, 112], rowH: 10, rows: A.map((w, i) => [w.w, '____', `${String.fromCharCode(65 + i)}.  ${shifted[i].gloss}`]) });
  b.push({ t: 'h', text: '2. Cover, write, check' }, { t: 'p', text: 'Look at the word, cover it, write it, then check.', small: true },
    { t: 'table', head: ['Word', 'I wrote it', 'Right?'], widths: [50, 90, 38], rowH: 10, rows: A.slice(0, 8).map((w) => [w.w, '', '']), boxes: [2] });
  b.push({ t: 'h', text: '3. Use three of the words in sentences' }, { t: 'lines', n: 6 });
  const key = A.map((w) => `${w.w} = ${String.fromCharCode(65 + shifted.findIndex((x) => x === w))}`);
  b.push({ t: 'h', text: 'Answers' }, { t: 'p', small: true, text: key.join(',  ') });
  return b;
}

// Y4: a lesson plan from a word list. Activities are chosen by the learner's age group and use the actual words.
const ACTS = [
  { m: 5, t: 'Warm-up: what do we already know?', d: (w) => `Show the words (${w.slice(0, 4).join(', ')}...) one at a time. Learners say "I know it", "I have seen it" or "new to me". Mark the new ones.` },
  { m: 10, t: 'Meet the words', d: () => 'Read each word, its meaning and its example sentence aloud. Learners repeat the word. Ask for a gesture, a drawing or a first-language word that fits.' },
  { m: 10, t: 'Match and sort', d: (w) => `Cards with the words and cards with the meanings. Pairs match them. Then sort ${w.slice(0, 6).join(', ')} into groups they choose (feelings, actions, things, describing words).` },
  { m: 10, t: 'Spell it', d: () => 'Say, cover, write, check for each word. Learners mark the tricky letters in a different colour.' },
  { m: 10, t: 'Use it', d: (w) => `Each learner picks three words (for example ${w.slice(0, 3).join(', ')}) and writes one sentence for each. Share one sentence aloud.` },
  { m: 10, t: 'Word families and opposites', d: () => 'For each word, find a word from the same family (act, action, active) or an opposite. Use the Word explorer in the app to check.' },
  { m: 5, t: 'Exit ticket', d: () => 'Learners write one word they will use today and where they will use it.' },
];
export function lessonBlocks(R) {
  const set = R.set ?? [], names = set.map((w) => w.w);
  const level = R.levelLine ?? '';
  const b = [
    { t: 'title', text: R.listName ? `Lesson plan: ${R.listName}` : 'Lesson plan: vocabulary', sub: `${longDate(R.day)}   -   about ${ACTS.reduce((a, x) => a + x.m, 0)} minutes` },
    { t: 'h', text: 'Aims' },
    { t: 'li', items: [`Learners can say what each of the ${set.length} words means.`, 'Learners can spell the words and use them in a sentence of their own.', 'Learners notice how words are related (family, opposite, group).'] },
    { t: 'p', text: level, small: true },
    { t: 'h', text: 'Word list' },
    { t: 'table', head: ['Word', 'Meaning', 'Example'], widths: [32, 74, 72], rowH: 0, rows: set.map((w) => [w.w, w.gloss, w.ex || '']) },
    { t: 'h', text: 'Activities' },
    ...ACTS.flatMap((a, i) => [{ t: 'sub', text: `${i + 1}. ${a.t} (${a.m} min)` }, { t: 'p', text: a.d(names) }]),
    { t: 'h', text: 'Practice in the app' },
    { t: 'p', text: 'Study > Quiz me plays only these words. Speed round makes the words quicker to find. Write it asks for a sentence of your own. Nothing is sent anywhere: each learner\'s progress stays on their own device.' },
    { t: 'h', text: 'Check what was learned' },
    { t: 'p', text: 'Next lesson: say each word and ask for its meaning; learners write three sentences. Words that cause trouble return in the next list.' },
  ];
  return b;
}

// Y6: a homeschool tracking sheet. Real sessions are filled in; blank rows follow for other subjects.
export function homeschoolBlocks(R) {
  const rows = (R.logDays ?? []).map((d) => [isoDate(d.day), 'English vocabulary', String(d.mins), `Word Game: ${plural(d.n, 'question')}, ${d.right} right`, String(d.n), '']);
  const total = (R.logDays ?? []).reduce((a, d) => a + d.mins, 0);
  const blank = Array.from({ length: Math.max(4, 17 - rows.length) }, () => ['', '', '', '', '', '']);
  return [
    { t: 'title', text: 'Learning log', sub: `Student: ${R.name}      Month: ________________      Parent or teacher: ____________________` },
    { t: 'p', text: `English vocabulary this period: ${R.logDays?.length ?? 0} days, about ${total} minutes. Lines below are filled in from the game; add your own for other subjects.`, small: true },
    { t: 'table', head: ['Date', 'Subject', 'Min', 'What we did', 'Items', 'Initials'], widths: [24, 36, 14, 66, 16, 22], rowH: 9, rows: [...rows, ...blank] },
    { t: 'h', text: 'Skills I can show' },
    { t: 'checks', labels: ['Learned new words', 'Spelled them correctly', 'Used them in sentences', 'Read a passage', 'Wrote a short story'] },
    { t: 'p', text: 'Signature: ______________________      Date: ______________', small: true },
  ];
}
export function homeschoolCsv(R) {
  const q = (s) => { const t = String(s ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const rows = (R.logDays ?? []).map((d) => [d.day, isoDate(d.day), 'English vocabulary', d.mins, d.n, d.right, d.nw ?? 0].map(q).join(','));
  return ['day,date,subject,minutes,questions,right,new_words', ...rows].join('\n') + '\n';
}

// T11: the life-story journal as a small book.
export function journalBlocks(R) {
  const b = [{ t: 'title', text: 'My life in words', sub: `${R.name}   -   ${longDate(R.day)}` }];
  if (!R.journal?.length) return [...b, { t: 'p', text: 'No entries yet.' }];
  for (const e of R.journal) {
    b.push({ t: 'sub', text: `${longDate(e.day)}${e.w ? `   -   ${e.w}` : ''}` });
    if (e.prompt) b.push({ t: 'p', text: e.prompt, small: true, italic: true });
    b.push({ t: 'p', text: e.text });
  }
  return b;
}

// ---- renderers --------------------------------------------------------------------------------------------------------------------------
export function renderBlocks(blocks, { title = 'Word Game', day = 0, landscape = false } = {}) {
  const pdf = createPdf({ title, created: day ? pdfDate(day) : '', landscape });
  const M = 16, W = pdf.width - 2 * M, bottom = pdf.height - 18;
  let y = M, pageNo = 0;
  const newPage = () => {
    pdf.page(); pageNo += 1; y = M;
    pdf.text(pdf.width / 2, pdf.height - 8, `Word Game   -   page ${pageNo}`, { size: 8, align: 'center', color: '#667788' });
  };
  newPage();
  const need = (h) => { if (y + h > bottom) newPage(); };
  for (const b of blocks) {
    switch (b.t) {
      case 'title': {
        need(30); pdf.rect(0, 0, pdf.width, 3, { fill: '#15677c' });
        pdf.text(M, y + 9, b.text, { size: 22, bold: true, color: '#0b3145' }); y += 14;
        for (const l of pdf.wrap(b.sub ?? '', W, 11)) { pdf.text(M, y + 4, l, { size: 11, color: '#445566' }); y += 5.5; }
        pdf.line(M, y + 2, M + W, y + 2, { color: '#15677c', width: 0.6 }); y += 7; break;
      }
      case 'h': need(14); y += 3; pdf.text(M, y + 5, b.text, { size: 13, bold: true, color: '#0b3145' }); y += 8; break;
      case 'sub': need(12); y += 2; pdf.text(M, y + 4.5, b.text, { size: 11, bold: true }); y += 6.5; break;
      case 'p': {
        const size = b.small ? 9 : 10.5, lines = pdf.wrap(b.text, W, size), lh = size * 0.5;
        for (const l of lines) { need(lh + 1); pdf.text(M, y + lh * 0.8, l, { size, italic: b.italic, color: b.small ? '#445566' : '#111111' }); y += lh + 0.9; }
        y += 2; break;
      }
      case 'li': for (const it of b.items) { const lines = pdf.wrap(it, W - 6, 10.5); need(lines.length * 5.6); lines.forEach((l, i) => { if (i === 0) pdf.text(M + 1, y + 4, '-', { size: 10.5 }); pdf.text(M + 6, y + 4, l, { size: 10.5 }); y += 5.4; }); } y += 2; break;
      case 'kv': for (const [k, v] of b.rows) { need(7); pdf.text(M, y + 5, k, { size: 10.5, color: '#334455' }); pdf.text(M + W, y + 5, v, { size: 10.5, bold: true, align: 'right' }); pdf.line(M, y + 6.6, M + W, y + 6.6, { color: '#dde3e8', width: 0.2 }); y += 7; } y += 2; break;
      case 'bars': for (const [label, frac] of b.rows) {
        need(9); pdf.text(M, y + 3.6, label, { size: 9.5 });
        pdf.rect(M + 78, y + 0.8, W - 78, 4, { fill: '#e6edf2' }); if (frac > 0) pdf.rect(M + 78, y + 0.8, (W - 78) * Math.max(0.01, Math.min(1, frac)), 4, { fill: '#15677c' }); y += 7.5;
      } y += 1; break;
      case 'rule': need(6); pdf.line(M, y + 2, M + W, y + 2, { color: '#b8c4cc' }); y += 6; break;
      case 'gap': y += b.h ?? 6; break;
      case 'lines': for (let i = 0; i < b.n; i += 1) { need(10); pdf.line(M, y + 8, M + W, y + 8, { color: '#99a5ad', width: 0.25 }); y += 10; } y += 2; break;
      case 'checks': {
        need(10); let x = M;
        for (const l of b.labels) { const w = pdf.wrap(l, 60, 9.5)[0] ? 8 + l.length * 1.9 : 20; if (x + w > M + W) { x = M; y += 8; need(8); } pdf.rect(x, y + 1, 4.5, 4.5, { stroke: '#334455' }); pdf.text(x + 6.5, y + 4.8, l, { size: 9.5 }); x += w + 4; }
        y += 10; break;
      }
      case 'table': {
        const widths = b.widths, size = 9.5, pad = 1.6;
        const sum = widths.reduce((a, x) => a + x, 0), sc = W / sum, ws = widths.map((x) => x * sc);
        const drawRow = (cells, head) => {
          const wrapped = cells.map((c, i) => pdf.wrap(c, ws[i] - 2 * pad, size, head));
          const lh = size * 0.5 + 1, h = Math.max(b.rowH || 0, Math.max(...wrapped.map((l) => l.length)) * lh + 2 * pad - 1.2);
          need(h + 1);
          let x = M;
          if (head) pdf.rect(M, y, W, h, { fill: '#e3edf2' });
          cells.forEach((c, i) => {
            if (!head && b.boxes?.includes(i)) pdf.rect(x + pad, y + (h - 4.5) / 2, 4.5, 4.5, { stroke: '#334455' });
            else wrapped[i].forEach((l, k) => pdf.text(x + pad, y + pad + lh * (k + 0.8), l, { size, bold: head }));
            x += ws[i];
          });
          pdf.line(M, y + h, M + W, y + h, { color: '#aab6be', width: 0.25 });
          let xx = M; for (let i = 0; i <= widths.length; i += 1) { pdf.line(xx, y, xx, y + h, { color: '#aab6be', width: 0.25 }); xx += ws[i] ?? 0; }
          y += h;
        };
        need(10); pdf.line(M, y, M + W, y, { color: '#aab6be', width: 0.25 });
        drawRow(b.head, true);
        for (const r of b.rows) drawRow(r, false);
        y += 3; break;
      }
      default: break;
    }
  }
  return pdf.toString();
}

export function certificatePdf({ name, line, detail, day }) {
  const pdf = createPdf({ title: 'Certificate', created: pdfDate(day), landscape: true });
  const W = pdf.width, H = pdf.height;
  pdf.page();
  pdf.rect(8, 8, W - 16, H - 16, { stroke: '#15677c', width: 1.6 });
  pdf.rect(12, 12, W - 24, H - 24, { stroke: '#ffd166', width: 0.7 });
  pdf.text(W / 2, 46, 'CERTIFICATE', { size: 38, bold: true, align: 'center', color: '#0b3145' });
  pdf.text(W / 2, 60, 'of progress in words', { size: 16, italic: true, align: 'center', color: '#445566' });
  pdf.text(W / 2, 82, 'This certificate is given to', { size: 12, align: 'center', color: '#445566' });
  pdf.text(W / 2, 104, name || 'A word learner', { size: 30, bold: true, align: 'center', color: '#15677c' });
  pdf.line(W / 2 - 70, 108, W / 2 + 70, 108, { color: '#ffd166', width: 0.8 });
  let y = 124; for (const l of pdf.wrap(line, W - 80, 15)) { pdf.text(W / 2, y, l, { size: 15, align: 'center' }); y += 8; }
  for (const l of pdf.wrap(detail ?? '', W - 90, 11)) { pdf.text(W / 2, y + 2, l, { size: 11, align: 'center', color: '#445566' }); y += 6; }
  pdf.text(W / 2 - 70, H - 32, longDate(day), { size: 11, align: 'center' }); pdf.line(W / 2 - 100, H - 36, W / 2 - 40, H - 36, { color: '#888888', width: 0.3 });
  pdf.text(W / 2 + 70, H - 32, 'Signed', { size: 11, align: 'center', color: '#888888' }); pdf.line(W / 2 + 40, H - 36, W / 2 + 100, H - 36, { color: '#888888', width: 0.3 });
  pdf.text(W / 2, H - 18, 'Word Game. A personal record made on this device; not an award from any school or exam body.', { size: 8, align: 'center', color: '#667788' });
  return pdf.toString();
}
// The certificate wording follows what the player really did.
export function certificateFor(R) {
  const n = R.stats.reliable, met = R.stats.met;
  if (n >= 1000) return { line: `has learned to know ${n} words well`, detail: 'A thousand words is a real library. Keep going.' };
  if (n >= 250) return { line: `has learned to know ${n} words well`, detail: `${met} words met, ${pc(R.stats.acc)} of answers right.` };
  if (n >= 50) return { line: `has learned to know ${n} words well`, detail: `${met} words met so far.` };
  if (R.stats.streak >= 7) return { line: `has practised words for ${R.stats.streak} days in a row`, detail: 'A little every day adds up.' };
  return { line: `has started learning words: ${met} met so far`, detail: 'Every word is a step.' };
}

export function blocksText(blocks) {
  const out = [];
  for (const b of blocks) {
    switch (b.t) {
      case 'title': out.push(b.text.toUpperCase(), b.sub ?? '', ''); break;
      case 'h': out.push('', b.text.toUpperCase()); break;
      case 'sub': out.push('', b.text); break;
      case 'p': out.push(b.text); break;
      case 'li': for (const it of b.items) out.push(`- ${it}`); break;
      case 'kv': for (const [k, v] of b.rows) out.push(`${k}: ${v}`); break;
      case 'bars': for (const [l, f] of b.rows) out.push(`${l}  ${'#'.repeat(Math.round(f * 20)).padEnd(20, '.')}`); break;
      case 'table': out.push(b.head.join(' | ')); for (const r of b.rows) out.push(r.join(' | ')); break;
      case 'lines': for (let i = 0; i < b.n; i += 1) out.push('______________________________________________'); break;
      case 'checks': out.push(b.labels.map((l) => `[ ] ${l}`).join('   ')); break;
      case 'rule': out.push('------------------------------'); break;
      default: break;
    }
  }
  return out.join('\n') + '\n';
}
