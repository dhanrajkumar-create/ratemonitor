import React, { useState, useEffect, useCallback, useRef } from 'react';

/* ── Design tokens ─────────────────────────────────────────────────────── */
const C = {
  bg:       '#0A0F1A',
  panel:    '#111A2B',
  panelAlt: '#0E1626',
  line:     '#1E2A42',
  lineSoft: '#172238',
  text:     '#E8EEF9',
  muted:    '#8595B4',
  faint:    '#5A6A89',
  brand:    '#3B82F6',
  up:       '#2FD08A',
  down:     '#F2616B',
  amber:    '#F5B544',
};

const sans = "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
const mono = "ui-monospace, 'SF Mono', 'Roboto Mono', Menlo, monospace";

const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'LKR', name: 'Sri Lankan Rupee' },
  { code: 'UAH', name: 'Ukrainian Hryvnia' },
  { code: 'NPR', name: 'Nepalese Rupee' },
  { code: 'BDT', name: 'Bangladeshi Taka' },
  { code: 'PKR', name: 'Pakistani Rupee' },
];

const PROVIDER_ORDER = ['Remitbee', 'Remitly', 'TapTap Send', 'LemFi', 'Instarem', 'MoneyGram', 'Kabayan Remit'];

/* ── Helpers ───────────────────────────────────────────────────────────── */
function fmt(n, dp = 4) {
  if (n == null) return 'N/A';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function fmtFee(n) {
  if (n == null) return 'N/A';
  if (n === 0) return 'Free';
  return `$${Number(n).toFixed(2)}`;
}
function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

/* ── Export helpers ────────────────────────────────────────────────────── */
function exportCSV(rows, toCur) {
  const headers = [
    'Provider', 'From Currency', 'To Currency', 'Exchange Rate',
    'Promotional Rate', 'Fee (CAD)', 'Delivery Time', 'Transfer Type',
    'VS Remitbee', 'Last Updated',
  ];

  const escape = v => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csvRows = rows.map(r => [
    r.provider,
    r.from_currency || 'CAD',
    r.to_currency || toCur,
    r.exchange_rate ?? r.exchangeRate ?? '',
    r.promotional_rate ?? r.promotionalRate ?? '',
    r.fee ?? '',
    r.delivery_time || r.deliveryTime || '',
    r.transfer_type || r.transferType || '',
    r.vsRemitbee != null ? `${r.vsRemitbee > 0 ? '+' : ''}${Number(r.vsRemitbee).toFixed(4)}` : '',
    r.last_updated || r.lastUpdated || '',
  ].map(escape).join(','));

  const blob = new Blob(
    [`${headers.join(',')}\n${csvRows.join('\n')}`],
    { type: 'text/csv;charset=utf-8;' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rates-CAD-${toCur}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportPDF(rows, toCur, currLabel) {
  const stamp = new Date().toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const tableRows = rows.map(r => {
    const rate      = fmt(r.exchange_rate ?? r.exchangeRate);
    const promo     = (r.promotional_rate ?? r.promotionalRate) ? fmt(r.promotional_rate ?? r.promotionalRate) : '—';
    const fee       = fmtFee(r.fee);
    const updated   = fmtTime(r.last_updated ?? r.lastUpdated);
    const vs        = r.vsLabel
      ? `${r.vsLabel}${r.vsRemitbee != null ? ` (${r.vsRemitbee > 0 ? '+' : ''}${Number(r.vsRemitbee).toFixed(4)})` : ''}`
      : '—';
    const vsColor   = r.vsColor === 'green' ? '#1a7a4a' : r.vsColor === 'red' ? '#9b2b34' : '#555';
    const isBee     = r.provider === 'Remitbee';
    return `
      <tr class="${isBee ? 'bee-row' : ''}">
        <td class="provider">${r.provider}${isBee ? ' <span class="you-tag">YOU</span>' : ''}</td>
        <td>${r.from_currency || 'CAD'}</td>
        <td>${r.to_currency || toCur}</td>
        <td class="num bold">${rate}</td>
        <td class="num amber">${promo}</td>
        <td class="num">${fee}</td>
        <td>${r.delivery_time ?? r.deliveryTime ?? '—'}</td>
        <td>${r.transfer_type ?? r.transferType ?? '—'}</td>
        <td class="num" style="color:${vsColor}">${vs}</td>
        <td class="ts">${updated}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>CAD → ${toCur} · Rate Monitor Export</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1a2236;padding:24px 28px;background:#fff}
  header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:18px;padding-bottom:12px;border-bottom:2px solid #1a3a6e}
  .title-block h1{font-size:17px;font-weight:700;color:#1a3a6e;letter-spacing:-.3px}
  .title-block p{font-size:10.5px;color:#6b7a99;margin-top:3px}
  .meta{font-size:10px;color:#8595b4;text-align:right}
  .meta span{display:block}
  table{width:100%;border-collapse:collapse;margin-top:4px}
  thead tr{background:#1a3a6e}
  thead th{color:#fff;font-size:9.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;padding:7px 10px;text-align:left;white-space:nowrap}
  thead th.num{text-align:right}
  tbody tr{border-bottom:1px solid #e8edf5}
  tbody tr:nth-child(even){background:#f5f7fb}
  tbody tr.bee-row{background:#deeafc}
  td{padding:6px 10px;vertical-align:middle;white-space:nowrap}
  td.num{text-align:right;font-family:'Courier New',monospace;font-variant-numeric:tabular-nums}
  td.bold{font-weight:700;font-size:12px}
  td.amber{color:#b07d00;font-weight:600}
  td.ts{color:#8595b4;font-size:9.5px}
  td.provider{font-weight:600}
  .you-tag{display:inline-block;font-size:8px;font-weight:700;color:#1a3a6e;border:1px solid #1a3a6e;border-radius:3px;padding:0 4px;vertical-align:middle;margin-left:4px;line-height:1.5}
  footer{margin-top:16px;font-size:9px;color:#a0aab8;text-align:center;padding-top:8px;border-top:1px solid #e0e6f0}
  @media print{body{padding:0} .no-print{display:none}}
</style>
</head>
<body>
<header>
  <div class="title-block">
    <h1>CAD → ${toCur} &nbsp;Exchange Rate Comparison</h1>
    <p>${currLabel} &nbsp;·&nbsp; All providers &nbsp;·&nbsp; RemitBee Rate Monitor</p>
  </div>
  <div class="meta">
    <span>Generated ${stamp}</span>
    <span>${rows.length} provider${rows.length !== 1 ? 's' : ''}</span>
  </div>
</header>
<table>
  <thead>
    <tr>
      <th>Provider</th>
      <th>From</th>
      <th>To</th>
      <th class="num">Exchange Rate</th>
      <th class="num">Promo Rate</th>
      <th class="num">Fee</th>
      <th>Delivery</th>
      <th>Transfer Type</th>
      <th class="num">VS Remitbee</th>
      <th>Last Updated</th>
    </tr>
  </thead>
  <tbody>${tableRows}</tbody>
</table>
<footer>RemitBee Rate Monitor &nbsp;·&nbsp; Rates are live-scraped and may change &nbsp;·&nbsp; CAD = Canadian Dollar</footer>
<script>window.onload=()=>window.print()</script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1100,height=700');
  if (!win) { alert('Allow pop-ups to download PDF'); return; }
  win.document.write(html);
  win.document.close();
}

/* ── Sub-components ────────────────────────────────────────────────────── */
function VsBadge({ vsLabel, vsRemitbee, vsColor }) {
  if (!vsLabel) return <span style={{ color: C.muted }}>—</span>;
  const color = vsColor === 'green' ? C.up : vsColor === 'red' ? C.down : C.muted;
  const diff  = vsRemitbee != null ? ` (${vsRemitbee > 0 ? '+' : ''}${Number(vsRemitbee).toFixed(4)})` : '';
  return (
    <span style={{ color, fontWeight: 700, fontFamily: mono, fontSize: 12 }}>
      {vsLabel}{diff}
    </span>
  );
}

function StatusPill({ online }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: online ? C.up : C.faint }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: online ? C.up : C.faint, animation: online ? 'pulse 1.6s infinite' : 'none' }} />
      {online ? 'LIVE' : 'LOADING'}
    </span>
  );
}

/* ── Export dropdown button ────────────────────────────────────────────── */
function ExportMenu({ rows, toCur, currLabel, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const btnStyle = {
    background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8,
    padding: '7px 14px', fontSize: 12.5, fontWeight: 600, color: C.text,
    display: 'inline-flex', alignItems: 'center', gap: 6,
    opacity: disabled ? 0.45 : 1,
    transition: 'border-color 0.15s, background 0.15s',
  };

  const optStyle = {
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%', padding: '10px 16px',
    background: 'none', border: 'none', color: C.text,
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    textAlign: 'left', transition: 'background 0.12s',
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
        style={btnStyle}
        title="Export data"
      >
        {/* Download arrow icon */}
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Export
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.6 }}>
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          background: C.panel, border: `1px solid ${C.line}`,
          borderRadius: 10, overflow: 'hidden', zIndex: 200,
          minWidth: 188, boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
        }}>
          {/* CSV option */}
          <button
            style={optStyle}
            onMouseEnter={e => e.currentTarget.style.background = C.panelAlt}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
            onClick={() => { exportCSV(rows, toCur); setOpen(false); }}
          >
            <span style={{
              width: 30, height: 30, borderRadius: 7,
              background: '#122a1a', display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="14" height="14" rx="2" stroke={C.up} strokeWidth="1.4"/>
                <path d="M4 5h8M4 8h8M4 11h5" stroke={C.up} strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 12.5, color: C.text }}>Download CSV</div>
              <div style={{ fontSize: 10.5, color: C.faint, marginTop: 1 }}>Spreadsheet format</div>
            </div>
          </button>

          {/* Divider */}
          <div style={{ height: 1, background: C.lineSoft, margin: '0 12px' }} />

          {/* PDF option */}
          <button
            style={optStyle}
            onMouseEnter={e => e.currentTarget.style.background = C.panelAlt}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
            onClick={() => { exportPDF(rows, toCur, currLabel); setOpen(false); }}
          >
            <span style={{
              width: 30, height: 30, borderRadius: 7,
              background: '#1e1a2e', display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M3 2a1 1 0 011-1h6l3 3v10a1 1 0 01-1 1H4a1 1 0 01-1-1V2z" stroke={C.brand} strokeWidth="1.4"/>
                <path d="M9 1v3h3" stroke={C.brand} strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M5 8h6M5 11h4" stroke={C.brand} strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 12.5, color: C.text }}>Download PDF</div>
              <div style={{ fontSize: 10.5, color: C.faint, marginTop: 1 }}>Print-ready report</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────────────── */
export default function RateMonitorDashboard() {
  const [toCur,     setToCur]     = useState('INR');
  const [rows,      setRows]       = useState([]);
  const [loading,   setLoading]    = useState(true);
  const [error,     setError]      = useState(null);
  const [lastFetch, setLastFetch]  = useState(null);

  const fetchRates = useCallback(async (currency) => {
    setLoading(true);
    setError(null);
    try {
      const base = import.meta.env.VITE_API_URL || '';
      const res  = await fetch(`${base}/api/rates?to=${currency}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'API error');

      const sorted = [...(json.data || [])].sort((a, b) => {
        const ia = PROVIDER_ORDER.indexOf(a.provider);
        const ib = PROVIDER_ORDER.indexOf(b.provider);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
      setRows(sorted);
      setLastFetch(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRates(toCur); }, [toCur, fetchRates]);
  useEffect(() => {
    const id = setInterval(() => fetchRates(toCur), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [toCur, fetchRates]);

  const currLabel = CURRENCIES.find(c => c.code === toCur)?.name || toCur;

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: sans, color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.35} }
        @keyframes spin   { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { height: 6px; width: 6px; }
        ::-webkit-scrollbar-thumb { background: ${C.line}; border-radius: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        table { border-collapse: collapse; }
        select { cursor: pointer; }
        button { cursor: pointer; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{
        background: C.panelAlt, borderBottom: `1px solid ${C.line}`,
        padding: '14px 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: C.brand, display: 'grid', placeItems: 'center', fontSize: 18 }}>
            💱
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>RemitBee · Rate Monitor</div>
            <div style={{ fontSize: 11.5, color: C.faint }}>CAD exchange rate comparison — live from {PROVIDER_ORDER.length} providers</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <StatusPill online={!loading} />
          {lastFetch && (
            <span style={{ fontSize: 11.5, color: C.muted, fontFamily: mono }}>
              Updated {lastFetch.toLocaleTimeString('en-US', { hour12: false })}
            </span>
          )}
          <button
            onClick={() => fetchRates(toCur)}
            disabled={loading}
            style={{
              background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8,
              padding: '7px 14px', fontSize: 12.5, fontWeight: 600, color: C.text,
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? '⟳ Loading…' : '⟳ Refresh'}
          </button>

          {/* ── Export button ─────────────────────────────────────────── */}
          <ExportMenu
            rows={rows}
            toCur={toCur}
            currLabel={currLabel}
            disabled={loading || rows.length === 0}
          />
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '24px' }}>

        {/* ── Currency Filter ───────────────────────────────────────────── */}
        <div style={{
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12,
          padding: '16px 20px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: C.faint, fontWeight: 600, marginBottom: 6 }}>
              From
            </div>
            <div style={{ background: C.panelAlt, border: `1px solid ${C.line}`, borderRadius: 8, padding: '9px 14px', fontSize: 14, fontWeight: 700, color: C.brand }}>
              CAD — Canadian Dollar
            </div>
          </div>

          <div style={{ fontSize: 20, color: C.faint }}>→</div>

          <div>
            <div style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: C.faint, fontWeight: 600, marginBottom: 6 }}>
              To Currency
            </div>
            <select
              value={toCur}
              onChange={e => setToCur(e.target.value)}
              style={{
                background: C.panelAlt, color: C.text, border: `1px solid ${C.brand}`,
                borderRadius: 8, padding: '9px 14px', fontSize: 14, fontWeight: 600,
                fontFamily: sans, outline: 'none', minWidth: 220,
              }}
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code} style={{ background: C.panelAlt }}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 10.5, color: C.faint, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Active Pair</div>
            <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: C.brand }}>CAD → {toCur}</div>
            <div style={{ fontSize: 11.5, color: C.muted }}>{currLabel}</div>
          </div>
        </div>

        {/* ── Error Banner ──────────────────────────────────────────────── */}
        {error && (
          <div style={{
            background: '#311a22', border: `1px solid ${C.down}`, borderRadius: 10,
            padding: '12px 18px', marginBottom: 20, color: C.down, fontSize: 13, fontWeight: 600,
          }}>
            ⚠ Failed to load rates: {error}
          </div>
        )}

        {/* ── Main Table ────────────────────────────────────────────────── */}
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{
            padding: '14px 20px', borderBottom: `1px solid ${C.lineSoft}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted }}>
              CAD → {toCur} · Live Provider Comparison
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 11 }}>
              {[['#16294a', C.brand, 'Remitbee'], ['#0f2e24', C.up, 'Better rate'], ['#311a22', C.down, 'Lower rate']].map(([, col, lbl]) => (
                <span key={lbl} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: col, opacity: 0.8 }} />
                  <span style={{ color: C.faint }}>{lbl}</span>
                </span>
              ))}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: C.muted }}>
                <div style={{ fontSize: 28, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</div>
                <div style={{ marginTop: 10, fontSize: 13 }}>Fetching live rates…</div>
              </div>
            ) : rows.length === 0 ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: C.faint, fontSize: 13 }}>
                No data available. Click Refresh to try again.
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: C.panelAlt }}>
                    {[
                      'Provider', 'From', 'To', 'Exchange Rate',
                      'Promotional Rate', 'Fee', 'Delivery Time',
                      'Last Updated', 'VS Remitbee', 'Transfer Type',
                    ].map((h, i) => (
                      <th key={h} style={{
                        padding: '11px 16px',
                        textAlign: i >= 3 && i <= 8 ? 'right' : 'left',
                        fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em',
                        textTransform: 'uppercase', color: C.faint,
                        borderBottom: `1px solid ${C.lineSoft}`,
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const isBee = r.provider === 'Remitbee';
                    const isUp  = r.vsColor === 'green';
                    const isDn  = r.vsColor === 'red';
                    const rowBg = isBee ? '#16294a' : isUp ? '#0f2e24' : isDn ? '#311a22' : 'transparent';

                    return (
                      <tr key={`${r.provider}-${idx}`} style={{ background: rowBg, borderBottom: `1px solid ${C.lineSoft}`, transition: 'background 0.15s' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          <span style={{ color: isBee ? C.brand : C.text }}>{r.provider}</span>
                          {isBee && (
                            <span style={{ marginLeft: 7, fontSize: 9.5, fontWeight: 700, color: C.brand, border: `1px solid ${C.brand}`, borderRadius: 4, padding: '1px 5px' }}>
                              YOU
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: mono, color: C.muted }}>{r.from_currency || 'CAD'}</td>
                        <td style={{ padding: '12px 16px', fontFamily: mono, color: C.muted }}>{r.to_currency || toCur}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: mono, fontWeight: 700, fontSize: 14 }}>
                          {fmt(r.exchange_rate || r.exchangeRate)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: mono }}>
                          {(r.promotional_rate || r.promotionalRate)
                            ? <span style={{ color: C.amber, fontWeight: 700 }}>{fmt(r.promotional_rate || r.promotionalRate)}</span>
                            : <span style={{ color: C.faint }}>N/A</span>
                          }
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: mono }}>
                          <span style={{ color: (r.fee === 0 || r.fee === null) ? C.up : C.muted }}>
                            {fmtFee(r.fee)}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: C.muted, fontSize: 12, whiteSpace: 'nowrap' }}>
                          {r.delivery_time || r.deliveryTime || 'N/A'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: mono, fontSize: 11, color: C.faint, whiteSpace: 'nowrap' }}>
                          {fmtTime(r.last_updated || r.lastUpdated)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <VsBadge vsLabel={r.vsLabel} vsRemitbee={r.vsRemitbee} vsColor={r.vsColor} />
                        </td>
                        <td style={{ padding: '12px 16px', color: C.muted, fontSize: 12 }}>
                          {r.transfer_type || r.transferType || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Currency Quick-nav ─────────────────────────────────────────── */}
        <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CURRENCIES.map(c => (
            <button
              key={c.code}
              onClick={() => setToCur(c.code)}
              style={{
                background: toCur === c.code ? C.brand : C.panel,
                color:      toCur === c.code ? '#fff'   : C.muted,
                border:     `1px solid ${toCur === c.code ? C.brand : C.line}`,
                borderRadius: 8, padding: '7px 14px',
                fontSize: 12.5, fontWeight: 600, transition: 'all 0.15s',
              }}
            >
              {c.code}
            </button>
          ))}
        </div>

        <footer style={{ textAlign: 'center', color: C.faint, fontSize: 11, padding: '20px 0 8px' }}>
          RemitBee Rate Monitor · Rates refreshed every 2 hours via scheduler · Live scraping on demand
        </footer>
      </main>
    </div>
  );
}
