-- Migration 002: Imagem e descricao nas capsulas

ALTER TABLE capsulas
  ADD COLUMN descricao TEXT NULL AFTER nome,
  ADD COLUMN imagem_url VARCHAR(500) NULL AFTER descricao;
