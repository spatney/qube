import {
    QubeOptions,
    QueryOptions,
    InMemoryQubeData,
    SerializedQube,
    QubeRow,
    AverageResult
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
        const data = this.data;
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

            data[dimensionOne] = data[dimensionOne] || {};
            data[dimensionOne][dimensionTwo] = data[dimensionOne][dimensionTwo] || {};
            data[dimensionOne][dimensionTwo][dimensionThree] = data[dimensionOne][dimensionTwo][dimensionThree] || {};

            for (const m of measures) {
                const val = row[m.key];

                if (val != null) {
                    const type = m.type;
                    const measureName = m.name;
                    const currentValue = data[dimensionOne][dimensionTwo][dimensionThree];

                    switch (type) {
                        case 'sum':
                            currentValue[measureName] = currentValue[measureName] != null
                                ? currentValue[measureName] + val
                                : val;
                            break;
                        case 'count':
                            currentValue[measureName] = currentValue[measureName] != null
                                ? currentValue[measureName] + 1
                                : 1;
                            break;
                        case 'max':
                            currentValue[measureName] = currentValue[measureName] != null
                                ? Math.max(currentValue[measureName], val)
                                : val;
                            break;
                        case 'min':
                            currentValue[measureName] = currentValue[measureName] != null
                                ? Math.min(currentValue[measureName], val)
                                : val;
                            break;
                        case 'average':
                            if (currentValue[measureName] != null) {
                                currentValue[measureName].count = currentValue[measureName].count + 1;
                                currentValue[measureName].sum = currentValue[measureName].sum + val;
                            } else {
                                currentValue[measureName] = {
                                    count: 1,
                                    sum: val
                                }
                            }
                            break;
                        default: throw new Error(`${type} of aggregate not supported`);
                    }
                }
            }
        }
    }

    queryWithEnumeration(dimensionToEnumerate: string, opts: QueryOptions) {
        const enumeration = this.enumerateDimension(dimensionToEnumerate);
        const result = [];

        for (const item of enumeration) {
            opts.dimensions[dimensionToEnumerate] = item;
            const singleResult = {
                value: Object.keys(opts.dimensions).length === 2
                    ? this.slice(opts)
                    : this.dice(opts)
            };
            singleResult[dimensionToEnumerate] = item;
            result.push(singleResult)
        }

        return result;
    }

    enumerateDimension(dimensionName: string) {
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

        let result: number | undefined | AverageResult;

        let iKeys = Object.keys(cube) || [];

        if (firstDimensionIndex === 0)
            iKeys = firstSliceDimensionValues.filter(x => iKeys.includes(x));
        else if (secondDimensionIndex === 0)
            iKeys = secondSliceDimensionValues.filter(x => iKeys.includes(x));

        for (let i = 0, iLen = iKeys.length; i < iLen; i++) {
            const iValue = cube[iKeys[i]];
            let fKeys = Object.keys(iValue || {}) || [];

            if (firstDimensionIndex === 1)
                fKeys = firstSliceDimensionValues.filter(x => fKeys.includes(x));
            else if (secondDimensionIndex === 1)
                fKeys = secondSliceDimensionValues.filter(x => fKeys.includes(x));

            for (let f = 0, fLen = fKeys.length; f < fLen; f++) {
                const fValue = iValue[fKeys[f]];
                let kKeys = Object.keys(fValue || {}) || [];

                if (firstDimensionIndex === 2)
                    kKeys = firstSliceDimensionValues.filter(x => kKeys.includes(x));
                else if (secondDimensionIndex === 2)
                    kKeys = secondSliceDimensionValues.filter(x => kKeys.includes(x));

                for (let k = 0, kLen = kKeys.length; k < kLen; k++) {
                    const diceValue = fValue[kKeys[k]];

                    if (diceValue != null) {
                        const measureValue = diceValue[measureName];
                        if (measureValue != null) {
                            if (measureType) {
                                switch (measureType) {
                                    case 'count':
                                    case 'sum': result = result == null
                                        ? measureValue
                                        : result += measureValue;
                                        break;
                                    case 'min': result = result == null
                                        ? measureValue
                                        : Math.min(<number>result, measureValue);
                                        break;
                                    case 'max': result = result == null
                                        ? measureValue
                                        : Math.max(<number>result, measureValue);
                                        break;
                                    case 'average': result = result == null
                                        ? {
                                            sum: measureValue.sum,
                                            count: measureValue.count
                                        }
                                        : {
                                            sum: (<AverageResult>result).sum + measureValue.sum,
                                            count: (<AverageResult>result).count + measureValue.count
                                        };
                                        break;
                                    default: throw new Error(`${measureType} of aggregate not supported`);
                                }
                            }
                        }
                    }
                }
            }
        }

        if (result && measureType === 'average') {
            return (<AverageResult>result).sum / (<AverageResult>result).count;
        }

        return <number | undefined>result;
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