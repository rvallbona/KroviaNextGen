/* ============================================================
   KroviaNextGen — Interacciones + integraciones
   Los datos NO se envían desde aquí a Supabase: van a nuestras
   funciones (/api/lead y /api/book), que son las únicas que
   tienen las claves privadas. Ver api/_lib.js y README.md.
   ============================================================ */
(function () {
  'use strict';
  const CFG = Object.assign(
    { apiBase: '', whatsappNumber: '', email: '', whatsappMensaje: 'Hola, vengo de la web de KroviaNextGen.' },
    window.KROVIA_CONFIG || {}
  );
  const API = String(CFG.apiBase || '').replace(/\/+$/, '');

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  $('#year').textContent = new Date().getFullYear();

  /* ============ NAV ============ */
  const nav = $('#nav'), links = $('#navLinks');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 30);
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  $('#navBurger').addEventListener('click', () => links.classList.toggle('is-open'));
  $$('#navLinks a').forEach(a => a.addEventListener('click', () => links.classList.remove('is-open')));

  /* ============ REVEAL ============ */
  const rev = $$('.section__head, .tile, .step, .numbers, .book, .faq details, .final-cta h2, .marquee');
  rev.forEach(el => el.classList.add('reveal'));
  const io = new IntersectionObserver(es => es.forEach((e, i) => {
    if (e.isIntersecting) { setTimeout(() => e.target.classList.add('is-visible'), (i % 5) * 70); io.unobserve(e.target); }
  }), { threshold: .1, rootMargin: '0px 0px -50px' });
  rev.forEach(el => io.observe(el));

  /* ============ CONTADORES ============ */
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, end = +el.dataset.count; let cur = 0;
    const step = Math.max(1, Math.round(end / 30));
    const t = setInterval(() => { cur += step; if (cur >= end) { cur = end; clearInterval(t); } el.textContent = cur; }, 34);
    cio.unobserve(el);
  }), { threshold: .6 });
  $$('[data-count]').forEach(el => cio.observe(el));

  /* ============ WHATSAPP ============ */
  function waLink(texto) {
    if (!CFG.whatsappNumber) return null;
    const n = String(CFG.whatsappNumber).replace(/\D/g, '');
    return 'https://wa.me/' + n + '?text=' + encodeURIComponent(texto || CFG.whatsappMensaje);
  }
  const waFloat = $('#waFloat');
  if (CFG.whatsappNumber) {
    waFloat.href = waLink();
    waFloat.hidden = false;
    $('#waLink').href = waLink();
    $('#tabWa').hidden = false;
  }
  if (CFG.email) $('#footerMail').href = 'mailto:' + CFG.email;

  /* ============ TABS DE AGENDA ============ */
  const tabs = $$('#bookTabs .tab'), panels = $$('.book__panel');
  function showTab(name) {
    tabs.forEach(t => t.classList.toggle('is-active', t.dataset.tab === name));
    panels.forEach(p => p.classList.toggle('is-active', p.dataset.panel === name));
  }
  tabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));

  /* ============ AGENDA ============ */
  function goAgenda(prefill, tab) {
    if (prefill && window.KroviaAgenda) window.KroviaAgenda.prefill(prefill);
    if (tab) showTab(tab);
    $('#agenda').scrollIntoView({ behavior: 'smooth' });
  }
  $$('[data-cta="agenda"]').forEach(b => b.addEventListener('click', () => goAgenda()));

  /* ============ ENVÍO DE LEADS ============ */
  /* Va a /api/lead: es la función la que guarda en Supabase y
     manda los avisos, porque es la única con las claves privadas. */
  async function sendLead(data) {
    const payload = Object.assign({ origen: 'formulario-web', url: location.href }, data);

    // copia local siempre, por si se cae la red mientras envía
    try {
      const prev = JSON.parse(localStorage.getItem('krovia_leads') || '[]');
      prev.push(Object.assign({ fecha: new Date().toISOString() }, payload));
      localStorage.setItem('krovia_leads', JSON.stringify(prev));
    } catch (e) { /* modo privado */ }

    try {
      const r = await fetch(API + '/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const res = await r.json().catch(() => null);
      if (r.ok && res && res.ok) return { ok: true, payload };
      if (r.status === 404) return { ok: false, reason: 'sin-destino', payload };
      return { ok: false, reason: 'network', error: (res && res.error) || ('HTTP ' + r.status), payload };
    } catch (err) {
      return { ok: false, reason: 'network', error: String(err), payload };
    }
  }

  function mailtoFallback(data) {
    if (!CFG.email) return null;
    const cuerpo = Object.entries(data).map(([k, v]) => k + ': ' + v).join('\n');
    return 'mailto:' + CFG.email + '?subject=' + encodeURIComponent('Consulta desde la web — ' + (data.nombre || '')) +
      '&body=' + encodeURIComponent(cuerpo);
  }

  /* ============ FORMULARIO ============ */
  const form = $('#leadForm'), msg = $('#formMsg'), submit = $('#leadSubmit');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    let valid = true;
    [['#f-nombre', v => v.trim().length > 1], ['#f-email', v => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)]]
      .forEach(([sel, test]) => {
        const el = $(sel), bad = !test(el.value);
        el.closest('.field').classList.toggle('is-error', bad);
        if (bad) valid = false;
      });
    if (!valid) { show('Revisa el nombre y el email 🙂', true); return; }

    submit.disabled = true; submit.textContent = 'Enviando…';
    const data = Object.fromEntries(new FormData(form).entries());
    if (window.KroviaChat && window.KroviaChat.answers) {
      const a = window.KroviaChat.answers();
      if (Object.keys(a).length) data.chatbot = a;
    }
    const res = await sendLead(data);
    submit.disabled = false; submit.textContent = 'Enviar y reservar';

    if (res.ok) {
      show('✅ Recibido. Te escribimos en menos de 24 h.');
      form.reset();
      // con los datos ya puestos, le ofrecemos elegir hora directamente
      setTimeout(() => {
        showTab('cal');
        if (window.KroviaAgenda) window.KroviaAgenda.prefill({ nombre: data.nombre, email: data.email, telefono: data.telefono, servicio: data.servicio });
      }, 1400);
    } else if (res.reason === 'sin-destino') {
      const m = mailtoFallback(data);
      show('No hay servidor detrás (falta desplegar <code>/api</code>)' + (m ? ' — <a href="' + m + '">enviar por email</a>' : ''), true);
    } else {
      const m = mailtoFallback(data);
      show('No hemos podido enviarlo' + (m ? ' — <a href="' + m + '">escríbenos por email</a>' : '') + '.', true);
    }
  });
  function show(html, error) {
    msg.hidden = false; msg.innerHTML = html;
    msg.classList.toggle('is-error', !!error);
    if (!error) setTimeout(() => { msg.hidden = true; }, 8000);
  }

  /* ============ CHAT ============ */
  const panel = $('#chatPanel'), launcher = $('#chatLauncher');
  const openChat = () => {
    panel.classList.add('is-open'); panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('chat-open');
    const b = launcher.querySelector('.chat-launcher__badge'); if (b) b.style.display = 'none';
    window.KroviaChat.start();
  };
  const closeChat = () => {
    panel.classList.remove('is-open'); panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('chat-open');
  };
  launcher.addEventListener('click', openChat);
  $('#chatClose').addEventListener('click', closeChat);
  $('#chatRestart').addEventListener('click', () => window.KroviaChat.reset());
  $$('[data-open-chat]').forEach(b => b.addEventListener('click', openChat));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeChat(); });

  /* Puente chat -> integraciones */
  window.Krovia = {
    hasAgenda: true,
    hasWhatsApp: !!CFG.whatsappNumber,
    closeChat,
    waLink,
    /* el chatbot llama a esto al terminar el cuestionario */
    async leadFromChat(data, resumen) {
      const res = await sendLead(Object.assign({ origen: 'chatbot' }, data));
      return res;
    },
    goAgenda(prefill) {
      closeChat();
      // el chatbot habla de "name"; la agenda y el formulario, de "nombre"
      const p = Object.assign({}, prefill, { nombre: (prefill && (prefill.nombre || prefill.name)) || '' });
      goAgenda(p, 'cal');
      if (prefill) {
        if (p.nombre) $('#f-nombre').value = p.nombre;
        if (p.email) $('#f-email').value = p.email;
        if (p.mensaje) $('#f-msg').value = p.mensaje;
        if (p.servicio) {
          const sel = $('#f-servicio');
          Array.from(sel.options).forEach(o => { if (o.text.toLowerCase().includes(String(p.servicio).toLowerCase())) sel.value = o.value || o.text; });
        }
      }
    }
  };

  /* ============ ANIMACIONES DE INTERFAZ ============ */
  /* El fondo animado vive en background.js */
  const noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* barra de progreso de lectura */
  const bar = $('#scrollBar');
  const onProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
  };
  onProgress(); window.addEventListener('scroll', onProgress, { passive: true });

  /* el burger se convierte en X */
  $('#navBurger').addEventListener('click', function () { this.classList.toggle('is-open'); });

  /* título del hero: cada palabra entra por separado */
  const title = $('.hero__title');
  if (title && !noMotion) {
    const parts = Array.from(title.childNodes);
    title.textContent = '';
    let i = 0;
    parts.forEach(node => {
      if (node.nodeName === 'BR') { title.appendChild(node); return; }
      const isEl = node.nodeType === 1;
      const words = (node.textContent || '').trim().split(/\s+/).filter(Boolean);
      words.forEach(word => {
        // la puntuación suelta se pega a la palabra anterior
        const last = title.lastElementChild;
        if (/^[.,;:!?]+$/.test(word) && last && last.classList.contains('w')) {
          last.textContent += word; return;
        }
        const span = document.createElement('span');
        span.className = 'w' + (isEl ? ' ' + node.className : '');
        span.textContent = word;
        span.style.animationDelay = (i++ * 90 + 120) + 'ms';
        title.appendChild(span);
      });
    });
  }

  if (!noMotion && window.matchMedia('(pointer:fine)').matches) {
    /* halo que sigue al cursor */
    const glow = $('#cursorGlow');
    let gx = 0, gy = 0, tx = 0, ty = 0, gRaf;
    document.body.classList.add('has-cursor');
    window.addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    (function follow() {
      gx += (tx - gx) * .09; gy += (ty - gy) * .09;
      glow.style.transform = 'translate3d(' + gx + 'px,' + gy + 'px,0)';
      gRaf = requestAnimationFrame(follow);
    })();

    /* foco de luz dentro de cada tarjeta */
    $$('.tile').forEach(tile => {
      tile.addEventListener('pointermove', e => {
        const r = tile.getBoundingClientRect();
        tile.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        tile.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    });

    /* botones magnéticos: el desplazamiento va con el tamaño del botón,
       así que además del factor hace falta un tope. Sin él, un botón
       ancho se despegaba varios centímetros del cursor.
       Movimiento corto a propósito: se nota que el botón responde,
       pero no se despega del sitio ni tapa el texto de al lado. */
    const clamp = (v, m) => Math.max(-m, Math.min(m, v));
    $$('.btn--lg, .chat-launcher').forEach(el => {
      const MAX = 2.5;
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const dx = clamp((e.clientX - r.left - r.width / 2) * .035, MAX);
        const dy = clamp((e.clientY - r.top - r.height / 2) * .07, MAX);
        el.style.translate = dx + 'px ' + dy + 'px';
      });
      el.addEventListener('pointerleave', () => { el.style.translate = ''; });
    });

    /* parallax suave de los orbes */
    const orbs = $$('.orb');
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      orbs.forEach((o, i) => { o.style.translate = '0 ' + (y * (0.04 + i * 0.03)) + 'px'; });
    }, { passive: true });
  }
})();
