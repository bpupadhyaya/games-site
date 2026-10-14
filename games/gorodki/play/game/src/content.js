// Text for About, How to Play and the Rules reference. Every rule claim below was checked against the engine: sim.js (the town, the
// bat, the pins, the out test, friction), figures.js (the fifteen figures and their bats), ai.js (the four rivals and the hints) and
// game.js (turns, scoring, stars, duels, the web demo). Numbers: town 2 m square, pins 0.30 m long drawn larger than life (real
// pins are about 0.2 m), bat 0.72 m long, landing scatter 3.5 cm to 6 cm sideways.
// A section is { title, art?, p: [paragraphs] }; the reader is one scrolling column, so nothing overflows at any text size.

export const ABOUT = [
  { title: 'A village game from Russia', art: 'town', p: [
    'Gorodki, which means "little towns", is a throwing game that has been played in the villages and towns of Russia and its neighbours for centuries. Players stand well back from a square marked on the ground, the "town", and throw a heavy wooden bat at a figure made of short wooden pins. The aim is to knock every pin out of the square with as few bats as possible.',
    'The figures have plain names that describe their shape: a cannon, a fork, a well, a star. They are set up from easy to hard, and a round of gorodki goes through them one after another.',
  ] },
  { title: 'How people play it', p: [
    'In the real game the thrower stands about 13 metres from the town (half that for the closer line) and throws the bat so that it lands short and skids into the pins. A pin only counts when it comes to rest completely outside the line of the square. Clubs and federations play it as a sport today, and in winter it is also a game for the village green.',
    'Rules and the names of the figures differ from place to place.',
  ] },
  { title: 'This version', p: [
    'Gorodki on your phone is a game of planning and touch. You choose where the bat lands and how it is thrown, and then real physics does the rest: the bat slides, pins tip over, slide and knock each other out of the square. Pins and bat are drawn larger than life so they read on a phone, and the long throwing distance is shortened on screen.',
    'There are fifteen figures to clear one by one, with stars for using few bats, and duels against four computer players who read the figure with the same physics you play with. Watch & Learn shows two computer players think through a figure, step by step.',
  ] },
  { title: 'Ways to play', p: [
    'Figure ladder: clear the fifteen figures in order, alone. Duel: you and a computer player take turns at the same figures, and the one who needs fewer bats wins each figure. Watch & Learn: sit back and see why a good player chooses each throw. Think gives you advice at any time. Text size goes up to 300% and long screens scroll.',
  ] },
];

export const HOWTO = [
  { title: 'The idea', art: 'town', p: [
    'A figure of pins stands in the red square. Knock every pin out of the square, so that it lies completely outside the line, using as few bats as you can. Pins that fall over but stay inside the square stay where they lie, and they have to be knocked out too.',
  ] },
  { title: 'Throwing a bat', p: [
    'Touch and drag in the town to move the landing ring. This is where the bat lands: after landing it keeps sliding on, in the same direction, into the figure. The yellow lane shows how far it will carry and how wide it sweeps.',
    'Pick a style below. Sweep is slow and sideways: it brushes through a whole row of pins gently. Drive goes end first and is narrow and firm. Smash is end first and very hard: it sends pins far, but it is harder to place.',
    'Press Throw. Every throw scatters a little around the ring, more with Smash than with Drive.',
  ] },
  { title: 'Reading the figure', p: [
    'Think works out a good throw with the same physics as the game and puts the ring there. Pins that are knocked out of the square are gone. What is left lies where it fell, so the next throw is a fresh puzzle. Often the best bat is not the one that knocks out the most pins but the one that leaves the rest easy.',
    'You get a set number of bats for each figure. Stars: fewer bats earn more stars, down to one star for the last bat.',
  ] },
  { title: 'Duels and Watch & Learn', p: [
    'In a duel you and a rival each play the same figure from the start, one after the other. The one who clears it with fewer bats wins the figure. A figure you do not clear counts as worse than any that is cleared. Win more of the five figures than your rival to win the match.',
    'Watch & Learn plays two computer players through a figure. Each throw has a think time (you set how long), then the choice is shown with the reason, then the bat flies. Pause at any time.',
  ] },
];

