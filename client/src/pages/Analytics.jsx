import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

// Color palette
const COLORS = {
    accent: '#00e5a0',
    accentDim: 'rgba(0,229,160,0.15)',
    blue: '#3b82f6',
    blueDim: 'rgba(59,130,246,0.15)',
    purple: '#a78bfa',
    purpleDim: 'rgba(167,139,250,0.15)',
    orange: '#fb923c',
    orangeDim: 'rgba(251,146,60,0.15)',
    red: '#ef4444',
    redDim: 'rgba(239,68,68,0.15)',
    yellow: '#facc15',
    yellowDim: 'rgba(250,204,21,0.15)',
    pink: '#ec4899',
    teal: '#14b8a6',
    text: '#e2e8f0',
    muted: '#64748b',
    grid: 'rgba(255,255,255,0.06)',
};

const PIE_COLORS = [COLORS.accent, COLORS.blue, COLORS.orange, COLORS.purple, COLORS.red, COLORS.yellow, COLORS.pink, COLORS.teal];

function getDefaultRange() {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
    };
}

const PRESETS = [
    { label: '7d', days: 7 },
    { label: '30d', days: 30 },
    { label: '90d', days: 90 },
    { label: '6mo', days: 180 },
    { label: '1y', days: 365 },
    { label: 'All', days: 0 },
];

const commonChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: 'rgba(15,23,42,0.95)',
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
        },
    },
    scales: {
        x: {
            grid: { color: COLORS.grid },
            ticks: { color: COLORS.muted, maxTicksLimit: 15, font: { size: 11 } },
        },
        y: {
            grid: { color: COLORS.grid },
            ticks: { color: COLORS.muted, font: { size: 11 } },
            beginAtZero: true,
        },
    },
};

