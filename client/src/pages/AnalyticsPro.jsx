import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement,
    ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

const C = {
    neon: '#00e5a0', neonDim: 'rgba(0,229,160,0.12)',
    blue: '#3b82f6', blueDim: 'rgba(59,130,246,0.12)',
    purple: '#a78bfa', purpleDim: 'rgba(167,139,250,0.12)',
    orange: '#fb923c', orangeDim: 'rgba(251,146,60,0.12)',
    red: '#ef4444', redDim: 'rgba(239,68,68,0.12)',
    yellow: '#facc15', yellowDim: 'rgba(250,204,21,0.12)',
    pink: '#ec4899', teal: '#14b8a6', tealDim: 'rgba(20,184,166,0.12)',
    cyan: '#22d3ee', text: '#e2e8f0', muted: '#64748b', dim: '#475569',
    grid: 'rgba(255,255,255,0.04)',
};
const PALETTE = [C.neon, C.blue, C.orange, C.purple, C.red, C.yellow, C.pink, C.teal];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const glass = {
    background: 'linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.8) 100%)',
    backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16, padding: '1.25rem', position: 'relative', overflow: 'hidden',
};

const fmt = (n) => n == null ? '0.00' : Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtI = (n) => n == null ? '0' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtK = (n) => { const v = Number(n); if (v >= 10000000) return (v / 10000000).toFixed(2) + 'Cr'; if (v >= 100000) return (v / 100000).toFixed(1) + 'L'; if (v >= 1000) return (v / 1000).toFixed(1) + 'K'; return v.toFixed(0); };
const pctChg = (c, p) => { c = Number(c); p = Number(p); if (!p) return null; return ((c - p) / Math.abs(p) * 100).toFixed(0); };

function Trend({ current, previous, invert = false }) {
    const v = pctChg(current, previous);
    if (v === null) return null;
    const up = Number(v) > 0;
    const good = invert ? !up : up;
    return (
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: good ? C.neon : C.red, marginLeft: 6 }}>
            {up ? '+' : ''}{v}%
        </span>
    );
}

function Metric({ label, value, prefix = '', current, previous, invert, delay = 0, color }) {
    return (
        <div className="animate-in" style={{ ...glass, animationDelay: `${delay}s` }}>
            <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: 1.5, color: C.muted, marginBottom: 8, fontWeight: 600 }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: '1.65rem', fontWeight: 800, color: color || C.text, lineHeight: 1 }}>{prefix}{value}</span>
                <Trend current={current} previous={previous} invert={invert} />
            </div>
        </div>
    );
}

const tooltipBase = {
    backgroundColor: 'rgba(2,6,23,0.95)', titleColor: C.text, bodyColor: '#94a3b8',
    borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 14, cornerRadius: 10,
    titleFont: { size: 13, weight: 700 }, bodyFont: { size: 12 },
    displayColors: true, boxPadding: 4,
};

const revenueTooltip = {
    ...tooltipBase,
    callbacks: {
        title: (items) => { const d = items[0]?.label; if (!d) return ''; try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return d; } },
        label: (ctx) => ` ${ctx.dataset.label || 'Value'}: ₹${fmtI(ctx.raw)}`,
    },
};

const ordersTooltip = {
    ...tooltipBase,
    callbacks: {
        title: (items) => { const d = items[0]?.label; if (!d) return ''; try { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return d; } },
        label: (ctx) => ` ${ctx.dataset.label || 'Orders'}: ${fmtI(ctx.raw)}`,
    },
};

const hourlyTooltip = {
    ...tooltipBase,
    callbacks: {
        label: (ctx) => ` Orders: ${fmtI(ctx.raw)}`,
    },
};

const pieTooltip = {
    ...tooltipBase,
    callbacks: {
        label: (ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
            return ` ${ctx.label}: ${fmtI(ctx.raw)} (${pct}%)`;
        },
    },
};

const chartOpts = {
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false }, tooltip: ordersTooltip },
    scales: { x: { grid: { display: false }, ticks: { color: C.dim, maxTicksLimit: 12, font: { size: 10 } } }, y: { grid: { color: C.grid }, ticks: { color: C.dim, font: { size: 10 } }, beginAtZero: true } },
};

