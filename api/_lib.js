/* ============================================================
   KroviaNextGen — utilidades compartidas de la API
   Corre en las funciones serverless de Vercel (Node 18+),
   NUNCA en el navegador: aquí viven la service_role de Supabase
   y los tokens de correo y WhatsApp.
   Sin dependencias: todo con fetch.
   ============================================================ */

const crypto = require('crypto');

const CFG = {
  /* --- Supabase --- */
  sbUrl: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
  sbKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  /* --- Correo (Resend) --- */
  resendKey: process.env.RESEND_API_KEY || '',
  mailFrom:  process.env.MAIL_FROM  || '',
  mailAdmin: process.env.MAIL_ADMIN || '',

  /* --- WhatsApp (Meta Cloud API) --- */
  waToken:      process.env.WHATSAPP_TOKEN || '',
  waPhoneId:    process.env.WHATSAPP_PHONE_ID || '',
  waAdmin:     (process.env.WHATSAPP_ADMIN || '').replace(/\D/g, ''),
  waTplCliente: process.env.WHATSAPP_TEMPLATE_CLIENTE || '',
  waTplAdmin:   process.env.WHATSAPP_TEMPLATE_ADMIN || '',
  waTplRecordatorio: process.env.WHATSAPP_TEMPLATE_RECORDATORIO || '',
  waLang:       process.env.WHATSAPP_TEMPLATE_LANG || 'es',

  /* --- Agenda --- */
  tz:         process.env.AGENDA_TZ || 'Europe/Madrid',
  horario:    process.env.AGENDA_HORARIO || '08:00-15:00',
  dias:      (process.env.AGENDA_DIAS || '1,2,3,4,5').split(',').map(function (n) { return +n; }),
  duracion:  +(process.env.AGENDA_DURACION || 15),
  paso:      +(process.env.AGENDA_PASO || 30),
  antelacion:+(process.env.AGENDA_ANTELACION_H || 2),
  vista:     +(process.env.AGENDA_DIAS_VISTA || 10),

  /* --- Recordatorio automático --- */
  cronSecret: process.env.CRON_SECRET || '',
  recordatorioDias: +(process.env.RECORDATORIO_DIAS || 1),

  marca: process.env.MARCA || 'KroviaNextGen',
  sitio: (process.env.SITIO_URL || '').replace(/\/+$/, '')
};

/* La agenda funciona en cuanto haya base de datos. El correo y el
   WhatsApp son capas opcionales que se encienden solas al añadir
   sus variables de entorno. */
const HAY_DB   = !!(CFG.sbUrl && CFG.sbKey);
const HAY_MAIL = !!(CFG.resendKey && CFG.mailFrom);
const HAY_WA   = !!(CFG.waToken && CFG.waPhoneId);

/* ============================================================
   HTTP
   ============================================================ */

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, code, obj) {
  cors(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(code).send(JSON.stringify(obj));
}

/* Vercel ya parsea el JSON, pero no siempre (según content-type). */
function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return {};
}

/* ============================================================
   ZONA HORARIA
   Los horarios son de oficina (Europe/Madrid), pero el visitante
   puede estar en cualquier sitio. Todo el cálculo se hace en la
   zona del negocio y al navegador le llegan etiquetas ya escritas.
   ============================================================ */

/* Desfase de una zona respecto a UTC en un instante concreto. */
function tzOffset(utcMs, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const p = {};
  for (const x of dtf.formatToParts(new Date(utcMs))) p[x.type] = x.value;
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - utcMs;
}

/* "8 de septiembre a las 09:30 en Madrid" -> instante real (Date). */
function zonedToUtc(y, m, d, hh, mm, tz) {
  const naive = Date.UTC(y, m - 1, d, hh, mm, 0);
  let ts = naive - tzOffset(naive, tz);
  ts = naive - tzOffset(ts, tz); // segunda pasada: noches de cambio de hora
  return new Date(ts);
}

/* Fecha del calendario (año/mes/día) de un instante en una zona. */
function ymdIn(date, tz) {
  const p = {};
  for (const x of new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date)) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day };
}

function fmt(date, tz, opts) {
  return new Intl.DateTimeFormat('es-ES', Object.assign({ timeZone: tz }, opts)).format(date);
}

