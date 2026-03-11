"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { database } from "@/lib/firebase";
import { ref, onValue, push, set, serverTimestamp } from "firebase/database";
import { useRouter } from "next/navigation";
import { Login } from "@/components/Login";
import { FileSpreadsheet, Plus, LogOut, Clock, Link as LinkIcon } from "lucide-react";

interface DocumentMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export default function Home() {
  const { user, logout } = useAuth();
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;

    // Fetch user documents index

    // The onValue listener updates the UI whenever data changes

    const userDocsRef = ref(database, `user_documents/${user.uid}`);
    const unsubscribe = onValue(userDocsRef, (snapshot) => {
      const docs = snapshot.val();
      if (!docs) {
        setDocuments([]);
        setLoading(false);
        return;
      }

      // Fetch metadata for each document
      const docPromises = Object.keys(docs).map((docId) => {
        return new Promise<DocumentMeta | null>((resolve) => {
          onValue(
            ref(database, `documents/${docId}/metadata`),
            (metaSnap) => {
              const meta = metaSnap.val();
              resolve(meta ? { id: docId, ...meta } : null);
            },
            { onlyOnce: true }
          );
        });
      });

      Promise.all(docPromises).then((results) => {
        setDocuments(results.filter((doc): doc is DocumentMeta => doc !== null).sort((a, b) => b.updatedAt - a.updatedAt));
        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, [user]);

  const createNewSheet = async () => {
    if (!user) return;
    const docRef = push(ref(database, "documents"));
    const docId = docRef.key;
    if (!docId) return;

    const initialData = {
      metadata: {
        title: "Untitled Spreadsheet",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ownerId: user.uid,
      },
      cells: {},
    };

    await set(docRef, initialData);
    await set(ref(database, `user_documents/${user.uid}/${docId}`), true);

    router.push(`/doc/${docId}`);
  };

  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-purple-500">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <span className="font-semibold text-lg tracking-tight">Trademarkia Sheets</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 flex items-center justify-center text-xs font-bold shrink-0">
                {user.displayName?.[0]?.toUpperCase() || 'G'}
              </div>
              <span className="text-sm font-medium text-gray-200 truncate max-w-[120px]">
                {user.displayName || 'Guest User'}
              </span>
            </div>
            <button
              onClick={logout}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Your Documents</h1>
            <p className="text-gray-400 text-sm">Access and collaborate on your spreadsheets</p>
          </div>
          <button
            onClick={createNewSheet}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-5 h-5" />
            New Spreadsheet
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-2xl bg-white/5 animate-pulse border border-white/5" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-20 bg-white/5 border border-white/10 rounded-3xl border-dashed">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileSpreadsheet className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-200 mb-2">No documents yet</h3>
            <p className="text-gray-400 mb-6 max-w-sm mx-auto">Create your first collaborative spreadsheet to start working with your team.</p>
            <button
              onClick={createNewSheet}
              className="text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Create new sheet
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => router.push(`/doc/${doc.id}`)}
                className="group cursor-pointer bg-[#18181b] rounded-2xl border border-white/10 p-6 hover:border-blue-500/50 hover:bg-[#18181b]/80 transition-all hover:shadow-xl hover:shadow-blue-500/10 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex items-start justify-between mb-4 relative z-10">
                  <div className="p-3 bg-white/5 rounded-xl text-blue-400 group-hover:scale-110 group-hover:bg-blue-500/10 transition-all">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(`${window.location.origin}/doc/${doc.id}`);
                    }}
                    className="p-2 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Copy link"
                  >
                    <LinkIcon className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="text-lg font-medium text-white mb-2 group-hover:text-blue-400 transition-colors relative z-10">
                  {doc.title || "Untitled Spreadsheet"}
                </h3>
                <div className="flex items-center gap-2 text-xs text-gray-500 relative z-10">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {doc.updatedAt
                      ? new Date(doc.updatedAt).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })
                      : "Recently modified"
                    }
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
