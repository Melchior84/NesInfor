-- Migration 005: Intensidade (0 a 12) nas capsulas Nespresso

ALTER TABLE capsulas
  ADD COLUMN intensidade TINYINT UNSIGNED NULL AFTER imagem_url;
