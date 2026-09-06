# KroviaNextGen — Landing + agenda propia

Web estática (sin build) con:

- **Agenda propia** en tres pasos (día → hora → datos). Sustituye a Calendly.
- **Bloqueo real de horas**: una hora reservada desaparece para el resto.
- **Avisos automáticos** por correo (con invitación de calendario) y por WhatsApp, al cliente y a ti.
- Todo guardado en **Supabase**.

Las claves privadas viven en las variables de entorno de Vercel. En el navegador no hay ninguna.

---

## Cómo funciona

```
Navegador                    Vercel (funciones)              Servicios
────────────                 ──────────────────              ─────────
booking.js  ──GET /api/slots──►  lee horas cogidas  ────────►  Supabase
            ──POST /api/book──►  1. guarda la reserva ───────►  Supabase
                                 2. correo + .ics    ───────►  Resend
                                 3. WhatsApp         ───────►  Meta Cloud API
main.js     ──POST /api/lead──►  guarda + te avisa   ───────►  Supabase / Resend
```

El navegador **nunca** habla con Supabase. Solo llama a nuestras funciones, que son las
únicas que tienen la `service_role`.

---

# Puesta en marcha, paso a paso

Nueve pasos. Los **cinco primeros son obligatorios** y se hacen en una tarde; los cuatro
últimos son mejoras que puedes dejar para otro día.

| | Paso | Sin él… | Rato |
|---|---|---|---|
| ✅ | 1 · Tablas en Supabase | no hay dónde guardar nada | 2 min |
| ✅ | 2 · Claves de Supabase | — | 2 min |
| ✅ | 3 · Subir el proyecto a Vercel | la web no existe en internet | 10 min |
| ✅ | 4 · Conectar la base de datos | la agenda va en modo demostración | 5 min |
| ✅ | 5 · Conectar el correo | se reserva pero no avisa a nadie | 15 min + DNS |
| ⬜ | 6 · Ajustar la web | botones de WhatsApp y email sin rellenar | 2 min |
| ⬜ | 7 · Prueba de humo | no sabes si funciona de verdad | 5 min |
| ⬜ | 8 · WhatsApp automático | solo avisa por correo | 1-2 h |
| ⬜ | 9 · Recordatorio del día antes | nadie se acuerda de la cita | 5 min |

**Cada paso termina con algo que puedes mirar.** Si lo que ves no es lo que pone aquí, no
sigas: está todo encadenado y arrastrarías el fallo hasta el final.

---

## Paso 1 · Crear las tablas en Supabase

1. Entra en tu proyecto de Supabase → **SQL Editor** → **New query**.
2. Pega entero el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**.

Crea `reservas`, `leads` y una vista `agenda_proxima` para consultar tus citas de un vistazo.
El script se puede ejecutar más de una vez sin romper nada: si algún día se añaden columnas,
lo vuelves a pegar y ya está.

> **Lo importante de ese SQL** es el índice `reservas_hueco_unico`. Es lo que bloquea las
> horas de verdad: si dos personas pulsan «reservar» a la vez sobre el mismo hueco, la base
> de datos rechaza a la segunda y esa persona ve «elige otra hora». Comprobarlo solo en la
> web no bastaría: entre que se pinta la pantalla y llega el clic hay segundos de sobra.

Las dos tablas quedan con RLS activo y **sin políticas**: nadie puede tocarlas con la clave
pública. Solo entra el servidor.

### Comprueba que salió bien

Abre otra query y ejecuta esto:

```sql
select tablename from pg_tables where schemaname = 'public' order by 1;
select indexname from pg_indexes where tablename = 'reservas' order by 1;
```

Tienen que aparecer las tablas `leads` y `reservas`, y entre los índices
**`reservas_hueco_unico`** y `reservas_token_unico`. Si falta el primero, el SQL no llegó a
ejecutarse entero: vuelve a pegarlo.

Y, si quieres verlo con tus ojos, una prueba del candado: mete la misma hora dos veces.

