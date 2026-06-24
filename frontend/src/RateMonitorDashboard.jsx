import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, Download, Pause, Play,
  RefreshCw, Search, TrendingUp, TrendingDown, Minus, Circle, Filter,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 * Design tokens — FX trading desk, deep slate-navy terminal
 * (arbitrary Tailwind values aren't available, so colors live here)
 * ------------------------------------------------------------------ */
const C = {
  bg: "#0A0F1A",
  panel: "#111A2B",
  panelAlt: "#0E1626",
  line: "#1E2A42",
  lineSoft: "#172238",
  text: "#E8EEF9",
  muted: "#8595B4",
  faint: "#5A6A89",
  brand: "#3B82F6",     // RemitBee blue
  brandSoft: "#16294a",
  up: "#2FD08A",        // highest / gains
  upSoft: "#0f2e24",
  down: "#F2616B",      // lowest / losses
  downSoft: "#311a22",
  amber: "#F5B544",
  violet: "#9B8CFF",
};

const mono = "ui-monospace, 'SF Mono', 'Roboto Mono', Menlo, monospace";
const sans = "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

/* ------------------------------------------------------------------ *
 * Reference data
 * ------------------------------------------------------------------ */
// Approx CAD-> rate, used only to seed the simulator (now fallback)
const STATIC_CURRENCIES = [
  { code: "INR", name: "Indian Rupee", base: 61.5, dp: 4 },
  { code: "USD", name: "US Dollar", base: 0.731, dp: 4 },
  { code: "EUR", name: "Euro", base: 0.679, dp: 4 },
  { code: "GBP", name: "British Pound", base: 0.578, dp: 4 },
  { code: "PKR", name: "Pakistani Rupee", base: 203.4, dp: 3 },
  { code: "BDT", name: "Bangladeshi Taka", base: 80.2, dp: 3 },
  { code: "NPR", name: "Nepalese Rupee", base: 98.3, dp: 3 },
  { code: "PHP", name: "Philippine Peso", base: 41.0, dp: 3 },
  { code: "AED", name: "UAE Dirham", base: 2.685, dp: 4 },
  { code: "NGN", name: "Nigerian Naira", base: 1085.0, dp: 2 },
  { code: "LKR", name: "Sri Lankan Rupee", base: 220.5, dp: 2 },
  { code: "AUD", name: "Australian Dollar", base: 1.114, dp: 4 },
  { code: "JPY", name: "Japanese Yen", base: 112.7, dp: 3 },
  { code: "MXN", name: "Mexican Peso", base: 13.62, dp: 4 },
  { code: "CNY", name: "Chinese Yuan", base: 5.27, dp: 4 },
  { code: "HKD", name: "Hong Kong Dollar", base: 5.70, dp: 4 },
  { code: "SGD", name: "Singapore Dollar", base: 0.984, dp: 4 },
  { code: "CHF", name: "Swiss Franc", base: 0.642, dp: 4 },
  { code: "QAR", name: "Qatari Riyal", base: 2.66, dp: 4 },
  { code: "SAR", name: "Saudi Riyal", base: 2.74, dp: 4 },
  { code: "OMR", name: "Omani Rial", base: 0.281, dp: 5 },
  { code: "KWD", name: "Kuwaiti Dinar", base: 0.224, dp: 5 },
  { code: "BHD", name: "Bahraini Dinar", base: 0.275, dp: 5 },
  { code: "EGP", name: "Egyptian Pound", base: 36.1, dp: 3 },
  { code: "MYR", name: "Malaysian Ringgit", base: 3.07, dp: 4 },
  { code: "THB", name: "Thai Baht", base: 24.9, dp: 3 },
  { code: "VND", name: "Vietnamese Dong", base: 18250, dp: 1 },
  { code: "IDR", name: "Indonesian Rupiah", base: 11680, dp: 1 },
  { code: "KRW", name: "South Korean Won", base: 989, dp: 2 },
  { code: "NZD", name: "New Zealand Dollar", base: 1.214, dp: 4 },
];

const COMPETITORS = [
  "RemitBee", "Wise", "Remitly", "LemFi", "Western Union", "MoneyGram", "XE", "OFX",
  "WorldRemit", "Instarem", "Ria", "Xoom", "TransferGo", "CurrencyFair",
  "TapTap Send", "Panda Remit",
];

/* ------------------------------------------------------------------ *
 * Deterministic pseudo-random so the board is stable per pair
 * ------------------------------------------------------------------ */
function seeded(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const hash = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/* ------------------------------------------------------------------ *
 * Small UI atoms
 * ------------------------------------------------------------------ */
function Panel({ title, right, children, pad = true, style }) {
  return (
    <section
      style={{
        background: C.panel,
        border: `1px solid ${C.line}`,
        borderRadius: 14,
        ...style,
      }}
    >
      {(title || right) && (
        <header
          className="flex items-center justify-between"
          style={{ padding: "14px 18px", borderBottom: `1px solid ${C.lineSoft}` }}
        >
          <h3 style={{ fontSize: 12.5, letterSpacing: ".09em", textTransform: "uppercase", color: C.muted, fontWeight: 600 }}>
            {title}
          </h3>
          {right}
        </header>
      )}
      <div style={{ padding: pad ? 18 : 0 }}>{children}</div>
    </section>
  );
}

function Delta({ value, suffix = "%", size = 13 }) {
  const up = value > 0, flat = Math.abs(value) < 0.001;
  const col = flat ? C.muted : up ? C.up : C.down;
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-1" style={{ color: col, fontFamily: mono, fontSize: size, fontWeight: 600 }}>
      <Icon size={size} strokeWidth={2.4} />
      {up && !flat ? "+" : ""}{value.toFixed(2)}{suffix}
    </span>
  );
}

function Dropdown({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1.5" style={{ minWidth: 0 }}>
      <span style={{ fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: C.faint, fontWeight: 600 }}>
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%", appearance: "none", cursor: "pointer",
            background: C.panelAlt, color: C.text, border: `1px solid ${C.line}`,
            borderRadius: 10, padding: "10px 34px 10px 12px", fontSize: 13.5,
            fontWeight: 600, fontFamily: sans, outline: "none",
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} style={{ background: C.panelAlt }}>
              {o.label}
            </option>
          ))}
        </select>
        <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: C.faint, pointerEvents: "none", fontSize: 11 }}>▾</span>
      </div>
    </label>
  );
}

