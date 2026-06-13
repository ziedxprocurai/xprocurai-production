import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateERPConnectionDto } from './dto/create-erp-connection.dto';
import { UpdateERPConnectionDto } from './dto/update-erp-connection.dto';

@Injectable()
export class ERPService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateERPConnectionDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: { include: { erpConnection: true } } },
    });

    if (!user?.company) {
      throw new ForbiddenException('User must belong to a company to create ERP connection');
    }

    if (!user.company.roles.includes('SUPPLIER')) {
      throw new ForbiddenException('Only suppliers can create ERP connections');
    }

    if (user.company.erpConnection) {
      throw new ConflictException('Company already has an ERP connection. Please update or delete the existing one.');
    }

    return this.prisma.eRPConnection.create({
      data: {
        erpSystem: dto.erpSystem,
        connectionString: dto.connectionString,
        apiKey: dto.apiKey,
        credentials: dto.credentials,
        isActive: false,
        companyId: user.company.id,
      },
      include: {
        company: {
          select: {
            id: true,
            legalName: true,
          },
        },
      },
    });
  }

  async findByCompany(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user?.company) {
      throw new ForbiddenException('User must belong to a company');
    }

    const erpConnection = await this.prisma.eRPConnection.findUnique({
      where: { companyId: user.company.id },
      include: {
        company: {
          select: {
            id: true,
            legalName: true,
          },
        },
      },
    });

    return erpConnection;
  }

  async update(userId: string, dto: UpdateERPConnectionDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: { include: { erpConnection: true } } },
    });

    if (!user?.company) {
      throw new ForbiddenException('User must belong to a company');
    }

    if (!user.company.erpConnection) {
      throw new NotFoundException('No ERP connection found for this company');
    }

    return this.prisma.eRPConnection.update({
      where: { id: user.company.erpConnection.id },
      data: dto,
      include: {
        company: {
          select: {
            id: true,
            legalName: true,
          },
        },
      },
    });
  }

  async delete(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: { include: { erpConnection: true } } },
    });

    if (!user?.company) {
      throw new ForbiddenException('User must belong to a company');
    }

    if (!user.company.erpConnection) {
      throw new NotFoundException('No ERP connection found for this company');
    }

    return this.prisma.eRPConnection.delete({
      where: { id: user.company.erpConnection.id },
    });
  }
}
