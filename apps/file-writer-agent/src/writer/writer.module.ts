import { Module } from '@nestjs/common';
import { WriterService } from './writer.service';
import { WriterController } from './writer.controller';
import { CodeParserService } from './code-parser.service';

@Module({
  controllers: [WriterController],
  providers: [WriterService, CodeParserService],
})
export class WriterModule {}
