import { copyText, drawIcons } from '../util.js';
import { WORDS } from '../data/words.js';

// ---------------------------------------------------------------- making things up (nothing is drawn here)
// A made-up word is built letter by letter. Each letter is picked from the letters that follow the
// last three in real words, so the result sounds like the language without being a word of it.
const SPAN = 3;
export function learn(words) {
  const next = new Map(), known = new Set(words);
  for (const word of words) {
    const padded = '^'.repeat(SPAN) + word + '$';
    for (let i = SPAN; i < padded.length; i++) {
      const before = padded.slice(i - SPAN, i);
      next.set(before, (next.get(before) || '') + padded[i]);
    }
  }
  return { next, known };
}
// A word of `min` to `max` letters, or null if none came out. Real words are thrown away, and so is
// anything that begins with a real word of five letters, because that is usually just another form of
// it ("bluffs", "stoned"). The lists do not hold every word of a language, so once in a long while a
// real word still slips through.
export function invent(model, rnd = Math.random, min = 5, max = 9) {
  for (let attempt = 0; attempt < 200; attempt++) {
    let word = '^'.repeat(SPAN);
    while (word.length - SPAN <= max) {
      const choices = model.next.get(word.slice(-SPAN));
      const ch = choices[Math.floor(rnd() * choices.length)];
      if (ch === '$') break;
      word += ch;
    }
    word = word.slice(SPAN);
    if (word.length >= min && word.length <= max && !model.known.has(word) && !(word.length > 5 && model.known.has(word.slice(0, 5)))) return word;
  }
  return null;
}

const FRONT = ['Hell', 'Dark', 'Grim', 'Ash', 'Void', 'Doom', 'Soul', 'Blood', 'Night', 'Shadow', 'Storm', 'Frost', 'Iron', 'Crimson', 'Silent', 'Rogue', 'Toxic', 'Neon', 'Cyber', 'Ghost',
  'Dread', 'Ember', 'Rage', 'Lone', 'Mad', 'Wild', 'Cursed', 'Savage', 'Lucky', 'Sleepy', 'Salty', 'Cosmic', 'Turbo', 'Lazy', 'Angry', 'Tiny', 'Feral', 'Hollow', 'Bitter', 'Rusty'];
const BACK = ['Wolf', 'Raven', 'Reaper', 'Fox', 'Viper', 'Knight', 'Hunter', 'Demon', 'Phantom', 'Dragon', 'Blade', 'Fang', 'Rider', 'Witch', 'Goblin', 'Crow', 'Hawk', 'Imp', 'Fiend', 'Lord',
  'King', 'Queen', 'Slayer', 'Walker', 'Stalker', 'Sniper', 'Wizard', 'Monk', 'Bandit', 'Pirate', 'Ninja', 'Samurai', 'Panda', 'Toad', 'Moth', 'Shark', 'Tiger', 'Bear', 'Owl', 'Cat',
  'Bat', 'Spider', 'Wraith', 'Golem', 'Titan', 'Byte', 'Pixel', 'Glitch'];
const TAIL = ['kai', 'rin', 'zen', 'ko', 'ren', 'shi', 'ra', 'nox', 'vex', 'ryu', 'mi', 'ka', 'zo', 'xi', 'ix', 'yx', 'on', 'us', 'ar', 'eth', 'yn', 'or'];
const cap = (w) => w[0].toUpperCase() + w.slice(1);
// A nickname of at most sixteen characters. `word` hands out a made-up word (or null).
export function nickname(rnd = Math.random, word = () => null) {
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  for (;;) {
    const roll = rnd(), front = pick(FRONT), back = pick(BACK);
    let name;
    if (roll < 0.4) name = front + back;
    else if (roll < 0.6) name = (front + pick(TAIL)).toLowerCase();
    else if (roll < 0.7) name = front + back + String(Math.floor(rnd() * 90) + 10);
    else if (roll < 0.8) name = `${front}_${back}`.toLowerCase();
    else if (roll < 0.85) name = `xX_${back}_Xx`;
    else { const made = word(); name = made ? (rnd() < 0.5 ? cap(made) : cap(made) + back) : front + back; }
    if (name.length <= 16 && front.toLowerCase() !== back.toLowerCase()) return name;
  }
}

