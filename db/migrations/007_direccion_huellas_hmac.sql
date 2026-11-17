-- Las huellas de la Dirección pasan de SHA-256 a HMAC con clave derivada de
-- AUTH_SECRET. Lo guardado con el esquema anterior ya no casa: se cierran las
-- sesiones abiertas y se libera la cuenta fijada, que se vuelve a fijar en el
-- siguiente acceso correcto de OWNER_EMAIL. Se aplica una sola vez.
begin;

update direccion_sesiones
set revocada_en = now(), motivo_revocacion = 'cambio_huella'
where revocada_en is null;

delete from direccion_identidad;

commit;
