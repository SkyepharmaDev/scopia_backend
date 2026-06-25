import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { QueryAccessService } from '../queries/query-access.service';

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryAccess: QueryAccessService,
  ) {}

  async add(user: AuthenticatedUser, queryId: string) {
    const query = await this.prisma.query.findUnique({
      where: { id: queryId },
      include: { groups: { select: { groupId: true } } },
    });

    if (!query) {
      throw new NotFoundException('Requête introuvable.');
    }

    await this.queryAccess.assertCanAccess(user, query);

    const existing = await this.prisma.favorite.findUnique({
      where: { userId_queryId: { userId: user.id, queryId } },
    });
    if (existing) {
      throw new ConflictException('Déjà en favoris.');
    }

    return this.prisma.favorite.create({
      data: { userId: user.id, queryId },
      include: { query: { include: { sector: true } } },
    });
  }

  async findAllForUser(user: AuthenticatedUser) {
    const where = await this.queryAccess.buildAccessibleFavoriteWhere(user);

    return this.prisma.favorite.findMany({
      where,
      include: {
        query: {
          include: {
            sector: true,
            createdBy: { select: { id: true, username: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(user: AuthenticatedUser, queryId: string) {
    const existing = await this.prisma.favorite.findUnique({
      where: { userId_queryId: { userId: user.id, queryId } },
    });
    if (!existing) {
      throw new NotFoundException('Favori introuvable.');
    }

    return this.prisma.favorite.delete({
      where: { userId_queryId: { userId: user.id, queryId } },
    });
  }
}
