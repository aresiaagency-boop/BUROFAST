-- Comprobación de documentos: IRIS lee el documento y el servidor decide con
-- reglas fijas. «verificado» es el verde automático para seguir; «dudoso», el
-- ámbar que revisa una persona. «valido» y «rechazado» los pone el abogado.
alter table documentos drop constraint if exists documentos_estado_check;
alter table documentos add constraint documentos_estado_check
  check (estado in ('recibido', 'verificado', 'dudoso', 'valido', 'rechazado'));

-- Código de la decisión (sin datos personales) y lo que leyó IRIS, cifrado:
-- fechas del documento y si el titular coincide. Nunca números de documento.
alter table documentos add column if not exists revision_codigo text;
alter table documentos add column if not exists revision_cifrada text;
alter table documentos add column if not exists revisado_por text check (revisado_por in ('iris', 'equipo'));

-- La comprobación automática envía el documento a un proveedor de IA: va con
-- su propio consentimiento, aparte del de guardarlo.
alter table leads add column if not exists documentos_ia_consentidos_en timestamptz;

-- El nivel de gestión de citas que pidió la persona. «nivel_cita» queda nulo si
-- un documento aportado deja la ruta sin citas que gestionar; con este se
-- recupera si ese documento se rechaza después.
alter table leads add column if not exists nivel_cita_pedido text;
update leads set nivel_cita_pedido = nivel_cita where nivel_cita_pedido is null and nivel_cita is not null;

-- «¿Ya lo tienes?»: la respuesta de la persona por documento.
create table if not exists documentos_declaraciones (
  lead_id uuid not null references leads (id) on delete cascade,
  tipo text not null,
  tiene boolean not null,
  actualizado_en timestamptz not null default now(),
  primary key (lead_id, tipo)
);
