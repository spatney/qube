<span class="badge-npmversion"><a href="https://npmjs.org/package/qube" title="View this project on NPM"><img src="https://img.shields.io/npm/v/qube.svg" alt="NPM version" /></a></span>
<span class="badge-npmdownloads"><a href="https://npmjs.org/package/qube" title="View this project on NPM"><img src="https://img.shields.io/npm/dm/qube.svg" alt="NPM downloads" /></a></span>
[![Build Status](https://travis-ci.org/spatney/qube.svg?branch=master)](https://travis-ci.org/spatney/qube)
<div/>

# <img src="https://envy.azureedge.net/github/cube.png" width="40" height="40">ube 

## What is this?

Simple implementation of an in-memory analytics cube. 

## How to use it?

```javascript
const Qube = require('qube').Qube;

const qubeOptions = { // options to initialize qube
    measures: [ // what kind of calcs do you want to store in the cube. 
        { type: 'sum', key: 'sales', name: 'sum_sales' },
        { type: 'count', key: 'sales', name: 'count_sales' },
        { type: 'max', key: 'sales', name: 'max_sales' },
        { type: 'min', key: 'sales', name: 'min_sales' }
    ],
    dimensions: [ // what are the dimensions you would query on. 
        { type: 'string', key: 'year' },
        { type: 'string', key: 'location' },
        { type: 'string', key: 'product' }
    ]
}
const qube = new Qube(qubeOptions);

// Add some data
qube.push([
    { year: '2017', location: 'Seattle', product: 'Apple', sales: 10 },
    { year: '2017', location: 'Seattle', product: 'Apple', sales: 20 },
    { year: '2018', location: 'Seattle', product: 'Apple', sales: 35 },
    { year: '2018', location: 'Seattle', product: 'Apple', sales: 15 },
    { year: '2019', location: 'Seattle', product: 'Apple', sales: 25 },
    { year: '2019', location: 'Seattle', product: 'Apple', sales: 5 },
    { year: '2017', location: 'Portland', product: 'Apple', sales: 17 },
    { year: '2017', location: 'Portland', product: 'Apple', sales: 19 },
    { year: '2018', location: 'Portland', product: 'Apple', sales: 31 },
    { year: '2018', location: 'Portland', product: 'Apple', sales: 32 },
    { year: '2019', location: 'Portland', product: 'Apple', sales: 21 },
    { year: '2019', location: 'Portland', product: 'Apple', sales: 20 },
    { year: '2017', location: 'Seattle', product: 'Orange', sales: 10 },
    { year: '2017', location: 'Seattle', product: 'Orange', sales: 20 },
    { year: '2018', location: 'Seattle', product: 'Orange', sales: 25 },
    { year: '2018', location: 'Seattle', product: 'Orange', sales: 5 },
    { year: '2019', location: 'Seattle', product: 'Orange', sales: 25 },
    { year: '2019', location: 'Seattle', product: 'Orange', sales: 5 },
    { year: '2017', location: 'Portland', product: 'Orange', sales: 7 },
    { year: '2017', location: 'Portland', product: 'Orange', sales: 16 },
    { year: '2018', location: 'Portland', product: 'Orange', sales: 5 },
    { year: '2018', location: 'Portland', product: 'Orange', sales: 12 },
    { year: '2019', location: 'Portland', product: 'Orange', sales: 11 },
    { year: '2019', location: 'Portland', product: 'Orange', sales: 20 },
]);

const measureToCompute = 'sum_sales'; // try also with min, max, count

// Total Sales.
console.log(`Total sales: ${qube.one({ measure: measureToCompute })}`);

// Total Apple sales in Seattle
const sliceQuery = {
    dimensions: { product: 'Apple', location: 'Seattle'}, 
    measure: measureToCompute 
};
console.log(`Apple sales in Seattle: ${qube.slice(sliceQuery)}`)

// Total Orange sales in Portland in 2018
const diceQuery = {
    dimensions: { product: 'Orange', location: 'Portland', year: '2018'}, 
    measure: measureToCompute
};
console.log(`Portland Orange sales in 2018: ${qube.dice(diceQuery)}`)

// Total Orange sales across all years
const sliceToEnumerateQuery = {
    dimensions: { product: 'Orange'}, 
    measure: measureToCompute
};

console.log(`\nOrange sales across all years`);
console.table(qube.queryWithEnumeration('year', sliceToEnumerateQuery));

// All unique values for years
console.log(`\nList values for dimension 'year'`);
console.table(qube.enumerateDimension('year'));

/*
Expected output

Total sales: 411
Apple sales in Seattle: 110
Portland Orange sales in 2018: 17

Orange sales across all years
┌─────────┬───────┬────────┐
│ (index) │ value │  year  │
├─────────┼───────┼────────┤
│    0    │  53   │ '2017' │
│    1    │  47   │ '2018' │
│    2    │  61   │ '2019' │
└─────────┴───────┴────────┘

List values for dimension 'year'
┌─────────┬────────┐
│ (index) │ Values │
├─────────┼────────┤
│    0    │ '2017' │
│    1    │ '2018' │
│    2    │ '2019' │
└─────────┴────────┘
*/
```

## Limitations

1. Only supports sum, count, min, max calculation types 
2. Only supports in-memory storage. 

## Future

1. support first, last, average
2. support plug & play storage
3. parallelize slice, dice & one (i.e map reduce) 

## Contribute

Contributions are welcome! Though I would suggest you discussing your change through issues first, so to avoid throw away work. Also contributions in terms of pure ideas are welcome too!