export const RULES = [
  { title: 'The town', art: 'town', p: [
    'The town is a square 2 metres on a side, marked with a painted line. A figure of pins stands inside it, centred. Beyond the line is open snow, and the bat and pins that leave the square slide on until they stop or reach the banks and the fence.',
    'Pins are drawn about 0.26 m long (real pins are about 0.2 m), a little larger than life so that they show well on a phone. The bat is about 0.8 m long (a real bat is about 1 m).',
  ] },
  { title: 'The fifteen figures', art: 'figures', p: [
    'The figures, from easiest: Gate, Cannon, Tongs, Fork, Sickle, Well, Arrow, Chain, Star, Aeroplane, Crayfish, Sentries, Letter, Window, Rocket. They have from 5 to 16 pins. Each figure comes with its own number of bats: 3 for the small ones, up to 6 for the biggest.',
  ] },
  { title: 'Aiming', art: 'aim', p: [
    'You choose a landing point inside the throwing zone: left and right across the town, and short or long, from just in front of the town to well inside it. The bat is thrown from far in front of the town, so it arrives at the landing point on a slightly slanted line. The landing ring and lane show exactly this line.',
    'After landing the bat slides on in the same direction, slowing down by friction, until it stops or leaves the area.',
  ] },
  { title: 'The three styles', art: 'styles', p: [
    'Sweep: the bat lands sideways and slides at about 3.3 m/s. It is wide (the whole bat meets pins) but gentle. Scatter about 4.5 cm sideways.',
    'Drive: the bat lands end first and slides at about 5 m/s. It is narrow and firm. Scatter about 3.5 cm sideways and 8 cm in depth: the most accurate style.',
    'Smash: end first at about 7.4 m/s. It sends pins far and chains of pins fly out together, but the scatter is about 6 cm sideways and 12 cm in depth.',
  ] },
  { title: 'What the bat does', p: [
    'The bat is heavy, about six times as heavy as a pin. When it meets a pin, the pin is pushed away and tips over; the bat is slowed a little and may turn. A bat that meets a pin off-centre turns more. Every pin that is hit tips over. It then slides until friction stops it, and it knocks other pins on the way.',
  ] },
  { title: 'When a pin is out', p: [
    'When everything has stopped, each pin is checked. A pin is out only when no part of it touches the line or the inside of the square. A pin lying across the line is still in. Pins that are out are removed. Pins that are in stay exactly where they lie, standing or fallen, and block the next bat.',
  ] },
  { title: 'Bats and stars', p: [
    'Each figure gives you a number of bats (3 to 6). Clear the figure by knocking out every pin within them. The stars are: the last bat you have earns one star, one bat fewer earns two stars, two bats fewer or better earns three stars. If you use all your bats and pins are still in, the figure is not cleared and earns no stars.',
    'A figure is open to play in the Figure ladder when the one before it has been cleared.',
  ] },
  { title: 'Duel', p: [
    'In a duel, you and a computer player each take a turn at the same figure, starting from a fresh set of pins. Who goes first alternates. A cleared figure counts the bats used; a figure not cleared counts as more than any cleared one. Fewer bats wins the figure. A tie scores for nobody.',
    'A duel is five figures. The one who wins more figures wins the match. If it is level, one extra figure decides it; if that is level too, the match is a draw. The early rivals play figures from the easier part of the ladder, Old Pavel from the whole ladder.',
  ] },
  { title: 'The computer players', p: [
    'Each computer player tries many throws on a copy of the town with the same physics as yours and picks one, then throws it with its own scatter. Mitya picks from a wide shortlist and scatters a lot; Varya is steadier; Grisha picks from the best three; Old Pavel picks the best throw and scatters the least. The same planner gives you the Think hint.',
  ] },
  { title: 'Watch & Learn and Think', p: [
    'Watch & Learn plays two computer players through a figure. Before each throw there is a think time (2, 5, 8 or 10 seconds, your choice), then the candidates and the choice are shown with a short reason, then the throw. Pause stops everything where it is, including the bat in the air.',
    'Think can be pressed any time it is your turn. It moves the ring and the style to the best plan it can find and says what it expects.',
  ] },
  { title: 'The free preview', p: [
    'The first ninety seconds of real play are free. Menus, Watch & Learn and the reference pages never count. The web demo has the first three figures and two duel figures, and the full game has everything.',
  ] },
];
