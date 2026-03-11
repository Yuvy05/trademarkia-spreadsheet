"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { database } from "@/lib/firebase";
import { ref, onValue, set, onDisconnect, serverTimestamp, get, update } from "firebase/database";
import { useSpreadsheetStore } from "@/store/useSpreadsheetStore";
import { Grid } from "@/components/Grid";
import { Loader2, ArrowLeft, Users, Cloud, CloudOff, CheckCircle2, Download, Upload, Trash2, FileJson } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';

export default function DocumentPage() {
    const { id } = useParams();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const [docTitle, setDocTitle] = useState("Loading...");
    const [presence, setPresence] = useState<Record<string, any>>({});
    const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "offline">("syncing");
    const [sessionId] = useState(() => uuidv4());

    const fileInputRef = useRef<HTMLInputElement>(null);

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
        const myPresenceRef = ref(database, `documents/${id}/presence/${sessionId}`);

        // Setup online/offline tracking
        const connectedRef = ref(database, ".info/connected");

        const unsubscribeConn = onValue(connectedRef, (snap) => {
            if (snap.val() === true) {
                // you are online
                setSyncStatus("synced");
                const presenceData = {
                    name: user.displayName || "Anonymous",
                    color: hexColor,
                    activeCell: useSpreadsheetStore.getState().activeCell,
                    timestamp: serverTimestamp()
                };
                set(myPresenceRef, presenceData);
                onDisconnect(myPresenceRef).remove();
                // remove you from the DB if your wifi dies or tab closes
            } else {
                setSyncStatus("offline");
            }
        });

        const unsubscribePresence = onValue(presenceRef, (snap) => {
            setPresence(snap.val() || {});
        });

        // Subscribe to activeCell changes to update presence
        const unsubStore = useSpreadsheetStore.subscribe((state) => {
            set(myPresenceRef, {
                uid: user.uid,
                name: user.displayName || "Anonymous",
                color: hexColor,
                activeCell: state.activeCell,
                timestamp: serverTimestamp()
            });
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

    const handleExportCSV = async () => {
        const cellsRef = ref(database, `documents/${id}/cells`);
        const snap = await get(cellsRef);
        const cells = snap.val() || {};

        let csvContent = "data:text/csv;charset=utf-8,";
        for (let r = 1; r <= 100; r++) {
            let rowData = [];
            for (let c = 1; c <= 26; c++) {
                const colStr = String.fromCharCode(64 + c);
                const cellId = `${colStr}${r}`;
                const val = (cells[cellId]?.value || "").replace(/"/g, '""');
                rowData.push(val.includes(",") || val.includes('"') || val.includes('\\n') ? `"${val}"` : val);
            }
            csvContent += rowData.join(",") + "\\r\\n";
        }

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${docTitle || "spreadsheet"}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportJSON = async () => {
        const cellsRef = ref(database, `documents/${id}/cells`);
        const snap = await get(cellsRef);
        const cells = snap.val() || {};

        const jsonString = JSON.stringify(cells, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const href = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = href;
        link.download = `${docTitle || "spreadsheet"}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
    };

    const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target?.result as string;
            // Simple CSV regex matching rules
            const rows = text.split(/\\r?\\n/);
            const updates: Record<string, any> = {};

            for (let r = 0; r < Math.min(rows.length, 100); r++) {
                if (!rows[r].trim()) continue;
                // handle quoted strings and commas
                const cols = rows[r].match(/(".*?"|[^",\\s]+)(?=\\s*,|\\s*$)/g) || [];
                // If it's a completely empty line or just commas, the simple matcher might miss. 
                // We'll trust standard CSV generation to be robust mostly. For generic CSV, a robust parser is better, 
                // but this is an out of the box simple parser for our feature.
                const rowSplit = rows[r].split(",");

                for (let c = 0; c < Math.min(rowSplit.length, 26); c++) {
                    let val = rowSplit[c];
                    // remove surrounding quotes if exist
                    if (val.startsWith('"') && val.endsWith('"')) {
                        val = val.slice(1, -1).replace(/""/g, '"');
                    }
                    const cellId = `${String.fromCharCode(64 + c + 1)}${r + 1}`;
                    if (val && val.trim() !== '') {
                        updates[cellId] = {
                            value: val,
                            updatedBy: user?.uid || 'anonymous',
                            timestamp: serverTimestamp()
                        };
                    } else {
                        updates[cellId] = null; // clear cell
                    }
                }
            }
            await update(ref(database, `documents/${id}/cells`), updates);
            await update(ref(database, `documents/${id}/metadata`), { updatedAt: serverTimestamp() });
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClearAll = async () => {
        if (confirm("Are you sure you want to clear the entire spreadsheet?")) {
            await set(ref(database, `documents/${id}/cells`), null);
            await update(ref(database, `documents/${id}/metadata`), { updatedAt: serverTimestamp() });
        }
    };

    if (authLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    // Filter out self from active presence to render avatars
    const activeCollaborators = Object.entries(presence).filter(([sid]) => sid !== sessionId);

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

                <div className="flex items-center gap-2 lg:gap-4">
                    {/* Unique Features / Tools */}
                    <div className="flex items-center gap-1 bg-[#27272a] rounded-md px-1 py-1 mr-2">
                        <button
                            onClick={handleExportCSV}
                            title="Export to CSV"
                            className="p-1.5 hover:bg-white/10 rounded transition-colors"
                        >
                            <Download className="w-4 h-4 text-gray-400 hover:text-white" />
                        </button>
                        <button
                            onClick={handleExportJSON}
                            title="Export to JSON"
                            className="p-1.5 hover:bg-white/10 rounded transition-colors"
                        >
                            <FileJson className="w-4 h-4 text-gray-400 hover:text-white" />
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            title="Import from CSV"
                            className="p-1.5 hover:bg-white/10 rounded transition-colors"
                        >
                            <Upload className="w-4 h-4 text-gray-400 hover:text-white" />
                        </button>
                        <input
                            type="file"
                            accept=".csv"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleImportCSV}
                        />
                        <button
                            onClick={handleClearAll}
                            title="Clear All Cells"
                            className="p-1.5 hover:bg-white/10 rounded transition-colors"
                        >
                            <Trash2 className="w-4 h-4 text-red-500 hover:text-red-400" />
                        </button>
                    </div>

                    {/* Active Collaborators */}
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-500" />
                        <div className="flex -space-x-2">
                            {activeCollaborators.map(([sid, data]) => (
                                <div
                                    key={sid}
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
                <Grid docId={id as string} presence={presence} myUid={user.uid} mySessionId={sessionId} />
            </main>
        </div>
    );
}
