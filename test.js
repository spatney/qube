const Qube = require('./index');
const sampleData = require('./sample-data');

const myQube = new Qube(sampleData.options);
const rows = [];

console.time('data-gen');
for(let i=0; i<10000000; i++) {
    rows.push(sampleData.generateRandomRow());
}
console.timeEnd('data-gen');

console.time('push');
myQube.push(rows);
console.timeEnd('push');

//require('fs').writeFileSync('result.json', JSON.stringify(rows));

console.time('one');
console.log(`one: ${myQube.one()}`);
console.timeEnd('one');

console.time('slice');
console.log('slice: ', sampleData.sliceOptions, myQube.slice(sampleData.sliceOptions));
console.timeEnd('slice');

console.time('dice');
console.log('dice: ', sampleData.diceOptions, myQube.dice(sampleData.diceOptions));
console.timeEnd('dice');

//console.log(JSON.stringify(myQube.cube));