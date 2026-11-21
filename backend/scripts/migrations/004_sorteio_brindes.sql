-- Migration 004: Sorteador de brindes verificavel por rodada

ALTER TABLE rodadas_pedido
  ADD COLUMN sorteador_id INT NULL AFTER organizador_id,
  ADD CONSTRAINT fk_rodadas_sorteador
    FOREIGN KEY (sorteador_id) REFERENCES usuarios (id)
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS brindes_rodada (
  id INT NOT NULL AUTO_INCREMENT,
  rodada_id INT NOT NULL,
  nome VARCHAR(150) NOT NULL,
  descricao VARCHAR(500) NULL,
  vencedor_id INT NULL,
  sorteado_por INT NULL,
  sorteado_em DATETIME NULL,
  seed_publica CHAR(64) NULL,
  hash_auditoria CHAR(64) NULL,
  indice_sorteado INT NULL,
  participantes_snapshot JSON NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_brindes_rodada (rodada_id),
  CONSTRAINT fk_brindes_rodada
    FOREIGN KEY (rodada_id) REFERENCES rodadas_pedido (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_brindes_vencedor
    FOREIGN KEY (vencedor_id) REFERENCES usuarios (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_brindes_sorteado_por
    FOREIGN KEY (sorteado_por) REFERENCES usuarios (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS brinde_exclusoes (
  id INT NOT NULL AUTO_INCREMENT,
  brinde_id INT NOT NULL,
  usuario_id INT NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_brinde_exclusao (brinde_id, usuario_id),
  CONSTRAINT fk_exclusao_brinde
    FOREIGN KEY (brinde_id) REFERENCES brindes_rodada (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_exclusao_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
