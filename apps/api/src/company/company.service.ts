import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCompanyDto, userId: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });

    if (existingUser?.companyId) {
      throw new ConflictException('User already belongs to a company');
    }

    const company = await this.prisma.company.create({
      data: {
        legalName: dto.legalName,
        website: dto.website,
        country: dto.country,
        city: dto.city,
        industry: dto.industry,
        companySize: dto.companySize,
        phoneNumber: dto.phoneNumber,
        email: dto.email,
        description: dto.description,
        roles: dto.roles,
        onboardingStatus: 'IN_PROGRESS',
        users: { connect: { id: userId } },
      },
      include: { users: { select: { id: true, email: true, fullName: true } } },
    });

    // Mark user as onboarded
    await this.prisma.user.update({
      where: { id: userId },
      data: { onboarded: true },
    });

    this.logger.log(`Company "${company.legalName}" created by user ${userId}`);
    return company;
  }

  async findById(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { users: { select: { id: true, email: true, fullName: true, role: true } } },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async findByUserId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });
    if (!user?.companyId) return null;
    return this.findById(user.companyId);
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');

    return this.prisma.company.update({
      where: { id },
      data: {
        ...dto,
      },
      include: { users: { select: { id: true, email: true, fullName: true } } },
    });
  }

  async completeOnboarding(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');

    return this.prisma.company.update({
      where: { id },
      data: { onboardingStatus: 'COMPLETED' },
    });
  }

  async addUser(companyId: string, userId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: { companyId },
    });

    return this.findById(companyId);
  }
}
