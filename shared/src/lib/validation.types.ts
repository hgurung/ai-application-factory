export interface ValidationResult {
  validator: string;
  passed: boolean;
  score: number;       // 0-100
  issues: string[];
  suggestions: string[];
}

export interface ValidationReport {
  jobId: string;
  overallPassed: boolean;
  overallScore: number;
  results: ValidationResult[];
  validatedAt: Date;
}
