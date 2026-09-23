from pathlib import Path
import hashlib
p=Path('src/modules/reports/operations/report-data.ts')
b=p.read_bytes();assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()=='0767413d1d1bbb152fbfac589c5b81d31edd02f4'
s=b.decode()
old='''    queryFn: () =>
      http.getPage<Raw[]>(API_ENDPOINTS.REVERSAL_DOCUMENTS, {
        params: { from_date: from, to_date: to, per_page: 200 },
      }),'''
assert s.count(old)==1
s=s.replace(old,'    queryFn: () => fetchReversalReportSource(from, to),')
s='import { fetchReversalReportSource } from "./report-reversal-source";\n'+s
p.write_text(s)
for name in ['report-reversal-source.ts','report-reversal-source.test.ts']:
    Path('src/modules/reports/operations',name).write_text(Path('scripts/reports-quality-staging',name+'.txt').read_text())
print('Report reversal totals now require the complete API dataset.')
