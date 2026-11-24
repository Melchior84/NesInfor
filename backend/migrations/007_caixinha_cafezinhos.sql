-- Caixinha / gorjeta de cafezinhos (Studios Melk) em cada solicitacao
ALTER TABLE solicitacoes
  ADD COLUMN cafezinhos_gorjeta TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER data_pagamento,
  ADD COLUMN valor_gorjeta DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER cafezinhos_gorjeta;
