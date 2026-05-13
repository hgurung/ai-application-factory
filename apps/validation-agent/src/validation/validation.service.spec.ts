import { ValidationService } from './validation.service';
import { SecurityValidator } from './validators/security.validator';
import { ArchitectureValidator } from './validators/architecture.validator';
import { PerformanceValidator } from './validators/performance.validator';
import { TypeScriptValidator } from './validators/typescript.validator';
import { TestCoverageValidator } from './validators/test-coverage.validator';
import { ValidationResult } from '@agent-pipeline/shared';

const makeResult = (overrides: Partial<ValidationResult> = {}): ValidationResult => ({
  validator: 'MockValidator',
  passed: true,
  score: 100,
  issues: [],
  suggestions: [],
  ...overrides,
});

describe('ValidationService', () => {
  let service: ValidationService;
  let security: jest.Mocked<SecurityValidator>;
  let architecture: jest.Mocked<ArchitectureValidator>;
  let performance: jest.Mocked<PerformanceValidator>;
  let typescript: jest.Mocked<TypeScriptValidator>;
  let testCoverage: jest.Mocked<TestCoverageValidator>;

  beforeEach(() => {
    // Create mocked versions of all validators
    security = { validate: jest.fn() } as any;
    architecture = { validate: jest.fn() } as any;
    performance = { validate: jest.fn() } as any;
    typescript = { validate: jest.fn() } as any;
    testCoverage = { validate: jest.fn() } as any;

    service = new ValidationService(security, architecture, performance, typescript, testCoverage);
  });

  it('returns overallPassed=true when all validators pass', async () => {
    [security, architecture, performance, typescript, testCoverage].forEach((v) =>
      v.validate.mockResolvedValue(makeResult({ passed: true, score: 100 })),
    );
    const report = await service.validate('job-1', 'some code');
    expect(report.overallPassed).toBe(true);
    expect(report.overallScore).toBe(100);
  });

  it('returns overallPassed=false if any single validator fails', async () => {
    [security, architecture, performance, typescript].forEach((v) =>
      v.validate.mockResolvedValue(makeResult({ passed: true, score: 100 })),
    );
    testCoverage.validate.mockResolvedValue(makeResult({ passed: false, score: 0, issues: ['No tests'] }));

    const report = await service.validate('job-2', 'code');
    expect(report.overallPassed).toBe(false);
  });

  it('calculates overallScore as the average of all validator scores', async () => {
    const scores = [80, 90, 70, 100, 60];
    [security, architecture, performance, typescript, testCoverage].forEach((v, i) =>
      v.validate.mockResolvedValue(makeResult({ score: scores[i] })),
    );
    const report = await service.validate('job-3', 'code');
    const expected = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    expect(report.overallScore).toBe(expected);
  });

  it('runs all 5 validators and includes all results in the report', async () => {
    [security, architecture, performance, typescript, testCoverage].forEach((v) =>
      v.validate.mockResolvedValue(makeResult()),
    );
    const report = await service.validate('job-4', 'code');
    expect(report.results).toHaveLength(5);
  });

  it('handles a validator that throws — marks it failed without crashing', async () => {
    security.validate.mockRejectedValue(new Error('validator exploded'));
    [architecture, performance, typescript, testCoverage].forEach((v) =>
      v.validate.mockResolvedValue(makeResult({ passed: true, score: 100 })),
    );
    const report = await service.validate('job-5', 'code');
    expect(report.overallPassed).toBe(false);
    expect(report.results.some((r) => r.issues[0]?.includes('Validator crashed'))).toBe(true);
  });

  it('includes jobId and validatedAt in the report', async () => {
    [security, architecture, performance, typescript, testCoverage].forEach((v) =>
      v.validate.mockResolvedValue(makeResult()),
    );
    const report = await service.validate('job-6', 'code');
    expect(report.jobId).toBe('job-6');
    expect(report.validatedAt).toBeInstanceOf(Date);
  });
});
