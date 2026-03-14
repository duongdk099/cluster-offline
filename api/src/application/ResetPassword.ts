import { IUserRepository } from '../domain/User';

export class ResetPasswordUseCase {
    constructor(private userRepository: IUserRepository) { }

    async execute(token: string, newPasswordPlain: string): Promise<boolean> {
        const user = await this.userRepository.findByResetToken(token);

        if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
            return false;
        }

        const passwordHash = await Bun.password.hash(newPasswordPlain);

        await this.userRepository.update(user.id, {
            passwordHash,
            resetToken: null,
            resetTokenExpiry: null,
        });

        return true;
    }
}

