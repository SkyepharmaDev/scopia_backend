import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { FavoritesService } from './favorites.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  add(
    @Body() dto: CreateFavoriteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.favoritesService.add(user, dto.queryId);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.favoritesService.findAllForUser(user);
  }

  @Delete(':queryId')
  remove(
    @Param('queryId') queryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.favoritesService.remove(user, queryId);
  }
}
