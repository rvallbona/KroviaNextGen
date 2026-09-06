/* ============================================================
   POST /api/book
   Reserva un hueco de la agenda:
     1. valida la hora contra la parrilla real (no contra la que
        diga el navegador)
     2. la guarda en Supabase — el índice único es lo que impide
        de verdad que dos personas cojan la misma hora
     3. avisa por correo (con invitación .ics) y por WhatsApp,
        al cliente y a ti
   ============================================================ */
const L = require('./_lib');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { L.cors(res); return res.status(204).end(); }
  if (req.method !== 'POST') return L.json(res, 405, { ok: false, error: 'método no permitido' });

  const d = L.body(req);

  /* Trampa para bots: el campo va oculto, una persona nunca lo rellena. */
  if (d.web) return L.json(res, 200, { ok: true, id: null });

  const nombre = String(d.nombre || '').trim();
  const email = String(d.email || '').trim();
  const telefono = String(d.telefono || '').replace(/[^\d+]/g, '');
  const servicio = String(d.servicio || '').trim().slice(0, 120);
  const mensaje = String(d.mensaje || '').trim().slice(0, 1000);

  if (nombre.length < 2) return L.json(res, 400, { ok: false, error: 'Falta tu nombre.' });
  if (!EMAIL_RE.test(email)) return L.json(res, 400, { ok: false, error: 'El email no parece válido.' });

  const inicio = L.esHuecoValido(d.inicio);
  if (!inicio) return L.json(res, 400, { ok: false, error: 'Esa hora ya no está en la agenda. Elige otra.' });
  if (!L.conAntelacion(inicio)) {
    return L.json(res, 400, { ok: false, error: 'Esa hora es demasiado inmediata. Elige una más adelante.' });
  }
  const fin = new Date(inicio.getTime() + L.CFG.duracion * 60000);

  /* Sin base de datos no reservamos nada: preferimos decirlo a
     confirmar una cita que no existe en ningún sitio. */
  if (!L.HAY_DB) {
    return L.json(res, 503, {
      ok: false, demo: true,
      error: 'La agenda está en modo demostración: falta conectar la base de datos.'
    });
  }

  /* ---------- 1. guardar ---------- */
  const token = L.nuevoToken();
  const fila = {
    token: token,
    inicio: inicio.toISOString(),
    fin: fin.toISOString(),
    duracion_min: L.CFG.duracion,
    zona: L.CFG.tz,
    nombre: nombre,
    email: email,
    telefono: telefono || null,
    servicio: servicio || null,
    mensaje: mensaje || null,
    estado: 'confirmada',
    origen: String(d.origen || 'agenda-web').slice(0, 60),
    url: String(d.url || '').slice(0, 500) || null
  };

  const ins = await L.sb('reservas', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(fila)
  });

  if (!ins.ok) {
    /* 23505 = índice único: alguien cogió el hueco mientras rellenaba. */
    const code = ins.data && ins.data.code;
    if (ins.status === 409 || code === '23505') {
      return L.json(res, 409, { ok: false, ocupado: true, error: 'Justo han cogido esa hora. Elige otra, por favor.' });
    }
    console.error('[krovia] insert reserva', ins.status, ins.error);
    return L.json(res, 500, { ok: false, error: 'No hemos podido guardar la reserva.' });
  }

  const reserva = Array.isArray(ins.data) ? ins.data[0] : ins.data;
  const id = (reserva && reserva.id) || null;

  /* ---------- 2. avisar ---------- */
  const cancelar = L.enlaceCancelar(token);
  const cuando = L.fechaLarga(inicio, L.CFG.tz);
  const titulo = 'Consulta ' + L.CFG.marca + ' · ' + nombre;
  const ics = L.crearIcs({
    uid: (id || Date.now()) + '@krovianextgen',
    inicio: inicio, fin: fin,
    titulo: titulo,
    descripcion: [servicio && ('Servicio: ' + servicio), mensaje && ('Nota: ' + mensaje),
      'Contacto: ' + email + (telefono ? ' · ' + telefono : ''),
      cancelar && ('Cancelar o cambiar: ' + cancelar)].filter(Boolean).join('\n'),
    nombre: nombre, email: email
  });
  const adjunto = [{
    filename: 'consulta-krovianextgen.ics',
    content: Buffer.from(ics, 'utf8').toString('base64')
  }];

  const notificado = {};

  /* --- correo al cliente --- */
  const htmlCliente = L.envoltura('Consulta confirmada', `
    <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#8FB0DC">
      Hola ${L.esc(nombre)}, tu consulta queda reservada. Te llamamos a la hora acordada.
    </p>
    ${L.tabla([
      ['Cuándo', cuando],
      ['Duración', L.CFG.duracion + ' minutos'],
      ['Zona horaria', L.CFG.tz],
      ['Servicio', servicio],
      ['Tu nota', mensaje]
    ])}
    <p style="margin:22px 0 0;font-size:13px;color:#6382AE">
      Te adjuntamos la invitación para tu calendario.
    </p>
    ${cancelar ? `<p style="margin:10px 0 0;font-size:13px;color:#6382AE">
      ¿No te viene bien? <a href="${cancelar}" style="color:#7FC8FF">Cancelar o cambiar la hora</a>.
    </p>` : `<p style="margin:10px 0 0;font-size:13px;color:#6382AE">
      ¿No te viene bien? Responde a este correo y lo movemos.
    </p>`}`);

  const rc = await L.enviarMail(email, 'Consulta confirmada · ' + cuando, htmlCliente, {
    attachments: adjunto,
    reply_to: L.CFG.mailAdmin || undefined
  });
  notificado.mail_cliente = rc.ok;

  /* --- correo para ti --- */
  if (L.CFG.mailAdmin) {
    const htmlAdmin = L.envoltura('Nueva reserva', `
      ${L.tabla([
        ['Cuándo', cuando],
        ['Nombre', nombre],
        ['Email', email],
        ['Teléfono', telefono],
        ['Servicio', servicio],
        ['Mensaje', mensaje],
        ['Origen', fila.origen]
      ])}
      <p style="margin:22px 0 0;font-size:13px;color:#6382AE">
        El hueco ya está bloqueado en la agenda de la web. Añade el .ics adjunto a tu calendario.
      </p>`);
    const ra = await L.enviarMail(L.CFG.mailAdmin, 'Reserva · ' + nombre + ' · ' + cuando, htmlAdmin, {
      attachments: adjunto,
      reply_to: email
    });
    notificado.mail_admin = ra.ok;
  }

  /* --- WhatsApp --- */
  const textoCliente = 'Hola ' + nombre + ', tu consulta con ' + L.CFG.marca +
    ' queda confirmada para el ' + cuando + ' (' + L.CFG.duracion + ' min). ¡Nos vemos!';
  const textoAdmin = 'Nueva reserva: ' + nombre + ' · ' + cuando +
    ' · ' + email + (telefono ? ' · ' + telefono : '') + (servicio ? ' · ' + servicio : '');

  if (telefono) {
    const wc = await L.enviarWA(telefono, textoCliente, L.CFG.waTplCliente,
      [nombre, L.CFG.marca, cuando, String(L.CFG.duracion)]);
    notificado.wa_cliente = wc.ok;
  }
  if (L.CFG.waAdmin) {
    const wa = await L.enviarWA(L.CFG.waAdmin, textoAdmin, L.CFG.waTplAdmin,
      [nombre, cuando, email + (telefono ? ' · ' + telefono : '')]);
    notificado.wa_admin = wa.ok;
  }

  /* Deja constancia de qué avisos salieron: si algún día falta uno,
     se ve en la tabla sin tener que rebuscar en los logs. */
  if (id) {
    await L.sb('reservas?id=eq.' + id, {
      method: 'PATCH',
      body: JSON.stringify({ notificado: notificado })
    });
  }

  return L.json(res, 200, {
    ok: true,
    id: id,
    cuando: cuando,
    duracion: L.CFG.duracion,
    zona: L.CFG.tz,
    avisos: notificado
  });
};
