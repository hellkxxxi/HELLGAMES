import { WORDS } from '../data/words.js';

const TIMES = { t15: 15, t30: 30, t60: 60 };        // seconds on the clock in each mode
export const LANGS = { en: 'English', ru: 'Русский' }; // every language needs a word list in js/data/words.js
const LANG_KEY = 'arcade:type:lang';
const MAX_EXTRA = 8;                                 // letters accepted past the end of a word
const AHEAD = 60;                                    // words kept ready after the one being typed
const CARET_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
// The input box always holds a space in front of the word being typed. Backspace at the very start of a
// word then still changes the box, which is the only way to notice that key on a phone keyboard.
const KEEP = ' ';

// ---------------------------------------------------------------- the rules (no page needed, so they can be tested)

// Random words from a list; a word never comes back within the next two.
export function makeWords(list, count, random = Math.random, before = []) {
  const out = [], recent = before.slice(-2);
  while (out.length < count) {
    const word = list[Math.floor(random() * list.length)];
    if (list.length > 3 && recent.includes(word)) continue;
    out.push(word); recent.push(word); if (recent.length > 2) recent.shift();
  }
  return out;
}

// One typing test. `words` is the text to type and may grow while the test runs.
// The page reports what the input box holds for the current word; the test keeps score.
export function createTest(words) {
  const typed = [''];           // typed[i] is what was entered for words[i]; the last entry is the word in progress
  let keys = 0, hits = 0;       // key presses that added a character, and how many of them were right
  const at = () => typed.length - 1;

  function write(text) {
    const i = at(), word = words[i], old = typed[i];
    text = text.slice(0, word.length + MAX_EXTRA);
    let same = 0;
    while (same < old.length && same < text.length && old[same] === text[same]) same++;
    for (let j = same; j < text.length; j++) { keys++; if (text[j] === word[j]) hits++; }
    typed[i] = text;
  }
  // A space finishes the word. It does nothing before the first letter of a word or after the last word.
  function space() {
    const i = at();
    if (!typed[i] || i + 1 >= words.length) return false;
    keys++; if (typed[i] === words[i]) hits++;
    typed.push('');
    return true;
  }

  return {
    words, typed,
    get index() { return at(); },
    get keys() { return keys; },
    // `value` is the current word as typed so far. A space in it finishes the word; whatever follows the
    // space belongs to the next word. Returns what should remain in the input box.
    input(value) {
      const parts = value.replace(/\s/g, ' ').split(' ');
      write(parts[0]);
      for (let k = 1; k < parts.length; k++) {
        if (!space() && typed[at()]) break; // the last word of the text: nothing comes after it
        write(parts[k]);
      }
      return typed[at()];
    },
    // Backspace at the very start of a word: go back into the previous word if it has a mistake in it.
    // Returns the text of that word (to put back into the input box), or null if there is no going back.
    back() {
      const i = at();
      if (i === 0 || typed[i] || typed[i - 1] === words[i - 1]) return null;
      typed.pop();
      return typed[i - 1];
    },
    // Speed is counted the usual way: five characters are one word, and only correctly typed words count
    // (each with the space after it). A word that is unfinished when the time runs out counts if it is right so far.
    result(seconds) {
      let right = 0, all = 0, wrong = 0;
      typed.forEach((text, i) => {
        const done = i < typed.length - 1, n = text.length + (done ? 1 : 0);
        all += n;
        if (done ? text === words[i] : words[i].startsWith(text)) right += n; else if (done) wrong++;
      });
      const perMinute = 60 / Math.max(seconds, 0.001) / 5;
      return { wpm: Math.round(right * perMinute), raw: Math.round(all * perMinute), accuracy: keys ? Math.floor(hits / keys * 100) : 100, wrong };
    },
  };
}

// ---------------------------------------------------------------- the game on screen

const cyrillic = (c) => /[а-яё]/i.test(c), latin = (c) => /[a-z]/i.test(c);
const WRONG_LAYOUT = {
  en: 'These words are English. Switch your keyboard layout, or pick Русский above.',
  ru: 'Эти слова на русском. Переключите раскладку или выберите English выше.',
};

// The language chosen last time; for a new player, the language of the browser if there are words for it.
function savedLang() {
  let lang = null;
  try { lang = localStorage.getItem(LANG_KEY); } catch { /* private mode: the choice is just not remembered */ }
  if (LANGS[lang]) return lang;
  const browser = (navigator.language || '').toLowerCase().slice(0, 2);
  return LANGS[browser] ? browser : 'en';
}

