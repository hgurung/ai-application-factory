import { Injectable } from '@nestjs/common';
import { ValidationResult } from '@agent-pipeline/shared';

// Checks generated code for common performance problems
@Injectable()
export class PerformanceValidator {
  async validate(code: string): Promise<ValidationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Loops with DB calls inside = N+1 query problem
    if ((code.includes('for ') || code.includes('forEach')) &&
        code.includes('await') && code.includes('find'))
      issues.push('Possible N+1 query — DB call inside a loop. Use findByIds() or relations instead');

    // SELECT * loads all columns unnecessarily
    if (code.includes('SELECT *'))
      issues.push('SELECT * loads all columns — select only needed fields');

    // Relations should be loaded efficiently
    if (code.includes('find(') && !code.includes('relations') && code.includes('join'))
      suggestions.push('Use TypeORM relations option instead of manual joins');

    // Pagination on list endpoints
    if (code.includes('findAll') && !code.includes('take') && !code.includes('skip'))
      suggestions.push('Add pagination (take/skip) to findAll — never return unbounded lists');

    const score = Math.max(0, 100 - issues.length * 30 - suggestions.length * 5);

    return {
      validator: 'PerformanceValidator',
      passed: issues.length === 0,
      score,
      issues,
      suggestions,
    };
  }
}
