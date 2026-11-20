import { copyText, drawIcons } from '../util.js';

// ---------------------------------------------------------------- the numbers (nothing is shown here)
// Every game turns the view by a fixed angle for one count of the mouse at sensitivity 1: its yaw, in
// degrees. Two settings feel the same when a full turn takes the same way on the mouse pad, so
//   new sensitivity = old sensitivity × old yaw ÷ new yaw.
// Only games are listed whose yaw the published tables agree on. `digits` is how fine the setting can
// be typed in the game itself.
export const GAMES = [
  { id: 'valorant', name: 'Valorant', yaw: 0.07, digits: 3 },
  { id: 'cs2', name: 'Counter-Strike 2', yaw: 0.022, digits: 3, note: 'and CS:GO' },
  { id: 'apex', name: 'Apex Legends', yaw: 0.022, digits: 3 },
  { id: 'fortnite', name: 'Fortnite', yaw: 0.005555, digits: 1, unit: '%', note: 'X and Y sensitivity' },
  { id: 'overwatch', name: 'Overwatch 2', yaw: 0.0066, digits: 2 },
  { id: 'cod', name: 'Call of Duty', yaw: 0.0066, digits: 2, note: 'Warzone, Modern Warfare' },
  { id: 'r6', name: 'Rainbow Six Siege', yaw: 0.00572957795, digits: 0, note: 'multiplier left at 0.02' },
  { id: 'tf2', name: 'Team Fortress 2', yaw: 0.022, digits: 3, note: 'and other Source games' },
];
export const gameOf = (id) => GAMES.find((g) => g.id === id);
export const convert = (sens, from, to) => sens * from.yaw / to.yaw;
// How far the mouse travels for one full turn, in centimetres.
export const turn = (sens, game, dpi) => 360 / (sens * game.yaw * dpi) * 2.54;
// A sensitivity the way the game shows it: no more digits than the game takes, no zeros at the end.
export const show = (value, game) => String(Number(value.toFixed(game.digits)));

// ---------------------------------------------------------------- the page
const KEY = 'arcade:sens';
const number = (text) => { const n = Number(String(text).replace(',', '.').trim()); return Number.isFinite(n) && n > 0 ? n : null; };

export default {
  id: 'sens', name: 'Sens Converter', icon: 'mouse', color: '#f472b6', tag: 'Skill', since: '1.1', noScore: true, noRestart: true,
  desc: 'Carry your mouse sensitivity from one shooter to another: Valorant, CS2, Apex, Fortnite, Overwatch and more.',
  help: 'Pick your game, type its sensitivity and the DPI of your mouse · click a result to copy it · the DPI is taken to stay the same · scopes have settings of their own',
  create(stage) {
    let was = {};
    try { was = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { /* nothing saved, or not allowed */ }
    stage.innerHTML = `
      <div class="sens">
        <div class="sn-form">
          <label><span>Your game</span><select id="sn-game">${GAMES.map((g) => `<option value="${g.id}">${g.name}</option>`).join('')}</select></label>
          <label><span>Sensitivity</span><input id="sn-sens" inputmode="decimal" autocomplete="off" spellcheck="false"></label>
          <label><span>Mouse DPI</span><input id="sn-dpi" inputmode="numeric" autocomplete="off" spellcheck="false"></label>
        </div>
        <div class="sn-facts" id="sn-facts"></div>
        <ul class="sn-list" id="sn-list"></ul>
        <p class="cz-msg" id="sn-msg" role="status"></p>
      </div>`;
    const $ = (id) => stage.querySelector('#' + id);
    const gameEl = $('sn-game'), sensEl = $('sn-sens'), dpiEl = $('sn-dpi'), list = $('sn-list'), facts = $('sn-facts'), msg = $('sn-msg');
    gameEl.value = gameOf(was.game) ? was.game : 'valorant';
    sensEl.value = number(was.sens) ? String(was.sens) : '0.4';
    dpiEl.value = number(was.dpi) ? String(was.dpi) : '800';
    let msgTimer = null;

    function update() {
      const from = gameOf(gameEl.value), sens = number(sensEl.value), dpi = number(dpiEl.value);
      sensEl.classList.toggle('bad', !sens); dpiEl.classList.toggle('bad', !dpi);
      try { localStorage.setItem(KEY, JSON.stringify({ game: from.id, sens: sensEl.value.trim(), dpi: dpiEl.value.trim() })); } catch { /* private mode */ }
      if (!sens) { facts.innerHTML = ''; list.innerHTML = '<li class="sn-empty">Type the sensitivity you play with.</li>'; return; }
      const cm = dpi ? turn(sens, from, dpi) : null;
      const fact = (value, label) => `<div><b>${value}</b><span>${label}</span></div>`;
      facts.innerHTML = cm
        ? fact(cm.toFixed(1) + ' cm', 'for a full turn') + fact((cm / 2.54).toFixed(1) + ' in', 'for a full turn') + fact(String(Math.round(sens * dpi * 100) / 100), 'eDPI in ' + from.name)
        : '<div class="sn-empty">Type the DPI of your mouse to see how far it travels for a full turn.</div>';
      list.innerHTML = GAMES.map((g) => {
        const exact = convert(sens, from, g), value = show(exact, g) + (g.unit || '');
        // where the game takes only round numbers, the exact one is shown beside them
        const rough = Math.abs(Number(show(exact, g)) - exact) > exact * 0.01 ? `exactly ${Number(exact.toFixed(2))}` : '';
        const note = [g.note, rough].filter(Boolean).join(' · ');
        return `<li class="${g === from ? 'from' : ''}"><button data-v="${value}" data-n="${g.name}" title="Copy"><span class="sn-name">${g.name}${note ? `<small>${note}</small>` : ''}</span><b>${value}</b><i data-lucide="copy"></i></button></li>`;
      }).join('');
      drawIcons();
    }
    for (const el of [gameEl, sensEl, dpiEl]) el.addEventListener('input', update);
    list.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      const ok = await copyText(b.dataset.v.replace('%', ''));
      msg.textContent = ok ? `Copied ${b.dataset.v} for ${b.dataset.n}` : 'This browser does not let the page copy. Type the number by hand.';
      clearTimeout(msgTimer); msgTimer = setTimeout(() => { msg.textContent = ''; }, 2200);
    });
    update();
    return { destroy() { clearTimeout(msgTimer); } };
  },
};
