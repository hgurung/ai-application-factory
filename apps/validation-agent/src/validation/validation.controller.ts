import { Controller, Post, Body } from '@nestjs/common';
import { ValidationService } from './validation.service';

@Controller('validate')
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

  // POST /validate
  // Body: { jobId: string, code: string }
  // Returns: full ValidationReport with scores from all 5 validators
  @Post()
  validate(@Body() body: { jobId: string; code: string }) {
    return this.validationService.validate(body.jobId, body.code);
  }
}
