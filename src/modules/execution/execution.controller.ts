import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { QueriesService } from '../queries/queries.service';
import { ExecutionService } from './execution.service';
import { SageService } from './sage.service';

@Controller('execution')
export class ExecutionController {
  constructor(
    private readonly executionService: ExecutionService,
    private readonly queriesService: QueriesService,
    private readonly sageService: SageService,
  ) {}

  @Get('health')
  health() {
    return this.sageService.testConnection();
  }

  @Get(':queryId')
  async execute(
    @Param('queryId') queryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const query = await this.queriesService.findOne(queryId, user);
    return this.executionService.execute(query.sqlContent);
  }
}
