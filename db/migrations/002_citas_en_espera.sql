begin;

-- Las citas que dependen de una resolución (huellas, recogida de la TIE, jura)
-- nacen «en_espera», sin plazo ni garantía: empiezan a contar al activarse.
alter table citas alter column sla_vence_en drop not null;
alter table citas drop constraint if exists citas_estado_check;
alter table citas add constraint citas_estado_check check (
  estado in ('en_espera', 'requerida', 'en_gestion', 'reservada', 'confirmada', 'asistida', 'reprogramar', 'cancelada', 'sin_cita_reembolso')
);
alter table citas add column if not exists activada_en timestamptz;

-- La situación administrativa es un dato sensible: pasa a guardarse cifrada
-- (sobre «v1.…» en la misma columna). Las filas anteriores a esta migración
-- solo existen en entornos de prueba.
comment on column leads.situacion is 'Cifrada con DATA_ENCRYPTION_KEY (sobre v1.iv.tag.datos)';

commit;
