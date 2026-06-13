import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRFQDto } from './dto/create-rfq.dto';
import { UpdateRFQDto } from './dto/update-rfq.dto';

@Injectable()
export class RFQService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateRFQDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user?.company) {
      throw new ForbiddenException('User must belong to a company to create RFQs');
    }

    if (!user.company.roles.includes('BUYER')) {
      throw new ForbiddenException('Only buyers can create RFQs');
    }

    const supplier = await this.prisma.company.findUnique({
      where: { id: dto.supplierId },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    if (!supplier.roles.includes('SUPPLIER')) {
      throw new ForbiddenException('Target company must be a supplier');
    }

    if (dto.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
      });

      if (!product || product.companyId !== dto.supplierId) {
        throw new NotFoundException('Product not found or does not belong to supplier');
      }
    }

    return this.prisma.rFQ.create({
      data: {
        title: dto.title,
        description: dto.description,
        quantity: dto.quantity,
        buyerId: user.company.id,
        supplierId: dto.supplierId,
        productId: dto.productId,
      },
      include: {
        buyer: {
          select: {
            id: true,
            legalName: true,
            country: true,
            city: true,
          },
        },
        supplier: {
          select: {
            id: true,
            legalName: true,
            country: true,
            city: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });
  }

  async findSentRFQs(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user?.company) {
      throw new ForbiddenException('User must belong to a company');
    }

    return this.prisma.rFQ.findMany({
      where: { buyerId: user.company.id },
      include: {
        supplier: {
          select: {
            id: true,
            legalName: true,
            country: true,
            city: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findReceivedRFQs(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user?.company) {
      throw new ForbiddenException('User must belong to a company');
    }

    return this.prisma.rFQ.findMany({
      where: { supplierId: user.company.id },
      include: {
        buyer: {
          select: {
            id: true,
            legalName: true,
            country: true,
            city: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    const rfq = await this.prisma.rFQ.findUnique({
      where: { id },
      include: {
        buyer: {
          select: {
            id: true,
            legalName: true,
            country: true,
            city: true,
          },
        },
        supplier: {
          select: {
            id: true,
            legalName: true,
            country: true,
            city: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            quantity: true,
          },
        },
      },
    });

    if (!rfq) {
      throw new NotFoundException('RFQ not found');
    }

    if (rfq.buyerId !== user?.company?.id && rfq.supplierId !== user?.company?.id) {
      throw new ForbiddenException('You can only view RFQs related to your company');
    }

    return rfq;
  }

  async update(id: string, userId: string, dto: UpdateRFQDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    const rfq = await this.prisma.rFQ.findUnique({
      where: { id },
    });

    if (!rfq) {
      throw new NotFoundException('RFQ not found');
    }

    if (rfq.supplierId !== user?.company?.id) {
      throw new ForbiddenException('Only the supplier can update this RFQ');
    }

    return this.prisma.rFQ.update({
      where: { id },
      data: dto,
      include: {
        buyer: {
          select: {
            id: true,
            legalName: true,
          },
        },
        supplier: {
          select: {
            id: true,
            legalName: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }
}
