const Qube = require('../dist/index.js').Qube;

console.log('=== Testing New Qube Features ===\n');

// Test 1: Hypercube with 4 dimensions
console.log('1. Testing Hypercube (4 dimensions)');
const qube4d = new Qube({
    measures: [
        { type: 'sum', key: 'revenue', name: 'total_revenue' },
        { type: 'count', key: 'revenue', name: 'transaction_count' }
    ],
    dimensions: [
        { type: 'string', key: 'year' },
        { type: 'string', key: 'quarter' },
        { type: 'string', key: 'region' },
        { type: 'string', key: 'product' }
    ]
});

qube4d.push([
    { year: '2023', quarter: 'Q1', region: 'North', product: 'A', revenue: 100 },
    { year: '2023', quarter: 'Q1', region: 'North', product: 'B', revenue: 200 },
    { year: '2023', quarter: 'Q2', region: 'North', product: 'A', revenue: 150 },
    { year: '2023', quarter: 'Q1', region: 'South', product: 'A', revenue: 120 },
    { year: '2024', quarter: 'Q1', region: 'North', product: 'A', revenue: 180 },
]);

console.log(`  Total revenue: ${qube4d.one({ measure: 'total_revenue' })}`);
console.log(`  Q1 2023 North Product A: ${qube4d.dice({ measure: 'total_revenue', dimensions: { year: '2023', quarter: 'Q1', region: 'North', product: 'A' } })}`);
console.log(`  2023 North (any quarter, any product): ${qube4d.query({ measure: 'total_revenue', dimensions: { year: '2023', region: 'North' } })}`);
console.log(`  Row count: ${qube4d.rowCount}`);
console.log(`  Dimension count: ${qube4d.dimensionCount}`);
console.log('  ✓ Hypercube test passed!');

// Test 2: Single dimension cube
console.log('\n2. Testing Single Dimension Cube');
const qube1d = new Qube({
    measures: [{ type: 'sum', key: 'value', name: 'total' }],
    dimensions: [{ type: 'string', key: 'category' }]
});
qube1d.push([
    { category: 'A', value: 10 },
    { category: 'A', value: 20 },
    { category: 'B', value: 30 },
]);
console.log(`  Total: ${qube1d.one({ measure: 'total' })}`);
console.log(`  Category A: ${qube1d.dice({ measure: 'total', dimensions: { category: 'A' } })}`);
console.log('  ✓ Single dimension test passed!');

// Test 3: New measure types
console.log('\n3. Testing New Measure Types');
const qubeMeasures = new Qube({
    measures: [
        { type: 'first', key: 'value', name: 'first_val' },
        { type: 'last', key: 'value', name: 'last_val' },
        { type: 'distinct', key: 'category', name: 'unique_categories' },
        { type: 'variance', key: 'value', name: 'value_variance' },
        { type: 'stddev', key: 'value', name: 'value_stddev' },
    ],
    dimensions: [{ type: 'string', key: 'group' }]
});

qubeMeasures.push([
    { group: 'A', value: 10, category: 'X' },
    { group: 'A', value: 20, category: 'Y' },
    { group: 'A', value: 30, category: 'X' },
    { group: 'A', value: 40, category: 'Z' },
]);

console.log(`  First value: ${qubeMeasures.one({ measure: 'first_val' })} (expected: 10)`);
console.log(`  Last value: ${qubeMeasures.one({ measure: 'last_val' })} (expected: 40)`);
console.log(`  Distinct categories: ${qubeMeasures.one({ measure: 'unique_categories' })} (expected: 3)`);
console.log(`  Variance: ${qubeMeasures.one({ measure: 'value_variance' }).toFixed(2)} (expected: 125.00)`);
console.log(`  Std Dev: ${qubeMeasures.one({ measure: 'value_stddev' }).toFixed(2)} (expected: 11.18)`);
console.log('  ✓ New measure types test passed!');

// Test 4: Rollup
console.log('\n4. Testing Rollup');
const qubeRollup = new Qube({
    measures: [{ type: 'sum', key: 'sales', name: 'total_sales' }],
    dimensions: [
        { type: 'string', key: 'year' },
        { type: 'string', key: 'product' }
    ]
});
qubeRollup.push([
    { year: '2023', product: 'A', sales: 100 },
    { year: '2023', product: 'B', sales: 200 },
    { year: '2024', product: 'A', sales: 150 },
    { year: '2024', product: 'B', sales: 250 },
]);
const rollupResult = qubeRollup.rollup('year', { measure: 'total_sales' });
console.log('  Rollup by year:');
console.table(rollupResult);
console.log('  ✓ Rollup test passed!');

