import { Injectable } from '@nestjs/common';
import { ValidationResult } from '@agent-pipeline/shared';

// Checks generated code for security vulnerabilities
@Injectable()
export class SecurityValidator {
  async validate(code: string): Promise<ValidationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (code.includes('eval('))
      issues.push('eval() detected — allows arbitrary code injection');

    if (/password|secret|apikey/i.test(code) && code.includes("= '"))
      issues.push('Possible hardcoded secret detected');

    if (!code.includes('@UseGuards') && code.includes('@Post'))
      suggestions.push('POST endpoints should use @UseGuards for auth');

    if (!code.includes('ValidationPipe') && code.includes('@Body'))
      suggestions.push('Add ValidationPipe to sanitize incoming request bodies');

    const score = Math.max(0, 100 - issues.length * 30 - suggestions.length * 5);

    return {
      validator: 'SecurityValidator',
      passed: issues.length === 0,
      score,
      issues,
      suggestions,
    };
  }
}