```sql
insert into reservas (inicio, fin, nombre, email)
values ('2030-01-01 10:00+00', '2030-01-01 10:15+00', 'Prueba', 'prueba@test.com');

-- esta segunda TIENE que fallar:
-- duplicate key value violates unique constraint "reservas_hueco_unico"
insert into reservas (inicio, fin, nombre, email)
values ('2030-01-01 10:00+00', '2030-01-01 10:15+00', 'Otra', 'otra@test.com');
```

**Que la segunda dé error es la señal de que va bien.** Si no diera error, el índice no se
creó y podrías acabar con dos clientes citados a la misma hora.

Para dejarlo limpio (el editor de Supabase a veces deshace el bloque entero al fallar, así que
puede que no haya quedado nada; ejecutar esto de todas formas no hace daño):

```sql
delete from reservas where inicio = '2030-01-01 10:00+00';
```

---

## Paso 2 · Copiar las claves de Supabase

En Supabase, **Project Settings** (el engranaje) → **API**. En los paneles más nuevos está
partido en dos sitios: la URL en *API* y las claves en **API Keys**.

| Necesitas | Cómo se llama allí |
|---|---|
| `SUPABASE_URL` | *Project URL* — `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | *service_role* (o *secret key*) — pulsa **Reveal** para verla |

Guárdalas en un bloc de notas: las pegas en el Paso 4.

> ⚠️ **La `service_role` se salta todas las reglas de seguridad de tu base de datos.** Quien
> la tenga puede leerlo y borrarlo todo. Va **solo** en las variables de entorno de Vercel:
> nunca en `config.js`, nunca en el HTML, nunca en un commit. La otra clave (*anon* o
> *publishable*) este proyecto no la usa para nada: el navegador no habla con Supabase.

---

## Paso 3 · Subir el proyecto a Vercel

Si el repositorio ya está conectado a Vercel, sáltate el paso. Si no:

1. Sube el código a GitHub:

   ```bash
   git add . && git commit -m "Agenda propia + API" && git push
   ```

   > Antes del `git add .`, mira que no se te cuelen carpetas sueltas. Ahora mismo hay dos
   > copias viejas del sitio en `KroviaNextGen/` y `KroviaNextGen-1/` (ZIP descomprimidos):
   > no sirven para nada y se subirían al repositorio. Bórralas o añádelas al `.gitignore`.

2. [vercel.com](https://vercel.com) → **Add New** → **Project** → importa el repositorio.
3. En la pantalla de import no configures nada: **Framework Preset** en *Other* y el resto en
   blanco. El proyecto no lleva `package.json` ni dependencias —las funciones de `api/` usan
   solo `fetch`—, así que Vercel lo detecta como sitio estático con funciones sin que le
   digas nada.
4. **Deploy**.

### Comprueba que salió bien

Abre `https://tu-proyecto.vercel.app`: la web tiene que cargar entera. Y abre después:

```
https://tu-proyecto.vercel.app/api/slots
```

Debes ver un JSON que empieza por `{"ok":true,"demo":true,…}`. **`demo: true` es lo correcto
ahora mismo**: significa que la función responde pero todavía no tiene base de datos. Eso se
arregla en el paso siguiente.

Si en vez de JSON ves un **404**, las funciones no se han desplegado: comprueba que la carpeta
`api/` está en la raíz del repositorio y que subió con el push.

---

## Paso 4 · Conectar la base de datos

Vercel → tu proyecto → **Settings** → **Environment Variables**. Añade estas dos y márcalas en
los tres entornos (Production, Preview, Development):

| Variable | Valor |
|---|---|
| `SUPABASE_URL` | el *Project URL* del Paso 2 |
| `SUPABASE_SERVICE_ROLE_KEY` | la *service_role* del Paso 2 |

Aprovecha y pon también las de la agenda. Son opcionales, pero es donde se ajusta todo:

