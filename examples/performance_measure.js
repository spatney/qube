const Qube = require('../dist/qube').Qube;
const Sample = require('./sample-data');
require('colors');
var sizeof = require('object-sizeof')
const cliProgress = require('cli-progress');
const DataSize = 1000000000;
const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const bar1 = new cliProgress.SingleBar({
    format: `Generating ${` ${new Intl.NumberFormat('en-US').format(DataSize)} `.bold.white.bgRed} samples >> [\u001b[32m{bar}\u001b[0m] {percentage}% | ETA: {eta}s | {value}/{total}`,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
    barGlue: '\u001b[33m'
});


const qube = new Qube(Sample.options);

bar1.start(DataSize, 0);

var start = new Date().getTime();
for (let i = 0; i < DataSize; i++) {
    qube.push([Sample.generateRandomRow()]);
    if(i%1000 === 0) {
        bar1.update(i);
    }
}

bar1.update(DataSize);
bar1.stop();

var end = new Date().getTime() - start;

console.log(`took ${new Intl.NumberFormat('en-US').format(end)} milliseconds to generate sample`.magenta);
var start = new Date().getTime();

console.log(`\nTotal sales: ` + ` ${formatter.format(qube.one(Sample.oneOptions))} `.bgBlue);

console.log(`2017 sales in Seattle: ` + ` ${formatter.format(qube.slice(Sample.sliceOptions))} `.bgBlue)

console.log(`Seattle Apple sales in 2017: ` + ` ${formatter.format(qube.dice(Sample.diceOptions))} `.bgBlue)

console.log(`\nSales for Seattle across all years`);
let result = qube.queryWithEnumeration('year', Sample.sliceOptions);
result.forEach(d => {
    d.value = formatter.format(d.value)
});
console.table(result);

console.log(`\nList values for dimension 'year'`);

result = qube.enumerateDimension('year')
console.table(result);

var end = new Date().getTime() - start;
console.log(`\ntook ${end} milliseconds to run all 5 queries`.magenta);
console.log(`Size in bytes: ` + ` ${sizeof(qube)} `.bgBlue);
// console.log(JSON.stringify(qube.serializeCube(), null, 4));