import * as XLSX from 'xlsx';

/**
 * Export any list of rows (array of objects) to an Excel .xlsx download.
 *
 * @param {Array<Object>} rows      – flat objects to write (columns inferred from headers)
 * @param {Array<{key:string,label:string,fmt?:Function}>} headers – ordered columns
 * @param {string} filename         – file name without extension (date auto-appended)
 * @param {string} sheetName        – Excel sheet tab name
 */
export const exportRowsToExcel = (rows, headers, filename = 'export', sheetName = 'Sheet1') => {
  if (!rows || rows.length === 0) {
    alert('No records to export');
    return;
  }
  const headerLabels = headers.map(h => h.label);
  const data = [
    [`${sheetName} Export`],
    ['Generated', new Date().toLocaleString('en-IN')],
    [],
    headerLabels,
    ...rows.map(row =>
      headers.map(h => {
        const raw = row[h.key];
        if (h.fmt) return h.fmt(raw, row);
        if (raw === null || raw === undefined) return '';
        if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
        if (Array.isArray(raw)) return raw.join(', ');
        return raw;
      })
    ),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 30));
  const stamp = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${filename}_${stamp}.xlsx`);
};

export const fmtDateTime = (v) => {
  if (!v) return '';
  try { return new Date(v).toLocaleString('en-IN'); } catch { return String(v); }
};
