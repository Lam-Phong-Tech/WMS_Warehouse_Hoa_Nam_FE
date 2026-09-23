from pathlib import Path
import hashlib

ROOT = Path('src/modules/reports/io-history')
SOURCES = {
 'rpt08/Rpt08HistoryReport.tsx': '856322bc5b657327b7d575d814f12c8e1df74c56',
 'rpt08/widgets.tsx': '3e1a4dfa938cb28368358d3f2ed8a74407c9b506',
 'io-history-report.css': '200f29228fcbaa4e525fdf04b35d0e9c6a5a3660',
}
content = {}
for name, expected in SOURCES.items():
 raw = (ROOT / name).read_bytes()
 sha = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
 if sha != expected:
  raise RuntimeError(f'Source changed; review before editing: {name}')
 content[name] = raw.decode('utf-8')

def replace_once(name, old, new):
 text = content[name]
 if text.count(old) != 1:
  raise RuntimeError(f'Expected exactly one match: {name}: {old[:80]}')
 content[name] = text.replace(old, new, 1)

replace_once('rpt08/Rpt08HistoryReport.tsx', '<h1>{tUi("updatedUi.text_cedbc7cfb228")}</h1>', '<h1 className="hn-report-page-title">{tUi("updatedUi.text_cedbc7cfb228")}</h1>')
replace_once('rpt08/widgets.tsx', 'className="rpt08-pagination"', 'className="rpt08-pagination hn-report-pagination"')
replace_once('rpt08/widgets.tsx', 'className="rpt08-table-footer"', 'className="rpt08-table-footer hn-report-pagination-footer"')
replace_once('rpt08/widgets.tsx', '''      {nodes}
    </nav>''', '''      <button
        type="button"
        data-page-direction="previous"
        aria-label={tUi("reports.traceability.previousPage")}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        ‹
      </button>
      {nodes}
      <button
        type="button"
        data-page-direction="next"
        aria-label={tUi("updatedUi.text_8cac33aab67d")}
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        ›
      </button>
    </nav>''')
replace_once('rpt08/widgets.tsx', 'Xem <span aria-hidden="true">›</span>', '{tUi("reports.ioHistory.view")} <span aria-hidden="true">›</span>')
content['io-history-report.css'] += '@import "./rpt08/alignment.css";\n'
for name, text in content.items():
 (ROOT / name).write_text(text, encoding='utf-8')
 print('Updated', ROOT / name)
