/* ============================================================
   KroviaNextGen — Motor de fondo animado
   Un solo canvas, 16 modos. El tema activo elige el modo.
     constellation · estrellas + constelaciones + fugaces
     circuit       · rejilla de circuitos con pulsos
     embers        · brasas ascendentes
     rain          · lluvia digital estilo terminal
     snow          · copos y bokeh
     starfield     · viaje estelar + fugaces
     petals        · pétalos girando al caer
     blocks        · mosaico duro que parpadea
     bubbles       · burbujas que ascienden
     waves         · curvas de nivel tipo mapa
     drizzle       · llovizna diagonal con salpicaduras
     phosphor      · caracteres de terminal antigua
     hex           · panal hexagonal con pulsos
     plasma        · manchas fundidas tipo lámpara de lava
     fireflies     · luciérnagas a la deriva
     confetti      · papelitos girando
   API:  KroviaBG.setMode('constellation')
   ============================================================ */
window.KroviaBG = (function () {
  'use strict';

  var canvas = document.getElementById('neural-canvas');
  if (!canvas) return { setMode: function () {} };

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ctx = canvas.getContext('2d');
  var w = 0, h = 0, dpr = 1, raf = null, t = 0;
  var mode = 'constellation';
  var pointer = { x: -9999, y: -9999 };
  var palette = ['192,132,252', '34,211,238', '52,245,197'];

  /* estado de cada modo */
  var stars = [], shooters = [], nodes = [], pulses = [], embers = [], drops = [], flakes = [], warp = [];
  var bits = [], cells = [], hexes = [], blobs = [], lines = [];

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function readPalette() {
    var cs = getComputedStyle(document.documentElement);
    var p = [cs.getPropertyValue('--rgb1'), cs.getPropertyValue('--rgb2'), cs.getPropertyValue('--rgb3')]
      .map(function (v) { return (v || '').trim(); })
      .filter(Boolean);
    if (p.length === 3) palette = p;
  }

  /* ---------- inicializadores por modo ---------- */

  function initConstellation() {
    var n = Math.min(150, Math.round(w * h / 11000));
    stars = Array.from({ length: n }, function () {
      return {
        x: Math.random() * w, y: Math.random() * h,
        vx: rnd(-0.16, 0.16), vy: rnd(-0.16, 0.16),
        r: rnd(0.5, 1.9), c: pick(palette),
        tw: rnd(0, 6.28), ts: rnd(0.6, 2.2),
        link: Math.random() < 0.55
      };
    });
    shooters = [];
  }

  function initCircuit() {
    var gap = 78, cols = Math.ceil(w / gap) + 1, rows = Math.ceil(h / gap) + 1;
    nodes = [];
    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        if (Math.random() > 0.42) continue;
        nodes.push({ x: i * gap + rnd(-12, 12), y: j * gap + rnd(-12, 12), c: pick(palette), p: rnd(0, 6.28) });
      }
    }
    pulses = [];
  }

  function initEmbers() {
    var n = Math.min(130, Math.round(w * h / 13000));
    embers = Array.from({ length: n }, function () {
      return {
        x: Math.random() * w, y: Math.random() * h,
        vy: rnd(-0.55, -0.14), sway: rnd(0.3, 1.2), ph: rnd(0, 6.28),
        r: rnd(0.6, 2.4), c: pick(palette), a: rnd(0.25, 0.85)
      };
    });
  }

  function initRain() {
    var gap = 17, cols = Math.floor(w / gap);
    drops = Array.from({ length: cols }, function (_, i) {
      return { x: i * gap + 3, y: rnd(-h, 0), sp: rnd(2.4, 8), len: (rnd(6, 22) | 0), gl: '' };
    });
  }

  function initSnow() {
    var n = Math.min(160, Math.round(w * h / 10000));
    flakes = Array.from({ length: n }, function () {
      return {
        x: Math.random() * w, y: Math.random() * h,
        vy: rnd(0.18, 0.85), sway: rnd(0.2, 1.1), ph: rnd(0, 6.28),
        r: rnd(0.8, 3.6), c: pick(palette), a: rnd(0.1, 0.45)
      };
    });
  }

  function initStarfield() {
    var n = Math.min(320, Math.round(w * h / 5200));
    warp = Array.from({ length: n }, function () {
      return { a: rnd(0, 6.28), d: rnd(10, Math.max(w, h) * 0.75), sp: rnd(0.25, 1.5), c: pick(palette) };
    });
    shooters = [];
  }

  /* --- pétalos: caen girando sobre su eje --- */
  function initPetals() {
    var n = Math.min(90, Math.round(w * h / 17000));
    bits = Array.from({ length: n }, function () {
      return {
        x: Math.random() * w, y: Math.random() * h,
        vy: rnd(0.35, 1.1), sway: rnd(0.5, 1.8), ph: rnd(0, 6.28),
        r: rnd(5, 13), rot: rnd(0, 6.28), vr: rnd(-0.03, 0.03),
        c: pick(palette), a: rnd(0.3, 0.8)
      };
    });
  }
  function drawPetals() {
    for (var i = 0; i < bits.length; i++) {
      var p = bits[i];
      p.y += p.vy; p.x += Math.sin(t * 0.012 + p.ph) * p.sway * 0.6; p.rot += p.vr;
      if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; }
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      // el "grosor" cambia con el giro: parece que voltea
      ctx.scale(1, Math.max(0.18, Math.abs(Math.cos(t * 0.02 + p.ph))));
      ctx.fillStyle = 'rgba(' + p.c + ',' + p.a + ')';
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, 6.284);
      ctx.fill();
      ctx.restore();
    }
  }

  /* --- mosaico duro: bloques que se encienden y apagan --- */
  function initBlocks() {
    var s = 56, cols = Math.ceil(w / s), rows = Math.ceil(h / s);
    cells = [];
    for (var i = 0; i < cols; i++) for (var j = 0; j < rows; j++) {
      if (Math.random() > 0.3) continue;
      cells.push({ x: i * s, y: j * s, s: s, c: pick(palette), ph: rnd(0, 6.28), sp: rnd(0.3, 1.4) });
    }
  }
  function drawBlocks() {
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      var v = Math.sin(t * 0.012 * c.sp + c.ph);
      if (v < 0.35) continue;
      ctx.fillStyle = 'rgba(' + c.c + ',' + (0.1 + 0.16 * v) + ')';
      ctx.fillRect(c.x, c.y, c.s - 4, c.s - 4);
      ctx.strokeStyle = 'rgba(' + c.c + ',' + (0.3 * v) + ')';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x, c.y, c.s - 4, c.s - 4);
    }
  }

  /* --- burbujas: suben y se deforman --- */
  function initBubbles() {
    var n = Math.min(70, Math.round(w * h / 22000));
    bits = Array.from({ length: n }, function () {
      return {
        x: Math.random() * w, y: Math.random() * h,
        vy: rnd(-1.1, -0.25), sway: rnd(0.3, 1.4), ph: rnd(0, 6.28),
        r: rnd(6, 34), c: pick(palette), a: rnd(0.12, 0.4)
      };
    });
  }
  function drawBubbles() {
    for (var i = 0; i < bits.length; i++) {
      var b = bits[i];
      b.y += b.vy; b.x += Math.sin(t * 0.014 + b.ph) * b.sway * 0.5;
      if (b.y < -b.r - 10) { b.y = h + b.r + 10; b.x = Math.random() * w; }
      var wob = 1 + Math.sin(t * 0.05 + b.ph) * 0.12;
      ctx.save(); ctx.translate(b.x, b.y); ctx.scale(wob, 1 / wob);
      var g = ctx.createRadialGradient(-b.r * .3, -b.r * .3, 0, 0, 0, b.r);
      g.addColorStop(0, 'rgba(255,255,255,' + (b.a * 0.5) + ')');
      g.addColorStop(0.75, 'rgba(' + b.c + ',' + (b.a * 0.28) + ')');
      g.addColorStop(1, 'rgba(' + b.c + ',0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, b.r, 0, 6.284); ctx.fill();
      ctx.strokeStyle = 'rgba(' + b.c + ',' + (b.a * 0.9) + ')'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, b.r, 0, 6.284); ctx.stroke();
      ctx.restore();
    }
  }

  /* --- curvas de nivel, como un mapa topográfico --- */
  function initWaves() {
    var n = 22;
    lines = Array.from({ length: n }, function (_, i) {
      return {
        y: (i + 0.5) * (h / n),
        amp: rnd(14, 46), len: rnd(0.004, 0.011),
        sp: rnd(0.004, 0.016), ph: rnd(0, 6.28), c: pick(palette)
      };
    });
  }
  function drawWaves() {
    ctx.lineWidth = 1.4;
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i];
      ctx.beginPath();
      for (var x = 0; x <= w; x += 12) {
        var y = L.y + Math.sin(x * L.len + t * L.sp + L.ph) * L.amp
                    + Math.sin(x * L.len * 2.3 + t * L.sp * 0.6) * L.amp * 0.3;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(' + L.c + ',' + (0.1 + 0.22 * Math.abs(Math.sin(t * 0.006 + i))) + ')';
      ctx.stroke();
    }
  }

  /* --- llovizna diagonal con salpicaduras --- */
  function initDrizzle() {
    var n = Math.min(220, Math.round(w * h / 6000));
    bits = Array.from({ length: n }, function () {
      return { x: Math.random() * w, y: Math.random() * h, sp: rnd(6, 16), len: rnd(10, 30), c: pick(palette) };
    });
    pulses = [];
  }
  function drawDrizzle() {
    ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    for (var i = 0; i < bits.length; i++) {
      var d = bits[i];
      d.y += d.sp; d.x += d.sp * 0.34;
      if (d.y > h) {
        if (pulses.length < 30) pulses.push({ x: d.x, y: h - rnd(0, h * 0.12), r: 1, c: d.c });
        d.y = -20; d.x = Math.random() * w - w * 0.2;
      }
      if (d.x > w) d.x = -20;
      ctx.strokeStyle = 'rgba(' + d.c + ',.4)';
      ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.len * 0.34, d.y - d.len); ctx.stroke();
    }
    for (var k = pulses.length - 1; k >= 0; k--) {
      var s = pulses[k]; s.r += 1.4;
      if (s.r > 26) { pulses.splice(k, 1); continue; }
      ctx.strokeStyle = 'rgba(' + s.c + ',' + (0.4 * (1 - s.r / 26)) + ')';
      ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.3, 0, 0, 6.284); ctx.stroke();
    }
  }

  /* --- fósforo: rejilla de caracteres de terminal antigua --- */
  var CHARS = '01<>[]{}/\\|=+-*#@$%&_:;.ABCDEFGHJKLMNPQRSTUVWXYZ'.split('');
  function initPhosphor() {
    var s = 20, cols = Math.ceil(w / s), rows = Math.ceil(h / s);
    cells = [];
    for (var i = 0; i < cols; i++) for (var j = 0; j < rows; j++) {
      if (Math.random() > 0.28) continue;
      cells.push({ x: i * s + 3, y: j * s, ch: pick(CHARS), a: rnd(0.06, 0.5), sp: rnd(0.002, 0.02), ph: rnd(0, 6.28) });
    }
  }
  function drawPhosphor() {
    ctx.font = '15px "VT323","Courier Prime",monospace';
    ctx.textBaseline = 'top';
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      if (Math.random() < 0.004) c.ch = pick(CHARS);
      var v = 0.5 + 0.5 * Math.sin(t * c.sp * 8 + c.ph);
      ctx.fillStyle = 'rgba(' + palette[0] + ',' + (c.a * v) + ')';
      ctx.fillText(c.ch, c.x, c.y);
    }
  }

  /* --- panal hexagonal con celdas que se iluminan --- */
  function initHex() {
    var R = 34, dx = R * 1.732, dy = R * 1.5;
    hexes = [];
    for (var j = -1; j * dy < h + R; j++) {
      for (var i = -1; i * dx < w + R; i++) {
        hexes.push({ x: i * dx + (j % 2 ? dx / 2 : 0), y: j * dy, r: R, c: pick(palette), lit: 0 });
      }
    }
  }
  function drawHex() {
    ctx.lineWidth = 1;
    for (var i = 0; i < hexes.length; i++) {
      var hx = hexes[i];
      if (hx.lit > 0) hx.lit -= 0.012;
      else if (Math.random() < 0.0006) hx.lit = 1;
      ctx.beginPath();
      for (var k = 0; k < 6; k++) {
        var a = Math.PI / 180 * (60 * k - 30);
        var px = hx.x + hx.r * Math.cos(a), py = hx.y + hx.r * Math.sin(a);
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(' + hx.c + ',' + (0.1 + 0.55 * Math.max(0, hx.lit)) + ')';
      ctx.stroke();
      if (hx.lit > 0) { ctx.fillStyle = 'rgba(' + hx.c + ',' + (0.14 * hx.lit) + ')'; ctx.fill(); }
    }
  }

  /* --- plasma: manchas fundidas, tipo lámpara de lava --- */
  function initPlasma() {
    blobs = Array.from({ length: 9 }, function () {
      return {
        x: Math.random() * w, y: Math.random() * h,
        vx: rnd(-0.35, 0.35), vy: rnd(-0.35, 0.35),
        r: rnd(140, 340), c: pick(palette), ph: rnd(0, 6.28)
      };
    });
  }
  function drawPlasma() {
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < blobs.length; i++) {
      var b = blobs[i];
      b.x += b.vx; b.y += b.vy;
      if (b.x < -b.r || b.x > w + b.r) b.vx *= -1;
      if (b.y < -b.r || b.y > h + b.r) b.vy *= -1;
      var r = b.r * (1 + 0.14 * Math.sin(t * 0.01 + b.ph));
      var g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
      g.addColorStop(0, 'rgba(' + b.c + ',.3)');
      g.addColorStop(0.45, 'rgba(' + b.c + ',.09)');
      g.addColorStop(1, 'rgba(' + b.c + ',0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, 6.284); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* --- luciérnagas: derivan y parpadean --- */
  function initFireflies() {
    var n = Math.min(90, Math.round(w * h / 17000));
    bits = Array.from({ length: n }, function () {
      return {
        x: Math.random() * w, y: Math.random() * h,
        vx: rnd(-0.3, 0.3), vy: rnd(-0.3, 0.3),
        r: rnd(1, 2.8), c: pick(palette), ph: rnd(0, 6.28), sp: rnd(0.01, 0.045)
      };
    });
  }
  function drawFireflies() {
    for (var i = 0; i < bits.length; i++) {
      var f = bits[i];
      f.vx += rnd(-0.02, 0.02); f.vy += rnd(-0.02, 0.02);
      f.vx = Math.max(-0.5, Math.min(0.5, f.vx)); f.vy = Math.max(-0.5, Math.min(0.5, f.vy));
      f.x += f.vx; f.y += f.vy;
      if (f.x < 0) f.x = w; else if (f.x > w) f.x = 0;
      if (f.y < 0) f.y = h; else if (f.y > h) f.y = 0;
      var v = Math.pow(0.5 + 0.5 * Math.sin(t * f.sp + f.ph), 3);
      var g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 12);
      g.addColorStop(0, 'rgba(' + f.c + ',' + (0.55 * v) + ')');
      g.addColorStop(1, 'rgba(' + f.c + ',0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 12, 0, 6.284); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,' + (0.7 * v) + ')';
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 0.6, 0, 6.284); ctx.fill();
    }
  }

  /* --- confeti: papelitos que caen girando --- */
  function initConfetti() {
    var n = Math.min(110, Math.round(w * h / 14000));
    bits = Array.from({ length: n }, function () {
      return {
        x: Math.random() * w, y: Math.random() * h,
        vy: rnd(0.6, 2), sway: rnd(0.4, 1.6), ph: rnd(0, 6.28),
        w: rnd(5, 12), h: rnd(8, 18), rot: rnd(0, 6.28), vr: rnd(-0.06, 0.06),
        c: pick(palette), a: rnd(0.35, 0.85)
      };
    });
  }
  function drawConfetti() {
    for (var i = 0; i < bits.length; i++) {
      var p = bits[i];
      p.y += p.vy; p.x += Math.sin(t * 0.02 + p.ph) * p.sway; p.rot += p.vr;
      if (p.y > h + 25) { p.y = -25; p.x = Math.random() * w; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.scale(1, Math.max(0.15, Math.abs(Math.cos(t * 0.035 + p.ph))));
      ctx.fillStyle = 'rgba(' + p.c + ',' + p.a + ')';
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
  }

  var INIT = {
    constellation: initConstellation, circuit: initCircuit, embers: initEmbers,
    rain: initRain, snow: initSnow, starfield: initStarfield,
    petals: initPetals, blocks: initBlocks, bubbles: initBubbles, waves: initWaves,
    drizzle: initDrizzle, phosphor: initPhosphor, hex: initHex, plasma: initPlasma,
    fireflies: initFireflies, confetti: initConfetti
  };

  /* ---------- estrellas fugaces (compartidas) ---------- */
  function spawnShooter() {
    var fromLeft = Math.random() < 0.5;
    shooters.push({
      x: fromLeft ? rnd(-100, w * 0.5) : rnd(w * 0.5, w + 100),
      y: rnd(-60, h * 0.45),
      vx: (fromLeft ? 1 : -1) * rnd(5, 10),
      vy: rnd(2.5, 5.5),
      life: 1, c: pick(palette)
    });
  }
  function drawShooters() {
    if (Math.random() < 0.0055 && shooters.length < 3) spawnShooter();
    for (var i = shooters.length - 1; i >= 0; i--) {
      var s = shooters[i];
      s.x += s.vx; s.y += s.vy; s.life -= 0.011;
      if (s.life <= 0 || s.x < -220 || s.x > w + 220 || s.y > h + 120) { shooters.splice(i, 1); continue; }
      var g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 13, s.y - s.vy * 13);
      g.addColorStop(0, 'rgba(' + s.c + ',' + (0.9 * s.life) + ')');
      g.addColorStop(1, 'rgba(' + s.c + ',0)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 13, s.y - s.vy * 13); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,' + (0.85 * s.life) + ')';
      ctx.beginPath(); ctx.arc(s.x, s.y, 1.7, 0, 6.284); ctx.fill();
    }
  }

  /* ---------- dibujo por modo ---------- */

  function drawConstellation() {
    var LINK = 20000, MOUSE = 34000;
    for (var i = 0; i < stars.length; i++) {
      var p = stars[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = w; else if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; else if (p.y > h) p.y = 0;

      var tw = 0.45 + 0.55 * Math.abs(Math.sin(t * 0.02 * p.ts + p.tw));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.284);
      ctx.fillStyle = 'rgba(' + p.c + ',' + (0.75 * tw) + ')'; ctx.fill();
      if (p.r > 1.4) {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.4, 0, 6.284);
        ctx.fillStyle = 'rgba(' + p.c + ',' + (0.07 * tw) + ')'; ctx.fill();
      }

      if (!p.link) continue;
      for (var j = i + 1; j < stars.length; j++) {
        var q = stars[j]; if (!q.link) continue;
        var dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
        if (d2 > LINK) continue;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
        ctx.strokeStyle = 'rgba(' + p.c + ',' + (0.16 * (1 - d2 / LINK)) + ')';
        ctx.lineWidth = 1; ctx.stroke();
      }
      // constelación viva alrededor del cursor
      var mx = p.x - pointer.x, my = p.y - pointer.y, m2 = mx * mx + my * my;
      if (m2 < MOUSE) {
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(pointer.x, pointer.y);
        ctx.strokeStyle = 'rgba(' + p.c + ',' + (0.32 * (1 - m2 / MOUSE)) + ')';
        ctx.lineWidth = 1; ctx.stroke();
      }
    }
    drawShooters();
  }

  function drawCircuit() {
    ctx.lineWidth = 1;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var pulse = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.03 + n.p));
      ctx.beginPath(); ctx.arc(n.x, n.y, 1.6, 0, 6.284);
      ctx.fillStyle = 'rgba(' + n.c + ',' + (0.8 * pulse) + ')'; ctx.fill();
      for (var j = i + 1; j < nodes.length; j++) {
        var m = nodes[j], dx = Math.abs(n.x - m.x), dy = Math.abs(n.y - m.y);
        if ((dx < 8 && dy < 110) || (dy < 8 && dx < 110)) {
          ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(m.x, m.y);
          ctx.strokeStyle = 'rgba(' + n.c + ',.13)'; ctx.stroke();
        }
      }
    }
    if (Math.random() < 0.09 && pulses.length < 26 && nodes.length) {
      var a = pick(nodes);
      pulses.push({ x: a.x, y: a.y, dir: Math.random() < 0.5 ? 0 : 1, sp: rnd(2.5, 7), life: 1, c: a.c, sign: Math.random() < 0.5 ? -1 : 1 });
    }
    for (var k = pulses.length - 1; k >= 0; k--) {
      var p = pulses[k];
      if (p.dir === 0) p.x += p.sp * p.sign; else p.y += p.sp * p.sign;
      p.life -= 0.012;
      if (p.life <= 0) { pulses.splice(k, 1); continue; }
      var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16);
      g.addColorStop(0, 'rgba(' + p.c + ',' + (0.9 * p.life) + ')');
      g.addColorStop(1, 'rgba(' + p.c + ',0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, 6.284); ctx.fill();
    }
  }

  function drawEmbers() {
    for (var i = 0; i < embers.length; i++) {
      var e = embers[i];
      e.y += e.vy; e.x += Math.sin(t * 0.01 + e.ph) * e.sway * 0.35;
      if (e.y < -20) { e.y = h + 20; e.x = Math.random() * w; }
      var fl = 0.55 + 0.45 * Math.sin(t * 0.05 + e.ph);
      var g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 7);
      g.addColorStop(0, 'rgba(' + e.c + ',' + (e.a * fl) + ')');
      g.addColorStop(1, 'rgba(' + e.c + ',0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 7, 0, 6.284); ctx.fill();
      ctx.fillStyle = 'rgba(255,236,200,' + (e.a * fl * 0.8) + ')';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.5, 0, 6.284); ctx.fill();
    }
  }

  var GLYPHS = 'アカサタナハマヤラワｱｲｳｴｵ0123456789ABCDEF<>/\\|=+*#$@'.split('');
  function drawRain() {
    ctx.font = '15px "Share Tech Mono", monospace';
    ctx.textBaseline = 'top';
    for (var i = 0; i < drops.length; i++) {
      var d = drops[i];
      d.y += d.sp;
      if (d.y - d.len * 17 > h) { d.y = rnd(-h * 0.6, 0); d.sp = rnd(2.4, 8); d.len = (rnd(6, 22) | 0); }
      for (var k = 0; k < d.len; k++) {
        var y = d.y - k * 17;
        if (y < -18 || y > h) continue;
        var a = (1 - k / d.len) * 0.85;
        ctx.fillStyle = k === 0 ? 'rgba(220,255,235,.95)' : 'rgba(' + palette[0] + ',' + a + ')';
        ctx.fillText(GLYPHS[((i * 7 + k * 3 + ((t * d.sp) / 22 | 0)) % GLYPHS.length + GLYPHS.length) % GLYPHS.length], d.x, y);
      }
    }
  }

  function drawSnow() {
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];
      f.y += f.vy; f.x += Math.sin(t * 0.008 + f.ph) * f.sway * 0.5;
      if (f.y > h + 12) { f.y = -12; f.x = Math.random() * w; }
      if (f.x < -12) f.x = w + 12; else if (f.x > w + 12) f.x = -12;
      var g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 5);
      g.addColorStop(0, 'rgba(' + f.c + ',' + f.a + ')');
      g.addColorStop(1, 'rgba(' + f.c + ',0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 5, 0, 6.284); ctx.fill();
      ctx.fillStyle = 'rgba(' + f.c + ',' + (f.a * 1.6) + ')';
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 0.55, 0, 6.284); ctx.fill();
    }
  }

  function drawStarfield() {
    var cx = w / 2, cy = h * 0.42;
    for (var i = 0; i < warp.length; i++) {
      var s = warp[i];
      s.d += s.sp * (0.4 + s.d / (w * 0.9));
      if (s.d > Math.max(w, h)) { s.d = rnd(6, 40); s.a = rnd(0, 6.28); s.sp = rnd(0.25, 1.5); }
      var x = cx + Math.cos(s.a) * s.d, y = cy + Math.sin(s.a) * s.d * 0.62;
      var px = cx + Math.cos(s.a) * (s.d - s.sp * 7), py = cy + Math.sin(s.a) * (s.d - s.sp * 7) * 0.62;
      var a = Math.min(0.9, s.d / (w * 0.35));
      ctx.strokeStyle = 'rgba(' + s.c + ',' + a + ')';
      ctx.lineWidth = Math.min(2.2, 0.4 + s.d / (w * 0.4));
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
    }
    drawShooters();
  }

  var DRAW = {
    constellation: drawConstellation, circuit: drawCircuit, embers: drawEmbers,
    rain: drawRain, snow: drawSnow, starfield: drawStarfield,
    petals: drawPetals, blocks: drawBlocks, bubbles: drawBubbles, waves: drawWaves,
    drizzle: drawDrizzle, phosphor: drawPhosphor, hex: drawHex, plasma: drawPlasma,
    fireflies: drawFireflies, confetti: drawConfetti
  };

  /* modos que dejan rastro en vez de limpiar el lienzo */
  var TRAIL = { rain: 'rgba(0,10,5,.13)', phosphor: 'rgba(10,5,0,.14)' };

  /* ---------- bucle ---------- */
  function frame() {
    t++;
    if (TRAIL[mode]) {
      // rastro: en vez de limpiar, oscurecemos
      ctx.fillStyle = TRAIL[mode];
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }
    (DRAW[mode] || drawConstellation)();
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    (INIT[mode] || initConstellation)();
  }

  function setMode(next) {
    mode = INIT[next] ? next : 'constellation';
    readPalette();
    (INIT[mode])();
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
  if (reduce) { ctx.clearRect(0, 0, w, h); (DRAW[mode])(); }
  else frame();

  return { setMode: setMode, refresh: function () { readPalette(); } };
})();
