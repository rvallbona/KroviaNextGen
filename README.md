# KroviaNextGen — Landing page (v2)

UI simplificada (menos texto, más aire) y con el formulario, el chatbot y las CTAs **conectados de verdad**.

Abre **`index.html`** con doble clic.

---

## ⚙️ Conectar en 2 minutos

Todo se configura en un solo archivo: **`assets/js/config.js`**

```js
window.KROVIA_CONFIG = {
  calendlyUrl:     "",   // 1. tu enlace de Calendly
  whatsappNumber:  "",   // 2. tu número con prefijo, sin + ni espacios
  webhookUrl:      "",   // 3. webhook de n8n / Make / Zapier
  email:           "hola@krovianextgen.com"
};
```

### 1. Calendly
1. Crea el evento (ej. "Consulta 30 min") en calendly.com.
2. Copia la URL pública: `https://calendly.com/tu-usuario/consulta-30min`.
3. Pégala en `calendlyUrl`.

El calendario se incrusta dentro de la sección **Reserva tu hueco**, con los colores de la marca, y se carga solo cuando el usuario llega ahí (no ralentiza la página). Si el campo está vacío, la pestaña "Elegir hora" se oculta y se muestra el formulario.

### 2. WhatsApp
Pon el número en `whatsappNumber` (ej. `"34600112233"`). Entonces aparecen:
- Botón flotante verde abajo a la derecha.
- Pestaña "💬 WhatsApp" en la sección de agenda.
- Botón "Seguir por WhatsApp" al final del chatbot, **con el diagnóstico ya escrito en el mensaje**.

### 3. Webhook (n8n / Make / Zapier / Formspree)
1. En n8n: nodo **Webhook** → método POST → copia la Production URL.
2. Pégala en `webhookUrl`.

Recibirás un JSON así:

```json
{
  "origen": "chatbot",           // o "landing-krovianextgen" desde el formulario
  "nombre": "Ramon",
  "email": "ramon@empresa.com",
  "telefono": "+34600...",
  "servicio": "Web / Landing de alta conversión",
  "recomendacion": "web",
  "complementarios": ["chatbot"],
  "respuestas": { "objetivo": "...", "sector": "...", "equipo": "...", "urgencia": "..." },
  "mensaje": "Servicio recomendado: ... · Sector: ... · Equipo: ...",
  "url": "...", "fecha": "2026-09-05T10:00:00.000Z"
}
```

Desde ahí ya puedes: guardarlo en Google Sheets/Notion/CRM, enviarte un email o un WhatsApp, y responder automáticamente.

**Red de seguridad:** cada lead se guarda también en el navegador (`localStorage.krovia_leads`) y, si el webhook falla o no está puesto, se ofrece un enlace `mailto:` con todos los datos.

> Nota: al abrir el archivo con doble clic (`file://`) algunos navegadores bloquean el envío al webhook por CORS. En cuanto la web esté subida a un dominio (o servida con `npx serve`), funciona con normalidad. En n8n, activa CORS / responde con `Access-Control-Allow-Origin: *`.

---

## Estructura

```
KroviaNextGen/
├─ index.html
├─ assets/
│  ├─ css/styles.css
│  └─ js/
│     ├─ config.js     ← lo único que tienes que tocar
│     ├─ chatbot.js    ← cuestionario dinámico
│     └─ main.js       ← UI + Calendly + WhatsApp + webhook
└─ README.md
```

## Secciones (v2)

Hero muy limpio → 6 servicios en tarjetas de una línea → 3 pasos + 3 cifras → **Reserva tu hueco** (3 pestañas: Calendly / formulario / WhatsApp) → 4 FAQ → CTA final.

## El chatbot

Botón flotante o cualquier "Hablar con el agente".
Cuestionario dinámico con 5 ramas (web, automatización, chatbot, compras, datos) que se adapta a cada respuesta, devuelve un diagnóstico con el servicio recomendado y **envía el lead al webhook automáticamente**. Después ofrece agendar en Calendly o seguir por WhatsApp.

Para editar preguntas: objeto `FLOW` en `assets/js/chatbot.js`.

## Pendiente (v3, si quieres)

- Chatbot con LLM real (ahora es un árbol de decisión: rápido, gratis y siempre coherente).
- Casos reales y logos de clientes.
- Subirlo a un dominio + analítica.
