/* ============================================================
   KroviaNextGen — CONFIGURACIÓN DEL NAVEGADOR
   Aquí SOLO van cosas públicas. Las claves de Supabase, del
   correo y de WhatsApp viven en las variables de entorno de
   Vercel y no salen nunca del servidor (ver README.md).
   ============================================================ */
window.KROVIA_CONFIG = {

  /* 1) De dónde cuelga la API.
        Déjalo vacío si la web y las funciones están en el mismo
        dominio de Vercel (lo normal). Solo se rellena si sirves
        el HTML desde otro sitio: "https://tu-proyecto.vercel.app" */
  apiBase: "",

  /* 2) WHATSAPP — tu número con prefijo, sin + ni espacios.
        Ej: "34600112233"
        Es solo para los botones "escríbenos por WhatsApp".
        Los avisos automáticos se configuran en Vercel. */
  whatsappNumber: "",

  /* 3) EMAIL público de contacto (el enlace del pie y el
        "escríbenos por email" si algo falla). */
  email: "hola@krovianextgen.com",

  /* Mensaje con el que se abre WhatsApp al pulsar el botón. */
  whatsappMensaje: "Hola, vengo de la web de KroviaNextGen y quiero automatizar mi negocio."
};
