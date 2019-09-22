
<div>
<span class="badge-npmversion"><a href="https://npmjs.org/package/qube" title="View this project on NPM"><img src="https://img.shields.io/npm/v/qube.svg" alt="NPM version" /></a></span>
<span class="badge-npmdownloads"><a href="https://npmjs.org/package/qube" title="View this project on NPM"><img src="https://img.shields.io/npm/dm/qube.svg" alt="NPM downloads" /></a></span>
</div>

<img src="https://envy.azureedge.net/github/cube.png" width="100" height="100" style="margin:10px">

# Qube

## What is this?

Sinple implementation of an in-memory analytics cube. 

## How to use it?

```javascript
const Qube = require('qube').Qube;

const qubeOptions = { // options to initialize qube
    measures: [ // what kind of calcs do you want to store in the cube. 
        { type: 'sum', key: 'sales', name: 'm_sales' }
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
    { year: '2018', location: 'Portland', product: 'Orange', sales: 20 },
    { year: '2017', location: 'Portland', product: 'Apple', sales: 25 },
    { year: '2017', location: 'Seattle', product: 'Apple', sales: 25 }
]);

// Total Sales.
console.log(`Total Sales: ${qube.one({ measure: 'm_sales' })}`);

// Total Apple sales in Seattle
const sliceQuery = {
    dimensions: { product: 'Apple', location: 'Seattle'}, 
    measure: 'm_sales' 
};
console.log(`Total Apple sales in Seattle: ${qube.slice(sliceQuery)}`)

// Total Orange sales in Portland in 2018
const diceQuery = {
    dimensions: { product: 'Orange', location: 'Portland', year: '2018'}, 
    measure: 'm_sales' 
};
console.log(`Total Orange sales in Portland in 2018: ${qube.dice(diceQuery)}`)

/*
Expected Output
----------------

Total Sales: 80
Total Apple sales in Seattle: 35
Total Orange sales in Portland in 2018: 20
*/
```

## Limitations

1. Only supports 'sum' aggregation.
2. Only supports in-memory storage. 

## Future

1. support count, min, max, average, first, last
2. support plug & play storage
3. parallelize slice, dice & one (i.e map reduce) 

## Contribute

Contributions are welcome! Though I would suggest you discussing your change through issues first, so to avoid throw away work. Also contributions in terms of pure ideas are welcome too!
