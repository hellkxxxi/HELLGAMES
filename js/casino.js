// What the casino games share: the purse of souls and the bet. Souls are play money. They live in this
// browser only, cannot be bought or cashed out, and a player who runs out is simply handed more.
const KEY = 'arcade:souls';
export const GRANT = 1000;   // what a new player starts with, and what a broke one is handed
export const MIN_BET = 10;
const MAX_BALANCE = 999999999999;
const STEPS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];

let memory = null; // used when the browser refuses to store anything (private mode)
function read() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null && Number.isFinite(Number(saved)) && Number(saved) >= 0) return Math.floor(Number(saved));
  } catch { /* fall through to the copy in memory */ }
  return memory ?? GRANT;
}
function write(n) {
  memory = n;
  try { localStorage.setItem(KEY, String(n)); } catch { /* private mode: the purse lasts until the page is closed */ }
}

export const wallet = {
  get balance() { return read(); },
  add(n) { const now = Math.min(MAX_BALANCE, Math.max(0, read() + Math.round(n))); write(now); return now; },
};

// 1234567 -> "1.23M"; smaller sums are written out in full: "12,345".
export function souls(n) {
  n = Math.round(n);
  if (Math.abs(n) < 1e6) return n.toLocaleString('en-US');
  const [div, unit] = Math.abs(n) < 1e9 ? [1e6, 'M'] : [1e9, 'B'];
  return (Math.floor(n / div * 100) / 100).toFixed(2).replace(/\.?0+$/, '') + unit;
}

// The bet with its buttons. `id` names the game, so that each game remembers its own bet.
export function createBet(el, id, onChange = () => {}) {
  el.classList.add('bet');
  el.innerHTML = `<span>Bet</span>
    <button data-b="down" aria-label="Lower the bet">&minus;</button>
    <output></output>
    <button data-b="up" aria-label="Raise the bet">+</button>
    <button data-b="max" class="bet-max">Max</button>`;
  const out = el.querySelector('output'), buttons = [...el.querySelectorAll('button')];
  // `wanted` is the bet the player chose, and it is remembered. `value` is the bet in force: as much of
  // the wanted one as the purse covers right now. A thin purse lowers the bet without changing the choice.
  let wanted = 50, value = 50, locked = false, ready = false;
  try { wanted = Math.max(MIN_BET, Math.floor(Number(localStorage.getItem('arcade:bet:' + id))) || 50); } catch { /* the default bet will do */ }

  function show() {
    value = Math.max(MIN_BET, Math.min(wanted, wallet.balance));
    out.textContent = souls(value);
    if (ready) onChange(value);
  }
  function choose(v) {
    wanted = Math.max(MIN_BET, Math.floor(v));
    try { localStorage.setItem('arcade:bet:' + id, String(wanted)); } catch { /* not vital */ }
    show();
  }
  const step = (dir) => {
    if (locked) return;
    const next = dir > 0 ? STEPS.find((s) => s > value) : [...STEPS].reverse().find((s) => s < value) ?? MIN_BET;
    if (next !== undefined && next <= Math.max(MIN_BET, wallet.balance)) choose(next); // a step the purse cannot cover is not taken
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || locked) return;
    b.blur();
    if (b.dataset.b === 'max') choose(wallet.balance); else step(b.dataset.b === 'up' ? 1 : -1);
  });
  show();
  ready = true; // from here on the game hears about every change
  return {
    get value() { return value; },
    step,
    // Call when the purse has changed: the bet follows it.
    refresh: show,
    lock(on) { locked = on; buttons.forEach((b) => { b.disabled = on; }); },
  };
}

// The money side of a round, the same in every game.
export function createTable(api, bet) {
  const show = () => { api.score(wallet.balance); bet.refresh(); };
  show();
  return {
    show,
    // Takes the bet out of the purse. False if the player cannot afford it.
    stake(amount) {
      if (amount < MIN_BET || amount > wallet.balance) return false;
      api.score(wallet.add(-amount));
      return true;
    },
    // Puts a win into the purse at once, so that it is safe even if the player leaves while the reels
    // are still turning. The balance on screen follows with the next show().
    credit(amount) { wallet.add(amount); },
    won(profit) { if (profit > 0) api.record(profit); },
    // At the end of a round: a player who cannot afford the smallest bet gets a fresh purse.
    settle() {
      if (wallet.balance >= MIN_BET) return;
      api.overlay({
        title: 'Out of souls', text: 'The house always wins. Souls are play money, so here are some more.', icon: 'flame',
        button: `Take ${souls(GRANT)} souls`, onClick: () => { wallet.add(GRANT - wallet.balance); show(); },
      });
    },
  };
}
