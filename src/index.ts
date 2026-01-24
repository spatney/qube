import {
    QubeOptions,
    QueryOptions,
    InMemoryQubeData,
    SerializedQube,
    QubeRow,
    AverageResult,
    VarianceResult,
    DistinctResult,
    FilterOptions,
    RollupResult,
    DimensionInfo,
    MeasureType
} from './contracts';

export class Qube {

    private dimensionIndices: string[];
    private data: InMemoryQubeData;
    private _rowCount: number = 0;

    constructor(private options: QubeOptions) {
        if (!options.dimensions || options.dimensions.length === 0) {
            throw new Error('At least one dimension is required');
        }
        this.dimensionIndices = options.dimensions.map(d => d.key);
        this.data = {};
    }

    get rowCount(): number {
        return this._rowCount;
    }

    get dimensionCount(): number {
        return this.dimensionIndices.length;
    }

    push(rows: QubeRow[]) {
        const data = this.data;
        const measures = this.options.measures;
        const dimensionIndices = this.dimensionIndices;
        const numDimensions = dimensionIndices.length;

        for (const row of rows) {
            // Collect dimension values
            const dimValues: any[] = [];
            let valid = true;
            for (let i = 0; i < numDimensions; i++) {
                const val = row[dimensionIndices[i]];
                if (val == null) {
                    console.error(`Skipping Row: row must contain all ${numDimensions} dimensions of the cube.`);
                    valid = false;
                    break;
                }
                dimValues.push(val);
            }
            if (!valid) continue;

            // Navigate/create nested structure
            let current = data;
            for (let i = 0; i < numDimensions - 1; i++) {
                current[dimValues[i]] = current[dimValues[i]] || {};
                current = current[dimValues[i]];
            }
            const lastDimValue = dimValues[numDimensions - 1];
            current[lastDimValue] = current[lastDimValue] || {};
            const measureStore = current[lastDimValue];

            // Update measures
            for (const m of measures) {
                const val = row[m.key];
                if (val != null) {
                    this.updateMeasure(measureStore, m.name, m.type, val);
                }
            }

            this._rowCount++;
        }
    }

    private updateMeasure(store: any, measureName: string, type: MeasureType, val: any) {
        switch (type) {
            case 'sum':
                store[measureName] = store[measureName] != null
                    ? store[measureName] + val
                    : val;
                break;
            case 'count':
                store[measureName] = store[measureName] != null
                    ? store[measureName] + 1
                    : 1;
                break;
            case 'max':
                store[measureName] = store[measureName] != null
                    ? Math.max(store[measureName], val)
                    : val;
                break;
            case 'min':
                store[measureName] = store[measureName] != null
                    ? Math.min(store[measureName], val)
                    : val;
                break;
            case 'average':
                if (store[measureName] != null) {
                    store[measureName].count++;
                    store[measureName].sum += val;
                } else {
                    store[measureName] = { count: 1, sum: val };
                }
                break;
            case 'first':
                if (store[measureName] == null) {
                    store[measureName] = val;
                }
                break;
            case 'last':
                store[measureName] = val;
                break;
            case 'distinct':
                if (store[measureName] == null) {
                    store[measureName] = { values: new Set([val]) };
                } else {
                    store[measureName].values.add(val);
                }
                break;
            case 'variance':
            case 'stddev':
                if (store[measureName] != null) {
                    store[measureName].count++;
                    store[measureName].sum += val;
                    store[measureName].sumOfSquares += val * val;
                } else {
                    store[measureName] = {
                        count: 1,
                        sum: val,
                        sumOfSquares: val * val
                    };
                }
                break;
            default:
                throw new Error(`${type} aggregate not supported`);
        }
    }

    queryWithEnumeration(dimensionToEnumerate: string, opts: QueryOptions) {
        const enumeration = this.enumerateDimension(dimensionToEnumerate);
        const result: any[] = [];
        const dimensions = opts.dimensions ? { ...opts.dimensions } : {};

        for (const item of enumeration) {
            dimensions[dimensionToEnumerate] = item;
            const singleResult: any = {
                value: this.query({ dimensions, measure: opts.measure })
            };
            singleResult[dimensionToEnumerate] = item;
            result.push(singleResult);
        }

        return result;
    }

    enumerateDimension(dimensionName: string): any[] {
        const dimensionIndex = this.dimensionIndices.findIndex(d => d === dimensionName);
        if (dimensionIndex === -1) {
            throw new Error(`Dimension '${dimensionName}' not found`);
        }

        const enumerationResult: Set<any> = new Set();
        this.traverseForEnumeration(this.data, 0, dimensionIndex, enumerationResult);
        return Array.from(enumerationResult);
    }

    private traverseForEnumeration(node: any, depth: number, targetDepth: number, result: Set<any>) {
        if (node == null || typeof node !== 'object') return;

        const keys = Object.keys(node);
        for (const key of keys) {
            if (depth === targetDepth) {
                result.add(key);
            } else if (depth < this.dimensionIndices.length - 1) {
                this.traverseForEnumeration(node[key], depth + 1, targetDepth, result);
            }
        }
    }

