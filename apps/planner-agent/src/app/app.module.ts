import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from '@agent-pipeline/shared';
import { Product } from '../product/product.entity';
import { ProductModule } from '../product/product.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({ ...databaseConfig(), entities: [Product] }),
    ProductModule,
  ],
})
export class AppModule {}
