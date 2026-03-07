"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { database } from "@/lib/firebase";
import { ref, onValue, set, serverTimestamp } from "firebase/database";
import { useSpreadsheetStore } from "@/store/useSpreadsheetStore";
import { evaluateCell } from "@/lib/parser";

const COLUMNS = 26;
const ROWS = 100;

function getColStr(num: number) {
    let str = '';
    let temp = num;
    while (temp > 0) {
        const mod = (temp - 1) % 26;
        str = String.fromCharCode(65 + mod) + str;
        temp = Math.floor((temp - mod) / 26);
    }
    return str;
}

const colHeaders = Array.from({ length: COLUMNS }, (_, i) => getColStr(i + 1));
const rowHeaders = Array.from({ length: ROWS }, (_, i) => i + 1);

interface GridProps {
    docId: string;
    presence: Record<string, any>;
    myUid: string;
}

export function Grid({ docId, presence, myUid }: GridProps) {
    const [dbCells, setDbCells] = useState<Record<string, any>>({});

    const {
        activeCell, setActiveCell,
        editingCell, setEditingCell,
        localValues, setLocalValue
    } = useSpreadsheetStore();

    const inputRef = useRef<HTMLInputElement>(null);
    const gridContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // 1. Fetch entire cells snapshot
        const cellsRef = ref(database, `documents/${docId}/cells`);
        const unsub = onValue(cellsRef, (snap) => {
            setDbCells(snap.val() || {});
        });
        return unsub;
    }, [docId]);

    // Focus input when editing starts
    useEffect(() => {
        if (editingCell && inputRef.current) {
            inputRef.current.focus();
            // Move cursor to end
            const len = inputRef.current.value.length;
            inputRef.current.setSelectionRange(len, len);
        }
    }, [editingCell]);

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!activeCell) return;

            const colStr = activeCell.replace(/[0-9]/g, '');
            const rowNum = parseInt(activeCell.replace(/[A-Z]/g, ''));
            const colIndex = colHeaders.indexOf(colStr);

            if (editingCell) {
                if (e.key === 'Enter') {
                    commitEdit();
                    e.preventDefault();
                } else if (e.key === 'Escape') {
                    setEditingCell(null);
                    e.preventDefault();
                }
                return;
            }

            // Navigation mode
            if (e.key === 'Enter') {
                setEditingCell(activeCell);
                const currentVal = localValues[activeCell] ?? dbCells[activeCell]?.value ?? '';
                setLocalValue(activeCell, currentVal); // Ensure it's ready for editing
                e.preventDefault();
                return;
            }

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                e.preventDefault();
                let nextRow = rowNum;
                let nextColIdx = colIndex;

                if (e.key === 'ArrowUp') nextRow = Math.max(1, rowNum - 1);
                if (e.key === 'ArrowDown') nextRow = Math.min(ROWS, rowNum + 1);
                if (e.key === 'ArrowLeft') nextColIdx = Math.max(0, colIndex - 1);
                if (e.key === 'ArrowRight' || e.key === 'Tab') nextColIdx = Math.min(COLUMNS - 1, colIndex + 1);

                const nextCell = `${colHeaders[nextColIdx]}${nextRow}`;
                setActiveCell(nextCell);

                // Let's implement lightweight auto-scroll
                const el = document.getElementById(`cell-${nextCell}`);
                if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                updateCellDatabase(activeCell, '');
            } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                // Start typing immediately overrides
                setLocalValue(activeCell, e.key);
                setEditingCell(activeCell);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCell, editingCell, dbCells, localValues]);

    const updateCellDatabase = (cellId: string, value: string) => {
        if (!value.trim()) {
            set(ref(database, `documents/${docId}/cells/${cellId}`), null);
        } else {
            set(ref(database, `documents/${docId}/cells/${cellId}`), {
                value,
                updatedBy: myUid,
                timestamp: serverTimestamp()
            });
        }
        // Update doc updatedAt
        set(ref(database, `documents/${docId}/metadata/updatedAt`), serverTimestamp());
    };

    const commitEdit = () => {
        if (!editingCell) return;
        const finalValue = localValues[editingCell];

        if (finalValue !== undefined) {
            updateCellDatabase(editingCell, finalValue);
        }
        setEditingCell(null);
    };

    const mapPresenceToCells = useMemo(() => {
        const map: Record<string, { color: string, name: string }> = {};
        Object.entries(presence).forEach(([uid, data]) => {
            if (uid !== myUid && data.activeCell) {
                map[data.activeCell] = { color: data.color, name: data.name };
            }
        });
        return map;
    }, [presence, myUid]);

    return (
        <div className="absolute inset-0 overflow-auto bg-[#09090b]" ref={gridContainerRef}>
            {/* Top Left Corner */}
            <div className="flex w-max">
                <div className="w-12 h-8 bg-[#18181b] border-r border-b border-[#27272a] sticky top-0 left-0 z-30" />

                {/* Column Headers */}
                <div className="flex sticky top-0 z-20">
                    {colHeaders.map(col => (
                        <div key={col} className="w-28 h-8 bg-[#18181b] border-r border-b border-[#27272a] flex items-center justify-center text-xs font-semibold text-gray-400 select-none">
                            {col}
                        </div>
                    ))}
                </div>
            </div>

            {/* Grid Rows */}
            {rowHeaders.map(row => (
                <div key={row} className="flex w-max">
                    {/* Row Header */}
                    <div className="w-12 h-6 bg-[#18181b] border-r border-b border-[#27272a] sticky left-0 z-20 flex items-center justify-center text-xs text-gray-400 select-none">
                        {row}
                    </div>

                    {/* Row Cells */}
                    {colHeaders.map(col => {
                        const cellId = `${col}${row}`;
                        const isActive = activeCell === cellId;
                        const isEditing = editingCell === cellId;

                        const cellPresence = mapPresenceToCells[cellId];

                        // Evaluated Value calculation
                        const rawValue = isEditing ? (localValues[cellId] ?? dbCells[cellId]?.value ?? '') : (dbCells[cellId]?.value ?? '');

                        let displayValue = rawValue;
                        if (!isEditing && rawValue.startsWith('=')) {
                            displayValue = evaluateCell(cellId, dbCells);
                        }

                        return (
                            <div
                                id={`cell-${cellId}`}
                                key={cellId}
                                onClick={() => {
                                    if (!isEditing) {
                                        setActiveCell(cellId);
                                        if (editingCell && editingCell !== cellId) commitEdit();
                                    }
                                }}
                                onDoubleClick={() => {
                                    setActiveCell(cellId);
                                    setEditingCell(cellId);
                                    setLocalValue(cellId, dbCells[cellId]?.value ?? '');
                                }}
                                className={`
                  w-28 h-6 border-r border-b border-[#27272a] relative select-none
                  ${isActive && !isEditing ? 'border-2 border-blue-500 z-10 bg-blue-500/10' : ''}
                  ${!isActive && cellPresence ? 'border-2 z-10' : ''}
                  ${!isActive && !cellPresence ? 'bg-[#18181b] hover:bg-[#27272a]/50' : ''}
                `}
                                style={!isActive && cellPresence ? {
                                    borderColor: cellPresence.color,
                                    backgroundColor: `${cellPresence.color}22`
                                } : {}}
                            >
                                {/* Presence Label Ring */}
                                {!isActive && cellPresence && (
                                    <div
                                        className="absolute -top-[18px] -right-[2px] text-[9px] px-1 py-0.5 rounded-sm text-white font-bold whitespace-nowrap z-20"
                                        style={{ backgroundColor: cellPresence.color }}
                                    >
                                        {cellPresence.name}
                                    </div>
                                )}

                                {isActive && isEditing ? (
                                    <input
                                        ref={inputRef}
                                        className="absolute inset-0 w-full h-full bg-[#09090b] text-white border-2 border-blue-500 outline-none px-1 text-xs z-30 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                                        value={localValues[cellId] ?? ''}
                                        onChange={(e) => setLocalValue(cellId, e.target.value)}
                                        onBlur={commitEdit}
                                    />
                                ) : (
                                    <div className={`px-1.5 py-1 text-xs truncate w-full h-full ${displayValue.startsWith('#') ? 'text-red-400 font-bold' : 'text-gray-200'}`}>
                                        {displayValue}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
            <div className="h-20" /> {/* Bottom padding */}
        </div>
    );
}
