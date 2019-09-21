class Qube {
    constructor(options) {
        this.options = options;
        this.storage = 'in-memory'; // more to come
        this.dimIndex = [
            options.dimensions[0].key,
            options.dimensions[1].key,
            options.dimensions[2].key
        ];

        this.cube = {};
        this.oneValue = 0;
    }

    push(rows) {
        if (!Array.isArray(rows)) {
            console.log('Rows must be an object array');
            return;
        }

        for (let row of rows) {
            this.aggregateRow(row);
        }
    }

    aggregateRow(row) {
        const dim1 = row[this.dimIndex[0]];
        const dim2 = row[this.dimIndex[1]];
        const dim3 = row[this.dimIndex[2]];
        const val1 = row['sales'];

        const cube = this.cube;
        cube[dim1] = cube[dim1] || {};
        cube[dim1][dim2] = cube[dim1][dim2] || {};

        cube[dim1][dim2][dim3] = cube[dim1][dim2][dim3] != null
            ? cube[dim1][dim2][dim3] + val1
            : val1;

        this.oneValue += val1;
    }

    slice(opts) {
        const dims = opts.dimensions;
        const dimKeys = Object.keys(dims);
        const dim1Index = this.dimIndex.findIndex(d => d === dimKeys[0]);
        const dim2Index = this.dimIndex.findIndex(d => d === dimKeys[1]);

        let result;

        let iKeys = Object.keys(this.cube) || [];

        if (dim1Index === 0)
            iKeys = [dims[this.dimIndex[dim1Index]]].filter(x => iKeys.includes(x));
        else if (dim2Index === 0)
            iKeys = [dims[this.dimIndex[dim2Index]]].filter(x => iKeys.includes(x));

        for (let i = 0; i < iKeys.length; i++) {
            let fKeys = Object.keys(this.cube[iKeys[i]] || {}) || [];
            if (dim1Index === 1)
                fKeys = [dims[this.dimIndex[dim1Index]]].filter(x => fKeys.includes(x));
            else if (dim2Index === 1)
                fKeys = [dims[this.dimIndex[dim2Index]]].filter(x => fKeys.includes(x));

            for (let f = 0; f < fKeys.length; f++) {
                let kKeys = Object.keys(this.cube[iKeys[i]][fKeys[f]] || {}) || [];
                if (dim1Index === 2)
                    kKeys = [dims[this.dimIndex[dim1Index]]].filter(x => kKeys.includes(x));
                else if (dim2Index === 2)
                    kKeys = [dims[this.dimIndex[dim2Index]]].filter(x => kKeys.includes(x));

                for (let k = 0; k < kKeys.length; k++) {
                    if(result === undefined) {
                        result = 0;
                    }
                    result += this.cube[iKeys[i]][fKeys[f]][kKeys[k]];
                }
            }
        }

        return result;
    }

    dice(opts) {
        const dims = opts.dimensions;

        const dim1 = dims[this.dimIndex[0]];
        const dim2 = dims[this.dimIndex[1]];
        const dim3 = dims[this.dimIndex[2]];

        const cube = this.cube;
        if (cube[dim1] && cube[dim1][dim2] && (cube[dim1][dim2][dim3] != null)) {
            return cube[dim1][dim2][dim3]
        }

        return undefined;
    }

    one() {
        return this.oneValue;
    }
}

module.exports = Qube;