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

  async create(dto: CreateQueryDto, user: AuthenticatedUser) {
    return this.prisma.query.create({
      data: {
        ...dto,
        createdById: user.id,
      },
      include: {
        sector: true,
        createdBy: { select: { id: true, username: true } },
      },
    });
  }

  async findAll(user: AuthenticatedUser) {
    const where = await this.queryAccess.buildAccessibleQueryWhere(user);

    return this.prisma.query.findMany({
      where,
      include: {
        sector: true,
        createdBy: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const query = await this.prisma.query.findUnique({
      where: { id },
      include: {
        sector: true,
        createdBy: { select: { id: true, username: true } },
        groups: {
          include: { group: { select: { id: true, name: true } } },
        },
      },
    });

    if (!query) {
      throw new NotFoundException('Requête introuvable.');
    }

    await this.queryAccess.assertCanAccess(user, query);

    return query;
  }

  async update(id: string, dto: UpdateQueryDto, user: AuthenticatedUser) {
    if (!this.queryAccess.isAdmin(user)) {
      throw new ForbiddenException(
        'Seul un administrateur peut modifier une requête.',
      );
    }

    const query = await this.prisma.query.findUnique({ where: { id } });

    if (!query) {
      throw new NotFoundException('Requête introuvable.');
    }

    return this.prisma.query.update({
      where: { id },
      data: dto,
      include: {
        sector: true,
        createdBy: { select: { id: true, username: true } },
        groups: {
          include: { group: { select: { id: true, name: true } } },
        },
      },
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    if (!this.queryAccess.isAdmin(user)) {
      throw new ForbiddenException(
        'Seul un administrateur peut supprimer une requête.',
      );
    }

    const query = await this.prisma.query.findUnique({ where: { id } });

    if (!query) {
      throw new NotFoundException('Requête introuvable.');
    }

    return this.prisma.query.delete({ where: { id } });
  }
}
