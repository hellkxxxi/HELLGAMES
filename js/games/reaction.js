import { drawIcons } from '../util.js';

const ROUNDS = 5;

export default {
  id: 'reaction', name: 'Reaction Test', icon: 'timer', color: '#22d3ee', tag: 'Reflex',
  desc: 'Click the moment the screen turns green. Average of five tries.',
  help: 'Click, tap or press Space when it turns green',
  scoreLabel: 'Avg', lowerBetter: true, initialScore: '–',
  format: (v) => `${Math.round(v)} ms`,
  create(stage, api) {
    stage.innerHTML = `<div class="rpanel" id="rp" role="button" tabindex="0"></div>`;
    const p = stage.querySelector('#rp');
    let state = 'idle', times = [], timer = null, t0 = 0;

    function view(bg, fg, icon, title, sub) {
      p.style.background = bg; p.style.color = fg;
      const dots = Array.from({ length: ROUNDS }, (_, i) => `<i class="${i < times.length ? 'on' : ''}"></i>`).join('');
      p.innerHTML = `<i data-lucide="${icon}"></i><h3>${title}</h3><p>${sub}</p><div class="rdots">${dots}</div>`;
      drawIcons();
    }
    const avg = () => times.reduce((a, b) => a + b, 0) / times.length;

    function idle() { state = 'idle'; view('#151922', '#f4f4f5', 'zap', 'Reaction Test', 'Click anywhere to start'); }
    function wait() {
      state = 'wait';
      view('#7f1d1d', '#fee2e2', 'hourglass', 'Wait for green…', 'Don’t click yet');
      timer = setTimeout(go, 1200 + Math.random() * 2800);
    }
    function go() { state = 'go'; t0 = performance.now(); view('#15803d', '#f0fdf4', 'mouse-pointer-click', 'Click!', 'As fast as you can'); }

    function hit() {
      if (state === 'idle' || state === 'result') { wait(); return; }
      if (state === 'wait') {
        clearTimeout(timer); state = 'result';
        view('#78350f', '#fef3c7', 'triangle-alert', 'Too soon!', 'Click to try that round again');
        return;
      }
      if (state === 'go') {
        const ms = performance.now() - t0;
        times.push(ms); api.score(avg());
        api.status(`Round ${times.length} of ${ROUNDS}`);
        if (times.length >= ROUNDS) {
          state = 'done';
          view('#151922', '#f4f4f5', 'gauge', `${Math.round(avg())} ms`, 'Average reaction time');
          api.finish(avg(), { text: `Average: ${Math.round(avg())} ms · fastest ${Math.round(Math.min(...times))} ms` });
          return;
        }
        state = 'result';
        view('#151922', '#f4f4f5', 'clock', `${Math.round(ms)} ms`, 'Click to continue');
      }
    }

    p.addEventListener('pointerdown', (e) => { e.preventDefault(); hit(); });
    idle();
    return {
      key(e) { if (e.key === ' ' || e.key === 'Enter') { hit(); return true; } },
      destroy() { clearTimeout(timer); },
    };
  },
};
