import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';

export interface SageQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
}

const FORBIDDEN_PATTERN =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|EXEC|EXECUTE|MERGE|GRANT|REVOKE)\b/i;

@Injectable()
export class SageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SageService.name);
  private pool: sql.ConnectionPool | null = null;

  private readonly config: sql.config;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      server: this.configService.getOrThrow<string>('SAGE_DB_SERVER'),
      port: parseInt(
        this.configService.get<string>('SAGE_DB_PORT', '1433'),
        10,
      ),
      database: this.configService.getOrThrow<string>('SAGE_DB_NAME'),
      user: this.configService.getOrThrow<string>('SAGE_DB_USER'),
      password: this.configService.getOrThrow<string>('SAGE_DB_PASSWORD'),
      requestTimeout:
        parseInt(this.configService.get<string>('SAGE_DB_TIMEOUT', '30'), 10) *
        1000,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
      pool: {
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
      },
    };
  }

  async onModuleInit() {
    try {
      this.pool = await new sql.ConnectionPool(this.config).connect();
      this.logger.log(
        `Connecté à SQL Server ${this.config.server}:${this.config.port}/${this.config.database}`,
      );
    } catch (error) {
      this.logger.error(
        `Impossible de se connecter à Sage X3: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.close();
      this.logger.log('Pool SQL Server fermé.');
    }
  }

  async testConnection(): Promise<{
    connected: boolean;
    server: string;
    database: string;
    version?: string;
    error?: string;
  }> {
    const info = {
      server: `${this.config.server}:${this.config.port}`,
      database: this.config.database ?? '',
    };

    if (!this.pool?.connected) {
      return { connected: false, ...info, error: 'Pool non connecté' };
    }

    try {
      const result = await this.pool
        .request()
        .query('SELECT @@VERSION AS version, GETDATE() AS serverTime');
      const row = result.recordset[0];
      return {
        connected: true,
        ...info,
        version: (row?.version as string)?.split('\n')[0],
      };
    } catch (error) {
      return {
        connected: false,
        ...info,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async query(sqlText: string): Promise<SageQueryResult> {
    this.validateSql(sqlText);

    if (!this.pool?.connected) {
      throw new BadRequestException('Connexion à Sage X3 indisponible.');
    }

    const result = await this.pool.request().query(sqlText);

    const columns = result.recordset.columns
      ? Object.keys(result.recordset.columns)
      : result.recordset.length > 0
        ? Object.keys(result.recordset[0])
        : [];

    return {
      columns,
      rows: result.recordset,
      total: result.recordset.length,
    };
  }

  private validateSql(sqlText: string): void {
    const trimmed = sqlText.trim();

    if (!trimmed.toUpperCase().startsWith('SELECT')) {
      throw new BadRequestException(
        'Seules les requêtes SELECT sont autorisées.',
      );
    }

    if (FORBIDDEN_PATTERN.test(trimmed)) {
      throw new BadRequestException(
        'La requête contient des instructions non autorisées.',
      );
    }
  }
}
