const fs = require('fs');

const gridTsx = `
"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { database } from "@/lib/firebase";
import { ref, onValue, set, serverTimestamp, update } from "firebase/database";
import { useSpreadsheetStore } from "@/store/useSpreadsheetStore";
import { evaluateCell } from "@/lib/parser";
import { Bold, Italic, Palette } from "lucide-react";

const COLUMNS = 26;
const ROWS = 100;

function getColStr(num) {
    let str = '';
    let temp = num;
    while (temp > 0) {
        const mod = (temp - 1) % 26;
        str = String.fromCharCode(65 + mod) + str;
        temp = Math.floor((temp - mod) / 26);
    }
    return str;
}

const defaultColHeaders = Array.from({ length: COLUMNS }, (_, i) => getColStr(i + 1));
const defaultRowHeaders = Array.from({ length: ROWS }, (_, i) => i + 1);

export function Grid({ docId, presence, myUid }) {
    const [dbCells, setDbCells] = useState({});
    
    // Layout State
    const [colOrder, setColOrder] = useState(defaultColHeaders);
    const [rowOrder, setRowOrder] = useState(defaultRowHeaders);
    const [colWidths, setColWidths] = useState({});
    const [rowHeights, setRowHeights] = useState({});

    // Drag Resizing State
    const [resizingTarget, setResizingTarget] = useState(null);
    const [startSize, setStartSize] = useState(0);
    const [startPos, setStartPos] = useState(0);

    const {
        activeCell, setActiveCell,
        editingCell, setEditingCell,
        localValues, setLocalValue
    } = useSpreadsheetStore();

    const inputRef = useRef(null);
    const gridContainerRef = useRef(null);

    useEffect(() => {
        const cellsRef = ref(database, \`documents/\${docId}/cells\`);
        const unsub = onValue(cellsRef, (snap) => setDbCells(snap.val() || {}));
        
        const layoutRef = ref(database, \`documents/\${docId}/layout\`);
        const unsubLayout = onValue(layoutRef, (snap) => {
            const data = snap.val();
            if(data) {
                if(data.colOrder) setColOrder(data.colOrder);
                if(data.rowOrder) setRowOrder(data.rowOrder);
                if(data.colWidths) setColWidths(data.colWidths);
                if(data.rowHeights) setRowHeights(data.rowHeights);
            }
        });
        
        return () => { unsub(); unsubLayout(); };
    }, [docId]);

    useEffect(() => {
        if (editingCell && inputRef.current) {
            inputRef.current.focus();
            const len = inputRef.current.value.length;
            inputRef.current.setSelectionRange(len, len);
        }
    }, [editingCell]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!activeCell) return;

            const colStr = activeCell.replace(/[0-9]/g, '');
            const rowNum = parseInt(activeCell.replace(/[A-Z]/g, ''));
            const colIndex = colOrder.indexOf(colStr);
            const rowIndex = rowOrder.indexOf(rowNum);

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

            if (e.key === 'Enter') {
                setEditingCell(activeCell);
                const currentVal = localValues[activeCell] ?? dbCells[activeCell]?.value ?? '';
                setLocalValue(activeCell, currentVal);
                e.preventDefault();
                return;
            }

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                e.preventDefault();
                let nextRowIdx = rowIndex;
                let nextColIdx = colIndex;

                if (e.key === 'ArrowUp') nextRowIdx = Math.max(0, rowIndex - 1);
                if (e.key === 'ArrowDown') nextRowIdx = Math.min(rowOrder.length - 1, rowIndex + 1);
                if (e.key === 'ArrowLeft') nextColIdx = Math.max(0, colIndex - 1);
                if (e.key === 'ArrowRight' || e.key === 'Tab') nextColIdx = Math.min(colOrder.length - 1, colIndex + 1);

                const nextCell = \`\${colOrder[nextColIdx]}\${rowOrder[nextRowIdx]}\`;
                setActiveCell(nextCell);
                const el = document.getElementById(\`cell-\${nextCell}\`);
                if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                updateCellDatabase(activeCell, { value: '' });
            } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                setLocalValue(activeCell, e.key);
                setEditingCell(activeCell);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeCell, editingCell, dbCells, localValues, colOrder, rowOrder]);

    const updateCellDatabase = (cellId, updates) => {
        const cellRef = ref(database, \`documents/\${docId}/cells/\${cellId}\`);
        const currentData = dbCells[cellId] || {};
        
        if (!updates.value && currentData.value === undefined && Object.keys(updates).length === 1) {
             set(cellRef, null);
        } else {
             update(cellRef, { ...currentData, ...updates, updatedBy: myUid, timestamp: serverTimestamp() });
        }
        set(ref(database, \`documents/\${docId}/metadata/updatedAt\`), serverTimestamp());
    };

    const commitEdit = () => {
        if (!editingCell) return;
        const finalValue = localValues[editingCell];
        if (finalValue !== undefined) {
            updateCellDatabase(editingCell, { value: finalValue });
        }
        setEditingCell(null);
    };

    const toggleFormat = (formatType) => {
        if(!activeCell) return;
        const currentStyle = dbCells[activeCell]?.style || {};
        const isSet = currentStyle[formatType];
        updateCellDatabase(activeCell, { style: { ...currentStyle, [formatType]: !isSet } });
    };

    const setColor = (color) => {
        if(!activeCell) return;
        const currentStyle = dbCells[activeCell]?.style || {};
        updateCellDatabase(activeCell, { style: { ...currentStyle, color } });
    };

    const mapPresenceToCells = useMemo(() => {
        const map = {};
        Object.entries(presence).forEach(([uid, data]) => {
            if (uid !== myUid && data.activeCell) {
                map[data.activeCell] = { color: data.color, name: data.name };
            }
        });
        return map;
    }, [presence, myUid]);

    // Resizing Logics
    useEffect(() => {
        const onMouseMove = (e) => {
            if (!resizingTarget) return;
            if (resizingTarget.type === "col") {
                const diff = e.clientX - startPos;
                const newWidth = Math.max(40, startSize + diff);
                set(ref(database, \`documents/\${docId}/layout/colWidths/\${resizingTarget.id}\`), newWidth);
            } else {
                const diff = e.clientY - startPos;
                const newHeight = Math.max(20, startSize + diff);
                set(ref(database, \`documents/\${docId}/layout/rowHeights/\${resizingTarget.id}\`), newHeight);
            }
        };
        const onMouseUp = () => setResizingTarget(null);

        if (resizingTarget) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [resizingTarget, startPos, startSize, docId]);

    // Reordering Logics
    const handleColDrop = (e, targetCol) => {
        const sourceCol = e.dataTransfer.getData("col");
        if(sourceCol && sourceCol !== targetCol) {
            const newOrder = [...colOrder];
            const srcIdx = newOrder.indexOf(sourceCol);
            const tgtIdx = newOrder.indexOf(targetCol);
            newOrder.splice(srcIdx, 1);
            newOrder.splice(tgtIdx, 0, sourceCol);
            set(ref(database, \`documents/\${docId}/layout/colOrder\`), newOrder);
        }
    };
    
    const handleRowDrop = (e, targetRow) => {
        const sourceRow = parseInt(e.dataTransfer.getData("row"));
        if(sourceRow && sourceRow !== targetRow) {
            const newOrder = [...rowOrder];
            const srcIdx = newOrder.indexOf(sourceRow);
            const tgtIdx = newOrder.indexOf(targetRow);
            newOrder.splice(srcIdx, 1);
            newOrder.splice(tgtIdx, 0, sourceRow);
            set(ref(database, \`documents/\${docId}/layout/rowOrder\`), newOrder);
        }
    };

    return (
        <div className="absolute inset-0 flex flex-col bg-[#09090b]">
            {/* Format Toolbar */}
            <div className="h-10 shrink-0 bg-[#18181b] border-b border-[#27272a] flex items-center px-4 gap-4 z-40">
                <div className="flex bg-[#27272a] rounded p-1 gap-1">
                    <button onClick={() => toggleFormat('bold')} className="p-1 rounded hover:bg-white/10" disabled={!activeCell}>
                        <Bold className="w-4 h-4 text-gray-300" />
                    </button>
                    <button onClick={() => toggleFormat('italic')} className="p-1 rounded hover:bg-white/10" disabled={!activeCell}>
                        <Italic className="w-4 h-4 text-gray-300" />
                    </button>
                    <div className="relative p-1 rounded hover:bg-white/10 flex items-center justify-center cursor-pointer">
                        <Palette className="w-4 h-4 text-gray-300" />
                        <input 
                            type="color" 
                            className="absolute opacity-0 inset-0 w-full h-full cursor-pointer" 
                            onChange={e => setColor(e.target.value)}
                            disabled={!activeCell}
                        />
                    </div>
                </div>
                <div className="text-xs text-gray-500 font-medium">
                    {activeCell ? \`Selected: \${activeCell}\` : "Select a cell to style"}
                </div>
            </div>

            {/* Grid Area */}
            <div className="flex-1 overflow-auto relative" ref={gridContainerRef}>
            
            {/* Top Left Corner */}
            <div className="flex w-max">
                <div className="w-12 h-8 bg-[#18181b] border-r border-b border-[#27272a] sticky top-0 left-0 z-30" />

                {/* Column Headers */}
                <div className="flex sticky top-0 z-20">
                    {colOrder.map(col => {
                        const w = colWidths[col] || 112;
                        return (
                            <div 
                                key={col} 
                                draggable
                                onDragStart={(e) => e.dataTransfer.setData("col", col)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleColDrop(e, col)}
                                className="h-8 bg-[#18181b] border-r border-b border-[#27272a] flex items-center justify-center text-xs font-semibold text-gray-400 select-none relative hover:bg-white/5 cursor-grab active:cursor-grabbing"
                                style={{ width: w, minWidth: w }}
                            >
                                {col}
                                <div 
                                    className="absolute right-0 top-0 bottom-0 w-2 hover:bg-blue-500/50 cursor-col-resize z-10"
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        setResizingTarget({ type: 'col', id: col });
                                        setStartSize(w);
                                        setStartPos(e.clientX);
                                    }}
                                />
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Grid Rows */}
            {rowOrder.map(row => {
               const h = rowHeights[row] || 24;
               return (
                <div key={row} className="flex w-max">
                    {/* Row Header */}
                    <div 
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("row", row)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleRowDrop(e, row)}
                        className="w-12 bg-[#18181b] border-r border-b border-[#27272a] sticky left-0 z-20 flex items-center justify-center text-xs text-gray-400 select-none relative hover:bg-white/5 cursor-grab active:cursor-grabbing"
                        style={{ height: h, minHeight: h }}
                    >
                        {row}
                        <div 
                            className="absolute bottom-0 left-0 right-0 h-2 hover:bg-blue-500/50 cursor-row-resize z-10"
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                setResizingTarget({ type: 'row', id: row });
                                setStartSize(h);
                                setStartPos(e.clientY);
                            }}
                        />
                    </div>

                    {/* Row Cells */}
                    {colOrder.map(col => {
                        const cellId = \`\${col}\${row}\`;
                        const isActive = activeCell === cellId;
                        const isEditing = editingCell === cellId;
                        const cellPresence = mapPresenceToCells[cellId];
                        
                        const w = colWidths[col] || 112;
                        
                        const rawData = dbCells[cellId] || {};
                        const rawValue = isEditing ? (localValues[cellId] ?? rawData.value ?? '') : (rawData.value ?? '');

                        let displayValue = rawValue;
                        if (!isEditing && rawValue.startsWith('=')) {
                            displayValue = evaluateCell(cellId, dbCells);
                        }

                        // Styling
                        const styleSettings = rawData.style || {};
                        let textColor = styleSettings.color || 'text-gray-200';
                        if (displayValue.startsWith('#')) textColor = 'text-red-400 font-bold';
                        else if (!styleSettings.color && displayValue !== '' && !isNaN(Number(displayValue))) {
                            const num = Number(displayValue);
                            if (num < 0) textColor = 'text-red-400';
                            else if (num > 0) textColor = 'text-green-400';
                        }
                        
                        const customStyles = {};
                        if(styleSettings.bold) customStyles.fontWeight = 'bold';
                        if(styleSettings.italic) customStyles.fontStyle = 'italic';
                        if(styleSettings.color) customStyles.color = styleSettings.color;

                        return (
                            <div
                                id={\`cell-\${cellId}\`}
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
                                    setLocalValue(cellId, rawData.value ?? '');
                                }}
                                className={\`
                                  border-r border-b border-[#27272a] relative select-none
                                  \${isActive && !isEditing ? 'border-2 border-blue-500 z-10 bg-blue-500/10' : ''}
                                  \${!isActive && cellPresence ? 'border-2 z-10' : ''}
                                  \${!isActive && !cellPresence ? 'bg-[#18181b] hover:bg-[#27272a]/50' : ''}
                                \`}
                                style={{
                                    width: w, minWidth: w, height: h, minHeight: h,
                                    ...(!isActive && cellPresence ? {
                                        borderColor: cellPresence.color,
                                        backgroundColor: \`\${cellPresence.color}22\`
                                    } : {})
                                }}
                            >
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
                                        style={customStyles}
                                        value={localValues[cellId] ?? ''}
                                        onChange={(e) => setLocalValue(cellId, e.target.value)}
                                        onBlur={commitEdit}
                                    />
                                ) : (
                                    <div 
                                      className={\`px-1.5 py-1 text-xs truncate w-full h-full \${!styleSettings.color && textColor.startsWith('text-') ? textColor : ''}\`}
                                      style={customStyles}
                                    >
                                        {displayValue}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
               );
            })}
            <div className="h-20" /> {/* Bottom padding */}
            </div>
        </div>
    );
}
`;

fs.writeFileSync('./src/components/Grid.tsx', gridTsx);
console.log('Updated Grid.tsx!');
