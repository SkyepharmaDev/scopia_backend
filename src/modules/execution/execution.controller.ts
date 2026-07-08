import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { QueriesService } from '../queries/queries.service';
import { QueryAccessService } from '../queries/query-access.service';
import { ExecutionService } from './execution.service';
import { SageService } from './sage.service';
import { RunQueryDto } from './dto/run-query.dto';

@Controller('execution')
export class ExecutionController {
  constructor(
    private readonly executionService: ExecutionService,
    private readonly queriesService: QueriesService,
    private readonly queryAccess: QueryAccessService,
    private readonly sageService: SageService,
  ) {}

  @Get('health')
  health() {
    return this.sageService.testConnection();
  }

  @Post('run')
  async run(@Body() dto: RunQueryDto, @CurrentUser() user: AuthenticatedUser) {
    await this.queryAccess.assertCanAuthor(user);
    return this.executionService.execute(dto.sqlContent);
  }

  @Get(':queryId')
  async execute(
    @Param('queryId') queryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const query = await this.queriesService.findOneRaw(queryId, user);
    return this.executionService.execute(query.sqlContent);
  }
}
