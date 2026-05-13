import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JobService } from './job.service';
import { GENERATION_QUEUE, GenerationJobData } from './job.processor';

@Controller('jobs')
export class JobController {
  constructor(
    private readonly jobService: JobService,
    @InjectQueue(GENERATION_QUEUE) private readonly generationQueue: Queue,
  ) {}

  @Post()
  async createJob(@Body() body: { clientName: string; requirement: string }) {
    // Save job immediately and return — no waiting for generation or validation
    const job = await this.jobService.create(body.clientName, body.requirement);

    // Drop the work into the Redis queue; the processor picks it up asynchronously
    await this.generationQueue.add('generate', {
      jobId: job.id,
      requirement: body.requirement,
    } satisfies GenerationJobData);

    return job;
  }

  @Get()
  findAll() {
    return this.jobService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobService.findOne(id);
  }
}
