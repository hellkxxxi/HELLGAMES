// The Stroop test: the name of a colour is written in the ink of another one, and the ink is what
// has to be picked. Reading gets in the way, which is the whole point.
export const SECONDS = 30;
export const INKS = [
  { id: 'red', hex: '#ef4444', en: 'RED', ru: 'КРАСНЫЙ' },
  { id: 'green', hex: '#22c55e', en: 'GREEN', ru: 'ЗЕЛЁНЫЙ' },
  { id: 'blue', hex: '#3b82f6', en: 'BLUE', ru: 'СИНИЙ' },
  { id: 'yellow', hex: '#facc15', en: 'YELLOW', ru: 'ЖЁЛТЫЙ' },
];
// The next card: which word, in which ink (both are places in INKS). Three cards in four lie about
// their colour, and no card comes twice in a row.
export function nextCard(prev, rnd = Math.random) {
  for (;;) {
    const ink = Math.floor(rnd() * INKS.length);
    const word = rnd() < 0.25 ? ink : (ink + 1 + Math.floor(rnd() * (INKS.length - 1))) % INKS.length;
    if (!prev || prev.ink !== ink || prev.word !== word) return { word, ink };
  }
}

export default {
  id: 'stroop', name: 'Stroop Test', icon: 'palette', color: '#e879f9', tag: 'Skill', since: '1.1',
  desc: 'The word says GREEN, the ink is red. Pick the colour of the ink as fast as you can, for 30 seconds.',
  help: 'Click or tap the colour the word is written in, not the colour it names · keys 1 to 4 pick too · a mistake costs a point · the first answer starts the clock',
  variants: { en: 'English', ru: 'Русский' },
  defaultVariant: () => ((navigator.language || '').toLowerCase().startsWith('ru') ? 'ru' : 'en'),
  create(stage, api) {
    stage.innerHTML = `
      <div class="stroop">
        <div class="mn-top"><div class="seg" id="st-lang">${Object.entries(this.variants).map(([id, name]) => `<button data-l="${id}" lang="${id}">${name}</button>`).join('')}</div></div>
        <div class="timebar wide"><div id="st-bar" style="width:100%"></div></div>
        <div class="st-card" id="st-card"><span id="st-word"></span></div>
        <div class="st-keys" id="st-keys">${INKS.map((ink, k) => `<button data-k="${k}" style="--c:${ink.hex}"><b></b><kbd>${k + 1}</kbd></button>`).join('')}</div>
      </div>`;
    const $ = (id) => stage.querySelector('#' + id);
    const wordEl = $('st-word'), card = $('st-card'), bar = $('st-bar'), keys = [...stage.querySelectorAll('#st-keys button')];
    const langBtns = [...stage.querySelectorAll('#st-lang button')];
    let lang = api.variant(), running = false, over = false, t0 = 0, ticker = null, now = null, score = 0, right = 0, wrong = 0;

    function showCard() {
      wordEl.textContent = INKS[now.word][lang]; wordEl.style.color = INKS[now.ink].hex; wordEl.lang = lang;
      card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
    }
    function labels() {
      langBtns.forEach((b) => b.classList.toggle('on', b.dataset.l === lang));
      keys.forEach((b, k) => { b.querySelector('b').textContent = INKS[k][lang]; b.lang = lang; });
    }
    // Before the first answer the card shows the example of the description: GREEN, written in red.
    function ready() {
      running = false; clearInterval(ticker);
      score = right = wrong = 0; api.score(0); bar.style.width = '100%';
      now = { word: 1, ink: 0 }; showCard();
      api.status(`${SECONDS} seconds`);
    }
    function tick() {
      const left = Math.max(0, SECONDS * 1000 - (performance.now() - t0));
      bar.style.width = (left / (SECONDS * 10)) + '%';
      api.status(`${Math.ceil(left / 1000)}s left`);
      if (left <= 0) end();
    }
    function begin() { running = true; t0 = performance.now(); ticker = setInterval(tick, 100); tick(); }
    function answer(k) {
      if (over) return;
      if (!running) begin();
      if (k === now.ink) { score++; right++; } else { score = Math.max(0, score - 1); wrong++; card.classList.remove('miss'); void card.offsetWidth; card.classList.add('miss'); }
      api.score(score);
      now = nextCard(now); showCard();
    }
    function end() {
      running = false; over = true; clearInterval(ticker);
      const each = right + wrong ? Math.round(SECONDS * 1000 / (right + wrong)) : 0;
      api.finish(score, { endTitle: 'Time is up', text: `${right} right, ${wrong} wrong${each ? ` · ${each} ms a card` : ''}` });
    }

    $('st-keys').addEventListener('pointerdown', (e) => { const b = e.target.closest('button'); if (b) { e.preventDefault(); answer(Number(b.dataset.k)); } });
    $('st-lang').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.dataset.l === lang) return;
      b.blur(); lang = b.dataset.l; api.variant(lang); labels(); ready(); // the other language is a game of its own
    });
    labels(); ready();
    return {
      key(e) { if (/^[1-4]$/.test(e.key)) { if (!e.repeat) answer(Number(e.key) - 1); return true; } },
      destroy() { running = false; clearInterval(ticker); },
    };
  },
};
