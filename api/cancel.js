/* ============================================================
   /api/cancel
     GET  ?t=TOKEN   → datos de la cita (para pintar la página)
     POST {t:TOKEN}  → la cancela y libera el hueco

   El token va en el enlace del correo de confirmación. Son 32
   caracteres al azar: basta para identificar la cita sin obligar
   al cliente a registrarse, y no se puede adivinar.
   ============================================================ */
const L = require('./_lib');

const CAMPOS = 'id,token,inicio,fin,duracion_min,zona,nombre,email,telefono,servicio,estado';

async function buscar(token) {
  const r = await L.sb('reservas?select=' + CAMPOS + '&token=eq.' + encodeURIComponent(token) + '&limit=1', { method: 'GET' });
  if (!r.ok || !Array.isArray(r.data) || !r.data.length) return null;
  return r.data[0];
}

/* Solo lo que la página necesita enseñar: ni id ni email completos. */
function publico(rv) {
  const inicio = new Date(rv.inicio);
  return {
    cuando: L.fechaLarga(inicio, rv.zona || L.CFG.tz),
    duracion: rv.duracion_min,
    zona: rv.zona || L.CFG.tz,
    nombre: rv.nombre,
    servicio: rv.servicio || '',
    estado: rv.estado,
    pasada: inicio.getTime() < Date.now()
  };
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { L.cors(res); return res.status(204).end(); }

  const token = String(
    (req.query && req.query.t) || L.body(req).t || ''
  ).trim();

  if (!/^[a-f0-9]{32}$/.test(token)) {
    return L.json(res, 400, { ok: false, error: 'El enlace no es válido.' });
  }
  if (!L.HAY_DB) {
    return L.json(res, 503, { ok: false, error: 'La agenda no está conectada.' });
  }

  const rv = await buscar(token);
  if (!rv) return L.json(res, 404, { ok: false, error: 'No encontramos esa cita. Puede que ya se cancelara.' });

  /* ---------- consultar ---------- */
  if (req.method === 'GET') {
    return L.json(res, 200, { ok: true, reserva: publico(rv) });
  }
  if (req.method !== 'POST') return L.json(res, 405, { ok: false, error: 'método no permitido' });

  /* ---------- cancelar ---------- */
  if (rv.estado === 'cancelada') {
    return L.json(res, 200, { ok: true, yaEstaba: true, reserva: publico(rv) });
  }
  if (new Date(rv.inicio).getTime() < Date.now()) {
    return L.json(res, 409, { ok: false, error: 'Esa cita ya ha pasado.', reserva: publico(rv) });
  }

  const upd = await L.sb('reservas?id=eq.' + rv.id, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ estado: 'cancelada', cancelado_en: new Date().toISOString() })
  });
  if (!upd.ok) {
    console.error('[krovia] cancelar', upd.status, upd.error);
    return L.json(res, 500, { ok: false, error: 'No hemos podido cancelarla. Escríbenos y lo hacemos nosotros.' });
  }
  /* El índice único solo mira las confirmadas, así que el hueco
     vuelve a aparecer libre en la web al instante. */

  const cuando = L.fechaLarga(new Date(rv.inicio), rv.zona || L.CFG.tz);

  /* --- avisar a las dos partes --- */
  await L.enviarMail(rv.email, 'Cita cancelada · ' + cuando,
    L.envoltura('Cita cancelada', `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#8FB0DC">
        Hola ${L.esc(rv.nombre)}, hemos cancelado tu consulta del <b style="color:#DCE9FF">${L.esc(cuando)}</b>.
        El hueco vuelve a estar libre para quien lo necesite.
      </p>
      ${L.CFG.sitio ? `<p style="margin:0;font-size:14px">
        <a href="${L.esc(L.CFG.sitio)}#agenda" style="color:#7FC8FF">Elegir otra hora</a>
      </p>` : ''}`),
    { reply_to: L.CFG.mailAdmin || undefined });

  if (L.CFG.mailAdmin) {
    await L.enviarMail(L.CFG.mailAdmin, 'Cancelada · ' + rv.nombre + ' · ' + cuando,
      L.envoltura('Cita cancelada por el cliente', L.tabla([
        ['Cuándo era', cuando],
        ['Nombre', rv.nombre],
        ['Email', rv.email],
        ['Teléfono', rv.telefono],
        ['Servicio', rv.servicio]
      ])), { reply_to: rv.email });
  }
  if (L.CFG.waAdmin) {
    await L.enviarWA(L.CFG.waAdmin,
      'Cancelada: ' + rv.nombre + ' · ' + cuando,
      L.CFG.waTplAdmin, [rv.nombre, cuando, 'CANCELADA']);
  }

  const salida = publico(rv);
  salida.estado = 'cancelada';
  return L.json(res, 200, { ok: true, reserva: salida });
};
