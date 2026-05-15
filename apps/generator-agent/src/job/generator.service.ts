import { Injectable, Logger } from '@nestjs/common';

const CODEGEN_SYSTEM_PROMPT = `You are a NestJS expert. Generate clean, production-ready TypeScript code.
Return ONLY code — no explanations, no markdown fences, no backticks.
Output a single TypeScript file containing ALL of the following in order:
1. TypeScript interfaces for DTOs (e.g. CreateUserDto, UpdateUserDto) — no "any" types, use proper interfaces
2. Entity class with @Entity and @Column decorators (if the module has persistent data)
3. Service class with @Injectable decorator and basic CRUD methods with typed parameters and return types
4. Controller class with @Controller decorator and REST endpoints using @Get, @Post, @Put, @Delete
5. Module class with @Module decorator wiring everything together
6. A Jest unit test block using describe() with at least two it() tests and expect() assertions, and a beforeEach() that sets up the test module using Test.createTestingModule()

STRICT RULES — violating any of these causes build failure:
- NEVER use "any" type — define and use interfaces/DTOs for all parameters and return values
- NEVER hardcode secrets, tokens, or passwords — use process.env['SECRET_NAME'] for any config values
- NEVER import from files that don't exist in the output (only import from @nestjs/*, typeorm, @nestjs/testing)
Do not split into multiple files. Do not add any text outside the TypeScript code.`;

@Injectable()
export class GeneratorService {
  private readonly logger = new Logger(GeneratorService.name);
  private readonly useGroq = process.env['USE_GROQ'] === 'true';
  private readonly useClaude = process.env['USE_CLAUDE'] === 'true';

  async generate(requirement: string): Promise<string> {
    if (this.useGroq) return this.generateWithGroq(requirement);
    if (this.useClaude) return this.generateWithClaude(requirement);
    return this.generateMock(requirement);
  }

  private async generateMock(requirement: string): Promise<string> {
    this.logger.log(`[MOCK] Generating code for: ${requirement}`);
    await new Promise((r) => setTimeout(r, 500));

    return `
import { Controller, Get } from '@nestjs/common';

// MOCK GENERATED CODE
// Requirement: ${requirement}

@Controller('generated')
export class GeneratedController {
  @Get()
  hello() {
    return { message: 'Mock generated for: ${requirement}' };
  }
}
    `.trim();
  }

  private async generateWithGroq(requirement: string): Promise<string> {
    this.logger.log(`[GROQ] Generating code for: ${requirement}`);

    const Groq = (await import('groq-sdk')).default;
    const client = new Groq({ apiKey: process.env['GROQ_API_KEY'] });

    const completion = await client.chat.completions.create({
      model: process.env['GROQ_MODEL'] || 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: CODEGEN_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Generate a complete NestJS module for: ${requirement}`,
        },
      ],
      max_tokens: 4096,
    });

    return completion.choices[0].message.content ?? '';
  }

  private async generateWithClaude(requirement: string): Promise<string> {
    this.logger.log(`[CLAUDE] Generating code for: ${requirement}`);

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env['CLAUDE_API_KEY'] });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: CODEGEN_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Generate a complete NestJS module for: ${requirement}`,
      }],
    });

    return (response.content[0] as { text: string }).text;
  }
}
