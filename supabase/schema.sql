-- ============================================================
-- KroviaNextGen — esquema de Supabase
-- Pégalo entero en Supabase → SQL Editor → Run.
-- Se puede ejecutar más de una vez sin romper nada.
-- ============================================================

-- ------------------------------------------------------------
-- RESERVAS de la agenda
-- ------------------------------------------------------------
create table if not exists public.reservas (
  id            uuid primary key default gen_random_uuid(),
  creado_en     timestamptz not null default now(),
  inicio        timestamptz not null,
  fin           timestamptz not null,
  duracion_min  int         not null default 15,
  zona          text        not null default 'Europe/Madrid',
  nombre        text        not null,
  email         text        not null,
  telefono      text,
  servicio      text,
  mensaje       text,
  estado        text        not null default 'confirmada',
  origen        text,
  url           text,
  notificado    jsonb       not null default '{}'::jsonb
);

-- ESTA LÍNEA ES LA QUE BLOQUEA LAS HORAS.
-- Dos personas pueden pulsar "reservar" en el mismo segundo: la
-- segunda choca contra el índice y recibe "elige otra hora".
-- Al cancelar una cita el hueco se libera solo, porque el índice
-- solo mira las confirmadas.
create unique index if not exists reservas_hueco_unico
  on public.reservas (inicio)
  where estado = 'confirmada';

create index if not exists reservas_inicio_idx on public.reservas (inicio);

-- Nadie entra con la clave pública: solo el servidor, que usa la
-- service_role y se salta RLS. Sin políticas = puerta cerrada.
alter table public.reservas enable row level security;


-- ------------------------------------------------------------
-- LEADS del formulario y del chatbot
-- (si ya tienes esta tabla creada, sáltate el bloque)
-- ------------------------------------------------------------
create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),
  creado_en  timestamptz not null default now(),
  nombre     text,
  email      text,
  telefono   text,
  servicio   text,
  mensaje    text,
  origen     text,
  url        text,
  chatbot    jsonb
);

alter table public.leads enable row level security;


-- ------------------------------------------------------------
-- Vista cómoda para mirar la agenda desde el panel de Supabase
-- ------------------------------------------------------------
create or replace view public.agenda_proxima as
  select
    to_char(inicio at time zone zona, 'DD/MM/YYYY HH24:MI') as cuando,
    nombre, email, telefono, servicio, estado, mensaje
  from public.reservas
  where inicio >= now() and estado = 'confirmada'
  order by inicio;


-- ------------------------------------------------------------
-- Recordatorios y cancelación por parte del cliente
-- (columnas nuevas; si ya tenías la tabla creada, esto la pone
--  al día sin tocar los datos)
-- ------------------------------------------------------------
alter table public.reservas add column if not exists token        text;
alter table public.reservas add column if not exists recordado_en timestamptz;
alter table public.reservas add column if not exists cancelado_en timestamptz;

-- El token es la llave del enlace "cancelar mi cita" que va en el
-- correo. 32 caracteres al azar: no se puede adivinar y no hace
-- falta que el cliente se registre en ninguna parte.
create unique index if not exists reservas_token_unico
  on public.reservas (token) where token is not null;

-- Para que el cron encuentre rápido las citas de mañana sin avisar
create index if not exists reservas_pendientes_aviso_idx
  on public.reservas (inicio) where estado = 'confirmada' and recordado_en is null;
