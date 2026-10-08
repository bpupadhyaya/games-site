// All the words: UI strings, How to Play, the exhaustive Rules, About. English only. Every rule here was checked against the engine
// (shapes.js folds and grid, game.js cutting, scoring and stars); the numbers quoted are the ones the code uses.

const STR = {
  title: 'Paper Cutting', subtitle: 'FOLD · SNIP · UNFOLD', tagline: 'Cut once, see it everywhere.',
  playBtn: 'Play', studioBtn: 'Studio', galleryBtn: 'Gallery', autoBtn: 'Watch & Learn', howtoBtn: 'How to Play', rulesBtn: 'Rules', aboutBtn: 'About', settingsBtn: 'Settings',
  back: 'Back', levels: 'Levels', gallery: 'Gallery', del: 'Delete', chapter: 'Chapter', locked: 'Finish 3 levels of the chapter before to open this one.', finished: 'finished', stars: 'Stars',
  foldPick: 'Fold the paper', foldDone: 'Folded', cutNow: 'Cut the wedge', hint: 'Hint', undo: 'Undo', clear: 'Clear', scissors: 'Scissors', punch: 'Punch',
  unfold: 'Unfold', refold: 'Refold', skip: 'Skip', turn: 'Turn', size: 'Size', changeFold: 'Change fold',
  paused: 'Paused', resume: 'Resume', restartLevel: 'Start this cut-out again', quitMenu: 'Main menu',
  done: 'Unfolded', nextLevel: 'Next level', again: 'Try again', backLevels: 'Levels', match: 'Match', cuts: 'Cuts', par: 'Par', pieces: 'Pieces',
  stars3: 'A perfect cut-out. Three stars.', stars2: 'A fine match. Two stars.', stars1: 'It is close. One star. Refold and tune it for more.', stars0: 'Not quite there yet. Refold and keep cutting.',
  autoSession: 'Watch & Learn finished', autoSummary: 'You saw how each cut is chosen: the ideas, the one that fits and the cut itself. Try the same levels yourself.',
  autoAgain: 'Watch again', autoExit: 'Back to menu', autoThink: 'Thinking', autoReveal: 'This cut', autoAct: 'Cutting', autoPaused: 'Paused', autoFold: 'Folding', autoUnfold: 'Unfolding',
  settings: 'Settings', soundOn: 'Sound: on', soundOff: 'Sound: off', thinkTime: 'Think time in Watch & Learn', seconds: ' s', textSize: 'Text size',
  unlock: 'Unlock full game', restore: 'Restore purchase', owned: 'Full game unlocked. Thank you!', resetProgress: 'Reset progress', resetConfirm: 'Tap again to erase all progress',
  demoLeft: '{n} lessons left in the web demo', demoLimitTitle: 'That is the web demo', demoLimitBody: 'The free web demo covers the first chapter. Get the full game on iPhone and Android for every level, Studio, the Gallery and all papers.',
  studioHint: 'Free cutting: pick a sheet, a paper and a fold, then snip and unfold. Save the ones you like to the Gallery.',
  save: 'Save', saved: 'Saved to the Gallery', galleryFull: 'The Gallery holds 12 cut-outs. Delete one first.', del: 'Delete', replay: 'Replay unfold', myCutouts: 'My cut-outs', traditions: 'Traditions',
  emptyGallery: 'Nothing saved yet. Make a cut-out in Studio and press Save.', solveToSee: 'Finish a level of this tradition to see its patterns here.',
  noCuts: 'Make at least one cut first', tooSmall: 'That snip is too small', onPaper: 'Punch on the paper', maxCuts: 'That is the most cuts a sheet can take',
  sheet: 'Sheet', paper: 'Paper', hintCut: 'Hint: a ghost shows the next cut', foldHint: 'This level works best folded {f}',
};

export const tr = (k, v) => {
  let s = STR[k] ?? k;
  if (v) for (const key of Object.keys(v)) s = s.replace(`{${key}}`, v[key]);
  return s;
};

