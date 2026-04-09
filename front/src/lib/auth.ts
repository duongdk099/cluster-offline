export function getUserIdFromToken(token: string | null | undefined): string | null {
    if (!token) {
        return null;
    }

    const parts = token.split('.');
    if (parts.length < 2) {
        return null;
    }

    try {
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
        const payload = JSON.parse(atob(padded)) as { sub?: unknown };
        return typeof payload.sub === 'string' && payload.sub.trim() ? payload.sub : null;
    } catch {
        return null;
    }
}
