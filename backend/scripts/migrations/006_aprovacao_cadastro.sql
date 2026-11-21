-- Migration 006: Aprovacao de cadastro por ADMIN e dominios auto-aprovados

ALTER TABLE usuarios
  ADD COLUMN aprovado TINYINT(1) NOT NULL DEFAULT 1 AFTER email_verificado;

CREATE TABLE IF NOT EXISTS configuracoes_sistema (
  chave VARCHAR(80) NOT NULL,
  valor TEXT NULL,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (chave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
