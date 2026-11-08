begin;

-- Solicitudes que llegan del funnel o de HESTIA por WhatsApp. Nombre, teléfono
-- y correo van cifrados (AES-256-GCM en la aplicación); el hash del teléfono
-- permite detectar duplicados sin descifrar.
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  referencia text not null unique,
  origen text not null check (origen in ('funnel', 'whatsapp')),
  locale text not null check (locale in ('es', 'en', 'fr', 'pt', 'ar', 'uk')),
  sueno text not null,
  ubicacion text not null,
  situacion text,
  tiempo text,
  pasaporte text not null,
  ruta_id text not null,
  producto_id text not null,
  nivel text not null check (nivel in ('N1', 'N2', 'N3')),
  nivel_cita text check (nivel_cita in ('urgente', 'puede_esperar')),
  con_guardian boolean not null default false,
  total_estimado_centimos integer not null check (total_estimado_centimos >= 0),
  nombre_cifrado text not null,
  telefono_cifrado text not null,
  telefono_hash text not null,
  email_cifrado text,
  consentimiento_privacidad_en timestamptz not null,
  consentimiento_marketing boolean not null default false,
  estado text not null default 'nuevo' check (estado in ('nuevo', 'contactado', 'revision_abogado', 'convertido', 'descartado')),
  demo boolean not null default false,
  creado_en timestamptz not null default now()
);

create index if not exists leads_creado_en_idx on leads (creado_en desc);
create index if not exists leads_telefono_hash_idx on leads (telefono_hash);

-- Cada cita que un proceso necesita y que BUROFAST gestiona.
create table if not exists citas (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  tipo text not null,
  nivel text not null check (nivel in ('urgente', 'puede_esperar')),
  estado text not null default 'requerida' check (estado in ('requerida', 'en_gestion', 'reservada', 'confirmada', 'asistida', 'reprogramar', 'cancelada', 'sin_cita_reembolso')),
  sla_vence_en timestamptz not null,
  garantia_vence_en timestamptz,
  fecha_cita timestamptz,
  lugar text,
  demo boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (lead_id, tipo)
);

create index if not exists citas_estado_sla_idx on citas (estado, sla_vence_en);

create table if not exists cita_eventos (
  id bigserial primary key,
  cita_id uuid not null references citas (id) on delete cascade,
  estado_anterior text,
  estado_nuevo text not null,
  actor text not null,
  nota text,
  creado_en timestamptz not null default now()
);

-- Señales de HESTIA (WhatsApp). Sin texto del mensaje: solo lo necesario para
-- medir y deduplicar.
create table if not exists hestia_eventos (
  id bigserial primary key,
  mensaje_id text not null unique,
  tipo text not null check (tipo in ('mensaje_entrante', 'respuesta_enviada', 'escalado_humano', 'enlace_funnel')),
  locale text,
  telefono_hash text,
  creado_en timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigserial primary key,
  actor_id text not null,
  accion text not null,
  objetivo_id text,
  parametros_redactados jsonb not null default '{}'::jsonb,
  resultado text not null check (resultado in ('ok', 'rechazado', 'error')),
  correlation_id text not null,
  creado_en timestamptz not null default now()
);

create index if not exists audit_logs_creado_en_idx on audit_logs (creado_en desc);

commit;
