import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo() {
    return {
      name: 'xProcurAI API',
      version: '0.1.0',
      description: 'B2B SaaS Procurement Intelligence Platform',
      timestamp: new Date().toISOString(),
    };
  }
}
