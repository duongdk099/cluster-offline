import { User, IUserRepository } from '../domain/User';
import { sign } from 'hono/jwt';

export class LoginUserUseCase {
    constructor(private userRepository: IUserRepository, private jwtSecret: string) { }

    async execute(email: string, passwordPlain: string): Promise<{ token: string; user: Omit<User, 'passwordHash'> }> {
        const user = await this.userRepository.findByEmail(email);
        if (!user) {
            throw new Error('Invalid credentials');
        }

        const isValid = await Bun.password.verify(passwordPlain, user.passwordHash);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }

        const payload = {
            sub: user.id,
            email: user.email,
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
        };

        const token = await sign(payload, this.jwtSecret);

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                resetToken: user.resetToken,
                resetTokenExpiry: user.resetTokenExpiry,
                createdAt: user.createdAt,
            }
        };
    }
}
