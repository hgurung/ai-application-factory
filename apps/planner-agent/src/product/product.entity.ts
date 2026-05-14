import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type ProductStatus = 'planning' | 'generating' | 'done' | 'failed';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column({ default: 'planning' })
  status: ProductStatus;

  // Stores the list of modules Claude decomposed the product into
  @Column('simple-array', { nullable: true })
  modules: string[];

  // job IDs created in generator-agent, one per module
  @Column('simple-array', { nullable: true })
  jobIds: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
