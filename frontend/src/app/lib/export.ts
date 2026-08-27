export const downloadCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
  // BOM so Excel renders Persian correctly
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const printReport = (title: string, headers: string[], rows: (string | number)[][]) => {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return;
  const html = `
<!DOCTYPE html><html dir="rtl" lang="fa"><head>
<meta charset="utf-8" />
<title>${title}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" />
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Vazirmatn', sans-serif; padding: 32px; color: #111; background: #fff; direction: rtl; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { padding: 10px 12px; text-align: right; border-bottom: 1px solid #eee; }
  th { background: #f7f7f7; font-weight: 700; }
  tr:nth-child(even) td { background: #fafafa; }
  @media print { body { padding: 0; } }
</style>
</head><body>
<h1>${title}</h1>
<div class="meta">${new Date().toLocaleString('fa-IR')}</div>
<table>
  <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
</table>
<script>window.onload = () => { setTimeout(() => window.print(), 300); };</script>
</body></html>`;
  w.document.write(html);
  w.document.close();
};
