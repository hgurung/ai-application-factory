import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DecomposerService {
  private readonly logger = new Logger(DecomposerService.name);
  private readonly useClaude = process.env['USE_CLAUDE'] === 'true';

  async decompose(productName: string, description: string): Promise<string[]> {
    if (this.useClaude) {
      return this.decomposeWithClaude(productName, description);
    }
    return this.decomposeMock(productName, description);
  }

  // Mock — returns a realistic module list based on keywords in the description
  private async decomposeMock(productName: string, description: string): Promise<string[]> {
    this.logger.log(`[MOCK] Decomposing product: ${productName}`);
    await new Promise((r) => setTimeout(r, 300));

    const desc = description.toLowerCase();
    const modules: string[] = ['auth module'];

    if (desc.includes('user') || desc.includes('profile')) modules.push('users module');
    if (desc.includes('contact')) modules.push('contacts module');
    if (desc.includes('deal') || desc.includes('sale')) modules.push('deals module');
    if (desc.includes('pipeline')) modules.push('pipeline module');
    if (desc.includes('task') || desc.includes('todo')) modules.push('tasks module');
    if (desc.includes('notification')) modules.push('notifications module');
    if (desc.includes('report') || desc.includes('analytics')) modules.push('reports module');
    if (desc.includes('payment') || desc.includes('billing')) modules.push('payments module');
    if (desc.includes('email')) modules.push('email module');

    // Always include a base module named after the product
    modules.push(`${productName.toLowerCase()} core module`);

    this.logger.log(`[MOCK] Decomposed into ${modules.length} modules: ${modules.join(', ')}`);
    return modules;
  }

  // Real Claude — only called when USE_CLAUDE=true
  private async decomposeWithClaude(productName: string, description: string): Promise<string[]> {
    this.logger.log(`[CLAUDE] Decomposing product: ${productName}`);

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env['CLAUDE_API_KEY'] });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: `You are a senior NestJS architect. Given a software product description,
               respond with ONLY a JSON array of module names needed to build it.
               Each module name should be short and lowercase, e.g. "auth module", "contacts module".
               No explanation, no markdown, just the JSON array.`,
      messages: [{
        role: 'user',
        content: `Product: ${productName}\nDescription: ${description}`,
      }],
    });

    const text = (response.content[0] as { text: string }).text.trim();
    const modules: string[] = JSON.parse(text);
    this.logger.log(`[CLAUDE] Decomposed into ${modules.length} modules: ${modules.join(', ')}`);
    return modules;
  }
}
