import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPool,
  Pool,
  PoolConnection,
  ResultSetHeader,
} from 'mysql2/promise';

/** Executa SQL parametrizado (pool ou conexao de transacao). */
export interface SqlExecutor {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<ResultSetHeader>;
}

function criarExecutor(alvo: Pool | PoolConnection): SqlExecutor {
  return {
    async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
      const [rows] = await alvo.execute(sql, params);
      return rows as T[];
    },
    async execute(sql: string, params: any[] = []): Promise<ResultSetHeader> {
      const [result] = await alvo.execute(sql, params);
      return result as ResultSetHeader;
    },
  };
}

@Injectable()
export class DatabaseService
  implements SqlExecutor, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;
  private readonly executor: SqlExecutor;

  constructor(config: ConfigService) {
    this.pool = createPool({
      host: config.get<string>('DB_HOST', 'localhost'),
      port: Number(config.get('DB_PORT', 3306)),
      user: config.get<string>('DB_USER'),
      password: config.get<string>('DB_PASSWORD'),
      database: config.get<string>('DB_NAME', 'nespresso_coletivo'),
      waitForConnections: true,
      connectionLimit: Number(config.get('DB_POOL_SIZE', 10)),
      queueLimit: 0,
      // DECIMAL vem como number (e nao string) no retorno
      decimalNumbers: true,
      timezone: 'local',
    });
    this.executor = criarExecutor(this.pool);
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query('SELECT 1');
    this.logger.log('Conexao com o MySQL estabelecida.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return this.executor.query<T>(sql, params);
  }

  execute(sql: string, params: any[] = []): Promise<ResultSetHeader> {
    return this.executor.execute(sql, params);
  }

  /** Executa o callback dentro de uma transacao (commit/rollback automaticos). */
  async transaction<T>(callback: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const resultado = await callback(criarExecutor(conn));
      await conn.commit();
      return resultado;
    } catch (erro) {
      await conn.rollback();
      throw erro;
    } finally {
      conn.release();
    }
  }
}

/** Verifica violacao de UNIQUE do MySQL. */
export function isDuplicateEntry(erro: unknown): boolean {
  return (erro as { code?: string })?.code === 'ER_DUP_ENTRY';
}
