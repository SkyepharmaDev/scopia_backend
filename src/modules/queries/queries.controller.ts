import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { QueriesService } from './queries.service';
import { CreateQueryDto } from './dto/create-query.dto';
import { UpdateQueryDto } from './dto/update-query.dto';

@Controller('queries')
export class QueriesController {
  constructor(private readonly queriesService: QueriesService) {}

  @Post()
  create(@Body() dto: CreateQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.queriesService.create(dto, user);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.queriesService.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.queriesService.findOne(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.queriesService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.queriesService.remove(id, user);
  }
}
