[![NPM version](https://img.shields.io/npm/v/qube.svg)](https://npmjs.org/package/qube)
[![NPM downloads](https://img.shields.io/npm/dm/qube.svg)](https://npmjs.org/package/qube)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

```
   ╔═══════════════╗
   ║   ◇  QUBE  ◇  ║
   ╚═══════════════╝
```

> **Powerful in-memory OLAP cube for JavaScript/TypeScript**

---

## ✨ Features

- 🔷 **Hypercube Support** — 1 to N dimensions (not limited to 3!)
- 📊 **Rich Aggregations** — sum, count, min, max, average, first, last, distinct, variance, stddev
- 🔍 **Flexible Querying** — slice, dice, query, rollup, drilldown, filter
- 📋 **Dimension Operations** — enumerate, get dimension info
- 💾 **Serialization** — save and restore cubes
- 📝 **TypeScript** — full type definitions included

## 📦 Installation

```bash
npm install qube
```

## 🚀 Quick Start

```javascript
import { Qube } from 'qube';
// or: const { Qube } = require('qube');

const qube = new Qube({
    measures: [
        { type: 'sum', key: 'sales', name: 'total_sales' },
        { type: 'count', key: 'sales', name: 'transaction_count' },
        { type: 'average', key: 'sales', name: 'avg_sales' }
    ],
    dimensions: [
        { type: 'string', key: 'year' },
        { type: 'string', key: 'location' },
        { type: 'string', key: 'product' }
    ]
});

// Add data
qube.push([
    { year: '2023', location: 'Seattle', product: 'Apple', sales: 100 },
    { year: '2023', location: 'Seattle', product: 'Orange', sales: 80 },
    { year: '2023', location: 'Portland', product: 'Apple', sales: 120 },
    { year: '2024', location: 'Seattle', product: 'Apple', sales: 150 },
]);

// Query total
qube.one({ measure: 'total_sales' }); // → 450

// Query with partial dimensions (slice)
qube.query({ 
    measure: 'total_sales', 
    dimensions: { year: '2023', product: 'Apple' } 
}); // → 220

// Query specific cell (dice)
qube.dice({ 
    measure: 'total_sales', 
    dimensions: { year: '2023', location: 'Seattle', product: 'Apple' } 
}); // → 100
```

## 📊 Measure Types

| Type | Description |
|------|-------------|
| `sum` | Sum of all values |
| `count` | Count of records |
| `min` | Minimum value |
| `max` | Maximum value |
| `average` | Average of values |
| `first` | First value encountered |
| `last` | Last value encountered |
| `distinct` | Count of unique values |
| `variance` | Population variance |
| `stddev` | Population standard deviation |

## 📖 API Reference

### Constructor

```javascript
const qube = new Qube({ measures, dimensions })
```

| Option | Description |
|--------|-------------|
| `measures` | Array of `{ type, key, name }` |
| `dimensions` | Array of `{ type, key }` |

### Properties

| Property | Description |
|----------|-------------|
| `rowCount` | Number of rows pushed |
| `dimensionCount` | Number of dimensions |

### Methods

#### Data Operations

```javascript
qube.push(rows)    // Add rows
qube.clear()       // Clear all data
```

#### Querying

```javascript
// Get total for a measure
qube.one({ measure: 'total_sales' })

// Query with any combination of dimensions
qube.query({ measure: 'total_sales', dimensions: { year: '2023' } })

// Slice (alias for query)
qube.slice({ measure: 'total_sales', dimensions: { year: '2023', location: 'Seattle' } })

// Dice - query specific cell (all dimensions provided)
qube.dice({ measure: 'total_sales', dimensions: { year: '2023', location: 'Seattle', product: 'Apple' } })
```

#### Rollup & Drilldown

```javascript
// Rollup - aggregate by dimension with totals
qube.rollup('year', { measure: 'total_sales' })
// → [{ dimensions: { year: '2023' }, value: 300 }, 
//    { dimensions: { year: '__TOTAL__' }, value: 450 }]

// Drilldown - break down by a dimension
qube.drilldown('product', { measure: 'total_sales', dimensions: { year: '2023' } })
// → [{ dimensions: { year: '2023', product: 'Apple' }, value: 220 }, ...]
```

#### Enumeration

```javascript
// Get unique values for a dimension
qube.enumerateDimension('year') // → ['2023', '2024']

// Query across all values of a dimension
qube.queryWithEnumeration('year', { measure: 'total_sales' })
// → [{ value: 300, year: '2023' }, { value: 150, year: '2024' }]
```

#### Filter

```javascript
// Filter by dimension values
qube.filter({ dimensions: { year: '2023' } })

// Filter by multiple values
qube.filter({ dimensions: { year: ['2023', '2024'] } })

// Filter with custom predicate
qube.filter({ predicate: (dims, measures) => measures.total_sales > 100 })
```

#### Metadata

```javascript
qube.getDimensionInfo()
// → [{ key: 'year', type: 'string', cardinality: 2, values: ['2023', '2024'] }, ...]

qube.getDimensionInfo('year')
// → { key: 'year', type: 'string', cardinality: 2, values: ['2023', '2024'] }

qube.getMeasureInfo()
// → [{ name: 'total_sales', key: 'sales', type: 'sum' }, ...]
```

#### Serialization

```javascript
const data = qube.serializeCube()   // Serialize
const restored = Qube.fromCube(data) // Restore
```

## 🔷 Hypercube Example (N Dimensions)

```javascript
const qube = new Qube({
    measures: [{ type: 'sum', key: 'revenue', name: 'total_revenue' }],
    dimensions: [
        { type: 'string', key: 'year' },
        { type: 'string', key: 'quarter' },
        { type: 'string', key: 'region' },
        { type: 'string', key: 'product' },
        { type: 'string', key: 'channel' }  // 5 dimensions!
    ]
});

qube.push([
    { year: '2024', quarter: 'Q1', region: 'West', product: 'Widget', channel: 'Online', revenue: 1000 },
    // ... more data
]);

// Query across any combination of dimensions
qube.query({ 
    measure: 'total_revenue', 
    dimensions: { year: '2024', region: 'West' } 
});
```

## ⚠️ Limitations

- In-memory storage only
- All data must fit in memory

## 🤝 Contributing

Contributions welcome! Please open an issue to discuss changes first.

## 📄 License

MIT
