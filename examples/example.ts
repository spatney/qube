declare var Qube: any;

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