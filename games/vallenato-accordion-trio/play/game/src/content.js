// The text screens: Rules (paged), How to Play, About and Settings, as blocks the document renderer lays out and zooms.
// Every number below is read from music.js, so the Rules can never disagree with the engine that judges your play.
import { JUDGE, STRAY_COST, TIMING, SPEEDS, BELLOWS, SCORE, WEIGHT, COMBO_STEP, COMBO_MAX, STARS, TOGETHER, HANDOFF_BEATS, STROKE_UNITS, TAP_STROKE_CAP, SEE_AHEAD, BUTTONS, PIECES, AIRES, PART } from './music.js';

const ms = (s) => `${Math.round(s * 1000)} ms`;
const D = { h: (h) => ({ h }), p: (p) => ({ p }), li: (li) => ({ li }), fig: (fig, hh) => ({ fig, hh }), sp: { sp: 1 } };

export const RULES = [
  {
    title: 'The trio and the goal',
    blocks: [
      D.h('Three parts, one groove'), D.p('Vallenato is played by a small trio: an accordion that sings the tune, a caja drum that anchors the beat and a guacharaca, a ridged tube scraped with a fork, that keeps everything moving. In this game you play all three, one at a time or as the spotlight moves around.'),
      D.fig('seats', 190),
      D.h('The score ribbon'), D.p(`Notes slide from the right toward a bright line on the left, the playhead. The ribbon always shows all three parts so you can see how yours fits with the other two: the top band is the accordion (seven rows, one for each button), the middle band is the caja (two rows) and the bottom band is the guacharaca. About ${SEE_AHEAD} seconds of music are visible ahead of the playhead.`),
      D.fig('ribbon', 250),
      D.p('The notes that belong to the part you are playing are big and bright. The other two parts are small and dim: the band plays them for you. When you hit a note, it flashes and its grade pops up at the playhead.'),
      D.h('Ways to play'), D.li('Studio: record the guacharaca, the caja and the accordion one after another. Your own takes are played back, exactly as you played them, under the next one.'),
      D.li('Live Trio: play the whole piece in one go while the spotlight moves from part to part every two bars.'),
      D.li('Watch and Learn: the band plays the piece and explains each part.'),
    ],
  },
  {
    title: 'The accordion',
    blocks: [
      D.h('Seven buttons, two notes each'), D.p('A diatonic accordion gives a different note for the same button depending on the direction of the bellows. Each of the seven buttons has a push note and a pull note. Their note names are printed on the button: the push note above, the pull note below.'),
      D.fig('keys', 250),
      D.li(`Push notes, buttons 1 to 7: ${BUTTONS.push.join(' ')}.`),
      D.li(`Pull notes, buttons 1 to 7: ${BUTTONS.pull.join(' ')}.`),
      D.h('The bellows'), D.p('Under the buttons is the bellows pad. In Hold to pull mode, hold your other thumb on the pad to pull the bellows open; let go to push it closed. In Tap to switch mode every tap on the pad flips the direction. In Automatic mode the app moves the bellows for you and the pad is hidden.'),
      D.fig('bellows', 120),
      D.h('Reading the notes'), D.p('A pearl disc is a button press. Its number is the button and the row it sits on is the button too. A warm amber ring with arrows pointing inward means PUSH. A teal ring with arrows pointing outward means PULL. The pad shows NEXT PUSH or NEXT PULL a moment before the direction changes.'),
      D.h('Rules for a hit'), D.li('Right button and right direction at the right time: graded Perfect, Great or Good.'),
      D.li(`Right button and right time but the wrong bellows direction: Nearly. It sounds the other note, scores ${SCORE.off} points and does not break your combo.`),
      D.li('A different button, or a press with no note near it, makes a sound but scores nothing.'),
      D.li('Keyboard: A S D F G H J are buttons 1 to 7, and Space holds the bellows open (pull).'),
    ],
  },
  {
    title: 'The caja',
    blocks: [
      D.h('Two hands, two sounds'), D.p('The caja is a small wooden drum held between the knees. The game uses its two main strokes: TUM, the deep stroke with the palm, and TAK, the sharp stroke with the fingers.'),
      D.fig('caja', 190),
      D.li('Tap the LEFT half of the drum head for TUM. Round amber discs on the ribbon.'),
      D.li('Tap the RIGHT half for TAK. Coral rings on the ribbon.'),
      D.li('Soft notes are smaller and quieter. They are graded exactly like the others.'),
      D.li('The right time on the wrong half is graded Nearly.'),
      D.li('Use two thumbs; both halves can be struck in quick turns. Keyboard: Z is TUM, X is TAK.'),
      D.p('The caja is the anchor of the trio: its deep tum lands with the guacharaca on the beat and the accordion bass, and that is what the Together score listens for.'),
    ],
  },
  {
    title: 'The guacharaca',
    blocks: [
      D.h('A scrape, in a direction'), D.p('The guacharaca is a notched tube scraped with a three-pronged fork. Here the tube is shown across the screen and you scrape it with a finger.'),
      D.fig('gua', 190),
      D.li(`Drag across the tube. A stroke sounds as soon as your finger has moved ${STROKE_UNITS} units (about a thumb-width) in one direction. Keep scrubbing back and forth to play a run of strokes with one finger.`),
      D.li('A green pill with an arrow pointing right is a RIGHT scrape. An arrow pointing left is a LEFT scrape. Brighter, larger pills are accents.'),
      D.li('The right time in the wrong direction is graded Nearly.'),
      D.li(`A plain tap on the tube also counts as a stroke, but is never graded above ${TAP_STROKE_CAP.charAt(0).toUpperCase() + TAP_STROKE_CAP.slice(1)}. Scrape for the full score.`),
      D.li('Keyboard: the Right Arrow is a right scrape and the Left Arrow is a left scrape.'),
    ],
  },
  {
    title: 'Timing and scoring',
    blocks: [
      D.h('Timing windows'), D.p(`Each note has an exact moment. Your touch is compared with it. With the Standard timing setting the windows are: Perfect within ${ms(JUDGE.perfect)}, Great within ${ms(JUDGE.great)}, Good within ${ms(JUDGE.good)}. Further away than that the note is a Miss. Relaxed makes every window ${Math.round((TIMING[0].k - 1) * 100)}% wider and Strict makes them ${Math.round((1 - TIMING[2].k) * 100)}% narrower.`),
      D.h('Points'), D.li(`Perfect ${SCORE.perfect}, Great ${SCORE.great}, Good ${SCORE.good}, Nearly ${SCORE.off}, Miss 0.`),
      D.li(`Combo: every ${COMBO_STEP} hits in a row raise the multiplier by one, up to times ${COMBO_MAX}. A Miss resets it.`),
      D.h('Accuracy and stars'), D.p(`Accuracy is the average of the note weights: Perfect ${WEIGHT.perfect}, Great ${WEIGHT.great}, Good ${WEIGHT.good}, Nearly ${WEIGHT.off}, Miss ${WEIGHT.miss}. ${Math.round(STARS[0] * 100)}% earns one star, ${Math.round(STARS[1] * 100)}% two stars and ${Math.round(STARS[2] * 100)}% three stars.`),
      D.h('Extra presses'), D.p(`A press with none of your notes near it is an Extra. It still makes its sound, but it breaks your combo and takes ${Math.round(STRAY_COST * 100)}% of a note's weight off your accuracy. Mashing does not help; play the part.`),
      D.h('The latency setting'), D.p('Phones and headphones add a small delay between a sound and your ears. In Settings you can move the timing earlier or later in 5 ms steps, or run the calibration screen, which asks you to tap along to a steady beat and measures it.'),
    ],
  },
  {
    title: 'Studio takes and Together',
    blocks: [
      D.h('One take at a time'), D.p('In Studio you record one part per take. The other two parts sound as the band plays them, or, if you have already recorded that part, as YOU played it, with every early and late note as it was.'),
      D.li('The takes can be recorded in any order. The suggested order is guacharaca, caja, accordion: the pulse first, then the drum, then the tune on top.'),
      D.li('A note you missed stays missing in the playback. Redo the take at any time; the new take replaces the old one.'),
      D.li('Hear my trio plays the three recorded takes together. A part you have not recorded is played by the band.'),
      D.h('The Together score'), D.p(`Where two of your parts are meant to land on the same instant, such as the tum with a guacharaca accent on the beat, Together measures how far apart you actually put them. Within ${ms(TOGETHER.tight)} is locked in; the credit falls away until ${ms(TOGETHER.loose)}, beyond which it counts for nothing. A part that is steadily a little late can still be Together if the other parts are late by the same amount.`),
      D.li('90% or more: Locked in. 75%: Tight. 55%: Loose. Less: Scattered.'),
    ],
  },
  {
    title: 'Live Trio',
    blocks: [
      D.h('The spotlight'), D.p('In Live Trio the piece is played in six sections of two bars. In each section one part is in the spotlight: that is the part you play. The band plays the other two. The seat strip shows who is in the spotlight, and the instrument at the bottom changes to match.'),
      D.li(`The first ${HANDOFF_BEATS === 1 ? 'beat' : HANDOFF_BEATS + ' beats'} of every section is covered by the band, so there is time to move your thumbs. Only the notes after that are graded.`),
      D.li('A banner counts down the hand-off a beat ahead. The ribbon already shows what your next part looks like.'),
      D.li('The result is one set of stars for the whole run, with Together measured across all your parts.'),
      D.p('Every piece uses all three parts. The order of the spotlight is fixed for each piece, so you can learn it.'),
    ],
  },
  {
    title: 'Watch and Learn, hints and pause',
    blocks: [
      D.h('Watch and Learn'), D.p('The band plays the whole piece. A caption names the part in the spotlight and says what it does and why. Nothing is scored and watching does not use up the free preview. You can pause it at any time, and you can start any piece in Watch and Learn from its screen.'),
      D.h('Hint'), D.p('During a take or a Live Trio, the bulb button shows the next few notes of your part in words, for example: Next: button 4 PULL, then button 5 PUSH. Using a hint costs nothing.'),
      D.h('Pause'), D.p('Pause freezes the music, the ribbon and your take exactly where they are and resumes from the same moment. Leaving the app pauses automatically.'),
      D.h('Slow practice'), D.p(`The Speed setting plays everything at ${Math.round(SPEEDS[1].k * 100)}% tempo. Notes and windows are the same; only the tempo changes.`),
    ],
  },
  {
    title: 'The pieces and the aires',
    blocks: [
      D.h('Four aires'), ...Object.values(AIRES).map((a) => D.li(`${a.name}: ${a.line}`)),
      D.h('Six original pieces'), ...PIECES.map((p) => D.li(`${p.name}: ${AIRES[p.aire].name}, ${p.bpm} beats per minute, 12 bars. Parts: guacharaca ${p.level.gua}, caja ${p.level.caja}, accordion ${p.level.acc} (difficulty 1 to 3).`)),
      D.p('All six are new tunes written for this game in the manner of the traditional aires. None of them reproduces an existing song.'),
    ],
  },
  {
    title: 'What is simplified',
    blocks: [
      D.h('Simplifications'), D.li('The accordion has seven melody buttons and a push and pull note on each. A real vallenato accordion has more rows and a left-hand bass and chord side. Here the bass notes are played for you.'),
      D.li('The caja is reduced to two strokes. Real players use many more strokes and variations, with both hands.'),
      D.li('The guacharaca patterns are written as steady strokes with accents. Real players shade every stroke.'),
      D.li('The rhythm patterns are simplified teaching versions of each aire.'),
      D.li('Sounds are synthesised on your device. They imitate the instruments; they are not recordings.'),
      D.h('Settings that change the game'), D.li('Bellows: Hold to pull, Tap to switch, or Automatic.'),
      D.li('Timing: Relaxed, Standard or Strict.'),
      D.li('Speed: Normal or Slow.'),
      D.li('Calm: turns off screen shake, sparks and the swaying lights.'),
    ],
  },
];

