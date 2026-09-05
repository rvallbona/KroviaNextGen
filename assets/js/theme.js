/* ============================================================
   KroviaNextGen — Selector de estilo visual
   16 temas: tipografía + color + forma + fondo animado propios.
   Las fuentes se cargan solo cuando el tema se usa o se roza
   con el ratón, para no bajar 32 tipografías de golpe.
   El aspecto de cada uno vive en assets/css/themes.css;
   el fondo animado ('bg') en assets/js/background.js.
   ============================================================ */
window.KroviaTheme = (function () {
  'use strict';

  var THEMES = [
    {
      id: 'nebula', face: "'Sora',sans-serif", name: 'Nebula', bg: 'constellation',
      dots: ['#C084FC', '#22D3EE', '#34F5C5'],
      font: 'https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@300;400;500;600&display=swap'
    },
    {
      id: 'cyber', face: "'Orbitron',sans-serif", name: 'Cyber', bg: 'circuit',
      dots: ['#FF2E97', '#00F0FF', '#FFE600'],
      font: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@300;400;500;600;700&display=swap'
    },
    {
      id: 'aurum', face: "'Playfair Display',serif", name: 'Aurum', bg: 'embers',
      dots: ['#F2E2B8', '#E8B04B', '#FF8A3D'],
      font: 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600;1,700&family=DM+Sans:wght@300;400;500&display=swap'
    },
    {
      id: 'matrix', face: "'Share Tech Mono',monospace", name: 'Matrix', bg: 'rain',
      dots: ['#00FF7F', '#7CFFB2', '#00C853'],
      font: 'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=IBM+Plex+Mono:wght@300;400;500;600&display=swap'
    },
    {
      id: 'frost', face: "'Outfit',sans-serif", name: 'Frost', bg: 'snow',
      dots: ['#2563EB', '#06B6D4', '#8B5CF6'],
      font: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Manrope:wght@300;400;500;600;700&display=swap'
    },
    {
      id: 'vapor', face: "'Righteous',sans-serif", name: 'Vapor', bg: 'starfield',
      dots: ['#FFD36E', '#FF6EC7', '#4EE8D8'],
      font: 'https://fonts.googleapis.com/css2?family=Righteous&family=Chakra+Petch:wght@300;400;500;600;700&display=swap'
    },
    {
      id: 'sakura', face: "'Shippori Mincho',serif", name: 'Sakura', bg: 'petals',
      dots: ['#E8749E', '#C9A0DC', '#7FBFA8'],
      font: 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;600;700&family=Zen+Kaku+Gothic+New:wght@300;400;500;700&display=swap'
    },
    {
      id: 'brutal', face: "'Archivo Black',sans-serif", name: 'Brutal', bg: 'blocks',
      dots: ['#FFE500', '#FF3B00', '#0A0A0A'],
      font: 'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Space+Grotesk:wght@300;400;500;600;700&display=swap'
    },
    {
      id: 'abyss', face: "'Lora',serif", name: 'Abyss', bg: 'bubbles',
      dots: ['#A6F0C6', '#4FD1E0', '#3B82F6'],
      font: 'https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=Nunito+Sans:wght@300;400;600;700&display=swap'
    },
    {
      id: 'dune', face: "'Fjalla One',sans-serif", name: 'Dune', bg: 'waves',
      dots: ['#8C3B18', '#C25A2B', '#E0912F'],
      font: 'https://fonts.googleapis.com/css2?family=Fjalla+One&family=Karla:wght@300;400;500;600;700&display=swap'
    },
    {
      id: 'tokyo', face: "'Anton',sans-serif", name: 'Tokyo', bg: 'drizzle',
      dots: ['#FF3A5E', '#7A5CFF', '#FFB43A'],
      font: 'https://fonts.googleapis.com/css2?family=Anton&family=Noto+Sans+JP:wght@300;400;500;700&display=swap'
    },
    {
      id: 'amber', face: "'VT323',monospace", name: 'Amber', bg: 'phosphor',
      dots: ['#D9761A', '#FFB03C', '#FFD79A'],
      font: 'https://fonts.googleapis.com/css2?family=VT323&family=Courier+Prime:wght@400;700&display=swap'
    },
    {
      id: 'candy', face: "'Fredoka',sans-serif", name: 'Candy', bg: 'confetti',
      dots: ['#FF8AC7', '#7ED8F5', '#FFD166'],
      font: 'https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Quicksand:wght@300;400;500;600;700&display=swap'
    },
    {
      id: 'blueprint', face: "'IBM Plex Sans',sans-serif", name: 'Blueprint', bg: 'hex',
      dots: ['#7FC8FF', '#FFFFFF', '#5AE0C0'],
      font: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500;600&display=swap'
    },
    {
      id: 'nordic', face: "'Cormorant Garamond',serif", name: 'Nordic', bg: 'fireflies',
      dots: ['#9FE8C8', '#8AB6E8', '#E8D9A8'],
      font: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter+Tight:wght@300;400;500;600&display=swap'
    },
    {
      id: 'molten', face: "'Oswald',sans-serif", name: 'Molten', bg: 'plasma',
      dots: ['#FF2D55', '#FF5E14', '#FFC400'],
      font: 'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Barlow:wght@300;400;500;600;700&display=swap'
    }
  ];

  var KEY = 'krovia_theme';
  var loaded = {};
  var current = null;

  function loadFont(theme) {
    if (loaded[theme.id]) return;
    loaded[theme.id] = true;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = theme.font;
    document.head.appendChild(l);
  }

  function flash() {
    var el = document.getElementById('themeFlash');
    if (!el) return;
    el.classList.remove('is-on');
    void el.offsetWidth;
    el.classList.add('is-on');
  }

  function apply(id, animate) {
    var theme = THEMES.filter(function (t) { return t.id === id; })[0] || THEMES[0];
    if (current === theme.id) return;
    loadFont(theme);
    document.documentElement.setAttribute('data-theme', theme.id);
    current = theme.id;
    try { localStorage.setItem(KEY, theme.id); } catch (e) { /* modo privado */ }

    if (animate) flash();
    // el canvas necesita releer la paleta ya aplicada
    requestAnimationFrame(function () {
      if (window.KroviaBG) window.KroviaBG.setMode(theme.bg);
    });

    var list = document.getElementById('themeList');
    if (list) {
      Array.from(list.querySelectorAll('.theme-opt')).forEach(function (b) {
        b.classList.toggle('is-active', b.dataset.theme === theme.id);
      });
    }
    document.dispatchEvent(new CustomEvent('krovia:theme', { detail: theme }));
  }

  function buildDock() {
    var dock = document.getElementById('themeDock');
    var list = document.getElementById('themeList');
    var toggle = document.getElementById('themeToggle');
    if (!dock || !list || !toggle) return;

    var title = document.createElement('div');
    title.className = 'theme-dock__title';
    title.textContent = 'Estilo visual';
    list.appendChild(title);

    THEMES.forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'theme-opt';
      b.type = 'button';
      b.dataset.theme = t.id;
      b.setAttribute('aria-label', 'Estilo ' + t.name);

      var dots = document.createElement('span');
      dots.className = 'theme-opt__dots';
      t.dots.forEach(function (c) {
        var i = document.createElement('i');
        i.style.background = c;
        dots.appendChild(i);
      });

      var label = document.createElement('span');
      label.textContent = t.name;
      label.style.fontFamily = t.face; // cada estilo se anuncia con su propia letra

      b.appendChild(dots);
      b.appendChild(label);
      // al acercarte, traemos su tipografía: el nombre se lee con su propia letra
      // y el cambio de estilo es instantáneo si acabas pulsando
      b.addEventListener('pointerenter', function () { loadFont(t); });
      b.addEventListener('focus', function () { loadFont(t); });
      b.addEventListener('click', function () { apply(t.id, true); });
      list.appendChild(b);
    });

    function setOpen(open) {
      dock.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      setOpen(!dock.classList.contains('is-open'));
    });
    document.addEventListener('click', function (e) {
      if (!dock.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      // atajo: T salta al siguiente estilo, Shift+T al anterior
      if (e.key === 't' || e.key === 'T') {
        var i = THEMES.findIndex(function (x) { return x.id === current; });
        var next = (i + (e.shiftKey ? -1 : 1) + THEMES.length) % THEMES.length;
        apply(THEMES[next].id, true);
      }
    });
  }

  var saved;
  try { saved = localStorage.getItem(KEY); } catch (e) { saved = null; }

  buildDock();
  apply(saved || 'nebula', false);

  return { apply: apply, list: THEMES, current: function () { return current; } };
})();
