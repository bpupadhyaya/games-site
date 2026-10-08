// About, How to Play and the Rules reference. Every number here is checked against sim.js (windows, costs, sync, stamina, brace, anchor, coach, levels).
// A section is { title, p: [paragraphs], art?: diagram key } and the reader lays them out as one scrolling document that follows the text-size setting.
export const ABOUT = [
  { title: 'Tug of War', p: [
    'A rope, a flag, a chalk line and eight people leaning back as hard as they can. Tug of war is played at village fairs, school sports days and harvest festivals all over the world, and the best teams never just pull: they pull together, on the beat, and they know when to rest.',
    'This version puts real people on the rope. Your team leans, digs in and grips; you give the chant its rhythm with your finger, call the anchor and the coach, and decide when to hold on and when to heave.'] },
  { title: 'The grounds and the teams', p: [
    'Six festival grounds: a harvest green with hay bales, a riverside fair, a mountain meadow, a seaside games day, a night of lanterns and the grand festival arena. Eight village teams from every kind of place meet you in a bracket.',
    'Play the bracket, a quick match, the Daily Pull, or two players on one device with the screen split in half. Watch & Learn teaches the rhythm with a computer teammate.'] },
  { title: 'Free preview and unlock', p: [
    'The first 90 seconds of real pulling are free. Menus, Rules, About, Watch & Learn and paused time never count against it. After that, one unlock opens the whole game. Settings has Restore purchases.'] },
  { title: 'Made with', p: ['Arcforge heritage games. Human figures: Microsoft Rocketbox avatars (MIT) and motion data credited under Credits and licences below.'] },
];

export const HOWTO = [
  { title: 'Pull on the beat', art: 'ring', p: [
    'A chant sets the beat. Rings close on the target at the bottom of the screen. TAP anywhere as a ring lands on the target and your team heaves.',
    'Perfect timing pulls hardest, costs the least stamina and builds team sync. A tap off the beat is a jerk: it barely pulls and breaks the sync.'] },
  { title: 'Dig in', p: [
    'After you tap, keep your finger DOWN to dig in. The longer you hold (about a third of a second for a full brace), the more of the rivals\' pull you block, and your stamina comes back.',
    'Do not hold too long: after about two and a half seconds the grip cramps and weakens. Let go before the next beat so you can tap again.'] },
  { title: 'Rival surges', art: 'surge', p: [
    'Every few beats the rivals gather themselves and SURGE with double force. A red warning ring closes one beat ahead. Tap on your beat, then HOLD your finger through the surge to block most of it.',
    'A blocked surge gives your team sync and takes it from them. A surge that hits you costs you sync.'] },
  { title: 'Anchor and coach', art: 'calls', p: [
    'ANCHOR: the last person wraps the rope round their waist. For five seconds the rivals\' pulls are halved and the rope slows. You have two per pull.',
    'COACH: perfect and good heaves fill the coach meter. When it is full, tap COACH: for four seconds the timing windows are much wider, your team pulls together and heaves cost less stamina.'] },
  { title: 'Stamina and winning', art: 'bar', p: [
    'Every heave tires your team. Watch the STAMINA bar: when it runs low, dig in and breathe. The rivals tire too: when THEM says GASPING, push.',
    'Win a pull by bringing the flag across your line, or by having the flag on your side when the 45 seconds are up. Win two pulls to win the match.'] },
  { title: 'Think and Watch & Learn', p: [
    'THINK tells you the best move right now and pauses the pull while you read. Watch & Learn plays a whole pull with a computer teammate and stops at the key moments to explain them.'] },
  { title: 'Two players', p: [
    'Choose Two Players: each player has their own half of the screen, their own beat ring, stamina, anchor and coach. The second player\'s half is turned upside down in portrait so you can sit face to face. Both teams chant the same tempo, half a beat apart.'] },
  { title: 'Keyboard', p: ['Space = tap and hold. A = anchor. C = coach. T = think. P or Escape = pause. Two players: player 1 uses Space, A and C; player 2 uses Enter, ArrowLeft (anchor) and ArrowRight (coach).'] },
];

