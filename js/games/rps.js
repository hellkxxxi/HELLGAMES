import { drawIcons } from '../util.js';

// Rock, paper, scissors against the devil, who watches how you play and bets on your habits.
export const HANDS = ['rock', 'paper', 'scissors'];
const ICON = { rock: 'hand-fist', paper: 'hand', scissors: 'scissors' };
const face = (hand) => `<i data-lucide="${ICON[hand]}"></i>`;
const NAME = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };
// What a hand does against another: 1 wins, 0 draws, -1 loses.
export const duel = (mine, theirs) => (mine === theirs ? 0 : (HANDS.indexOf(mine) - HANDS.indexOf(theirs) + 3) % 3 === 1 ? 1 : -1);
// The hand that beats the given one.
export const counter = (hand) => HANDS[(HANDS.indexOf(hand) + 1) % 3];

// The devil's head. It remembers what you played after each of your hands and after winning, losing
// or drawing, and expects you to do the same again. Half of the time it plays against that guess,
// the other half it leaves it to chance: so it can be beaten, but habits are punished.
export function createMind(rnd = Math.random) {
  const seen = {}; // seen[situation][hand]: how often that hand followed that situation
  let situation = 'start';
  const guess = () => {
    const counts = seen[situation];
    if (!counts) return null;
    const best = HANDS.reduce((a, b) => ((counts[b] || 0) > (counts[a] || 0) ? b : a));
    return (counts[best] || 0) >= 2 ? best : null; // one time is no habit yet
  };
  return {
    // The devil's hand for the next round.
    choose() {
      const expected = guess();
      return expected && rnd() < 0.5 ? counter(expected) : HANDS[Math.floor(rnd() * 3)];
    },
    // What happened: your hand and how the round went for you (1, 0, -1).
    learn(yours, outcome) {
      (seen[situation] ||= {})[yours] = (seen[situation][yours] || 0) + 1;
      situation = yours + outcome;
    },
    expects: guess,
  };
}

export default {
  id: 'rps', name: 'Rock Paper Scissors', icon: 'scissors', color: '#f59e0b', tag: 'Skill', since: '1.1',
  desc: 'Rock, paper, scissors against the devil. He learns your habits, so do not have any. Wins in a row count.',
  help: 'Click a hand, or press 1, 2, 3 or R, P, S · rock beats scissors, scissors beat paper, paper beats rock · a draw keeps the streak',
  scoreLabel: 'Streak',
  create(stage, api) {
    stage.innerHTML = `
      <div class="rps">
        <div class="rp-table">
          <div class="rp-side"><span>You</span><div class="rp-hand" id="rp-you">${face('rock')}</div></div>
          <div class="rp-mid" id="rp-mid">vs</div>
          <div class="rp-side"><span>Devil</span><div class="rp-hand devil" id="rp-devil">${face('rock')}</div></div>
        </div>
        <p class="cz-msg" id="rp-msg" role="status">Choose your hand</p>
        <div class="rp-keys" id="rp-keys">${HANDS.map((h, k) => `<button data-h="${h}" aria-label="${NAME[h]}">${face(h)}<b>${NAME[h]}</b><kbd>${k + 1}</kbd></button>`).join('')}</div>
      </div>`;
    const $ = (id) => stage.querySelector('#' + id);
    const you = $('rp-you'), devil = $('rp-devil'), msg = $('rp-msg'), table = stage.querySelector('.rp-table');
    const mind = createMind();
    let busy = false, timer = null, streak = 0, tally = { 1: 0, 0: 0, '-1': 0 };

    function play(hand) {
      if (busy) return;
      busy = true;
      const theirs = mind.choose(), outcome = duel(hand, theirs);
      mind.learn(hand, outcome);
      you.innerHTML = devil.innerHTML = face('rock'); you.dataset.hand = devil.dataset.hand = 'rock'; drawIcons();
      msg.textContent = 'Rock, paper, scissors…'; msg.className = 'cz-msg';
      table.className = 'rp-table shake';
      timer = setTimeout(() => { // the fists come down three times, then the hands are shown
        table.className = 'rp-table ' + (outcome > 0 ? 'won' : outcome < 0 ? 'lost' : 'draw');
        you.innerHTML = face(hand); devil.innerHTML = face(theirs); you.dataset.hand = hand; devil.dataset.hand = theirs; drawIcons();
        tally[outcome]++;
        if (outcome > 0) { streak++; api.record(streak); } else if (outcome < 0) streak = 0;
        api.score(streak);
        const beats = (a, b) => `${NAME[a]} ${a === 'scissors' ? 'beat' : 'beats'} ${NAME[b].toLowerCase()}`;
        msg.textContent = outcome > 0 ? `${beats(hand, theirs)}: you win` : outcome < 0 ? `${beats(theirs, hand)}: the devil wins` : `${NAME[hand]} twice: a draw`;
        msg.className = 'cz-msg ' + (outcome > 0 ? 'good' : outcome < 0 ? 'bad' : '');
        api.status(`${tally[1]} won · ${tally[0]} drawn · ${tally[-1]} lost`);
        busy = false;
      }, 620);
    }
    $('rp-keys').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { b.blur(); play(b.dataset.h); } });
    api.status('First to blink loses');
    return {
      key(e) {
        const hand = { 1: 'rock', 2: 'paper', 3: 'scissors', r: 'rock', p: 'paper', s: 'scissors' }[e.key];
        if (hand) { if (!e.repeat) play(hand); return true; }
      },
      destroy() { clearTimeout(timer); },
    };
  },
};
