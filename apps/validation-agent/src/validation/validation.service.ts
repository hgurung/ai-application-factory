import { Injectable, Logger } from '@nestjs/common';
import { ValidationReport, ValidationResult } from '@agent-pipeline/shared';
import { SecurityValidator } from './validators/security.validator';
import { ArchitectureValidator } from './validators/architecture.validator';
import { PerformanceValidator } from './validators/performance.validator';
import { TypeScriptValidator } from './validators/typescript.validator';
import { TestCoverageValidator } from './validators/test-coverage.validator';

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  constructor(
    private readonly securityValidator: SecurityValidator,
    private readonly architectureValidator: ArchitectureValidator,
    private readonly performanceValidator: PerformanceValidator,
    private readonly typeScriptValidator: TypeScriptValidator,
    private readonly testCoverageValidator: TestCoverageValidator,
  ) {}

  async validate(jobId: string, code: string): Promise<ValidationReport> {
    this.logger.log(`Starting validation for job ${jobId}`);
    const startTime = Date.now();

    // Run ALL validators simultaneously — not one after another
    // Promise.allSettled means if one fails, others still complete
    const settled = await Promise.allSettled([
      this.securityValidator.validate(code),
      this.architectureValidator.validate(code),
      this.performanceValidator.validate(code),
      this.typeScriptValidator.validate(code),
      this.testCoverageValidator.validate(code),
    ]);

    // Extract results — handle any validator that threw an error
    const results: ValidationResult[] = settled.map((s) => {
      if (s.status === 'fulfilled') return s.value;
      // If a validator crashed, mark it as failed
      return {
        validator: 'UnknownValidator',
        passed: false,
        score: 0,
        issues: [`Validator crashed: ${s.reason}`],
        suggestions: [],
      };
    });

    // Overall score = average of all validator scores
    const overallScore = Math.round(
      results.reduce((sum, r) => sum + r.score, 0) / results.length,
    );

    // Must pass ALL validators to be considered passing
    const overallPassed = results.every((r) => r.passed);

    const elapsed = Date.now() - startTime;
    this.logger.log(
      `Validation complete for job ${jobId} — score: ${overallScore}, passed: ${overallPassed}, time: ${elapsed}ms`,
    );

    return {
      jobId,
      overallPassed,
      overallScore,
      results,
      validatedAt: new Date(),
    };
  }
}