| Variable | Por defecto | Qué es |
|---|---|---|
| `AGENDA_TZ` | `Europe/Madrid` | zona horaria de tu horario |
| `AGENDA_HORARIO` | `08:00-15:00` | franja de atención |
| `AGENDA_DIAS` | `1,2,3,4,5` | días (0 = domingo, 6 = sábado) |
| `AGENDA_DURACION` | `15` | minutos que dura la consulta |
| `AGENDA_PASO` | `30` | cada cuántos minutos empieza un hueco |
| `AGENDA_ANTELACION_H` | `2` | horas mínimas de antelación para reservar |
| `AGENDA_DIAS_VISTA` | `10` | días laborables que se enseñan |
| `MARCA` | `KroviaNextGen` | nombre que sale en correos y calendario |
| `SITIO_URL` | *(vacío)* | tu dominio, **con `https://` y sin barra final** |

`AGENDA_DURACION` es la única que además cambia el texto de la web: el rótulo «Consulta
gratuita · N min» lo escribe el servidor, así que no se puede quedar desfasado.

**`SITIO_URL` no es decorativa**: es lo que construye el enlace «cancelar o cambiar la hora»
de los correos. Si la dejas vacía, el correo sale sin ese enlace.

> Las variables **solo se leen al desplegar**. Después de añadirlas:
> **Deployments** → «…» en el último → **Redeploy**. Este paso se olvida siempre.

### Comprueba que salió bien

Vuelve a abrir `https://tu-proyecto.vercel.app/api/slots`. Ahora tiene que poner:

```json
{"ok":true,"demo":false,"zona":"Europe/Madrid","duracion":15, … }
```

**`"demo": false`** es la señal de que la web y la base de datos ya se hablan. Si sigue en
`true`: o falta una de las dos variables, o no has redesplegado.

---

## Paso 5 · Conectar el correo (Resend)

Sin esto la agenda reserva y bloquea las horas, pero no avisa a nadie.

