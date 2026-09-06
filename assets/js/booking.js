/* ============================================================
   KroviaNextGen — Agenda propia (sustituye a Calendly)
   Tres pasos: día → hora → datos.
   Los huecos y la reserva los sirve /api/slots y /api/book.
   Si la API no responde (web abierta en local, despliegue sin
   funciones…) entra en MODO DEMOSTRACIÓN: se puede recorrer
   entera pero no reserva ni envía nada.
   ============================================================ */
window.KroviaAgenda = (function () {
  'use strict';

  var box = document.getElementById('agendaBox');
  if (!box) return { prefill: function () {} };

  var CFG = window.KROVIA_CONFIG || {};
  var API = (CFG.apiBase || '').replace(/\/+$/, '');

  /* Valores de reserva para el modo demostración. El servidor manda
     los suyos en cuanto está conectado. */
  var DEMO = { zona: 'Europe/Madrid', duracion: 15, horario: '08:00-15:00', dias: [1, 2, 3, 4, 5], paso: 30, vista: 8 };

  var estado = {
    demo: false, cargando: true, error: '',
    zona: DEMO.zona, duracion: DEMO.duracion, horario: DEMO.horario,
    dias: [], dia: null, hueco: null, enviando: false, hecho: null,
    prefill: {}
  };

  function h(tag, cls, txt) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (txt != null) el.textContent = txt;
    return el;
  }

  /* ============================================================
     DATOS
     ============================================================ */

  async function cargar() {
    estado.cargando = true; pinta();
    try {
      var r = await fetch(API + '/api/slots', { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var data = await r.json();
      if (!data || !data.ok) throw new Error('respuesta inesperada');
      estado.demo = !!data.demo;
      estado.zona = data.zona || DEMO.zona;
      estado.duracion = data.duracion || DEMO.duracion;
      estado.horario = data.horario || DEMO.horario;
      estado.dias = data.dias || [];
      if (!estado.dias.length) throw new Error('agenda vacía');
    } catch (e) {
      estado.demo = true;
      estado.dias = diasDemo();
    }
    /* Si el día elegido ya no existe (p. ej. tras recargar), volvemos al principio. */
    if (estado.dia && !estado.dias.some(function (d) { return d.fecha === estado.dia.fecha; })) {
      estado.dia = null; estado.hueco = null;
    }
    estado.cargando = false;
    rotulo();
    pinta();
  }

  /* El rótulo de la sección promete una duración: que la diga el
     servidor (AGENDA_DURACION) y no un número escrito a mano, para
     que no se quede desfasado al cambiarla. */
  function rotulo() {
    var el = document.getElementById('agendaEyebrow');
    if (el) el.textContent = 'Consulta gratuita · ' + estado.duracion + ' min';
  }

  /* --- parrilla local, solo para la demostración --- */
  function diasDemo() {
    var m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(DEMO.horario) || [];
    var desde = (+m[1] || 8) * 60 + (+m[2] || 0);
    var hasta = (+m[3] || 15) * 60 + (+m[4] || 0);
    var out = [], cur = new Date(); cur.setHours(0, 0, 0, 0);

    for (var i = 0; i < 40 && out.length < DEMO.vista; i++) {
      if (DEMO.dias.indexOf(cur.getDay()) !== -1) {
        var huecos = [];
        for (var min = desde; min + DEMO.duracion <= hasta; min += DEMO.paso) {
          var d = new Date(cur); d.setHours((min / 60) | 0, min % 60, 0, 0);
          /* “ocupadas” fijas por fecha+hora: así no parpadean al repintar */
          var semilla = (d.getDate() * 37 + min) % 11;
          huecos.push({
            inicio: d.toISOString(),
            hora: String((min / 60) | 0).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'),
            libre: semilla !== 0 && d.getTime() > Date.now()
          });
        }
        out.push({
          fecha: cur.toISOString().slice(0, 10),
          dia: String(cur.getDate()),
          mes: cur.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''),
          semana: cur.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', ''),
          larga: cur.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }),
          libres: huecos.filter(function (x) { return x.libre; }).length,
          huecos: huecos
        });
      }
      cur = new Date(cur.getTime() + 86400000);
    }
    return out;
  }

  /* ============================================================
     PINTADO
     ============================================================ */

  function paso(n, titulo) {
    var wrap = h('div', 'ag__head');
    wrap.appendChild(h('span', 'ag__step', n + ' de 3'));
    wrap.appendChild(h('h3', 'ag__title', titulo));
    return wrap;
  }

  function volver(txt, fn) {
    var b = h('button', 'ag__back', '← ' + txt);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }

  function pinta() {
    box.textContent = '';

    if (estado.cargando) {
      box.appendChild(h('p', 'ag__loading', 'Cargando la agenda…'));
      return;
    }

    if (estado.hecho) return pintaHecho();

    if (estado.demo) {
      var av = h('div', 'ag__demo');
      av.innerHTML = '<b>Modo demostración.</b> Puedes recorrerla entera: no se reserva nada ' +
        'ni se envía ningún dato a ninguna parte.';
      box.appendChild(av);
    }

    if (!estado.dia) return pintaDias();
    if (!estado.hueco) return pintaHoras();
    pintaDatos();
  }

  /* --- 1 de 3 · día --- */
  function pintaDias() {
    box.appendChild(paso(1, 'Elige el día'));

    var lista = h('div', 'ag__days');
    estado.dias.forEach(function (d) {
      var b = h('button', 'ag__day');
      b.type = 'button';
      b.disabled = d.libres === 0;
      b.appendChild(h('span', 'ag__day-wd', d.semana));
      b.appendChild(h('span', 'ag__day-n', d.dia));
      b.appendChild(h('span', 'ag__day-m', d.mes));
      b.setAttribute('aria-label', d.larga + (d.libres ? ' · ' + d.libres + ' huecos' : ' · completo'));
      b.addEventListener('click', function () { estado.dia = d; estado.hueco = null; pinta(); });
      lista.appendChild(b);
    });
    box.appendChild(lista);

    var hs = estado.horario.replace('-', '–');
    box.appendChild(h('p', 'ag__hint', 'Horario de consulta: lunes a viernes, ' + hs + '.'));
  }

  /* --- 2 de 3 · hora --- */
  function pintaHoras() {
    box.appendChild(paso(2, 'Elige la hora'));
    box.appendChild(h('p', 'ag__sub', estado.dia.larga + ' · ' + estado.duracion + ' min'));

    var lista = h('div', 'ag__slots');
    estado.dia.huecos.forEach(function (s) {
      var b = h('button', 'ag__slot' + (s.libre ? '' : ' is-taken'), s.hora);
      b.type = 'button';
      b.disabled = !s.libre;
      if (!s.libre) b.title = 'Ocupada';
      b.addEventListener('click', function () { estado.hueco = s; pinta(); });
      lista.appendChild(b);
    });
    box.appendChild(lista);

    box.appendChild(h('p', 'ag__hint', 'Las horas en gris ya están cogidas. Zona horaria: ' + estado.zona + '.'));
    box.appendChild(volver('Cambiar de día', function () { estado.dia = null; pinta(); }));
  }

  /* --- 3 de 3 · datos --- */
  function pintaDatos() {
    box.appendChild(paso(3, 'Tus datos'));
    box.appendChild(h('p', 'ag__sub', estado.dia.larga + ' · ' + estado.hueco.hora + ' · ' + estado.duracion + ' min'));

    var p = estado.prefill;
    var form = h('form', 'ag__form');
    form.noValidate = true;
    form.innerHTML =
      '<div class="field-row">' +
        '<div class="field"><input name="nombre" type="text" placeholder="Tu nombre" required></div>' +
        '<div class="field"><input name="email" type="email" placeholder="Tu email" required></div>' +
      '</div>' +
      '<div class="field-row">' +
        '<div class="field"><input name="telefono" type="tel" placeholder="Teléfono con prefijo (+34…)"></div>' +
        '<div class="field"><select name="servicio">' +
          '<option value="">¿Qué necesitas?</option>' +
          '<option>Web o landing</option><option>Chatbot / agente</option>' +
          '<option>Automatización</option><option>Agente de compras</option>' +
          '<option>Dashboards</option><option>Aún no lo sé</option>' +
        '</select></div>' +
      '</div>' +
      '<div class="field"><textarea name="mensaje" rows="2" placeholder="Cuéntame en una línea (opcional)"></textarea></div>' +
      /* trampa antibots: oculta a la vista y al lector de pantalla */
      '<div class="ag__hp" aria-hidden="true"><input name="web" tabindex="-1" autocomplete="off"></div>' +
      '<button type="submit" class="btn btn--primary btn--full btn--lg">Confirmar reserva</button>' +
      '<p class="ag__legal">Te llega la confirmación por correo' +
        (CFG.whatsappNumber ? ' y por WhatsApp' : '') + '. Sin spam.</p>';

    if (p.nombre) form.nombre.value = p.nombre;
    if (p.email) form.email.value = p.email;
    if (p.telefono) form.telefono.value = p.telefono;
    if (p.mensaje) form.mensaje.value = p.mensaje;
    if (p.servicio) {
      Array.from(form.servicio.options).forEach(function (o) {
        if (o.text.toLowerCase().indexOf(String(p.servicio).toLowerCase()) !== -1) form.servicio.value = o.value || o.text;
      });
    }

    var aviso = h('div', 'ag__msg');
    aviso.hidden = true;
    form.appendChild(aviso);

    form.addEventListener('submit', function (e) { e.preventDefault(); enviar(form, aviso); });
    box.appendChild(form);
    box.appendChild(volver('Cambiar la hora', function () { estado.hueco = null; pinta(); }));
  }

  /* --- confirmación --- */
  function pintaHecho() {
    var d = estado.hecho;
    var caja = h('div', 'ag__done');
    caja.appendChild(h('div', 'ag__check', '✓'));
    caja.appendChild(h('h3', 'ag__title', d.demo ? 'Así quedaría' : 'Reserva confirmada'));
    caja.appendChild(h('p', 'ag__sub', d.cuando + ' · ' + estado.duracion + ' min'));

    var txt = d.demo
      ? 'Esto es la demostración: no se ha reservado nada ni se ha enviado ningún correo.'
      : 'Te hemos enviado la confirmación por correo' + (d.avisos && d.avisos.wa_cliente ? ' y por WhatsApp' : '') +
        '. Dentro va la invitación para tu calendario.';
    caja.appendChild(h('p', 'ag__hint', txt));

    var b = h('button', 'btn btn--outline', 'Reservar otra hora');
    b.type = 'button';
    b.addEventListener('click', function () {
      estado.hecho = null; estado.dia = null; estado.hueco = null; cargar();
    });
    caja.appendChild(b);
    box.appendChild(caja);
  }

  /* ============================================================
     ENVÍO
     ============================================================ */

  async function enviar(form, aviso) {
    if (estado.enviando) return;

    var datos = {
      inicio: estado.hueco.inicio,
      nombre: form.nombre.value.trim(),
      email: form.email.value.trim(),
      telefono: form.telefono.value.trim(),
      servicio: form.servicio.value,
      mensaje: form.mensaje.value.trim(),
      web: form.web.value,
      origen: 'agenda-web',
      url: location.href
    };

    var mal = [];
    if (datos.nombre.length < 2) { mal.push(form.nombre); }
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(datos.email)) { mal.push(form.email); }
    Array.from(form.querySelectorAll('.field')).forEach(function (f) { f.classList.remove('is-error'); });
    if (mal.length) {
      mal.forEach(function (el) { el.closest('.field').classList.add('is-error'); });
      return decir(aviso, 'Revisa el nombre y el email.', true);
    }

    var btn = form.querySelector('button[type=submit]');
    estado.enviando = true; btn.disabled = true; btn.textContent = 'Reservando…';

    /* En demostración no llamamos a nadie: enseñamos el resultado. */
    if (estado.demo) {
      await new Promise(function (r) { setTimeout(r, 500); });
      estado.enviando = false;
      estado.hecho = { demo: true, cuando: estado.dia.larga + ' · ' + estado.hueco.hora };
      return pinta();
    }

    try {
      var r = await fetch(API + '/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos)
      });
      var res = await r.json().catch(function () { return null; });

      if (r.ok && res && res.ok) {
        estado.hecho = { cuando: res.cuando, avisos: res.avisos || {} };
        estado.enviando = false;
        return pinta();
      }

      /* Alguien cogió el hueco mientras rellenaba el formulario. */
      if (res && res.ocupado) {
        estado.enviando = false;
        estado.hueco = null;
        await cargar();
        var av = box.querySelector('.ag__hint');
        if (av) av.textContent = 'Justo han cogido esa hora. Elige otra, por favor.';
        return;
      }
      decir(aviso, (res && res.error) || 'No hemos podido reservar. Inténtalo de nuevo.', true);
    } catch (e) {
      decir(aviso, 'No hay conexión con el servidor. Inténtalo en un momento.', true);
    }
    estado.enviando = false;
    btn.disabled = false; btn.textContent = 'Confirmar reserva';
  }

  function decir(el, txt, error) {
    el.hidden = false;
    el.textContent = txt;
    el.classList.toggle('is-error', !!error);
  }

  /* ============================================================
     API pública — la usa el chatbot al terminar el cuestionario
     ============================================================ */
  function prefill(datos) {
    estado.prefill = Object.assign({}, estado.prefill, datos || {});
    if (estado.dia && estado.hueco) pinta();
  }

  cargar();

  return { prefill: prefill, recargar: cargar };
})();
