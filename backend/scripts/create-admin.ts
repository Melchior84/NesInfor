/**
 * Promove um usuario existente a ADMIN (ou cria um ADMIN novo).
 *
 *   npm run create-admin -- email@empresa.com
 *   npm run create-admin -- email@empresa.com "Nome Completo" "SenhaForte123"
 */
import * as argon2 from 'argon2';
import 'dotenv/config';
import { createConnection } from 'mysql2/promise';

async function main() {
  const [emailArg, nome, senha] = process.argv.slice(2);
  if (!emailArg) {
    console.error('Uso: npm run create-admin -- <email> [nome] [senha]');
    process.exit(1);
  }
  const email = emailArg.trim().toLowerCase();

  const conn = await createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME ?? 'nespresso_coletivo',
  });

  try {
    const [rows] = await conn.execute('SELECT id FROM usuarios WHERE email = ?', [email]);
    if ((rows as any[]).length) {
      await conn.execute(
        "UPDATE usuarios SET perfil = 'ADMIN', ativo = 1, email_verificado = 1, atualizado_em = NOW() WHERE email = ?",
        [email],
      );
      console.log(`Usuario ${email} promovido a ADMIN.`);
      return;
    }

    if (!nome || !senha) {
      console.error('Usuario nao existe. Informe tambem nome e senha para cria-lo.');
      process.exit(1);
    }
    if (senha.length < 8) {
      console.error('A senha deve ter ao menos 8 caracteres.');
      process.exit(1);
    }
    const hash = await argon2.hash(senha, { type: argon2.argon2id });
    await conn.execute(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo, criado_em, atualizado_em)
       VALUES (?, ?, ?, 'ADMIN', 1, NOW(), NOW())`,
      [nome, email, hash],
    );
    console.log(`ADMIN ${email} criado.`);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
