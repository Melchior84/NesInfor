-- Migration 001: Confirmacao de e-mail, recuperacao de senha e troca obrigatoria de senha
-- Segura para bancos ja existentes: nao apaga dados e mantem usuarios atuais verificados.

ALTER TABLE usuarios
  ADD COLUMN email_verificado TINYINT(1) NOT NULL DEFAULT 1 AFTER ativo,
  ADD COLUMN deve_trocar_senha TINYINT(1) NOT NULL DEFAULT 0 AFTER email_verificado;

CREATE TABLE IF NOT EXISTS tokens_autenticacao (
  id INT NOT NULL AUTO_INCREMENT,
  usuario_id INT NOT NULL,
  tipo ENUM('CONFIRMACAO_EMAIL', 'RECUPERACAO_SENHA') NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expira_em DATETIME NOT NULL,
  usado_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tokens_hash (token_hash),
  KEY idx_tokens_usuario_tipo (usuario_id, tipo),
  CONSTRAINT fk_tokens_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
