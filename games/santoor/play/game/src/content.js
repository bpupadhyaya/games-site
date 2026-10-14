// All the words of the game: About, How to Play, the Rules pages. Numbers are read from music.js (the same constants the engine uses).
// Blocks: { h: heading } { p: paragraph } { li: bullet } { fig: name, hh: height in units } { sp: space }
import { JUDGE, RUN_K, ROLL, SCORE, WEIGHT, STARS, ENSEMBLE, LEARN, THINK, TIMING, SPEEDS, PIECES, SCALES, GRADES, NNOTE, NCOURSE, pieceSeconds } from './music.js';

const ms = (s) => `${Math.round(s * 1000)} ms`;
const pct = (v) => `${Math.round(v * 100)}%`;

export const ABOUT = [
  { h: 'Santoor' },
  { p: 'A music game for the santoor, the hammered dulcimer of India. The santoor is a trapezoid of walnut wood strung with many courses of metal strings, which the player strikes with two light curved mallets. You play it by striking the right spot at the right moment, rolling a note for a shimmer, and running across the board in one stroke, in six short original pieces that grow from single slow notes to flowing runs.' },
  { h: 'The instrument' },
  { p: `The santoor is best known from the valley of Kashmir and is played today across India, in folk music and on the concert stage. Its relatives are the santur of Persia and the hammered dulcimers of many lands. Each note is a course of three or four strings tuned to the same pitch, laid over two rows of small wooden bridges. The mallets strike the strings beside the bridges. In the game the board is simplified to ${NCOURSE} courses and ${NNOTE} playing spots: the real instrument has about a hundred strings.` },
  { h: 'The zigzag' },
  { p: 'On the santoor the notes of a scale zigzag between the two bridge rows, so a rising scale is played left, right, left, right, one course higher at every second note. That is why the instrument asks for two mallets that take turns. The game keeps this layout: odd notes are on the left of the board, even notes on the right.' },
  { h: 'How it sounds' },
  { p: 'Every sound is synthesised on your device while you play: no recordings and no licensed music. The six pieces are original. The scales are named after scales used in Indian music (Bhoopali, Pahadi, Kafi, Yaman, Malkauns); the note names (Sa, Re, Ga, Ma, Pa, Dha, Ni) are the sargam syllables used to sing and teach them.' },
  { h: 'Made for playing' },
  { li: 'Works with several fingers at once, and with the keyboard on a computer.' },
  { li: 'Learn plays you a phrase and then asks you to play it from memory, with no notes shown.' },
  { li: 'Watch and Learn shows the mallet, the note and the reason for every note, and you set how long it waits for you to think.' },
  { li: 'A calibration screen lines the game up with your speakers or headphones. Text size goes up to 300%.' },
  { li: 'Portrait and landscape on phones and tablets. No ads. Works offline.' },
  { h: 'Free preview' },
  { p: 'The first 90 seconds of real playing (Learn, Play and Free Play) are free. Menus, these pages, Watch and Learn and the results never use the preview. One purchase unlocks the whole game on this device.' },
  { sp: 1 },
  { p: 'Santoor is part of Arcforge, a collection of world heritage games.' },
];

export const HOWTO = [
  { h: 'Play in four steps' },
  { li: 'Pick a piece, then start with Learn: you hear a short phrase, then play it back from memory.' },
  { li: 'A coloured disc with a ring closing on it is a note. Amber discs are for the left mallet (the left half of the board), teal discs for the right mallet.' },
  { li: 'Tap the spot when the ring closes on the disc. Closer to the beat scores more.' },
  { li: 'A thin thread joins the notes that come next, so you can read the shape of the melody before it arrives.' },
  { h: 'Other gestures' },
  { li: 'Tremolo: a disc with a wavy line. Touch the spot and keep your finger there until the ring around the disc has filled.' },
  { li: 'Run: teal discs joined by a bright band. Drag one finger across the spots in one stroke, or alternate two fingers.' },
  { li: 'Chord: two discs at the same moment. Use two fingers together.' },
  { li: 'Holding a finger on any spot, anywhere, makes a tremolo.' },
  { h: 'Modes' },
  { li: 'Learn: listen, then echo from memory, phrase by phrase. Show me points out the notes; Listen again replays the phrase. If a phrase goes badly the second try shows the notes.' },
  { li: 'Play: the whole piece. Clean playing adds a drone and then a hand drum. Show me points out the next note.' },
  { li: 'Watch and Learn: the teacher plays each phrase. First you get time to think (set in Settings), then the first spot is revealed, then the phrase is played with the mallet, the note and the reason shown.' },
  { li: 'Free play: no notes and no score. Change the scale, and switch between Sargam names and numbers.' },
  { h: 'Tips' },
  { li: 'Notes seem early or late? Open Settings, then Calibrate, and tap along with the pulse.' },
  { li: 'Keyboard: 1 2 3 4 5 6 7 8 9 0 Q W E R T Y strike notes 1 to 16; hold a key for a tremolo. Space pauses.' },
];

