import { create } from 'zustand';

interface SpreadsheetState {
    activeCell: string | null;
    editingCell: string | null;
    setActiveCell: (id: string | null) => void;
    setEditingCell: (id: string | null) => void;
    selectionRange: string[];
    setSelectionRange: (range: string[]) => void;
    localValues: Record<string, string>; // Unsaved temporary values
    setLocalValue: (id: string, value: string) => void;
}

export const useSpreadsheetStore = create<SpreadsheetState>((set) => ({
    activeCell: null,
    editingCell: null,
    setActiveCell: (id) => set({ activeCell: id }),
    setEditingCell: (id) => set({ editingCell: id }),
    selectionRange: [],
    setSelectionRange: (range) => set({ selectionRange: range }),
    localValues: {},
    setLocalValue: (id, value) =>
        set((state) => ({ localValues: { ...state.localValues, [id]: value } })),
}));
