import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ schema: "monitoring" })
export class QueueJobCount {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  queueName: string;

  @Column()
  waiting: number;

  @Column()
  active: number;

  @Column()
  failed: number;

  @Column()
  delayed: number;

  @Column()
  completed: number;

  @Column()
  paused: number;

  @Column()
  date: Date;

  @CreateDateColumn()
  createdAt: Date;
}
