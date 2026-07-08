import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { CreateQueryDto } from './dto/create-query.dto';
import { UpdateQueryDto } from './dto/update-query.dto';
import { QueryAccessService } from './query-access.service';

@Injectable()
export class QueriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryAccess: QueryAccessService,
  ) {}

  private readonly detailInclude = {
    sector: true,
    createdBy: { select: { id: true, username: true } },
    ownerGroup: { select: { id: true, name: true } },
    groups: {
      include: { group: { select: { id: true, name: true } } },
    },
  } as const;

  /**
   * Ajoute le flag `canEdit` pour l'utilisateur courant et masque le SQL
   * des requêtes qu'il ne peut pas éditer (SQL réservé aux éditeurs/admins).
   */
  private annotate<
    T extends {
      sqlContent: string;
      ownerGroupId: string | null;
      visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC';
      groups?: { groupId: string }[];
    },
  >(
    query: T,
    user: AuthenticatedUser,
    editableGroupIds: string[],
  ): T & { canEdit: boolean } {
    const canEdit = this.queryAccess.canEdit(user, query, editableGroupIds);
    return {
      ...query,
      canEdit,
      sqlContent: canEdit ? query.sqlContent : '',
    };
  }

  async create(dto: CreateQueryDto, user: AuthenticatedUser) {
    const isAdmin = this.queryAccess.isAdmin(user);
    const ownerGroupId = dto.ownerGroupId ?? null;

    if (!isAdmin) {
      if (!ownerGroupId) {
        throw new ForbiddenException(
          'Un groupe propriétaire est requis pour créer une requête.',
        );
      }

      const editableGroupIds = await this.queryAccess.getUserEditableGroupIds(
        user.id,
      );
      if (!editableGroupIds.includes(ownerGroupId)) {
        throw new ForbiddenException(
          "Vous ne pouvez créer une requête que pour un groupe dont vous êtes membre-éditeur.",
        );
      }

      if (dto.visibility === 'PUBLIC') {
        throw new ForbiddenException(
          'Seul un administrateur peut publier une requête PUBLIC.',
        );
      }
    }

    const created = await this.prisma.query.create({
      data: {
        ...dto,
        ownerGroupId,
        createdById: user.id,
      },
      include: this.detailInclude,
    });

    const editableGroupIds = isAdmin
      ? []
      : await this.queryAccess.getUserEditableGroupIds(user.id);

    return this.annotate(created, user, editableGroupIds);
  }

  async findAll(user: AuthenticatedUser) {
    const where = await this.queryAccess.buildAccessibleQueryWhere(user);

    const queries = await this.prisma.query.findMany({
      where,
      include: {
        sector: true,
        createdBy: { select: { id: true, username: true } },
        ownerGroup: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const editableGroupIds = this.queryAccess.isAdmin(user)
      ? []
      : await this.queryAccess.getUserEditableGroupIds(user.id);

    return queries.map((query) =>
      this.annotate(query, user, editableGroupIds),
    );
  }

  /** Récupère une requête complète (SQL inclus) après contrôle d'accès en lecture. */
  async findOneRaw(id: string, user: AuthenticatedUser) {
    const query = await this.prisma.query.findUnique({
      where: { id },
      include: this.detailInclude,
    });

    if (!query) {
      throw new NotFoundException('Requête introuvable.');
    }

    await this.queryAccess.assertCanAccess(user, query);

    return query;
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const query = await this.findOneRaw(id, user);

    const editableGroupIds = this.queryAccess.isAdmin(user)
      ? []
      : await this.queryAccess.getUserEditableGroupIds(user.id);

    return this.annotate(query, user, editableGroupIds);
  }

  async update(id: string, dto: UpdateQueryDto, user: AuthenticatedUser) {
    const query = await this.prisma.query.findUnique({ where: { id } });

    if (!query) {
      throw new NotFoundException('Requête introuvable.');
    }

    await this.queryAccess.assertCanEdit(user, query);

    const isAdmin = this.queryAccess.isAdmin(user);

    if (!isAdmin) {
      if (dto.visibility === 'PUBLIC') {
        throw new ForbiddenException(
          'Seul un administrateur peut publier une requête PUBLIC.',
        );
      }

      if (dto.ownerGroupId !== undefined && dto.ownerGroupId !== null) {
        const editableGroupIds =
          await this.queryAccess.getUserEditableGroupIds(user.id);
        if (!editableGroupIds.includes(dto.ownerGroupId)) {
          throw new ForbiddenException(
            "Vous ne pouvez rattacher la requête qu'à un groupe dont vous êtes membre-éditeur.",
          );
        }
      }
    }

    const updated = await this.prisma.query.update({
      where: { id },
      data: dto,
      include: this.detailInclude,
    });

    const editableGroupIds = isAdmin
      ? []
      : await this.queryAccess.getUserEditableGroupIds(user.id);

    return this.annotate(updated, user, editableGroupIds);
  }

  async remove(id: string, user: AuthenticatedUser) {
    const query = await this.prisma.query.findUnique({ where: { id } });

    if (!query) {
      throw new NotFoundException('Requête introuvable.');
    }

    await this.queryAccess.assertCanEdit(user, query);

    return this.prisma.query.delete({ where: { id } });
  }
}
