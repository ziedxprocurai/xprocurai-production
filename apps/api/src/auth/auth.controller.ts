import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService, GoogleProfile } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('google')
  @ApiOperation({ summary: 'Authenticate with Google OAuth' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        fullName: { type: 'string' },
        avatarUrl: { type: 'string' },
      },
      required: ['email', 'fullName'],
    },
  })
  async googleLogin(@Body() profile: GoogleProfile) {
    return this.authService.googleLogin(profile);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { refreshToken: { type: 'string' } },
      required: ['refreshToken'],
    },
  })
  async refresh(@Body() body: { refreshToken: string }) {
    const payload = await this.authService.validateRefreshToken(body.refreshToken);
    return this.authService.generateTokens(payload.sub, payload.email, payload.role);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async me(@Request() req: { user: { userId: string } }) {
    return this.authService.getUserById(req.user.userId);
  }
}
