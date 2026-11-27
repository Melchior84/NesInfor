import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPool, Pool } from 'mysql2/promise';
import { DatabaseService } from './database.service';

export interface ContaCompartilhada {
  id: number;
  nome: string;
  email: string;
  senha_hash: string;
  ativo: number;
  email_verificado: number;
  deve_trocar_senha: number;
  tema: 'claro' | 'escuro';
}

/**
 * Conexao opcional ao Banco de Contas compartilhado (Studios Melk Auth)
 * via AUTH_DATABASE_URL (ou AUTH_DB_*).
 *
 * - Quando NAO configurado: opera em modo desativado (Cafezinho usa apenas seu banco local).
 * - Quando configurado: cria a tabela `contas`, migra automaticamente os usuarios
 *   existentes do Cafezinho (INSERT IGNORE, sem apagar nada) e sincroniza login,
 *   cadastro, troca de senha e tema entre todos os sites Studios Melk.
 */
@Injectable()
export class AuthDbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthDbService.name);
  private readonly pool: Pool | null;
  readonly habilitado: boolean;

  constructor(
    config: ConfigService,
    private readonly localDb: DatabaseService,
  ) {
    const url = config.get<string>('AUTH_DATABASE_URL')?.trim();
    const host = config.get<string>('AUTH_DB_HOST')?.trim();

    if (url) {
      const parsed = new URL(url);
      this.habilitado = true;
      this.pool = createPool({
        host: parsed.hostname,
        port: Number(parsed.port || 3306),
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database: parsed.pathname.replace(/^\//, '') || 'railway',
        waitForConnections: true,
        connectionLimit: Number(config.get('AUTH_DB_POOL_SIZE', 5)),
        queueLimit: 0,
        decimalNumbers: true,
        timezone: 'local',
      });
    } else if (host) {
      this.habilitado = true;
      this.pool = createPool({
        host,
        port: Number(config.get('AUTH_DB_PORT', 3306)),
        user: config.get<string>('AUTH_DB_USER'),
        password: config.get<string>('AUTH_DB_PASSWORD'),
        database: config.get<string>('AUTH_DB_NAME', 'studios_melk_auth'),
        waitForConnections: true,
        connectionLimit: Number(config.get('AUTH_DB_POOL_SIZE', 5)),
        queueLimit: 0,
        decimalNumbers: true,
        timezone: 'local',
      });
    } else {
      this.habilitado = false;
      this.pool = null;
    }
  }

  async onModuleInit(): Promise<void> {
    if (!this.pool) {
      this.logger.log(
        'AUTH_DATABASE_URL nao definida: usando apenas tabela local usuarios.',
      );
      return;
    }

    await this.pool.query('SELECT 1');
    await this.garantirSchema();
    await this.migrarUsuariosLocaisExistentes();
    this.logger.log('Conexao com Banco de Contas compartilhado estabelecida.');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }

  private async garantirSchema(): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS contas (
        id INT NOT NULL AUTO_INCREMENT,
        nome VARCHAR(120) NOT NULL,
        email VARCHAR(180) NOT NULL,
        senha_hash VARCHAR(255) NOT NULL,
        ativo TINYINT(1) NOT NULL DEFAULT 1,
        email_verificado TINYINT(1) NOT NULL DEFAULT 0,
        deve_trocar_senha TINYINT(1) NOT NULL DEFAULT 0,
        tema ENUM('claro', 'escuro') NOT NULL DEFAULT 'claro',
        criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_contas_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  /**
   * Garante que todos os usuarios ja cadastrados no Cafezinho Infor
   * existam no Banco de Contas compartilhado (idempotente via INSERT IGNORE).
   */
  private async migrarUsuariosLocaisExistentes(): Promise<void> {
    if (!this.pool) return;
    const locais = await this.localDb.query<{
      nome: string;
      email: string;
      senha_hash: string;
      ativo: number;
      email_verificado: number;
      deve_trocar_senha: number;
      tema: 'claro' | 'escuro' | null;
      criado_em: Date;
    }>(
      `SELECT nome, email, senha_hash, ativo, email_verificado,
              deve_trocar_senha, tema, criado_em
         FROM usuarios`,
    );

    let migrados = 0;
    for (const u of locais) {
      const [res] = await this.pool.execute(
        `INSERT IGNORE INTO contas
          (nome, email, senha_hash, ativo, email_verificado, deve_trocar_senha, tema, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          u.nome,
          u.email.trim().toLowerCase(),
          u.senha_hash,
          u.ativo ? 1 : 0,
          u.email_verificado ? 1 : 0,
          u.deve_trocar_senha ? 1 : 0,
          u.tema === 'escuro' ? 'escuro' : 'claro',
          u.criado_em,
        ],
      );
      if ((res as { affectedRows?: number }).affectedRows) migrados++;
    }
    if (migrados > 0) {
      this.logger.log(
        `${migrados} usuario(s) existentes do Cafezinho migrados para o Banco de Contas compartilhado.`,
      );
    }
  }

  async buscarPorEmail(email: string): Promise<ContaCompartilhada | null> {
    if (!this.pool) return null;
    const [rows] = await this.pool.execute(
      `SELECT id, nome, email, senha_hash, ativo, email_verificado, deve_trocar_senha, tema
         FROM contas WHERE email = ?`,
      [email.trim().toLowerCase()],
    );
    const lista = rows as ContaCompartilhada[];
    return lista[0] ?? null;
  }

  async criarOuSincronizarConta(dados: {
    nome: string;
    email: string;
    senhaHash: string;
    emailVerificado: boolean;
    tema?: 'claro' | 'escuro';
  }): Promise<void> {
    if (!this.pool) return;
    await this.pool.execute(
      `INSERT IGNORE INTO contas
        (nome, email, senha_hash, ativo, email_verificado, deve_trocar_senha, tema, criado_em, atualizado_em)
       VALUES (?, ?, ?, 1, ?, 0, ?, NOW(), NOW())`,
      [
        dados.nome.trim(),
        dados.email.trim().toLowerCase(),
        dados.senhaHash,
        dados.emailVerificado ? 1 : 0,
        dados.tema === 'escuro' ? 'escuro' : 'claro',
      ],
    );
  }

  async atualizarSenha(
    email: string,
    senhaHash: string,
    deveTrocarSenha: boolean,
    marcarEmailVerificado = false,
  ): Promise<void> {
    if (!this.pool) return;
    await this.pool.execute(
      `UPDATE contas
          SET senha_hash = ?,
              deve_trocar_senha = ?,
              ${marcarEmailVerificado ? 'email_verificado = 1,' : ''}
              atualizado_em = NOW()
        WHERE email = ?`,
      [senhaHash, deveTrocarSenha ? 1 : 0, email.trim().toLowerCase()],
    );
  }

  async marcarEmailVerificado(email: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.execute(
      `UPDATE contas SET email_verificado = 1, atualizado_em = NOW() WHERE email = ?`,
      [email.trim().toLowerCase()],
    );
  }

  async atualizarTema(email: string, tema: 'claro' | 'escuro'): Promise<void> {
    if (!this.pool) return;
    await this.pool.execute(
      `UPDATE contas SET tema = ?, atualizado_em = NOW() WHERE email = ?`,
      [tema, email.trim().toLowerCase()],
    );
  }
}
