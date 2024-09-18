import { AppDataSource } from '../db/data_source'; // Import your data source
import { User } from '../entities/user'; // Import the User entity
import { Repository } from 'typeorm';

export class UserRepository {
    private userRepo: Repository<User>;

    constructor() {
        this.userRepo = AppDataSource.getRepository(User); // Get the User repository from AppDataSource
    }

    // Find a user by email
    async findUserByEmail(email: string): Promise<User | null> {
        return await this.userRepo.findOneBy({ email });
    }

    // Create and save a new user
    async createUser(user: Partial<User>): Promise<User> {
        const newUser = this.userRepo.create(user); // Create a new user instance
        return await this.userRepo.save(newUser); // Save the new user
    }

    // Find a user by ID
    async findUserById(userId: number): Promise<User | null> {
        return await this.userRepo.findOneBy({ id: userId });
    }

    // Update a user
    async updateUser(userId: number, updatedData: Partial<User>): Promise<User | null> {
        await this.userRepo.update(userId, updatedData); // Update the user data
        return await this.findUserById(userId); // Return the updated user
    }

    async findUserByOAuthProvider(email: string, oAuthProvider: string): Promise<User | null> {
        return await this.userRepo.findOne({ where: { email, oAuthProvider } });
    }

    // Delete a user
    async deleteUser(userId: number): Promise<void> {
        await this.userRepo.delete(userId); // Delete the user by ID
    }
}