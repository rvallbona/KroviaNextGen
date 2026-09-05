/* ============================================================
   KroviaNextGen — CONFIGURACIÓN
   Rellena estos valores y la landing queda conectada de verdad.
   No hace falta tocar nada más.
   ============================================================ */
window.KROVIA_CONFIG = {

  /* 0) SUPABASE — dónde se guardan los leads.
        Los dos valores están en Supabase → Settings → API.
        · supabaseUrl: el "Project URL" (https://xxxx.supabase.co)
        · supabaseAnonKey: la clave "anon" / "publishable"
        Estas dos claves son PÚBLICAS por diseño: van en el navegador y
        están protegidas por la política RLS (solo permite INSERT).
        NUNCA pegues aquí la "service_role" ni la "secret". */
  supabaseUrl: "",
  supabaseAnonKey: "",

  /* 1) CALENDLY — pega aquí tu enlace de evento.
        Ej: "https://calendly.com/krovianextgen/consulta-30min"
        Si lo dejas vacío, la sección muestra solo el formulario. */
  calendlyUrl: "",

  /* 2) WHATSAPP — número con prefijo internacional, sin + ni espacios.
        Ej: "34600112233"
        Si lo dejas vacío, los botones de WhatsApp no aparecen. */
  whatsappNumber: "",

  /* 3) WEBHOOK — a dónde se envían los leads (n8n, Make, Zapier, Formspree…).
        Ej n8n:  "https://tu-n8n.com/webhook/krovia-leads"
        Ej Make: "https://hook.eu2.make.com/xxxxxxxxxxxx"
        Si lo dejas vacío, el lead se guarda en el navegador y se abre tu email. */
  webhookUrl: "",

  /* 4) EMAIL de contacto (fallback si no hay webhook). */
  email: "hola@krovianextgen.com",

  /* Opcional: mensaje inicial que se abre en WhatsApp. */
  whatsappMensaje: "Hola, vengo de la web de KroviaNextGen y quiero automatizar mi negocio."
};
