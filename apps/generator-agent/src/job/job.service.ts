import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job, JobStatus } from './job.entity';

@Injectable()
export class JobService {
  constructor(
    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,
  ) {}

  async create(clientName: string, requirement: string): Promise<Job> {
    const job = this.jobRepo.create({ clientName, requirement, status: 'pending' });
    return this.jobRepo.save(job);
  }

  async updateStatus(id: string, status: JobStatus, data?: Partial<Job>): Promise<Job> {
    await this.jobRepo.update(id, { status, ...data });
    return this.jobRepo.findOne({ where: { id } });
  }

  async findAll(): Promise<Job[]> {
    return this.jobRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Job> {
    return this.jobRepo.findOne({ where: { id } });
  }
}