1. Crea una cuenta en [resend.com](https://resend.com) — el plan gratis da 3.000 correos al
   mes, de sobra.
2. **Domains** → **Add domain** → escribe tu dominio y añade en tu proveedor de DNS los
   registros que te muestra (SPF y DKIM). Espera al ✅ verde: tarda entre unos minutos y unas
   horas, según el proveedor.
3. **API Keys** → **Create API Key** → cópiala (solo se enseña una vez).
4. Añade en Vercel, otra vez a los tres entornos:

| Variable | Ejemplo | Qué es |
|---|---|---|
| `RESEND_API_KEY` | `re_xxxxxxxx` | la clave del punto 3 |
| `MAIL_FROM` | `KroviaNextGen <hola@tudominio.com>` | remitente; el dominio tiene que ser el verificado |
| `MAIL_ADMIN` | `tu@correo.com` | **tu correo**: aquí te llegan las reservas y los formularios |

5. **Redeploy** otra vez.

> **¿Todavía sin dominio propio?** Puedes empezar con `MAIL_FROM=onboarding@resend.dev`, pero
> Resend en modo pruebas **solo deja escribir a la dirección con la que te registraste**.
> Sirve para probarlo tú; para escribir a clientes hace falta el dominio verificado.

Que funciona lo compruebas en el Paso 7, reservando de verdad.

---

## Paso 6 · Ajustar la web

En [`assets/js/config.js`](assets/js/config.js). Este archivo lo ve todo el mundo, así que
aquí **solo van cosas públicas**:

```js
window.KROVIA_CONFIG = {
  apiBase: "",                        // déjalo vacío: la web y /api van en el mismo dominio
  whatsappNumber: "34600112233",      // tu número, sin + ni espacios → botón verde "escríbenos"
  email: "hola@krovianextgen.com"     // email público del pie de página
};
```

`whatsappNumber` solo enciende los botones «escríbenos por WhatsApp». Los avisos automáticos
son otra cosa y se configuran en el Paso 8.

Commit y push: Vercel redespliega solo.

---

## Paso 7 · Prueba de humo

Reserva tú mismo, como si fueras un cliente. Es la única forma de saber que la cadena entera
funciona.

1. Abre tu web → **Agendar consulta** → elige día y hora → pon **tu nombre y tu email** →
   confirma.
2. Tiene que salir la pantalla de confirmación con la fecha.

Y ahora repasa los cuatro sitios:

| Dónde | Qué tiene que haber |
|---|---|
| **Tu web** | esa hora ya no aparece en la lista. Recarga: sigue sin aparecer |
| **Supabase** → `reservas` | una fila nueva con `estado = confirmada`, y la columna `notificado` con `{"mail_cliente":true,…}` |
| **Tu correo** (`MAIL_ADMIN`) | «Reserva · Tu nombre · …», con un `.ics` adjunto |
| **El correo del cliente** | «Consulta confirmada · …», también con el `.ics` |

3. Abre el `.ics` adjunto: la cita se añade a tu Google Calendar con aviso 15 min antes.
4. En el correo del cliente, pulsa **«Cancelar o cambiar la hora»**. Se abre `cancelar.html`,
   confirmas, y esa hora **vuelve a aparecer libre** en la web al instante.

Si los cuatro cuadros están, ya lo tienes montado. Borra la fila de prueba en Supabase para
dejarlo limpio.

---

## Paso 8 · WhatsApp automático (opcional)

Es lo más laborioso, y no por la web: el requisito lo pone Meta.
**Fuera de una conversación ya abierta, WhatsApp solo permite enviar plantillas aprobadas.**

1. [developers.facebook.com](https://developers.facebook.com) → crea una app tipo **Business**
   → añade el producto **WhatsApp**.
2. Apunta el **Phone number ID** y genera un **token permanente** (System User con permisos
   `whatsapp_business_messaging`). El token de prueba caduca en 24 h: es el fallo clásico,
   funciona hoy y deja de funcionar mañana.
3. **WhatsApp Manager** → **Plantillas de mensajes** → crea dos, categoría *Utility*, en
   español:

   *Para el cliente* (ej. `reserva_confirmada`) — 4 variables:
   ```
   Hola {{1}}, tu consulta con {{2}} queda confirmada para el {{3}} ({{4}} minutos). ¡Nos vemos!
   ```
   *Para ti* (ej. `aviso_reserva`) — 3 variables:
   ```
   Nueva reserva: {{1}} · {{2}} · {{3}}
   ```
   La aprobación suele tardar minutos. El orden de las variables importa: es el que manda
   `api/book.js`.

4. Añade en Vercel y redespliega:

| Variable | Ejemplo |
|---|---|
| `WHATSAPP_TOKEN` | `EAAG...` |
| `WHATSAPP_PHONE_ID` | `123456789012345` |
| `WHATSAPP_ADMIN` | `34600112233` ← tu número, sin `+` |
| `WHATSAPP_TEMPLATE_CLIENTE` | `reserva_confirmada` |
| `WHATSAPP_TEMPLATE_ADMIN` | `aviso_reserva` |
| `WHATSAPP_TEMPLATE_LANG` | `es` |

Si dejas los `TEMPLATE_*` vacíos se intenta un mensaje de texto normal, que llega solo si esa
persona te ha escrito en las últimas 24 h. **El correo sale igualmente**, así que ninguna
reserva se pierde por esto.

Al cliente solo se le escribe si ha dejado teléfono: el campo es opcional.

---

## Paso 9 · Recordatorio del día antes (opcional)

Ya está montado: `vercel.json` declara un **Cron** que llama a `/api/cron` cada día a las
07:00 UTC. Esa función busca las citas de mañana que aún no tengan aviso, manda el
recordatorio al cliente (correo + WhatsApp) y te envía a ti el resumen del día.

Para activarlo:

1. Genera un secreto:

   ```bash
   openssl rand -hex 32
   ```

2. Ponlo en Vercel como `CRON_SECRET` (y `RECORDATORIO_DIAS` si quieres cambiar los días de
   antelación; por defecto 1). Redespliega.
3. Vercel → **Settings** → **Cron Jobs** debe listar `/api/cron`.

No se repite: cuando avisa, marca la fila con `recordado_en`. Da igual que el cron se ejecute
dos veces, nadie recibe el aviso dos veces.

> **Los Crons de Vercel requieren plan Pro.** En Hobby puedes llamar a la misma URL desde
> cualquier programador externo (cron-job.org, n8n, Make…) mandando la cabecera
> `Authorization: Bearer TU_CRON_SECRET`.

---

## Si algo no funciona

| Lo que ves | Qué pasa | Qué hacer |
|---|---|---|
| `/api/slots` da **404** | las funciones no se desplegaron | que `api/` esté en la raíz del repo y que el push la subiera |
| `/api/slots` dice `"demo": true` | falta la base de datos | revisa `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, **y redespliega** |
| La web dice «Modo demostración» | no consigue hablar con `/api/slots` | lo de arriba. Abriendo el `index.html` con doble clic saldrá siempre |
| Reserva pero **no llega ningún correo** | falta Resend, o el dominio no está verificado | mira `notificado` en la fila de `reservas`: si pone `mail_cliente:false`, el problema es Resend |
| Los correos solo te llegan **a ti** | estás con `onboarding@resend.dev` | verifica tu dominio en Resend |
| «Esa hora ya no está en la agenda» | la hora no cuadra con la parrilla del servidor | cambiaste `AGENDA_HORARIO` o `AGENDA_PASO` y la web tiene la lista vieja: recarga |
| «Justo han cogido esa hora» | el índice único ha hecho su trabajo | no es un fallo: elige otra |
| Cambio una variable y no pasa nada | Vercel solo las lee al desplegar | **Redeploy** |
| El correo no lleva el enlace de cancelar | falta `SITIO_URL` | ponla con `https://` y sin barra final |

---

## Todas las variables, de un vistazo

Los nombres y los comentarios están también en [`.env.example`](.env.example), listo para
copiar.

| Grupo | Variables | ¿Obligatorio? |
|---|---|---|
| Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | **sí** |
| Correo | `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_ADMIN` | para que avise a alguien |
| Agenda | `AGENDA_TZ`, `AGENDA_HORARIO`, `AGENDA_DIAS`, `AGENDA_DURACION`, `AGENDA_PASO`, `AGENDA_ANTELACION_H`, `AGENDA_DIAS_VISTA`, `MARCA`, `SITIO_URL` | no, todas tienen valor por defecto |
| Recordatorio | `CRON_SECRET`, `RECORDATORIO_DIAS` | no |
| WhatsApp | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_ADMIN`, `WHATSAPP_TEMPLATE_CLIENTE`, `WHATSAPP_TEMPLATE_ADMIN`, `WHATSAPP_TEMPLATE_RECORDATORIO`, `WHATSAPP_TEMPLATE_LANG` | no |

---

## Probar en local (opcional)

Con `python -m http.server` la web se ve, pero `/api/*` no existe y la agenda entra en modo
demostración. Para levantar también las funciones hace falta la CLI de Vercel:

```bash
npm i -g vercel
vercel link
vercel env pull .env.local
vercel dev
```

`vercel env pull` se baja las variables que ya pusiste en el panel, así que en local estarías
reservando contra **la misma base de datos de producción**. Ojo con eso: las citas de prueba
salen en la agenda real.

---

## Modo demostración

Si `/api/slots` no responde (web abierta con doble clic, servidor local, despliegue sin
funciones) o falta la base de datos, la agenda **sigue navegable** y avisa arriba:

> **Modo demostración.** Puedes recorrerla entera: no se reserva nada ni se envía ningún dato
> a ninguna parte.

Sirve para enseñar el flujo a un cliente sin tener nada conectado. Y al confirmar dice
claramente que no ha reservado nada, para no prometer una cita que no existe.

---

## Qué pasa cuando alguien reserva

1. `POST /api/book` con la hora y los datos.
2. El servidor **revalida la hora** contra su propia parrilla. No se fía de lo que mande el
   navegador: horas fuera de horario o partidas por la mitad se rechazan.
3. Comprueba la antelación mínima.
4. `INSERT` en `reservas`. Si el índice único salta → «justo han cogido esa hora», y la web
   recarga los huecos y le pide elegir otra.
5. Correo al cliente + correo a ti, los dos con un **`.ics` adjunto**. Al abrirlo, la cita se
   añade a tu Google Calendar con recordatorio 15 min antes.
6. WhatsApp a los dos, si está configurado.
7. Se anota en la columna `notificado` qué avisos salieron, para poder revisarlo luego sin
   rebuscar en los logs.

## Ver y cancelar citas

**Tú:** Supabase → **Table editor** → `reservas`, o la vista `agenda_proxima`.
Para liberar un hueco, cambia `estado` de `confirmada` a `cancelada`: como el índice único
solo mira las confirmadas, la hora vuelve a aparecer libre en la web al instante.

**El cliente:** cada correo de confirmación lleva un enlace a `cancelar.html?t=TOKEN`. El token
son 32 caracteres al azar guardados en la fila: identifica la cita sin obligarle a registrarse
y no se puede adivinar. Al cancelar, `/api/cancel` pone la fila en `cancelada`, el hueco vuelve
a la agenda y te llega un aviso.

Necesita `SITIO_URL` configurada; si no, el correo sale sin el enlace.

---

## Estructura

```
KroviaNextGen/
├─ index.html
├─ cancelar.html           ← página del enlace "cancelar mi cita"
├─ vercel.json             ← declara el Cron diario
├─ api/                    ← funciones de Vercel (Node, sin dependencias)
│  ├─ _lib.js              ← config, zona horaria, Supabase, correo, WhatsApp, .ics
│  ├─ slots.js             ← GET  huecos libres
│  ├─ book.js              ← POST reservar
│  ├─ lead.js              ← POST formulario y chatbot
│  ├─ cancel.js            ← GET/POST cancelar con token
│  └─ cron.js              ← recordatorio diario
├─ supabase/schema.sql     ← pégalo en el SQL Editor
├─ assets/
│  ├─ css/styles.css       ← estilo Blueprint (todo en variables de :root)
│  └─ js/
│     ├─ config.js         ← lo único público que tocas
│     ├─ background.js     ← panal hexagonal animado
│     ├─ booking.js        ← agenda de 3 pasos
│     ├─ chatbot.js        ← cuestionario
│     └─ main.js           ← interacciones + envío de leads
└─ README.md
```

## El chatbot

Botón flotante o cualquier «Hablar con el agente». Árbol de decisión con 5 ramas
(web, automatización, chatbot, compras, datos): da un diagnóstico, manda la ficha a
`/api/lead` y ofrece pasar a la agenda con los datos ya rellenos.

Para editar las preguntas: objeto `FLOW` en `assets/js/chatbot.js`.

## Seguridad

- Las claves privadas solo existen como variables de entorno en Vercel.
- RLS activo y sin políticas en ambas tablas: la clave pública no abre nada.
- El servidor valida nombre, email y hora; los textos se recortan antes de guardarlos.
- Campo trampa oculto (`web`) en los dos formularios: si viene relleno, es un bot.
- No hay límite de peticiones por IP. Si algún día te llega spam, lo natural es añadir
  Vercel Firewall o un captcha en `/api/book`.

## Pendiente

- Sincronizar en dos direcciones con Google Calendar. Ahora la web es la fuente de verdad y tu
  calendario recibe el `.ics`: si bloqueas una hora *en Google*, la web no se entera.
- Que el cliente pueda **mover** la cita, no solo cancelarla (hoy cancela y vuelve a reservar).
- Límite de peticiones por IP en `/api/book` si algún día llega spam.
