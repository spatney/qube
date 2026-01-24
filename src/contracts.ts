export type MeasureType = 'sum' | 'count' | 'min' | 'max' | 'average' | 'first' | 'last' | 'distinct' | 'variance' | 'stddev';

export interface MeasureDefinition {
    type: MeasureType;
    key: string;
    name: string;
}

export interface AverageResult {
    sum: number;
    count: number;
}

export interface VarianceResult {
    sum: number;
    sumOfSquares: number;
    count: number;
}

export interface DistinctResult {
    values: Set<any>;
}

export interface DimensionDefinition {
    type: 'string' | 'number' | 'date';
    key: string;
}

export interface QubeOptions {
    measures: MeasureDefinition[];
    dimensions: DimensionDefinition[];
}

export interface QueryOptions {
    measure: string;
    dimensions?: { [key: string]: any };
}

export interface FilterOptions {
    dimensions?: { [key: string]: any | any[] };
    predicate?: (dimensions: { [key: string]: any }, measures: { [key: string]: any }) => boolean;
}

export interface RollupResult {
    dimensions: { [key: string]: any };
    value: number | undefined;
}

export interface InMemoryQubeData {
    [key: string]: InMemoryQubeData | any;
}

export interface SerializedQube {
    options: QubeOptions;
    dimensionIndices: string[];
    cube: InMemoryQubeData;
    rowCount: number;
}

export interface QubeRow {
    [key: string]: any;
}

export interface DimensionInfo {
    key: string;
    type: string;
    cardinality: number;
    values: any[];
}