-- Preferencia de tema (claro/escuro) por usuario
ALTER TABLE usuarios
  ADD COLUMN tema ENUM('claro', 'escuro') NOT NULL DEFAULT 'claro' AFTER receber_emails_cafe;
