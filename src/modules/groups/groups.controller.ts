import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AssignMemberDto, AssignQueryDto } from './dto/assign-member.dto';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Roles('ADMIN')
  @Post()
  create(@Body() dto: CreateGroupDto) {
    return this.groupsService.create(dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.groupsService.findAll(user);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.groupsService.findOne(id, user);
  }

  @Roles('ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groupsService.update(id, dto);
  }

  @Roles('ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.groupsService.remove(id);
  }

  @Roles('ADMIN')
  @Post(':id/users')
  addUser(@Param('id') id: string, @Body() dto: AssignMemberDto) {
    return this.groupsService.addUser(id, dto.userId);
  }

  @Roles('ADMIN')
  @Delete(':id/users/:userId')
  removeUser(@Param('id') id: string, @Param('userId') userId: string) {
    return this.groupsService.removeUser(id, userId);
  }

  @Roles('ADMIN')
  @Post(':id/queries')
  addQuery(@Param('id') id: string, @Body() dto: AssignQueryDto) {
    return this.groupsService.addQuery(id, dto.queryId);
  }

  @Roles('ADMIN')
  @Delete(':id/queries/:queryId')
  removeQuery(@Param('id') id: string, @Param('queryId') queryId: string) {
    return this.groupsService.removeQuery(id, queryId);
  }
}
