import {
    QubeOptions,
    QueryOptions,
    InMemoryQubeData,
    SerializedQube,
    QubeRow
} from './contracts';

export class Qube {

    private dimensionIndices: string[];
    private data: InMemoryQubeData;

    constructor(private options: QubeOptions) {
        this.dimensionIndices = [
            options.dimensions[0].key,
            options.dimensions[1].key,
            options.dimensions[2].key
        ];

        this.data = {};
    }

    push(rows: QubeRow[]) {
        const cube = this.data;
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

    enumerateDimensions(dimensionName: string) {
        const dimensionIndices = this.dimensionIndices;
        const dimensionIndex = dimensionIndices.findIndex(d => d === dimensionName);
        const cube = this.data;
        let enumerationResult = {};

        let iKeys = Object.keys(cube) || [];
        for (let i = 0, iLen = iKeys.length; i < iLen; i++) {
            const iKey = cube[iKeys[i]];

            if (dimensionIndex === 0) {
                enumerationResult[iKeys[i]] = true;
            }

            let fKeys = Object.keys(iKey || {}) || [];
            for (let f = 0, fLen = fKeys.length; f < fLen; f++) {
                const fKey = iKey[fKeys[f]];
                let kKeys = Object.keys(fKey || {}) || [];

                if (dimensionIndex === 1) {
                    enumerationResult[fKeys[f]] = true;
                }
                for (let k = 0, kLen = kKeys.length; k < kLen; k++) {
                    if (dimensionIndex === 2) {
                        enumerationResult[kKeys[k]] = true;
                    }
                }
            }
        }

        return Object.keys(enumerationResult);
    }

    slice(opts: QueryOptions): number | undefined {
        const dimensionIndices = this.dimensionIndices;
        const cube = this.data;
        const measures = this.options.measures;
        const dimensions = opts.dimensions;
        const measureName = opts.measure;
        const measure = measures.find(d => d.name === measureName);
        const measureType = measure ? measure.type : undefined;
        const dimensionKeys = Object.keys(dimensions);
        const firstDimensionIndex = dimensionKeys.length === 2 ? dimensionIndices.findIndex(d => d === dimensionKeys[0]) : -1;
        const secondDimensionIndex = dimensionKeys.length === 2 ? dimensionIndices.findIndex(d => d === dimensionKeys[1]) : -1;
        const firstSliceDimensionValues = [dimensions[dimensionIndices[firstDimensionIndex]]];
        const secondSliceDimensionValues = [dimensions[dimensionIndices[secondDimensionIndex]]];

        let result: number | undefined;

        let iKeys = Object.keys(cube) || [];

        if (firstDimensionIndex === 0)
            iKeys = firstSliceDimensionValues.filter(x => iKeys.includes(x));
        else if (secondDimensionIndex === 0)
            iKeys = secondSliceDimensionValues.filter(x => iKeys.includes(x));

        for (let i = 0, iLen = iKeys.length; i < iLen; i++) {
            const iKey = cube[iKeys[i]];
            let fKeys = Object.keys(iKey || {}) || [];

            if (firstDimensionIndex === 1)
                fKeys = firstSliceDimensionValues.filter(x => fKeys.includes(x));
            else if (secondDimensionIndex === 1)
                fKeys = secondSliceDimensionValues.filter(x => fKeys.includes(x));

            for (let f = 0, fLen = fKeys.length; f < fLen; f++) {
                const fKey = iKey[fKeys[f]];
                let kKeys = Object.keys(fKey || {}) || [];

                if (firstDimensionIndex === 2)
                    kKeys = firstSliceDimensionValues.filter(x => kKeys.includes(x));
                else if (secondDimensionIndex === 2)
                    kKeys = secondSliceDimensionValues.filter(x => kKeys.includes(x));

                for (let k = 0, kLen = kKeys.length; k < kLen; k++) {
                    const diceValue = fKey[kKeys[k]];

                    if (diceValue != null) {
                        const measureValue = diceValue[measureName];
                        if (measureValue != null) {
                            if (result == null) {
                                result = 0;
                            }

                            if (measureType) {
                                switch (measureType) {
                                    case 'sum': result += measureValue;
                                        break;
                                    default: throw new Error(`${measureType} of aggregate not supported`);
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

        const cube = this.data;
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
            cube: this.data
        };
    }

    static fromCube(sQube: SerializedQube) {
        const cube = new Qube(sQube.options);
        cube.data = sQube.cube;
        return cube;
    }
}