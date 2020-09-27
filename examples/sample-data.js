const years = ['2017', '2018', '2019'];
const locations = ['Seattle', 'Los Angels', 'New York'];
const products = ['Apple', 'Orange', 'Pear'];

const sampleOptions = {
    measures: [
        { type: 'sum', key: 'sales', name: 'sum_sales' },
        { type: 'count', key: 'sales', name: 'cnt_sales' },
        { type: 'min', key: 'sales', name: 'min_sales' },
        { type: 'max', key: 'sales', name: 'max_sales' }
    ],
    dimensions: [
        { type: 'string', key: 'year' },
        { type: 'string', key: 'location' },
        { type: 'string', key: 'product' }
    ]
}

const sampleSliceOptions = {
    measure: 'sum_sales',
    dimensions: {
        year: '2017',
        location: 'Seattle',
    }
};

const sampleDiceOptions = {
    measure: 'sum_sales',
    dimensions: {
        year: '2017',
        location: 'Seattle',
        product: 'Apple'
    }
};

const sampleOneOptions = {
    measure: 'sum_sales',
};

function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
  }

function generateRandomRow() {
    return {
        year: years[getRandomInt(3)],
        product: products[getRandomInt(3)],
        location: locations[getRandomInt(3)],
        sales: getRandomInt(9) + 1
    }
}

module.exports = {
    diceOptions: sampleDiceOptions,
    options: sampleOptions,
    sliceOptions: sampleSliceOptions,
    generateRandomRow: generateRandomRow,
    oneOptions: sampleOneOptions
}