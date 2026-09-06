/* ============================================================
   GET /api/cron  —  recordatorio automático
   Lo llama Vercel una vez al día (ver vercel.json). Avisa de
   todas las citas del día siguiente que aún no tengan aviso.

   Se apoya en la columna recordado_en en vez de en una ventana
   de horas: así da igual a qué hora corra el cron, y si algún día
   se ejecuta dos veces nadie recibe el aviso repetido.
   ============================================================ */
const L = require('./_lib');

const CAMPOS = 'id,token,inicio,duracion_min,zona,nombre,email,telefono,servicio';

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { L.cors(res); return res.status(204).end(); }

  /* Vercel manda "Authorization: Bearer $CRON_SECRET" en sus crons.
     Sin el secreto configurado el endpoint queda abierto: como mucho
     adelanta un recordatorio, pero conviene ponerlo. */
  if (L.CFG.cronSecret) {
    const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
    if (auth !== 'Bearer ' + L.CFG.cronSecret) {
      return L.json(res, 401, { ok: false, error: 'no autorizado' });
    }
  }
  if (!L.HAY_DB) return L.json(res, 503, { ok: false, error: 'sin base de datos' });

  const { desde, hasta } = L.rangoDiaEn(L.CFG.recordatorioDias);

  const q = 'reservas?select=' + CAMPOS +
    '&estado=eq.confirmada&recordado_en=is.null' +
    '&inicio=gte.' + encodeURIComponent(desde.toISOString()) +
    '&inicio=lt.' + encodeURIComponent(hasta.toISOString()) +
    '&order=inicio.asc&limit=200';

  const r = await L.sb(q, { method: 'GET' });
  if (!r.ok) {
    console.error('[krovia] cron consulta', r.status, r.error);
    return L.json(res, 500, { ok: false, error: 'no se ha podido leer la agenda' });
  }

  const citas = Array.isArray(r.data) ? r.data : [];
  let enviados = 0, fallidos = 0;

  for (const rv of citas) {
    const zona = rv.zona || L.CFG.tz;
    const cuando = L.fechaLarga(new Date(rv.inicio), zona);
    const cancelar = L.enlaceCancelar(rv.token);

    const mail = await L.enviarMail(rv.email, 'Mañana: tu consulta · ' + cuando,
      L.envoltura('Te esperamos mañana', `
        <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#8FB0DC">
          Hola ${L.esc(rv.nombre)}, un recordatorio de tu consulta con ${L.esc(L.CFG.marca)}.
        </p>
        ${L.tabla([
          ['Cuándo', cuando],
          ['Duración', (rv.duracion_min || L.CFG.duracion) + ' minutos'],
          ['Zona horaria', zona],
          ['Servicio', rv.servicio]
        ])}
        ${cancelar ? `<p style="margin:22px 0 0;font-size:13px;color:#6382AE">
          ¿Te ha surgido algo? <a href="${cancelar}" style="color:#7FC8FF">Cancelar o cambiar la hora</a>.
        </p>` : ''}`),
      { reply_to: L.CFG.mailAdmin || undefined });

    if (rv.telefono) {
      await L.enviarWA(rv.telefono,
        'Hola ' + rv.nombre + ', te recordamos tu consulta con ' + L.CFG.marca + ': ' + cuando + '.',
        L.CFG.waTplRecordatorio || L.CFG.waTplCliente,
        [rv.nombre, L.CFG.marca, cuando, String(rv.duracion_min || L.CFG.duracion)]);
    }

    /* Marcamos aunque el correo falle: si no, el siguiente cron lo
       reintentaría a diario para siempre. El fallo queda en los logs. */
    const upd = await L.sb('reservas?id=eq.' + rv.id, {
      method: 'PATCH',
      body: JSON.stringify({ recordado_en: new Date().toISOString() })
    });
    if (mail.ok && upd.ok) enviados++; else fallidos++;
  }

  /* Resumen para ti, solo si había algo. */
  if (citas.length && L.CFG.mailAdmin) {
    await L.enviarMail(L.CFG.mailAdmin,
      'Agenda de mañana · ' + citas.length + (citas.length === 1 ? ' cita' : ' citas'),
      L.envoltura('Tu día de mañana', L.tabla(
        citas.map(function (rv) {
          return [L.fmt(new Date(rv.inicio), rv.zona || L.CFG.tz, { hour: '2-digit', minute: '2-digit' }),
                  rv.nombre + (rv.servicio ? ' · ' + rv.servicio : '') + ' · ' + rv.email];
        })
      )));
  }

  return L.json(res, 200, {
    ok: true,
    dia: L.fmt(desde, L.CFG.tz, { weekday: 'long', day: 'numeric', month: 'long' }),
    encontradas: citas.length, enviados: enviados, fallidos: fallidos
  });
};
