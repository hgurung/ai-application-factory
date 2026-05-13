import { Module } from '@nestjs/common';
import { ValidationService } from './validation.service';
import { ValidationController } from './validation.controller';
import { SecurityValidator } from './validators/security.validator';
import { ArchitectureValidator } from './validators/architecture.validator';
import { PerformanceValidator } from './validators/performance.validator';
import { TypeScriptValidator } from './validators/typescript.validator';
import { TestCoverageValidator } from './validators/test-coverage.validator';

@Module({
  controllers: [ValidationController],
  providers: [
    ValidationService,
    SecurityValidator,
    ArchitectureValidator,
    PerformanceValidator,
    TypeScriptValidator,
    TestCoverageValidator,
  ],
})
export class ValidationModule {}
