"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Loader2, ArrowRight } from "lucide-react";

export function Login() {
    const { signInWithGoogle, signInGuest, loading } = useAuth();
    const [name, setName] = useState("");
    const [isJoining, setIsJoining] = useState(false);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    const handleGuestJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setIsJoining(true);
        await signInGuest(name.trim());
        setIsJoining(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#09090b] relative overflow-hidden">
            {/* Background decorations */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/20 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-purple-500/20 blur-[120px] rounded-full pointer-events-none" />

            <div className="w-full max-w-md p-8 bg-[#18181b]/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl relative z-10 mx-4">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-500 to-purple-500 mb-6 shadow-lg shadow-blue-500/25">
                        <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-white stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <path d="M22 10H2" />
                            <path d="M10 22V4" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Trademarkia Sheets</h1>
                    <p className="text-gray-400">Real-time collaborative spreadsheet</p>
                </div>

                <div className="space-y-6">
                    <button
                        onClick={signInWithGoogle}
                        className="w-full relative group overflow-hidden bg-white text-black font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-3 hover:scale-[1.02] transition-transform"
                    >
                        <div className="absolute inset-0 bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <svg className="w-5 h-5 relative z-10" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span className="relative z-10">Continue with Google</span>
                    </button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-[#18181b] text-gray-400">Or join as guest</span>
                        </div>
                    </div>

                    <form onSubmit={handleGuestJoin} className="space-y-4">
                        <div>
                            <input
                                type="text"
                                placeholder="Enter your display name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-[#09090b] border border-white/10 text-white rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-gray-500"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!name.trim() || isJoining}
                            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isJoining ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    Join session
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
