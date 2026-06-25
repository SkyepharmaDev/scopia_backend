import { Injectable, Logger } from '@nestjs/common';
import { SageService } from './sage.service';

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  constructor(private readonly sageService: SageService) {}

  async execute(sqlContent: string) {
    this.logger.debug('Exécution requête Sage');

    const result = await this.sageService.query(sqlContent);

    return {
      columns: result.columns,
      rows: result.rows,
      total: result.total,
    };
  }
}
