
// HydridLookup allows you to retain a list of items and
// look them up either via index or via string
export class HybridLookup<T>
{
    private m_data: T[] = [];
    private m_indexMap: Map<string, number> = new Map<string, number>();

    add(key: string, item: T): T
    {
        this.m_data.push(item);
        this.m_indexMap.set(key, this.m_data.length - 1);
        return item;
    }

    getFromKey(key: string): T
    {
        const index = this.m_indexMap.get(key);

        if (index === undefined)
            throw Error(`HybridLookup::getFromKey() - key '${key}' was not found`);

        return this.m_data[index];
    }

    getFromIndex(index: number): T
    {
        return this.m_data[index];
    }

    containsKey(key: string): boolean
    {
        return this.m_indexMap.has(key);
    }

    indexOfKey(key: string): number
    {
        const index = this.m_indexMap.get(key);
        if (index === undefined)
            throw Error(`HybridLookup::indexOfKey() - key '${key}' was not found`);
        return index;
    }

    updateFromKey(key: string, newItem: T): T
    {
        this.m_data[this.indexOfKey(key)] = newItem;
        return newItem;
    }

    updateFromIndex(index: number, newItem: T): T
    {
        this.m_data[index] = newItem;
        return newItem;
    }

    removeFromKey(key: string): void
    {
        let index = this.indexOfKey(key);
        this.m_indexMap.delete(key);
        this.m_data.splice(index, 1);
        this.decrementIndexForKeys(index);
    }

    removeFromIndex(index: number): void
    {
        this.m_indexMap.delete(this.findKeyFromIndex(index));
        this.m_data.splice(index, 1);
        this.decrementIndexForKeys(index);
    }

    private decrementIndexForKeys(startIndex: number)
    {
        for (const [key, val] of this.m_indexMap)
        {
            if (val >= startIndex)
                this.m_indexMap.set(key, val - 1);
        }
    }

    private findKeyFromIndex(index: number): string
    {
        for (const [key, val] of this.m_indexMap)
        {
            if (val === index)
            {
                return key;
            }
        }
        throw Error(`HybridLookup::findKeyFromIndex() - key with value '${index}' was not found`);
    }

    removeIf(predicate: (value: T, index: number, key: string) => boolean): void
    {
        // Loop over the data in reverse and remove if the predicate evaluates to true
        for (let iii = this.m_data.length - 1; iii >= 0; --iii)
        {
            let key = this.findKeyFromIndex(iii);

            if (predicate(this.m_data[iii], iii, key))
            {
                this.m_data.splice(iii, 1);
                this.m_indexMap.delete(key);
                this.decrementIndexForKeys(iii);
            }
        }
    }

    filter(predicate: (value: T, index: number, key: string) => boolean): T[]
    {
        let results: T[] = [];
        for (let iii = 0; iii < this.m_data.length; ++iii)
        {
            let key = this.findKeyFromIndex(iii);

            if (predicate(this.m_data[iii], iii, key))
                results.push(this.m_data[iii]);         
        }
        return results;
    }

    clear(): void
    {
        this.m_data.length = 0;
        this.m_indexMap.clear();
    }

    size(): number
    {
        return this.m_data.length;
    }



    toString(): string
    {
        let s: string = "[";
        for (let iii = 0; iii < this.m_data.length; ++iii)
            s += `(${iii}|${this.findKeyFromIndex(iii)}):${this.m_data[iii]}, `;
        s += "]";
        return s;
    }
}