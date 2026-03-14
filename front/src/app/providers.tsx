'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from '../contexts/AuthContext';
import { useSync } from '../hooks/useSync';

function SyncProvider({ children }: { children: React.ReactNode }) {
    useSync();
    return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <AuthProvider>
            <QueryClientProvider client={queryClient}>
                <SyncProvider>
                    {children}
                </SyncProvider>
            </QueryClientProvider>
        </AuthProvider>
    );
}