/* "martes, 8 de septiembre de 2026 · 09:30" */
function fechaLarga(date, tz) {
  return fmt(date, tz, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
    ' · ' + fmt(date, tz, { hour: '2-digit', minute: '2-digit' });
}

/* ============================================================
   HUECOS DE LA AGENDA
   ============================================================ */

function parseHorario(txt) {
  const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(String(txt).trim());
  if (!m) return { desde: 8 * 60, hasta: 15 * 60 };
  return { desde: +m[1] * 60 + +m[2], hasta: +m[3] * 60 + +m[4] };
}

/* Días laborables a partir de hoy, en la zona del negocio. */
function proximosDias(n) {
  const { desde, hasta } = parseHorario(CFG.horario);
  const hoy = ymdIn(new Date(), CFG.tz);
  const dias = [];
  let cursor = Date.UTC(hoy.y, hoy.m - 1, hoy.d);

  // como mucho miramos 60 días naturales para reunir n laborables
  for (let i = 0; i < 60 && dias.length < n; i++) {
    const dt = new Date(cursor);
    const dow = dt.getUTCDay();
    if (CFG.dias.indexOf(dow) !== -1) {
      const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
      const huecos = [];
      for (let min = desde; min + CFG.duracion <= hasta; min += CFG.paso) {
        huecos.push(zonedToUtc(y, m, d, (min / 60) | 0, min % 60, CFG.tz));
      }
      dias.push({ y, m, d, fecha: y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'), huecos });
    }
    cursor += 86400000;
  }
  return dias;
}

/* Un hueco solo es válido si sale de la parrilla anterior: nunca nos
   fiamos de la hora que manda el navegador. */
function esHuecoValido(iso) {
  const t = Date.parse(iso);
  if (!isFinite(t)) return null;
  const dias = proximosDias(CFG.vista);
  for (const dia of dias) {
    for (const h of dia.huecos) if (h.getTime() === t) return new Date(t);
  }
  return null;
}

function conAntelacion(fecha) {
  return fecha.getTime() - Date.now() >= CFG.antelacion * 3600000;
}

/* ============================================================
   SUPABASE (REST)
   ============================================================ */

async function sb(path, init) {
  if (!HAY_DB) return { ok: false, status: 0, error: 'sin-base-de-datos' };
  const r = await fetch(CFG.sbUrl + '/rest/v1/' + path, Object.assign({}, init, {
    headers: Object.assign({
      apikey: CFG.sbKey,
      Authorization: 'Bearer ' + CFG.sbKey,
      'Content-Type': 'application/json'
    }, (init && init.headers) || {})
  }));
  const txt = await r.text();
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
  return { ok: r.ok, status: r.status, data: data, error: r.ok ? null : (data && data.message) || txt };
}

/* Horas ya cogidas dentro de un rango. */
async function reservasOcupadas(desdeISO, hastaISO) {
  const q = 'reservas?select=inicio&estado=eq.confirmada' +
    '&inicio=gte.' + encodeURIComponent(desdeISO) +
    '&inicio=lt.' + encodeURIComponent(hastaISO) +
    '&limit=2000';
  const r = await sb(q, { method: 'GET' });
  if (!r.ok || !Array.isArray(r.data)) return [];
  return r.data.map(function (x) { return Date.parse(x.inicio); });
}

/* ============================================================
   CORREO (Resend)
   ============================================================ */

async function enviarMail(to, subject, html, extra) {
  if (!HAY_MAIL || !to) return { ok: false, motivo: 'sin-configurar' };
  const payload = Object.assign({
    from: CFG.mailFrom,
    to: Array.isArray(to) ? to : [to],
    subject: subject,
    html: html
  }, extra || {});
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + CFG.resendKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await r.json().catch(function () { return null; });
    if (!r.ok) console.error('[krovia] resend', r.status, data);
    return { ok: r.ok, data: data };
  } catch (e) {
    console.error('[krovia] resend', e);
    return { ok: false, motivo: String(e) };
  }
}

/* ============================================================
   WHATSAPP (Meta Cloud API)
   Fuera de la ventana de 24 h Meta solo deja enviar plantillas
   aprobadas. Si no hay plantilla configurada probamos texto libre
   (funciona si la conversación está abierta) y, si falla, se queda
   registrado: el correo ya ha salido igualmente.
   ============================================================ */

async function enviarWA(to, texto, plantilla, params) {
  const num = String(to || '').replace(/\D/g, '');
  if (!HAY_WA || !num) return { ok: false, motivo: 'sin-configurar' };

  const payload = plantilla
    ? {
        messaging_product: 'whatsapp', to: num, type: 'template',
        template: {
          name: plantilla,
          language: { code: CFG.waLang },
          components: [{ type: 'body', parameters: (params || []).map(function (t) { return { type: 'text', text: String(t) }; }) }]
        }
      }
    : { messaging_product: 'whatsapp', to: num, type: 'text', text: { body: texto, preview_url: false } };

  try {
    const r = await fetch('https://graph.facebook.com/v21.0/' + CFG.waPhoneId + '/messages', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + CFG.waToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await r.json().catch(function () { return null; });
    if (!r.ok) console.error('[krovia] whatsapp', r.status, JSON.stringify(data));
    return { ok: r.ok, data: data };
  } catch (e) {
    console.error('[krovia] whatsapp', e);
    return { ok: false, motivo: String(e) };
  }
}

/* ============================================================
   INVITACIÓN DE CALENDARIO (.ics)
   Es lo que hace que la hora te aparezca bloqueada en tu Google
   Calendar: llega adjunta al correo y se añade con un clic.
   ============================================================ */

function icsFecha(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function crearIcs(o) {
  const esc = function (s) { return String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'); };
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KroviaNextGen//Agenda//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    'UID:' + o.uid,
    'DTSTAMP:' + icsFecha(new Date()),
    'DTSTART:' + icsFecha(o.inicio),
    'DTEND:' + icsFecha(o.fin),
    'SUMMARY:' + esc(o.titulo),
    'DESCRIPTION:' + esc(o.descripcion),
    'LOCATION:' + esc(o.lugar || 'Videollamada'),
    'ORGANIZER;CN=' + esc(CFG.marca) + ':mailto:' + (CFG.mailAdmin || 'no-reply@example.com'),
    'ATTENDEE;CN=' + esc(o.nombre) + ';RSVP=TRUE:mailto:' + o.email,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:' + esc(o.titulo),
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

/* ============================================================
   PLANTILLAS DE CORREO
   ============================================================ */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function envoltura(titulo, cuerpo) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#08152B;padding:28px 12px;
    font-family:'IBM Plex Sans',-apple-system,Segoe UI,Roboto,sans-serif;color:#DCE9FF">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#0D2247;border:1px solid rgba(140,190,255,.28)">
        <tr><td style="padding:22px 26px;border-bottom:1px solid rgba(140,190,255,.22)">
          <span style="font-size:15px;font-weight:600;letter-spacing:.06em;text-transform:uppercase">${esc(CFG.marca)}</span>
        </td></tr>
        <tr><td style="padding:26px">
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#fff">${esc(titulo)}</h1>
          ${cuerpo}
        </td></tr>
        <tr><td style="padding:16px 26px;border-top:1px solid rgba(140,190,255,.22);font-size:12px;color:#6382AE">
          ${CFG.sitio ? `<a href="${esc(CFG.sitio)}" style="color:#7FC8FF;text-decoration:none">${esc(CFG.sitio)}</a>` : esc(CFG.marca)}
        </td></tr>
      </table>
    </td></tr></table></body></html>`;
}

function tabla(filas) {
  return '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px">' +
    filas.filter(function (f) { return f[1]; }).map(function (f) {
      return `<tr>
        <td style="padding:7px 0;color:#8FB0DC;width:38%;vertical-align:top">${esc(f[0])}</td>
        <td style="padding:7px 0;color:#DCE9FF">${esc(f[1])}</td>
      </tr>`;
    }).join('') + '</table>';
}

/* ============================================================
   RESERVAS: token, enlace de cancelación y rango de un día
   ============================================================ */

/* Llave del enlace "cancelar mi cita". 32 caracteres al azar: no se
   adivina, y así el cliente no tiene que registrarse en nada. */
function nuevoToken() {
  return crypto.randomBytes(16).toString('hex');
}

function enlaceCancelar(token) {
  if (!token || !CFG.sitio) return '';
  return CFG.sitio + '/cancelar.html?t=' + token;
}

/* Principio y fin del día natural que cae dentro de n días, en la zona
   del negocio. Con esto el recordatorio diario cubre siempre "todas
   las citas de mañana", sin restar horas a ojo ni fallar en las
   noches de cambio de hora. */
function rangoDiaEn(n) {
  const hoy = ymdIn(new Date(), CFG.tz);
  const base = new Date(Date.UTC(hoy.y, hoy.m - 1, hoy.d) + n * 86400000);
  const sig = new Date(base.getTime() + 86400000);
  return {
    desde: zonedToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), 0, 0, CFG.tz),
    hasta: zonedToUtc(sig.getUTCFullYear(), sig.getUTCMonth() + 1, sig.getUTCDate(), 0, 0, CFG.tz)
  };
}

module.exports = {
  CFG, HAY_DB, HAY_MAIL, HAY_WA,
  cors, json, body,
  zonedToUtc, ymdIn, fmt, fechaLarga, parseHorario,
  proximosDias, esHuecoValido, conAntelacion,
  sb, reservasOcupadas,
  nuevoToken, enlaceCancelar, rangoDiaEn,
  enviarMail, enviarWA,
  crearIcs, envoltura, tabla, esc
};
