from pathlib import Path
import re,hashlib
p=Path('src/modules/reports/warranty-components/WarrantyComponentsReport.tsx')
b=p.read_bytes();assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()=='b6777844445a050af3622c667a18259fbbe0d0d0'
s=b.decode()
a=s.index('type ForcedState =');z=s.index('function mapStatus',a);s=s[:a]+s[z:]
a=s.index('  const forcedState =');z=s.index('  const [range, setRange]',a);s=s[:a]+s[z:]
s,n=re.subn(r'const \[keyword, setKeyword\] = useState\(\s*forcedState === "no-result" \? "abcxyz" : "",?\s*\);','const [keyword, setKeyword] = useState("");',s);assert n==1
s=s.replace('''  const invalid =
    range[0].isAfter(range[1], "day") || forcedState === "invalid-date";''','''  const invalid = range[0].isAfter(range[1], "day");''')
a=s.index('  const source = useWarrantyReport(');z=s.index('  const exporter =',a)
s=s[:a]+'''  const source = useWarrantyReport({ from, to, enabled: !invalid && online });
'''+s[z:]
a=s.index('  const rows = forcedState');z=s.index('  const filteredRows =',a)
s=s[:a]+'''  const rows = apiRows;
  const loading = source.isLoading;
  const refreshing = !loading && source.isFetching;
  const offline = !online;
  const hardError = source.isError && rows.length === 0 && !offline;
  const partial = source.isError && rows.length > 0;

'''+s[z:]
a=s.index('  const exporting =');z=s.index('  const openDetail =',a)
s=s[:a]+'''  const exporting = exporter.exporting === "xlsx";

'''+s[z:]
a=s.index('  const effectiveBusyId =');z=s.index('  const pageNumbers =',a)
s=s[:a]+'''  const effectiveBusyId = detailBusyId;
  const effectiveDetailError = detailErrorId;

'''+s[z:]
a=s.index(') : exportFailed ? (');z=s.index(') : null}',a)
s=s[:a]+s[z:]
# The table badge reflects actual filtered API rows, never a URL preview state.
assert s.count('forcedState === "no-result"') == 1
s=s.replace('forcedState === "no-result"','rows.length > 0 && filteredRows.length === 0')
assert not re.search(r'\b(?:forcedState|ForcedState|exportFailed|exportSuccess|exportUnknown)\b',s)
assert s.count('dayjs("2026-09-04")')==2 and s.count('dayjs("2026-09-10")')==2
s=s.replace('dayjs("2026-09-04")','dayjs().subtract(6, "day").startOf("day")').replace('dayjs("2026-09-10")','dayjs().startOf("day")')
s='import { useAuthStore } from "@/shared/store/auth.store";\n'+s
s=s.replace('  const t = useT();','  const t = useT();\n  const warehouseName = useAuthStore((state) => state.currentContext?.warehouse_name)?.trim() || "—";')
s=s.replace('<Box component="span">Kho Hoa Nam</Box>','<Box component="span">{warehouseName}</Box>')
s=s.replace('aria-label="Kho Hoa Nam"','aria-label={warehouseName}')
p.write_text(s)
print('Warranty report now derives loading/errors/exports/data from API state and actual warehouse context.')
