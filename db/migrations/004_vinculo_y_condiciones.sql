-- 004 · El expediente se vincula a una cuenta solo con prueba de posesión
-- (el código de camino que vio quien lo envió), no por el correo tecleado:
-- una errata o un correo ajeno no deben enseñar el caso a otra persona.
-- Y cada cobro guarda qué versión de las condiciones estaba en vigor.
alter table leads add column if not exists email_verificado_en timestamptz;
alter table pagos add column if not exists condiciones_version text;
