-- Migration 003: Dados de pagamento do organizador/usuario (PIX e conta bancaria)

ALTER TABLE usuarios
  ADD COLUMN pix_chave VARCHAR(180) NULL AFTER deve_trocar_senha,
  ADD COLUMN banco VARCHAR(100) NULL AFTER pix_chave,
  ADD COLUMN agencia VARCHAR(30) NULL AFTER banco,
  ADD COLUMN conta VARCHAR(40) NULL AFTER agencia;
