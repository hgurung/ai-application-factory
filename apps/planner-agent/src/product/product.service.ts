import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, ProductStatus } from './product.entity';
import { DecomposerService } from './decomposer.service';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);
  private readonly generatorUrl = process.env['GENERATOR_AGENT_URL'] || 'http://localhost:3000';

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly decomposerService: DecomposerService,
  ) {}

  async create(name: string, description: string): Promise<Product> {
    // Step 1 — save product immediately so we have an ID to return
    const product = this.productRepo.create({ name, description, status: 'planning' });
    await this.productRepo.save(product);

    // Step 2 — decompose in background so the HTTP response returns fast
    this.planInBackground(product.id, name, description);

    return product;
  }

  // Runs after the HTTP response is sent — no await on the caller side
  private async planInBackground(id: string, name: string, description: string): Promise<void> {
    try {
      // Decompose the product into module names
      const modules = await this.decomposerService.decompose(name, description);
      await this.productRepo.update(id, { modules, status: 'generating' });

      // Submit one job per module to generator-agent
      const jobIds: string[] = [];
      for (const module of modules) {
        const response = await fetch(`${this.generatorUrl}/api/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientName: name, requirement: module }),
        });
        const job = await response.json();
        jobIds.push(job.id);
        this.logger.log(`Submitted job ${job.id} for module: ${module}`);
      }

      await this.productRepo.update(id, { jobIds });
      this.logger.log(`Product ${id} planning complete — ${jobIds.length} jobs submitted`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Product ${id} planning failed: ${message}`);
      await this.productRepo.update(id, { status: 'failed' });
    }
  }

  async findOne(id: string): Promise<Product & { jobStatuses?: Record<string, string> }> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product || !product.jobIds?.length) return product;

    // Fetch status of every job from generator-agent to show overall progress
    const jobStatuses: Record<string, string> = {};
    await Promise.allSettled(
      product.jobIds.map(async (jobId) => {
        try {
          const res = await fetch(`${this.generatorUrl}/api/jobs/${jobId}`);
          const job = await res.json();
          jobStatuses[jobId] = job.status;
        } catch {
          jobStatuses[jobId] = 'unknown';
        }
      }),
    );

    // Compute overall product status from individual job statuses
    const statuses = Object.values(jobStatuses);
    let overallStatus: ProductStatus = 'generating';
    if (statuses.every((s) => s === 'done')) overallStatus = 'done';
    else if (statuses.some((s) => s === 'failed')) overallStatus = 'failed';

    if (overallStatus !== product.status) {
      await this.productRepo.update(id, { status: overallStatus });
      product.status = overallStatus;
    }

    return { ...product, jobStatuses };
  }

  async findAll(): Promise<Product[]> {
    return this.productRepo.find({ order: { createdAt: 'DESC' } });
  }
}
