// Playing cards, as the card games share them: how a card looks on the page, and a deck.
export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const ICON = { spades: 'spade', hearts: 'heart', diamonds: 'diamond', clubs: 'club' };
const SIGN = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
export const isRed = (suit) => suit === 'hearts' || suit === 'diamonds';
// "Q♥": a card in a few characters, for the status line and for those who cannot see the picture.
export const cardName = (card) => card.rank + SIGN[card.suit];
// The picture of a card, or of its back when no card is given. Call drawIcons() once it is on the page.
// `extra` are further class names, `tag` is 'button' for a card that can be played.
export function cardHTML(card, extra = '', tag = 'div') {
  if (!card) return `<${tag} class="pc back ${extra}"></${tag}>`;
  return `<${tag} class="pc ${isRed(card.suit) ? 'red' : 'black'} ${extra}" data-rank="${card.rank}" data-suit="${card.suit}" aria-label="${cardName(card)}"><b>${card.rank}</b><i data-lucide="${ICON[card.suit]}"></i></${tag}>`;
}
// A deck of the given ranks in all four suits, mixed.
export function deckOf(ranks, rnd = Math.random) {
  const deck = SUITS.flatMap((suit) => ranks.map((rank) => ({ rank, suit })));
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}
