import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Job } from './job.entity';
import { JobService } from './job.service';
import { JobController } from './job.controller';
import { GeneratorService } from './generator.service';
import { JobProcessor, GENERATION_QUEUE } from './job.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([Job]),
    BullModule.registerQueue({ name: GENERATION_QUEUE }),
  ],
  controllers: [JobController],
  providers: [JobService, GeneratorService, JobProcessor],
  exports: [JobService],
})
export class JobModule {}
