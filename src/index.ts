import {
    QubeOptions,
    QueryOptions,
    InMemoryQubeData,
    SerializedQube,
    QubeRow,
    FilterOptions,
    RollupResult,
    DimensionInfo,
    MeasureType,
    MeasureDefinition
} from './contracts';

// Pre-compiled measure updaters for hot path optimization
const MEASURE_UPDATERS: Record<MeasureType, (store: any, name: string, val: any) => void> = {
    sum: (store, name, val) => {
        store[name] = (store[name] || 0) + val;
    },
    count: (store, name) => {
        store[name] = (store[name] || 0) + 1;
    },
    max: (store, name, val) => {
        const curr = store[name];
        if (curr === undefined || val > curr) store[name] = val;
    },
    min: (store, name, val) => {
        const curr = store[name];
        if (curr === undefined || val < curr) store[name] = val;
    },
    average: (store, name, val) => {
        const curr = store[name];
        if (curr) {
            curr.sum += val;
            curr.count++;
        } else {
            store[name] = { sum: val, count: 1 };
        }
    },
    first: (store, name, val) => {
        if (store[name] === undefined) store[name] = val;
    },
    last: (store, name, val) => {
        store[name] = val;
    },
    distinct: (store, name, val) => {
        const curr = store[name];
        if (curr) {
            curr.values.add(val);
        } else {
            store[name] = { values: new Set([val]) };
        }
    },
    variance: (store, name, val) => {
        const curr = store[name];
        if (curr) {
            curr.sum += val;
            curr.sumOfSquares += val * val;
            curr.count++;
        } else {
            store[name] = { sum: val, sumOfSquares: val * val, count: 1 };
        }
    },
    stddev: (store, name, val) => {
        const curr = store[name];
        if (curr) {
            curr.sum += val;
            curr.sumOfSquares += val * val;
            curr.count++;
        } else {
            store[name] = { sum: val, sumOfSquares: val * val, count: 1 };
        }
    }
};

// Pre-compiled aggregators for query path
const MEASURE_AGGREGATORS: Record<MeasureType, (current: any, newVal: any) => any> = {
    sum: (curr, val) => (curr || 0) + val,
    count: (curr, val) => (curr || 0) + val,
    min: (curr, val) => curr === undefined ? val : (val < curr ? val : curr),
    max: (curr, val) => curr === undefined ? val : (val > curr ? val : curr),
    first: (curr, val) => curr === undefined ? val : curr,
    last: (_, val) => val,
    average: (curr, val) => curr 
        ? { sum: curr.sum + val.sum, count: curr.count + val.count }
        : { sum: val.sum, count: val.count },
    distinct: (curr, val) => {
        if (!curr) return { values: new Set(val.values) };
        for (const v of val.values) curr.values.add(v);
        return curr;
    },
    variance: (curr, val) => curr
        ? { sum: curr.sum + val.sum, sumOfSquares: curr.sumOfSquares + val.sumOfSquares, count: curr.count + val.count }
        : { sum: val.sum, sumOfSquares: val.sumOfSquares, count: val.count },
    stddev: (curr, val) => curr
        ? { sum: curr.sum + val.sum, sumOfSquares: curr.sumOfSquares + val.sumOfSquares, count: curr.count + val.count }
        : { sum: val.sum, sumOfSquares: val.sumOfSquares, count: val.count }
};

interface CompiledMeasure {
    name: string;
    key: string;
    type: MeasureType;
    updater: (store: any, name: string, val: any) => void;
    aggregator: (current: any, newVal: any) => any;
}

export class Qube {
    private readonly dimensionKeys: string[];
    private readonly numDimensions: number;
    private readonly compiledMeasures: CompiledMeasure[];
    private data: InMemoryQubeData;
    private _rowCount: number = 0;

    constructor(private options: QubeOptions) {
        if (!options.dimensions || options.dimensions.length === 0) {
            throw new Error('At least one dimension is required');
        }
        this.dimensionKeys = options.dimensions.map(d => d.key);
        this.numDimensions = this.dimensionKeys.length;
        this.data = Object.create(null); // Faster than {}
        
        // Pre-compile measures for faster access
        this.compiledMeasures = options.measures.map(m => ({
            name: m.name,
            key: m.key,
            type: m.type,
            updater: MEASURE_UPDATERS[m.type],
            aggregator: MEASURE_AGGREGATORS[m.type]
        }));
    }

    get rowCount(): number {
        return this._rowCount;
    }

    get dimensionCount(): number {
        return this.numDimensions;
    }

