import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type';

export type QueryForAccessCheck = {
  visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC';
  groups?: { groupId: string }[];
};

@Injectable()
export class QueryAccessService {
  constructor(private readonly prisma: PrismaService) {}

  isAdmin(user: AuthenticatedUser): boolean {
    return user.role === 'ADMIN';
  }

  async getUserGroupIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.userGroup.findMany({
      where: { userId },
      select: { groupId: true },
    });
    return memberships.map((m) => m.groupId);
  }

  canAccess(
    user: AuthenticatedUser,
    query: QueryForAccessCheck,
    userGroupIds: string[],
  ): boolean {
    if (this.isAdmin(user)) {
      return true;
    }

    if (query.visibility === 'PUBLIC') {
      return true;
    }

    if (query.visibility === 'SHARED') {
      const queryGroupIds = query.groups?.map((g) => g.groupId) ?? [];
      return queryGroupIds.some((id) => userGroupIds.includes(id));
    }

    return false;
  }

  async assertCanAccess(
    user: AuthenticatedUser,
    query: QueryForAccessCheck,
  ): Promise<void> {
    const userGroupIds = this.isAdmin(user)
      ? []
      : await this.getUserGroupIds(user.id);

    if (!this.canAccess(user, query, userGroupIds)) {
      throw new ForbiddenException('Accès refusé.');
    }
  }

  async buildAccessibleQueryWhere(
    user: AuthenticatedUser,
  ): Promise<Prisma.QueryWhereInput> {
    if (this.isAdmin(user)) {
      return {};
    }

    const groupIds = await this.getUserGroupIds(user.id);

    return {
      OR: [
        { visibility: 'PUBLIC' },
        {
          visibility: 'SHARED',
          groups: { some: { groupId: { in: groupIds } } },
        },
      ],
    };
  }

  async buildAccessibleFavoriteWhere(
    user: AuthenticatedUser,
  ): Promise<Prisma.FavoriteWhereInput> {
    return {
      userId: user.id,
      query: await this.buildAccessibleQueryWhere(user),
    };
  }
}
