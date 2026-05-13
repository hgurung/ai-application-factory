import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type JobStatus = 'pending' | 'generating' | 'validating' | 'done' | 'failed';

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clientName: string;

  @Column('text')
  requirement: string;

  @Column({ default: 'pending' })
  status: JobStatus;

  @Column('text', { nullable: true })
  generatedCode: string;

  @Column('text', { nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
