-- Bóveda de documentos del expediente: el cliente adjunta, BUROFAST guarda
-- cifrado (AES-256-GCM con DATA_ENCRYPTION_KEY) y el equipo revisa. Al borrar,
-- el contenido se elimina en el acto y queda solo la huella para la auditoría.
create table if not exists documentos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  tipo text not null,
  nombre_cifrado text not null,
  mime text not null,
  bytes integer not null check (bytes > 0),
  sha256 text not null,
  contenido_cifrado bytea,
  origen text not null check (origen in ('app', 'whatsapp', 'equipo')),
  estado text not null default 'recibido' check (estado in ('recibido', 'valido', 'rechazado')),
  nota text,
  creado_en timestamptz not null default now(),
  revisado_en timestamptz,
  borrado_en timestamptz
);
create index if not exists documentos_lead_idx on documentos (lead_id, creado_en desc) where borrado_en is null;

-- Consentimiento expreso para guardar documentos (RGPD, art. 9 si contienen
-- datos sensibles): fecha y versión del texto aceptado, por expediente.
alter table leads add column if not exists documentos_consentidos_en timestamptz;
