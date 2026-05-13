import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class GeneratorService {
  private readonly logger = new Logger(GeneratorService.name);
  private readonly useClaude = process.env.USE_CLAUDE === 'true';

  async generate(requirement: string): Promise<string> {
    if (this.useClaude) {
      return this.generateWithClaude(requirement);
    }
    return this.generateMock(requirement);
  }

  // Mock — free, instant, safe for development
  private async generateMock(requirement: string): Promise<string> {
    this.logger.log(`[MOCK] Generating code for: ${requirement}`);
    await new Promise((r) => setTimeout(r, 500)); // simulate delay

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

  // Real Claude — only called when USE_CLAUDE=true
  private async generateWithClaude(requirement: string): Promise<string> {
    this.logger.log(`[CLAUDE] Generating code for: ${requirement}`);

    // Lazy import — SDK only loaded when actually needed
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: `You are a Nest.js expert. Generate clean, production-ready TypeScript code.
               Return ONLY the code, no explanations, no markdown fences.`,
      messages: [{
        role: 'user',
        content: `Generate a complete Nest.js module (controller + service + entity if needed) for: ${requirement}`,
      }],
    });

    return (response.content[0] as { text: string }).text;
  }
}