    query(opts: QueryOptions): number | undefined {
        const measureName = opts.measure;
        const measure = this.options.measures.find(d => d.name === measureName);
        if (!measure) {
            throw new Error(`Measure '${measureName}' not found`);
        }

        const dimensions = opts.dimensions || {};
        const fixedDimIndices: number[] = [];
        const fixedDimValues: any[] = [];

        for (const [key, value] of Object.entries(dimensions)) {
            const idx = this.dimensionIndices.findIndex(d => d === key);
            if (idx !== -1) {
                fixedDimIndices.push(idx);
                fixedDimValues.push(value);
            }
        }

        let result: any;
        this.traverseForQuery(this.data, 0, fixedDimIndices, fixedDimValues, measureName, measure.type, (val) => {
            result = this.aggregateMeasure(result, val, measure.type);
        });

        return this.finalizeMeasure(result, measure.type);
    }

    private traverseForQuery(
        node: any,
        depth: number,
        fixedIndices: number[],
        fixedValues: any[],
        measureName: string,
        measureType: MeasureType,
        callback: (val: any) => void
    ) {
        if (node == null) return;

        if (depth === this.dimensionIndices.length) {
            const val = node[measureName];
            if (val != null) {
                callback(val);
            }
            return;
        }

        const fixedIdx = fixedIndices.indexOf(depth);
        if (fixedIdx !== -1) {
            const key = fixedValues[fixedIdx];
            if (node[key] != null) {
                this.traverseForQuery(node[key], depth + 1, fixedIndices, fixedValues, measureName, measureType, callback);
            }
        } else {
            for (const key of Object.keys(node)) {
                this.traverseForQuery(node[key], depth + 1, fixedIndices, fixedValues, measureName, measureType, callback);
            }
        }
    }

    private aggregateMeasure(current: any, newVal: any, type: MeasureType): any {
        if (current == null) {
            if (type === 'distinct') {
                return { values: new Set(newVal.values) };
            }
            if (type === 'average' || type === 'variance' || type === 'stddev') {
                return { ...newVal };
            }
            return newVal;
        }

        switch (type) {
            case 'sum':
            case 'count':
                return current + newVal;
            case 'min':
                return Math.min(current, newVal);
            case 'max':
                return Math.max(current, newVal);
            case 'first':
                return current;
            case 'last':
                return newVal;
            case 'average':
                return {
                    sum: current.sum + newVal.sum,
                    count: current.count + newVal.count
                };
            case 'distinct':
                for (const v of newVal.values) {
                    current.values.add(v);
                }
                return current;
            case 'variance':
            case 'stddev':
                return {
                    sum: current.sum + newVal.sum,
                    sumOfSquares: current.sumOfSquares + newVal.sumOfSquares,
                    count: current.count + newVal.count
                };
            default:
                throw new Error(`${type} aggregate not supported`);
        }
    }

    private finalizeMeasure(result: any, type: MeasureType): number | undefined {
        if (result == null) return undefined;

        switch (type) {
            case 'average':
                return result.sum / result.count;
            case 'distinct':
                return result.values.size;
            case 'variance':
                if (result.count < 2) return 0;
                const mean = result.sum / result.count;
                return (result.sumOfSquares / result.count) - (mean * mean);
            case 'stddev':
                if (result.count < 2) return 0;
                const avg = result.sum / result.count;
                const variance = (result.sumOfSquares / result.count) - (avg * avg);
                return Math.sqrt(variance);
            default:
                return result;
        }
    }

    slice(opts: QueryOptions): number | undefined {
        return this.query(opts);
    }

    dice(opts: QueryOptions): number | undefined {
        const dimensions = opts.dimensions || {};
        const measureName = opts.measure;
        const measure = this.options.measures.find(d => d.name === measureName);
        if (!measure) return undefined;

        // Navigate directly to the cell
        let current = this.data;
        for (const dimKey of this.dimensionIndices) {
            const dimValue = dimensions[dimKey];
            if (dimValue == null || current[dimValue] == null) {
                return undefined;
            }
            current = current[dimValue];
        }

        const val = current[measureName];
        return this.finalizeMeasure(val, measure.type);
    }

    one(opts: QueryOptions): number | undefined {
        return this.query({ dimensions: {}, measure: opts.measure });
    }

    rollup(dimensionToRollup: string, opts: QueryOptions): RollupResult[] {
        const results: RollupResult[] = [];
        const baseQuery = opts.dimensions ? { ...opts.dimensions } : {};
        delete baseQuery[dimensionToRollup];

        const values = this.enumerateDimension(dimensionToRollup);
        for (const val of values) {
            const dims = { ...baseQuery, [dimensionToRollup]: val };
            results.push({
                dimensions: { [dimensionToRollup]: val },
                value: this.query({ dimensions: dims, measure: opts.measure })
            });
        }

        // Add total
        results.push({
            dimensions: { [dimensionToRollup]: '__TOTAL__' },
            value: this.query({ dimensions: baseQuery, measure: opts.measure })
        });

        return results;
    }

