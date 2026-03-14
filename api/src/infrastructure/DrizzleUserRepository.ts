import { User, IUserRepository } from '../domain/User';
import { db } from './db';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';

export class DrizzleUserRepository implements IUserRepository {
    async save(user: User): Promise<void> {
        await db.insert(users).values({
            id: user.id,
            email: user.email,
            passwordHash: user.passwordHash,
            resetToken: user.resetToken,
            resetTokenExpiry: user.resetTokenExpiry,
            createdAt: user.createdAt,
        });
    }

    async findByEmail(email: string): Promise<User | null> {
        const result = await db.query.users.findFirst({
            where: eq(users.email, email),
        });

        if (!result) return null;
        return {
            id: result.id,
            email: result.email,
            passwordHash: result.passwordHash,
            resetToken: result.resetToken,
            resetTokenExpiry: result.resetTokenExpiry,
            createdAt: result.createdAt,
        };
    }

    async findById(id: string): Promise<User | null> {
        const result = await db.query.users.findFirst({
            where: eq(users.id, id),
        });

        if (!result) return null;
        return {
            id: result.id,
            email: result.email,
            passwordHash: result.passwordHash,
            resetToken: result.resetToken,
            resetTokenExpiry: result.resetTokenExpiry,
            createdAt: result.createdAt,
        };
    }

    async update(id: string, userData: Partial<User>): Promise<void> {
        await db.update(users)
            .set(userData)
            .where(eq(users.id, id));
    }

    async findByResetToken(token: string): Promise<User | null> {
        const result = await db.query.users.findFirst({
            where: eq(users.resetToken, token),
        });

        if (!result) return null;
        return {
            id: result.id,
            email: result.email,
            passwordHash: result.passwordHash,
            resetToken: result.resetToken,
            resetTokenExpiry: result.resetTokenExpiry,
            createdAt: result.createdAt,
        };
    }
}
