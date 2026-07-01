import React, { useState, useEffect, useCallback } from 'react';

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

const PROVIDER_ORDER = ['Remitbee', 'Remitly', 'TapTap Send', 'LemFi', 'Instarem', 'MoneyGram'];

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
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 600,
      color: online ? C.up : C.faint,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: online ? C.up : C.faint,
        animation: online ? 'pulse 1.6s infinite' : 'none',
      }} />
      {online ? 'LIVE' : 'LOADING'}
    </span>
  );
}

/* ── Main component ────────────────────────────────────────────────────── */
export default function RateMonitorDashboard() {
  const [toCur,   setToCur]   = useState('INR');
  const [rows,    setRows]     = useState([]);
  const [loading, setLoading]  = useState(true);
  const [error,   setError]    = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  const fetchRates = useCallback(async (currency) => {
    setLoading(true);
    setError(null);
    try {
      const base = import.meta.env.VITE_API_URL || '';
      const res  = await fetch(`${base}/api/rates?to=${currency}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'API error');

      // Sort by PROVIDER_ORDER, put Remitbee first
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

  // Fetch on mount and when currency changes
  useEffect(() => { fetchRates(toCur); }, [toCur, fetchRates]);

  // Auto-refresh every 5 minutes
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

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header style={{
        background: C.panelAlt, borderBottom: `1px solid ${C.line}`,
        padding: '14px 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9, background: C.brand,
            display: 'grid', placeItems: 'center', fontSize: 18,
          }}>💱</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>RemitBee · Rate Monitor</div>
            <div style={{ fontSize: 11.5, color: C.faint }}>CAD exchange rate comparison — live from 6 providers</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
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
            <div style={{
              background: C.panelAlt, border: `1px solid ${C.line}`, borderRadius: 8,
              padding: '9px 14px', fontSize: 14, fontWeight: 700, color: C.brand,
            }}>
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
            <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: C.brand }}>
              CAD → {toCur}
            </div>
            <div style={{ fontSize: 11.5, color: C.muted }}>{currLabel}</div>
          </div>
        </div>

        {/* ── Error Banner ─────────────────────────────────────────────── */}
        {error && (
          <div style={{
            background: '#311a22', border: `1px solid ${C.down}`, borderRadius: 10,
            padding: '12px 18px', marginBottom: 20, color: C.down, fontSize: 13, fontWeight: 600,
          }}>
            ⚠ Failed to load rates: {error}
          </div>
        )}

        {/* ── Main Table ───────────────────────────────────────────────── */}
        <div style={{
          background: C.panel, border: `1px solid ${C.line}`,
          borderRadius: 14, overflow: 'hidden',
        }}>
          <div style={{
            padding: '14px 20px', borderBottom: `1px solid ${C.lineSoft}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: C.muted }}>
              CAD → {toCur} · Live Provider Comparison
            </h2>
            <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
              {[['#16294a', C.brand, 'Remitbee'], ['#0f2e24', C.up, 'Better rate'], ['#311a22', C.down, 'Lower rate']].map(([bg, col, lbl]) => (
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
                      <tr key={`${r.provider}-${idx}`} style={{
                        background: rowBg,
                        borderBottom: `1px solid ${C.lineSoft}`,
                        transition: 'background 0.15s',
                      }}>
                        {/* Provider */}
                        <td style={{ padding: '12px 16px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          <span style={{ color: isBee ? C.brand : C.text }}>{r.provider}</span>
                          {isBee && (
                            <span style={{
                              marginLeft: 7, fontSize: 9.5, fontWeight: 700, color: C.brand,
                              border: `1px solid ${C.brand}`, borderRadius: 4, padding: '1px 5px',
                            }}>YOU</span>
                          )}
                        </td>
                        {/* From */}
                        <td style={{ padding: '12px 16px', fontFamily: mono, color: C.muted }}>
                          {r.from_currency || 'CAD'}
                        </td>
                        {/* To */}
                        <td style={{ padding: '12px 16px', fontFamily: mono, color: C.muted }}>
                          {r.to_currency || toCur}
                        </td>
                        {/* Exchange Rate */}
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: mono, fontWeight: 700, fontSize: 14 }}>
                          {fmt(r.exchange_rate || r.exchangeRate)}
                        </td>
                        {/* Promotional Rate */}
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: mono }}>
                          {(r.promotional_rate || r.promotionalRate)
                            ? <span style={{ color: C.amber, fontWeight: 700 }}>{fmt(r.promotional_rate || r.promotionalRate)}</span>
                            : <span style={{ color: C.faint }}>N/A</span>
                          }
                        </td>
                        {/* Fee */}
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: mono }}>
                          <span style={{ color: (r.fee === 0 || r.fee === null) ? C.up : C.muted }}>
                            {fmtFee(r.fee)}
                          </span>
                        </td>
                        {/* Delivery Time */}
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: C.muted, fontSize: 12, whiteSpace: 'nowrap' }}>
                          {r.delivery_time || r.deliveryTime || 'N/A'}
                        </td>
                        {/* Last Updated */}
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: mono, fontSize: 11, color: C.faint, whiteSpace: 'nowrap' }}>
                          {fmtTime(r.last_updated || r.lastUpdated)}
                        </td>
                        {/* VS Remitbee */}
                        <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <VsBadge vsLabel={r.vsLabel} vsRemitbee={r.vsRemitbee} vsColor={r.vsColor} />
                        </td>
                        {/* Transfer Type */}
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

        {/* ── Currency Quick-nav ────────────────────────────────────────── */}
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
