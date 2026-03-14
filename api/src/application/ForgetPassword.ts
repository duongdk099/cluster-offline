import { IUserRepository } from '../domain/User';
import { randomUUID } from 'crypto';

export class ForgetPasswordUseCase {
    constructor(private userRepository: IUserRepository) { }

    async execute(email: string): Promise<string | null> {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw new Error('Invalid email format');
        }

        const user = await this.userRepository.findByEmail(email);
        if (!user) {
            // Do not reveal that the user does not exist
            return null;
        }

        // Generate a random reset token
        const resetToken = randomUUID().replace(/-/g, '');
        // Set expiry to 1 hour from now
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

        await this.userRepository.update(user.id, {
            resetToken,
            resetTokenExpiry
        });

        // In a real application, you would send this token via email.
        // For this backend, we simply return it to the caller.
        return resetToken;
    }
}
