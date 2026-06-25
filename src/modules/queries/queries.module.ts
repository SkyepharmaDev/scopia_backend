import { Module } from '@nestjs/common';
import { QueriesService } from './queries.service';
import { QueriesController } from './queries.controller';
import { QueryAccessService } from './query-access.service';

@Module({
  controllers: [QueriesController],
  providers: [QueriesService, QueryAccessService],
  exports: [QueriesService, QueryAccessService],
})
export class QueriesModule {}
