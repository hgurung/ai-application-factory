import { JobService } from './job.service';
import { Job } from './job.entity';
import { Repository } from 'typeorm';

const makeJob = (overrides: Partial<Job> = {}): Job => ({
  id: 'test-uuid',
  clientName: 'TestClient',
  requirement: 'auth module',
  status: 'pending',
  generatedCode: null,
  errorMessage: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('JobService', () => {
  let service: JobService;
  let repo: jest.Mocked<Repository<Job>>;

  beforeEach(() => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    } as any;

    service = new JobService(repo);
  });

  describe('create', () => {
    it('creates and saves a job with status pending', async () => {
      const job = makeJob();
      repo.create.mockReturnValue(job);
      repo.save.mockResolvedValue(job);

      const result = await service.create('TestClient', 'auth module');

      expect(repo.create).toHaveBeenCalledWith({
        clientName: 'TestClient',
        requirement: 'auth module',
        status: 'pending',
      });
      expect(repo.save).toHaveBeenCalledWith(job);
      expect(result).toEqual(job);
    });
  });

  describe('updateStatus', () => {
    it('updates job status and returns the updated job', async () => {
      const updated = makeJob({ status: 'generating' });
      repo.update.mockResolvedValue(undefined);
      repo.findOne.mockResolvedValue(updated);

      const result = await service.updateStatus('test-uuid', 'generating');

      expect(repo.update).toHaveBeenCalledWith('test-uuid', { status: 'generating' });
      expect(result.status).toBe('generating');
    });

    it('merges extra data when updating status', async () => {
      const updated = makeJob({ status: 'validating', generatedCode: 'some code' });
      repo.update.mockResolvedValue(undefined);
      repo.findOne.mockResolvedValue(updated);

      await service.updateStatus('test-uuid', 'validating', { generatedCode: 'some code' });

      expect(repo.update).toHaveBeenCalledWith('test-uuid', {
        status: 'validating',
        generatedCode: 'some code',
      });
    });
  });

  describe('findAll', () => {
    it('returns all jobs ordered by createdAt DESC', async () => {
      const jobs = [makeJob(), makeJob({ id: 'other-uuid' })];
      repo.find.mockResolvedValue(jobs);

      const result = await service.findAll();

      expect(repo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('returns a single job by id', async () => {
      const job = makeJob();
      repo.findOne.mockResolvedValue(job);

      const result = await service.findOne('test-uuid');

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'test-uuid' } });
      expect(result.id).toBe('test-uuid');
    });
  });
});
