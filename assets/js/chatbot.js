/* ============================================================
   KroviaNextGen — Agente conversacional (cuestionario dinámico)
   Motor de flujo: cada nodo puede ramificar según la respuesta.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Estado ---------- */
  const state = {
    answers: {},
    node: 'start',
    steps: 0,
    total: 7,
    finished: false
  };

  /* ---------- Catálogo de servicios ---------- */
  const SERVICIOS = {
    web: {
      nombre: 'Web / Landing de alta conversión',
      desc: 'Un sitio rápido, futurista y orientado a que la visita acabe agendando contigo.',
      entregables: ['Diseño a medida y copy de venta', 'Optimización SEO y velocidad', 'Formularios y analítica conectados']
    },
    chatbot: {
      nombre: 'Agente de atención y cualificación 24/7',
      desc: 'Un asistente entrenado con tu negocio que responde, cualifica y agenda por ti.',
      entregables: ['Entrenado con tu información real', 'Web + WhatsApp + redes', 'Traspaso a humano cuando hace falta']
    },
    automatizacion: {
      nombre: 'Automatización de procesos internos',
      desc: 'Tus herramientas conectadas para que los datos y las tareas fluyan solos.',
      entregables: ['Flujos automáticos (n8n / Make)', 'Integración con tu CRM y facturación', 'Alertas y seguimientos automáticos']
    },
    compras: {
      nombre: 'Agente de compras y proveedores',
      desc: 'Monitoriza precios, controla stock y lanza pedidos según tus reglas.',
      entregables: ['Comparativa automática de proveedores', 'Alertas de precio y de stock', 'Pedidos y seguimiento automatizados']
    },
    datos: {
      nombre: 'Dashboard e informes con IA',
      desc: 'Todos tus números en un panel vivo con un resumen que te dice qué hacer.',
      entregables: ['KPIs en tiempo real', 'Informe semanal automático', 'Alertas cuando algo se desvía']
    }
  };

  /* ---------- Flujo de preguntas ---------- */
  const FLOW = {
    start: {
      msgs: [
        '¡Hola! 👋 Soy el <b>agente de KroviaNextGen</b>.',
        'Te hago unas preguntas rápidas (menos de 1 minuto) y te digo exactamente qué tipo de solución encaja con tu negocio. ¿Por dónde empezamos?'
      ],
      key: 'objetivo',
      options: [
        { label: '🌐 Quiero una web nueva', value: 'Web nueva', next: 'web_1', track: 'web' },
        { label: '⚙️ Automatizar tareas repetitivas', value: 'Automatización', next: 'auto_1', track: 'automatizacion' },
        { label: '💬 Un chatbot que atienda por mí', value: 'Chatbot / atención', next: 'bot_1', track: 'chatbot' },
        { label: '🛒 Agente de compras y proveedores', value: 'Agente de compras', next: 'compras_1', track: 'compras' },
        { label: '🤔 No lo sé, ayúdame a descubrirlo', value: 'Necesita orientación', next: 'descubrir' }
      ]
    },

    descubrir: {
      msgs: ['Tranquilo, para eso estoy 🙂', '¿Qué es lo que <b>más te frena</b> ahora mismo en tu día a día?'],
      key: 'freno',
      options: [
        { label: 'Pierdo horas en tareas manuales', value: 'Tareas manuales', next: 'auto_1', track: 'automatizacion' },
        { label: 'No me llegan suficientes clientes', value: 'Pocos clientes', next: 'web_1', track: 'web' },
        { label: 'No doy abasto respondiendo mensajes', value: 'Saturación de mensajes', next: 'bot_1', track: 'chatbot' },
        { label: 'Proveedores y stock me comen el día', value: 'Compras y stock', next: 'compras_1', track: 'compras' },
        { label: 'Tengo datos pero no sé leerlos', value: 'Datos sin explotar', next: 'datos_1', track: 'datos' }
      ]
    },

    /* --- rama WEB --- */
    web_1: {
      msgs: ['Perfecto. ¿Qué tienes ahora mismo?'],
      key: 'web_actual',
      options: [
        { label: 'No tengo web', value: 'Sin web', next: 'web_2' },
        { label: 'Tengo web pero no convierte', value: 'Web que no convierte', next: 'web_2' },
        { label: 'Tengo una web antigua', value: 'Web antigua', next: 'web_2' }
      ]
    },
    web_2: {
      msgs: ['¿Cuál es el <b>objetivo principal</b> de la web?'],
      key: 'web_objetivo',
      options: [
        { label: 'Conseguir leads y reuniones', value: 'Captar leads', next: 'sector', track: 'chatbot' },
        { label: 'Vender productos online', value: 'Vender online', next: 'sector', track: 'compras' },
        { label: 'Imagen de marca y credibilidad', value: 'Marca', next: 'sector' }
      ]
    },

    /* --- rama AUTOMATIZACIÓN --- */
    auto_1: {
      msgs: ['Vamos allá. ¿Qué proceso te <b>come más tiempo</b> cada semana?'],
      key: 'proceso',
      options: [
        { label: 'Presupuestos y facturación', value: 'Presupuestos y facturas', next: 'auto_2' },
        { label: 'Alta y seguimiento de clientes', value: 'Gestión de clientes', next: 'auto_2' },
        { label: 'Informes y reporting', value: 'Reporting', next: 'auto_2', track: 'datos' },
        { label: 'Agenda y coordinación interna', value: 'Agenda y coordinación', next: 'auto_2' }
      ]
    },
    auto_2: {
      msgs: ['¿Con qué herramientas trabajáis hoy?'],
      key: 'herramientas',
      options: [
        { label: 'Excel / Google Sheets', value: 'Hojas de cálculo', next: 'sector' },
        { label: 'Un CRM (HubSpot, Zoho…)', value: 'CRM', next: 'sector' },
        { label: 'WhatsApp y email, poco más', value: 'WhatsApp y email', next: 'sector', track: 'chatbot' },
        { label: 'Un poco de todo y sin conectar', value: 'Herramientas sin conectar', next: 'sector' }
      ]
    },

    /* --- rama CHATBOT --- */
    bot_1: {
      msgs: ['Buena elección: es lo que antes se nota. ¿Dónde te escriben tus clientes?'],
      key: 'canales',
      options: [
        { label: 'WhatsApp', value: 'WhatsApp', next: 'bot_2' },
        { label: 'La web', value: 'Web', next: 'bot_2', track: 'web' },
        { label: 'Instagram / redes', value: 'Redes sociales', next: 'bot_2' },
        { label: 'Por todos lados', value: 'Multicanal', next: 'bot_2' }
      ]
    },
    bot_2: {
      msgs: ['¿Cuántas consultas recibís al día, más o menos?'],
      key: 'volumen',
      options: [
        { label: 'Menos de 10', value: '<10 al día', next: 'sector' },
        { label: 'Entre 10 y 50', value: '10-50 al día', next: 'sector' },
        { label: 'Más de 50', value: '+50 al día', next: 'sector', track: 'automatizacion' },
        { label: 'Ni idea, pero muchas', value: 'Alto volumen', next: 'sector' }
      ]
    },

    /* --- rama COMPRAS --- */
    compras_1: {
      msgs: ['Interesante 🛒 ¿Qué te gustaría que hiciera el agente?'],
      key: 'compras_objetivo',
      options: [
        { label: 'Comparar precios de proveedores', value: 'Comparar proveedores', next: 'compras_2' },
        { label: 'Controlar stock y reponer solo', value: 'Control de stock', next: 'compras_2' },
        { label: 'Lanzar pedidos automáticamente', value: 'Pedidos automáticos', next: 'compras_2' },
        { label: 'Seguir envíos e incidencias', value: 'Seguimiento de envíos', next: 'compras_2' }
      ]
    },
    compras_2: {
      msgs: ['¿Cuántos productos o referencias manejas?'],
      key: 'referencias',
      options: [
        { label: 'Menos de 50', value: '<50 referencias', next: 'sector' },
        { label: 'Entre 50 y 500', value: '50-500 referencias', next: 'sector' },
        { label: 'Más de 500', value: '+500 referencias', next: 'sector', track: 'datos' }
      ]
    },

    /* --- rama DATOS --- */
    datos_1: {
      msgs: ['¿Qué te gustaría ver de un vistazo cada semana?'],
      key: 'kpis',
      options: [
        { label: 'Ventas y facturación', value: 'Ventas', next: 'sector' },
        { label: 'Rendimiento de marketing', value: 'Marketing', next: 'sector', track: 'web' },
        { label: 'Productividad del equipo', value: 'Equipo', next: 'sector', track: 'automatizacion' },
        { label: 'Todo junto en un panel', value: 'Panel global', next: 'sector' }
      ]
    },

    /* --- tronco común --- */
    sector: {
      msgs: ['Genial. ¿A qué se dedica tu negocio? <i>(puedes escribirlo)</i>'],
      key: 'sector',
      free: true,
      options: [
        { label: 'Servicios profesionales', value: 'Servicios profesionales', next: 'equipo' },
        { label: 'E-commerce', value: 'E-commerce', next: 'equipo' },
        { label: 'Salud / clínica', value: 'Salud', next: 'equipo' },
        { label: 'Reformas / construcción', value: 'Reformas', next: 'equipo' },
        { label: 'Formación', value: 'Formación', next: 'equipo' }
      ],
      next: 'equipo'
    },
    equipo: {
      msgs: [s => `Anotado: <b>${esc(s.answers.sector || 'tu sector')}</b>. ¿Cuántas personas sois en el equipo?`],
      key: 'equipo',
      options: [
        { label: 'Solo yo', value: 'Solo yo', next: 'urgencia' },
        { label: '2 a 10', value: '2-10 personas', next: 'urgencia' },
        { label: '11 a 50', value: '11-50 personas', next: 'urgencia' },
        { label: 'Más de 50', value: '+50 personas', next: 'urgencia' }
      ]
    },
    urgencia: {
      msgs: ['Última del cuestionario: ¿para cuándo lo necesitas?'],
      key: 'urgencia',
      options: [
        { label: '🔥 Cuanto antes', value: 'Urgente', next: 'nombre' },
        { label: 'En 1-3 meses', value: '1-3 meses', next: 'nombre' },
        { label: 'Estoy explorando opciones', value: 'Explorando', next: 'nombre' }
      ]
    },
    nombre: {
      msgs: ['Ya lo tengo casi listo ✨ ¿Cómo te llamas?'],
      key: 'nombre',
      free: true,
      next: 'email'
    },
    email: {
      msgs: [s => `Encantado, ${esc(firstName(s.answers.nombre))}. Déjame un email y te envío la propuesta junto con las horas libres de la agenda.`],
      key: 'email',
      free: true,
      validate: v => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim()) || 'Ese email no parece válido, ¿me lo repites?',
      next: 'resumen'
    }
  };

  /* ---------- Utilidades ---------- */
  const $ = s => document.querySelector(s);
  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function firstName(n) { return (n || 'crack').trim().split(/\s+/)[0]; }

  const scores = {};
  function track(key, pts) { if (!key) return; scores[key] = (scores[key] || 0) + (pts || 1); }

  function topServices() {
    const order = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
    if (!order.length) order.push('chatbot');
    const main = order[0];
    const extra = order.filter(k => k !== main).slice(0, 2);
    return { main, extra };
  }

  /* ---------- DOM ---------- */
  const body = $('#chatBody');
  const opts = $('#chatOptions');
  const form = $('#chatForm');
  const input = $('#chatText');
  const progress = $('#chatProgress');
  if (!body) return;

  function scrollDown() { body.scrollTop = body.scrollHeight; }

  function addMsg(html, who) {
    const el = document.createElement('div');
    el.className = 'msg msg--' + who;
    el.innerHTML = html;
    body.appendChild(el);
    scrollDown();
    return el;
  }

  function typing() {
    const el = document.createElement('div');
    el.className = 'chat__typing';
    el.innerHTML = '<i></i><i></i><i></i>';
    body.appendChild(el);
    scrollDown();
    return el;
  }

  function botSay(list, done) {
    let i = 0;
    (function nextMsg() {
      if (i >= list.length) { done && done(); return; }
      const raw = list[i++];
      const text = typeof raw === 'function' ? raw(state) : raw;
      const t = typing();
      setTimeout(() => {
        t.remove();
        addMsg(text, 'bot');
        setTimeout(nextMsg, 220);
      }, Math.min(1100, 380 + text.replace(/<[^>]+>/g, '').length * 11));
    })();
  }

  function setProgress() {
    const pct = state.finished ? 100 : Math.min(95, Math.round((state.steps / state.total) * 100));
    progress.style.width = pct + '%';
  }

  function renderOptions(node) {
    opts.innerHTML = '';
    if (!node || !node.options) return;
    node.options.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'opt';
      b.textContent = o.label;
      b.addEventListener('click', () => answer(o.value, o));
      opts.appendChild(b);
    });
  }

  function goto(id) {
    state.node = id;
    if (id === 'resumen') return showSummary();
    const node = FLOW[id];
    if (!node) return;
    opts.innerHTML = '';
    input.disabled = true;
    botSay(node.msgs, () => {
      renderOptions(node);
      input.disabled = false;
      input.placeholder = node.free ? 'Escribe tu respuesta…' : 'Elige una opción o escríbela…';
      if (window.matchMedia('(min-width:760px)').matches) input.focus();
    });
  }

  function answer(value, opt) {
    const node = FLOW[state.node];
    if (!node || state.finished) return;

    if (node.validate) {
      const res = node.validate(value);
      if (res !== true) {
        addMsg(esc(value), 'user');
        botSay([res]);
        return;
      }
    }

    addMsg(esc(value), 'user');
    if (node.key) state.answers[node.key] = value;
    if (opt && opt.track) track(opt.track, 2);
    state.steps++;
    setProgress();
    opts.innerHTML = '';

    const next = (opt && opt.next) || node.next;
    setTimeout(() => goto(next || 'resumen'), 320);
  }

  /* ---------- Resumen final ---------- */
  function showSummary() {
    state.finished = true;
    setProgress();
    opts.innerHTML = '';
    input.disabled = true;
    input.placeholder = 'Cuestionario completado ✅';

    const { main, extra } = topServices();
    const a = state.answers;
    const svc = SERVICIOS[main] || SERVICIOS.chatbot;

    const filas = [
      ['Objetivo', a.objetivo || a.freno],
      ['Sector', a.sector],
      ['Equipo', a.equipo],
      ['Prioridad', a.urgencia]
    ].filter(r => r[1]);

    const t = typing();
    setTimeout(() => {
      t.remove();
      const el = document.createElement('div');
      el.className = 'msg msg--bot msg--summary';
      el.innerHTML =
        `<h4>Tu diagnóstico, ${esc(firstName(a.nombre))} 🚀</h4>` +
        '<ul>' + filas.map(r => `<li><b>${esc(r[0])}:</b> ${esc(r[1])}</li>`).join('') + '</ul>' +
        `<div class="rec"><strong>Recomendación principal</strong>${esc(svc.nombre)}<br><span style="color:var(--muted);font-size:.83rem">${esc(svc.desc)}</span></div>` +
        '<ul>' + svc.entregables.map(e => `<li>${esc(e)}</li>`).join('') + '</ul>' +
        (extra.length
          ? `<div style="font-size:.83rem;color:var(--muted)">También te sumaría: ${extra.map(k => '<b>' + esc(SERVICIOS[k].nombre) + '</b>').join(' y ')}.</div>`
          : '') +
        '<div style="margin-top:14px;font-size:.86rem">Puedo pasarle esto a un consultor y que te llame para concretar plazos y presupuesto.</div>';
      body.appendChild(el);
      scrollDown();

      /* --- Envío real del lead --- */
      const resumenTxt =
        'Servicio recomendado: ' + svc.nombre + '. ' +
        filas.map(r => r[0] + ': ' + r[1]).join(' · ');

      const K = window.Krovia || {};
      if (K.leadFromChat) {
        K.leadFromChat({
          nombre: a.nombre || '',
          email: a.email || '',
          servicio: svc.nombre,
          recomendacion: main,
          complementarios: extra,
          respuestas: a,
          mensaje: resumenTxt
        }).then(res => {
          if (res && res.ok) botSay(['Ya le he pasado tu ficha al equipo ✅']);
        });
      }

      /* --- CTAs finales --- */
      setTimeout(() => {
        const cta = document.createElement('button');
        cta.type = 'button';
        cta.className = 'opt opt--cta';
        cta.textContent = K.hasAgenda ? '📅 Elegir hora en la agenda' : '📅 Reservar mi consulta';
        cta.addEventListener('click', () => {
          if (K.goAgenda) {
            K.goAgenda({ name: a.nombre, email: a.email, servicio: svc.nombre, mensaje: resumenTxt });
          } else {
            document.getElementById('agenda').scrollIntoView({ behavior: 'smooth' });
          }
        });
        opts.appendChild(cta);

        if (K.hasWhatsApp && K.waLink) {
          const wa = document.createElement('a');
          wa.className = 'opt opt--wa';
          wa.target = '_blank';
          wa.rel = 'noopener';
          wa.textContent = '💬 Seguir por WhatsApp';
          wa.href = K.waLink(
            'Hola, soy ' + (a.nombre || '') + '. He hecho el test de la web y me recomienda: ' + svc.nombre + '. ' +
            filas.map(r => r[0] + ': ' + r[1]).join(' · ')
          );
          opts.appendChild(wa);
        }

        const again = document.createElement('button');
        again.type = 'button';
        again.className = 'opt';
        again.textContent = '↺ Empezar de nuevo';
        again.addEventListener('click', reset);
        opts.appendChild(again);
      }, 400);
    }, 1100);
  }

  /* ---------- Reset / API ---------- */
  function reset() {
    body.innerHTML = '';
    opts.innerHTML = '';
    Object.keys(scores).forEach(k => delete scores[k]);
    state.answers = {};
    state.steps = 0;
    state.finished = false;
    setProgress();
    goto('start');
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v || state.finished) return;
    input.value = '';
    const node = FLOW[state.node];
    // texto libre: si el nodo tiene opciones, intentamos casarlo con una
    let matched = null;
    if (node && node.options) {
      matched = node.options.find(o =>
        o.label.toLowerCase().includes(v.toLowerCase()) || v.toLowerCase().includes(o.value.toLowerCase())
      );
    }
    answer(matched ? matched.value : v, matched || null);
  });

  window.KroviaChat = {
    started: false,
    start() { if (!this.started) { this.started = true; goto('start'); } },
    reset,
    answers: () => state.answers,
    recommendation: () => topServices()
  };
})();
