import { describe, it, expect, beforeAll } from 'vitest';
import { Qube } from './index';

function formatNumber(n: number): string {
    return new Intl.NumberFormat('en-US').format(n);
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function roughSizeOf(obj: any): number {
    const seen = new WeakSet();
    function sizeOf(o: any): number {
        if (o === null || o === undefined) return 0;
        if (typeof o === 'boolean') return 4;
        if (typeof o === 'number') return 8;
        if (typeof o === 'string') return o.length * 2;
        if (typeof o !== 'object') return 0;
        if (seen.has(o)) return 0;
        seen.add(o);
        
        let size = 0;
        if (Array.isArray(o)) {
            for (const item of o) size += sizeOf(item);
        } else if (o instanceof Set) {
            for (const item of o) size += sizeOf(item);
        } else {
            for (const key in o) {
                if (Object.hasOwn(o, key)) {
                    size += key.length * 2;
                    size += sizeOf(o[key]);
                }
            }
        }
        return size;
    }
    return sizeOf(obj);
}

function generateRow(dimensions: string[][], measureKeys: string[]): Record<string, any> {
    const row: Record<string, any> = {};
    dimensions.forEach((values, i) => {
        row[`dim${i}`] = values[Math.floor(Math.random() * values.length)];
    });
    measureKeys.forEach(key => {
        row[key] = Math.floor(Math.random() * 1000) + 1;
    });
    return row;
}

describe('Performance Tests', () => {
    describe('Large Volume - 3 Dimensions', () => {
        const ROW_COUNT = 100_000;
        let qube: Qube;
        let loadTimeMs: number;
        let memoryBytes: number;

        beforeAll(() => {
            const dimensions = [
                Array.from({ length: 100 }, (_, i) => `year_${2000 + i}`),
                Array.from({ length: 50 }, (_, i) => `region_${i}`),
                Array.from({ length: 200 }, (_, i) => `product_${i}`),
            ];

            qube = new Qube({
                measures: [
                    { type: 'sum', key: 'revenue', name: 'total_revenue' },
                    { type: 'count', key: 'revenue', name: 'count' },
                    { type: 'average', key: 'revenue', name: 'avg_revenue' },
                    { type: 'min', key: 'revenue', name: 'min_revenue' },
                    { type: 'max', key: 'revenue', name: 'max_revenue' },
                ],
                dimensions: [
                    { type: 'string', key: 'dim0' },
                    { type: 'string', key: 'dim1' },
                    { type: 'string', key: 'dim2' },
                ],
            });

            const rows = Array.from({ length: ROW_COUNT }, () => 
                generateRow(dimensions, ['revenue'])
            );

            const start = performance.now();
            qube.push(rows);
            loadTimeMs = performance.now() - start;
            memoryBytes = roughSizeOf(qube);

            console.log('\n📊 3D Cube Performance (100K rows):');
            console.log(`   Rows loaded: ${formatNumber(ROW_COUNT)}`);
            console.log(`   Load time: ${loadTimeMs.toFixed(2)} ms`);
            console.log(`   Throughput: ${formatNumber(Math.round(ROW_COUNT / (loadTimeMs / 1000)))} rows/sec`);
            console.log(`   Memory: ~${formatBytes(memoryBytes)}`);
        });

        it('should load 100K rows in under 500ms', () => {
            expect(loadTimeMs).toBeLessThan(500);
        });

        it('should query total in under 50ms', () => {
            const start = performance.now();
            const result = qube.one({ measure: 'total_revenue' });
            const elapsed = performance.now() - start;
            console.log(`   one() query: ${elapsed.toFixed(2)} ms, result: ${formatNumber(result!)}`);
            expect(elapsed).toBeLessThan(50);
            expect(result).toBeGreaterThan(0);
        });

        it('should slice in under 50ms', () => {
            const start = performance.now();
            const result = qube.slice({ 
                measure: 'total_revenue', 
                dimensions: { dim0: 'year_2050' } 
            });
            const elapsed = performance.now() - start;
            console.log(`   slice() query: ${elapsed.toFixed(2)} ms`);
            expect(elapsed).toBeLessThan(50);
        });

        it('should dice in under 5ms', () => {
            const start = performance.now();
            const result = qube.dice({ 
                measure: 'total_revenue', 
                dimensions: { dim0: 'year_2050', dim1: 'region_25', dim2: 'product_100' } 
            });
            const elapsed = performance.now() - start;
            console.log(`   dice() query: ${elapsed.toFixed(2)} ms`);
            expect(elapsed).toBeLessThan(5);
        });

        it('should enumerate dimension in under 50ms', () => {
            const start = performance.now();
            const values = qube.enumerateDimension('dim0');
            const elapsed = performance.now() - start;
            console.log(`   enumerateDimension(): ${elapsed.toFixed(2)} ms, ${values.length} unique values`);
            expect(elapsed).toBeLessThan(50);
        });

        it('should rollup in under 100ms', () => {
            const start = performance.now();
            const result = qube.rollup('dim0', { measure: 'total_revenue' });
            const elapsed = performance.now() - start;
            console.log(`   rollup(): ${elapsed.toFixed(2)} ms, ${result.length} groups`);
            expect(elapsed).toBeLessThan(100);
        });
    });

    describe('Large Volume - 5 Dimensions (Hypercube)', () => {
        const ROW_COUNT = 100_000;
        let qube: Qube;
        let loadTimeMs: number;

        beforeAll(() => {
            const dimensions = [
                Array.from({ length: 10 }, (_, i) => `year_${2015 + i}`),
                Array.from({ length: 4 }, (_, i) => `Q${i + 1}`),
                Array.from({ length: 20 }, (_, i) => `region_${i}`),
                Array.from({ length: 50 }, (_, i) => `product_${i}`),
                Array.from({ length: 5 }, (_, i) => `channel_${i}`),
            ];

            qube = new Qube({
                measures: [
                    { type: 'sum', key: 'revenue', name: 'total_revenue' },
                    { type: 'count', key: 'revenue', name: 'count' },
                    { type: 'distinct', key: 'customer', name: 'unique_customers' },
                ],
                dimensions: [
                    { type: 'string', key: 'dim0' },
                    { type: 'string', key: 'dim1' },
                    { type: 'string', key: 'dim2' },
                    { type: 'string', key: 'dim3' },
                    { type: 'string', key: 'dim4' },
                ],
            });

            const rows = Array.from({ length: ROW_COUNT }, (_, i) => ({
                ...generateRow(dimensions, ['revenue']),
                customer: `customer_${i % 10000}`,
            }));

            const start = performance.now();
            qube.push(rows);
            loadTimeMs = performance.now() - start;

            console.log('\n📊 5D Hypercube Performance (100K rows):');
            console.log(`   Rows loaded: ${formatNumber(ROW_COUNT)}`);
            console.log(`   Load time: ${loadTimeMs.toFixed(2)} ms`);
            console.log(`   Throughput: ${formatNumber(Math.round(ROW_COUNT / (loadTimeMs / 1000)))} rows/sec`);
            console.log(`   Memory: ~${formatBytes(roughSizeOf(qube))}`);
        });

        it('should load 100K rows into 5D cube in under 1000ms', () => {
            expect(loadTimeMs).toBeLessThan(1000);
        });

        it('should query with 2 dimensions specified', () => {
            const start = performance.now();
            const result = qube.query({ 
                measure: 'total_revenue', 
                dimensions: { dim0: 'year_2020', dim2: 'region_10' } 
            });
            const elapsed = performance.now() - start;
            console.log(`   query(2 dims): ${elapsed.toFixed(2)} ms`);
            expect(elapsed).toBeLessThan(50);
        });

        it('should count distinct values', () => {
            const start = performance.now();
            const result = qube.one({ measure: 'unique_customers' });
            const elapsed = performance.now() - start;
            console.log(`   distinct count: ${elapsed.toFixed(2)} ms, ${formatNumber(result!)} unique customers`);
            expect(elapsed).toBeLessThan(100);
            expect(result).toBeLessThan(10001);
        });
    });

    describe('Very Large Volume - 1 Million Rows', () => {
        const ROW_COUNT = 1_000_000;
        let qube: Qube;
        let loadTimeMs: number;

        beforeAll(() => {
            const dimensions = [
                Array.from({ length: 20 }, (_, i) => `year_${2005 + i}`),
                Array.from({ length: 100 }, (_, i) => `store_${i}`),
                Array.from({ length: 500 }, (_, i) => `sku_${i}`),
            ];

            qube = new Qube({
                measures: [
                    { type: 'sum', key: 'quantity', name: 'total_qty' },
                    { type: 'sum', key: 'revenue', name: 'total_revenue' },
                    { type: 'count', key: 'revenue', name: 'transactions' },
                ],
                dimensions: [
                    { type: 'string', key: 'dim0' },
                    { type: 'string', key: 'dim1' },
                    { type: 'string', key: 'dim2' },
                ],
            });

            const rows = Array.from({ length: ROW_COUNT }, () => 
                generateRow(dimensions, ['quantity', 'revenue'])
            );

            const start = performance.now();
            qube.push(rows);
            loadTimeMs = performance.now() - start;

            console.log('\n📊 1 Million Rows Performance:');
            console.log(`   Rows loaded: ${formatNumber(ROW_COUNT)}`);
            console.log(`   Load time: ${loadTimeMs.toFixed(2)} ms (${(loadTimeMs / 1000).toFixed(2)} sec)`);
            console.log(`   Throughput: ${formatNumber(Math.round(ROW_COUNT / (loadTimeMs / 1000)))} rows/sec`);
            console.log(`   Memory: ~${formatBytes(roughSizeOf(qube))}`);
        });

        it('should load 1M rows in under 5 seconds', () => {
            expect(loadTimeMs).toBeLessThan(5000);
        });

        it('should query total in under 200ms', () => {
            const start = performance.now();
            const result = qube.one({ measure: 'total_revenue' });
            const elapsed = performance.now() - start;
            console.log(`   one() query: ${elapsed.toFixed(2)} ms, total revenue: ${formatNumber(result!)}`);
            expect(elapsed).toBeLessThan(200);
        });

        it('should slice single dimension in under 200ms', () => {
            const start = performance.now();
            const result = qube.slice({ 
                measure: 'total_revenue', 
                dimensions: { dim0: 'year_2020' } 
            });
            const elapsed = performance.now() - start;
            console.log(`   slice(1 dim): ${elapsed.toFixed(2)} ms`);
            expect(elapsed).toBeLessThan(200);
        });

        it('should dice in under 10ms', () => {
            const start = performance.now();
            const result = qube.dice({ 
                measure: 'total_revenue', 
                dimensions: { dim0: 'year_2020', dim1: 'store_50', dim2: 'sku_250' } 
            });
            const elapsed = performance.now() - start;
            console.log(`   dice(): ${elapsed.toFixed(2)} ms`);
            expect(elapsed).toBeLessThan(10);
        });

        it('should get dimension info in under 500ms', () => {
            const start = performance.now();
            const info = qube.getDimensionInfo() as any[];
            const elapsed = performance.now() - start;
            console.log(`   getDimensionInfo(): ${elapsed.toFixed(2)} ms`);
            info.forEach(d => console.log(`     ${d.key}: ${d.cardinality} unique values`));
            expect(elapsed).toBeLessThan(500);
        });
    });

    describe('High Cardinality Stress Test', () => {
        const ROW_COUNT = 100_000;
        let qube: Qube;

        beforeAll(() => {
            qube = new Qube({
                measures: [
                    { type: 'sum', key: 'amount', name: 'total' },
                    { type: 'count', key: 'amount', name: 'count' },
                ],
                dimensions: [
                    { type: 'string', key: 'timestamp' },
                    { type: 'string', key: 'user_id' },
                ],
            });

            // High cardinality: unique timestamps, 10K unique users
            const rows = Array.from({ length: ROW_COUNT }, (_, i) => ({
                timestamp: `2024-01-01T${String(Math.floor(i / 3600)).padStart(2, '0')}:${String(Math.floor((i % 3600) / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`,
                user_id: `user_${i % 10000}`,
                amount: Math.random() * 100,
            }));

            const start = performance.now();
            qube.push(rows);
            const loadTime = performance.now() - start;

            console.log('\n📊 High Cardinality Test (100K unique timestamps):');
            console.log(`   Load time: ${loadTime.toFixed(2)} ms`);
            console.log(`   Memory: ~${formatBytes(roughSizeOf(qube))}`);
        });

        it('should handle high cardinality dimensions', () => {
            const info = qube.getDimensionInfo('timestamp') as any;
            console.log(`   Timestamp cardinality: ${formatNumber(info.cardinality)}`);
            expect(info.cardinality).toBeGreaterThan(10000);
        });

        it('should still query efficiently', () => {
            const start = performance.now();
            const result = qube.one({ measure: 'total' });
            const elapsed = performance.now() - start;
            console.log(`   one() with high cardinality: ${elapsed.toFixed(2)} ms`);
            expect(elapsed).toBeLessThan(500);
        });
    });

    describe('Serialization Performance', () => {
        const ROW_COUNT = 100_000;
        let qube: Qube;

        beforeAll(() => {
            const dimensions = [
                Array.from({ length: 50 }, (_, i) => `cat_${i}`),
                Array.from({ length: 100 }, (_, i) => `sub_${i}`),
            ];

            qube = new Qube({
                measures: [
                    { type: 'sum', key: 'value', name: 'total' },
                    { type: 'distinct', key: 'tag', name: 'unique_tags' },
                ],
                dimensions: [
                    { type: 'string', key: 'category' },
                    { type: 'string', key: 'subcategory' },
                ],
            });

            const rows = Array.from({ length: ROW_COUNT }, (_, i) => ({
                category: dimensions[0][i % 50],
                subcategory: dimensions[1][i % 100],
                value: Math.random() * 1000,
                tag: `tag_${i % 500}`,
            }));

            qube.push(rows);
        });

        it('should serialize quickly', () => {
            const start = performance.now();
            const serialized = qube.serializeCube();
            const serializeTime = performance.now() - start;
            
            const jsonStart = performance.now();
            const json = JSON.stringify(serialized);
            const jsonTime = performance.now() - jsonStart;

            console.log('\n📊 Serialization Performance:');
            console.log(`   serializeCube(): ${serializeTime.toFixed(2)} ms`);
            console.log(`   JSON.stringify(): ${jsonTime.toFixed(2)} ms`);
            console.log(`   JSON size: ${formatBytes(json.length)}`);
            
            expect(serializeTime).toBeLessThan(100);
        });

        it('should deserialize quickly', () => {
            const serialized = qube.serializeCube();
            const json = JSON.stringify(serialized);
            
            const parseStart = performance.now();
            const parsed = JSON.parse(json);
            const parseTime = performance.now() - parseStart;
            
            const restoreStart = performance.now();
            const restored = Qube.fromCube(parsed);
            const restoreTime = performance.now() - restoreStart;

            console.log(`   JSON.parse(): ${parseTime.toFixed(2)} ms`);
            console.log(`   Qube.fromCube(): ${restoreTime.toFixed(2)} ms`);
            
            expect(restored.one({ measure: 'total' })).toBe(qube.one({ measure: 'total' }));
            expect(restoreTime).toBeLessThan(100);
        });

        it('should compress efficiently', async () => {
            const json = JSON.stringify(qube.serializeCube());
            
            const compressStart = performance.now();
            const compressed = await qube.serializeCompressed();
            const compressTime = performance.now() - compressStart;
            
            const decompressStart = performance.now();
            const restored = await Qube.fromCompressed(compressed);
            const decompressTime = performance.now() - decompressStart;

            const ratio = (1 - compressed.length / json.length) * 100;

            console.log(`\n📊 Compression Performance:`);
            console.log(`   Uncompressed: ${formatBytes(json.length)}`);
            console.log(`   Compressed: ${formatBytes(compressed.length)} (${ratio.toFixed(1)}% smaller)`);
            console.log(`   Compress time: ${compressTime.toFixed(2)} ms`);
            console.log(`   Decompress time: ${decompressTime.toFixed(2)} ms`);
            
            expect(compressed.length).toBeLessThan(json.length);
            expect(restored.one({ measure: 'total' })).toBe(qube.one({ measure: 'total' }));
        });
    });
});
