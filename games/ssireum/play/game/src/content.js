// Text for About, How to Play and the Rules reference. Every rule claim below was checked against the engine:
//   sim.js  disc radius 1 (a dot at 1 or more is a fall); pull 0.30 / 0.52 / 0.72 of the disc per power at full grip, scaled 55 % (grip 0)
//           to 100 % (grip 5); recoil 0.10 x power the other way; root soaks 40 / 68 / 92 % x cos(angle) of a pull, and settles the dot
//           (x0.78 / 0.72 / 0.68 per beat instead of x0.86); hook 0.24 / 0.38 / 0.52 x grip scale x (0.45 + 1.25 x loaded), loaded = the
//           rival's distance from centre (+0.38 when they pulled this beat, at most 1), it ignores roots, whiffs below 0.22 loaded
//           (extra recoil 0.13 x power), base recoil 0.06 x power; grip starts at 4 of 5, costs: pull/root 0 / 1 / 2, hook 1 / 2 / 3,
//           returns 1 per beat; third root in a row = caution, dot nudged 0.3 back; both off the disc: the farther one falls, a dead
//           heat settles both; match is best of three falls.
//   ai.js   five rivals (memory of your last beats, noise, mistakes), the Think coach.
//   game.js choosing time 15 / 10 / 25 s or none; the 90 s preview; the demo cap.
// A section is { title, art?, p: [paragraphs] }; the reader lays the text out so nothing overflows at any text size.

export const TIMERS = [{ label: '10 s', s: 10 }, { label: '15 s', s: 15 }, { label: '25 s', s: 25 }, { label: 'Off', s: 0 }];

export const ABOUT = [
  { title: 'Ssireum', art: 'stage', p: [
    'Ssireum is the traditional wrestling of Korea. Two wrestlers kneel facing each other on a ring of sand, each grips the other\'s sash (the satba) with a hand round the waist and a hand on the thigh band, and they rise together. The first to touch the sand with any part of the body above the knee loses the fall.',
    'It has been wrestled for centuries at festivals such as Danoh in early summer and Chuseok in autumn, it was a favourite subject of painters of the Joseon era, and it has a professional league and televised tournaments today. In 2018 the tradition was inscribed on the UNESCO list of the intangible cultural heritage of humanity. Weight classes are named after mountains: Taebaek, Geumgang, Halla and Baekdu.',
  ] },
  { title: 'This version', p: [
    'Ssireum turns the grip-fight into a duel of reading. You never steer a limb: both wrestlers secretly choose one move each beat, then the moves play at once on two balance discs. Send the rival\'s balance over the edge of their disc before yours goes over the edge of yours.',
    'Play five rivals named for the weight classes, share one phone with a friend (pass the phone, each choice stays hidden), or play Watch & Learn: two computer wrestlers play a whole match and explain every choice, with a real Pause.',
  ] },
  { title: 'Rings', p: [
    'Danoh Festival is a daytime ring under pines and far mountains, Harvest Moon is a lantern-lit night under a big moon, and Courtyard Dusk is a sand ring inside a tiled-roof courtyard at sunset. The rings only change the look; the rules are the same.',
  ] },
  { title: 'About the rules', p: [
    'The game keeps the heart of the sport: the sash grip, the leg hooks, the lift and pull-in, the first body to the sand loses, best of three falls. It is a simplification of a fast, physical sport, and the Rules pages say exactly how everything in the game works. All wrestlers are made-up characters; none is a real athlete.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'stage', p: [
    'You are the wrestler on the left. Each wrestler has a balance dot on a round disc. Push the rival\'s dot over the edge of their disc and they are down; if your own dot goes over first, you are. Win two falls to win the match.',
  ] },
  { title: 'Two discs', art: 'disc', p: [
    'The left disc is yours and the right disc is theirs. Up on a disc always means toward the rival. The dot is where the weight is. Near the edge (the red band) one good move is enough.',
  ] },
  { title: 'Choosing a move', art: 'moves', p: [
    'Every beat you pick three things, then Lock in. First the kind: PULL sends their balance toward a side of their disc; HOOK is a leg hook that goes through a root but only works on a wrestler who is loaded (off-centre, or who has just pulled); ROOT soaks up the pull you expect.',
    'Second the direction: tap one of the eight petals. For Pull and Hook tap THEIR disc, where you want their balance to go. For Root tap YOUR disc, the side you expect to be sent toward. Third the power: Light, Firm or Full.',
    'You choose at the same moment as the rival, and both moves play at once. A tap on the same petal twice locks it in.',
  ] },
  { title: 'Grip', art: 'grip', p: [
    'Power costs grip: Firm costs 1 and Full costs 2 (a hook costs 1 more). Grip comes back by 1 each beat, and a tired grip pulls weaker. Spend it when it counts.',
    'Pulling leans you back the other way, so a hard pull leaves your own dot off-centre. Every dot also settles toward the middle between beats; a Root settles it fastest.',
  ] },
  { title: 'Reading the rival', p: [
    'The best attack is usually the one that sends their dot outward, so a clever rival roots on that side. Break the pattern: send them sideways, hook the wrestler who has just rooted or just pulled, and do not repeat yourself, because the rival remembers your last few beats.',
    'Think asks the coach for the best move and why. Watch & Learn plays whole matches between two computer wrestlers and explains each choice.',
  ] },
];

