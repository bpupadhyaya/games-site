// On-screen labels in two full presentations: English, and Turkish (traditional Okey terms). The player picks one in
// Settings; they are never mixed. The About / How to Play / Rules pages are English and carry a glossary.
import { COLOR_NAMES, COLOR_NAMES_TR, isFake } from './rules.js';

const EN = {
  tagline: 'The tile game of Turkey', tagline2: 'Four at the table. Offline. Points only.',
  play: 'Play', cont: 'Continue', newMatch: 'New match', watch: 'Watch & Learn', howto: 'How to Play', rules: 'Rules', about: 'About', settings: 'Settings',
  soundOn: 'Sound On', soundOff: 'Sound Off', offline: 'Offline. No ads. No chips, no stakes.',
  dealsWon: 'Deals won', matchesWon: 'Matches won', bestMatch: 'Best match score',
  sound: 'Sound', opponents: 'Opponents', matchLen: 'Match length', assist: 'Tell me when I can finish', labels: 'Labels',
  textSize: 'Text size', thinkTime: 'Watch & Learn think time', on: 'On', off: 'Off', deal1: 'deal', deals: 'deals', back: 'Back', next: 'Next', done: 'Done',
  menu: 'Menu', exit: 'Exit', page: 'Page', deal: 'Deal', stack: 'Stack', score: 'Score', okeyIs: 'OKEY', indicator: 'Indicator',
  take: 'TAKE', draw: 'DRAW', discard: 'DISCARD', sortRuns: 'Runs', sortSets: 'Sets', smart: 'Smart', hint: 'Hint', inSets: 'In sets',
  paused: 'Paused', resume: 'Resume', pause: 'Pause', quit: 'Quit to menu', watching: 'Watch & Learn', think: 'Think', speed: 'Speed',
  phThink: 'THINK: what would you do?', phReveal: 'REVEAL: the options and the chosen move', phAct: 'PLAY',
  yourDraw: 'Your turn. Tap the stack to draw, or the glowing pile on your left to take its tile.',
  yourDiscard: 'Drag a tile onto your pile to discard it, or tap a tile and press Discard.',
  yourFirst: 'You start this deal with 15 tiles. Arrange them, then discard one.',
  thinking: 'is thinking...', starts: 'starts the deal.', coach: 'Drag tiles to build runs (4-5-6 in one colour) and sets (7-7-7 in different colours). A green line shows a valid group.', resumed: 'Welcome back. Your deal continues.',
  dThinkDraw: 'THINK: draw from the stack, or take the pile on the left? Which helps this rack more?',
  dThinkDiscard: 'THINK: which tile is least useful to keep?',
  limitTitle: 'Web preview ends here', limitBody: 'Get the full game on iPhone and Android to keep playing: every deal, every computer level.',
  nextDeal: 'Next deal', playAgain: 'Play again', toMenu: 'Menu', drawnDeal: 'Drawn deal', youWin: 'You finish!', youWinMatch: 'You win the match!', matchOver: 'Match over',
};
const TR = {
  ...EN,
  tagline: 'Türkiye\'nin taş oyunu', tagline2: 'Masada dört kişi. Çevrimdışı. Sadece puan.',
  play: 'Oyna', cont: 'Devam et', newMatch: 'Yeni maç', watch: 'İzle & Öğren', howto: 'Nasıl Oynanır', rules: 'Kurallar', about: 'Hakkında', settings: 'Ayarlar',
  soundOn: 'Ses Açık', soundOff: 'Ses Kapalı', offline: 'Çevrimdışı. Reklamsız. Bahis yok.',
  dealsWon: 'Kazanılan el', matchesWon: 'Kazanılan maç', bestMatch: 'En iyi maç puanı',
  sound: 'Ses', opponents: 'Rakipler', matchLen: 'Maç uzunluğu', assist: 'Bitirebildiğimi söyle', labels: 'Etiketler', textSize: 'Yazı boyutu',
  thinkTime: 'İzle & Öğren düşünme süresi', on: 'Açık', off: 'Kapalı', deal1: 'el', deals: 'el', back: 'Geri', next: 'İleri', done: 'Bitti',
  menu: 'Menü', exit: 'Çık', page: 'Sayfa', deal: 'El', stack: 'Deste', score: 'Puan', okeyIs: 'OKEY', indicator: 'Gösterge',
  take: 'AL', draw: 'ÇEK', discard: 'AT', sortRuns: 'Seri', sortSets: 'Sayı', smart: 'Akıllı', hint: 'İpucu', inSets: 'Perlerde',
  paused: 'Duraklatıldı', resume: 'Devam', pause: 'Duraklat', quit: 'Menüye dön', watching: 'İzle & Öğren', think: 'Düşün', speed: 'Hız',
  phThink: 'DÜŞÜN: sen ne yapardın?', phReveal: 'GÖSTER: seçenekler ve seçilen hamle', phAct: 'OYNA',
  yourDraw: 'Sıra sende. Desteye dokun ya da solundaki parlayan yığından taş al.',
  yourDiscard: 'Atmak için bir taşı kendi yığınına sürükle ya da taşa dokunup At\'a bas.',
  yourFirst: 'Bu ele 15 taşla başlıyorsun. Diz, sonra birini at.',
  thinking: 'düşünüyor...', starts: 'eli başlatıyor.', coach: 'Seri (aynı renk 4-5-6) ve aynı sayılı perler (7-7-7, farklı renk) kurmak için taşları sürükle. Yeşil çizgi geçerli grubu gösterir.', resumed: 'Tekrar hoş geldin. El kaldığı yerden devam ediyor.',
  dThinkDraw: 'DÜŞÜN: desteden mi çekmeli, soldaki yığından mı almalı?',
  dThinkDiscard: 'DÜŞÜN: hangi taşı elde tutmak en az işe yarar?',
  limitTitle: 'Web önizlemesi burada bitiyor', limitBody: 'Oynamaya devam etmek için tam oyunu iPhone ve Android\'de edin.',
  nextDeal: 'Sonraki el', playAgain: 'Tekrar oyna', toMenu: 'Menü', drawnDeal: 'Berabere el', youWin: 'Bitirdin!', youWinMatch: 'Maçı kazandın!', matchOver: 'Maç bitti',
};
export const L = (S, k) => (S.prefs.terms === 'tr' ? TR : EN)[k] ?? EN[k] ?? k;
export const tileLabel = (S, id) => {
  if (isFake(id)) return S.prefs.terms === 'tr' ? 'Sahte okey' : 'False okey';
  const names = S.prefs.terms === 'tr' ? COLOR_NAMES_TR : COLOR_NAMES;
  return `${names[Math.floor((id % 52) / 13)]} ${(id % 13) + 1}`;
};