    // Kept for compatibility
    get dimensionIndices(): string[] {
        return this.dimensionKeys;
    }

    push(rows: QubeRow[]): void {
        const data = this.data;
        const measures = this.compiledMeasures;
        const dimKeys = this.dimensionKeys;
        const numDims = this.numDimensions;
        const numMeasures = measures.length;
        const lastDimIdx = numDims - 1;

        for (let r = 0, rLen = rows.length; r < rLen; r++) {
            const row = rows[r];
            
            // Navigate to leaf node, creating path as needed
            let node = data;
            let valid = true;
            
            for (let d = 0; d < lastDimIdx; d++) {
                const dimVal = row[dimKeys[d]];
                if (dimVal == null) {
                    valid = false;
                    break;
                }
                let next = node[dimVal];
                if (!next) {
                    next = Object.create(null);
                    node[dimVal] = next;
                }
                node = next;
            }
            
            if (!valid) continue;
            
            // Handle last dimension
            const lastDimVal = row[dimKeys[lastDimIdx]];
            if (lastDimVal == null) continue;
            
            let measureStore = node[lastDimVal];
            if (!measureStore) {
                measureStore = Object.create(null);
                node[lastDimVal] = measureStore;
            }

            // Update all measures - unrolled for common cases
            for (let m = 0; m < numMeasures; m++) {
                const measure = measures[m];
                const val = row[measure.key];
                if (val != null) {
                    measure.updater(measureStore, measure.name, val);
                }
            }

            this._rowCount++;
        }
    }

    query(opts: QueryOptions): number | undefined {
        const measureName = opts.measure;
        const measure = this.compiledMeasures.find(m => m.name === measureName);
        if (!measure) {
            throw new Error(`Measure '${measureName}' not found`);
        }

        const dimensions = opts.dimensions;
        if (!dimensions || Object.keys(dimensions).length === 0) {
            // Full aggregation - use optimized path
            return this.aggregateAll(measure);
        }

        // Build fixed dimension lookup
        const fixedDims = new Map<number, any>();
        for (const key in dimensions) {
            const idx = this.dimensionKeys.indexOf(key);
            if (idx !== -1) {
                fixedDims.set(idx, dimensions[key]);
            }
        }

        let result: any;
        this.traverseQuery(this.data, 0, fixedDims, measure, (val) => {
            result = measure.aggregator(result, val);
        });

        return this.finalizeMeasure(result, measure.type);
    }

    private aggregateAll(measure: CompiledMeasure): number | undefined {
        let result: any;
        const stack: any[] = [this.data];
        const depthStack: number[] = [0];
        const targetDepth = this.numDimensions;

        while (stack.length > 0) {
            const node = stack.pop()!;
            const depth = depthStack.pop()!;

            if (depth === targetDepth) {
                const val = node[measure.name];
                if (val != null) {
                    result = measure.aggregator(result, val);
                }
            } else {
                const keys = Object.keys(node);
                for (let i = 0, len = keys.length; i < len; i++) {
                    const child = node[keys[i]];
                    if (child != null) {
                        stack.push(child);
                        depthStack.push(depth + 1);
                    }
                }
            }
        }

        return this.finalizeMeasure(result, measure.type);
    }

    private traverseQuery(
        node: any,
        depth: number,
        fixedDims: Map<number, any>,
        measure: CompiledMeasure,
        callback: (val: any) => void
    ): void {
        if (node == null) return;

        if (depth === this.numDimensions) {
            const val = node[measure.name];
            if (val != null) callback(val);
            return;
        }

        const fixedVal = fixedDims.get(depth);
        if (fixedVal !== undefined) {
            const child = node[fixedVal];
            if (child != null) {
                this.traverseQuery(child, depth + 1, fixedDims, measure, callback);
            }
        } else {
            const keys = Object.keys(node);
            for (let i = 0, len = keys.length; i < len; i++) {
                this.traverseQuery(node[keys[i]], depth + 1, fixedDims, measure, callback);
            }
        }
    }

    private finalizeMeasure(result: any, type: MeasureType): number | undefined {
        if (result == null) return undefined;

        switch (type) {
            case 'average':
                return result.sum / result.count;
            case 'distinct':
                return result.values.size;
            case 'variance': {
                if (result.count < 2) return 0;
                const mean = result.sum / result.count;
                return (result.sumOfSquares / result.count) - (mean * mean);
            }
            case 'stddev': {
                if (result.count < 2) return 0;
                const avg = result.sum / result.count;
                const variance = (result.sumOfSquares / result.count) - (avg * avg);
                return Math.sqrt(variance);
            }
            default:
                return result;
        }
    }

