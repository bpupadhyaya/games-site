// All the words: UI strings, How to Play, the exhaustive Rules, About. English only. Every rule here was checked against the engine
// (paper.js folding, game.js gestures and scoring); the numbers quoted are the ones the code uses.

const STR = {
  title: 'Origami', subtitle: 'Fold by Fold', tagline: 'Fold paper into something wonderful.',
  playBtn: 'Play', studioBtn: 'Studio', autoBtn: 'Watch & Learn', howtoBtn: 'How to Play', rulesBtn: 'Rules', aboutBtn: 'About', settingsBtn: 'Settings',
  back: 'Back', models: 'Models', chapter: 'Chapter', locked: 'Finish 2 models of the chapter before to open this one.', soon: 'Open',
  finished: 'finished', stars: 'Stars', neat: 'Neatness',
  step: 'Step {a} of {b}', hint: 'Hint', undo: 'Undo', restart: 'Restart', turnOver: 'Turn over',
  paused: 'Paused', resume: 'Resume', restartModel: 'Start this model again', toModels: 'Models', quitMenu: 'Main menu',
  done: 'Finished', nextModel: 'Next model', again: 'Fold again', paper: 'Paper', allLayers: 'All layers', topLayer: 'Top layer only',
  neatBest: 'Neatness', hintsUsed: 'Hints', stars3: 'Crisp, careful folds. Three stars.', stars2: 'Nicely folded. Two stars.', stars1: 'Finished. Fold it again for more stars.',
  autoSession: 'Watch & Learn finished', autoSummary: 'You saw how every fold is chosen: the ideas, the one that fits, and the fold itself. Try the same models yourself.',
  autoAgain: 'Watch again', autoExit: 'Back to menu', autoThink: 'Thinking', autoReveal: 'This fold', autoAct: 'Folding', autoPaused: 'Paused',
  settings: 'Settings', soundOn: 'Sound: on', soundOff: 'Sound: off', thinkTime: 'Think time in Watch & Learn', seconds: ' s', textSize: 'Text size',
  unlock: 'Unlock full game', restore: 'Restore purchase', owned: 'Full game unlocked. Thank you!', resetProgress: 'Reset progress', resetConfirm: 'Tap again to erase all progress',
  demoLeft: '{n} models left in the web demo', demoLimitTitle: 'That is the web demo', demoLimitBody: 'The free web demo folds the first three models. Get the full game on iPhone and Android for every model, Studio and all papers.',
  studioHint: 'Drag from any point of the paper: that point is carried to your finger and the paper folds along the crease between.',
  studioDone: 'Fold made.', studioNothing: 'Nothing to undo', tapGrab: 'Grab the glowing corner and drag it to the dot.',
  paperName: 'Paper', unlockPaper: 'Finish a model to unlock its papers.',
};

export const tr = (k, v) => {
  let s = STR[k] ?? k;
  if (v) for (const key of Object.keys(v)) s = s.replace(`{${key}}`, v[key]);
  return s;
};

export const HOWTO = [
  { title: 'Fold one step at a time', art: 'grab', body: 'Each model is a short list of folds. The caption tells you the next fold. A dashed line shows the crease, a glowing dot marks the corner to grab and a small ring shows where it lands.' },
  { title: 'Drag the flap across', art: 'valley', body: 'Put a finger on the flap and drag it over the crease. The paper lifts, curls and follows you. Let go past the halfway turn and it lands flat with a crisp crease. Let go early and it springs back.' },
  { title: 'Neatness', art: 'neat', body: 'Folds are always exact, so you cannot ruin the paper. Neatness shows how close your finger ended to the landing ring. A careful fold scores close to 100 percent.' },
  { title: 'Unfold, turn over, top layer', art: 'turn', body: 'Some steps ask you to open the last fold, to turn the paper over with the Turn over button or a sideways swipe, or to fold only the top layer. The caption always says which.' },
  { title: 'Stuck? Ask for a hint', art: 'hint', body: 'Hint plays the fold as a ghost demonstration and makes the corner glow. Hints are free; stars reward folding without them. Undo takes back the last step and Restart begins the model again.' },
  { title: 'Stars and new models', art: 'stars', body: 'Finish a model for one star, fold neatly for two and neatly with no hints for three. Finish two models of a chapter to open the next, and every finished model unlocks more papers to fold it in.' },
  { title: 'Studio and Watch & Learn', art: 'studio', body: 'Studio is free folding: drag any point of the paper to where you want it. Watch & Learn folds whole models for you, showing the ideas, the one that fits and the fold, with a Pause button.' },
];