export const RULES = [
  {
    title: 'The instrument',
    blocks: [
      { fig: 'instrument', hh: 320 },
      { p: `The santoor is a trapezoid with a wide end and a narrow end. It has ${NCOURSE} courses of strings, each course lying across the board. The course nearest the wide end is the lowest in pitch; the one at the narrow end is the highest. Each course has two playing spots, one on each half of the board, which makes ${NNOTE} spots, numbered 1 (lowest) to ${NNOTE} (highest).` },
      { p: 'In portrait the wide end is at the bottom of the screen, nearest you; the left mallet plays the left half and the right mallet the right half. In landscape the board is turned a quarter turn: the wide end is at the left, and the left mallet plays the half at the top of the screen.' },
      { p: 'The small dark pieces on the strings are the bridges. In the real instrument they hold the strings and divide each into the part you strike and the part that rings in sympathy. In the game they show where the two halves meet.' },
    ],
  },
  {
    title: 'The zigzag',
    blocks: [
      { fig: 'zigzag', hh: 380 },
      { p: 'Odd notes (1, 3, 5, ...) are on the left half of the board, even notes (2, 4, 6, ...) on the right. Note 1 and note 2 are on the lowest course, note 3 and note 4 on the next, and so on. A scale climbed one note at a time zigzags left, right, left, right; a leap of two notes lands on the same side, one course higher or lower.' },
      { p: 'The pitch of each spot depends on the scale of the piece you are playing. Every piece names its scale, and Free play lets you change it.' },
      { p: 'Seven-note scales run over two octaves and a little more, five-note scales over three octaves and one note. The scales, in half steps above note 1, with their sargam names:' },
      ...SCALES.map((s) => ({ li: `${s.name}: ${s.steps.join(' ')} (${s.sargam.join(' ')}). ${s.blurb}` })),
      { p: 'Note 1 is a C sharp. The labels beside the spots can show the sargam names, the note numbers or nothing at all (Settings, or the labels button in Free play).' },
    ],
  },
  {
    title: 'Striking',
    blocks: [
      { fig: 'ring', hh: 190 },
      { p: 'A note arrives as a disc on its spot with a ring closing on it. On the beat the ring has shrunk onto the disc: that is the moment to touch. The part of the screen you touch decides the note: the course nearest your finger, on the half of the board you are touching.' },
      { p: 'You can play several spots at once with several fingers. A touch that does not match any note makes the sound but is not judged, so extra notes are allowed.' },
      { p: 'Left and right hand: the colours are a guide. You can touch any spot with any finger; the game only listens to where you touch and when.' },
      { p: 'Keyboard: 1 2 3 4 5 6 7 8 9 0 Q W E R T Y strike notes 1 to 16.' },
    ],
  },
  {
    title: 'Tremolo',
    blocks: [
      { p: 'A tremolo (a roll) is a note held for its whole length. In the game it is a disc with a wavy line on it. The mallets bounce quickly on the spot so that the note keeps sounding.' },
      { li: 'Touch the spot on the beat, as for any note. This is judged like a strike.' },
      { li: `Keep your finger on the spot. A ring fills around the disc. While your finger is down the note sounds again every ${ROLL.rate} seconds.` },
      { li: `The roll counts when you held it for at least ${pct(ROLL.hold)} of its length, less ${ROLL.grace} seconds of allowance. A held roll scores a ROLL bonus of ${SCORE.roll} points (times your combo bonus) and counts as one more note in your accuracy. If you let go too soon, SHORT appears and that part earns nothing.` },
      { p: 'Moving your finger away from the spot ends the roll. In Free play, holding a finger on any spot for a moment starts a tremolo, and that works in the pieces too.' },
    ],
  },
  {
    title: 'Runs',
    blocks: [
      { fig: 'run', hh: 330 },
      { p: 'A run is a fast chain of neighbouring notes played in one stroke, shown as teal discs joined by a bright band. Because neighbouring notes alternate between the halves, the path of the finger zigzags across the board as it climbs or falls.' },
      { p: 'Put a finger on the first spot and drag it across the others in order. Each time the finger enters a new spot, that spot is struck. You can also play a run with two fingers taking turns, or tap the spots one by one.' },
      { p: `Run notes are judged like other notes, but with timing windows ${RUN_K} times wider, so a smooth stroke at the right speed scores well.` },
    ],
  },
  {
    title: 'Chords',
    blocks: [
      { p: 'Two discs on the same beat are a chord. Strike both spots at the same moment with two fingers (a left spot and a right spot are easiest, one finger on each half). Each note of a chord is judged separately, so a very slightly early or late second finger still earns points.' },
    ],
  },
  {
    title: 'Notes and timing',
    blocks: [
      { fig: 'notes', hh: 150 },
      { p: 'Notes close in on their spot and arrive on the beat. The note speed is a setting: ' + SPEEDS.map((s) => `${s.name} (${s.approach} s from the first sign of the ring to the beat)`).join(', ') + '.' },
      { p: 'When you strike a spot, the game looks for the nearest unplayed note on that spot within the allowed range. The ranges either side of the beat (Normal timing):' },
      { li: `Perfect: within ${ms(JUDGE.perfect)}.` },
      { li: `Great: within ${ms(JUDGE.great)}.` },
      { li: `Good: within ${ms(JUDGE.good)}.` },
      { li: 'Near: no note waits on that spot, but a note on a spot next to it (one step or two steps away) is due. It is taken as Near: it earns a little, keeps the combo, and is judged only once.' },
      { li: 'Miss: a note nobody played in time (later than the Good range). It breaks the combo.' },
      { p: 'The timing setting scales the three ranges: ' + TIMING.map((t) => `${t.name} x${t.k}`).join(', ') + `. Run notes use ranges ${RUN_K} times as wide.` },
      { p: 'Notes early or late on your device? Settings, Calibrate: tap along with a pulse and the game measures the delay of your speakers or headphones. You can also set it by hand.' },
    ],
  },
  {
    title: 'Scoring',
    blocks: [
      { p: `Points per note: Perfect ${SCORE.perfect}, Great ${SCORE.great}, Good ${SCORE.good}, Near ${SCORE.off}, Miss 0. Each is multiplied by your combo bonus: x1, plus one for every ${SCORE.comboStep} notes in a row, up to x${SCORE.comboMax}. A Miss sets the combo back to zero. A held roll adds ${SCORE.roll}, also multiplied.` },
      { p: `Accuracy is how much of the full marks you earned. Each note is worth up to 100%: Perfect earns ${pct(WEIGHT.perfect)} of it, Great ${pct(WEIGHT.great)}, Good ${pct(WEIGHT.good)}, Near ${pct(WEIGHT.off)}, Miss 0%. A roll counts twice (the strike and the hold). The accuracy of a piece is the average over all of these.` },
      { p: `Stars: ${pct(STARS[0])} accuracy earns one star, ${pct(STARS[1])} two, ${pct(STARS[2])} three. The grade letter is ${GRADES.map((g) => `${g[0]} from ${pct(g[1])}`).join(', ')}.` },
      { p: 'Your best score and best stars for each piece are saved on your device. Scores are not kept for Watch and Learn.' },
    ],
  },
  {
    title: 'Learn',
    blocks: [
      { p: 'Learn works in call and response. The eight bars of a piece are cut into four phrases of two bars.' },
      { li: 'Count in: one bar of clicks (the metronome can be switched off in Settings; the count stays).' },
      { li: 'Listen: the teacher plays the phrase with two mallets. Pale blue discs close in on their spots, and the caption says which mallet and why.' },
      { li: 'Echo, from memory: the phrase comes again with no discs shown. You play it back; where you missed a note, its spot lights up for a moment. Show me reveals the notes.' },
      { p: `If you finish a phrase below ${pct(LEARN.pass)} accuracy, the call and response repeats with the discs shown, up to ${LEARN.tries} tries per phrase, then the lesson moves on.` },
      { p: 'After the four phrases comes the final take: the whole piece straight through with the discs shown. The accompaniment starts silent and joins as you play cleanly, as in Play.' },
      { p: 'The Listen again button restarts the call for the phrase you are on.' },
    ],
  },
  {
    title: 'Play and the accompaniment',
    blocks: [
      { fig: 'layers', hh: 190 },
      { p: 'Play is the whole piece, with a count-in of one bar. The accompaniment starts silent.' },
      { p: `Every ${ENSEMBLE.every} notes in a row that are not Misses add one layer, up to ${ENSEMBLE.max}: first a drone (a low and steady string sounded on every beat, in the manner of the tanpura that accompanies Indian music), then a soft hand-drum pulse. A Miss takes one layer away.` },
      { p: 'The Show me button points out the next note for a few seconds: the mallet appears on its spot and the caption says which mallet and why. It costs nothing.' },
    ],
  },
  {
    title: 'Watch and Learn',
    blocks: [
      { p: 'The teacher plays the whole piece, one phrase at a time, with the drone and the drum. Nothing is scored.' },
      { li: `Think: the phrase is announced and its spots light up. The wait is set in Settings, from ${THINK.min} to ${THINK.max} seconds (it starts at ${THINK.def}). Skip wait moves on at once.` },
      { li: `Reveal (${THINK.reveal} seconds): the first mallet shows where the first note goes and why.` },
      { li: 'Act: the teacher plays the phrase. The caption names the mallet and note and gives the reason for each, such as a step, a leap, a tremolo, a run or a chord.' },
      { p: 'Pause stops everything where it is, including the Think timer, and resumes in the same place. In the pause menu you can switch to a slower tempo, jump to the next piece or leave.' },
    ],
  },
  {
    title: 'Free play',
    blocks: [
      { p: 'Free play is the instrument with no notes and no score.' },
      { li: 'Strike, hold for a tremolo and drag for a run as in the pieces.' },
      { li: 'Tap the scale button to move to the next of the five scales. Reset returns to Pahadi.' },
      { li: 'The labels button switches between sargam names, note numbers and nothing.' },
      { p: 'The western note name of every spot is printed on the spot, with note 1 of every scale a C sharp.' },
    ],
  },
  {
    title: 'The pieces',
    blocks: [
      { p: 'Six original arrangements, from simple to flowing. Each is eight bars of four beats. Times are at the normal tempo.' },
      ...PIECES.map((p) => ({ li: `${p.name}: ${SCALES.find((s) => s.id === p.scale).name}, ${p.bpm} beats per minute, about ${pieceSeconds(p)} seconds. ${p.blurb}` })),
      { p: 'A Watch and Learn run takes longer than the piece itself because of the Think and Reveal pauses.' },
      { p: 'Simplifications: the real santoor has about a hundred strings in courses of three or four, covers several octaves with every semitone, and is tuned by moving the bridges. Here there are sixteen notes in a scale of your choice, the strike is judged as a touch, and the tremolo is a held touch.' },
    ],
  },
  {
    title: 'Controls and settings',
    blocks: [
      { li: 'Touch: tap, hold, drag. Use as many fingers as you like.' },
      { li: 'Keyboard: 1 2 3 4 5 6 7 8 9 0 Q W E R T Y for notes 1 to 16, Space or Escape to pause, Escape to leave a screen.' },
      { li: 'Pause is in the corner; the app also pauses when it goes to the background.' },
      { li: 'Settings: sound, note speed, timing, note labels, metronome in Learn, vibration, reduced motion, the Think wait, the sound delay and Calibrate.' },
      { li: 'Text size: A- and A+ at the top of every text screen, from 100% to 300%.' },
    ],
  },
];
