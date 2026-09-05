/* ============================================================
   KroviaNextGen — Fondo animado
   Panal hexagonal con celdas que se iluminan, al ritmo del
   cursor. La paleta se lee de las variables CSS (--rgb1/2/3),
   así que cambiar :root en styles.css cambia también el fondo.
   ============================================================ */
window.KroviaBG = (function () {
  'use strict';

  var canvas = document.getElementById('neural-canvas');
  if (!canvas) return { refresh: function () {} };

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ctx = canvas.getContext('2d');
  var w = 0, h = 0, dpr = 1, raf = null;
  var pointer = { x: -9999, y: -9999 };
  var palette = ['127,200,255', '255,255,255', '90,224,192'];
  var hexes = [];

  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function readPalette() {
    var cs = getComputedStyle(document.documentElement);
    var p = [cs.getPropertyValue('--rgb1'), cs.getPropertyValue('--rgb2'), cs.getPropertyValue('--rgb3')]
      .map(function (v) { return (v || '').trim(); })
      .filter(Boolean);
    if (p.length === 3) palette = p;
  }

  var R = 34, DX = R * 1.732, DY = R * 1.5;

  function init() {
    hexes = [];
    for (var j = -1; j * DY < h + R; j++) {
      for (var i = -1; i * DX < w + R; i++) {
        hexes.push({
          x: i * DX + (j % 2 ? DX / 2 : 0),
          y: j * DY,
          c: pick(palette),
          lit: 0
        });
      }
    }
  }

  /* radio del halo del cursor, al cuadrado (evita raíces en el bucle) */
  var NEAR = 150 * 150;

  function draw() {
    ctx.lineWidth = 1;
    for (var i = 0; i < hexes.length; i++) {
      var hx = hexes[i];

      // se encienden solas de vez en cuando…
      if (hx.lit > 0) hx.lit -= 0.012;
      else if (Math.random() < 0.0006) hx.lit = 1;

      // …y siempre alrededor del cursor
      var dx = hx.x - pointer.x, dy = hx.y - pointer.y, d2 = dx * dx + dy * dy;
      var near = d2 < NEAR ? (1 - d2 / NEAR) : 0;

      var v = Math.max(Math.max(0, hx.lit), near);

      ctx.beginPath();
      for (var k = 0; k < 6; k++) {
        var a = Math.PI / 180 * (60 * k - 30);
        var px = hx.x + R * Math.cos(a), py = hx.y + R * Math.sin(a);
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(' + hx.c + ',' + (0.1 + 0.55 * v) + ')';
      ctx.stroke();
      if (v > 0) { ctx.fillStyle = 'rgba(' + hx.c + ',' + (0.14 * v) + ')'; ctx.fill(); }
    }
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    init();
  }

  window.addEventListener('pointermove', function (e) { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
  window.addEventListener('pointerleave', function () { pointer.x = pointer.y = -9999; });

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt); rt = setTimeout(resize, 160);
  });

  // pausa cuando la pestaña no se ve
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { cancelAnimationFrame(raf); raf = null; }
    else if (!raf && !reduce) frame();
  });

  readPalette();
  resize();
  if (reduce) { ctx.clearRect(0, 0, w, h); draw(); }
  else frame();

  return { refresh: function () { readPalette(); init(); } };
})();
