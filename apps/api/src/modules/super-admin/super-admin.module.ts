import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../../prisma/prisma.module';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { SuperAdminJwtStrategy } from './super-admin-jwt.strategy';

@Module({
  imports: [PrismaModule, PassportModule.register({ defaultStrategy: 'super-admin-jwt' })],
  controllers: [SuperAdminController],
  providers: [SuperAdminService, SuperAdminJwtStrategy],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}