function Analytics() {
    const [range, setRange] = useState(getDefaultRange);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const applyPreset = (days) => {
        const to = new Date();
        const from = days > 0 ? new Date(Date.now() - days * 86400000) : new Date('2020-01-01');
        setRange({
            from: from.toISOString().split('T')[0],
            to: to.toISOString().split('T')[0],
        });
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams(range);
            const res = await fetch(`/api/analytics?${params}`);
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
            const d = await res.json();
            setData(d);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [range]);

    useEffect(() => { loadData(); }, [loadData]);

    const formatCurrency = (n) => {
        if (n == null) return '₹0';
        return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    // Chart data
    const ordersChartData = useMemo(() => {
        if (!data?.ordersOverTime) return null;
        return {
            labels: data.ordersOverTime.map((d) => d.date),
            datasets: [{
                label: 'Orders',
                data: data.ordersOverTime.map((d) => d.count),
                backgroundColor: COLORS.accentDim,
                borderColor: COLORS.accent,
                borderWidth: 2,
                borderRadius: 4,
                hoverBackgroundColor: COLORS.accent + '40',
            }],
        };
    }, [data]);

    const revenueChartData = useMemo(() => {
        if (!data?.revenueOverTime) return null;
        return {
            labels: data.revenueOverTime.map((d) => d.date),
            datasets: [{
                label: 'Revenue',
                data: data.revenueOverTime.map((d) => Number(d.revenue)),
                borderColor: COLORS.blue,
                backgroundColor: COLORS.blueDim,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 5,
                fill: true,
                tension: 0.3,
            }],
        };
    }, [data]);

    const financialPieData = useMemo(() => {
        if (!data?.financialStatus) return null;
        const labels = data.financialStatus.map((d) => d.status || 'unknown');
        const values = data.financialStatus.map((d) => d.count);
        return {
            labels,
            datasets: [{
                data: values,
                backgroundColor: PIE_COLORS.slice(0, labels.length),
                borderWidth: 0,
                hoverOffset: 8,
            }],
        };
    }, [data]);

    const fulfillmentPieData = useMemo(() => {
        if (!data?.fulfillmentStatus) return null;
        const labels = data.fulfillmentStatus.map((d) => d.status || 'unfulfilled');
        const values = data.fulfillmentStatus.map((d) => d.count);
        return {
            labels,
            datasets: [{
                data: values,
                backgroundColor: PIE_COLORS.slice(0, labels.length),
                borderWidth: 0,
                hoverOffset: 8,
            }],
        };
    }, [data]);

    const topProductsData = useMemo(() => {
        if (!data?.topProducts) return null;
        return {
            labels: data.topProducts.map((p) => p.title?.substring(0, 30) + (p.title?.length > 30 ? '...' : '')),
            datasets: [{
                label: 'Quantity Sold',
                data: data.topProducts.map((p) => p.total_qty),
                backgroundColor: COLORS.purpleDim,
                borderColor: COLORS.purple,
                borderWidth: 2,
                borderRadius: 4,
            }],
        };
    }, [data]);

    const pieOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
                labels: { color: COLORS.text, font: { size: 12 }, padding: 12, usePointStyle: true, pointStyleWidth: 10 },
            },
            tooltip: commonChartOptions.plugins.tooltip,
        },
    };

    const revenueYOptions = {
        ...commonChartOptions,
        scales: {
            ...commonChartOptions.scales,
            y: {
                ...commonChartOptions.scales.y,
                ticks: {
                    ...commonChartOptions.scales.y.ticks,
                    callback: (v) => '₹' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v),
                },
            },
        },
    };

    const s = data?.summary || {};

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Analytics</h1>
                <p className="page-subtitle">
                    Visual insights from your synced data. Select a date range to analyze.
                </p>
            </div>

            {/* Date range picker */}
            <div className="card card-glow" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.82rem', color: 'var(--textMuted)' }}>From</label>
                        <input
                            type="date"
                            value={range.from}
                            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                            style={{
                                padding: '0.45rem 0.7rem',
                                background: 'var(--surface2)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text)',
                                fontSize: '0.85rem',
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <label style={{ fontSize: '0.82rem', color: 'var(--textMuted)' }}>To</label>
                        <input
                            type="date"
                            value={range.to}
                            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                            style={{
                                padding: '0.45rem 0.7rem',
                                background: 'var(--surface2)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text)',
                                fontSize: '0.85rem',
                            }}
                        />
                    </div>
                    <div className="btn-group">
                        {PRESETS.map((p) => (
                            <button key={p.label} className="btn btn-secondary btn-sm" onClick={() => applyPreset(p.days)}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {error && (
                <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: '1rem' }}>
                    <span style={{ color: 'var(--danger)' }}>⚠️ {error}</span>
                </div>
            )}

            {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <span className="spinner"></span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--textMuted)' }}>Loading analytics...</span>
                </div>
            )}

            {data && (
                <>
                    {/* Summary cards */}
                    <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                        <div className="stat-card animate-in">
                            <div className="stat-value" style={{ color: COLORS.accent }}>{formatCurrency(s.total_revenue)}</div>
                            <div className="stat-label">Total Revenue</div>
                        </div>
                        <div className="stat-card animate-in" style={{ animationDelay: '0.05s' }}>
                            <div className="stat-value" style={{ color: COLORS.blue }}>{(s.total_orders || 0).toLocaleString()}</div>
                            <div className="stat-label">Total Orders</div>
                        </div>
                        <div className="stat-card animate-in" style={{ animationDelay: '0.1s' }}>
                            <div className="stat-value" style={{ color: COLORS.purple }}>{formatCurrency(s.avg_order_value)}</div>
                            <div className="stat-label">Avg Order Value</div>
                        </div>
                        <div className="stat-card animate-in" style={{ animationDelay: '0.15s' }}>
                            <div className="stat-value" style={{ color: COLORS.orange }}>{(s.paid_orders || 0).toLocaleString()}</div>
                            <div className="stat-label">Paid Orders</div>
                        </div>
                        <div className="stat-card animate-in" style={{ animationDelay: '0.2s' }}>
                            <div className="stat-value" style={{ color: COLORS.yellow }}>{(s.pending_orders || 0).toLocaleString()}</div>
                            <div className="stat-label">Pending</div>
                        </div>
                        <div className="stat-card animate-in" style={{ animationDelay: '0.25s' }}>
                            <div className="stat-value" style={{ color: COLORS.red }}>{(s.refunded_orders || 0).toLocaleString()}</div>
                            <div className="stat-label">Refunded</div>
                        </div>
                    </div>

                    {/* Charts row 1: Orders over time + Revenue over time */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Orders Over Time</h2>
                                <span className="badge badge-info">
                                    <span className="badge-dot"></span>
                                    Daily
                                </span>
                            </div>
                            <div style={{ height: 280 }}>
                                {ordersChartData ? <Bar data={ordersChartData} options={commonChartOptions} /> : <p style={{ color: 'var(--textMuted)' }}>No data</p>}
                            </div>
                        </div>
                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Revenue Over Time</h2>
                                <span className="badge badge-info">
                                    <span className="badge-dot"></span>
                                    Daily
                                </span>
                            </div>
                            <div style={{ height: 280 }}>
                                {revenueChartData ? <Line data={revenueChartData} options={revenueYOptions} /> : <p style={{ color: 'var(--textMuted)' }}>No data</p>}
                            </div>
                        </div>
                    </div>

                    {/* Charts row 2: Financial status + Fulfillment status */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Payment Status</h2>
                            </div>
                            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {financialPieData ? <Doughnut data={financialPieData} options={pieOptions} /> : <p style={{ color: 'var(--textMuted)' }}>No data</p>}
                            </div>
                        </div>
                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Fulfillment Status</h2>
                            </div>
                            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {fulfillmentPieData ? <Pie data={fulfillmentPieData} options={pieOptions} /> : <p style={{ color: 'var(--textMuted)' }}>No data</p>}
                            </div>
                        </div>
                    </div>

                    {/* Top products */}
                    <div className="card" style={{ marginBottom: '1.25rem' }}>
                        <div className="card-header">
                            <h2 className="card-title">Top Selling Products</h2>
                            <span className="badge badge-muted">By quantity</span>
                        </div>
                        <div style={{ height: 300 }}>
                            {topProductsData ? (
                                <Bar data={topProductsData} options={{
                                    ...commonChartOptions,
                                    indexAxis: 'y',
                                    plugins: { ...commonChartOptions.plugins, legend: { display: false } },
                                }} />
                            ) : <p style={{ color: 'var(--textMuted)' }}>No data</p>}
                        </div>
                    </div>

                    {/* Revenue breakdown table */}
                    {data.dailyBreakdown && data.dailyBreakdown.length > 0 && (
                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Daily Breakdown</h2>
                                <span className="badge badge-muted">Last {Math.min(data.dailyBreakdown.length, 30)} days</span>
                            </div>
                            <div className="table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Orders</th>
                                            <th>Revenue</th>
                                            <th>Avg Value</th>
                                            <th>Paid</th>
                                            <th>Pending</th>
                                            <th>Refunded</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.dailyBreakdown.map((d) => (
                                            <tr key={d.date}>
                                                <td>{d.date}</td>
                                                <td>{d.orders}</td>
                                                <td style={{ color: COLORS.accent }}>{formatCurrency(d.revenue)}</td>
                                                <td>{formatCurrency(d.avg_value)}</td>
                                                <td style={{ color: COLORS.blue }}>{d.paid || 0}</td>
                                                <td style={{ color: COLORS.yellow }}>{d.pending || 0}</td>
                                                <td style={{ color: COLORS.red }}>{d.refunded || 0}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </>
    );
}

export default Analytics;
