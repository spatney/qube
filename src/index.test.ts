import { describe, it, expect, beforeEach } from 'vitest';
import { Qube } from './index';

describe('Qube', () => {
    describe('Basic Operations', () => {
        let qube: Qube;

        beforeEach(() => {
            qube = new Qube({
                measures: [
                    { type: 'sum', key: 'sales', name: 'total_sales' },
                    { type: 'count', key: 'sales', name: 'count_sales' },
                    { type: 'min', key: 'sales', name: 'min_sales' },
                    { type: 'max', key: 'sales', name: 'max_sales' },
                    { type: 'average', key: 'sales', name: 'avg_sales' },
                ],
                dimensions: [
                    { type: 'string', key: 'year' },
                    { type: 'string', key: 'location' },
                    { type: 'string', key: 'product' },
                ],
            });

            qube.push([
                { year: '2017', location: 'Seattle', product: 'Apple', sales: 10 },
                { year: '2017', location: 'Seattle', product: 'Apple', sales: 20 },
                { year: '2018', location: 'Seattle', product: 'Apple', sales: 35 },
                { year: '2018', location: 'Seattle', product: 'Apple', sales: 15 },
                { year: '2017', location: 'Portland', product: 'Orange', sales: 7 },
                { year: '2017', location: 'Portland', product: 'Orange', sales: 16 },
            ]);
        });

        it('should calculate total sum', () => {
            expect(qube.one({ measure: 'total_sales' })).toBe(103);
        });

        it('should calculate total count', () => {
            expect(qube.one({ measure: 'count_sales' })).toBe(6);
        });

        it('should calculate min', () => {
            expect(qube.one({ measure: 'min_sales' })).toBe(7);
        });

        it('should calculate max', () => {
            expect(qube.one({ measure: 'max_sales' })).toBe(35);
        });

        it('should calculate average', () => {
            const avg = qube.one({ measure: 'avg_sales' });
            expect(avg).toBeCloseTo(103 / 6, 2);
        });

        it('should dice to specific cell', () => {
            expect(qube.dice({
                measure: 'total_sales',
                dimensions: { year: '2017', location: 'Seattle', product: 'Apple' }
            })).toBe(30);
        });

        it('should slice with partial dimensions', () => {
            expect(qube.slice({
                measure: 'total_sales',
                dimensions: { year: '2017', location: 'Seattle' }
            })).toBe(30);
        });

        it('should track row count', () => {
            expect(qube.rowCount).toBe(6);
        });

        it('should report dimension count', () => {
            expect(qube.dimensionCount).toBe(3);
        });
    });

    describe('Hypercube (N Dimensions)', () => {
        it('should support 4 dimensions', () => {
            const qube = new Qube({
                measures: [{ type: 'sum', key: 'revenue', name: 'total' }],
                dimensions: [
                    { type: 'string', key: 'year' },
                    { type: 'string', key: 'quarter' },
                    { type: 'string', key: 'region' },
                    { type: 'string', key: 'product' },
                ],
            });

            qube.push([
                { year: '2023', quarter: 'Q1', region: 'North', product: 'A', revenue: 100 },
                { year: '2023', quarter: 'Q1', region: 'North', product: 'B', revenue: 200 },
                { year: '2023', quarter: 'Q2', region: 'North', product: 'A', revenue: 150 },
            ]);

            expect(qube.one({ measure: 'total' })).toBe(450);
            expect(qube.query({
                measure: 'total',
                dimensions: { year: '2023', quarter: 'Q1' }
            })).toBe(300);
        });

        it('should support single dimension', () => {
            const qube = new Qube({
                measures: [{ type: 'sum', key: 'value', name: 'total' }],
                dimensions: [{ type: 'string', key: 'category' }],
            });

            qube.push([
                { category: 'A', value: 10 },
                { category: 'A', value: 20 },
                { category: 'B', value: 30 },
            ]);

            expect(qube.one({ measure: 'total' })).toBe(60);
            expect(qube.dice({ measure: 'total', dimensions: { category: 'A' } })).toBe(30);
        });

        it('should throw for zero dimensions', () => {
            expect(() => new Qube({
                measures: [{ type: 'sum', key: 'value', name: 'total' }],
                dimensions: [],
            })).toThrow('At least one dimension is required');
        });
    });

    describe('New Measure Types', () => {
        it('should calculate first value', () => {
            const qube = new Qube({
                measures: [{ type: 'first', key: 'value', name: 'first_val' }],
                dimensions: [{ type: 'string', key: 'group' }],
            });

            qube.push([
                { group: 'A', value: 10 },
                { group: 'A', value: 20 },
                { group: 'A', value: 30 },
            ]);

            expect(qube.one({ measure: 'first_val' })).toBe(10);
        });

        it('should calculate last value', () => {
            const qube = new Qube({
                measures: [{ type: 'last', key: 'value', name: 'last_val' }],
                dimensions: [{ type: 'string', key: 'group' }],
            });

            qube.push([
                { group: 'A', value: 10 },
                { group: 'A', value: 20 },
                { group: 'A', value: 30 },
            ]);

            expect(qube.one({ measure: 'last_val' })).toBe(30);
        });

        it('should count distinct values', () => {
            const qube = new Qube({
                measures: [{ type: 'distinct', key: 'category', name: 'unique_cats' }],
                dimensions: [{ type: 'string', key: 'group' }],
            });

            qube.push([
                { group: 'A', category: 'X' },
                { group: 'A', category: 'Y' },
                { group: 'A', category: 'X' },
                { group: 'A', category: 'Z' },
            ]);

            expect(qube.one({ measure: 'unique_cats' })).toBe(3);
        });

        it('should calculate variance', () => {
            const qube = new Qube({
                measures: [{ type: 'variance', key: 'value', name: 'var' }],
                dimensions: [{ type: 'string', key: 'group' }],
            });

            qube.push([
                { group: 'A', value: 10 },
                { group: 'A', value: 20 },
                { group: 'A', value: 30 },
                { group: 'A', value: 40 },
            ]);

            expect(qube.one({ measure: 'var' })).toBe(125);
        });

        it('should calculate standard deviation', () => {
            const qube = new Qube({
                measures: [{ type: 'stddev', key: 'value', name: 'std' }],
                dimensions: [{ type: 'string', key: 'group' }],
            });

            qube.push([
                { group: 'A', value: 10 },
                { group: 'A', value: 20 },
                { group: 'A', value: 30 },
                { group: 'A', value: 40 },
            ]);

            expect(qube.one({ measure: 'std' })).toBeCloseTo(Math.sqrt(125), 2);
        });
    });

    describe('Rollup', () => {
        it('should rollup by dimension with totals', () => {
            const qube = new Qube({
                measures: [{ type: 'sum', key: 'sales', name: 'total' }],
                dimensions: [
                    { type: 'string', key: 'year' },
                    { type: 'string', key: 'product' },
                ],
            });

            qube.push([
                { year: '2023', product: 'A', sales: 100 },
                { year: '2023', product: 'B', sales: 200 },
                { year: '2024', product: 'A', sales: 150 },
            ]);

            const result = qube.rollup('year', { measure: 'total' });
            expect(result).toHaveLength(3);
            expect(result.find(r => r.dimensions.year === '2023')?.value).toBe(300);
            expect(result.find(r => r.dimensions.year === '2024')?.value).toBe(150);
            expect(result.find(r => r.dimensions.year === '__TOTAL__')?.value).toBe(450);
        });
    });

    describe('Drilldown', () => {
        it('should drilldown into dimension', () => {
            const qube = new Qube({
                measures: [{ type: 'sum', key: 'sales', name: 'total' }],
                dimensions: [
                    { type: 'string', key: 'year' },
                    { type: 'string', key: 'product' },
                ],
            });

            qube.push([
                { year: '2023', product: 'A', sales: 100 },
                { year: '2023', product: 'B', sales: 200 },
                { year: '2024', product: 'A', sales: 150 },
            ]);

            const result = qube.drilldown('product', {
                measure: 'total',
                dimensions: { year: '2023' }
            });

            expect(result).toHaveLength(2);
            expect(result.find(r => r.dimensions.product === 'A')?.value).toBe(100);
            expect(result.find(r => r.dimensions.product === 'B')?.value).toBe(200);
        });
    });

    describe('Filter', () => {
        let qube: Qube;

        beforeEach(() => {
            qube = new Qube({
                measures: [
                    { type: 'sum', key: 'amount', name: 'total' },
                    { type: 'count', key: 'amount', name: 'count' },
                ],
                dimensions: [
                    { type: 'string', key: 'status' },
                    { type: 'string', key: 'category' },
                ],
            });

            qube.push([
                { status: 'active', category: 'A', amount: 100 },
                { status: 'active', category: 'B', amount: 200 },
                { status: 'inactive', category: 'A', amount: 50 },
                { status: 'inactive', category: 'B', amount: 75 },
            ]);
        });

        it('should filter by single dimension value', () => {
            const result = qube.filter({ dimensions: { status: 'active' } });
            expect(result).toHaveLength(2);
        });

        it('should filter by multiple dimension values', () => {
            const result = qube.filter({ dimensions: { category: ['A', 'B'] } });
            expect(result).toHaveLength(4);
        });

        it('should filter with predicate', () => {
            const result = qube.filter({
                predicate: (dims, measures) => measures.total > 100
            });
            expect(result).toHaveLength(1);
            expect(result[0].total).toBe(200);
        });
    });

    describe('Clear', () => {
        it('should clear all data', () => {
            const qube = new Qube({
                measures: [{ type: 'sum', key: 'value', name: 'total' }],
                dimensions: [{ type: 'string', key: 'key' }],
            });

            qube.push([{ key: 'A', value: 100 }]);
            expect(qube.one({ measure: 'total' })).toBe(100);
            expect(qube.rowCount).toBe(1);

            qube.clear();
            expect(qube.one({ measure: 'total' })).toBeUndefined();
            expect(qube.rowCount).toBe(0);
        });
    });

    describe('Dimension Info', () => {
        it('should return all dimension info', () => {
            const qube = new Qube({
                measures: [{ type: 'sum', key: 'value', name: 'total' }],
                dimensions: [
                    { type: 'string', key: 'year' },
                    { type: 'string', key: 'product' },
                ],
            });

            qube.push([
                { year: '2023', product: 'A', value: 100 },
                { year: '2023', product: 'B', value: 200 },
                { year: '2024', product: 'A', value: 150 },
            ]);

            const info = qube.getDimensionInfo() as any[];
            expect(info).toHaveLength(2);

            const yearInfo = info.find(i => i.key === 'year');
            expect(yearInfo?.cardinality).toBe(2);
            expect(yearInfo?.values).toContain('2023');
            expect(yearInfo?.values).toContain('2024');
        });

        it('should return single dimension info', () => {
            const qube = new Qube({
                measures: [{ type: 'sum', key: 'value', name: 'total' }],
                dimensions: [{ type: 'string', key: 'year' }],
            });

            qube.push([
                { year: '2023', value: 100 },
                { year: '2024', value: 200 },
            ]);

            const info = qube.getDimensionInfo('year') as any;
            expect(info.key).toBe('year');
            expect(info.cardinality).toBe(2);
        });
    });

    describe('Serialization', () => {
        it('should serialize and deserialize cube', () => {
            const qube = new Qube({
                measures: [
                    { type: 'sum', key: 'value', name: 'total' },
                    { type: 'distinct', key: 'category', name: 'unique_cats' },
                ],
                dimensions: [{ type: 'string', key: 'year' }],
            });

            qube.push([
                { year: '2023', value: 100, category: 'A' },
                { year: '2023', value: 200, category: 'B' },
                { year: '2024', value: 150, category: 'A' },
            ]);

            const serialized = qube.serializeCube();
            const restored = Qube.fromCube(serialized);

            expect(restored.one({ measure: 'total' })).toBe(450);
            expect(restored.one({ measure: 'unique_cats' })).toBe(2);
            expect(restored.rowCount).toBe(3);
        });

        it('should handle JSON stringify/parse cycle', () => {
            const qube = new Qube({
                measures: [{ type: 'sum', key: 'value', name: 'total' }],
                dimensions: [{ type: 'string', key: 'key' }],
            });

            qube.push([{ key: 'A', value: 100 }]);

            const json = JSON.stringify(qube.serializeCube());
            const restored = Qube.fromCube(JSON.parse(json));

            expect(restored.one({ measure: 'total' })).toBe(100);
        });

        it('should compress and decompress (async)', async () => {
            const qube = new Qube({
                measures: [{ type: 'sum', key: 'value', name: 'total' }],
                dimensions: [{ type: 'string', key: 'key' }],
            });

            qube.push([
                { key: 'A', value: 100 },
                { key: 'B', value: 200 },
            ]);

            const compressed = await qube.serializeCompressed();
            const json = JSON.stringify(qube.serializeCube());
            
            // Compressed should be smaller
            expect(compressed.length).toBeLessThan(json.length);
            
            const restored = await Qube.fromCompressed(compressed);
            expect(restored.one({ measure: 'total' })).toBe(300);
            expect(restored.rowCount).toBe(2);
        });

        it('should compress and decompress (sync)', () => {
            const qube = new Qube({
                measures: [{ type: 'sum', key: 'value', name: 'total' }],
                dimensions: [{ type: 'string', key: 'key' }],
            });

            qube.push([
                { key: 'A', value: 100 },
                { key: 'B', value: 200 },
            ]);

            const compressed = qube.serializeCompressedSync();
            const restored = Qube.fromCompressedSync(compressed);
            
            expect(restored.one({ measure: 'total' })).toBe(300);
            expect(restored.rowCount).toBe(2);
        });
    });

    describe('Enumerate Dimension', () => {
        it('should enumerate dimension values', () => {
            const qube = new Qube({
                measures: [{ type: 'sum', key: 'value', name: 'total' }],
                dimensions: [
                    { type: 'string', key: 'year' },
                    { type: 'string', key: 'product' },
                ],
            });

            qube.push([
                { year: '2023', product: 'A', value: 100 },
                { year: '2023', product: 'B', value: 200 },
                { year: '2024', product: 'A', value: 150 },
            ]);

            const years = qube.enumerateDimension('year');
            expect(years).toContain('2023');
            expect(years).toContain('2024');
            expect(years).toHaveLength(2);

            const products = qube.enumerateDimension('product');
            expect(products).toContain('A');
            expect(products).toContain('B');
            expect(products).toHaveLength(2);
        });

        it('should throw for unknown dimension', () => {
            const qube = new Qube({
                measures: [{ type: 'sum', key: 'value', name: 'total' }],
                dimensions: [{ type: 'string', key: 'year' }],
            });

            expect(() => qube.enumerateDimension('unknown')).toThrow("Dimension 'unknown' not found");
        });
    });

    describe('Query With Enumeration', () => {
        it('should query across all values of a dimension', () => {
            const qube = new Qube({
                measures: [{ type: 'sum', key: 'value', name: 'total' }],
                dimensions: [
                    { type: 'string', key: 'year' },
                    { type: 'string', key: 'product' },
                ],
            });

            qube.push([
                { year: '2023', product: 'A', value: 100 },
                { year: '2023', product: 'B', value: 200 },
                { year: '2024', product: 'A', value: 150 },
                { year: '2024', product: 'B', value: 250 },
            ]);

            const result = qube.queryWithEnumeration('year', { measure: 'total' });
            expect(result).toHaveLength(2);
            expect(result.find(r => r.year === '2023')?.value).toBe(300);
            expect(result.find(r => r.year === '2024')?.value).toBe(400);
        });
    });
});
