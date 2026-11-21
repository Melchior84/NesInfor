/**
 * Aplica de forma idempotente as alteracoes de schema da migration 001
 * (confirmacao de e-mail, recuperacao de senha e troca obrigatoria de senha).
 *
 *   npm run migrate
 */
import 'dotenv/config';
import { createConnection } from 'mysql2/promise';

async function main() {
  const dbName = process.env.DB_NAME ?? 'nespresso_coletivo';
  const conn = await createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: dbName,
  });

  try {
    const [cols] = await conn.execute(
      `SELECT COLUMN_NAME AS nome
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'usuarios'`,
      [dbName],
    );
    const existentes = new Set((cols as { nome: string }[]).map((c) => c.nome));

    if (!existentes.has('email_verificado')) {
      await conn.execute(
        `ALTER TABLE usuarios
           ADD COLUMN email_verificado TINYINT(1) NOT NULL DEFAULT 1 AFTER ativo`,
      );
      console.log('Coluna usuarios.email_verificado adicionada.');
    }

    if (!existentes.has('deve_trocar_senha')) {
      await conn.execute(
        `ALTER TABLE usuarios
           ADD COLUMN deve_trocar_senha TINYINT(1) NOT NULL DEFAULT 0 AFTER email_verificado`,
      );
      console.log('Coluna usuarios.deve_trocar_senha adicionada.');
    }

    await conn.execute(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('Tabela tokens_autenticacao verificada/criada.');

    const [capCols] = await conn.execute(
      `SELECT COLUMN_NAME AS nome
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'capsulas'`,
      [dbName],
    );
    const capExistentes = new Set(
      (capCols as { nome: string }[]).map((c) => c.nome),
    );

    if (!capExistentes.has('descricao')) {
      await conn.execute(
        `ALTER TABLE capsulas ADD COLUMN descricao TEXT NULL AFTER nome`,
      );
      console.log('Coluna capsulas.descricao adicionada.');
    }

    if (!capExistentes.has('imagem_url')) {
      await conn.execute(
        `ALTER TABLE capsulas ADD COLUMN imagem_url VARCHAR(500) NULL AFTER descricao`,
      );
      console.log('Coluna capsulas.imagem_url adicionada.');
    }

    const pagamentoCols: [string, string][] = [
      ['pix_chave', 'VARCHAR(180) NULL'],
      ['banco', 'VARCHAR(100) NULL'],
      ['agencia', 'VARCHAR(30) NULL'],
      ['conta', 'VARCHAR(40) NULL'],
    ];
    for (const [col, def] of pagamentoCols) {
      if (!existentes.has(col)) {
        await conn.execute(`ALTER TABLE usuarios ADD COLUMN ${col} ${def}`);
        console.log(`Coluna usuarios.${col} adicionada.`);
      }
    }

    const [rodCols] = await conn.execute(
      `SELECT COLUMN_NAME AS nome
         FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'rodadas_pedido'`,
      [dbName],
    );
    const rodExistentes = new Set(
      (rodCols as { nome: string }[]).map((c) => c.nome),
    );

    if (!rodExistentes.has('sorteador_id')) {
      await conn.execute(
        `ALTER TABLE rodadas_pedido
           ADD COLUMN sorteador_id INT NULL AFTER organizador_id,
           ADD CONSTRAINT fk_rodadas_sorteador
             FOREIGN KEY (sorteador_id) REFERENCES usuarios (id)
             ON DELETE SET NULL`,
      );
      console.log('Coluna rodadas_pedido.sorteador_id adicionada.');
    }

    await conn.execute(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('Tabela brindes_rodada verificada/criada.');

    await conn.execute(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('Tabela brinde_exclusoes verificada/criada.');

    console.log('Migrations concluidas com sucesso.');
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
