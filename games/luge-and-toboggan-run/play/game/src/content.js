// All reader text: About, How to Play and the exhaustive Rules. Every number here is the number the simulation uses (see physics.js, sim.js, track.js).
import { TRACK_LIST, buildTrack } from './track.js';
import { LEVELS, PUSH_T, PUSH_WIN } from './sim.js';

const info = TRACK_LIST.map((t) => { const T = buildTrack(t.id); return { name: t.name, bends: T.curves.length, len: Math.round(T.L - T.S0) }; });
const tracksText = info.map((i) => `${i.name}: ${i.bends} numbered bends, about ${i.len} m.`).join(' ');

export const ABOUT = [
  { title: 'Luge and Toboggan Run', p: [
    'Lie back on a sled, feet first, and slide down a banked ice chute of numbered bends. You steer with a shift of weight, and the fastest line saves hundredths of a second in every bend.',
    'A true perspective chute with banked walls, a one-thumb lean, a ghost of your best run, split times and a two-run cup against seven computer sliders.'] },
  { title: 'About the sport', art: 'bank', p: [
    'Sliding down an ice-covered track on a small sled is an old winter pastime of the mountain valleys of Europe, where villagers raced down snowy lanes on wooden sleds. It became an organised sport with artificial ice chutes in the nineteenth and twentieth centuries.',
    'On the track the slider lies on the back, steers with calf pressure and shoulder lean and has no brakes: the skill is choosing the line and staying smooth. The chutes are banked so that the sled is pressed into the ice through every bend.'] },
  { title: 'How it is made', p: [
    'The three chutes are generic and invented, not copies of real tracks. No real events, teams, flags or brands appear here; the other sliders have plain first names.',
    'Everything is simulated in fixed steps, so the same inputs always give the same run.'] },
];

export const HOWTO = [
  { title: 'The goal', p: [
    'Slide from the start gate to the finish line in the shortest time. The cup is two runs on the track you choose; the faster your total time against seven computer sliders, the better your medal.'] },
  { title: 'Start gate', art: 'push', p: [
    'Five rings close one after another, left and right hand in turn. Tap anywhere as each ring closes. Every good pull adds speed to the launch; a missed pull adds nothing, and nothing is taken away.',
    'Keyboard: Space, or any arrow key, pulls the handles.'] },
  { title: 'Steering', art: 'gauge', p: [
    'Press and drag left or right anywhere on the screen. Where your thumb landed is the middle: drag away from it to lean the sled, let go to ease back to the middle. The further you drag the more you lean.',
    'In a bend the sled is pushed to the outside wall. Lean into the bend to hold it on the line. Keyboard: Left and Right arrows, or A and D.'] },
  { title: 'The line', art: 'line', p: [
    'The inside of a bend is the shorter way round. The fastest line goes wide before the bend, touches the inside at the middle of it, and drifts back out. The gauge at the bottom shows your sled (white dot), the walls (red ends) and the line a little way ahead (gold marker).',
    'Think draws the line on the ice. Steering hard costs speed, and scraping a wall costs more, so smooth is fast.'] },
  { title: 'Bends and signs', p: [
    'Numbered signs stand beside the chute before every bend, and the chip under the time says which bend is next and how far away it is. The small map on the right shows where you are on the chute.'] },
  { title: 'Think and Watch & Learn', art: 'think', p: [
    'Think pauses the run and tells you what the next bend wants. Watch & Learn plays a whole cup by itself, stopping in front of the main bends: it thinks, shows the line, then slides through. You can pause it and make the thinking time shorter or longer.'] },
];

export const RULES = [
  { title: 'Cup, time trial and daily run', p: [
    'Cup: two runs on one track against seven computer sliders. The total of your two times decides the order: first place is Gold, second Silver, third Bronze.',
    `Levels: ${LEVELS.map((l) => l.name).join(', ')}. The level only changes how fast the seven rivals are.`,
    'Time trial: one run, no rivals. Daily Run: one run on the Alpine chute with the ice ruts seeded by today\'s date, so everyone gets the same ice on the same day.'] },
  { title: 'The three chutes', p: [
    tracksText,
    'The bends are numbered in the order you meet them. A bend is any stretch that curves enough to need your lean; the chute is banked more the tighter the bend.',
    'Each chute is split into three equal parts by distance. Your time at the end of each part is shown as a split, compared with your best run.'] },
  { title: 'Start gate', art: 'push', p: [
    `There are five rings, closing at ${PUSH_T.map((t) => t.toFixed(2)).join(', ')} seconds after the gate opens. A pull counts for the nearest unused ring if it is within ${PUSH_WIN.toFixed(1)} seconds of it. A perfect pull is worth 0.9 m/s of launch speed, and the worth falls to 0.18 m/s at the very edge of the allowed timing.`,
    'The sled launches at 3.0 m/s plus your pulls, so the best possible start adds 4.5 m/s.'] },
  { title: 'How the sled moves', p: [
    'The slope of the chute speeds you up; air and the ice slow you down. The slope is steeper at the top than lower down.',
    'In a bend the sled is pushed towards the outside by the speed squared divided by the bend radius. The bank gives some of it back. Leaning pushes the sled the other way, with more strength the faster you go.',
    'Your lean follows your finger at up to 5.5 units per second, so a quick flick takes about a fifth of a second to reach full.'] },
  { title: 'The line and the walls', art: 'line', p: [
    'Your lateral position is measured from the middle of the ice: the ice is 6 m wide, and the sled\'s centre can go 2.5 m either way before the runners touch the wall.',
    'The inside of a bend is shorter: the nearer you are to the inside edge, the faster you move along the chute through the bend. Steering and sliding sideways cost a little speed, so a straight, smooth line is quick.',
    'Touching the wall at speed takes up to 5.6 percent of your speed in one hit, and every second you scrape along a wall takes about 16 percent of your speed. A rut kicks the sled sideways by 0.9 to 1.8 m per second.'] },
  { title: 'Clean bends', p: [
    'A bend is clean if you did not touch a wall in it and your average distance from the gold line, from 8 m before the bend to 4 m after, was under 0.57 m. A perfect bend is under 0.24 m.',
    'The result card shows how many bends were clean, how many times you touched a wall, your top speed and your splits.'] },
  { title: 'Ghost and records', p: [
    'Your best time on each chute is saved with a ghost of that run, a translucent blue sled that slides beside you in the next run and a dot on the map. The gap to your best is shown after each split.',
    'Pausing does not change the run. A run that is not finished does not count towards a record.'] },
  { title: 'Watch & Learn', art: 'think', p: [
    'Watch & Learn plays a two-run cup with a computer slider that follows the line. It stops in front of the first bend, every fourth bend and every tight bend. At each stop it thinks (the time you set in Settings), reveals the line, and then slides on.',
    'Pause freezes everything exactly where it is. Think and Watch & Learn never change the real record and do not count against the free preview.'] },
  { title: 'Free preview', p: [
    'The first 90 seconds of live sliding are free. Menus, this page, Watch & Learn and result screens are always free. One purchase unlocks every chute and mode.'] },
  { title: 'Simplifications', p: [
    'Real sliders lie flat on the back and steer with both legs and shoulders; here one lean is all there is. The physics is a simplified model of speed, bank, slope and lateral force, built for play, and the chutes are invented. There is no fall or crash in this game: a wall costs you time.'] },
];
