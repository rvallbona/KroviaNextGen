/* ============================================================
   GET /api/slots
   Devuelve los próximos días laborables con sus huecos y cuáles
   están libres. Las etiquetas vienen ya escritas en la zona
   horaria del negocio para que el navegador no calcule nada.
   ============================================================ */
const L = require('./_lib');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { L.cors(res); return res.status(204).end(); }
  if (req.method !== 'GET') return L.json(res, 405, { ok: false, error: 'método no permitido' });

  try {
    const dias = L.proximosDias(L.CFG.vista);
    if (!dias.length) return L.json(res, 200, { ok: true, demo: !L.HAY_DB, dias: [] });

    /* Una sola consulta para todo el rango visible. */
    const primero = dias[0].huecos[0];
    const ultimo = dias[dias.length - 1].huecos[dias[dias.length - 1].huecos.length - 1];
    let ocupadas = [];
    if (L.HAY_DB && primero && ultimo) {
      ocupadas = await L.reservasOcupadas(primero.toISOString(), new Date(ultimo.getTime() + 60000).toISOString());
    }
    const cogida = new Set(ocupadas);

    const salida = dias.map(function (dia) {
      const huecos = dia.huecos.map(function (h) {
        return {
          inicio: h.toISOString(),
          hora: L.fmt(h, L.CFG.tz, { hour: '2-digit', minute: '2-digit' }),
          libre: !cogida.has(h.getTime()) && L.conAntelacion(h)
        };
      });
      const ref = dia.huecos[0];
      return {
        fecha: dia.fecha,
        dia: L.fmt(ref, L.CFG.tz, { day: 'numeric' }),
        mes: L.fmt(ref, L.CFG.tz, { month: 'short' }).replace('.', ''),
        semana: L.fmt(ref, L.CFG.tz, { weekday: 'short' }).replace('.', ''),
        larga: L.fmt(ref, L.CFG.tz, { weekday: 'long', day: 'numeric', month: 'long' }),
        libres: huecos.filter(function (h) { return h.libre; }).length,
        huecos: huecos
      };
    }).filter(function (d) { return d.huecos.length > 0; });

    /* Sin base de datos la agenda sigue navegable, pero avisamos:
       es el "modo demostración" que ve el visitante. */
    return L.json(res, 200, {
      ok: true,
      demo: !L.HAY_DB,
      zona: L.CFG.tz,
      duracion: L.CFG.duracion,
      horario: L.CFG.horario,
      dias: salida
    });
  } catch (e) {
    console.error('[krovia] slots', e);
    return L.json(res, 500, { ok: false, error: 'no se ha podido leer la agenda' });
  }
};
