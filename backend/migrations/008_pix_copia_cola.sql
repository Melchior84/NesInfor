-- Amplia pix_chave para suportar codigos PIX Copia e Cola (BR Code EMV)
ALTER TABLE usuarios
  MODIFY COLUMN pix_chave VARCHAR(500) NULL;
