// Simple Formula Engine matching Excel syntax: =A1+B2, =SUM(A1:A5), etc.

type CellData = { value: string };
type Snapshot = Record<string, CellData>;

const CELL_REF_REGEX = /[A-Z]+[0-9]+/g;
const RANGE_REGEX = /([A-Z]+[0-9]+):([A-Z]+[0-9]+)/g;

function getColIndex(colStr: string) {
    let num = 0;
    for (let i = 0; i < colStr.length; i++) {
        num = num * 26 + (colStr.charCodeAt(i) - 64);
    }
    return num;
}

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

function expandRange(startRef: string, endRef: string): string[] {
    const startColStr = startRef.replace(/[0-9]/g, '');
    const startRow = parseInt(startRef.replace(/[A-Z]/g, ''));
    const endColStr = endRef.replace(/[0-9]/g, '');
    const endRow = parseInt(endRef.replace(/[A-Z]/g, ''));

    const startCol = getColIndex(startColStr);
    const endCol = getColIndex(endColStr);

    const cells = [];
    for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
        for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
            cells.push(`${getColStr(c)}${r}`);
        }
    }
    return cells;
}

export function evaluateFormula(formula: string, snapshot: Snapshot, visited = new Set<string>()): string {
    if (!formula.startsWith('=')) return formula;

    const expression = formula.slice(1).toUpperCase();

    // Handle =SUM(A1:A5)
    if (expression.startsWith('SUM(') && expression.endsWith(')')) {
        const args = expression.slice(4, -1);

        // Expand ranges A1:B2 to A1, A2, B1, B2
        const expandedArgs = args.replace(RANGE_REGEX, (match, start, end) => {
            return expandRange(start, end).join(',');
        });

        const cellRefs = expandedArgs.split(',').map(s => s.trim());
        let sum = 0;

        for (const ref of cellRefs) {
            if (!isCellRef(ref)) {
                const num = parseFloat(ref);
                if (!isNaN(num)) sum += num;
                continue;
            }
            const val = evaluateCell(ref, snapshot, visited);
            const num = parseFloat(val);
            if (!isNaN(num)) sum += num;
        }
        return sum.toString();
    }

    // Handle basic arithmetic by substituting cell refs with their evaluated numbers
    // DANGEROUS: eval() is used for simplicity, but we sanitize to only arithmetic and digits
    let evalString = expression;
    let hasCycle = false;

    evalString = evalString.replace(CELL_REF_REGEX, (match) => {
        try {
            const val = evaluateCell(match, snapshot, visited);
            const num = parseFloat(val);
            return isNaN(num) ? '0' : num.toString();
        } catch (e: any) {
            hasCycle = true;
            return '0';
        }
    });

    if (hasCycle) return '#CYCLE!';

    try {
        // Basic sanitization
        if (!/^[0-9+\-*/().\s]+$/.test(evalString)) {
            return '#ERROR!';
        }
        // eslint-disable-next-line no-eval
        const result = eval(evalString);
        return Number.isFinite(result) ? result.toString() : '#ERROR!';
    } catch {
        return '#ERROR!';
    }
}

function isCellRef(str: string) {
    return /^[A-Z]+[0-9]+$/.test(str);
}

export function evaluateCell(cellId: string, snapshot: Snapshot, visited = new Set<string>()): string {
    if (visited.has(cellId)) {
        throw new Error('#CYCLE!');
    }

    const cellData = snapshot[cellId];
    if (!cellData || !cellData.value) return '';

    const rawValue = cellData.value;
    if (!rawValue.startsWith('=')) {
        return rawValue; // It's literal text or number
    }

    visited.add(cellId);
    try {
        const result = evaluateFormula(rawValue, snapshot, visited);
        visited.delete(cellId);
        return result;
    } catch (err: any) {
        visited.delete(cellId);
        return err.message || '#ERROR!';
    }
}
