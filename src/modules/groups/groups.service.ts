import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly includeMembers = {
    users: {
      include: {
        user: {
          select: { id: true, username: true, firstName: true, lastName: true },
        },
      },
    },
    queries: { include: { query: { select: { id: true, name: true } } } },
  } as const;

  private isAdmin(user: AuthenticatedUser): boolean {
    return user.role === 'ADMIN';
  }

  private accessibleGroupWhere(
    user: AuthenticatedUser,
  ): Prisma.GroupWhereInput | undefined {
    if (this.isAdmin(user)) {
      return undefined;
    }

    return {
      users: { some: { userId: user.id } },
    };
  }

  private async assertCanViewGroup(
    user: AuthenticatedUser,
    groupId: string,
  ): Promise<void> {
    if (this.isAdmin(user)) {
      return;
    }

    const membership = await this.prisma.userGroup.findUnique({
      where: { userId_groupId: { userId: user.id, groupId } },
    });

    if (!membership) {
      throw new ForbiddenException('Accès refusé à ce groupe.');
    }
  }

  private async findGroupOrThrow(id: string) {
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: this.includeMembers,
    });
    if (!group) {
      throw new NotFoundException('Groupe introuvable.');
    }
    return group;
  }

  async create(dto: CreateGroupDto) {
    const existing = await this.prisma.group.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Le groupe '${dto.name}' existe déjà.`);
    }

    return this.prisma.group.create({ data: dto });
  }

  async findAll(user: AuthenticatedUser) {
    const accessWhere = this.accessibleGroupWhere(user);

    return this.prisma.group.findMany({
      where: accessWhere,
      include: this.includeMembers,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    await this.assertCanViewGroup(user, id);
    return this.findGroupOrThrow(id);
  }

  async update(id: string, dto: UpdateGroupDto) {
    await this.findGroupOrThrow(id);
    return this.prisma.group.update({
      where: { id },
      data: dto,
      include: this.includeMembers,
    });
  }

  async remove(id: string) {
    await this.findGroupOrThrow(id);
    return this.prisma.group.delete({ where: { id } });
  }

  async addUser(groupId: string, userId: string, canEdit = false) {
    await this.findGroupOrThrow(groupId);
    try {
      return await this.prisma.userGroup.create({
        data: { groupId, userId, canEdit },
      });
    } catch {
      throw new ConflictException('Cet utilisateur est déjà dans le groupe.');
    }
  }

  async setMemberCanEdit(groupId: string, userId: string, canEdit: boolean) {
    const membership = await this.prisma.userGroup.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!membership) {
      throw new NotFoundException("L'utilisateur n'est pas dans ce groupe.");
    }
    return this.prisma.userGroup.update({
      where: { userId_groupId: { userId, groupId } },
      data: { canEdit },
    });
  }

  async removeUser(groupId: string, userId: string) {
    const membership = await this.prisma.userGroup.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!membership) {
      throw new NotFoundException("L'utilisateur n'est pas dans ce groupe.");
    }
    return this.prisma.userGroup.delete({
      where: { userId_groupId: { userId, groupId } },
    });
  }

  async addQuery(groupId: string, queryId: string) {
    await this.findGroupOrThrow(groupId);
    try {
      return await this.prisma.queryGroup.create({
        data: { groupId, queryId },
      });
    } catch {
      throw new ConflictException('Cette requête est déjà assignée au groupe.');
    }
  }

  async removeQuery(groupId: string, queryId: string) {
    const assignment = await this.prisma.queryGroup.findUnique({
      where: { queryId_groupId: { queryId, groupId } },
    });
    if (!assignment) {
      throw new NotFoundException("Cette requête n'est pas dans ce groupe.");
    }
    return this.prisma.queryGroup.delete({
      where: { queryId_groupId: { queryId, groupId } },
    });
  }
}
