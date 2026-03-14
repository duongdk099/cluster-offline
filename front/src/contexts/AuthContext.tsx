'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
    token: string | null;
    login: (token: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        // Try cookie first, then localStorage for backwards compatibility
        const cookieToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('token='))
            ?.split('=')[1];
        
        const storedToken = cookieToken || localStorage.getItem('token');
        
        if (storedToken) {
            setToken(storedToken);
            // Ensure cookie is set for server actions
            document.cookie = `token=${storedToken}; path=/; max-age=${7 * 24 * 60 * 60}`; // 7 days
        } else {
            router.push('/login');
        }
    }, [router]);

    const login = (newToken: string) => {
        setToken(newToken);
        localStorage.setItem('token', newToken);
        // Set cookie for server actions
        document.cookie = `token=${newToken}; path=/; max-age=${7 * 24 * 60 * 60}`; // 7 days
        router.push('/');
    };

    const logout = () => {
        setToken(null);
        localStorage.removeItem('token');
        // Clear cookie
        document.cookie = 'token=; path=/; max-age=0';
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{ token, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
