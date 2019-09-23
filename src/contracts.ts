export interface MeasureDefinition {
    type: 'sum' | 'count' | 'min' | 'max';
    key: string;
    name: string;
}

export interface DimensionDefinition {
    type: 'string'
    key: string;
}

export interface QubeOptions {
    measures: MeasureDefinition[];
    dimensions: DimensionDefinition[];
}

export interface QueryOptions {
    measure: string;
    dimensions?: { [key: string]: string }
}

export interface InMemoryQubeData {
    [key: string]: InMemoryQubeData | number
}

export interface SerializedQube {
    options: QubeOptions,
    dimensionIndices: string[],
    cube: InMemoryQubeData
}

export interface QubeRow {
    [key: string] : any;
}