export const HOWTO = [
  { title: 'Fold first', art: 'folds', body: 'Pick a fold for the sheet: in half, in quarters, in eighths and more. The paper folds itself along its mirror lines into one small wedge with many layers. Some levels pick the fold for you; later you choose it.' },
  { title: 'Snip the wedge', art: 'cut', body: 'Cut on the folded wedge. Drag Scissors around a shape to cut it away, or tap with Punch to stamp a petal, circle, diamond, drop, triangle or crescent in four sizes. Whatever you cut is cut through every layer at once.' },
  { title: 'Cuts on folds', art: 'mirror', body: 'A cut away from the folds appears once in every layer: two, four, eight or more copies. A cut that touches a fold edge opens into one whole shape. A cut at the corner where all folds meet becomes the centre.' },
  { title: 'Unfold and see', art: 'unfold', body: 'Press Unfold and the paper opens fold by fold. The symmetric pattern is your cut-out. The game compares it with the target card and gives stars for the match and for using few cuts.' },
  { title: 'Fix and refold', art: 'refold', body: 'Not right? Press Refold, the paper closes with your cuts kept, and cut more. Undo takes back the last cut, Clear removes them all and Hint shows a ghost of the next cut.' },
  { title: 'Studio and Gallery', art: 'studio', body: 'Studio is free cutting on any sheet and paper. Save the ones you like. The Gallery keeps your cut-outs and the patterns of each paper-cutting tradition you have finished, and can replay the unfold.' },
  { title: 'Watch & Learn', art: 'auto', body: 'Watch & Learn plays whole levels for you. It shows the folds, thinks through three cuts, picks the one that fits, explains why and cuts it. Pause stops everything and you can change the thinking time.' },
];