const HEADS = ['Ka', 'Zar', 'El', 'Mor', 'Thal', 'Vor', 'Ny', 'Ael', 'Dra', 'Gor', 'Is', 'Lu', 'Ser', 'Xan', 'Bel', 'Cal', 'Fen', 'Hal', 'Jor', 'Kel', 'Mal', 'Nor', 'Or', 'Per', 'Quel', 'Rha', 'Syl',
  'Tor', 'Ul', 'Val', 'Wyn', 'Yr', 'Zen', 'Az', 'Bri', 'Cor', 'Dae', 'Eir', 'Fae', 'Gal', 'Ith', 'Lor', 'Mer', 'Nym', 'Oth', 'Ryn', 'Sha', 'Tyr', 'Ven'];
const MIDDLES = ['a', 'e', 'i', 'o', 'u', 'ae', 'ia', 'an', 'en', 'in', 'on', 'ar', 'or', 'el', 'il', 'ath', 'eth', 'and', 'ind', 'ara', 'ira', 'ori', 'ad', 'ev', 'om'];
const ENDS = ['dor', 'mir', 'ion', 'ius', 'ar', 'en', 'a', 'ia', 'wyn', 'eth', 'as', 'is', 'os', 'us', 'ath', 'riel', 'dril', 'gorn', 'moth', 'thas', 'vyr', 'zar', 'nor', 'ric', 'lin', 'ra', 'na', 'th', 'dan', 'wen', 'mar'];
// A name for a hero or a place: two or three syllables that do not trip over each other.
export function fantasyName(rnd = Math.random) {
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  for (;;) {
    const name = pick(HEADS) + (rnd() < 0.5 ? pick(MIDDLES) : '') + pick(ENDS);
    const low = name.toLowerCase();
    if (name.length >= 4 && name.length <= 10 && !/[aeiouy]{3}|[^aeiouy]{4}|(.)\1/.test(low)) return name;
  }
}

