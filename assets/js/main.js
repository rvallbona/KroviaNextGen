/* ============================================================
   KroviaNextGen — Interacciones + integraciones reales
   (Supabase · Calendly · WhatsApp · Webhook n8n/Make/Zapier)
   ============================================================ */
(function () {
  'use strict';
  const CFG = Object.assign(
    { calendlyUrl: '', whatsappNumber: '', webhookUrl: '', email: '', supabaseUrl: '', supabaseAnonKey: '', whatsappMensaje: 'Hola, vengo de la web de KroviaNextGen.' },
    window.KROVIA_CONFIG || {}
  );

  /* ============ SUPABASE ============ */
  /* Cliente único. Solo se crea si hay credenciales y el SDK ha cargado. */
  const supa = (CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase)
    ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey)
    : null;
  if ((CFG.supabaseUrl || CFG.supabaseAnonKey) && !supa) {
    console.warn('[Krovia] Supabase sin configurar del todo: revisa supabaseUrl y supabaseAnonKey en config.js, y que el <script> del SDK vaya antes que main.js.');
  }
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

  /* ============ CALENDLY ============ */
  let calLoaded = false;
  function loadCalendly(prefill) {
    if (!CFG.calendlyUrl) { $('#calendlyBox').hidden = true; $('#calendlyEmpty').hidden = false; showTab('form'); return; }
    if (calLoaded) return;
    calLoaded = true;
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://assets.calendly.com/assets/external/widget.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'https://assets.calendly.com/assets/external/widget.js'; js.async = true;
    js.onload = () => {
      if (!window.Calendly) return;
      window.Calendly.initInlineWidget({
        url: CFG.calendlyUrl + '?hide_gdpr_banner=1&background_color=0b0616&text_color=f1edfc&primary_color=a855f7',
        parentElement: $('#calendlyBox'),
        prefill: prefill || {}
      });
    };
    js.onerror = () => { $('#calendlyEmpty').hidden = false; };
    document.body.appendChild(js);
  }
  // Carga perezosa: solo cuando la sección entra en pantalla o se pulsa una CTA
  const agendaIO = new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting)) { loadCalendly(); agendaIO.disconnect(); }
  }, { rootMargin: '300px' });
  agendaIO.observe($('#agenda'));

  function goAgenda(prefill, tab) {
    loadCalendly(prefill);
    if (tab) showTab(tab);
    $('#agenda').scrollIntoView({ behavior: 'smooth' });
  }
  $$('[data-cta="agenda"]').forEach(b => b.addEventListener('click', () => goAgenda()));

  /* ============ ENVÍO DE LEADS ============ */
  async function sendLead(data) {
    const payload = Object.assign({
      origen: 'landing-krovianextgen',
      url: location.href,
      fecha: new Date().toISOString()
    }, data);

    // copia local siempre (por si falla la red)
    try {
      const prev = JSON.parse(localStorage.getItem('krovia_leads') || '[]');
      prev.push(payload); localStorage.setItem('krovia_leads', JSON.stringify(prev));
    } catch (e) { /* ignorar */ }

    if (!supa && !CFG.webhookUrl) return { ok: false, reason: 'sin-destino', payload };

    let supaOk = false, webhookOk = false, lastError = null;

    // 1) Supabase — destino principal
    if (supa) {
      try {
        const { error } = await supa.from('leads').insert({
          nombre:   payload.nombre   || null,
          email:    payload.email    || null,
          telefono: payload.telefono || null,
          servicio: payload.servicio || null,
          mensaje:  payload.mensaje  || null,
          origen:   payload.origen   || null,
          url:      payload.url      || null,
          chatbot:  payload.chatbot  || null
        });
        if (error) { lastError = error.message; console.error('[Krovia] Supabase:', error); }
        else supaOk = true;
      } catch (err) {
        lastError = String(err); console.error('[Krovia] Supabase:', err);
      }
    }

    // 2) Webhook — opcional, se envía además de Supabase
    if (CFG.webhookUrl) {
      try {
        const r = await fetch(CFG.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        webhookOk = r.ok;
        if (!r.ok) lastError = 'webhook HTTP ' + r.status;
      } catch (err) {
        lastError = String(err);
      }
    }

    // Basta con que UN destino haya funcionado para no perder el lead.
    return { ok: supaOk || webhookOk, supaOk, webhookOk, reason: 'network', error: lastError, payload };
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
      if (CFG.calendlyUrl) setTimeout(() => { showTab('cal'); loadCalendly({ name: data.nombre, email: data.email }); }, 1200);
    } else if (res.reason === 'sin-destino') {
      const m = mailtoFallback(data);
      show('Guardado. Falta conectar Supabase en <code>config.js</code>' + (m ? ' — <a href="' + m + '">enviar por email</a>' : ''), true);
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
    hasCalendly: !!CFG.calendlyUrl,
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
      goAgenda(prefill, CFG.calendlyUrl ? 'cal' : 'form');
      if (prefill) {
        if (prefill.name) $('#f-nombre').value = prefill.name;
        if (prefill.email) $('#f-email').value = prefill.email;
        if (prefill.mensaje) $('#f-msg').value = prefill.mensaje;
        if (prefill.servicio) {
          const sel = $('#f-servicio');
          Array.from(sel.options).forEach(o => { if (o.text.toLowerCase().includes(prefill.servicio.toLowerCase())) sel.value = o.value || o.text; });
        }
      }
    }
  };

  /* ============ CANVAS ============ */
  const canvas = $('#neural-canvas');
  if (canvas && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const ctx = canvas.getContext('2d');
    let w, h, pts = [], raf;
    const C = ['168,85,247', '34,211,238', '52,245,197'];
    function resize() {
      w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight;
      pts = Array.from({ length: Math.min(80, Math.round(w * h / 24000)) }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25,
        r: Math.random() * 1.5 + .5, c: C[Math.floor(Math.random() * C.length)]
      }));
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.284);
        ctx.fillStyle = 'rgba(' + p.c + ',.7)'; ctx.fill();
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j], dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
          if (d2 < 19000) {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = 'rgba(' + p.c + ',' + (.14 * (1 - d2 / 19000)) + ')';
            ctx.lineWidth = 1; ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    }
    resize(); draw();
    window.addEventListener('resize', () => { cancelAnimationFrame(raf); resize(); draw(); });
  }
})();
