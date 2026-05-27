import { app } from '../src/index';
import { client } from '../src/infrastructure/db';

export { app, client };

// Unique per test run so parallel/repeat runs never collide, and cleanup can
// target exactly the rows this run created.
export const TEST_EMAIL_PREFIX = `test_${Date.now()}_${Math.floor(Math.random() * 1e6)}_`;

let counter = 0;
export function uniqueEmail(): string {
    counter += 1;
    return `${TEST_EMAIL_PREFIX}${counter}@example.com`;
}

const json = { 'Content-Type': 'application/json' };

export type Auth = {
    email: string;
    userId: string;
    token: string;
    headers: Record<string, string>;
};

export async function registerAndLogin(password = 'Passw0rd!'): Promise<Auth> {
    const email = uniqueEmail();

    const reg = await app.request('/auth/register', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ email, password }),
    });
    if (reg.status !== 201) {
        throw new Error(`register failed: ${reg.status} ${await reg.text()}`);
    }
    const user = await reg.json();

    const log = await app.request('/auth/login', {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ email, password }),
    });
    if (log.status !== 200) {
        throw new Error(`login failed: ${log.status} ${await log.text()}`);
    }
    const { token } = await log.json();

    return {
        email,
        userId: user.id as string,
        token: token as string,
        headers: { ...json, Authorization: `Bearer ${token}` },
    };
}

// Deletes every user created by this test run; cascades remove their notes,
// folders, tags and note_tags via the schema's onDelete: 'cascade'.
export async function cleanupTestUsers(): Promise<void> {
    await client`DELETE FROM users WHERE email LIKE ${TEST_EMAIL_PREFIX + '%'}`;
}

export const sampleContent = {
    type: 'doc',
    content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] },
    ],
};
