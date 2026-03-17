'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const router = useRouter();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/auth/register` : 'http://localhost:3001/auth/register';
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to register');
            }

            setSuccess('Registration successful! Redirecting to login...');
            setTimeout(() => {
                router.push('/login');
            }, 2000);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to register');
        }
    };

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_80%_5%,rgba(56,189,248,0.18),transparent_36%),linear-gradient(160deg,#eaf1f8_0%,#f6f9ff_58%,#eaf4fd_100%)] dark:bg-[radial-gradient(circle_at_80%_8%,rgba(14,165,233,0.22),transparent_38%),linear-gradient(160deg,#0c111b_0%,#101827_55%,#0f1724_100%)] px-4 py-6 md:p-8 flex items-center justify-center">
            <div className="w-full max-w-5xl rounded-[28px] border border-black/10 dark:border-white/10 bg-white/72 dark:bg-slate-900/62 backdrop-blur-2xl shadow-[0_26px_70px_rgba(2,6,23,0.2)] overflow-hidden grid md:grid-cols-[1.1fr_1fr]">
                <section className="hidden md:flex flex-col justify-between p-10 bg-black/4 dark:bg-white/3 border-r border-black/10 dark:border-white/10">
                    <div>
                        <p className="text-xs tracking-[0.28em] uppercase text-slate-500 dark:text-slate-400 font-bold">NotesAides</p>
                        <h1 className="mt-6 text-4xl leading-tight font-bold text-slate-900 dark:text-slate-100">
                            Create your writing cockpit.
                        </h1>
                        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300 max-w-sm leading-relaxed">
                            Set up your account and start organizing ideas in a structured application experience built for desktop and mobile.
                        </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-black/10 dark:border-white/10 p-3">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Unified</p>
                            <p className="mt-1 text-sm font-semibold">Desktop</p>
                        </div>
                        <div className="rounded-2xl border border-black/10 dark:border-white/10 p-3">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Fluid</p>
                            <p className="mt-1 text-sm font-semibold">Mobile</p>
                        </div>
                        <div className="rounded-2xl border border-black/10 dark:border-white/10 p-3">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Private</p>
                            <p className="mt-1 text-sm font-semibold">Storage</p>
                        </div>
                    </div>
                </section>

                <section className="p-6 sm:p-10">
                    <h2 className="text-2xl md:text-3xl tracking-tight font-bold text-gray-900 dark:text-gray-100">
                        Create account
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Already have one?{' '}
                        <Link href="/login" className="font-semibold text-gray-900 dark:text-gray-100 underline underline-offset-4">
                            Sign in
                        </Link>
                    </p>

                    <form className="space-y-5 mt-8" onSubmit={handleRegister}>
                        {error && (
                            <div className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 p-3 rounded-xl text-sm text-center">
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 p-3 rounded-xl text-sm text-center">
                                {success}
                            </div>
                        )}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Email address
                            </label>
                            <div className="mt-1">
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="appearance-none block w-full px-4 py-2.5 border border-gray-300/80 dark:border-gray-600 rounded-xl shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 focus:border-transparent sm:text-sm bg-white/80 dark:bg-white/5"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Password
                            </label>
                            <div className="mt-1">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="appearance-none block w-full px-4 py-2.5 border border-gray-300/80 dark:border-gray-600 rounded-xl shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 focus:border-transparent sm:text-sm bg-white/80 dark:bg-white/5"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 dark:bg-gray-100 dark:text-black dark:hover:bg-gray-200 dark:focus:ring-gray-100 transition-all duration-200"
                            >
                                Register
                            </button>
                        </div>
                    </form>
                </section>
            </div>
        </div>
    );
}
