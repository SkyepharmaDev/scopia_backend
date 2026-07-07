import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { QueriesService } from '../queries/queries.service';
import { ExecutionService } from './execution.service';
import { SageService } from './sage.service';
import { RunQueryDto } from './dto/run-query.dto';

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

  @Roles('ADMIN')
  @Post('run')
  run(@Body() dto: RunQueryDto) {
    return this.executionService.execute(dto.sqlContent);
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
