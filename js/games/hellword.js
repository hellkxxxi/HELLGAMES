import { drawIcons } from '../util.js';

// ---------------------------------------------------------------- rules
export const TRIES = 6, LENGTH = 5;
export const LANGS = {
  en: { name: 'English', rows: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'] },
  ru: { name: 'Русский', rows: ['йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю'] },
};

// Marks every letter of a guess: 'hit' is the right letter in the right place, 'near' a letter of the
// word in another place, 'miss' a letter the word does not have. A letter that the word has once is
// marked once, however many times the guess repeats it.
export function judge(guess, answer) {
  const g = [...guess], a = [...answer], marks = g.map(() => 'miss'), spare = {};
  a.forEach((ch, i) => { if (g[i] === ch) marks[i] = 'hit'; else spare[ch] = (spare[ch] || 0) + 1; });
  g.forEach((ch, i) => { if (marks[i] !== 'hit' && spare[ch] > 0) { marks[i] = 'near'; spare[ch]--; } });
  return marks;
}

// One round. `accepts(word)` says whether a word may be tried. Earlier guesses can be handed in to
// carry on with a round that was left unfinished.
export function createRound(answer, accepts, earlier = []) {
  const rank = { miss: 1, near: 2, hit: 3 };
  const r = { answer, guesses: [], typed: '', keys: {}, won: false, over: false };
  function take(word) {
    const marks = judge(word, answer);
    r.guesses.push({ word, marks });
    [...word].forEach((ch, i) => { if (!r.keys[ch] || rank[marks[i]] > rank[r.keys[ch]]) r.keys[ch] = marks[i]; });
    r.won = word === answer;
    r.over = r.won || r.guesses.length >= TRIES;
    return marks;
  }
  r.type = (ch) => { if (!r.over && r.typed.length < LENGTH) r.typed += ch; };
  r.erase = () => { r.typed = r.typed.slice(0, -1); };
  // Hands the typed word in. Answers 'short', 'unknown', or 'ok' when the word was taken.
  r.submit = () => {
    if (r.over) return 'over';
    if (r.typed.length < LENGTH) return 'short';
    if (!accepts(r.typed)) return 'unknown';
    take(r.typed); r.typed = '';
    return 'ok';
  };
  for (const word of earlier) if (!r.over && word.length === LENGTH) take(word);
  return r;
}

// ---------------------------------------------------------------- the game on the page
// Russian letters by the place of their key, so the Russian game can be typed with any layout switched on.
const RU_KEYS = {
  KeyQ: 'й', KeyW: 'ц', KeyE: 'у', KeyR: 'к', KeyT: 'е', KeyY: 'н', KeyU: 'г', KeyI: 'ш', KeyO: 'щ', KeyP: 'з', BracketLeft: 'х', BracketRight: 'ъ',
  KeyA: 'ф', KeyS: 'ы', KeyD: 'в', KeyF: 'а', KeyG: 'п', KeyH: 'р', KeyJ: 'о', KeyK: 'л', KeyL: 'д', Semicolon: 'ж', Quote: 'э',
  KeyZ: 'я', KeyX: 'ч', KeyC: 'с', KeyV: 'м', KeyB: 'и', KeyN: 'т', KeyM: 'ь', Comma: 'б', Period: 'ю', Backquote: 'е',
};
// The letter a key press stands for in the given language, or null.
export function letterOf(e, lang) {
  const ch = (e.char || '').toLowerCase();
  if (lang === 'ru') {
    if (/^[а-яё]$/.test(ch)) return ch === 'ё' ? 'е' : ch; // the word lists spell ё as е
    return RU_KEYS[e.code] || null;
  }
  if (/^[a-z]$/.test(ch)) return ch;
  return /^Key[A-Z]$/.test(e.code || '') ? e.code.slice(3).toLowerCase() : null;
}

let words = null; // the word lists arrive when the game is first opened: they are too big to make every visitor wait for them
const loadWords = () => (words ||= import('../data/hellword.js').then((m) => m.HELLWORDS).catch((err) => { words = null; throw err; }));

const saved = {
  get(key) { try { return localStorage.getItem('arcade:hellword:' + key); } catch { return null; } },
  set(key, v) { try { if (v === null) localStorage.removeItem('arcade:hellword:' + key); else localStorage.setItem('arcade:hellword:' + key, v); } catch { /* private mode */ } },
};
const FLIP = 150, FLIP_LAST = 450; // a letter turns over this long after the one before it; how long one turn takes

export default {
  id: 'hellword', name: 'Hellword', icon: 'spell-check', color: '#22c55e', tag: 'Words', since: '1.1',
  desc: 'Guess the hidden five-letter word in six tries. In English and in Russian.',
  help: 'Type a word and press Enter · green: right place · yellow: wrong place · grey: not in the word · Restart gives up',
  scoreLabel: 'Streak',
  variants: { en: LANGS.en.name, ru: LANGS.ru.name },
  defaultVariant: () => ((navigator.language || '').toLowerCase().startsWith('ru') ? 'ru' : 'en'),
  create(stage, api) {
    stage.innerHTML = `
      <div class="hw">
        <div class="seg" id="hw-lang">${Object.entries(LANGS).map(([id, l]) => `<button data-l="${id}" lang="${id}">${l.name}</button>`).join('')}</div>
        <div class="hw-board" id="hw-board">${`<div class="hw-row">${'<div class="hw-tile"></div>'.repeat(LENGTH)}</div>`.repeat(TRIES)}<p class="hw-note" id="hw-note" role="status"></p></div>
        <div class="hw-keys" id="hw-keys"></div>
      </div>`;
    const $ = (id) => stage.querySelector('#' + id);
    const rowsEl = [...stage.querySelectorAll('.hw-row')], note = $('hw-note'), keysEl = $('hw-keys');
    const langBtns = [...stage.querySelectorAll('#hw-lang button')];
    let lang, lists = null, round = null, busy = false, alive = true, noteTimer = null, timers = [];
    const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };

    const streak = () => Number(saved.get('streak:' + lang)) || 0;
    function say(text, hold = 1600) {
      clearTimeout(noteTimer);
      note.textContent = text;
      if (text && hold) noteTimer = setTimeout(() => { note.textContent = ''; }, hold);
    }
    function drawKeys() {
      const [top, mid, low] = LANGS[lang].rows;
      const key = (ch) => `<button data-k="${ch}" class="${round?.keys[ch] || ''}">${ch}</button>`;
      keysEl.innerHTML = `<div>${[...top].map(key).join('')}</div><div>${[...mid].map(key).join('')}</div>
        <div><button data-k="Enter" class="wide" aria-label="Enter">Enter</button>${[...low].map(key).join('')}<button data-k="Backspace" class="wide" aria-label="Delete"><i data-lucide="delete"></i></button></div>`;
      keysEl.lang = lang;
      drawIcons();
    }
    const paintKeys = () => keysEl.querySelectorAll('button[data-k]').forEach((b) => { if (round.keys[b.dataset.k]) b.className = round.keys[b.dataset.k]; });
    // Shows the row that is being typed.
    function drawTyped() {
      const row = rowsEl[round.guesses.length];
      if (!row) return;
      [...row.children].forEach((tile, i) => {
        const ch = round.typed[i] || '';
        if (tile.textContent !== ch) { tile.textContent = ch; tile.className = 'hw-tile' + (ch ? ' filled' : ''); }
      });
    }
    // Shows a guess that has been judged: at once, or with the letters turning over one after another.
    function drawGuess(n, turn) {
      const { word, marks } = round.guesses[n];
      [...rowsEl[n].children].forEach((tile, i) => {
        tile.textContent = word[i];
        tile.className = `hw-tile ${marks[i]} ${turn ? 'turn' : 'shown'}`;
        tile.style.setProperty('--i', i);
      });
    }
    const status = () => api.status(round.over ? '' : `Guess ${round.guesses.length + 1} of ${TRIES}`);
    const keep = () => saved.set('round:' + lang, round.over ? null : JSON.stringify({ answer: round.answer, guesses: round.guesses.map((g) => g.word) }));

    function newRound(resume = true) {
      const { answers, guesses } = lists[lang], known = new Set(guesses);
      let answer = null, earlier = [];
      try { // a round that was left unfinished carries on
        const was = resume && JSON.parse(saved.get('round:' + lang) || 'null');
        if (was && answers.includes(was.answer) && Array.isArray(was.guesses)) { answer = was.answer; earlier = was.guesses.filter((w) => known.has(w)); }
      } catch { /* the saved round is unreadable: a new word, then */ }
      if (!answer) {
        const last = saved.get('last:' + lang); // a new round never brings the word of the round before
        do answer = answers[Math.floor(Math.random() * answers.length)]; while (answer === last && answers.length > 1);
      }
      round = createRound(answer, (w) => known.has(w), earlier);
      saved.set('last:' + lang, answer);
      rowsEl.forEach((row) => [...row.children].forEach((tile) => { tile.textContent = ''; tile.className = 'hw-tile'; }));
      round.guesses.forEach((_, n) => drawGuess(n, false));
      drawKeys(); status(); keep(); say('');
      api.score(streak());
      busy = false;
    }
    function end() {
      const word = round.answer.toUpperCase();
      if (round.won) {
        const now = streak() + 1, n = round.guesses.length;
        saved.set('streak:' + lang, String(now)); api.score(now);
        const praise = ['Unbelievable!', 'Brilliant!', 'Great!', 'Well done', 'Got it', 'Phew, that was close'][n - 1];
        api.finish(now, { title: praise, text: `${word} in ${n} ${n === 1 ? 'try' : 'tries'} · ${now} in a row`, icon: 'trophy' });
      } else {
        saved.set('streak:' + lang, '0'); api.score(0);
        api.finish(0, { title: 'The word was ' + word, text: 'Out of tries. The streak starts again.', icon: 'flag' });
      }
    }
    function submit() {
      const result = round.submit();
      if (result === 'short' || result === 'unknown') {
        say(result === 'short' ? 'Not enough letters' : 'Not in the word list');
        const row = rowsEl[round.guesses.length];
        row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake');
        return;
      }
      if (result !== 'ok') return;
      busy = true; keep(); say('');
      drawGuess(round.guesses.length - 1, true);
      later(() => {
        paintKeys(); status();
        if (round.over) later(end, 250); else busy = false;
      }, FLIP * (LENGTH - 1) + FLIP_LAST);
    }
    function press(k) {
      if (!round || busy || round.over) return;
      if (k === 'Enter') submit();
      else if (k === 'Backspace') { round.erase(); drawTyped(); }
      else { round.type(k); drawTyped(); }
    }
    function setLang(id) {
      lang = LANGS[id] ? id : 'en';
      api.variant(lang);
      langBtns.forEach((b) => b.classList.toggle('on', b.dataset.l === lang));
      timers.forEach(clearTimeout); timers = [];
      if (lists) newRound();
    }

    keysEl.addEventListener('click', (e) => { const b = e.target.closest('button[data-k]'); if (b) { b.blur(); press(b.dataset.k); } });
    $('hw-lang').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { b.blur(); if (b.dataset.l !== lang && !busy) setLang(b.dataset.l); } });

    setLang(api.variant());
    drawKeys();
    say('Loading the words…', 0);
    loadWords().then((all) => { if (alive) { lists = all; newRound(); } })
      .catch(() => { if (alive) say('The words could not be loaded. Check the connection and press Restart.', 0); });

    return {
      key(e) {
        if (e.key === 'Enter' || e.key === 'Backspace') { if (e.key === 'Backspace' || !e.repeat) press(e.key); return true; }
        const ch = letterOf(e, lang);
        if (!ch) return;
        if (!e.repeat) press(ch);
        return true;
      },
      // Restart gives the round up: the word is shown and the streak is lost, as after six wrong tries.
      restart() {
        if (!lists) { say('Loading the words…', 0); loadWords().then((all) => { if (alive) { lists = all; newRound(); } }).catch(() => { if (alive) say('The words could not be loaded. Check the connection and press Restart.', 0); }); return; }
        if (busy) return;
        if (!round.over && round.guesses.length) {
          const word = round.answer.toUpperCase();
          saved.set('streak:' + lang, '0'); saved.set('round:' + lang, null); api.score(0);
          round.over = true;
          api.finish(0, { title: 'The word was ' + word, text: 'You gave up. The streak starts again.', icon: 'flag' });
          return;
        }
        newRound(false);
      },
      destroy() { alive = false; clearTimeout(noteTimer); timers.forEach(clearTimeout); },
    };
  },
};
