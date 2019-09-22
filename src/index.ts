import {
    QubeOptions,
    QueryOptions,
    InMemoryQubeData
} from './contracts';

export class Qube {

    private dimensionIndices: string[];
    private cubeData: InMemoryQubeData;

    constructor(private options: QubeOptions) {
        this.dimensionIndices = [
            options.dimensions[0].key,
            options.dimensions[1].key,
            options.dimensions[2].key
        ];

        this.cubeData = {};
    }

    push(rows: object[]) {
        if (!Array.isArray(rows)) {
            console.log('Rows must be an object array');
            return;
        }

        for (let row of rows) {
            this.aggregateRow(row);
        }
    }

    aggregateRow(row: { [key: string]: any }) {
        const cube = this.cubeData;
        const measures = this.options.measures;
        const dimensionIndices = this.dimensionIndices;
        const dimensionOne = row[dimensionIndices[0]];
        const dimensionTwo = row[dimensionIndices[1]];
        const dimensionThree = row[dimensionIndices[2]];

        cube[dimensionOne] = cube[dimensionOne] || {};
        cube[dimensionOne][dimensionTwo] = cube[dimensionOne][dimensionTwo] || {};
        cube[dimensionOne][dimensionTwo][dimensionThree] = cube[dimensionOne][dimensionTwo][dimensionThree] || {};

        for (const m of measures) {
            const key = m.key;
            const type = m.type;
            const name = m.name;

            if (type === 'sum') {
                const val = row[key];
                cube[dimensionOne][dimensionTwo][dimensionThree][name] = cube[dimensionOne][dimensionTwo][dimensionThree][name] != null
                    ? cube[dimensionOne][dimensionTwo][dimensionThree][name] + val
                    : val;
            }
        }
    }

    slice(opts: QueryOptions) {
        const dimensionIndices = this.dimensionIndices;
        const cube = this.cubeData;
        const options = this.options;

        const dimensions = opts.dimensions;
        const measureName = opts.measure;
        const dimensionKeys = Object.keys(dimensions);
        const firstDimensionIndex = dimensionKeys.length === 2 ? dimensionIndices.findIndex(d => d === dimensionKeys[0]) : -1;
        const secondDimensionIndex = dimensionKeys.length === 2 ? dimensionIndices.findIndex(d => d === dimensionKeys[1]) : -1;

        let result;

        let iKeys = Object.keys(cube) || [];

        if (firstDimensionIndex === 0)
            iKeys = [dimensions[dimensionIndices[firstDimensionIndex]]].filter(x => iKeys.includes(x));
        else if (secondDimensionIndex === 0)
            iKeys = [dimensions[dimensionIndices[secondDimensionIndex]]].filter(x => iKeys.includes(x));

        for (let i = 0; i < iKeys.length; i++) {
            let fKeys = Object.keys(cube[iKeys[i]] || {}) || [];
            if (firstDimensionIndex === 1)
                fKeys = [dimensions[dimensionIndices[firstDimensionIndex]]].filter(x => fKeys.includes(x));
            else if (secondDimensionIndex === 1)
                fKeys = [dimensions[dimensionIndices[secondDimensionIndex]]].filter(x => fKeys.includes(x));

            for (let f = 0; f < fKeys.length; f++) {
                let kKeys = Object.keys(cube[iKeys[i]][fKeys[f]] || {}) || [];
                if (firstDimensionIndex === 2)
                    kKeys = [dimensions[dimensionIndices[firstDimensionIndex]]].filter(x => kKeys.includes(x));
                else if (secondDimensionIndex === 2)
                    kKeys = [dimensions[dimensionIndices[secondDimensionIndex]]].filter(x => kKeys.includes(x));

                for (let k = 0; k < kKeys.length; k++) {

                    const diceValue = cube[iKeys[i]][fKeys[f]][kKeys[k]];

                    if (diceValue != null) {
                        const measureValue = cube[iKeys[i]][fKeys[f]][kKeys[k]][measureName];
                        if (measureValue != null) {
                            if (result === undefined) {
                                result = 0;
                            }

                            if (options.measures.filter(d => d.name === measureName)[0].type === 'sum') {
                                result += measureValue;
                            }
                        }
                    }
                }
            }
        }

        return result;
    }

    dice(opts: QueryOptions) {
        const dimensionIndices = this.dimensionIndices;
        const dimensions = opts.dimensions;
        const measureName = opts.measure;

        const dimensionOne = dimensions[dimensionIndices[0]];
        const dimensionTwo = dimensions[dimensionIndices[1]];
        const dimensionThree = dimensions[dimensionIndices[2]];

        const cube = this.cubeData;
        if (cube[dimensionOne]
            && cube[dimensionOne][dimensionTwo]
            && cube[dimensionOne][dimensionTwo][dimensionThree]
            && (cube[dimensionOne][dimensionTwo][dimensionThree][measureName] != null)) {

            return cube[dimensionOne][dimensionTwo][dimensionThree][measureName];
        }

        return undefined;
    }

    one(opts: QueryOptions) {
        const measureName = opts.measure;
        return this.slice({ dimensions: {}, measure: measureName });
    }

    serializeCube() {
        return JSON.stringify({
            options: this.options,
            dimIndex: this.dimensionIndices,
            cube: this.cubeData
        }, null, 2);
    }

    static fromCube(jsonString: string) {
        const data = JSON.parse(jsonString);
        const cube = new Qube(data.options);
        cube.cubeData = data.cube;

        return cube;
    }
}