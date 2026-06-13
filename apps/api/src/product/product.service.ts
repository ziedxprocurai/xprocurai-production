import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateProductDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user?.company) {
      throw new ForbiddenException('User must belong to a company to create products');
    }

    if (!user.company.roles.includes('SUPPLIER')) {
      throw new ForbiddenException('Only suppliers can create products');
    }

    return this.prisma.product.create({
      data: {
        ...dto,
        companyId: user.company.id,
      },
      include: {
        company: {
          select: {
            id: true,
            legalName: true,
            country: true,
            city: true,
            industry: true,
          },
        },
      },
    });
  }

  async findAll(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user?.company) {
      throw new ForbiddenException('User must belong to a company');
    }

    return this.prisma.product.findMany({
      where: { companyId: user.company.id },
      include: {
        company: {
          select: {
            id: true,
            legalName: true,
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

    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            legalName: true,
            country: true,
            city: true,
            industry: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.companyId !== user?.company?.id) {
      throw new ForbiddenException('You can only view your own products');
    }

    return product;
  }

  async update(id: string, userId: string, dto: UpdateProductDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.companyId !== user?.company?.id) {
      throw new ForbiddenException('You can only update your own products');
    }

    return this.prisma.product.update({
      where: { id },
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

  async remove(id: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.companyId !== user?.company?.id) {
      throw new ForbiddenException('You can only delete your own products');
    }

    return this.prisma.product.delete({
      where: { id },
    });
  }

  async searchProducts(query: string) {
    return this.prisma.product.findMany({
      where: {
        AND: [
          { isVisible: true },
          { isAvailable: true },
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
        ],
        company: {
          verificationStatus: 'VERIFIED',
          roles: { has: 'SUPPLIER' },
        },
      },
      include: {
        company: {
          select: {
            id: true,
            legalName: true,
            country: true,
            city: true,
            industry: true,
            verificationStatus: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