    queryWithEnumeration(dimensionToEnumerate: string, opts: QueryOptions): any[] {
        const enumeration = this.enumerateDimension(dimensionToEnumerate);
        const result: any[] = new Array(enumeration.length);
        const baseDims = opts.dimensions ? { ...opts.dimensions } : {};

        for (let i = 0, len = enumeration.length; i < len; i++) {
            const item = enumeration[i];
            baseDims[dimensionToEnumerate] = item;
            result[i] = {
                value: this.query({ dimensions: { ...baseDims }, measure: opts.measure }),
                [dimensionToEnumerate]: item
            };
        }

        return result;
    }

    enumerateDimension(dimensionName: string): any[] {
        const dimensionIndex = this.dimensionKeys.indexOf(dimensionName);
        if (dimensionIndex === -1) {
            throw new Error(`Dimension '${dimensionName}' not found`);
        }

        const result = new Set<any>();
        const stack: { node: any; depth: number }[] = [{ node: this.data, depth: 0 }];

        while (stack.length > 0) {
            const { node, depth } = stack.pop()!;
            if (node == null) continue;

            const keys = Object.keys(node);
            for (let i = 0, len = keys.length; i < len; i++) {
                const key = keys[i];
                if (depth === dimensionIndex) {
                    result.add(key);
                } else if (depth < this.numDimensions - 1) {
                    stack.push({ node: node[key], depth: depth + 1 });
                }
            }
        }

        return Array.from(result);
    }

    slice(opts: QueryOptions): number | undefined {
        return this.query(opts);
    }

    dice(opts: QueryOptions): number | undefined {
        const dimensions = opts.dimensions;
        if (!dimensions) return undefined;
        
        const measureName = opts.measure;
        const measure = this.compiledMeasures.find(m => m.name === measureName);
        if (!measure) return undefined;

        // Direct navigation - O(d) where d = number of dimensions
        let node = this.data;
        for (let i = 0; i < this.numDimensions; i++) {
            const dimVal = dimensions[this.dimensionKeys[i]];
            if (dimVal == null) return undefined;
            node = node[dimVal];
            if (node == null) return undefined;
        }

        const val = node[measureName];
        return this.finalizeMeasure(val, measure.type);
    }

    one(opts: QueryOptions): number | undefined {
        const measure = this.compiledMeasures.find(m => m.name === opts.measure);
        if (!measure) {
            throw new Error(`Measure '${opts.measure}' not found`);
        }
        return this.aggregateAll(measure);
    }

    rollup(dimensionToRollup: string, opts: QueryOptions): RollupResult[] {
        const values = this.enumerateDimension(dimensionToRollup);
        const results: RollupResult[] = new Array(values.length + 1);
        const baseQuery = opts.dimensions ? { ...opts.dimensions } : {};
        delete baseQuery[dimensionToRollup];

        for (let i = 0, len = values.length; i < len; i++) {
            const val = values[i];
            results[i] = {
                dimensions: { [dimensionToRollup]: val },
                value: this.query({ dimensions: { ...baseQuery, [dimensionToRollup]: val }, measure: opts.measure })
            };
        }

        results[values.length] = {
            dimensions: { [dimensionToRollup]: '__TOTAL__' },
            value: this.query({ dimensions: baseQuery, measure: opts.measure })
        };

        return results;
    }

    drilldown(dimensionToDrill: string, opts: QueryOptions): RollupResult[] {
        const values = this.enumerateDimension(dimensionToDrill);
        const results: RollupResult[] = [];
        const baseQuery = opts.dimensions ? { ...opts.dimensions } : {};

        for (let i = 0, len = values.length; i < len; i++) {
            const val = values[i];
            const dims = { ...baseQuery, [dimensionToDrill]: val };
            const value = this.query({ dimensions: dims, measure: opts.measure });
            if (value != null) {
                results.push({ dimensions: dims, value });
            }
        }

        return results;
    }

    filter(opts: FilterOptions): QubeRow[] {
        const results: QubeRow[] = [];
        const filterDims = opts.dimensions;
        
        // Pre-process filter dimensions for faster lookup
        const filterMap = new Map<number, any>();
        if (filterDims) {
            for (const key in filterDims) {
                const idx = this.dimensionKeys.indexOf(key);
                if (idx !== -1) {
                    filterMap.set(idx, filterDims[key]);
                }
            }
        }

        this.traverseFilter(this.data, 0, Object.create(null), filterMap, opts.predicate, results);
        return results;
    }

