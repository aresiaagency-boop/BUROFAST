-- Dirección: acceso solo con la cuenta de Google de A.R.E.S.
-- Sesiones en servidor (revocables una a una) y la identidad de Google fijada
-- en el primer acceso. Solo se guardan huellas (SHA-256), nunca el valor.

create table if not exists direccion_sesiones (
  id_hash text primary key,
  sub_hash text not null,
  ip_hash text,
  agente_hash text not null,
  creada_en timestamptz not null default now(),
  vista_en timestamptz not null default now(),
  expira_en timestamptz not null,
  revocada_en timestamptz,
  motivo_revocacion text
);

create index if not exists direccion_sesiones_activas_idx
  on direccion_sesiones (sub_hash) where revocada_en is null;

-- Una sola fila: la cuenta de Google (su «sub», inmutable) que puede entrar.
create table if not exists direccion_identidad (
  id smallint primary key default 1 check (id = 1),
  sub_hash text not null,
  fijada_en timestamptz not null default now()
);
