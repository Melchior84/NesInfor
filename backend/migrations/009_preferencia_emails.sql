-- Preferencia de recebimento de e-mails sobre rodadas/cafes por usuario
ALTER TABLE usuarios
  ADD COLUMN receber_emails_cafe TINYINT(1) NOT NULL DEFAULT 1 AFTER conta;