    drilldown(dimensionToDrill: string, opts: QueryOptions): RollupResult[] {
        const results: RollupResult[] = [];
        const baseQuery = opts.dimensions ? { ...opts.dimensions } : {};

        const values = this.enumerateDimension(dimensionToDrill);
        for (const val of values) {
            const dims = { ...baseQuery, [dimensionToDrill]: val };
            const value = this.query({ dimensions: dims, measure: opts.measure });
            if (value != null) {
                results.push({
                    dimensions: { ...baseQuery, [dimensionToDrill]: val },
                    value
                });
            }
        }

        return results;
    }

    filter(opts: FilterOptions): QubeRow[] {
        const results: QubeRow[] = [];
        this.traverseForFilter(this.data, 0, {}, opts, results);
        return results;
    }

    private traverseForFilter(
        node: any,
        depth: number,
        currentDims: { [key: string]: any },
        opts: FilterOptions,
        results: QubeRow[]
    ) {
        if (node == null) return;

        if (depth === this.dimensionIndices.length) {
            // Check predicate
            if (opts.predicate && !opts.predicate(currentDims, node)) {
                return;
            }

            // Check dimension filters
            if (opts.dimensions) {
                for (const [key, value] of Object.entries(opts.dimensions)) {
                    const currentVal = currentDims[key];
                    if (Array.isArray(value)) {
                        if (!value.includes(currentVal)) return;
                    } else if (currentVal !== value) {
                        return;
                    }
                }
            }

            results.push({ ...currentDims, ...node });
            return;
        }

        const dimKey = this.dimensionIndices[depth];

        // If this dimension has a filter value, only traverse that
        if (opts.dimensions && opts.dimensions[dimKey] != null) {
            const filterVal = opts.dimensions[dimKey];
            if (Array.isArray(filterVal)) {
                for (const v of filterVal) {
                    if (node[v] != null) {
                        this.traverseForFilter(node[v], depth + 1, { ...currentDims, [dimKey]: v }, opts, results);
                    }
                }
            } else {
                if (node[filterVal] != null) {
                    this.traverseForFilter(node[filterVal], depth + 1, { ...currentDims, [dimKey]: filterVal }, opts, results);
                }
            }
        } else {
            for (const key of Object.keys(node)) {
                this.traverseForFilter(node[key], depth + 1, { ...currentDims, [dimKey]: key }, opts, results);
            }
        }
    }

    clear() {
        this.data = {};
        this._rowCount = 0;
    }

    getDimensionInfo(dimensionName?: string): DimensionInfo | DimensionInfo[] {
        if (dimensionName) {
            const dimDef = this.options.dimensions.find(d => d.key === dimensionName);
            if (!dimDef) {
                throw new Error(`Dimension '${dimensionName}' not found`);
            }
            const values = this.enumerateDimension(dimensionName);
            return {
                key: dimDef.key,
                type: dimDef.type,
                cardinality: values.length,
                values
            };
        }

        return this.options.dimensions.map(d => {
            const values = this.enumerateDimension(d.key);
            return {
                key: d.key,
                type: d.type,
                cardinality: values.length,
                values
            };
        });
    }

    getMeasureInfo() {
        return this.options.measures.map(m => ({
            name: m.name,
            key: m.key,
            type: m.type
        }));
    }

    serializeCube(): SerializedQube {
        // Convert Sets to arrays for JSON serialization
        const serializableData = this.makeSerializable(this.data);
        return {
            options: this.options,
            dimensionIndices: this.dimensionIndices,
            cube: serializableData,
            rowCount: this._rowCount
        };
    }

    private makeSerializable(node: any): any {
        if (node == null) return node;
        if (typeof node !== 'object') return node;

        if (node.values instanceof Set) {
            return { values: Array.from(node.values) };
        }

        const result: any = {};
        for (const key of Object.keys(node)) {
            result[key] = this.makeSerializable(node[key]);
        }
        return result;
    }

    static fromCube(sQube: SerializedQube): Qube {
        const cube = new Qube(sQube.options);
        cube.data = Qube.deserializeCube(sQube.cube, cube.options.measures);
        cube._rowCount = sQube.rowCount || 0;
        return cube;
    }

    private static deserializeCube(node: any, measures: any[]): any {
        if (node == null) return node;
        if (typeof node !== 'object') return node;

        // Check if this is a serialized distinct measure (has values array)
        if (node.values && Array.isArray(node.values)) {
            return { values: new Set(node.values) };
        }

        const result: any = {};
        for (const key of Object.keys(node)) {
            result[key] = Qube.deserializeCube(node[key], measures);
        }
        return result;
    }
}