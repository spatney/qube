const { Qube } = require('../dist/index.js');

// ═══════════════════════════════════════════════════════════════════════════════
//  QUBE PERFORMANCE BENCHMARK
// ═══════════════════════════════════════════════════════════════════════════════

const ROWS = parseInt(process.argv[2]) || 1_000_000;
const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
};

const fmt = {
    num: (n) => new Intl.NumberFormat('en-US').format(n),
    money: (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n),
    ms: (n) => `${n.toFixed(2)} ms`,
    bytes: (b) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`,
    pct: (n) => `${(n * 100).toFixed(1)}%`,
};

function header(text) {
    console.log(`\n${COLORS.bright}${COLORS.cyan}▸ ${text}${COLORS.reset}`);
}

function metric(label, value, unit = '') {
    console.log(`  ${COLORS.dim}${label}:${COLORS.reset} ${COLORS.yellow}${value}${COLORS.reset} ${unit}`);
}

function benchmark(name, fn, iterations = 1) {
    const times = [];
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const result = fn();
        times.push(performance.now() - start);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    return { avg, min, result: fn() };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const years = ['2020', '2021', '2022', '2023', '2024'];
const regions = ['North', 'South', 'East', 'West', 'Central'];
const categories = ['Electronics', 'Clothing', 'Food', 'Home', 'Sports', 'Books', 'Toys', 'Health'];
const products = Array.from({ length: 100 }, (_, i) => `Product_${String(i).padStart(3, '0')}`);
const channels = ['Online', 'Retail', 'Wholesale', 'Partner'];

function generateRow() {
    return {
        year: years[Math.floor(Math.random() * years.length)],
        region: regions[Math.floor(Math.random() * regions.length)],
        category: categories[Math.floor(Math.random() * categories.length)],
        product: products[Math.floor(Math.random() * products.length)],
        channel: channels[Math.floor(Math.random() * channels.length)],
        revenue: Math.floor(Math.random() * 10000) + 100,
        quantity: Math.floor(Math.random() * 100) + 1,
        discount: Math.random() * 0.3,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BENCHMARK
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`${COLORS.bright}${COLORS.magenta}`);
console.log(`╔═══════════════════════════════════════════════════════════════╗`);
console.log(`║              QUBE PERFORMANCE BENCHMARK                       ║`);
console.log(`╚═══════════════════════════════════════════════════════════════╝${COLORS.reset}`);
console.log(`\n  Testing with ${COLORS.bright}${fmt.num(ROWS)}${COLORS.reset} rows across ${COLORS.bright}5 dimensions${COLORS.reset}`);
console.log(`  Run with: node performance_measure.js [rows]`);

// Create cube with multiple measure types
const qube = new Qube({
    measures: [
        { type: 'sum', key: 'revenue', name: 'total_revenue' },
        { type: 'sum', key: 'quantity', name: 'total_qty' },
        { type: 'count', key: 'revenue', name: 'transactions' },
        { type: 'average', key: 'revenue', name: 'avg_revenue' },
        { type: 'min', key: 'revenue', name: 'min_revenue' },
        { type: 'max', key: 'revenue', name: 'max_revenue' },
        { type: 'average', key: 'discount', name: 'avg_discount' },
    ],
    dimensions: [
        { type: 'string', key: 'year' },
        { type: 'string', key: 'region' },
        { type: 'string', key: 'category' },
        { type: 'string', key: 'product' },
        { type: 'string', key: 'channel' },
    ],
});

// ─────────────────────────────────────────────────────────────────────────────
//  DATA LOADING
// ─────────────────────────────────────────────────────────────────────────────

header('DATA LOADING');

// Generate all rows first (to measure pure load time)
process.stdout.write(`  Generating rows...`);
const rows = Array.from({ length: ROWS }, generateRow);
console.log(` ${COLORS.green}done${COLORS.reset}`);

// Batch load (realistic scenario)
const batchSize = 10000;
const loadStart = performance.now();
for (let i = 0; i < rows.length; i += batchSize) {
    qube.push(rows.slice(i, i + batchSize));
}
const loadTime = performance.now() - loadStart;

metric('Load time', fmt.ms(loadTime));
metric('Throughput', fmt.num(Math.round(ROWS / (loadTime / 1000))), 'rows/sec');
metric('Rows loaded', fmt.num(qube.rowCount));
metric('Dimensions', qube.dimensionCount);

// ─────────────────────────────────────────────────────────────────────────────
//  AGGREGATION QUERIES
// ─────────────────────────────────────────────────────────────────────────────

header('AGGREGATION QUERIES');

const queries = [
    { 
        name: 'Total (full scan)', 
        fn: () => qube.one({ measure: 'total_revenue' }),
        format: fmt.money 
    },
    { 
        name: 'Slice (1 dim)', 
        fn: () => qube.query({ measure: 'total_revenue', dimensions: { year: '2023' } }),
        format: fmt.money 
    },
    { 
        name: 'Slice (2 dims)', 
        fn: () => qube.query({ measure: 'total_revenue', dimensions: { year: '2023', region: 'North' } }),
        format: fmt.money 
    },
    { 
        name: 'Slice (3 dims)', 
        fn: () => qube.query({ measure: 'total_revenue', dimensions: { year: '2023', region: 'North', category: 'Electronics' } }),
        format: fmt.money 
    },
    { 
        name: 'Dice (all dims)', 
        fn: () => qube.dice({ measure: 'total_revenue', dimensions: { year: '2023', region: 'North', category: 'Electronics', product: 'Product_050', channel: 'Online' } }),
        format: (v) => v ? fmt.money(v) : 'N/A'
    },
    { 
        name: 'Average calc', 
        fn: () => qube.one({ measure: 'avg_revenue' }),
        format: fmt.money 
    },
    { 
        name: 'Min/Max', 
        fn: () => ({ min: qube.one({ measure: 'min_revenue' }), max: qube.one({ measure: 'max_revenue' }) }),
        format: (v) => `${fmt.money(v.min)} - ${fmt.money(v.max)}`
    },
];

const queryResults = [];
for (const q of queries) {
    const { avg, result } = benchmark(q.name, q.fn, 3);
    queryResults.push({ name: q.name, time: avg, result });
    console.log(`  ${COLORS.dim}${q.name}:${COLORS.reset} ${COLORS.yellow}${fmt.ms(avg)}${COLORS.reset} → ${COLORS.green}${q.format(result)}${COLORS.reset}`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  ANALYTICAL OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

header('ANALYTICAL OPERATIONS');

// Rollup
let { avg: rollupTime, result: rollupResult } = benchmark('Rollup', 
    () => qube.rollup('year', { measure: 'total_revenue' }), 3);
metric('Rollup by year', fmt.ms(rollupTime), `(${rollupResult.length} groups)`);

// Drilldown
let { avg: drillTime, result: drillResult } = benchmark('Drilldown',
    () => qube.drilldown('category', { measure: 'total_revenue', dimensions: { year: '2023' } }), 3);
metric('Drilldown to category', fmt.ms(drillTime), `(${drillResult.length} items)`);

// Enumeration
let { avg: enumTime, result: enumResult } = benchmark('Enumerate',
    () => qube.enumerateDimension('product'), 3);
metric('Enumerate products', fmt.ms(enumTime), `(${enumResult.length} unique)`);

// Query with enumeration
let { avg: qweTime, result: qweResult } = benchmark('QueryWithEnum',
    () => qube.queryWithEnumeration('region', { measure: 'total_revenue', dimensions: { year: '2023' } }), 3);
metric('Revenue by region (2023)', fmt.ms(qweTime), `(${qweResult.length} regions)`);

// Filter
let { avg: filterTime, result: filterResult } = benchmark('Filter',
    () => qube.filter({ dimensions: { year: '2023', region: 'North' } }), 3);
metric('Filter cells', fmt.ms(filterTime), `(${filterResult.length} cells)`);

// ─────────────────────────────────────────────────────────────────────────────
//  DIMENSION INFO
// ─────────────────────────────────────────────────────────────────────────────

header('DIMENSION CARDINALITY');

const dimInfo = qube.getDimensionInfo();
for (const d of dimInfo) {
    console.log(`  ${COLORS.dim}${d.key}:${COLORS.reset} ${COLORS.yellow}${d.cardinality}${COLORS.reset} unique values`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  SERIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

header('SERIALIZATION');

const { avg: serializeTime, result: serialized } = benchmark('Serialize', () => qube.serializeCube(), 3);
const jsonStr = JSON.stringify(serialized);
const { avg: deserializeTime } = benchmark('Deserialize', () => Qube.fromCube(JSON.parse(jsonStr)), 3);

metric('Serialize', fmt.ms(serializeTime));
metric('JSON size', fmt.bytes(jsonStr.length));
metric('Deserialize', fmt.ms(deserializeTime));

// ─────────────────────────────────────────────────────────────────────────────
//  SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

header('SUMMARY');

console.log(`\n${COLORS.bright}  Revenue by Year:${COLORS.reset}`);
console.table(
    qube.rollup('year', { measure: 'total_revenue' })
        .map(r => ({ 
            Year: r.dimensions.year, 
            Revenue: fmt.money(r.value),
            Transactions: fmt.num(qube.query({ measure: 'transactions', dimensions: r.dimensions.year !== '__TOTAL__' ? { year: r.dimensions.year } : {} }))
        }))
);

console.log(`${COLORS.bright}  Top Categories (2024):${COLORS.reset}`);
const catData = qube.drilldown('category', { measure: 'total_revenue', dimensions: { year: '2024' } })
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map(r => ({
        Category: r.dimensions.category,
        Revenue: fmt.money(r.value),
        AvgOrder: fmt.money(qube.query({ measure: 'avg_revenue', dimensions: { year: '2024', category: r.dimensions.category } }))
    }));
console.table(catData);

console.log(`\n${COLORS.green}✓ Benchmark complete${COLORS.reset}\n`);