// ---------------------------------------------------------------- the game on the page
export const STYLES = { nick: 'Nicknames', fantasy: 'Fantasy', word: 'Words', slovo: 'Слова' };
const COUNT = 10, KEPT = 'arcade:names:kept', STYLE = 'arcade:names:style';
const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default {
  id: 'names', name: 'Name Forge', icon: 'wand-sparkles', color: '#a78bfa', tag: 'Creative', since: '1.1', noScore: true, noRestart: true,
  desc: 'Nicknames, fantasy names and made-up words, in English and in Russian. Click one to copy it.',
  help: 'Space or Enter makes a new batch · click a name to copy it · the star keeps it for later · keys 1 to 4 change the kind',
  create(stage) {
    stage.innerHTML = `
      <div class="names">
        <div class="seg" id="nm-style">${Object.entries(STYLES).map(([id, name]) => `<button data-s="${id}">${name}</button>`).join('')}</div>
        <ul class="nm-list" id="nm-list"></ul>
        <div class="cz-bar"><button class="btn-primary" id="nm-go"><i data-lucide="wand-sparkles"></i>Make more</button></div>
        <p class="cz-msg" id="nm-msg" role="status"></p>
        <div class="nm-kept" id="nm-kept"></div>
      </div>`;
    const $ = (id) => stage.querySelector('#' + id);
    const list = $('nm-list'), msg = $('nm-msg'), keptEl = $('nm-kept'), styleBtns = [...stage.querySelectorAll('#nm-style button')];
    // The models start from the short word lists that came with the page and learn the big ones as soon as those arrive.
    const models = { en: learn(WORDS.en), ru: learn(WORDS.ru) };
    let style = 'nick', kept = [], names = [], alive = true, msgTimer = null;
    try { style = STYLES[localStorage.getItem(STYLE)] ? localStorage.getItem(STYLE) : 'nick'; kept = JSON.parse(localStorage.getItem(KEPT) || '[]').filter((n) => typeof n === 'string').slice(0, 60); } catch { /* start empty */ }

    function say(text) {
      clearTimeout(msgTimer);
      msg.textContent = text;
      msgTimer = setTimeout(() => { msg.textContent = 'Click a name to copy it'; }, 1600);
    }
    function one() {
      if (style === 'nick') return nickname(Math.random, () => invent(models.en, Math.random, 5, 7));
      if (style === 'fantasy') return fantasyName();
      return invent(style === 'slovo' ? models.ru : models.en) || '…';
    }
    function showKept() {
      keptEl.innerHTML = kept.length ? `<h4>Kept</h4><div>${kept.map((n) => `<span><button class="nm-copy" data-n="${escape(n)}">${escape(n)}</button><button class="nm-drop" data-n="${escape(n)}" aria-label="Remove ${escape(n)}"><i data-lucide="x"></i></button></span>`).join('')}</div>` : '';
      list.querySelectorAll('.nm-star').forEach((b) => b.classList.toggle('on', kept.includes(b.dataset.n)));
      drawIcons();
      try { localStorage.setItem(KEPT, JSON.stringify(kept)); } catch { /* private mode */ }
    }
    function make() {
      const seen = new Set();
      names = [];
      for (let guard = 0; names.length < COUNT && guard < 400; guard++) { const n = one(); if (!seen.has(n)) { seen.add(n); names.push(n); } }
      list.lang = style === 'slovo' ? 'ru' : 'en';
      list.innerHTML = names.map((n) => `<li><button class="nm-copy" data-n="${escape(n)}">${escape(n)}</button><button class="nm-star" data-n="${escape(n)}" aria-label="Keep ${escape(n)}"><i data-lucide="star"></i></button></li>`).join('');
      styleBtns.forEach((b) => b.classList.toggle('on', b.dataset.s === style));
      showKept();
      // A name too long for its box gets smaller letters: three dots at the end would hide the very thing one came for.
      for (const b of list.querySelectorAll('.nm-copy')) {
        let size = parseFloat(getComputedStyle(b).fontSize);
        while (b.scrollWidth > b.clientWidth && size > 10) b.style.fontSize = `${--size}px`;
      }
    }
    const copy = async (name) => say(await copyText(name) ? `Copied “${name}”` : 'This browser does not let the page copy. Select the name by hand.');
    function setStyle(id) {
      style = id;
      try { localStorage.setItem(STYLE, id); } catch { /* not vital */ }
      make();
    }

    stage.querySelector('.names').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      b.blur();
      const name = b.dataset.n;
      if (b.classList.contains('nm-copy')) copy(name);
      else if (b.classList.contains('nm-star')) { kept = kept.includes(name) ? kept.filter((n) => n !== name) : [name, ...kept].slice(0, 60); showKept(); }
      else if (b.classList.contains('nm-drop')) { kept = kept.filter((n) => n !== name); showKept(); }
      else if (b.id === 'nm-go') make();
      else if (b.dataset.s) setStyle(b.dataset.s);
    });

    make();
    msg.textContent = 'Click a name to copy it';
    import('../data/hellword.js').then(({ HELLWORDS }) => {
      if (!alive) return;
      models.en = learn([...new Set([...WORDS.en, ...HELLWORDS.en.guesses])]);
      models.ru = learn([...new Set([...WORDS.ru, ...HELLWORDS.ru.guesses])]);
    }).catch(() => { /* offline and never loaded before: the short lists will do */ });

    return {
      key(e) {
        if (e.key === ' ' || e.key === 'Enter') { if (!e.repeat) make(); return true; }
        if (/^[1-4]$/.test(e.key)) { setStyle(Object.keys(STYLES)[Number(e.key) - 1]); return true; }
      },
      destroy() { alive = false; clearTimeout(msgTimer); },
    };
  },
};
