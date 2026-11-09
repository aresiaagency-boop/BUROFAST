-- 005 · Petición expresa de empezar dentro del plazo de desistimiento
-- (TRLGDCU art. 108.2): sin ella, quien desiste en 14 días recupera todo
-- aunque el trabajo ya esté hecho. Se guarda cuándo la marcó el cliente.
alter table pagos add column if not exists empezar_ya_en timestamptz;
