import { User, IUserRepository } from '../domain/User';
import { randomUUID } from 'crypto';

export class RegisterUserUseCase {
    constructor(private userRepository: IUserRepository) { }

    async execute(email: string, passwordPlain: string): Promise<Omit<User, 'passwordHash'>> {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }

        // Validate password strength
        if (passwordPlain.length < 8) {
            throw new Error('Password must be at least 8 characters');
        }

        const existing = await this.userRepository.findByEmail(email);
        if (existing) {
            throw new Error('User already exists');
        }

        const passwordHash = await Bun.password.hash(passwordPlain);

        const user: User = {
            id: randomUUID(),
            email,
            passwordHash,
            resetToken: null,
            resetTokenExpiry: null,
            createdAt: new Date(),
        };

        await this.userRepository.save(user);

        return {
            id: user.id,
            email: user.email,
            resetToken: user.resetToken,
            resetTokenExpiry: user.resetTokenExpiry,
            createdAt: user.createdAt,
        };
    }
}
