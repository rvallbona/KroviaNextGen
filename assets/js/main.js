/* ============================================================
   KroviaNextGen — Interacciones de la landing
   ============================================================ */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  /* ---------- Año en el footer ---------- */
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  /* ---------- Nav ---------- */
  const nav = $('#nav'), burger = $('#navBurger'), links = $('#navLinks');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 30);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  burger.addEventListener('click', () => links.classList.toggle('is-open'));
  $$('#navLinks a').forEach(a => a.addEventListener('click', () => links.classList.remove('is-open')));

  /* ---------- Reveal on scroll ---------- */
  const revealables = $$('.section__head, .glass-card, .steps li, .marquee, .final-cta h2');
  revealables.forEach(el => el.classList.add('reveal'));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('is-visible'), (i % 6) * 70);
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px' });
  revealables.forEach(el => io.observe(el));

  /* ---------- Contadores del hero ---------- */
  const counters = $$('[data-count]');
  const cio = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target, end = parseInt(el.dataset.count, 10);
      let cur = 0;
      const step = Math.max(1, Math.round(end / 34));
      const t = setInterval(() => {
        cur += step;
        if (cur >= end) { cur = end; clearInterval(t); }
        el.textContent = cur;
      }, 32);
      cio.unobserve(el);
    });
  }, { threshold: 0.6 });
  counters.forEach(el => cio.observe(el));

  /* ---------- Chat ---------- */
  const panel = $('#chatPanel'), launcher = $('#chatLauncher');
  const openChat = () => {
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('chat-open');
    const badge = launcher.querySelector('.chat-launcher__badge');
    if (badge) badge.style.display = 'none';
    window.KroviaChat.start();
  };
  const closeChat = () => {
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('chat-open');
  };

  launcher.addEventListener('click', openChat);
  $('#chatClose').addEventListener('click', closeChat);
  $('#chatRestart').addEventListener('click', () => window.KroviaChat.reset());
  $$('[data-open-chat]').forEach(b => b.addEventListener('click', openChat));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeChat(); });

  /* Puente chat -> formulario */
  window.KroviaChat.close = closeChat;
  window.KroviaChat.prefillForm = function () {
    const a = window.KroviaChat.answers();
    const rec = window.KroviaChat.recommendation();
    const map = { web: 'Web o landing page', chatbot: 'Chatbot / agente de atención', automatizacion: 'Automatización de procesos', compras: 'Agente de compras', datos: 'Dashboards e informes' };
    if (a.nombre) $('#f-nombre').value = a.nombre;
    if (a.email) $('#f-email').value = a.email;
    const sel = $('#f-servicio');
    const wanted = map[rec.main];
    if (wanted) Array.from(sel.options).forEach(o => { if (o.text === wanted) sel.value = o.value || o.text; });
    const partes = [];
    if (a.sector) partes.push('Sector: ' + a.sector);
    if (a.equipo) partes.push('Equipo: ' + a.equipo);
    if (a.objetivo || a.freno) partes.push('Objetivo: ' + (a.objetivo || a.freno));
    if (a.urgencia) partes.push('Plazo: ' + a.urgencia);
    if (partes.length) $('#f-msg').value = partes.join(' · ');
    $('#f-nombre').closest('.form').classList.add('is-prefilled');
  };

  /* Auto-apertura suave del chat la primera vez */
  let auto = false;
  const autoOpen = () => {
    if (auto || document.body.classList.contains('chat-open')) return;
    auto = true;
    launcher.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
      { duration: 700, iterations: 2 }
    );
  };
  setTimeout(autoOpen, 12000);

  /* ---------- Formulario ---------- */
  const form = $('#leadForm'), ok = $('#formOk');
  form.addEventListener('submit', e => {
    e.preventDefault();
    let valid = true;
    ['#f-nombre', '#f-email'].forEach(sel => {
      const el = $(sel), field = el.closest('.field');
      const bad = !el.value.trim() || (el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(el.value));
      field.classList.toggle('is-error', bad);
      if (bad) valid = false;
    });
    if (!valid) return;

    // DEMO: sin backend todavía. Guardamos la solicitud en el navegador.
    const data = Object.fromEntries(new FormData(form).entries());
    data.fecha = new Date().toISOString();
    console.log('[KroviaNextGen] Solicitud de consulta:', data);

    ok.hidden = false;
    form.querySelector('button[type="submit"]').textContent = '¡Enviado!';
    setTimeout(() => { ok.hidden = true; form.reset(); form.querySelector('button[type="submit"]').textContent = 'Reservar mi consulta gratuita'; }, 6000);
  });

  /* ---------- Canvas: red neuronal ---------- */
  const canvas = $('#neural-canvas');
  if (canvas && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const ctx = canvas.getContext('2d');
    let w, h, pts = [], raf;
    const COLORS = ['168,85,247', '34,211,238', '52,245,197'];

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const count = Math.min(90, Math.round(w * h / 22000));
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - .5) * .28, vy: (Math.random() - .5) * .28,
        r: Math.random() * 1.6 + .6,
        c: COLORS[Math.floor(Math.random() * COLORS.length)]
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + p.c + ',.75)';
        ctx.fill();
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j], dx = p.x - q.x, dy = p.y - q.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 20000) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = 'rgba(' + p.c + ',' + (0.16 * (1 - d2 / 20000)) + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    }

    resize(); draw();
    window.addEventListener('resize', () => { cancelAnimationFrame(raf); resize(); draw(); });
  }
})();
