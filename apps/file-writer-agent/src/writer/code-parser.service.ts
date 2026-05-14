import { Injectable, Logger } from '@nestjs/common';

export interface ParsedFile {
  filename: string;
  content: string;
}

@Injectable()
export class CodeParserService {
  private readonly logger = new Logger(CodeParserService.name);

  parse(moduleName: string, code: string): ParsedFile[] {
    // Derive a clean slug from the module name — "auth module" → "auth"
    const slug = moduleName.toLowerCase().replace(/\s+module$/, '').replace(/\s+/g, '-');

    const files: ParsedFile[] = [];

    // Check what NestJS building blocks are present in the generated code
    const hasController = code.includes('@Controller');
    const hasService = code.includes('@Injectable');
    const hasEntity = code.includes('@Entity');
    const hasModule = code.includes('@Module');

    if (hasController) {
      files.push({
        filename: `${slug}.controller.ts`,
        content: this.extractBlock(code, '@Controller', slug, 'controller'),
      });
    }

    if (hasService) {
      files.push({
        filename: `${slug}.service.ts`,
        content: this.extractBlock(code, '@Injectable', slug, 'service'),
      });
    }

    if (hasEntity) {
      files.push({
        filename: `${slug}.entity.ts`,
        content: this.extractBlock(code, '@Entity', slug, 'entity'),
      });
    }

    if (hasModule) {
      files.push({
        filename: `${slug}.module.ts`,
        content: this.extractBlock(code, '@Module', slug, 'module'),
      });
    }

    // If the code has none of the decorators (e.g. utility code), write it as-is
    if (files.length === 0) {
      files.push({ filename: `${slug}.ts`, content: code });
    }

    // Always generate a minimal module file if one wasn't in the generated code
    // — every NestJS feature needs a module to be importable
    if (!hasModule) {
      files.push({
        filename: `${slug}.module.ts`,
        content: this.generateModuleFile(slug, hasController, hasService, hasEntity),
      });
    }

    this.logger.log(`Parsed "${moduleName}" into ${files.length} files: ${files.map((f) => f.filename).join(', ')}`);
    return files;
  }

  // Extracts the relevant class from the code based on decorator presence.
  // For mock code (single class), returns the whole thing.
  // For real Claude output (multiple classes), extracts the matching block.
  private extractBlock(code: string, decorator: string, slug: string, type: string): string {
    const decoratorIndex = code.indexOf(decorator);
    if (decoratorIndex === -1) return code;

    // Find the class that follows this decorator
    const classIndex = code.indexOf('export class', decoratorIndex);
    if (classIndex === -1) return code;

    // Extract from the decorator to the end of the class (matching braces)
    const beforeClass = code.substring(decoratorIndex, classIndex + 12);
    const afterDecorator = code.substring(classIndex + 12);
    const className = afterDecorator.split(/[\s{]/)[0];

    // Get all imports at the top of the file
    const imports = this.extractImports(code);

    // Find the class body by counting braces
    const classStart = code.indexOf('{', classIndex);
    let depth = 0;
    let classEnd = classStart;
    for (let i = classStart; i < code.length; i++) {
      if (code[i] === '{') depth++;
      if (code[i] === '}') depth--;
      if (depth === 0) { classEnd = i; break; }
    }

    const classBody = code.substring(decoratorIndex, classEnd + 1);
    return `${imports}\n\n${classBody}`;
  }

  private extractImports(code: string): string {
    const lines = code.split('\n');
    const importLines = lines.filter((l) => l.trim().startsWith('import '));
    return importLines.join('\n');
  }

  // Generates a standard NestJS module file when the AI didn't include one
  private generateModuleFile(slug: string, hasController: boolean, hasService: boolean, hasEntity: boolean): string {
    const className = slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
    const imports: string[] = [];
    const controllers: string[] = [];
    const providers: string[] = [];

    if (hasController) {
      imports.push(`import { ${className}Controller } from './${slug}.controller';`);
      controllers.push(`${className}Controller`);
    }
    if (hasService) {
      imports.push(`import { ${className}Service } from './${slug}.service';`);
      providers.push(`${className}Service`);
    }
    if (hasEntity) {
      imports.push(`import { TypeOrmModule } from '@nestjs/typeorm';`);
      imports.push(`import { ${className} } from './${slug}.entity';`);
    }

    const typeormImport = hasEntity ? `\n  imports: [TypeOrmModule.forFeature([${className}])],` : '';
    const controllersStr = controllers.length ? `\n  controllers: [${controllers.join(', ')}],` : '';
    const providersStr = providers.length ? `\n  providers: [${providers.join(', ')}],` : '';

    return `import { Module } from '@nestjs/common';
${imports.join('\n')}

@Module({${typeormImport}${controllersStr}${providersStr}
})
export class ${className}Module {}
`;
  }
}
