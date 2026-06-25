import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly selectFields = {
    id: true,
    username: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  async findAll() {
    return this.prisma.user.findMany({
      select: this.selectFields,
      orderBy: { username: 'asc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...this.selectFields,
        groups: { include: { group: { select: { id: true, name: true } } } },
      },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: this.selectFields,
    });
  }
}