export default {
  id: 'helltype', name: 'Helltype', icon: 'keyboard', color: '#ff5a2a', tag: 'Typing',
  desc: 'Type the words as fast and as cleanly as you can. 15, 30 or 60 seconds, English or Russian.',
  help: 'Just start typing · Backspace fixes mistakes · Tab or the restart button brings new words',
  scoreLabel: 'WPM',
  variants: { t30: '30 s', t15: '15 s', t60: '60 s' }, // the first one is the mode a new player starts in
  create(stage, api) {
    stage.innerHTML = `
      <div class="ht-top">
        <div class="seg" id="ht-time">${Object.keys(TIMES).map((id) => `<button data-m="${id}">${TIMES[id]} s</button>`).join('')}</div>
        <div class="seg" id="ht-lang">${Object.entries(LANGS).map(([id, name]) => `<button data-l="${id}">${name}</button>`).join('')}</div>
      </div>
      <div class="timebar wide"><div id="ht-tb" style="width:100%"></div></div>
      <div class="ht-box" id="ht-box">
        <div class="ht-view"><div class="ht-words" id="ht-words"><div class="ht-caret" id="ht-caret"></div></div></div>
        <input class="ht-in" id="ht-in" type="text" inputmode="text" enterkeyhint="done" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Type the words you see here">
        <div class="ht-hint"><span class="touch-only">Tap here to type</span><span class="ht-desk">Click here or press any key to type</span></div>
      </div>
      <p class="ht-note" id="ht-note" role="status"></p>`;
    const $ = (sel) => stage.querySelector(sel);
    const box = $('#ht-box'), wordsEl = $('#ht-words'), caret = $('#ht-caret'), input = $('#ht-in'), bar = $('#ht-tb'), note = $('#ht-note');
    const timeBtns = [...stage.querySelectorAll('#ht-time button')], langBtns = [...stage.querySelectorAll('#ht-lang button')];
    let lang = savedLang();
    let test, els, state, t0 = 0, timer = null, idleTimer = null, shownAt = 0, strangers = 0, capsOn = false, wrongLayout = false;

    const seconds = () => TIMES[api.variant()] || TIMES.t30;
    const focus = () => { if (state !== 'done') input.focus({ preventScroll: true }); };
    const show = (text) => { if (input.value !== KEEP + text) input.value = KEEP + text; };
    const toEnd = () => input.setSelectionRange(input.value.length, input.value.length); // letters are only ever added at the end

    function addWords(count) {
      for (const word of makeWords(WORDS[lang], count, Math.random, test.words)) {
        test.words.push(word);
        const el = document.createElement('span'); el.className = 'w';
        wordsEl.appendChild(el); els.push(el);
        paint(els.length - 1);
      }
    }

    // Redraws one word: its letters, coloured by how they were typed.
    function paint(i) {
      const el = els[i], word = test.words[i], text = test.typed[i] || '';
      const letters = [];
      for (let j = 0; j < Math.max(word.length, text.length); j++) {
        const letter = document.createElement('i');
        letter.textContent = j < word.length ? word[j] : text[j];
        if (j >= word.length) letter.className = 'x'; else if (j < text.length) letter.className = text[j] === word[j] ? 'ok' : 'no';
        letters.push(letter);
      }
      el.replaceChildren(...letters);
      el.classList.toggle('err', i < test.index && text !== word);
    }

    // Puts the caret where the next letter goes and keeps the line being typed in view.
    function place() {
      const el = els[test.index], letters = el.children, n = test.typed[test.index].length;
      const x = n < letters.length ? letters[n].offsetLeft : letters[letters.length - 1].offsetLeft + letters[letters.length - 1].offsetWidth;
      caret.style.transform = `translate(${x}px, ${el.offsetTop}px)`;
      const lineHeight = el.offsetHeight || 1, line = Math.round(el.offsetTop / lineHeight);
      wordsEl.style.transform = `translateY(${-Math.max(0, line - 1) * lineHeight}px)`;
    }

    function showNote() {
      note.textContent = wrongLayout ? (WRONG_LAYOUT[lang] || 'These words need another keyboard layout.') : capsOn ? 'Caps Lock is on.' : '';
    }

    function reset() {
      clearInterval(timer); clearTimeout(idleTimer);
      state = 'ready'; strangers = 0; wrongLayout = false; shownAt = 0;
      els = []; test = createTest([]);
      wordsEl.replaceChildren(caret);
      addWords(AHEAD * 2);
      input.disabled = false; show('');
      box.classList.remove('done'); caret.classList.add('idle');
      bar.style.width = '100%';
      timeBtns.forEach((b) => b.classList.toggle('on', TIMES[b.dataset.m] === seconds()));
      langBtns.forEach((b) => b.classList.toggle('on', b.dataset.l === lang));
      api.score(0); api.status('Type to start the clock');
      showNote(); place(); focus();
    }

    function begin() {
      state = 'run'; t0 = performance.now();
      timer = setInterval(tick, 100);
    }

    function tick() {
      const now = performance.now(), spent = (now - t0) / 1000, left = seconds() - spent;
      bar.style.width = Math.max(0, left / seconds() * 100) + '%';
      if (left <= 0) { finish(); return; }
      const r = test.result(spent);
      if (spent >= 2 && now - shownAt > 400) { shownAt = now; api.score(r.wpm); } // the first seconds say little about speed
      api.status(`${Math.ceil(left)}s · ${r.accuracy}% accuracy`);
    }

    function finish() {
      clearInterval(timer); clearTimeout(idleTimer);
      state = 'done';
      input.blur(); input.disabled = true; box.classList.add('done'); // also puts a phone's keyboard away
      const r = test.result(seconds());
      api.score(r.wpm); api.status(`${r.accuracy}% accuracy`);
      const slips = r.wrong ? ` · ${r.wrong} wrong word${r.wrong === 1 ? '' : 's'}` : '';
      // People are still typing when the time runs out, so the result waits longer than usual for Space or Enter.
      api.finish(r.wpm, { endTitle: 'Time is up', text: `${r.wpm} WPM · ${r.accuracy}% accuracy · raw ${r.raw}${slips}`, wait: 1500 });
    }

    // Three letters in a row from the other alphabet: the keyboard is probably in the wrong layout.
    function watchLayout() {
      const text = test.typed[test.index], got = text[text.length - 1], want = test.words[test.index][text.length - 1];
      if (!got || !want) return;
      if ((cyrillic(got) && latin(want)) || (latin(got) && cyrillic(want))) strangers++; else strangers = 0;
      const now = strangers >= 3;
      if (now !== wrongLayout) { wrongLayout = now; showNote(); }
    }

    input.addEventListener('input', (e) => {
      if (state === 'done') { show(''); return; }
      const from = test.index, keysBefore = test.keys, value = input.value;
      let text;
      if (value.startsWith(KEEP)) text = test.input(value.slice(KEEP.length));
      else if (/^delete/.test(e.inputType || '') && !test.typed[from]) {
        // The space in front is gone: Backspace at the very start of a word. Back into the previous word,
        // if it has a mistake to fix. Deleting a whole word (Ctrl or Alt with Backspace) empties that word.
        const previous = test.back();
        text = previous !== null && e.inputType === 'deleteContentBackward' ? previous : test.input('');
      } else text = test.input(value); // everything was selected and typed over
      show(text);
      if (state === 'ready' && test.keys > 0) begin();
      for (let i = Math.min(from, test.index); i <= Math.max(from, test.index); i++) paint(i);
      if (test.words.length - test.index < AHEAD) addWords(AHEAD);
      if (test.keys > keysBefore) watchLayout();
      place();
      caret.classList.remove('idle'); clearTimeout(idleTimer);
      idleTimer = setTimeout(() => caret.classList.add('idle'), 600);
    });

    input.addEventListener('keydown', (e) => {
      const caps = !!(e.getModifierState && e.getModifierState('CapsLock'));
      if (caps !== capsOn) { capsOn = caps; showNote(); }
      if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); reset(); return; }
      if (CARET_KEYS.has(e.key)) e.preventDefault();
    });
    for (const type of ['paste', 'drop']) input.addEventListener(type, (e) => e.preventDefault());
    for (const type of ['focus', 'click', 'select']) input.addEventListener(type, toEnd);

    $('#ht-time').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      api.variant(b.dataset.m); reset();
    });
    $('#ht-lang').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      lang = b.dataset.l;
      try { localStorage.setItem(LANG_KEY, lang); } catch { /* fine */ }
      reset();
    });

    const watcher = new ResizeObserver(() => { if (els && els.length) place(); }); // lines break differently when the width changes
    watcher.observe(box);
    reset();

    return {
      // A key pressed while the input box is not focused: focus it, and the character lands in it.
      key() { focus(); },
      restart: reset,
      destroy() { clearInterval(timer); clearTimeout(idleTimer); watcher.disconnect(); },
    };
  },
};
