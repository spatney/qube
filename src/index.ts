import {
    QubeOptions,
    QueryOptions,
    InMemoryQubeData,
    SerializedQube,
    QubeRow
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

    push(rows: QubeRow[]) {
        const cube = this.cubeData;
        const measures = this.options.measures;
        const dimensionIndices = this.dimensionIndices;

        for (const row of rows) {
            const dimensionOne = row[dimensionIndices[0]];
            const dimensionTwo = row[dimensionIndices[1]];
            const dimensionThree = row[dimensionIndices[2]];

            if (!(dimensionOne && dimensionTwo && dimensionThree)) {
                console.error('Skipping Row: row must contain all three dimensions of the cube.');
                continue;
            }

            cube[dimensionOne] = cube[dimensionOne] || {};
            cube[dimensionOne][dimensionTwo] = cube[dimensionOne][dimensionTwo] || {};
            cube[dimensionOne][dimensionTwo][dimensionThree] = cube[dimensionOne][dimensionTwo][dimensionThree] || {};

            for (const m of measures) {
                const val = row[m.key];

                if (val != null) {
                    const type = m.type;
                    const measureName = m.name;

                    switch (type) {
                        case 'sum':
                            cube[dimensionOne][dimensionTwo][dimensionThree][measureName]
                                = cube[dimensionOne][dimensionTwo][dimensionThree][measureName] != null
                                    ? cube[dimensionOne][dimensionTwo][dimensionThree][measureName] + val
                                    : val;
                            break;
                        default: throw new Error(`${type} of aggregate not supported`);
                    }
                }
            }
        }
    }

    slice(opts: QueryOptions): number | undefined {
        const dimensionIndices = this.dimensionIndices;
        const cube = this.cubeData;
        const options = this.options;

        const dimensions = opts.dimensions;
        const measureName = opts.measure;
        const dimensionKeys = Object.keys(dimensions);
        const firstDimensionIndex = dimensionKeys.length === 2 ? dimensionIndices.findIndex(d => d === dimensionKeys[0]) : -1;
        const secondDimensionIndex = dimensionKeys.length === 2 ? dimensionIndices.findIndex(d => d === dimensionKeys[1]) : -1;

        let result: number | undefined;

        let iKeys = Object.keys(cube) || [];

        if (firstDimensionIndex === 0)
            iKeys = [dimensions[dimensionIndices[firstDimensionIndex]]].filter(x => iKeys.includes(x));
        else if (secondDimensionIndex === 0)
            iKeys = [dimensions[dimensionIndices[secondDimensionIndex]]].filter(x => iKeys.includes(x));

        for (let i = 0, iLen = iKeys.length; i < iLen; i++) {
            let fKeys = Object.keys(cube[iKeys[i]] || {}) || [];

            if (firstDimensionIndex === 1)
                fKeys = [dimensions[dimensionIndices[firstDimensionIndex]]].filter(x => fKeys.includes(x));
            else if (secondDimensionIndex === 1)
                fKeys = [dimensions[dimensionIndices[secondDimensionIndex]]].filter(x => fKeys.includes(x));

            for (let f = 0, fLen = fKeys.length; f < fLen; f++) {
                let kKeys = Object.keys(cube[iKeys[i]][fKeys[f]] || {}) || [];

                if (firstDimensionIndex === 2)
                    kKeys = [dimensions[dimensionIndices[firstDimensionIndex]]].filter(x => kKeys.includes(x));
                else if (secondDimensionIndex === 2)
                    kKeys = [dimensions[dimensionIndices[secondDimensionIndex]]].filter(x => kKeys.includes(x));

                for (let k = 0, kLen = kKeys.length; k < kLen; k++) {
                    const diceValue = cube[iKeys[i]][fKeys[f]][kKeys[k]];

                    if (diceValue != null) {
                        const measureValue = cube[iKeys[i]][fKeys[f]][kKeys[k]][measureName];
                        if (measureValue != null) {
                            if (result == null) {
                                result = 0;
                            }

                            const measure = options.measures.find(d => d.name === measureName);
                            if (measure) {
                                switch (measure.type) {
                                    case 'sum': result += measureValue;
                                        break;
                                    default: throw new Error(`${measure.type} of aggregate not supported`);
                                }
                            }
                        }
                    }
                }
            }
        }

        return result;
    }

    dice(opts: QueryOptions): number | undefined {
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

    one(opts: QueryOptions): number | undefined {
        const measureName = opts.measure;
        return this.slice({ dimensions: {}, measure: measureName });
    }

    serializeCube() {
        return <SerializedQube>{
            options: this.options,
            dimensionIndices: this.dimensionIndices,
            cube: this.cubeData
        };
    }

    static fromCube(sQube: SerializedQube) {
        const cube = new Qube(sQube.options);
        cube.cubeData = sQube.cube;
        return cube;
    }
}