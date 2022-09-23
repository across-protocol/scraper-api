import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  shortId: string;

  @Column()
  uuid: string;

  @Column({ nullable: true })
  discordId?: string;

  @Column({ nullable: true })
  discordName?: string;

  @Column({ nullable: true })
  discordAvatar?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
