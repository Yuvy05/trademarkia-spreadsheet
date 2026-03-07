"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { database } from "@/lib/firebase";
import { ref, onValue, set, onDisconnect, serverTimestamp, get } from "firebase/database";
import { useSpreadsheetStore } from "@/store/useSpreadsheetStore";
import { Grid } from "@/components/Grid";
import { Loader2, ArrowLeft, Users, Cloud, CloudOff, CheckCircle2 } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';

export default function DocumentPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const [docTitle, setDocTitle] = useState("Loading...");
    const [presence, setPresence] = useState<Record<string, any>>({});
    const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "offline">("syncing");

    // User session color
    const [userColor, setUserColor] = useState('#3b82f6');

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push("/");
            return;
        }

        // Verify document exists
        const docRef = ref(database, `documents/${id}`);
        get(docRef).then(snap => {
            if (!snap.exists()) {
                router.push("/");
            }
        });

        // Generate random distinct color for session presence based on uuid
        const hexColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
        setUserColor(hexColor);

        // Document Meta listener
        const metaRef = ref(database, `documents/${id}/metadata/title`);
        const unsubscribeMeta = onValue(metaRef, (snap) => {
            setDocTitle(snap.val() || "Untitled Spreadsheet");
        });

        // Presence listener setup
        const presenceRef = ref(database, `documents/${id}/presence`);
        const myPresenceRef = ref(database, `documents/${id}/presence/${user.uid}`);

        // Setup online/offline tracking
        const connectedRef = ref(database, ".info/connected");

        const unsubscribeConn = onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                setSyncStatus("synced");
                const presenceData = {
                    name: user.displayName || "Anonymous",
                    color: hexColor,
                    activeCell: useSpreadsheetStore.getState().activeCell,
                    timestamp: serverTimestamp()
                };
                set(myPresenceRef, presenceData);
                onDisconnect(myPresenceRef).remove();
            } else {
                setSyncStatus("offline");
            }
        });

        const unsubscribePresence = onValue(presenceRef, (snap) => {
            setPresence(snap.val() || {});
        });

        // Subscribe to activeCell changes to update presence
        const unsubStore = useSpreadsheetStore.subscribe((state) => {
            if (syncStatus === "synced") {
                set(myPresenceRef, {
                    name: user.displayName || "Anonymous",
                    color: hexColor,
                    activeCell: state.activeCell,
                    timestamp: serverTimestamp()
                });
            }
        });

        return () => {
            unsubscribeMeta();
            unsubscribeConn();
            unsubscribePresence();
            unsubStore();
            set(myPresenceRef, null); // cleanup presence purely on client unmount as well
        };
    }, [id, user, authLoading, router]);

    const updateTitle = (newTitle: string) => {
        setDocTitle(newTitle);
        set(ref(database, `documents/${id}/metadata/title`), newTitle);
        set(ref(database, `documents/${id}/metadata/updatedAt`), serverTimestamp());
    };

    if (authLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    // Filter out self from active presence to render avatars
    const activeCollaborators = Object.entries(presence).filter(([uid]) => uid !== user.uid);

    return (
        <div className="flex flex-col h-screen bg-[#09090b] text-white overflow-hidden">
            {/* Top Toolbar */}
            <header className="h-14 border-b border-white/10 bg-[#18181b] flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push("/")}
                        className="p-1.5 hover:bg-white/10 rounded-md transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-400 hover:text-white" />
                    </button>

                    <input
                        type="text"
                        value={docTitle}
                        onChange={(e) => updateTitle(e.target.value)}
                        className="bg-transparent border border-transparent hover:border-white/10 focus:border-blue-500 focus:bg-[#09090b] px-2 py-1 rounded text-lg font-medium outline-none transition-all w-64"
                    />

                    <div className="h-5 w-px bg-white/10 mx-2" />

                    <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                        {syncStatus === 'synced' ? (
                            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Saved to cloud</span>
                        ) : syncStatus === 'syncing' ? (
                            <span className="flex items-center gap-1.5"><Cloud className="w-3.5 h-3.5 text-blue-400" /> Saving...</span>
                        ) : (
                            <span className="flex items-center gap-1.5"><CloudOff className="w-3.5 h-3.5 text-red-500" /> Offline</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Active Collaborators */}
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-500" />
                        <div className="flex -space-x-2">
                            {activeCollaborators.map(([uid, data]) => (
                                <div
                                    key={uid}
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 border-[#18181b] relative group"
                                    style={{ backgroundColor: data.color }}
                                    title={data.name}
                                >
                                    {data.name?.[0]?.toUpperCase() || 'A'}

                                    {/* Tooltip */}
                                    <span className="absolute -bottom-8 scale-0 transition-transform group-hover:scale-100 bg-[#09090b] text-white text-xs px-2 py-1 rounded whitespace-nowrap border border-white/10">
                                        {data.name}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* User's own avatar */}
                    <div className="flex items-center gap-2 pl-4 border-l border-white/10">
                        <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 border-transparent"
                            style={{ backgroundColor: userColor }}
                        >
                            {user.displayName?.[0]?.toUpperCase() || 'Y'}
                        </div>
                    </div>
                </div>
            </header>

            {/* Editor Main Canvas */}
            <main className="flex-1 overflow-hidden relative">
                <Grid docId={id as string} presence={presence} myUid={user.uid} />
            </main>
        </div>
    );
}