// Rules pages: every claim is cross-checked with the code. `art` names are drawn by view.js with the game's own paper renderer.
export const RULES = [
  { title: 'The paper', art: 'sheet', body: [
    'Every model starts from one square sheet. The front shows a printed pattern, the back is a plain tint. You always see one side: the side facing you.',
    'The paper is never cut, torn or stretched. Every fold is straight, exact and flat, and the paper keeps every crease you make, even after you unfold it.',
    'The sheet is split into flat pieces by your creases. Each piece is a layer of paper and layers pile up as you fold. You may see the pattern or the plain back on any layer.'] },
  { title: 'Valley folds', art: 'valley', body: [
    'A valley fold brings the flap toward you and lays it over the paper. The crease is drawn as a dashed line.',
    'When you fold, the flap is lifted off the table, turns about the crease and lands flat on top of everything else. A flap folded this way always ends up above the other layers.',
    'Because the flap turns over, the side that was facing you is now hidden and the other side shows. The first fold of most models shows you the plain back this way.'] },
  { title: 'Mountain folds', art: 'mountain', body: [
    'A mountain fold takes the flap away from you and behind the paper. The crease is drawn as a dash-dot line.',
    'The flap swings behind the sheet and lands flat underneath the other layers, out of sight. Only folds that move every layer on the flap side can be mountain folds (the dart uses one).',
    'You drag a mountain fold exactly like a valley fold: the gesture is the same, only the flap goes the other way.'] },
  { title: 'Which layers fold', art: 'layers', body: [
    'A fold line applies to every layer on the flap side of the line. The caption says when only some layers should fold, such as the top layer, the front layers or the layers that are not tagged as the back.',
    'When only the top layer folds, the layers below stay where they are and the flap lands above them. Layers that cross the crease are cut along it; only the part on the flap side moves.',
    'The glowing corner and the dashed line always show exactly the part that will move.'] },
  { title: 'The gesture', art: 'grab', body: [
    'Touch the flap and drag. The point you grabbed follows your finger as the paper turns about the crease: the more of the way across you drag, the further the paper turns. Grabbing near the crease works too; the paper treats the grab as at least half way along the flap so it stays easy to control.',
    'Release when the flap has turned more than about 100 degrees (past straight up) and it falls the rest of the way and lands flat. Release earlier and it springs back open. You can start again at once.',
    'Grab anywhere on the flap or close to its glowing corner. A tap on the paper that is not on the flap does nothing.'] },
  { title: 'Neatness', art: 'neat', body: [
    'Neatness is a score from 0 to 100 percent for each fold. It measures how far from the landing ring your finger was when you let go. Closer than 15 percent of the sheet width scores some points and on the ring scores 100.',
    'The score never changes the fold: the paper always folds exactly along the line. Unfolds score like folds; turning the paper over does not score.',
    'The average of all your folds is shown at the end of the model.'] },
  { title: 'Unfold', art: 'unfold', body: [
    'Some steps ask you to open the last fold. Touch the flap and drag it back across the crease; it springs open the same way a fold springs shut.',
    'Unfolding removes the layers the fold made but not the crease: a thin line stays in the paper and later folds can use it as a guide. Unfolding scores neatness like any fold.',
    'Undo is different: it takes back the last step completely, crease included.'] },
  { title: 'Turn the paper over', art: 'turn', body: [
    'A turn step flips the whole paper over like the page of a book, so its other side faces you and left and right swap places. Press Turn over, or swipe sideways across the paper.',
    'Turning keeps every layer and every crease; it only changes what you see. It is not scored.',
    'In Studio the Turn over button is always available.'] },
  { title: 'Hint, Undo and Restart', art: 'hint', body: [
    'Hint plays the current fold once as a ghost demonstration, then the glowing corner pulses for a few seconds. Hints are free and unlimited, but each press is counted and costs stars.',
    'Undo takes back the last step and plays it in reverse. It removes that step\'s neatness score; hints already used stay counted. Restart puts a fresh sheet on the table and clears the model\'s scores and hint count.',
    'Pause stops the game; menus, rules and Watch & Learn never use up your free preview time.'] },
  { title: 'Stars', art: 'stars', body: [
    'Finishing a model gives one star. Two stars: an average neatness of 45 percent or more with no more than two hints. Three stars: an average of 70 percent or more with no hints.',
    'Your best result for each model is kept. Folding a model again can only improve it.',
    'When a model is finished, the paper stands up and turns slowly, small details appear and the stars are counted.'] },
  { title: 'Chapters and papers', art: 'chapters', body: [
    'The models are arranged in chapters. Models inside a chapter are all open. The next chapter opens when you have finished two models of the one before.',
    'Each model has its own paper. Finishing a model unlocks more printed papers for it: choose the paper before you start from the model screen.',
    'The paper changes only the look: every fold is identical on every paper.'] },
  { title: 'Studio', art: 'studio', body: [
    'Studio is a free table: no steps, no scores. Touch any point of the paper and drag it where you want it. The paper folds along the line halfway between where you grabbed and where your finger is, and the grabbed point lands under your finger.',
    'Choose All layers or Top layer only first. Let go to keep the fold; drag back near the start and let go to cancel it. Undo and Restart work as in a model.',
    'Studio keeps working with any number of folds; thin or tiny pieces are simply left in place.'] },
  { title: 'Watch & Learn', art: 'auto', body: [
    'Watch & Learn plays a whole session for you: for each fold the game thinks (it shows the candidate crease lines one after another), reveals the fold it chooses with the corner and landing ring, and then folds it.',
    'You can set the thinking time to 2, 5, 8 or 10 seconds in Settings. The Pause button freezes everything exactly where it is and Resume carries on.',
    'Watch & Learn is free and never uses up your free preview.'] },
  { title: 'Free preview and unlocking', art: 'preview', body: [
    'You can fold for 90 seconds of real play for free. The menus, this Rules reference, About, Settings, Watch & Learn and every card never count against the 90 seconds.',
    'When the preview ends you can unlock the full game once with a single purchase, or restore an earlier purchase. There are no ads and no timers.',
    'The free web demo plays the first three models and a short Studio session.'] },
];

export const ABOUT = [
  { title: 'Origami: Fold by Fold', body: 'Fold one sheet of patterned paper, one crease at a time, into a finished model. The paper is real, layered and curling: grab a flap, feel it lift, and let the crease snap flat.' },
  { title: 'Heritage', body: 'Origami (from the Japanese ori, to fold, and kami, paper) is the art of folding paper, practised in Japan for centuries and loved around the world. The papers here are inspired by traditional printed washi patterns: waves, hemp leaf, blossom, dots, stripes and gold.' },
  { title: 'What you get', body: 'Seven models in three chapters from a kite to a paper dart, every one with its own papers; Studio for free folding; Watch & Learn that folds whole models while showing how each fold is chosen; and a Rules guide with text that grows to 300 percent. No ads, no timers, works offline.' },
  { title: 'Part of Arcforge', body: 'Origami: Fold by Fold belongs to the Arcforge collection of World Heritage Games.' },
];
