import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Folder {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    folderName: string;

    @Column({ nullable: true })
    totalNumberOfDocs: number;

    @Column()
    isTrained: boolean;

    @Column()
    reTrainingRequired: boolean;
}