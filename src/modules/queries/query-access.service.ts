import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type';

export type QueryForAccessCheck = {
  visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC';
  ownerGroupId?: string | null;
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

  /** Groupes dans lesquels l'utilisateur a la capacité d'édition (canEdit). */
  async getUserEditableGroupIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.userGroup.findMany({
      where: { userId, canEdit: true },
      select: { groupId: true },
    });
    return memberships.map((m) => m.groupId);
  }

  /**
   * Peut créer/tester des requêtes SQL : ADMIN, ou membre-éditeur d'au moins
   * un groupe. Le statut « éditeur » découle uniquement de l'appartenance.
   */
  async canAuthor(user: AuthenticatedUser): Promise<boolean> {
    if (this.isAdmin(user)) {
      return true;
    }

    const count = await this.prisma.userGroup.count({
      where: { userId: user.id, canEdit: true },
    });
    return count > 0;
  }

  async assertCanAuthor(user: AuthenticatedUser): Promise<void> {
    if (!(await this.canAuthor(user))) {
      throw new ForbiddenException(
        "Vous n'êtes membre-éditeur d'aucun groupe.",
      );
    }
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

    // Membre du groupe propriétaire : accès quelle que soit la visibilité
    if (query.ownerGroupId && userGroupIds.includes(query.ownerGroupId)) {
      return true;
    }

    if (query.visibility === 'SHARED') {
      const queryGroupIds = query.groups?.map((g) => g.groupId) ?? [];
      return queryGroupIds.some((id) => userGroupIds.includes(id));
    }

    return false;
  }

  /**
   * Droit d'édition d'une requête : ADMIN partout, sinon uniquement si la
   * requête appartient à un groupe où l'utilisateur est membre-éditeur.
   */
  canEdit(
    user: AuthenticatedUser,
    query: QueryForAccessCheck,
    editableGroupIds: string[],
  ): boolean {
    if (this.isAdmin(user)) {
      return true;
    }

    return (
      !!query.ownerGroupId && editableGroupIds.includes(query.ownerGroupId)
    );
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

  async assertCanEdit(
    user: AuthenticatedUser,
    query: QueryForAccessCheck,
  ): Promise<void> {
    const editableGroupIds = this.isAdmin(user)
      ? []
      : await this.getUserEditableGroupIds(user.id);

    if (!this.canEdit(user, query, editableGroupIds)) {
      throw new ForbiddenException(
        "Vous n'avez pas le droit de modifier cette requête.",
      );
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
        { ownerGroupId: { in: groupIds } },
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
