import { SecurityValidator } from './security.validator';

describe('SecurityValidator', () => {
  let validator: SecurityValidator;

  beforeEach(() => {
    validator = new SecurityValidator();
  });

  it('passes clean code with a perfect score', async () => {
    const code = `
      @Controller('users')
      export class UsersController {
        @Get() findAll() { return []; }
      }
    `;
    const result = await validator.validate(code);
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.issues).toHaveLength(0);
  });

  it('flags eval() as a security issue', async () => {
    const code = `const result = eval(userInput);`;
    const result = await validator.validate(code);
    expect(result.passed).toBe(false);
    expect(result.issues).toContain('eval() detected — allows arbitrary code injection');
  });

  it('flags hardcoded secrets', async () => {
    const code = `const apikey = 'supersecret123';`;
    const result = await validator.validate(code);
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.includes('hardcoded secret'))).toBe(true);
  });

  it('suggests @UseGuards on POST endpoints', async () => {
    const code = `@Post() create(@Body() dto) {}`;
    const result = await validator.validate(code);
    expect(result.suggestions.some((s) => s.includes('@UseGuards'))).toBe(true);
  });

  it('suggests ValidationPipe when @Body is used', async () => {
    const code = `@Get() find(@Body() dto) {}`;
    const result = await validator.validate(code);
    expect(result.suggestions.some((s) => s.includes('ValidationPipe'))).toBe(true);
  });

  it('score decreases per issue found', async () => {
    const code = `eval('bad'); const password = 'hardcoded';`;
    const result = await validator.validate(code);
    expect(result.score).toBeLessThan(100);
  });

  it('score never goes below 0', async () => {
    const code = `eval('a'); eval('b'); eval('c'); eval('d'); const secret = 'x';`;
    const result = await validator.validate(code);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('returns the correct validator name', async () => {
    const result = await validator.validate('');
    expect(result.validator).toBe('SecurityValidator');
  });
});
