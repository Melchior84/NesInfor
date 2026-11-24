import { Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Pool } from 'mysql2/promise';

/**
 * Garante de forma idempotente que todas as tabelas e colunas necessarias
 * existam no banco (ideal para ambientes novos em HML/PROD no Railway).
 * Nao apaga nem modifica dados existentes.
 */
export async function garantirSchema(
  pool: Pool,
  dbName: string,
  logger: Logger,
): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INT NOT NULL AUTO_INCREMENT,
      nome VARCHAR(120) NOT NULL,
      email VARCHAR(180) NOT NULL,
      senha_hash VARCHAR(255) NOT NULL,
      perfil ENUM('ADMIN', 'USUARIO') NOT NULL DEFAULT 'USUARIO',
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      email_verificado TINYINT(1) NOT NULL DEFAULT 1,
      aprovado TINYINT(1) NOT NULL DEFAULT 1,
      deve_trocar_senha TINYINT(1) NOT NULL DEFAULT 0,
      pix_chave VARCHAR(500) NULL,
      banco VARCHAR(100) NULL,
      agencia VARCHAR(30) NULL,
      conta VARCHAR(40) NULL,
      receber_emails_cafe TINYINT(1) NOT NULL DEFAULT 1,
      criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_usuarios_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS capsulas (
      id INT NOT NULL AUTO_INCREMENT,
      nome VARCHAR(120) NOT NULL,
      descricao TEXT NULL,
      imagem_url VARCHAR(500) NULL,
      intensidade TINYINT UNSIGNED NULL,
      preco_atual DECIMAL(10,2) NOT NULL,
      tamanho_caixa INT NOT NULL DEFAULT 50,
      ativo TINYINT(1) NOT NULL DEFAULT 1,
      criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_capsulas_nome (nome)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS historico_precos (
      id INT NOT NULL AUTO_INCREMENT,
      capsula_id INT NOT NULL,
      preco DECIMAL(10,2) NOT NULL,
      alterado_por INT NULL,
      data_vigencia DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_hist_capsula (capsula_id),
      CONSTRAINT fk_hist_capsula FOREIGN KEY (capsula_id) REFERENCES capsulas (id) ON DELETE CASCADE,
      CONSTRAINT fk_hist_usuario FOREIGN KEY (alterado_por) REFERENCES usuarios (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rodadas_pedido (
      id INT NOT NULL AUTO_INCREMENT,
      titulo VARCHAR(150) NOT NULL,
      organizador_id INT NULL,
      sorteador_id INT NULL,
      status ENUM('ABERTO', 'FECHADO', 'COMPRADO', 'ENTREGUE', 'CANCELADO') NOT NULL DEFAULT 'ABERTO',
      data_abertura DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      data_fechamento DATETIME NULL,
      PRIMARY KEY (id),
      CONSTRAINT fk_rodadas_organizador FOREIGN KEY (organizador_id) REFERENCES usuarios (id) ON DELETE SET NULL,
      CONSTRAINT fk_rodadas_sorteador FOREIGN KEY (sorteador_id) REFERENCES usuarios (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS solicitacoes (
      id INT NOT NULL AUTO_INCREMENT,
      rodada_id INT NOT NULL,
      usuario_id INT NOT NULL,
      status_pagamento ENUM('PENDENTE', 'PAGO') NOT NULL DEFAULT 'PENDENTE',
      data_pagamento DATETIME NULL,
      cafezinhos_gorjeta TINYINT UNSIGNED NOT NULL DEFAULT 0,
      valor_gorjeta DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_solicitacao_rodada_usuario (rodada_id, usuario_id),
      CONSTRAINT fk_sol_rodada FOREIGN KEY (rodada_id) REFERENCES rodadas_pedido (id) ON DELETE CASCADE,
      CONSTRAINT fk_sol_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS itens_solicitacao (
      id INT NOT NULL AUTO_INCREMENT,
      solicitacao_id INT NOT NULL,
      capsula_id INT NOT NULL,
      quantidade INT NOT NULL,
      preco_unitario DECIMAL(10,2) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_item_sol_capsula (solicitacao_id, capsula_id),
      CONSTRAINT fk_item_sol FOREIGN KEY (solicitacao_id) REFERENCES solicitacoes (id) ON DELETE CASCADE,
      CONSTRAINT fk_item_capsula FOREIGN KEY (capsula_id) REFERENCES capsulas (id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
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
      CONSTRAINT fk_tokens_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
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
      CONSTRAINT fk_brindes_rodada FOREIGN KEY (rodada_id) REFERENCES rodadas_pedido (id) ON DELETE CASCADE,
      CONSTRAINT fk_brindes_vencedor FOREIGN KEY (vencedor_id) REFERENCES usuarios (id) ON DELETE SET NULL,
      CONSTRAINT fk_brindes_sorteado_por FOREIGN KEY (sorteado_por) REFERENCES usuarios (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS brinde_exclusoes (
      id INT NOT NULL AUTO_INCREMENT,
      brinde_id INT NOT NULL,
      usuario_id INT NOT NULL,
      criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_brinde_exclusao (brinde_id, usuario_id),
      CONSTRAINT fk_exclusao_brinde FOREIGN KEY (brinde_id) REFERENCES brindes_rodada (id) ON DELETE CASCADE,
      CONSTRAINT fk_exclusao_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Garante colunas incrementais em bancos ja existentes (HML/PROD no Railway)
  const [capCols] = await pool.execute(
    `SELECT COLUMN_NAME AS nome
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'capsulas'`,
    [dbName],
  );
  const capExistentes = new Set(
    (capCols as { nome: string }[]).map((c) => c.nome),
  );
  if (!capExistentes.has('intensidade')) {
    await pool.query(
      `ALTER TABLE capsulas ADD COLUMN intensidade TINYINT UNSIGNED NULL AFTER imagem_url`,
    );
    logger.log(`Coluna capsulas.intensidade adicionada (banco ${dbName}).`);
  }

  const [usrCols] = await pool.execute(
    `SELECT COLUMN_NAME AS nome
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usuarios'`,
    [dbName],
  );
  const usrExistentes = new Set(
    (usrCols as { nome: string }[]).map((c) => c.nome),
  );
  if (!usrExistentes.has('aprovado')) {
    await pool.query(
      `ALTER TABLE usuarios ADD COLUMN aprovado TINYINT(1) NOT NULL DEFAULT 1 AFTER email_verificado`,
    );
    logger.log(`Coluna usuarios.aprovado adicionada (banco ${dbName}).`);
  }
  if (!usrExistentes.has('receber_emails_cafe')) {
    await pool.query(
      `ALTER TABLE usuarios ADD COLUMN receber_emails_cafe TINYINT(1) NOT NULL DEFAULT 1 AFTER conta`,
    );
    logger.log(`Coluna usuarios.receber_emails_cafe adicionada (banco ${dbName}).`);
  }

  const [pixColRows] = await pool.execute(
    `SELECT CHARACTER_MAXIMUM_LENGTH AS tamanho
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usuarios' AND COLUMN_NAME = 'pix_chave'`,
    [dbName],
  );
  const pixTamanho = Number((pixColRows as { tamanho: number }[])[0]?.tamanho ?? 0);
  if (pixTamanho > 0 && pixTamanho < 500) {
    await pool.query(
      `ALTER TABLE usuarios MODIFY COLUMN pix_chave VARCHAR(500) NULL`,
    );
    logger.log(`Coluna usuarios.pix_chave ampliada para VARCHAR(500) (banco ${dbName}).`);
  }

  const [solCols] = await pool.execute(
    `SELECT COLUMN_NAME AS nome
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'solicitacoes'`,
    [dbName],
  );
  const solExistentes = new Set(
    (solCols as { nome: string }[]).map((c) => c.nome),
  );
  if (!solExistentes.has('cafezinhos_gorjeta')) {
    await pool.query(
      `ALTER TABLE solicitacoes ADD COLUMN cafezinhos_gorjeta TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER data_pagamento`,
    );
    logger.log(`Coluna solicitacoes.cafezinhos_gorjeta adicionada (banco ${dbName}).`);
  }
  if (!solExistentes.has('valor_gorjeta')) {
    await pool.query(
      `ALTER TABLE solicitacoes ADD COLUMN valor_gorjeta DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER cafezinhos_gorjeta`,
    );
    logger.log(`Coluna solicitacoes.valor_gorjeta adicionada (banco ${dbName}).`);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS configuracoes_sistema (
      chave VARCHAR(80) NOT NULL,
      valor TEXT NULL,
      atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (chave)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Cria o primeiro ADMIN automaticamente se INITIAL_ADMIN_EMAIL + INITIAL_ADMIN_PASSWORD estiverem no env
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPass = process.env.INITIAL_ADMIN_PASSWORD;
  const adminNome = process.env.INITIAL_ADMIN_NAME?.trim() || 'Administrador';
  if (adminEmail && adminPass && adminPass.length >= 8) {
    const [rows] = await pool.execute('SELECT id FROM usuarios WHERE email = ?', [
      adminEmail,
    ]);
    if ((rows as any[]).length === 0) {
      const hash = await argon2.hash(adminPass, { type: argon2.argon2id });
      await pool.execute(
        `INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo, email_verificado, deve_trocar_senha, criado_em, atualizado_em)
         VALUES (?, ?, ?, 'ADMIN', 1, 1, 0, NOW(), NOW())`,
        [adminNome, adminEmail, hash],
      );
      logger.log(`ADMIN inicial criado automaticamente: ${adminEmail} (banco ${dbName}).`);
    }
  }
}