    private traverseFilter(
        node: any,
        depth: number,
        currentDims: Record<string, any>,
        filterMap: Map<number, any>,
        predicate: FilterOptions['predicate'],
        results: QubeRow[]
    ): void {
        if (node == null) return;

        if (depth === this.numDimensions) {
            if (predicate && !predicate(currentDims, node)) return;
            results.push({ ...currentDims, ...node });
            return;
        }

        const dimKey = this.dimensionKeys[depth];
        const filterVal = filterMap.get(depth);

        if (filterVal !== undefined) {
            if (Array.isArray(filterVal)) {
                for (let i = 0, len = filterVal.length; i < len; i++) {
                    const v = filterVal[i];
                    if (node[v] != null) {
                        currentDims[dimKey] = v;
                        this.traverseFilter(node[v], depth + 1, currentDims, filterMap, predicate, results);
                    }
                }
            } else if (node[filterVal] != null) {
                currentDims[dimKey] = filterVal;
                this.traverseFilter(node[filterVal], depth + 1, currentDims, filterMap, predicate, results);
            }
        } else {
            const keys = Object.keys(node);
            for (let i = 0, len = keys.length; i < len; i++) {
                const key = keys[i];
                currentDims[dimKey] = key;
                this.traverseFilter(node[key], depth + 1, currentDims, filterMap, predicate, results);
            }
        }
        delete currentDims[dimKey];
    }

    clear(): void {
        this.data = Object.create(null);
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

    getMeasureInfo(): { name: string; key: string; type: MeasureType }[] {
        return this.options.measures.map(m => ({
            name: m.name,
            key: m.key,
            type: m.type
        }));
    }

    serializeCube(): SerializedQube {
        return {
            options: this.options,
            dimensionIndices: this.dimensionKeys,
            cube: this.makeSerializable(this.data),
            rowCount: this._rowCount
        };
    }

    /**
     * Serialize and compress the cube using gzip.
     * Returns a Buffer that can be written to disk or sent over network.
     */
    async serializeCompressed(): Promise<Buffer> {
        const { gzip } = await import('zlib');
        const { promisify } = await import('util');
        const gzipAsync = promisify(gzip);
        
        const json = JSON.stringify(this.serializeCube());
        return gzipAsync(Buffer.from(json, 'utf-8'));
    }

    /**
     * Synchronous version of serializeCompressed.
     */
    serializeCompressedSync(): Buffer {
        const { gzipSync } = require('zlib') as typeof import('zlib');
        const json = JSON.stringify(this.serializeCube());
        return gzipSync(Buffer.from(json, 'utf-8'));
    }

    /**
     * Restore a cube from compressed data.
     */
    static async fromCompressed(data: Buffer): Promise<Qube> {
        const { gunzip } = await import('zlib');
        const { promisify } = await import('util');
        const gunzipAsync = promisify(gunzip);
        
        const json = (await gunzipAsync(data)).toString('utf-8');
        return Qube.fromCube(JSON.parse(json));
    }

    /**
     * Synchronous version of fromCompressed.
     */
    static fromCompressedSync(data: Buffer): Qube {
        const { gunzipSync } = require('zlib') as typeof import('zlib');
        const json = gunzipSync(data).toString('utf-8');
        return Qube.fromCube(JSON.parse(json));
    }

    private makeSerializable(node: any): any {
        if (node == null || typeof node !== 'object') return node;
        if (node.values instanceof Set) {
            return { values: Array.from(node.values) };
        }

        const result: any = {};
        const keys = Object.keys(node);
        for (let i = 0, len = keys.length; i < len; i++) {
            const key = keys[i];
            result[key] = this.makeSerializable(node[key]);
        }
        return result;
    }

    static fromCube(sQube: SerializedQube): Qube {
        const cube = new Qube(sQube.options);
        cube.data = Qube.deserializeCube(sQube.cube);
        cube._rowCount = sQube.rowCount || 0;
        return cube;
    }

    private static deserializeCube(node: any): any {
        if (node == null || typeof node !== 'object') return node;
        if (node.values && Array.isArray(node.values)) {
            return { values: new Set(node.values) };
        }

        const result: any = Object.create(null);
        const keys = Object.keys(node);
        for (let i = 0, len = keys.length; i < len; i++) {
            const key = keys[i];
            result[key] = Qube.deserializeCube(node[key]);
        }
        return result;
    }
}