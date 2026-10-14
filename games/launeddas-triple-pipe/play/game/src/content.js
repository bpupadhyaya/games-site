// Text for About, How to Play and the Rules reference. Every rule claim below was checked against the engine:
//   sim.js   timing windows 70 / 140 / 200 ms (perfect / good / late or early), points 100 / 60 / 30 times a multiplier that rises one
//            step per 8 notes in a row up to x4; air 0..1, drains 0.085 per second (Relaxed 0.05), each note costs 0.022 (0.014), a stray tap
//            0.6 of a note and breaks the run; holding breath refills 1.4 per second (1.7); taps are ignored while squeezing or at 0 air;
//            1.6 s of grace at 0 air, a squeeze revives, otherwise the tune ends; a tune ends when its last phrase finishes
//   tunes.js four tunes (88 / 100 / 112 / 126 bpm), 16-step phrases, a 3.2 s count-in
//   game.js  90 s preview counts real play only, web demo allows 3 tune plays on the first two tunes, Watch & Learn thinking time 2-10 s
// A section is { title, art?, p: [paragraphs] }; the reader lays the text out so nothing overflows at any text size.

export const ABOUT = [
  { title: 'Launeddas', art: 'pipes', p: [
    'The launeddas is the traditional reed pipe of Sardinia, an island of Italy. It is three cane pipes bound together and blown at once: a long drone pipe that holds one steady note, and two shorter pipes with finger holes, one for each hand, that play the tune and its answer.',
    'The piper keeps the sound going without a pause by circular breathing: the cheeks are filled like a small bellows and squeezed to push the air through the reeds while a quick breath is taken through the nose. A bronze figure of a piper from the stone-tower age of Sardinia shows how old the instrument is.',
  ] },
  { title: 'The tunes', p: [
    'Launeddas music accompanies the island\'s traditional dances. The four tunes here are original melodies in that style, named after dance forms: a round dance, a step dance, a flower tune and an organ-point dance. They are made for this game and are not recordings or transcriptions.',
    'Each uses its own tuning of the pipes, so the same pads sound different from tune to tune.',
  ] },
  { title: 'Credits and respect', p: [
    'The instrument and its repertoire belong to the pipers and makers of Sardinia, who keep them alive today. This game is a small, secular tribute to the way the pipe is played; the Rules page lists everything it simplifies. Sounds are synthesized in the game; no recordings are used.',
    'Made by Arcforge. The stone tower, the cane pipes and the dusk are drawn by the game. The 3D scenes use three.js (MIT licence, three.js authors); nothing else is borrowed.',
  ] },
];

export const HOWTO = [
  { title: 'Play the tune', art: 'lanes', p: [
    'Notes fall down five lanes toward the glowing line. Tap the matching pad as a note touches the line. Left of centre are the two low pipe pads, right of centre the three high pipe pads. A hole number on every note shows which finger it is.',
    'Tap on time for more points; a run of notes in a row raises your multiplier.',
  ] },
  { title: 'Keep the drone alive', art: 'breath', p: [
    'The tall gauge on the left is your air. It drains all the time and a little more with every note. Hold the BREATH pad to squeeze the cheeks and fill it again.',
    'While you squeeze, the reeds cannot speak: taps on the note pads are ignored. So breathe in a rest, or give up a note or two when the air runs low. If the air hits zero and you cannot squeeze within a second and a half, the drone dies and the tune ends.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think pauses the tune and the coach explains what to do about the air right now and which pad comes next. Watch & Learn lets a computer piper play a whole tune and explains each breathing choice before it acts, with a real Pause.',
    'Two thumbs work best: one on the breath and low pads, one on the high pads. Sliding a finger onto another pad plays it. On a keyboard use A S for the low pipe, J K L for the high pipe and hold Space to breathe.',
  ] },
];

export const RULES = [
  { title: '1. The goal', p: [
    'Play a tune from its first note to its last without letting the drone die. Your score comes from how well you time the notes; the rating comes from your accuracy.',
    'A tune is a count-in of about three seconds, then ten to twelve phrases of sixteen steps. The slowest tune is 88 beats per minute, the fastest 126.',
  ] },
  { title: '2. Pads and lanes', art: 'lanes', p: [
    'There are six pads. The BREATH pad is on the left. The next two (Low 1, Low 2) play the left-hand pipe, the mancosa. The last three (High 1, High 2, High 3) play the right-hand pipe, the mancosedda. Every note falls in the lane above its pad and carries the number of the hole.',
    'The notes you hear come from the tune\'s tuning: the same pad sounds different in each of the four tunes. Two notes can arrive together; use two fingers. A quick trill is two notes in the same lane half a step apart.',
  ] },
  { title: '3. Timing', p: [
    'A tap counts for the nearest waiting note in that lane when it is within 0.07 s (Perfect, 100 points), 0.14 s (Good, 60) or 0.2 s (Early or Late, 30). A note not played within 0.2 s after it passes the line is missed and breaks your run.',
    'A tap with no note near it is a stray tap: it costs a little air and breaks your run.',
  ] },
  { title: '4. Run and multiplier', p: [
    'Every note played in a row adds to your run. The multiplier is x1, rising by one for every 8 notes in a row, up to x4. A missed note or a stray tap sets the run back to zero.',
  ] },
  { title: '5. Air', art: 'breath', p: [
    'Air runs from 0 to 100 percent and starts full. It drains 8.5 percent per second (Relaxed pace: 5 percent) and every note you play costs 2.2 percent more (Relaxed: 1.4). A stray tap costs 60 percent of a note.',
    'Hold the BREATH pad to refill: 140 percent of the gauge per second (Relaxed: 170), so a half refill takes about a third of a second. The gauge turns red below 25 percent.',
    'While the breath pad is held, or while the air is at zero, note taps are ignored: the reeds cannot speak. Notes that pass in that time are missed.',
  ] },
  { title: '6. When the air runs out', p: [
    'At zero air the drone sputters. You have 1.6 seconds to hold the breath pad; the air then fills and the drone returns. If you do not, the drone falls silent and the tune ends at that point. Your result shows how far you got.',
  ] },
  { title: '7. Finishing and ratings', p: [
    'When the last note has passed the tune ends. Accuracy counts Perfect as 1, Good as 0.7, Early or Late as 0.4, and a miss as 0, over every note of the tune. Master is 90 percent or more, Player 70 percent, otherwise Learner. A tune that ends with the drone silent is rated Out of breath.',
    'Your best score for each tune is kept on the device.',
  ] },
  { title: '8. Pace', p: [
    'Standard is the full challenge. Relaxed drains the air more slowly and refills it faster, so you can concentrate on the notes first. The tunes themselves are the same.',
  ] },
  { title: '9. Think, Watch & Learn and Pause', p: [
    'Think stops the tune and tells you what the computer piper would do about the air now and which note is next. Closing it carries on. Watch & Learn plays a whole tune with a computer piper: before each breathing decision it thinks (2 to 10 seconds, your choice), shows what it will do and why, then acts. Pause freezes everything exactly where it is. Neither counts toward the free preview.',
  ] },
  { title: '10. What the game simplifies', p: [
    'A real launeddas has a long drone pipe with no holes and two pipes with four holes each, and a skilled piper chooses the sets of pipes for a particular tuning. Here the low pipe has two pads, the high pipe three, and each tune uses one fixed tuning.',
    'Real playing needs no resource gauge: the air is a way to feel the breathing. The tunes are original and in the style of the island\'s dance music. Sounds are synthesized and are not a recording of the instrument.',
  ] },
];