const PRESETS = [
    { label: 'Today', days: 0 }, { label: '7 Days', days: 7 }, { label: '30 Days', days: 30 },
    { label: '90 Days', days: 90 }, { label: '6 Months', days: 180 }, { label: 'YTD', days: -1 }, { label: 'All Time', days: -2 },
];

function AnalyticsPro() {
    const [range, setRange] = useState(() => {
        const to = new Date(), from = new Date(); from.setDate(from.getDate() - 30);
        return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
    });
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [preset, setPreset] = useState('30 Days');

    const applyPreset = (p) => {
        setPreset(p.label);
        const to = new Date();
        let from;
        if (p.days === 0) from = new Date(to.getFullYear(), to.getMonth(), to.getDate());
        else if (p.days === -1) from = new Date(to.getFullYear(), 0, 1);
        else if (p.days === -2) from = new Date('2020-01-01');
        else from = new Date(Date.now() - p.days * 86400000);
        setRange({ from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] });
    };

    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const r = await fetch(`/api/analytics/pro?from=${range.from}&to=${range.to}`);
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
            setData(await r.json());
        } catch (e) { setError(e.message); } finally { setLoading(false); }
    }, [range]);

    useEffect(() => { load(); }, [load]);

    const salesChart = useMemo(() => data?.ordersOverTime ? ({
        labels: data.ordersOverTime.map(d => d.date), datasets: [{
            label: 'Total Sales', data: data.ordersOverTime.map(d => Number(d.revenue)),
            backgroundColor: C.neonDim, borderColor: C.neon, borderWidth: 2, borderRadius: 4,
        }],
    }) : null, [data]);

    const aovChart = useMemo(() => data?.revenueOverTime ? ({
        labels: data.revenueOverTime.map(d => d.date), datasets: [{
            label: 'Revenue', data: data.revenueOverTime.map(d => Number(d.revenue)),
            borderColor: C.blue, backgroundColor: C.blueDim, borderWidth: 2, pointRadius: 0, fill: true, tension: 0.4,
        }],
    }) : null, [data]);

    const hourlyChart = useMemo(() => {
        if (!data?.hourlyOrders) return null;
        const hrs = Array.from({ length: 24 }, (_, i) => i);
        const map = Object.fromEntries(data.hourlyOrders.map(h => [h.hour, h]));
        const maxC = Math.max(...data.hourlyOrders.map(x => x.count), 1);
        return {
            labels: hrs.map(h => { const p = h % 12 || 12; return `${p} ${h < 12 ? 'AM' : 'PM'}`; }),
            datasets: [{
                label: 'Orders', data: hrs.map(h => map[h]?.count || 0),
                backgroundColor: hrs.map(h => { const v = (map[h]?.count || 0) / maxC; return `rgba(0,229,160,${0.08 + v * 0.55})`; }),
                borderColor: C.neon + '30', borderWidth: 1, borderRadius: 3,
            }],
        };
    }, [data]);

    const dowChart = useMemo(() => {
        if (!data?.dayOfWeekOrders) return null;
        const map = Object.fromEntries(data.dayOfWeekOrders.map(d => [d.dow, d]));
        return { labels: DOW, datasets: [{ label: 'Revenue', data: DOW.map((_, i) => Number(map[i]?.revenue || 0)), backgroundColor: C.purpleDim, borderColor: C.purple, borderWidth: 2, borderRadius: 4 }] };
    }, [data]);

    const finChart = useMemo(() => data?.financialStatus ? ({
        labels: data.financialStatus.map(d => d.status), datasets: [{ data: data.financialStatus.map(d => d.count), backgroundColor: PALETTE, borderWidth: 0, hoverOffset: 8 }],
    }) : null, [data]);

    const fulChart = useMemo(() => data?.fulfillmentStatus ? ({
        labels: data.fulfillmentStatus.map(d => d.status), datasets: [{ data: data.fulfillmentStatus.map(d => d.count), backgroundColor: PALETTE, borderWidth: 0, hoverOffset: 8 }],
    }) : null, [data]);

    const valChart = useMemo(() => data?.orderValueDist ? ({
        labels: data.orderValueDist.map(d => d.bucket), datasets: [{
            label: 'Orders', data: data.orderValueDist.map(d => d.count),
            backgroundColor: data.orderValueDist.map((_, i) => PALETTE[i % PALETTE.length] + '30'),
            borderColor: data.orderValueDist.map((_, i) => PALETTE[i % PALETTE.length]), borderWidth: 2, borderRadius: 4
        }],
    }) : null, [data]);

    const prodChart = useMemo(() => data?.topProducts ? ({
        labels: data.topProducts.map(p => p.title?.substring(0, 32) + (p.title?.length > 32 ? '...' : '')),
        datasets: [{
            label: 'Revenue', data: data.topProducts.map(p => Number(p.revenue)),
            backgroundColor: data.topProducts.map((_, i) => PALETTE[i % PALETTE.length] + '25'),
            borderColor: data.topProducts.map((_, i) => PALETTE[i % PALETTE.length]), borderWidth: 1.5, borderRadius: 3
        }],
    }) : null, [data]);

    const custChart = useMemo(() => data?.customerAcquisition ? ({
        labels: data.customerAcquisition.map(d => d.date), datasets: [{
            label: 'New Customers', data: data.customerAcquisition.map(d => d.new_customers),
            borderColor: C.teal, backgroundColor: C.tealDim, borderWidth: 2, pointRadius: 0, fill: true, tension: 0.4
        }],
    }) : null, [data]);

    const pieOpts = {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: { legend: { position: 'bottom', labels: { color: C.text, font: { size: 11 }, padding: 10, usePointStyle: true } }, tooltip: pieTooltip }
    };
    const revYOpts = { ...chartOpts, interaction: { mode: 'index', intersect: false }, plugins: { ...chartOpts.plugins, tooltip: revenueTooltip }, scales: { ...chartOpts.scales, y: { ...chartOpts.scales.y, ticks: { ...chartOpts.scales.y.ticks, callback: v => fmtK(v) } } } };
    const hourlyOpts = { ...chartOpts, plugins: { ...chartOpts.plugins, tooltip: hourlyTooltip } };

    const s = data?.summary || {};
    const ps = data?.prevSummary || {};
    const nvr = data?.newVsReturning || {};
    const retRate = nvr.returning_customers && (nvr.new_customers + nvr.returning_customers) > 0
        ? ((nvr.returning_customers / (nvr.new_customers + nvr.returning_customers)) * 100).toFixed(1) : '0.0';
    const grossSales = Number(s.gross_sales || 0);
    const discounts = Number(s.discounts || 0);
    const returns = Number(s.returns || 0);
    const netSales = grossSales - discounts - returns;
    const taxes = Number(s.taxes || 0);
    const totalSales = Number(s.total_sales || 0);

    if (loading && !data) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
            <div style={{ width: 40, height: 40, border: `3px solid ${C.neon}20`, borderTop: `3px solid ${C.neon}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: C.muted, fontSize: '0.85rem' }}>Loading analytics...</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    const SectionTitle = ({ children }) => (
        <h3 style={{ margin: '0 0 14px', fontSize: '0.9rem', fontWeight: 700, color: C.text }}>{children}</h3>
    );

    return (
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '1.25rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, background: `linear-gradient(135deg, ${C.text}, ${C.muted})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 2 }}>Analytics Pro</h1>
                <p style={{ color: C.muted, fontSize: '0.82rem', margin: 0 }}>Executive intelligence dashboard</p>
            </div>

            {/* Period selector */}
            <div style={{ ...glass, marginBottom: '1.25rem', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: C.dim, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', marginRight: 4 }}>Period</span>
                {PRESETS.map(p => (
                    <button key={p.label} onClick={() => applyPreset(p)} style={{
                        padding: '4px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600, transition: 'all 0.2s',
                        background: preset === p.label ? C.neon : 'rgba(255,255,255,0.06)', color: preset === p.label ? '#0f172a' : C.muted,
                    }}>{p.label}</button>
                ))}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="date" value={range.from} onChange={e => { setRange(r => ({ ...r, from: e.target.value })); setPreset(''); }}
                        style={{ padding: '3px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: C.text, fontSize: '0.78rem' }} />
                    <span style={{ color: C.dim, fontSize: '0.75rem' }}>to</span>
                    <input type="date" value={range.to} onChange={e => { setRange(r => ({ ...r, to: e.target.value })); setPreset(''); }}
                        style={{ padding: '3px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: C.text, fontSize: '0.78rem' }} />
                </div>
            </div>

            {error && <div style={{ ...glass, borderColor: C.red + '40', marginBottom: '1rem' }}><span style={{ color: C.red }}>Error: {error}</span></div>}

            {data && (<>
                {/* KPI Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.85rem', marginBottom: '1.25rem' }}>
                    <Metric label="Gross Sales" value={`${fmtI(grossSales)}`} prefix="₹" current={grossSales} previous={ps.gross_sales} delay={0} />
                    <Metric label="Total Orders" value={fmtI(s.total_orders)} current={s.total_orders} previous={ps.total_orders} delay={0.03} color={C.blue} />
                    <Metric label="Average Order Value" value={`${fmt(s.avg_order_value)}`} prefix="₹" current={s.avg_order_value} previous={ps.avg_order_value} delay={0.06} color={C.purple} />
                    <Metric label="Returning Customer Rate" value={`${retRate}%`} delay={0.09} color={C.teal} />
                </div>

                {/* Sales Over Time + Breakdown */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.6fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                    <div style={glass}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <SectionTitle>Total sales over time</SectionTitle>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: C.neon }}>₹{fmtI(totalSales)}<Trend current={totalSales} previous={ps.total_sales} /></span>
                        </div>
                        <div style={{ height: 260 }}>{salesChart ? <Bar data={salesChart} options={revYOpts} /> : null}</div>
                    </div>

                    {/* Total Sales Breakdown - Shopify style */}
                    <div style={glass}>
                        <SectionTitle>Total sales breakdown</SectionTitle>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {[
                                { label: 'Gross sales', val: grossSales, prev: Number(ps.gross_sales || 0), color: C.text },
                                { label: 'Discounts', val: -discounts, prev: -Number(ps.discounts || 0), color: C.red, invert: true },
                                { label: 'Returns', val: -returns, prev: -Number(ps.returns || 0), color: C.red, invert: true },
                            ].map((row, i) => (
                                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <span style={{ fontSize: '0.82rem', color: C.muted }}>{row.label}</span>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: row.color }}>₹{fmt(row.val)}</span>
                                        <Trend current={Math.abs(row.val)} previous={Math.abs(row.prev)} invert={row.invert} />
                                    </div>
                                </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: C.text }}>Net sales</span>
                                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: C.neon }}>₹{fmt(netSales)}</span>
                            </div>
                            {taxes > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <span style={{ fontSize: '0.82rem', color: C.muted }}>Taxes</span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: C.text }}>₹{fmt(taxes)}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0 4px' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: C.text }}>Total sales</span>
                                <div>
                                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: C.neon }}>₹{fmt(totalSales)}</span>
                                    <Trend current={totalSales} previous={ps.total_sales} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Hourly + AOV */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                    <div style={glass}>
                        <SectionTitle>Orders by hour of day</SectionTitle>
                        <div style={{ height: 210 }}>{hourlyChart ? <Bar data={hourlyChart} options={hourlyOpts} /> : null}</div>
                    </div>
                    <div style={glass}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                            <SectionTitle>Revenue over time</SectionTitle>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: C.blue }}>₹{fmtI(totalSales)}</span>
                        </div>
                        <div style={{ height: 210 }}>{aovChart ? <Line data={aovChart} options={revYOpts} /> : null}</div>
                    </div>
                </div>

                {/* Payment + Fulfillment + Customer Mix */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                    <div style={glass}>
                        <SectionTitle>Payment status</SectionTitle>
                        <div style={{ height: 200 }}>{finChart ? <Doughnut data={finChart} options={pieOpts} /> : null}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 10 }}>
                            <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1rem', fontWeight: 700, color: C.neon }}>{fmtI(s.paid_orders)}</div><div style={{ fontSize: '0.62rem', color: C.dim, textTransform: 'uppercase', letterSpacing: 1 }}>Paid</div></div>
                            <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1rem', fontWeight: 700, color: C.yellow }}>{fmtI(s.pending_orders)}</div><div style={{ fontSize: '0.62rem', color: C.dim, textTransform: 'uppercase', letterSpacing: 1 }}>Pending</div></div>
                            <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1rem', fontWeight: 700, color: C.red }}>{fmtI(s.refunded_orders)}</div><div style={{ fontSize: '0.62rem', color: C.dim, textTransform: 'uppercase', letterSpacing: 1 }}>Refunded</div></div>
                        </div>
                    </div>
                    <div style={glass}>
                        <SectionTitle>Fulfillment status</SectionTitle>
                        <div style={{ height: 200 }}>{fulChart ? <Doughnut data={fulChart} options={pieOpts} /> : null}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 10 }}>
                            <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1rem', fontWeight: 700, color: C.neon }}>{fmtI(s.fulfilled_orders)}</div><div style={{ fontSize: '0.62rem', color: C.dim, textTransform: 'uppercase', letterSpacing: 1 }}>Fulfilled</div></div>
                            <div style={{ textAlign: 'center' }}><div style={{ fontSize: '1rem', fontWeight: 700, color: C.orange }}>{fmtI((s.total_orders || 0) - (s.fulfilled_orders || 0))}</div><div style={{ fontSize: '0.62rem', color: C.dim, textTransform: 'uppercase', letterSpacing: 1 }}>Pending</div></div>
                        </div>
                    </div>
                    <div style={glass}>
                        <SectionTitle>Customer mix</SectionTitle>
                        <div style={{ marginTop: 16, marginBottom: 16 }}>
                            <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 24 }}>
                                {Number(retRate) > 0 && (<>
                                    <div style={{ width: `${100 - Number(retRate)}%`, background: `linear-gradient(90deg, ${C.blue}, ${C.cyan})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#0f172a' }}>{(100 - Number(retRate)).toFixed(0)}%</div>
                                    <div style={{ width: `${retRate}%`, background: `linear-gradient(90deg, ${C.purple}, ${C.pink})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#0f172a' }}>{retRate}%</div>
                                </>)}
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div style={{ padding: '8px 12px', borderRadius: 10, background: C.blueDim }}>
                                <div style={{ fontSize: '0.62rem', color: C.dim, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>New</div>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: C.blue }}>{fmtI(nvr.new_customers)}</div>
                                <div style={{ fontSize: '0.68rem', color: C.dim }}>₹{fmtK(nvr.new_revenue)}</div>
                            </div>
                            <div style={{ padding: '8px 12px', borderRadius: 10, background: C.purpleDim }}>
                                <div style={{ fontSize: '0.62rem', color: C.dim, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>Returning</div>
                                <div style={{ fontSize: '1rem', fontWeight: 700, color: C.purple }}>{fmtI(nvr.returning_customers)}</div>
                                <div style={{ fontSize: '0.68rem', color: C.dim }}>₹{fmtK(nvr.returning_revenue)}</div>
                            </div>
                        </div>
                        <div style={{ textAlign: 'center', marginTop: 12 }}>
                            <div style={{ fontSize: '0.6rem', color: C.dim, textTransform: 'uppercase', letterSpacing: 1 }}>Returning Rate</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: C.neon }}>{retRate}%</div>
                        </div>
                    </div>
                </div>

                {/* Order Value Distribution + Day of Week */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                    <div style={glass}>
                        <SectionTitle>Order value distribution</SectionTitle>
                        <div style={{ height: 210 }}>{valChart ? <Bar data={valChart} options={chartOpts} /> : null}</div>
                    </div>
                    <div style={glass}>
                        <SectionTitle>Revenue by day of week</SectionTitle>
                        <div style={{ height: 210 }}>{dowChart ? <Bar data={dowChart} options={revYOpts} /> : null}</div>
                    </div>
                </div>

                {/* Top Products + Geography */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                    <div style={glass}>
                        <SectionTitle>Total sales by product</SectionTitle>
                        <div style={{ height: 360 }}>
                            {prodChart ? <Bar data={prodChart} options={{
                                ...chartOpts, indexAxis: 'y',
                                interaction: { mode: 'index', intersect: false },
                                plugins: { ...chartOpts.plugins, tooltip: revenueTooltip },
                                scales: { x: { ...chartOpts.scales.x, ticks: { ...chartOpts.scales.x.ticks, callback: v => fmtK(v) } }, y: { grid: { display: false }, ticks: { color: C.text, font: { size: 9 } } } }
                            }} /> : null}
                        </div>
                    </div>
                    <div style={glass}>
                        <SectionTitle>Top locations</SectionTitle>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {(data.topCities || []).slice(0, 8).map((c, i) => {
                                const max = data.topCities[0]?.revenue || 1;
                                return (
                                    <div key={c.city}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{c.city}</span>
                                            <span style={{ fontSize: '0.72rem', color: C.neon, fontWeight: 600 }}>₹{fmtK(c.revenue)}</span>
                                        </div>
                                        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.05)' }}>
                                            <div style={{ height: '100%', borderRadius: 2, width: `${(Number(c.revenue) / Number(max)) * 100}%`, background: `linear-gradient(90deg, ${C.neon}, ${C.cyan})`, transition: 'width 0.6s ease' }} />
                                        </div>
                                        <span style={{ fontSize: '0.62rem', color: C.dim }}>{c.orders} orders</span>
                                    </div>
                                );
                            })}
                        </div>
                        <h4 style={{ margin: '16px 0 8px', fontSize: '0.82rem', fontWeight: 700, color: C.text }}>Top states</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {(data.topStates || []).slice(0, 8).map(st => (
                                <span key={st.state} style={{ padding: '3px 10px', borderRadius: 16, fontSize: '0.7rem', fontWeight: 600, background: C.blueDim, color: C.blue, border: `1px solid ${C.blue}20` }}>
                                    {st.state} <span style={{ color: C.dim }}>₹{fmtK(st.revenue)}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Customer Acquisition + High Value Orders */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                    <div style={glass}>
                        <SectionTitle>Customer acquisition</SectionTitle>
                        <div style={{ height: 210 }}>{custChart ? <Line data={custChart} options={chartOpts} /> : null}</div>
                    </div>
                    <div style={glass}>
                        <SectionTitle>Highest value orders</SectionTitle>
                        <div style={{ overflowY: 'auto', maxHeight: 240 }}>
                            {(data.recentOrders || []).map((o, i) => (
                                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < 9 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                                    <span style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: PALETTE[i % PALETTE.length] + '18', color: PALETTE[i % PALETTE.length], fontSize: '0.65rem', fontWeight: 700 }}>
                                        {i + 1}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.76rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name || `#${o.order_number}`}</div>
                                        <div style={{ fontSize: '0.62rem', color: C.dim }}>{o.email}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: C.neon }}>₹{fmtI(o.total_price)}</div>
                                        <span style={{ fontSize: '0.58rem', padding: '1px 5px', borderRadius: 8, background: o.financial_status === 'paid' ? C.neonDim : C.yellowDim, color: o.financial_status === 'paid' ? C.neon : C.yellow }}>{o.financial_status}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Product Categories */}
                {data.productTypes && data.productTypes.length > 0 && (
                    <div style={{ ...glass, marginBottom: '0.85rem' }}>
                        <SectionTitle>Product categories</SectionTitle>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                            {data.productTypes.map((pt, i) => (
                                <div key={pt.type} style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                                    <div style={{ fontSize: '0.72rem', color: C.dim, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{pt.type || 'Other'}</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: PALETTE[i % PALETTE.length] }}>₹{fmtK(pt.revenue)}</div>
                                    <div style={{ fontSize: '0.68rem', color: C.dim, marginTop: 2 }}>{pt.orders} orders / {pt.qty} units</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </>)}
        </div>
    );
}

export default AnalyticsPro;
