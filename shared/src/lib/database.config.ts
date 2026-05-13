import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env['POSTGRES_HOST'] || 'localhost',
  port: parseInt(process.env['POSTGRES_PORT'] || '5432'),
  username: process.env['POSTGRES_USER'] || 'agent',
  password: process.env['POSTGRES_PASSWORD'] || 'password',
  database: process.env['POSTGRES_DB'] || 'agentdb',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  // synchronize=true auto-creates tables — enabled in dev or when TYPEORM_SYNC=true
  synchronize: process.env['TYPEORM_SYNC'] === 'true' || process.env['NODE_ENV'] !== 'production',
});