export const HOWTO = [
  D.h('Pick a piece'), D.p('Choose one of six pieces. Start with Patio Sunrise.'),
  D.h('Record your three takes'), D.li('Guacharaca: scrape across the tube when a green pill reaches the line. Right arrow means scrape right, left arrow means scrape left.'),
  D.li('Caja: tap the left half for TUM and the right half for TAK when the amber discs and coral rings reach the line.'),
  D.li('Accordion: tap the numbered button, and hold the bellows pad with your other thumb for a PULL note. Release it for PUSH.'),
  D.fig('ribbon', 240),
  D.h('Hear it come together'), D.p('Each take plays under the next, exactly as you played it. Then press Hear my trio. The Together score shows how tightly your three parts lock.'),
  D.h('Or play it live'), D.p('Live Trio moves the spotlight from part to part every two bars.'),
  D.h('Stuck?'), D.li('The bulb button describes the next notes.'),
  D.li('Watch and Learn plays the whole piece and explains each part.'),
  D.li('Speed: Slow and timing: Relaxed are in Settings.'),
  D.li('Keyboard: A S D F G H J accordion buttons, Space bellows, Z and X caja, Left and Right arrows guacharaca, Esc pause.'),
];

export const ABOUT = [
  D.h('Vallenato Accordion Trio'), D.p('A rhythm and ensemble game about vallenato, the accordion music of the Caribbean region of Colombia. Play the three parts of the traditional trio: the accordion, the caja and the guacharaca.'),
  D.fig('seats', 190),
  D.h('Where it comes from'), D.p('Vallenato grew up in the towns and countryside of the Greater Magdalena region on Colombia\'s Caribbean coast, where cattle herders and travellers carried songs and news between villages. The accordion arrived on the coast in the nineteenth century and was joined by the caja, a small drum, and the guacharaca, a scraped, ridged tube. The music is recognised as part of the intangible cultural heritage of Colombia and of humanity.'),
  D.h('The four aires'), D.p('The music is built from four rhythm families called aires: paseo, merengue, son and puya. This game has pieces in all four. The tunes are original to this game.'),
  D.h('Our care'), D.p('The patterns here are simplified and the sound is synthesised, so this is a way into the music, not a replacement for hearing real players. If this game makes you curious, please listen to real vallenato musicians.'),
  D.h('Credits'), D.p('Title font: Dela Gothic One (SIL Open Font License). All music, sound and art are made in the app.'),
];