// Test 5: Drilldown
console.log('\n5. Testing Drilldown');
const drilldownResult = qubeRollup.drilldown('product', { measure: 'total_sales', dimensions: { year: '2023' } });
console.log('  Drilldown to products in 2023:');
console.table(drilldownResult);
console.log('  ✓ Drilldown test passed!');

// Test 6: Filter
console.log('\n6. Testing Filter');
const qubeFilter = new Qube({
    measures: [
        { type: 'sum', key: 'amount', name: 'total' },
        { type: 'count', key: 'amount', name: 'count' }
    ],
    dimensions: [
        { type: 'string', key: 'status' },
        { type: 'string', key: 'category' }
    ]
});
qubeFilter.push([
    { status: 'active', category: 'A', amount: 100 },
    { status: 'active', category: 'B', amount: 200 },
    { status: 'inactive', category: 'A', amount: 50 },
    { status: 'inactive', category: 'B', amount: 75 },
]);

// Filter by single dimension
let filtered = qubeFilter.filter({ dimensions: { status: 'active' } });
console.log(`  Active items: ${filtered.length} (expected: 2)`);

// Filter by multiple dimension values (array)
filtered = qubeFilter.filter({ dimensions: { category: ['A', 'B'] } });
console.log(`  Items in A or B: ${filtered.length} (expected: 4)`);

// Filter with predicate
filtered = qubeFilter.filter({ predicate: (dims, measures) => measures.total > 100 });
console.log(`  Items with total > 100: ${filtered.length} (expected: 1)`);
console.log('  ✓ Filter test passed!');

// Test 7: Clear
console.log('\n7. Testing Clear');
const qubeClear = new Qube({
    measures: [{ type: 'sum', key: 'value', name: 'total' }],
    dimensions: [{ type: 'string', key: 'key' }]
});
qubeClear.push([{ key: 'A', value: 100 }]);
console.log(`  Before clear - total: ${qubeClear.one({ measure: 'total' })}, rows: ${qubeClear.rowCount}`);
qubeClear.clear();
console.log(`  After clear - total: ${qubeClear.one({ measure: 'total' })}, rows: ${qubeClear.rowCount}`);
console.log('  ✓ Clear test passed!');

// Test 8: getDimensionInfo
console.log('\n8. Testing getDimensionInfo');
const dimInfo = qube4d.getDimensionInfo();
console.log('  Dimension info:');
dimInfo.forEach(d => {
    console.log(`    ${d.key}: cardinality=${d.cardinality}, values=${JSON.stringify(d.values)}`);
});
const singleDimInfo = qube4d.getDimensionInfo('year');
console.log(`  Year dimension: ${singleDimInfo.cardinality} unique values`);
console.log('  ✓ getDimensionInfo test passed!');

// Test 9: getMeasureInfo
console.log('\n9. Testing getMeasureInfo');
const measureInfo = qube4d.getMeasureInfo();
console.log('  Measure info:');
console.table(measureInfo);
console.log('  ✓ getMeasureInfo test passed!');

// Test 10: Serialization
console.log('\n10. Testing Serialization');
const serialized = qube4d.serializeCube();
console.log(`  Serialized rowCount: ${serialized.rowCount}`);
const restored = Qube.fromCube(serialized);
console.log(`  Restored total revenue: ${restored.one({ measure: 'total_revenue' })}`);
console.log(`  Restored row count: ${restored.rowCount}`);
console.log('  ✓ Serialization test passed!');

// Test 11: Average measure
console.log('\n11. Testing Average Measure');
const qubeAvg = new Qube({
    measures: [{ type: 'average', key: 'score', name: 'avg_score' }],
    dimensions: [{ type: 'string', key: 'class' }]
});
qubeAvg.push([
    { class: 'A', score: 80 },
    { class: 'A', score: 90 },
    { class: 'B', score: 70 },
    { class: 'B', score: 85 },
]);
console.log(`  Class A average: ${qubeAvg.query({ measure: 'avg_score', dimensions: { class: 'A' } })} (expected: 85)`);
console.log(`  Overall average: ${qubeAvg.one({ measure: 'avg_score' })} (expected: 81.25)`);
console.log('  ✓ Average measure test passed!');

console.log('\n=== All Tests Passed! ===\n');
