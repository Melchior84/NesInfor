-- Solicitacoes de usuarios pedindo a abertura de uma nova rodada
CREATE TABLE IF NOT EXISTS solicitacoes_abertura_rodada (
  id INT NOT NULL AUTO_INCREMENT,
  usuario_id INT NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sol_abertura_usuario (usuario_id),
  CONSTRAINT fk_sol_abertura_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
