import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSectorDto } from './dto/create-sector.dto';
import { UpdateSectorDto } from './dto/update-sector.dto';

@Injectable()
export class SectorsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSectorDto) {
    const existing = await this.prisma.sector.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Le secteur '${dto.name}' existe déjà.`);
    }

    return this.prisma.sector.create({ data: dto });
  }

  async findAll() {
    return this.prisma.sector.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const sector = await this.prisma.sector.findUnique({ where: { id } });
    if (!sector) {
      throw new NotFoundException(`Secteur introuvable.`);
    }
    return sector;
  }

  async update(id: string, dto: UpdateSectorDto) {
    await this.findOne(id);
    return this.prisma.sector.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.sector.delete({ where: { id } });
  }
}
