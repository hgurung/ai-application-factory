import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job as BullJob } from 'bullmq';
import { JobService } from './job.service';
import { GeneratorService } from './generator.service';

export const GENERATION_QUEUE = 'generation';

export interface GenerationJobData {
  jobId: string;
  requirement: string;
}

@Processor(GENERATION_QUEUE)
export class JobProcessor extends WorkerHost {
  private readonly logger = new Logger(JobProcessor.name);
  private readonly validationUrl = process.env['VALIDATION_AGENT_URL'] || 'http://localhost:3001';
  private readonly fileWriterUrl = process.env['FILE_WRITER_URL'] || 'http://localhost:3003';

  constructor(
    private readonly jobService: JobService,
    private readonly generatorService: GeneratorService,
  ) {
    super();
  }

  async process(bullJob: BullJob<GenerationJobData>): Promise<void> {
    const { jobId, requirement } = bullJob.data;
    this.logger.log(`Processing job ${jobId}`);

    try {
      await this.jobService.updateStatus(jobId, 'generating');
      const generatedCode = await this.generatorService.generate(requirement);
      await this.jobService.updateStatus(jobId, 'validating', { generatedCode });

      this.logger.log(`Sending job ${jobId} to validation-agent`);
      const response = await fetch(`${this.validationUrl}/api/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, code: generatedCode }),
      });

      const report = await response.json();
      this.logger.log(`Validation result — passed: ${report.overallPassed}, score: ${report.overallScore}`);

      // If validation passed, send code to file-writer-agent to write real .ts files
      if (report.overallPassed) {
        const job = await this.jobService.findOne(jobId);
        await fetch(`${this.fileWriterUrl}/api/write`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: job.clientName,
            moduleName: job.requirement,
            code: generatedCode,
          }),
        }).catch((e) => this.logger.warn(`File writer unavailable: ${e.message}`));
      }

      const finalStatus = report.overallPassed ? 'done' : 'failed';
      const errorMessage = report.overallPassed
        ? undefined
        : `Validation failed (score: ${report.overallScore}). Issues: ${report.results.flatMap((r: { issues: string[] }) => r.issues).join('; ')}`;

      await this.jobService.updateStatus(jobId, finalStatus, { errorMessage });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Job ${jobId} failed: ${message}`);
      await this.jobService.updateStatus(jobId, 'failed', { errorMessage: message });
    }
  }
}
