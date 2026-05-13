import { Injectable } from '@nestjs/common';
import { ValidationResult } from '@agent-pipeline/shared';

// Checks if generated code includes proper test coverage
@Injectable()
export class TestCoverageValidator {
  async validate(code: string): Promise<ValidationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check if tests are present
    if (!code.includes('describe(') && !code.includes('it(') && !code.includes('spec'))
      issues.push('No test file detected — generated code must include unit tests');

    // Check for basic test patterns
    if (code.includes('describe(') && !code.includes('expect('))
      issues.push('Test file exists but has no assertions (expect calls)');

    // Check for mock setup
    if (code.includes('describe(') && !code.includes('beforeEach'))
      suggestions.push('Add beforeEach() to set up test module and avoid test coupling');

    // E2E tests for controllers
    if (code.includes('@Controller') && !code.includes('supertest') && !code.includes('request('))
      suggestions.push('Add e2e tests for controller endpoints using supertest');

    const score = Math.max(0, 100 - issues.length * 30 - suggestions.length * 5);

    return {
      validator: 'TestCoverageValidator',
      passed: issues.length === 0,
      score,
      issues,
      suggestions,
    };
  }
}
