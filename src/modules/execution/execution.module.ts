import { Module } from '@nestjs/common';
import { QueriesModule } from '../queries/queries.module';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';
import { SageService } from './sage.service';

@Module({
  imports: [QueriesModule],
  controllers: [ExecutionController],
  providers: [ExecutionService, SageService],
})
export class ExecutionModule {}
