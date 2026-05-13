import { Injectable } from '@nestjs/common';
import { ValidationResult } from '@agent-pipeline/shared';

// Checks generated code follows Nest.js architectural patterns
@Injectable()
export class ArchitectureValidator {
  async validate(code: string): Promise<ValidationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Must have at least a controller or service
    if (!code.includes('@Controller') && !code.includes('@Injectable'))
      issues.push('No Nest.js decorators found — not valid Nest.js code');

    // Business logic should be in services, not controllers
    if (code.includes('@Controller') && code.includes('Repository') && !code.includes('@Injectable'))
      issues.push('Database access found in controller — move to a Service');

    // Module should wire everything together
    if (code.includes('@Controller') && !code.includes('@Module'))
      suggestions.push('Add a @Module to register controller and service together');

    // DTOs should exist for request bodies
    if (code.includes('@Body') && !code.includes('Dto'))
      suggestions.push('Create a DTO class for @Body() instead of using raw objects');

    const score = Math.max(0, 100 - issues.length * 30 - suggestions.length * 5);

    return {
      validator: 'ArchitectureValidator',
      passed: issues.length === 0,
      score,
      issues,
      suggestions,
    };
  }
}
