begin;

-- Puerta humana antes de cobrar: «aprobado» = un abogado ha confirmado la
-- ruta. Solo desde ese estado se puede pagar el anticipo.
alter table leads drop constraint if exists leads_estado_check;
alter table leads add constraint leads_estado_check check (
  estado in ('nuevo', 'contactado', 'revision_abogado', 'aprobado', 'convertido', 'descartado')
);

-- Acceso de clientes con Google: el expediente se encuentra por el hash del
-- correo (HMAC con la clave de datos). El correo nunca se busca en claro.
alter table leads add column if not exists email_hash text;
create index if not exists leads_email_hash_idx on leads (email_hash) where email_hash is not null;

-- Cobros con Stripe. El importe lo decide el servidor a partir del presupuesto
-- guardado; Stripe solo confirma que se pagó.
create table if not exists pagos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete restrict,
  tipo text not null check (tipo in ('anticipo', 'resto')),
  importe_centimos integer not null check (importe_centimos > 0),
  moneda text not null default 'eur',
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pagado', 'fallido', 'expirado', 'reembolsado')),
  modo text not null check (modo in ('live', 'test')),
  stripe_session_id text unique,
  stripe_payment_intent text,
  checkout_url text,
  expira_en timestamptz,
  pagado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists pagos_lead_idx on pagos (lead_id, tipo, estado);
create index if not exists pagos_payment_intent_idx on pagos (stripe_payment_intent) where stripe_payment_intent is not null;
-- Sin índice único de «un pagado por tipo» a propósito: si alguien paga dos
-- veces (dos pestañas), los dos cobros tienen que quedar registrados para
-- poder devolver uno. El centro de mando marca los duplicados.

-- Eventos de Stripe ya procesados: el webhook es idempotente aunque Stripe
-- reintente o mande el mismo evento dos veces.
create table if not exists stripe_eventos (
  id text primary key,
  tipo text not null,
  procesado_en timestamptz not null default now()
);

-- Turnos de conversación con HESTIA y sus agentes (app y WhatsApp). Sin el
-- texto del mensaje: solo lo necesario para medir y vigilar.
create table if not exists hestia_turnos (
  id bigserial primary key,
  canal text not null check (canal in ('app', 'whatsapp')),
  conversacion_hash text not null,
  agente text not null,
  motor text,
  modo text not null check (modo in ('ia', 'local')),
  ok boolean not null,
  escalado boolean not null default false,
  latencia_ms integer,
  locale text,
  creado_en timestamptz not null default now()
);
create index if not exists hestia_turnos_creado_idx on hestia_turnos (creado_en desc);

-- Límite de peticiones compartido por todas las instancias: en Vercel cada
-- función tiene su propia memoria, así que el contador vive en la base.
create table if not exists limites (
  clave text primary key,
  ventana_inicio timestamptz not null,
  cuenta integer not null
);

commit;