// Rules pages: every claim is cross-checked with the code. `art` names are drawn by view.js with the game's own paper renderer.
export const RULES = [
  { title: 'The sheet', art: 'sheets', body: [
    'Every cut-out starts from one sheet of coloured paper: a square, a banner (a rectangle a little wider than tall), a hexagon or a pentagon. The front is the coloured side; the reverse is a lighter tint and shows when a flap is folded over.',
    'The paper lies on a cutting mat. Anything you cut away shows the mat. The mat colour is chosen to contrast with the paper.',
    'The paper is never torn or stretched. A fold is always an exact mirror fold and a cut is always exact.'] },
  { title: 'The folds', art: 'folds', body: [
    'Folds are named by the number of layers they make: x2 (in half), x4 (in quarters), x8 (in eighths) on a square; x2 and x4 on a banner; x2, x6 (in sixths) and x12 (in twelfths) on a hexagon; x2 and x10 (in tenths) on a pentagon.',
    'Every fold line passes through the centre of the sheet, so each fold is a mirror line of the sheet. The paper folds one flap at a time: the right half goes over the left, then odd numbers of sectors fold like an accordion and each factor of two folds the wedge in half again.',
    'When the folding ends, all the paper lies in one wedge with 2, 4, 6, 8, 10 or 12 layers. Tap a fold button and the paper folds itself; the number of folds it takes is one for x2, two for x4, three for x8 or x6, four for x12 and five for x10.'] },
  { title: 'The wedge and its edges', art: 'wedge', body: [
    'The wedge has two kinds of edges. A fold edge is a folded edge of the paper (drawn without an outline): nothing is cut there until you cut it. A paper edge is the outer edge of the sheet.',
    'The point where all the folds meet is the centre of the sheet. It is one corner of every wedge.',
    'Your finger and your cuts work on the top layer, but the game cuts every layer in exactly the same place.'] },
  { title: 'Scissors', art: 'cut', body: [
    'Choose Scissors and drag a path on the wedge. When you lift your finger the path is closed with a straight line from the end back to the start, and all the paper inside the closed shape is cut away. A path that crosses itself cuts both loops.',
    'Your path can start or end outside the wedge: the part outside the paper cuts nothing, so a path that leaves the wedge and comes back snips a notch in from the edge.',
    'A snip that encloses almost no area is ignored (the message says it is too small). A sheet takes at most 60 cuts.'] },
  { title: 'Punch', art: 'punch', body: [
    'Choose Punch, pick a shape (petal, circle, diamond, drop, triangle or crescent), a size (XS, S, M or L) and a turn (the Turn button turns the shape by one eighth of a circle, eight turns in all). Touch the wedge: a ghost shows where the shape will be cut; drag to move it and lift your finger to cut.',
    'A punch can overlap the edges of the wedge: the part outside the wedge is not cut. Punch at least a little of the shape on the paper, or the game says to punch on the paper and cuts nothing.',
    'Each punch and each scissors path counts as one cut.'] },
  { title: 'Cuts that repeat', art: 'mirror', body: [
    'The game cuts the same shape through each layer. When the paper unfolds each layer lands on its own part of the sheet, so a cut inside the wedge and away from every fold edge appears once for each layer (2, 4, 6, 8, 10 or 12 times).',
    'A cut that crosses a fold edge continues into the neighbouring layer as its mirror image, so it opens into one whole shape.',
    'A cut at the centre point becomes the centre of the sheet. A cut on the paper edge becomes a notch repeated all around the rim.'] },
  { title: 'Undo, Clear and Hint', art: 'hint', body: [
    'Undo takes back the last cut. Clear takes away all the cuts, keeping the fold. Neither costs anything.',
    'Hint shows a dashed ghost of the next cut of the level\'s own solution that you have not made yet, with a line about why it is there. Using a hint means this try cannot earn three stars.',
    'Change fold (before you cut) opens the paper again so you can choose another fold. If you have made cuts the button asks you to tap it again, because the cuts go away.'] },
  { title: 'Unfold and Refold', art: 'unfold', body: [
    'Unfold opens the paper one fold at a time in 3D, each flap lifting, curling and falling open, and the game scores the cut-out the moment you press it. The score appears when the paper is flat.',
    'Refold folds the paper again with all your cuts kept, so you can keep cutting. You may unfold and refold as often as you like.',
    'Skip speeds the animation up.'] },
  { title: 'The match score', art: 'score', body: [
    'The sheet is divided into a grid of 96 by 96 small cells. A cell is cut away if the cut-outs of the layers cover it. The match shows how much of your cut-away area lies on the target\'s cut-away area, and the other way round, as a percentage. It forgives a hair\'s breadth, about one cell, so a careful finger is enough, but a missing, misplaced or wrongly shaped cut costs.',
    'Cutting nothing scores 0 percent and cutting everything scores low, so the target shape must really be matched. Matching does not depend on which fold you used.',
    'The pieces line tells you how many separate pieces of paper are left. A real paper cut-out should hold together in one piece; the game only reports it.'] },
  { title: 'Stars and par', art: 'stars', body: [
    'One star: match 75 percent or more. Two stars: match 87 percent or more. Three stars: match 94 percent or more, using no more than par plus one cut, and no hints.',
    'Par is the number of cuts in the level\'s own solution. A scissors path or a punch is one cut, so a clever single scissors cut can beat par.',
    'The best result of each level is kept. Playing a level again can only improve it.'] },
  { title: 'Levels and chapters', art: 'chapters', body: [
    'There are 26 levels in 6 chapters, one for each paper-cutting tradition: First Snips, Window Flowers (China), Wycinanki (Poland), Papel Picado (Mexico), Snowflakes and Stars, and Silhouettes and Kirigami (Germany, Switzerland, Japan).',
    'Chapter 1 is open from the start. The next chapter opens when you have finished 3 levels of the one before.',
    'Each level tells you which folds you may use. When there is only one the paper folds that way at once.'] },
  { title: 'Studio', art: 'studio', body: [
    'Studio has no target. Choose a sheet, a paper and a fold, cut and unfold. The result shows the cut area, the number of cuts and the pieces.',
    'Save keeps up to 12 cut-outs in the Gallery. The Gallery keeps your fold, your paper and your cuts, and replays the unfold.',
    'Studio is closed in the free web demo.'] },
  { title: 'Gallery', art: 'gallery', body: [
    'The Gallery has one card for each tradition with a description of the craft. The patterns of a tradition appear on its card once you have finished a level of it.',
    'My cut-outs shows what you saved from Studio. Tap one to see it large, replay the unfold or delete it.'] },
  { title: 'Watch & Learn', art: 'auto', body: [
    'Watch & Learn plays whole levels for you. For each cut the game thinks (it shows three candidate cuts one after another), reveals the one that fits with a line about why, and then cuts it. The levels it plays fold the paper, cut it and unfold it.',
    'You can set the thinking time to 2, 5, 8 or 10 seconds in Settings. The Pause button freezes everything exactly where it is and Resume carries on.',
    'Watch & Learn is free and never uses up your free preview.'] },
  { title: 'Free preview and unlocking', art: 'preview', body: [
    'You can fold and cut for 90 seconds of real play for free. The menus, this Rules reference, About, Settings, the Gallery, Watch & Learn, the unfold and every card never count against the 90 seconds.',
    'When the preview ends you can unlock the full game once with a single purchase, or restore an earlier purchase. There are no ads and no timers.',
    'The free web demo plays the first chapter.'] },
];

export const ABOUT = [
  { title: 'Paper Cutting', body: 'Fold a sheet of coloured paper, snip the wedge and unfold: one careful cut becomes a whole pattern. The paper is real, layered and curling in 3D, and every cut is repeated by the folds.' },
  { title: 'Heritage', body: 'Paper cutting is a folk craft around the world: jianzhi in China, wycinanki in Poland, papel picado in Mexico, Scherenschnitte in Germany and Switzerland, kirigami in Japan, and paper snowflakes everywhere. The levels follow those traditions by their craft: the folds, the papers and the motifs.' },
  { title: 'What you get', body: '26 levels in 6 chapters with a target to match and a par to beat, Scissors and six Punch shapes, folds from x2 to x12 on four kinds of sheet, Studio and a Gallery to keep your cut-outs, and Watch & Learn that explains every cut. A Rules guide with text that grows to 300 percent. No ads, no timers, works offline.' },
  { title: 'Part of Arcforge', body: 'Paper Cutting belongs to the Arcforge collection of World Heritage Games.' },
];
