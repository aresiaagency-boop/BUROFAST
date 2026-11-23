-- El diploma CCSE y el DELE A2 pasan a ser documentos distintos: quien no es de
-- un país de habla hispana necesita los dos, y uno solo no puede dar el verde
-- de ambos. Lo que se hubiera subido como «ccse_dele» se trata como CCSE.
update documentos set tipo = 'ccse' where tipo = 'ccse_dele';
update documentos_declaraciones set tipo = 'ccse'
  where tipo = 'ccse_dele' and not exists (select 1 from documentos_declaraciones d where d.lead_id = documentos_declaraciones.lead_id and d.tipo = 'ccse');
delete from documentos_declaraciones where tipo = 'ccse_dele';
