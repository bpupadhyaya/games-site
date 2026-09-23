// "About the game": a short museum-label reading. Every statement here is documented; see design/GDD.md for the list of
// what was left out because it could not be verified. The wedge patterns on the board frame are decoration, not writing.
//
// Each page holds ONE complete, short sentence -- never a mid-sentence fragment. A concept that
// needs more than one sentence repeats its own title across consecutive pages (the "Page X of Y"
// footer plus the same heading is the continuation cue, the same convention every other game in
// this family uses), rather than the earlier "(cont. N)" title suffix this page used to carry.
// At the 300% text-size step even a short sentence can only wrap a few times before the panel runs
// out of room (see the panel/column sizing in view.js), so each sentence here is kept genuinely
// short; every one was measured against the real wrapped line count at the top text-size step, not
// eyeballed, before landing here.
export const HERITAGE = [
  { title: 'The Game of Twenty Squares', body: 'This race game was played more than four thousand years ago.' },
  { title: 'The Game of Twenty Squares', body: 'It was played in Mesopotamia, in what is now Iraq.' },
  { title: 'The Game of Twenty Squares', body: 'It was also played across the ancient Near East.' },
  { title: 'The Game of Twenty Squares', body: 'Today it is called the Royal Game of Ur.' },
  { title: 'The Game of Twenty Squares', body: 'That name comes from the city where its best-known boards were found.' },
  { title: 'The Game of Twenty Squares', body: 'It is one of the oldest board games whose boards survive.' },
  { title: 'The boards from Ur', body: 'Archaeologist Leonard Woolley dug at the Royal Cemetery of Ur.' },
  { title: 'The boards from Ur', body: 'He worked there between 1922 and 1934.' },
  { title: 'The boards from Ur', body: 'The cemetery is in southern Iraq.' },
  { title: 'The boards from Ur', body: 'Among the finds were several game boards.' },
  { title: 'The boards from Ur', body: 'They are dated to about 2600-2400 BCE.' },
  { title: 'The boards from Ur', body: 'The best known board is in the British Museum.' },
  { title: 'The boards from Ur', body: 'It is wood inlaid with shell, red limestone, and lapis lazuli.' },
  { title: 'Rules from a clay tablet', body: 'No rules survive from the age of the boards themselves.' },
  { title: 'Rules from a clay tablet', body: 'A Babylonian clay tablet from about 177 BCE describes how the game was played.' },
  { title: 'Rules from a clay tablet', body: 'That tablet is also in the British Museum.' },
  { title: 'Finkel\'s reconstruction', body: 'Irving Finkel, a curator at the British Museum, studied that tablet.' },
  { title: 'Finkel\'s reconstruction', body: 'In the 1980s, he published a reconstruction of the rules.' },
  { title: 'Finkel\'s reconstruction', body: 'This game uses the version most widely played today, which follows his reading.' },
  { title: 'Pyramid dice', body: 'Moves are set by dice shaped as small pyramids.' },
  { title: 'Pyramid dice', body: 'Two of each die\'s four corners are marked.' },
  { title: 'Pyramid dice', body: 'A roll counts how many marked corners land face up.' },
  { title: 'Pyramid dice', body: 'Each player has seven pieces on a path of fourteen squares.' },
  { title: 'Pyramid dice', body: 'A piece must leave the board on an exact throw.' },
  { title: 'A game that travelled', body: 'Boards with these same twenty squares turn up across the ancient Near East.' },
  { title: 'A game that travelled', body: 'One was even found in Egypt, on the back of a game box.' },
  { title: 'A game that travelled', body: 'That box was found in the tomb of Tutankhamun.' },
  { title: 'A game that lasted', body: 'The game stayed in play for over three thousand years.' },
  { title: 'A game that lasted', body: 'A related game was still remembered in the twentieth century.' },
  { title: 'A game that lasted', body: 'It was played by the Jewish community of Cochin, in southern India.' },
  { title: 'About this version', body: 'This board is drawn after the inlaid boards from Ur.' },
  { title: 'About this version', body: 'It uses lapis blue, shell, and red limestone, with rosettes.' },
  { title: 'About this version', body: 'The small wedges on the frame are decoration, inspired by cuneiform.' },
  { title: 'About this version', body: 'Cuneiform is the wedge-shaped script of Mesopotamia.' },
  { title: 'About this version', body: 'The wedges are not writing, and say nothing.' },
];
