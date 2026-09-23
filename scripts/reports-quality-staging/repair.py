from pathlib import Path
import re, hashlib, runpy
root=Path('src/modules/reports')
stage=Path('scripts/reports-quality-staging')
def guard(path,sha):
    b=path.read_bytes();assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==sha, f'Concurrent edit: {path}'
p=root/'io-history/rpt08/controls.tsx';guard(p,'b5db5553d0455e85d4296cfd619d98f90b6f4f61')
s=p.read_text();a=s.index('function SelectControl<');b=s.index('function DateRangeControl(',a);s=s[:a]+s[b:]
s=s.replace('import { useEffect, useId, useRef, useState, type ReactNode } from "react";','import { SelectControl } from "./SelectControl";')
s=s.replace('ariaLabel="Kho"','ariaLabel={tUi("updatedUi.text_19c608bfa103")}').replace('ariaLabel="Loại giao dịch"','ariaLabel={tUi("updatedUi.text_94c1cbc6d405")}').replace('ariaLabel="Người thực hiện"','ariaLabel={tUi("inventory.trace.colPerformedBy")}')
s=s.replace('<i />\n              {" " + tUi("dashboard.snapshot.warehouseActive")}','{tUi("updatedUi.text_23d058563849")}')
p.write_text(s)
for name in ['SelectControl.tsx','SelectControl.test.tsx','controls.css']:
    (root/'io-history/rpt08'/name).write_text((stage/(name+'.txt')).read_text())
p=root/'io-history/io-history-report.css'
assert 'controls.css' not in p.read_text();p.write_text(p.read_text()+'@import "./rpt08/controls.css";\n')
p=root/'io-history/rpt08/base.css';s=p.read_text();s=s.replace('height: 46px !important;', 'height: 100% !important;');p.write_text(s)
p=root/'io-history/rpt08/table-states.css';s=p.read_text();a=s.index('.rpt08-date-popup');head,tail=s[:a],s[a:]
for old,new in {'#0788c9':'var(--ops-primary)','#004e74':'var(--ops-primary)','#eaf7fc':'var(--ops-pale)','rgba(7,136,201,0.11)':'var(--ops-pale)'}.items():tail=tail.replace(old,new)
tail=re.sub(r'#fff(?![0-9a-fA-F])','var(--ops-on-primary)',tail)
p.write_text(head+tail)
runpy.run_path(str(stage/'repair-warranty.py'),run_name='__main__')
p=root/'io-history/io-history-api.ts';guard(p,'f36f43f42046afee8cd2c2fc7ba8df6e15db2915')
s=p.read_text().replace('  n,\n','')
s=s.replace('type MovementGroup = { count: number; firstNo: string; netQty: number };','''type MovementGroup = { count: number; firstNo: string; netQty: number | null };

function finiteQuantity(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}''')
s=s.replace('    documents.isPlaceholderData ||','    (wantsStockDocuments && documents.isPlaceholderData) ||')
s=s.replace('  /** `source_id` → movement', '''  const hasCompleteSources =
    (!wantsStockDocuments || documents.data != null) &&
    (!wantsReversals || reversals.data != null) && ledger.data != null;

  /** `source_id` → movement''')
s=s.replace('netQty: n(row.qty_delta),','netQty: finiteQuantity(row.qty_delta),')
s=s.replace('      current.netQty += n(row.qty_delta);','''      const delta = finiteQuantity(row.qty_delta);
      current.netQty = current.netQty === null || delta === null ? null : current.netQty + delta;''')
s=s.replace('if (resolvingSnapshot) return [];','if (!hasCompleteSources || resolvingSnapshot) return [];')
s=s.replace('listOf((documents.data?.data as Raw | undefined)?.rows)', 'listOf(wantsStockDocuments ? (documents.data?.data as Raw | undefined)?.rows : undefined)')
s=s.replace('listOf((reversals.data as { data?: unknown })?.data)', 'listOf(wantsReversals ? (reversals.data as { data?: unknown })?.data : undefined)')
s=s.replace('''      const postedFromLines = lines.reduce(
        (total, line) => total + n(line.posted_qty),
        0,
      );''','''      const postedFromLines = lines.reduce<number | null>((total, line) => {
        const quantity = finiteQuantity(line.posted_qty);
        return total === null || quantity === null ? null : total + quantity;
      }, 0);''')
s=s.replace(': lines.length === 0',': lines.length === 0 || postedFromLines === null')
s=s.replace('const totalQty = n(row.total_qty);','const totalQty = finiteQuantity(row.total_qty);')
s=s.replace(': originalType === "INBOUND"',': totalQty === null\n              ? null\n              : originalType === "INBOUND"')
s=s.replace('    resolvingSnapshot,\n  ]);','    resolvingSnapshot,\n    hasCompleteSources,\n    wantsStockDocuments,\n    wantsReversals,\n  ]);')
s=s.replace('dataAsOf: resolvingSnapshot','dataAsOf: resolvingSnapshot || !hasCompleteSources || !wantsStockDocuments')
s=s.replace('[rows, documents.data, resolvingSnapshot],','[rows, documents.data, resolvingSnapshot, hasCompleteSources, wantsStockDocuments],')
s=s.replace('fetching: documents.isFetching || reversals.isFetching || ledger.isFetching,','fetching: (wantsStockDocuments && documents.isFetching) || (wantsReversals && reversals.isFetching) || ledger.isFetching,')
s=s.replace('error: documents.error ?? reversals.error ?? ledger.error,','error: (wantsStockDocuments ? documents.error : null) ?? (wantsReversals ? reversals.error : null) ?? ledger.error,')
assert not re.search(r'\bn\(',s)
p.write_text(s)
p=root/'io-history/rpt08/Rpt08HistoryReport.tsx'
s=p.read_text();s=s.replace('    exportState === "exporting";','    invalidRange ||\n    Boolean(source.error) ||\n    exportState === "unknown" ||\n    exportState === "exporting";');p.write_text(s)
for p in root.rglob('*'):
    if p.suffix not in ['.ts','.tsx'] or re.search(r'\.(test|spec)\.|__tests__|fixtures',str(p)):continue
    s=re.sub(r'/\*.*?\*/|//[^\n]*','',p.read_text(),flags=re.S)
    assert not re.search(r'\b(makeDemoRows|DEMO_ROWS|DEMO_FROM|DEMO_TO|demoMode|forcedState|readPreviewState)\b',s),str(p)
print('Reviewed report controls, API completeness, null quantities, dates and forced-state removal applied.')
