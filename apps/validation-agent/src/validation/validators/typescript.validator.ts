import { Injectable } from '@nestjs/common';
import { ValidationResult } from '@agent-pipeline/shared';

// Checks generated code for TypeScript best practices
@Injectable()
export class TypeScriptValidator {
  async validate(code: string): Promise<ValidationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Count "any" usages — allow up to 2 (common in generated DTO scaffolding)
    const anyCount = (code.match(/: any/g) || []).length;
    if (anyCount > 2)
      issues.push(`${anyCount} "any" type(s) found — replace with proper types`);
    else if (anyCount > 0)
      suggestions.push(`${anyCount} "any" type(s) found — consider replacing with proper interfaces`);

    // Functions should declare return types
    const asyncFnWithoutReturn = (code.match(/async \w+\([^)]*\)\s*{/g) || []).length;
    if (asyncFnWithoutReturn > 0)
      suggestions.push('Add explicit return types to async functions e.g. Promise<User>');

    // Interface/type definitions show good typing practice
    if (!code.includes('interface') && !code.includes('type ') && code.length > 200)
      suggestions.push('Define interfaces or types for data shapes instead of inline objects');

    const score = Math.max(0, 100 - issues.length * 25 - suggestions.length * 5);

    return {
      validator: 'TypeScriptValidator',
      passed: issues.length === 0,
      score,
      issues,
      suggestions,
    };
  }
}
