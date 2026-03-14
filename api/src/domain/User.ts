export interface User {
    id: string;
    email: string;
    passwordHash: string;
    resetToken: string | null;
    resetTokenExpiry: Date | null;
    createdAt: Date;
}

export interface IUserRepository {
    save(user: User): Promise<void>;
    findByEmail(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    findByResetToken(token: string): Promise<User | null>;
    update(id: string, userData: Partial<User>): Promise<void>;
}
