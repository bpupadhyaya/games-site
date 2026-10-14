// All reader text (About, How to Play, Rules). Numbers come from consts.js so the Rules page always matches the engine.
import {
  ROUNDS, HORSES, FIELD, CIRCLE, FLAG_WIND, FLAG_RING, SCOOP_REACH, SCOOP_T, SCOOP_VMAX, STRIP_REACH, STRIP_CD, STRIP_BASE, STRIP_STR, STRIP_SHIELD,
  STRIP_TIRED, STRIP_MIN, STRIP_MAX, RECOVER_T, RESET_T, OVERTIME, GAUNTLET_TIME, SPRINT_MUL, STAM_DRAIN, CARRY_MUL, SHIELD_MUL, GROUNDS, TIRED,
} from './consts.js';

const pct = (v) => `${Math.round(v * 100)}%`;
const deg = (r) => `${Math.round(r * 180 / Math.PI)} degrees`;

export const ABOUT = [
  { title: 'Buzkashi', p: [
    'Buzkashi is a horse game of Central Asia, played for centuries across Afghanistan, Uzbekistan and the lands around them. The name is Persian and means "goat grabbing". Kazakh and Kyrgyz riders play the same kind of game under the names kokpar and kok boru.',
    'Riders crowd around a heavy object on the ground. One leans from the saddle and lifts it, carries it round a marker post at the far end of the field and brings it back to a marked circle, while everyone else rides alongside to take it from them. The fastest, strongest and cleverest riders, and the best trained horses, win the day.',
  ] },
  { title: 'Horses and riders', p: [
    'Riders spend years learning to ride and to lean, and the horses are partners in the game: good care for the horse always comes first. In this game nobody is ever hurt. Horses only tire and rest, and the object is a stuffed leather dummy, sewn in the shape of a calf: no animal is in the game.',
  ] },
  { title: 'About this version', p: [
    'This is a friendly, simplified team version in a short chukka (a round of play). You ride one horse with your thumb and your team mates are computer riders. Real matches are played in large open fields, often with dozens of riders and without teams; the Rules page lists each simplification.',
    'There are no gambling stakes. The score is only for fun.',
  ] },
  { title: 'Made with', p: [
    'Buzkashi is part of Arcforge, a collection of games from heritage traditions around the world. The horses, riders and field are modelled and drawn by the game itself, and all sounds are made by the game.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', p: [
    'Scoop the sack from the middle of the field, carry it round the post at the far end, then ride into the white circle at the near end. That is one carry and one point. Your rivals are trying to do the same, and to take the sack from you.',
  ] },
  { title: 'Ride', p: [
    'Put a finger on the field and hold it there: your rider heads for that spot. The nearer the finger is to the rider, the slower it rides. Lift the finger and the horse walks straight on. Keep the finger where you want to go, not on the rider.',
  ] },
  { title: 'Grab', p: [
    `Tap Grab when you are close to the loose sack, within ${SCOOP_REACH.toFixed(1)} metres, and riding slowly enough (less than ${SCOOP_VMAX.toFixed(0)} metres a second). The rider leans down and lifts it. Too fast and the sack is fumbled away.`,
    `When a rival has the sack, ride alongside (within ${STRIP_REACH.toFixed(1)} metres) and tap Grab to try to strip it away. It may take several tries.`,
  ] },
  { title: 'Shield', p: [
    'Hold Shield while you carry the sack to tuck it in. It makes you much harder to strip, but the horse is slower and tires a little.',
  ] },
  { title: 'Spur', p: [
    `Hold Spur for a burst of speed. It drains the stamina ring around your rider, so use it in the open. A blown horse is slower and easier to strip.`,
  ] },
  { title: 'Round the post', p: [
    'The sack only counts after it has gone round the post at the far end. A half turn on either side is enough. The gold ring on the post fills as you turn round it, and the sack glows gold once it has been rounded.',
  ] },
  { title: 'Your team', p: [
    'Your team mates ride on their own: they chase the loose sack, escort whoever carries it and chase rivals who have it. You can take the sack whenever you are the nearest.',
  ] },
  { title: 'Think', p: [
    'Tap the ? button for a hint. The chukka waits while a gold line shows what the game would do from where you are and says why. A hinted chukka cannot earn a third star.',
  ] },
  { title: 'Keyboard', p: [
    'Arrows steer, Space is Grab, S is Shield, B is Spur, T is Think, P pauses.',
  ] },
  { title: 'Other ways to play', p: [
    `Winter Cup: ${ROUNDS.length} rounds against better and better teams. Gauntlet: you alone against more and more rivals, ${GAUNTLET_TIME} seconds, three rival carries end it. Practice: choose your horse and rivals. Learn: three short drills. Watch & Learn: the computer rides and explains each decision.`,
  ] },
];

export const RULES = [
  { title: 'The game', p: [
    'Two teams of riders play a chukka against the clock. There is one sack. A team scores a point when one of its riders carries the sack round the post at the far end and into the scoring circle at the near end. The team with more points when the clock runs out wins.',
  ] },
  { title: 'The field', p: [
    `The field is ${FIELD.x1 - FIELD.x0} metres wide and ${FIELD.y1 - FIELD.y0} metres long, closed by a rope. The scoring circle (${CIRCLE.r} metres in radius) is at the near end. The post stands at the far end, in the middle. The sack starts every carry in the dotted ring in the middle of the field.`,
    'Riding into the rope slows the horse a little and costs nothing else.',
  ], art: 'field' },
  { title: 'A carry', p: [
    `1. Scoop the sack. 2. Carry it round the post: a rider carrying the sack within ${FLAG_RING} metres of the post counts the angle swept round it, in either direction, and the post is rounded once the sweep reaches ${FLAG_WIND.toFixed(1)} radians (${deg(FLAG_WIND)}). 3. Ride into the circle with the rounded sack and the carry is scored.`,
    'Riding into the circle with a sack that has not been round the post scores nothing and the rider has to ride out and round the post first.',
    'The sack stays rounded when it is stripped away or dropped, so a rider who takes a rounded sack can score it at once. It becomes unrounded again only when a carry is scored and a fresh sack is put in the middle.',
  ] },
  { title: 'Riding', p: [
    'The rider heads for the point where the finger touches the field. A horse turns more tightly when it is slower, and a hard turn costs a little speed. Each horse has a top speed, a turning ability and a strength.',
    `A rider carrying the sack is slowed to ${pct(CARRY_MUL)} of top speed, and to ${pct(SHIELD_MUL)} while shielding it.`,
  ] },
  { title: 'Horses', p: [
    `${HORSES.map((h) => `${h.name}: top speed ${h.vTop} metres a second, strength ${h.str.toFixed(2)}`).join('. ')}.`,
    `The ground changes the speed of every horse in the Practice mode: ${GROUNDS.map((g) => `${g.name} ${pct(g.k)}`).join(', ')}. Computer riders have their own horses: better teams ride faster, turn better and are harder to strip.`,
  ] },
  { title: 'Stamina and Spur', p: [
    `The ring round your rider is its stamina. Spur raises the top speed to ${pct(SPRINT_MUL)} and uses ${pct(STAM_DRAIN)} of the stamina every second. Stamina comes back while the horse is not spurred, faster when it is walking. Below ${pct(TIRED)} the horse is blown: it is slower and easier to strip.`,
  ] },
  { title: 'Scoop', p: [
    `Tap Grab with the sack within ${SCOOP_REACH} metres to start a scoop. The rider leans for ${SCOOP_T} seconds and is slower while leaning. If the horse is going faster than ${SCOOP_VMAX} metres a second the scoop is fumbled and the sack bounces away.`,
    'If two riders scoop at the same moment the one whose lean ends first gets it. A loose sack that has just been knocked away cannot be scooped for half a second.',
  ] },
  { title: 'Shield', p: [
    'A rider carrying the sack can hold Shield. The sack is tucked in close, the rider is slower and the horse uses a little stamina, but the carrier is harder to strip.',
  ] },
  { title: 'Strip', p: [
    `A rider without the sack can try to strip it from a rival carrier within ${STRIP_REACH} metres, once every ${STRIP_CD} seconds. The chance is ${pct(STRIP_BASE)} between equal riders, plus ${Math.round(STRIP_STR * 100)} percentage points for each point of strength difference, minus ${Math.round(STRIP_SHIELD * 100)} when the carrier shields, plus ${Math.round(STRIP_TIRED * 100)} when the carrier's horse is blown, and always between ${pct(STRIP_MIN)} and ${pct(STRIP_MAX)}.`,
    `A successful strip either gives the sack to the attacker or tosses it loose on the ground. The rider who lost it cannot grab for ${RECOVER_T} seconds.`,
  ] },
  { title: 'Contact', p: [
    'Riders cannot ride through each other. Stronger horses push weaker ones aside, and a hard collision at speed slows the weaker horse. There are no fouls in this version, so ride in close.',
  ] },
  { title: 'The clock', p: [
    `A chukka lasts from ${Math.min(...ROUNDS.map((r) => r.time))} to ${Math.max(...ROUNDS.map((r) => r.time))} seconds, depending on the round. After each carry the play stops for ${RESET_T} seconds and a fresh sack is put in the middle. A tie at the end goes into sudden death: ${OVERTIME} more seconds and the first carry wins. If nobody scores it is a draw.`,
  ] },
  { title: 'Winter Cup', p: [
    `The Cup has ${ROUNDS.length} rounds: ${ROUNDS.map((r) => `${r.name} (${r.size} against ${r.size})`).join(', ')}. Each is a single chukka against a computer team. One star for winning, two for winning by two or more carries, three for winning by three or more without using a hint. A round opens when you have won the one before.`,
  ] },
  { title: 'Gauntlet', p: [
    `You ride alone for ${GAUNTLET_TIME} seconds. A rival joins after every carry you score, and rivals get better. Every carry a rival scores is a strike: three strikes end the run. Your score is 100 points for every carry you score and one point for every second left on the clock when the run ends early.`,
  ] },
  { title: 'Practice and Learn', p: [
    'Practice has unlimited chukkas where you choose your horse, the ground and how many rivals ride against you. Learn has three short drills (The scoop, Round the post, Shield and strip) with a goal for each.',
  ] },
  { title: 'Watch & Learn', p: [
    'The computer rides your rider and explains. Whenever its plan changes (the sack is loose, it has the sack, it has been stripped) it stops and goes through three stages: Think (it works out what to do), Reveal (the plan and its line are drawn) and Act (play goes on). The thinking time is set in Settings (2 to 10 seconds). Pause stops everything and resumes exactly where it was.',
  ] },
  { title: 'Think hint', p: [
    'During your own chukka you can tap Think. Play waits and a gold line shows what the computer would do from where you are, with the reason. A chukka that used a hint cannot earn the third star.',
  ] },
  { title: 'Guide setting', p: [
    'Guided: a faint dashed line shows the way from the middle round the post and home, and the post shows its ring. Marks only: the ring on the post but no line. Off: nothing is drawn but the field.',
  ] },
  { title: 'Differences from the real game', p: [
    'Real buzkashi is played by many riders, often without teams or fixed rules, over hours, and the object is heavy. Here there are teams of two to four, short chukkas, a plain sack, one marker post and no fouls or referees. Riders are drawn larger than life so they can be seen on a phone.',
    'No animal is harmed in this game and nothing in it depends on chance bets or stakes.',
  ] },
  { title: 'Text size and controls', p: [
    'Every text screen can be enlarged from 100% to 300% with A+ and A-. Keyboard: arrows steer, Space is Grab, S Shield, B Spur, T hint, P or Escape pause, plus and minus change the text size on menus.',
  ] },
];