/* ------------------------------------------------------------------ *
 * Main component
 * ------------------------------------------------------------------ */
export default function RateMonitorDashboard() {
  const [currencies, setCurrencies] = useState(STATIC_CURRENCIES);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [ratesError, setRatesError] = useState(null);

  const [service, setService] = useState("money_transfer");
  const [fromCur, setFromCur] = useState("CAD");
  const [toCur, setToCur] = useState("INR");
  const [cxPair, setCxPair] = useState("CAD_USD"); // currency-exchange pair
  const [live, setLive] = useState(true);
  const [interval, setIntervalMin] = useState("5");
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(new Date());
  const [histFilter, setHistFilter] = useState({ competitor: "All", q: "" });
  const [alerts, setAlerts] = useState([]);
  const [competitorRates, setCompetitorRates] = useState(null);
  const seenRef = useRef({});

  const updateCurrencies = React.useCallback((ratesMap) => {
    const updated = STATIC_CURRENCIES.map(c => ({
      ...c,
      base: ratesMap[c.code] || c.base
    }));

    // Add any currencies from the API that aren't in our static list
    const existingCodes = new Set(updated.map(c => c.code));
    Object.keys(ratesMap).forEach(code => {
      if (!existingCodes.has(code)) {
        updated.push({
          code,
          name: code, // Default name to code if unknown
          dp: 2, // Default to 2 decimal places
          base: ratesMap[code]
        });
      }
    });

    setCurrencies(updated.sort((a, b) => a.code.localeCompare(b.code)));
  }, []);

  const fetchRates = React.useCallback(async (force = false) => {
    try {
      const cacheKey = "fx_rates_cache";
      const cacheTimeKey = "fx_rates_cache_time";
      const nowMs = Date.now();
      const cached = localStorage.getItem(cacheKey);
      const cachedTime = localStorage.getItem(cacheTimeKey);

      if (!force && cached && cachedTime && nowMs - Number(cachedTime) < parseInt(interval, 10) * 60 * 1000) {
        const rates = JSON.parse(cached);
        updateCurrencies(rates);
        setRatesLoading(false);
        return;
      }

      setRatesLoading(true);
      const res = await fetch("https://open.er-api.com/v6/latest/CAD");
      if (!res.ok) throw new Error("Network response was not ok");
      const data = await res.json();

      localStorage.setItem(cacheKey, JSON.stringify(data.rates));
      localStorage.setItem(cacheTimeKey, nowMs.toString());

      updateCurrencies(data.rates);
      setRatesLoading(false);
      setRatesError(null);
    } catch (err) {
      console.error("Fetch error:", err);
      const cached = localStorage.getItem("fx_rates_cache");
      if (cached) {
        updateCurrencies(JSON.parse(cached));
      } else {
        setRatesError("Failed to fetch live exchange rates.");
      }
      setRatesLoading(false);
    }
  }, [interval, updateCurrencies]);

  useEffect(() => {
    fetchRates();
    const mins = parseInt(interval, 10) || 5;
    const intervalId = setInterval(() => fetchRates(true), mins * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [fetchRates, interval]);

  // resolve the active pair
  const pair = useMemo(() => {
    if (service === "currency_exchange") {
      return cxPair === "CAD_USD"
        ? { from: "CAD", to: "USD" }
        : { from: "USD", to: "CAD" };
    }
    return { from: fromCur, to: toCur };
  }, [service, cxPair, fromCur, toCur]);

  useEffect(() => {
    async function fetchCompetitors() {
      if (!pair.from || !pair.to) return;
      
      // Clear old data instantly when currency pair changes
      setCompetitorRates(null);
      setRatesLoading(true);
      
      try {
        const forceStr = tick > 0 ? "true" : "false";
        const baseUrl = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${baseUrl}/api/competitors?from=${pair.from}&to=${pair.to}&force=${forceStr}`);
        if (res.ok) {
          const data = await res.json();
          setCompetitorRates(data.data);
        }
      } catch(err) {
        console.error("Failed to fetch competitor exact rates:", err);
      } finally {
        setRatesLoading(false);
      }
    }
    fetchCompetitors();
  }, [pair, tick]);

  const toMeta = currencies.find((c) => c.code === pair.to) || currencies[1];
  // base rate for the pair (handle USD->CAD inverse)
  const baseRate = useMemo(() => {
    if (pair.from === "CAD") return toMeta.base;
    if (pair.from === "USD" && pair.to === "CAD") return 1 / (currencies.find(c => c.code === "USD").base);
    return toMeta.base;
  }, [pair, toMeta, currencies]);
  const dp = pair.to === "CAD" ? 4 : toMeta.dp;

  /* ---- live clock ---- */
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ---- competitor snapshot ---- */
  const rows = useMemo(() => {
    if (!competitorRates) return [];
    
    return Object.keys(competitorRates).map((name) => {
      const isBee = name === "RemitBee";
      const data = competitorRates[name];
      const rate = data.rate || 0;
      const fee = data.fee || 0;

      const change = 0; // Fixed at 0 since data is exact live
      return { 
        name, 
        rate, 
        change, 
        fee, 
        isBee, 
        hasApi: true, 
        source: "Live Scraping" 
      };
    });
  }, [competitorRates, tick]);

  const sorted = [...rows].sort((a, b) => b.rate - a.rate);
  const bee = rows.find((r) => r.isBee) || { name: "RemitBee", rate: baseRate, fee: 0, change: 0, isBee: true };
  const competitors = rows.filter((r) => !r.isBee);
  const highest = sorted[0] || bee;
  const lowest = sorted[sorted.length - 1] || bee;
  const avg = competitors.length > 0 ? (competitors.reduce((s, r) => s + r.rate, 0) / competitors.length) : bee.rate;
  const spreadVal = highest.rate - lowest.rate;
  const beeRank = sorted.findIndex((r) => r.isBee) + 1;
  const diffVsBest = ((bee.rate - highest.rate) / highest.rate) * 100;
  const diffVsAvg = ((bee.rate - avg) / avg) * 100;

  const fmt = (n, d = dp) =>
    n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

  /* ---- history / trend series ---- */
  const trend = useMemo(() => {
    const rnd = seeded(hash(pair.from + pair.to) + 99);
    const pts = 30;
    let mv = baseRate * 0.997, bv = baseRate * 0.999;
    return Array.from({ length: pts }, (_, i) => {
      mv += (rnd() - 0.5) * baseRate * 0.0018;
      bv += (rnd() - 0.5) * baseRate * 0.0016;
      const d = new Date(); d.setDate(d.getDate() - (pts - 1 - i));
      return {
        day: `${d.getMonth() + 1}/${d.getDate()}`,
        market: +mv.toFixed(dp + 1),
        remitbee: +bv.toFixed(dp + 1),
      };
    });
  }, [pair, baseRate, dp]);

  const intraday = useMemo(() => {
    const rnd = seeded(hash(pair.to) + tick + 3);
    let v = baseRate * 0.998;
    return Array.from({ length: 24 }, (_, h) => {
      v += (rnd() - 0.5) * baseRate * 0.0014;
      return { t: `${String(h).padStart(2, "0")}:00`, rate: +v.toFixed(dp + 1) };
    });
  }, [pair, baseRate, dp, tick]);

  // volatility heatmap: competitor x last 7 days, % daily move
  const heat = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
    const matrix = competitors.slice(0, 10).map((r) => {
      const rnd = seeded(hash(r.name + pair.to));
      return { name: r.name, cells: days.map(() => +(rnd() * 1.6).toFixed(2)) };
    });
    return { days, matrix };
  }, [competitors, pair]);

  /* ---- alert generation on tick ---- */
  useEffect(() => {
    if (tick === 0) return;
    const key = pair.from + pair.to;
    const prev = seenRef.current[key];
    const newAlerts = [];
    const stamp = new Date().toLocaleTimeString("en-US", { hour12: false });
    competitors.forEach((r) => {
      const p = prev?.[r.name];
      if (p != null) {
        const delta = ((r.rate - p) / p) * 100;
        if (delta > 0.15) newAlerts.push({ id: Math.random(), type: "up", text: `${r.name} raised ${pair.from}→${pair.to} by ${delta.toFixed(2)}%`, t: stamp });
        else if (delta < -0.15) newAlerts.push({ id: Math.random(), type: "down", text: `${r.name} dropped ${pair.from}→${pair.to} by ${Math.abs(delta).toFixed(2)}%`, t: stamp });
      }
    });
    if (highest.name !== "RemitBee" && Math.abs(diffVsBest) > 1.2)
      newAlerts.push({ id: Math.random(), type: "threshold", text: `Gap to best (${highest.name}) is ${Math.abs(diffVsBest).toFixed(2)}% — above 1.20% threshold`, t: stamp });
    seenRef.current[key] = Object.fromEntries(competitors.map((r) => [r.name, r.rate]));
    if (newAlerts.length) setAlerts((a) => [...newAlerts, ...a].slice(0, 14));
  }, [tick]); // eslint-disable-line

  /* ---- history table rows ---- */
  const historyRows = useMemo(() => {
    const out = [];
    if (competitors.length === 0) return out;
    
    for (let i = 0; i < 60; i++) {
      const r = competitors[i % competitors.length];
      const d = new Date(now.getTime() - i * 1000 * 60 * 7);
      out.push({
        id: i,
        time: d.toLocaleString("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }),
        competitor: r.name,
        pair: `${pair.from}→${pair.to}`,
        service: service === "money_transfer" ? "Money Transfer" : "Currency Exchange",
        rate: r.rate * (1 + (seeded(hash(r.name + i))() - 0.5) * 0.004),
        source: r.source,
      });
    }
    return out;
  }, [competitors, pair, service, now]);

  const filteredHistory = historyRows.filter((r) =>
    (histFilter.competitor === "All" || r.competitor === histFilter.competitor) &&
    (!histFilter.q || r.competitor.toLowerCase().includes(histFilter.q.toLowerCase()))
  );

  /* ---- KPI cards ---- */
  const kpis = [
    { label: "RemitBee Rate", value: fmt(bee.rate), accent: C.brand, sub: `Rank #${beeRank} of ${rows.length}` },
    { label: "Highest Competitor", value: fmt(highest.rate), accent: C.up, sub: highest.name },
    { label: "Lowest Competitor", value: fmt(lowest.rate), accent: C.down, sub: lowest.name },
    { label: "Average Market", value: fmt(avg), accent: C.text, sub: `${competitors.length} providers` },
    { label: "Rate Difference", value: fmt(Math.abs(spreadVal), dp + 1), accent: C.amber, sub: "best − worst" },
    { label: "Market Spread", value: ((spreadVal / avg) * 100).toFixed(2) + "%", accent: C.violet, sub: "as % of avg" },
  ];

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh", fontFamily: sans }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        ::-webkit-scrollbar{height:8px;width:8px}
        ::-webkit-scrollbar-thumb{background:${C.line};border-radius:8px}
        ::-webkit-scrollbar-track{background:transparent}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
      `}</style>

      {/* ===== Loading & Error Banner ===== */}
      {ratesLoading && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 3, background: C.bg, zIndex: 100 }}>
          <div style={{ height: "100%", background: C.brand, width: "30%", animation: "progress 1.5s infinite" }} />
          <style>{`
            @keyframes progress {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(400%); }
            }
          `}</style>
        </div>
      )}
      {ratesError && (
        <div style={{ background: C.downSoft, color: C.down, padding: "10px 22px", fontSize: 13, fontWeight: 600, borderBottom: `1px solid ${C.down}` }}>
          {ratesError}
        </div>
      )}

      {/* ===== Top bar ===== */}
      <header
        className="flex items-center justify-between flex-wrap gap-3"
        style={{ padding: "16px 22px", borderBottom: `1px solid ${C.line}`, background: C.panelAlt, position: "sticky", top: 0, zIndex: 30 }}
      >
        <div className="flex items-center gap-3">
          <div style={{ width: 34, height: 34, borderRadius: 9, background: C.brand, display: "grid", placeItems: "center" }}>
            <Activity size={19} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15.5, letterSpacing: "-.01em" }}>RemitBee · Rate Monitor</div>
            <div style={{ fontSize: 11.5, color: C.faint }}>FX competitor intelligence desk</div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-2" style={{ fontSize: 12, color: live ? C.up : C.faint, fontFamily: mono }}>
            <Circle size={9} fill={live ? C.up : C.faint} color={live ? C.up : C.faint} style={{ animation: live ? "pulse 1.6s infinite" : "none" }} />
            {live ? "LIVE" : "PAUSED"}
          </span>
          <span style={{ fontSize: 12, color: C.muted, fontFamily: mono }}>
            Updated {now.toLocaleTimeString("en-US", { hour12: false })}
          </span>
          <select
            value={interval}
            onChange={(e) => setIntervalMin(e.target.value)}
            style={{ background: C.panel, color: C.text, border: `1px solid ${C.line}`, borderRadius: 9, padding: "7px 10px", fontSize: 12.5, fontWeight: 600 }}
          >
            <option value="5">Every 5 min</option>
            <option value="10">Every 10 min</option>
          </select>
          <button
            onClick={() => setLive((l) => !l)}
            className="inline-flex items-center gap-2"
            style={{ background: live ? C.panel : C.brand, color: live ? C.text : "#fff", border: `1px solid ${live ? C.line : C.brand}`, borderRadius: 9, padding: "7px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
          >
            {live ? <Pause size={14} /> : <Play size={14} />}
            {live ? "Pause" : "Resume"}
          </button>
          <button
            onClick={() => setTick((x) => x + 1)}
            className="inline-flex items-center gap-2"
            style={{ background: C.panel, color: C.text, border: `1px solid ${C.line}`, borderRadius: 9, padding: "7px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1340, margin: "0 auto", padding: "22px" }} className="flex flex-col gap-5">

        {/* ===== Filters ===== */}
        <Panel title="Filters" right={<span style={{ fontSize: 11.5, color: C.faint, fontFamily: mono }}>{pair.from} → {pair.to}</span>}>
          <div className="flex flex-wrap items-end gap-4">
            <div style={{ minWidth: 200, flex: "1 1 200px" }}>
              <Dropdown
                label="Service"
                value={service}
                onChange={setService}
                options={[
                  { value: "money_transfer", label: "Money Transfer" },
                  { value: "currency_exchange", label: "Currency Exchange" },
                ]}
              />
            </div>

            {service === "money_transfer" ? (
              <>
                <div style={{ minWidth: 180, flex: "1 1 180px" }}>
                  <Dropdown
                    label="From currency"
                    value={fromCur}
                    onChange={setFromCur}
                    options={[{ value: "CAD", label: "CAD – Canadian Dollar" }]}
                  />
                </div>
                <div style={{ minWidth: 240, flex: "2 1 240px" }}>
                  <Dropdown
                    label="To currency"
                    value={toCur}
                    onChange={setToCur}
                    options={currencies.map((c) => ({ value: c.code, label: `${c.code} – ${c.name}` }))}
                  />
                </div>
              </>
            ) : (
              <div style={{ minWidth: 240, flex: "2 1 240px" }}>
                <Dropdown
                  label="Currency pair"
                  value={cxPair}
                  onChange={setCxPair}
                  options={[
                    { value: "CAD_USD", label: "CAD → USD" },
                    { value: "USD_CAD", label: "USD → CAD" },
                  ]}
                />
              </div>
            )}
          </div>
        </Panel>

        {/* ===== KPI row ===== */}
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {kpis.map((k) => (
            <div key={k.label} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: "16px 18px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: k.accent }} />
              <div style={{ fontSize: 10.5, letterSpacing: ".09em", textTransform: "uppercase", color: C.faint, fontWeight: 600 }}>{k.label}</div>
              <div style={{ fontFamily: mono, fontSize: 25, fontWeight: 700, marginTop: 8, color: k.accent, letterSpacing: "-.01em" }}>{k.value}</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* ===== Competitor comparison ===== */}
        <Panel
          title="Competitor comparison"
          right={
            <div className="flex items-center gap-3" style={{ fontSize: 11, color: C.faint }}>
              <span className="inline-flex items-center gap-1.5"><span style={{ width: 9, height: 9, borderRadius: 2, background: C.up }} />Best</span>
              <span className="inline-flex items-center gap-1.5"><span style={{ width: 9, height: 9, borderRadius: 2, background: C.down }} />Worst</span>
              <span className="inline-flex items-center gap-1.5"><span style={{ width: 9, height: 9, borderRadius: 2, background: C.brand }} />RemitBee</span>
            </div>
          }
          pad={false}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: C.faint, textAlign: "left", fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase" }}>
                  {["#", "Provider", "Rate", "Δ 24h", "Fee", "vs RemitBee", "Source"].map((h, i) => (
                    <th key={h} style={{ padding: "11px 18px", fontWeight: 600, textAlign: i >= 2 && i <= 5 ? "right" : "left", borderBottom: `1px solid ${C.lineSoft}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const isHigh = r.name === highest.name;
                  const isLow = r.name === lowest.name;
                  const rowBg = r.isBee ? C.brandSoft : isHigh ? C.upSoft : isLow ? C.downSoft : "transparent";
                  const vsBee = ((r.rate - bee.rate) / bee.rate) * 100;
                  return (
                    <tr key={r.name} style={{ background: rowBg, borderBottom: `1px solid ${C.lineSoft}` }}>
                      <td style={{ padding: "11px 18px", fontFamily: mono, color: C.faint }}>{i + 1}</td>
                      <td style={{ padding: "11px 18px", fontWeight: 700, color: r.isBee ? C.brand : isHigh ? C.up : isLow ? C.down : C.text }}>
                        {r.name}{r.isBee && <span style={{ marginLeft: 7, fontSize: 10, fontWeight: 700, color: C.brand, border: `1px solid ${C.brand}`, borderRadius: 5, padding: "1px 5px" }}>YOU</span>}
                      </td>
                      <td style={{ padding: "11px 18px", textAlign: "right", fontFamily: mono, fontWeight: 700 }}>{fmt(r.rate)}</td>
                      <td style={{ padding: "11px 18px", textAlign: "right" }}><Delta value={r.change} /></td>
                      <td style={{ padding: "11px 18px", textAlign: "right", fontFamily: mono, color: r.fee === 0 ? C.up : C.muted }}>{r.fee === 0 ? "Free" : `$${r.fee.toFixed(2)}`}</td>
                      <td style={{ padding: "11px 18px", textAlign: "right", fontFamily: mono, color: r.isBee ? C.faint : vsBee > 0 ? C.up : C.down }}>
                        {r.isBee ? "—" : `${vsBee > 0 ? "+" : ""}${vsBee.toFixed(2)}%`}
                      </td>
                      <td style={{ padding: "11px 18px" }}>
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: r.source === "API" ? C.up : C.amber, border: `1px solid ${r.source === "API" ? C.up : C.amber}`, borderRadius: 5, padding: "2px 7px", opacity: .85 }}>{r.source}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* ===== Charts grid ===== */}
        <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))" }}>
          <Panel title="Historical rate trend · 30d">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trend} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={C.lineSoft} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: C.faint, fontSize: 10, fontFamily: mono }} interval={4} stroke={C.line} />
                <YAxis tick={{ fill: C.faint, fontSize: 10, fontFamily: mono }} stroke={C.line} domain={["auto", "auto"]} width={56} />
                <Tooltip contentStyle={{ background: C.panelAlt, border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 12 }} labelStyle={{ color: C.muted }} />
                <Line type="monotone" dataKey="market" stroke={C.violet} strokeWidth={2} dot={false} name="Market avg" />
                <Line type="monotone" dataKey="remitbee" stroke={C.brand} strokeWidth={2.4} dot={false} name="RemitBee" />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Competitor comparison · current">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={sorted.map((r) => ({ name: r.name, rate: +r.rate.toFixed(dp + 1), isBee: r.isBee }))} margin={{ top: 6, right: 8, left: -8, bottom: 30 }}>
                <CartesianGrid stroke={C.lineSoft} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: C.faint, fontSize: 9, fontFamily: mono }} angle={-40} textAnchor="end" interval={0} stroke={C.line} height={50} />
                <YAxis tick={{ fill: C.faint, fontSize: 10, fontFamily: mono }} stroke={C.line} domain={["auto", "auto"]} width={56} />
                <Tooltip contentStyle={{ background: C.panelAlt, border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 12 }} cursor={{ fill: C.lineSoft }} />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                  {sorted.map((r) => (
                    <Cell
                      key={r.name}
                      fill={r.isBee ? C.brand : r.name === highest.name ? C.up : r.name === lowest.name ? C.down : C.faint}
                    />
                  ))}
                </Bar>
                <ReferenceLine y={avg} stroke={C.amber} strokeDasharray="4 4" />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Daily movement · 24h intraday">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={intraday} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="ar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.brand} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={C.brand} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={C.lineSoft} vertical={false} />
                <XAxis dataKey="t" tick={{ fill: C.faint, fontSize: 9, fontFamily: mono }} interval={3} stroke={C.line} />
                <YAxis tick={{ fill: C.faint, fontSize: 10, fontFamily: mono }} stroke={C.line} domain={["auto", "auto"]} width={56} />
                <Tooltip contentStyle={{ background: C.panelAlt, border: `1px solid ${C.line}`, borderRadius: 10, fontSize: 12 }} />
                <Area type="monotone" dataKey="rate" stroke={C.brand} strokeWidth={2} fill="url(#ar)" />
              </AreaChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Currency volatility heat map · 7d">
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "separate", borderSpacing: 4, fontSize: 11 }}>
                <thead>
                  <tr>
                    <th></th>
                    {heat.days.map((d) => (
                      <th key={d} style={{ color: C.faint, fontWeight: 600, fontFamily: mono, fontSize: 10, padding: "0 2px" }}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heat.matrix.map((row) => (
                    <tr key={row.name}>
                      <td style={{ color: C.muted, fontWeight: 600, paddingRight: 8, whiteSpace: "nowrap", fontSize: 11 }}>{row.name}</td>
                      {row.cells.map((v, i) => {
                        const t = Math.min(v / 1.6, 1);
                        const bg = `rgba(${Math.round(47 + t * 200)}, ${Math.round(208 - t * 140)}, ${Math.round(138 - t * 60)}, ${0.18 + t * 0.7})`;
                        return (
                          <td key={i} title={`${v}%`} style={{ width: 40, height: 30, textAlign: "center", borderRadius: 6, background: bg, color: t > 0.55 ? "#0A0F1A" : C.text, fontFamily: mono, fontWeight: 600 }}>{v}</td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 10.5, color: C.faint, marginTop: 10, fontFamily: mono }}>cell = daily % move · greener = calmer · redder = more volatile</div>
          </Panel>
        </div>

        {/* ===== Analytics ===== */}
        <Panel title="Analytics">
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            {[
              { l: "Highest competitor", v: highest.name, c: C.up },
              { l: "Lowest competitor", v: lowest.name, c: C.down },
              { l: "Average market rate", v: fmt(avg), c: C.text },
              { l: "Market trend", v: trend[29].market >= trend[0].market ? "Upward" : "Downward", c: trend[29].market >= trend[0].market ? C.up : C.down },
              { l: "Daily change", node: <Delta value={(seeded(hash(pair.to))() - 0.45) * 1.4} size={18} /> },
              { l: "Weekly change", node: <Delta value={(seeded(hash(pair.to) + 1)() - 0.45) * 2.8} size={18} /> },
              { l: "Monthly change", node: <Delta value={(seeded(hash(pair.to) + 2)() - 0.45) * 5.2} size={18} /> },
              { l: "RemitBee vs best", node: <Delta value={diffVsBest} size={18} /> },
              { l: "RemitBee vs avg", node: <Delta value={diffVsAvg} size={18} /> },
              { l: "Best rate", v: fmt(highest.rate), c: C.up },
              { l: "Worst rate", v: fmt(lowest.rate), c: C.down },
              { l: "Providers tracked", v: String(rows.length), c: C.brand },
            ].map((a) => (
              <div key={a.l} style={{ background: C.panelAlt, border: `1px solid ${C.lineSoft}`, borderRadius: 11, padding: "13px 15px" }}>
                <div style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: C.faint, fontWeight: 600 }}>{a.l}</div>
                <div style={{ marginTop: 7, fontFamily: mono, fontSize: 17, fontWeight: 700, color: a.c || C.text }}>
                  {a.node || a.v}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* ===== Alerts + History ===== */}
        <div className="grid gap-5" style={{ gridTemplateColumns: "minmax(320px, 1fr) minmax(420px, 1.8fr)" }}>
          <Panel title="Alerts" right={<Bell size={14} color={C.faint} />}>
            <div className="flex flex-col gap-2" style={{ maxHeight: 360, overflowY: "auto" }}>
              {alerts.length === 0 && (
                <div style={{ color: C.faint, fontSize: 12.5, padding: "20px 0", textAlign: "center" }}>
                  No alerts yet. Triggers fire on rate moves &gt;0.15% and when the gap to best exceeds 1.20%.
                </div>
              )}
              {alerts.map((a) => {
                const col = a.type === "up" ? C.up : a.type === "down" ? C.down : C.amber;
                const Icon = a.type === "up" ? ArrowUpRight : a.type === "down" ? ArrowDownRight : Bell;
                return (
                  <div key={a.id} className="flex items-start gap-2.5" style={{ background: C.panelAlt, border: `1px solid ${C.lineSoft}`, borderLeft: `3px solid ${col}`, borderRadius: 9, padding: "9px 12px" }}>
                    <Icon size={15} color={col} style={{ marginTop: 1, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12.5, color: C.text, fontWeight: 500 }}>{a.text}</div>
                      <div style={{ fontSize: 10.5, color: C.faint, fontFamily: mono, marginTop: 2 }}>{a.t}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel
            title="History"
            right={
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={13} color={C.faint} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    placeholder="Search provider"
                    value={histFilter.q}
                    onChange={(e) => setHistFilter((f) => ({ ...f, q: e.target.value }))}
                    style={{ background: C.panelAlt, border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 10px 6px 28px", fontSize: 12, color: C.text, outline: "none", width: 150 }}
                  />
                </div>
                <select
                  value={histFilter.competitor}
                  onChange={(e) => setHistFilter((f) => ({ ...f, competitor: e.target.value }))}
                  style={{ background: C.panelAlt, border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 9px", fontSize: 12, color: C.text, fontWeight: 600 }}
                >
                  <option value="All">All providers</option>
                  {COMPETITORS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button className="inline-flex items-center gap-1.5" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 11px", fontSize: 12, fontWeight: 600, color: C.text, cursor: "pointer" }}>
                  <Download size={13} /> Export
                </button>
              </div>
            }
            pad={false}
          >
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead style={{ position: "sticky", top: 0, background: C.panel, zIndex: 1 }}>
                  <tr style={{ color: C.faint, textAlign: "left", fontSize: 10.5, letterSpacing: ".05em", textTransform: "uppercase" }}>
                    {["Time", "Provider", "Pair", "Service", "Rate", "Src"].map((h, i) => (
                      <th key={h} style={{ padding: "9px 16px", fontWeight: 600, textAlign: i === 4 ? "right" : "left", borderBottom: `1px solid ${C.lineSoft}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((r) => (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${C.lineSoft}` }}>
                      <td style={{ padding: "8px 16px", fontFamily: mono, color: C.muted, whiteSpace: "nowrap" }}>{r.time}</td>
                      <td style={{ padding: "8px 16px", fontWeight: 600, color: r.competitor === "RemitBee" ? C.brand : C.text }}>{r.competitor}</td>
                      <td style={{ padding: "8px 16px", fontFamily: mono, color: C.muted }}>{r.pair}</td>
                      <td style={{ padding: "8px 16px", color: C.muted, fontSize: 11.5 }}>{r.service}</td>
                      <td style={{ padding: "8px 16px", textAlign: "right", fontFamily: mono, fontWeight: 600 }}>{fmt(r.rate)}</td>
                      <td style={{ padding: "8px 16px", color: r.source === "API" ? C.up : C.amber, fontSize: 11, fontFamily: mono }}>{r.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <footer style={{ textAlign: "center", color: C.faint, fontSize: 11.5, padding: "10px 0 4px" }}>
          Demonstration build · rates are simulated. Wire the backend blueprint to stream live data into this same UI.
        </footer>
      </main>
    </div>
  );
}