export const RULES = [
  { title: 'The contest', p: [
    'Two teams of four stand on a rope, facing each other. A flag is tied to the middle of the rope above a chalk line on the ground. Your team is side A; in a single-player match the rivals are side B.',
    'Each team has a win line 1.6 metres from the centre line. The flag moves toward the team that is winning the pull.'] },
  { title: 'Winning a pull', art: 'bar', p: [
    'A pull is won when the flag reaches a team\'s win line. After 45 seconds of pulling, the side the flag is on wins. If the flag is within 4 centimetres of the centre line at that moment, the team with more stamina wins.',
    'The bar at the top shows where the flag is between the two lines; your line is on the left.'] },
  { title: 'Matches and modes', p: [
    'Bracket: three matches (quarter-final, semi-final, final), each first to two pulls, each on a different ground. You choose the difficulty; the rivals get stronger by one level each round, up to Legend, and the final is always at the Grand Festival.',
    'Quick match: one match against any team on any ground, first to two pulls. Daily Pull: one pull whose rival, ground and strength depend on the date. Two players: first to two pulls on one device. Watch & Learn: one pull with the computer on your side.',
    'After a pull the next one starts with tired arms: stamina begins at 100% in the first pull and at 85% plus 5% for every pull that team has won in later pulls.'] },
  { title: 'Take the strain', p: [
    'Each pull starts with a three second count. The chant beat runs from the start so you can find it. Taps during the count make your team move but pull nothing and count for nothing.'] },
  { title: 'The beat and the heave', art: 'ring', p: [
    'Your team heaves when you tap. The sim compares the moment of your tap with the nearest chant beat: within 0.075 s is PERFECT (full strength), within 0.14 s is GOOD (72%), within 0.21 s is OK (42%), anything else is OFF BEAT, a jerk (12%).',
    'While the coach call is active the three windows are 1.7 times as wide. A second tap less than 0.3 s after a heave is a rush: it pulls nothing and costs 0.1 sync.',
    'Rivals chant the same tempo as you, half a beat later, so the rope rocks back and forth twice per beat. The tempo depends on the level: 1.0 s per beat on Friendly, 0.95 Local, 0.9 Regional, 0.85 Champion, 0.8 Legend. Two players always use 0.9 s.'] },
  { title: 'Team sync', p: [
    'Sync runs from 0 to 1 and starts at 0.25. A perfect heave adds 0.14, a good one 0.07, an OK one takes 0.02, an off-beat tap takes 0.3, a rush takes 0.1. It fades by 0.02 per second when nobody has heaved for about one second.',
    'Every heave is multiplied by 0.55 plus 0.75 times sync: from x0.55 (no sync) to x1.30 (full sync).'] },
  { title: 'Stamina', art: 'stamina', p: [
    'Stamina runs from 0 to 1. A perfect heave costs 0.05, a good one 0.06, an OK one 0.07, an off-beat tap 0.10. With the coach call active the cost is 60% of that.',
    'At 0.45 and above the team pulls at full strength; below that the strength falls in a line to 40% at 0 and, from 0.08 down, the arms are gone and a heave pulls only 30%.',
    'Stamina comes back by 0.035 per second when your team has not heaved for half a second, and by 0.10 per second while it is braced (a brace above 50%). A rival with less than 0.22 stamina stops heaving and rests until it has 0.5 again; the screen says THEM: GASPING.'] },
  { title: 'Digging in', p: [
    'Holding your finger down builds a brace from 0 to full over 0.35 seconds; letting go drops it in 0.15 seconds. A tap alone gives only a little. A full brace blocks 35% of every normal rival heave and 80% of a surge, and the rope coasts less for both sides (its speed fades up to 35% faster).',
    'Cramp: while your brace is above 60% a hold timer runs. Past 2.5 seconds the grip loses strength, down to 40% at about 6 seconds. The timer drops by half a second per second when you are not braced.'] },
  { title: 'Rival surges', art: 'surge', p: [
    'Computer rivals heave on their beat with timing errors that depend on their level, and now and then skip a beat. Every 8, 6, 5, 4 or 3 of their beats (Friendly to Legend, a little random) and while they have more than 0.45 stamina they SURGE: an always-perfect heave with 2.1 times the force that costs four times the stamina.',
    'The beat before a surge a red ring appears. A surge that meets a brace above about 60% (after the 80% block, more than half of it stopped) is BLOCKED: you gain 0.1 sync and they lose 0.15. A surge that does not is a HIT: you lose 0.15 sync.',
    'Rivals also keep a light brace of 30%, which stops about a tenth of each of your heaves. Their heave strength is multiplied by 0.95 (Friendly), 1.1, 1.28, 1.5 and 1.75 (Legend).'] },
  { title: 'The anchor call', art: 'calls', p: [
    'Each team has two anchor calls per pull. Tap ANCHOR: for five seconds incoming pulls are halved (on top of any brace: the blocked share is one minus half of what the brace does not block), your own heaves are 85% as strong, and the rope coasts less (its speed fades 40% faster).',
    'The rival anchor is used once when the flag has been pulled more than 0.9 m toward you after eight seconds, and once more after 25 seconds if the flag is back near the centre and a call is left.'] },
  { title: 'The coach call', p: [
    'Perfect heaves add 20% to the coach meter, good heaves 10% (the meter does not fill while the call is active). At 100% tap COACH: for four seconds the timing windows are 1.7 times as wide, sync is at least 0.85, every heave is 15% stronger and costs 60% of the stamina. The meter then starts again from zero.'] },
  { title: 'How the rope moves', p: [
    'Every heave gives the rope a push of 0.5 metres per second times its strength and, after anything the other side blocks, the push is added to the rope\'s speed. The speed fades with a time constant of 0.7 seconds, so one perfect, fully synchronised heave moves the flag about 40 centimetres if nobody pulls back.',
    'When the pull ends the rope settles quickly while the winners cheer and the losers stumble over the line.'] },
  { title: 'Two players', p: [
    'Each player has a half of the screen and their own ring, stamina, sync, anchor and coach. Side A heaves on the beat, side B half a beat later. There are no surges; a brace blocks 35% of the other player\'s heave. Holding too long cramps your grip exactly as in single play.'] },
  { title: 'The difficulty levels', art: 'levels', p: [
    'Friendly: timing noise 0.15 s, strength 0.95, a surge every 8 beats, 1.0 s beat. Local: 0.12 s, 1.10, every 6, 0.95 s. Regional: 0.09 s, 1.28, every 5, 0.90 s. Champion: 0.065 s, 1.50, every 4, 0.85 s. Legend: 0.045 s, 1.75, every 3, 0.80 s.',
    'In the bracket the starting difficulty you pick is the first round; the second round is one level up and the final two levels up (never above Legend).'] },
  { title: 'Think, Pause and Watch & Learn', art: 'think', p: [
    'Think shows what a good coach would do at this moment and stops the pull while you read it. Pause stops everything. Neither counts against the free preview.',
    'Watch & Learn plays one pull against a Local team with a computer on your side who pulls with small timing errors. It stops at the key moments: the first beat, a rival surge, low stamina, the anchor, the coach and rival fatigue, each shown once. The loop is THINK (2, 5, 8 or 10 seconds, you choose in Settings), REVEAL (2 seconds, the action highlighted) and ACT. Pause freezes the whole loop and resumes exactly where it stopped.'] },
  { title: 'Records and the free preview', p: [
    'The game remembers your best flag lead, longest run of perfect heaves, matches won and bracket titles on this device. The first 90 seconds of live pulling are free (menus, Rules, About, Watch & Learn, cards and pauses never count). The web demo allows three pulls.'] },
];
