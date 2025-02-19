

// HydridLookup allows you to retain a list of items and
// look them up either via index or via string
export class HybridLookup<T>
{
    private data: T[] = [];
    private indexMap: { [key: string]: number } = {};

    add(key: string, item: T): void
    {
        this.data.push(item);
        this.indexMap[key] = this.data.length - 1;        
    }

    get(indexOrKey: number | string): T
    {
        if (typeof indexOrKey === 'number')
        {
            return this.data[indexOrKey];
        }
        else if (typeof indexOrKey === 'string')
        {
            const index = this.indexMap[indexOrKey];

            if (index === undefined)
                throw Error(`HybridLookup::get() - key '${indexOrKey}' was not found`);

            return this.data[index];
        }
        throw Error(`HybridLookup::get() - the indexOrKey parameter was not a number or a string: ${indexOrKey}`);
    }

    indexOf(key: string): number
    {
        const index = this.indexMap[key];
        if (index === undefined)
            throw Error(`HybridLookup::indexOf() - key '${key}' was not found`);
        return index;
    }

    update(indexOrKey: number | string, newItem: T): void
    {
        if (typeof indexOrKey === 'number')
        {
            if (indexOrKey >= 0 && indexOrKey < this.data.length)
            {
                this.data[indexOrKey] = newItem;
            }
        }
        else if (typeof indexOrKey === 'string')
        {
            const index = this.indexMap[indexOrKey];
            if (index !== undefined)
            {
                this.data[index] = newItem
            }
        }
    }

    remove(indexOrKey: number | string): void
    {
        if (typeof indexOrKey === 'number')
        {
            if (indexOrKey >= 0 && indexOrKey < this.data.length)
            {
                this.data.splice(indexOrKey, 1);
                this.rebuildIndexMap();
            }
        }
        else if (typeof indexOrKey === 'string')
        {
            const index = this.indexMap[indexOrKey];
            if (index !== undefined)
            {
                delete this.indexMap[indexOrKey];
                this.data.splice(index, 1);
                this.rebuildIndexMap();
            }
        }
    }

    clear(): void
    {
        this.data.length = 0;
        this.indexMap = {};
    }

    private rebuildIndexMap(): void
    {
        this.indexMap = {};
        for (let i = 0; i < this.data.length; i++)
        {
            const item = this.data[i] as any;
            if (item && item.key && typeof item.key === 'string')
            {
                this.indexMap[item.key] = i;
            }
        }
    }

    size(): number
    {
        return this.data.length;
    }
}