const years = ['2017', '2018', '2019'];
const locations = ['Seattle', 'Los Angels', 'New York'];
const products = ['Apple', 'Orange', 'Pear'];

const sampleOptions = {
    measures: [
        { type: 'sum', key: 'sales', name: 'm_sales' }
    ],
    dimensions: [
        { type: 'string', key: 'year' },
        { type: 'string', key: 'location' },
        { type: 'string', key: 'product' }
    ]
}

const sampleSliceOptions = {
    measure: 'm_sales',
    dimensions: {
        year: '2017',
        location: 'Seattle',
    }
};

const sampleDiceOptions = {
    measure: 'm_sales',
    dimensions: {
        year: '2017',
        location: 'Seattle',
        product: 'Apple'
    }
};

const sampleOneOptions = {
    measure: 'm_sales',
};

function getRandomInt(max: number) {
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