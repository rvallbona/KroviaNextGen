/* ============================================================
   POST /api/lead
   El formulario de contacto y la ficha que deja el chatbot.
   Guarda en Supabase y te avisa por correo y WhatsApp.
   ============================================================ */
const L = require('./_lib');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { L.cors(res); return res.status(204).end(); }
  if (req.method !== 'POST') return L.json(res, 405, { ok: false, error: 'método no permitido' });

  const d = L.body(req);
  if (d.web) return L.json(res, 200, { ok: true });

  const nombre = String(d.nombre || '').trim().slice(0, 120);
  const email = String(d.email || '').trim().slice(0, 160);
  const telefono = String(d.telefono || '').replace(/[^\d+]/g, '').slice(0, 30);
  const servicio = String(d.servicio || '').trim().slice(0, 120);
  const mensaje = String(d.mensaje || '').trim().slice(0, 2000);

  if (nombre.length < 2) return L.json(res, 400, { ok: false, error: 'Falta tu nombre.' });
  if (!EMAIL_RE.test(email)) return L.json(res, 400, { ok: false, error: 'El email no parece válido.' });

  const fila = {
    nombre: nombre,
    email: email,
    telefono: telefono || null,
    servicio: servicio || null,
    mensaje: mensaje || null,
    origen: String(d.origen || 'formulario-web').slice(0, 60),
    url: String(d.url || '').slice(0, 500) || null,
    chatbot: d.chatbot && typeof d.chatbot === 'object' ? d.chatbot : null
  };

  let guardado = false;
  if (L.HAY_DB) {
    const ins = await L.sb('leads', { method: 'POST', body: JSON.stringify(fila) });
    guardado = ins.ok;
    if (!ins.ok) console.error('[krovia] insert lead', ins.status, ins.error);
  }

  /* --- aviso para ti --- */
  let avisado = false;
  if (L.CFG.mailAdmin) {
    const html = L.envoltura('Nuevo contacto desde la web', `
      ${L.tabla([
        ['Nombre', nombre],
        ['Email', email],
        ['Teléfono', telefono],
        ['Servicio', servicio],
        ['Mensaje', mensaje],
        ['Origen', fila.origen],
        ['Página', fila.url]
      ])}
      ${fila.chatbot ? `<pre style="margin:18px 0 0;padding:12px;background:#08152B;border:1px solid rgba(140,190,255,.22);
        font-size:12px;color:#8FB0DC;white-space:pre-wrap">${L.esc(JSON.stringify(fila.chatbot, null, 2))}</pre>` : ''}`);
    const r = await L.enviarMail(L.CFG.mailAdmin, 'Contacto web · ' + nombre, html, { reply_to: email });
    avisado = r.ok;
  }
  if (L.CFG.waAdmin) {
    await L.enviarWA(L.CFG.waAdmin,
      'Nuevo contacto: ' + nombre + ' · ' + email + (telefono ? ' · ' + telefono : '') + (servicio ? ' · ' + servicio : ''),
      L.CFG.waTplAdmin, [nombre, servicio || 'consulta general', email + (telefono ? ' · ' + telefono : '')]);
  }

  /* --- acuse de recibo al cliente --- */
  if (L.HAY_MAIL) {
    await L.enviarMail(email, 'Hemos recibido tu mensaje · ' + L.CFG.marca,
      L.envoltura('Mensaje recibido', `
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#8FB0DC">
          Hola ${L.esc(nombre)}, gracias por escribirnos. Te respondemos en menos de 24 h.
        </p>
        ${L.tabla([['Servicio', servicio], ['Tu mensaje', mensaje]])}`),
      { reply_to: L.CFG.mailAdmin || undefined });
  }

  /* Basta con que un destino haya funcionado para no perder el lead. */
  if (!guardado && !avisado) {
    return L.json(res, 500, { ok: false, error: 'No hemos podido registrar tu mensaje.' });
  }
  return L.json(res, 200, { ok: true, guardado: guardado, avisado: avisado });
};