export const RULES = [
  { title: 'Winning', art: 'fall', p: [
    'A fall is won when the other wrestler\'s balance dot reaches the edge of their disc. A match is the best of three falls: the first wrestler to win two falls wins.',
    'If both dots go over the edge in the same beat, the dot that is farther out falls. If they are level (within a hair), both wrestlers slip, both dots settle, and play goes on.',
  ] },
  { title: 'The disc', art: 'disc', p: [
    'Each disc has a radius of 1. The dot starts in the centre. The dot is measured in its own wrestler\'s frame: up is toward the rival, and the right of the disc is that wrestler\'s right. The eight petals are forward, forward right, right, back right, back, back left, left and forward left.',
    'The red band is the outer third of the disc. When a dot is in it, the dot throbs: the wrestler is close to falling.',
  ] },
  { title: 'A beat', p: [
    'A beat has three steps. Both wrestlers choose a move in secret (against the clock if the choosing timer is on). Then both moves are revealed and applied at the same time. Then each dot settles a little toward the centre and the next beat begins.',
    'In a beat each dot moves by what the rival\'s move sends it, minus what a Root soaks, plus its own recoil, after settling. A dot that ends the beat at the edge or beyond has fallen.',
  ] },
  { title: 'Pull', art: 'moves', p: [
    'A Pull sends the rival\'s dot toward the petal you tap on their disc. Light moves it 0.30 of the disc radius, Firm 0.52 and Full 0.72, when your grip is full. A spent grip pulls weaker: from 55 % of those values at grip 0 up to 100 % at grip 5.',
    'Pulling leans you the other way: your own dot moves 0.10 times the power in the opposite direction (a Full pull recoils your dot 0.30 away). A pull toward the front of their disc draws them in and rocks you back; a drive toward the back of their disc rocks you forward.',
  ] },
  { title: 'Root', p: [
    'A Root is chosen on your own disc: the petal is the side you expect to be sent toward. It soaks a Pull in proportion to how well the directions match: Light soaks 40 %, Firm 68 % and Full 92 % of an exactly matching pull. A pull toward a neighbouring petal is soaked at 71 % of that, and a pull toward any petal at a right angle or beyond is not soaked at all.',
    'A Root does not stop a Hook. A rooted wrestler also settles faster between beats: the dot keeps 0.78 (Light), 0.72 (Firm) or 0.68 (Full) of its offset, against 0.86 when pulling or hooking.',
  ] },
  { title: 'Hook', p: [
    'A Hook is a leg hook toward the petal you tap on their disc. It is not soaked by a Root. Its strength is 0.24, 0.38 or 0.52 (Light, Firm, Full) times the grip scale times (0.45 + 1.25 times how loaded the rival is).',
    'Loaded means how far their dot is from the centre, and a further 0.38 if they pulled in this same beat (their weight was committed), up to a maximum of 1. A hook against a centred wrestler is weak, and if loaded is below 0.22 the hook whiffs and you lose balance: an extra 0.13 times the power on your own dot, on top of the ordinary hook recoil of 0.06 times the power.',
  ] },
  { title: 'Grip', art: 'grip', p: [
    'Grip runs from 0 to 5 and starts each fall at 4. Pull and Root cost 0, 1 or 2 grip (Light, Firm, Full). A Hook costs 1, 2 or 3. You cannot choose a move you cannot pay for; the button is greyed.',
    'After every beat you get 1 grip back, up to 5. If you spend your grip freely the next beats will be weak, and a rival that keeps its grip can wait for the moment.',
  ] },
  { title: 'Caution (passivity)', p: [
    'Rooting again and again is not wrestling. The third Root in a row earns a caution: the referee moves you back, and your dot is nudged 0.3 backward before the beat is judged. The count then starts again.',
  ] },
  { title: 'Choosing time', p: [
    'If the choosing timer is on (15 s by default, adjustable in Settings), a beat is locked in for you when it runs out: what you have selected is played, or a Light Root toward the front if you had selected nothing. The timer stops while the game is paused and while Think is open.',
  ] },
  { title: 'Think and Watch & Learn', p: [
    'Think shows the coach\'s best move for you in this beat and why, and marks the petal on the disc. It never plays the move for you. In Watch & Learn two computer wrestlers play whole matches: each beat they THINK (the time is adjustable), the plan of both is REVEALED with a plain reason, and then both moves are played. Pause freezes everything exactly where it stopped, and the speed button runs it three times faster.',
  ] },
  { title: 'Two players', p: [
    'In two-player matches Player 1 is the wrestler on the left. Both choose on the same phone: Player 1 locks in, a cover hides the choice and asks you to pass the phone, then Player 2 chooses and locks in, and both moves play. Think is off in two-player matches and the timer applies to each player.',
  ] },
  { title: 'The rivals', p: [
    'Minjae (Taebaek class) is quick but repeats himself. Yuna (Geumgang) hooks the wrestler who over-commits. Seojun (Halla) roots and waits. Haneul (Baekdu) reads your habits. Doyun, the grand champion, remembers your last beats, rarely errs, and is hard to move.',
    'A computer wrestler weighs every move it can pay for against the moves you are likely to make, from what a sensible wrestler would do and from what you did in the last few beats. Weaker rivals add noise and make slips; stronger ones remember more.',
  ] },
  { title: 'What is simplified', p: [
    'Real ssireum begins from a kneeling grip and is decided by any body part above the knee touching the sand; the game shows that as a balance dot leaving its disc, and the looks of the throws follow the dots rather than a physical simulation. There is no time limit, no ring-out and no scoring beyond the fall, and the techniques named in the game (belly lift, inside and outside leg hooks, sickle hook) are used as plain labels for the directions.',
  ] },
  { title: 'The free preview', p: [
    'The free preview counts 90 seconds of real play against a rival. Menus, this reference, Watch & Learn and a paused game do not use it. After that the full game is unlocked once, with no ads.',
  ] },
];
