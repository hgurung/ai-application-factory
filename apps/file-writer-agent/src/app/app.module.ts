import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WriterModule } from '../writer/writer.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    WriterModule,
  ],
})
export class AppModule {}
