const Qube = require('../dist/index.js').Qube;
const Sample = require('./sample-data');

// Reduced size for quick testing - change to higher number for real perf testing
const DataSize = 100000;
const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const qube = new Qube(Sample.options);

console.log(`Generating ${new Intl.NumberFormat('en-US').format(DataSize)} samples...`);

var start = Date.now();
for (let i = 0; i < DataSize; i++) {
    qube.push([Sample.generateRandomRow()]);
    if (i % 10000 === 0 && i > 0) {
        process.stdout.write(`\r  Progress: ${((i / DataSize) * 100).toFixed(1)}%`);
    }
}
console.log(`\r  Progress: 100%    `);

var loadTime = Date.now() - start;
console.log(`Loaded ${new Intl.NumberFormat('en-US').format(DataSize)} rows in ${new Intl.NumberFormat('en-US').format(loadTime)} ms`);

start = Date.now();

console.log(`\nTotal sales: ${formatter.format(qube.one(Sample.oneOptions))}`);
console.log(`2017 sales in Seattle: ${formatter.format(qube.slice(Sample.sliceOptions))}`);
console.log(`Seattle Apple sales in 2017: ${formatter.format(qube.dice(Sample.diceOptions))}`);

console.log(`\nSales for Seattle across all years`);
let result = qube.queryWithEnumeration('year', Sample.sliceOptions);
result.forEach(d => {
    d.value = formatter.format(d.value)
});
console.table(result);

console.log(`\nList values for dimension 'year'`);
result = qube.enumerateDimension('year');
console.table(result);

var queryTime = Date.now() - start;
console.log(`\nRan 5 queries in ${queryTime} ms`);
console.log(`Row count: ${qube.rowCount}`);