// Settings rows: val() closures read the live preferences.
export function settingsBlocks(st) {
  const p = st.prefs;
  return [
    D.h('Sound and feel'),
    { row: 'sound', label: 'Sound', kind: 'toggle', val: () => p.sound },
    { row: 'haptics', label: 'Vibration on hits', kind: 'toggle', val: () => p.haptics },
    { row: 'click', label: 'Count-in clicks all the way', hint: 'A soft click on every beat while you play', kind: 'toggle', val: () => p.click },
    { row: 'calm', label: 'Calm', hint: 'No screen shake, sparks or swaying lights', kind: 'toggle', val: () => p.calm },
    { row: 'labels', label: 'Note names on buttons', kind: 'toggle', val: () => p.labels },
    D.h('How it plays'),
    { row: 'bellows', label: 'Bellows', hint: 'How the accordion pad works', kind: 'cycle', val: () => BELLOWS.find((b) => b.id === p.bellows)?.name ?? 'Hold to pull' },
    { row: 'timing', label: 'Timing', hint: 'Width of the timing windows', kind: 'cycle', val: () => TIMING[p.timingIdx].name },
    { row: 'speed', label: 'Speed', hint: 'Tempo of every piece', kind: 'cycle', val: () => SPEEDS[p.speedIdx].name },
    { row: 'cal', label: 'Latency (ms)', hint: 'Move the timing earlier or later', kind: 'stepper', val: () => String(p.cal) },
    { row: 'calibrate', label: 'Calibrate', hint: 'Tap along to measure it', kind: 'button', btn: 'Start' },
    D.h('More'),
    ...(st.demo ? [] : [{ row: 'restore', label: st.owned ? 'Full game unlocked' : 'Restore purchase', hint: st.restoreMsg || (st.owned ? 'Thank you for playing' : 'Already bought it? Get it back'), kind: 'button', btn: st.owned ? 'Owned' : st.restoreBusy ? 'Wait' : 'Restore' }]),
    { row: 'rules', label: 'Rules', kind: 'button', btn: 'Open' },
  ];
}

export const PART_WHY = { gua: PART.gua.name, caja: PART.caja.name, acc: PART.acc.name };
