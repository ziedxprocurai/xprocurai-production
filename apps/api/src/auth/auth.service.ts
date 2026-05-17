import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface GoogleProfile {
  email: string;
  fullName: string;
  avatarUrl?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async googleLogin(profile: GoogleProfile) {
    const { email, fullName, avatarUrl } = profile;

    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      this.logger.log(`Creating new user from Google OAuth: ${email}`);
      user = await this.prisma.user.create({
        data: {
          email,
          fullName,
          avatarUrl,
          authProvider: 'GOOGLE',
          isActive: true,
        },
      });
    } else {
      user = await this.prisma.user.update({
        where: { email },
        data: {
          fullName: fullName || user.fullName,
          avatarUrl: avatarUrl || user.avatarUrl,
          authProvider: 'GOOGLE',
        },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        onboarded: user.onboarded,
      },
      ...tokens,
    };
  }

  async generateTokens(userId: string, email: string, role: string = 'USER') {
    const payload: JwtPayload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<number>('JWT_REFRESH_EXPIRATION', 604800),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  async validateRefreshToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      onboarded: user.onboarded,
    };
  }
}
