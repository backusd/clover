import { LOG_ERROR } from "./log.js";
// HydridLookup allows you to retain a list of items and
// look them up either via index or via string
export class HybridLookup {
    m_data = [];
    m_indexMap = new Map();
    add(key, item) {
        if (this.containsKey(key))
            throw Error(`HybridLookup::add(): Cannot add '${key}' with value '${item}' because the key already exists`);
        this.m_data.push(item);
        this.m_indexMap.set(key, this.m_data.length - 1);
        return item;
    }
    getFromKey(key) {
        const index = this.m_indexMap.get(key);
        if (index === undefined)
            throw Error(`HybridLookup::getFromKey() - key '${key}' was not found`);
        return this.m_data[index];
    }
    getFromIndex(index) {
        if (index < 0 || index >= this.m_data.length)
            throw Error(`HybridLookup::getFromIndex(): Cannot get index '${index}' because the data array only has '${this.m_data.length}' elements`);
        return this.m_data[index];
    }
    containsKey(key) {
        return this.m_indexMap.has(key);
    }
    indexOfKey(key) {
        const index = this.m_indexMap.get(key);
        if (index === undefined)
            throw Error(`HybridLookup::indexOfKey() - key '${key}' was not found`);
        return index;
    }
    updateFromKey(key, newItem) {
        // If it doesn't contain the key, then just call add()
        if (!this.containsKey(key)) {
            this.add(key, newItem);
            return newItem;
        }
        this.m_data[this.indexOfKey(key)] = newItem;
        return newItem;
    }
    updateFromIndex(index, newItem) {
        if (index < 0 || index >= this.m_data.length)
            throw Error(`HybridLookup::updateFromIndex(): Cannot update value at index '${index}' because the data array only has '${this.m_data.length}' elements`);
        this.m_data[index] = newItem;
        return newItem;
    }
    removeFromKey(key) {
        if (!this.containsKey(key))
            throw Error(`HybridLookup::removeFromKey(): Cannot remove value with key '${key}' because the key does not exist`);
        let index = this.indexOfKey(key);
        this.m_indexMap.delete(key);
        this.m_data.splice(index, 1);
        this.decrementIndexForKeys(index);
    }
    removeFromIndex(index) {
        if (index < 0 || index >= this.m_data.length)
            throw Error(`HybridLookup::removeFromIndex(): Cannot remove value at index '${index}' because the data array only has '${this.m_data.length}' elements`);
        this.m_indexMap.delete(this.findKeyFromIndex(index));
        this.m_data.splice(index, 1);
        this.decrementIndexForKeys(index);
    }
    decrementIndexForKeys(startIndex) {
        for (const [key, val] of this.m_indexMap) {
            if (val >= startIndex)
                this.m_indexMap.set(key, val - 1);
        }
    }
    findKeyFromIndex(index) {
        for (const [key, val] of this.m_indexMap) {
            if (val === index) {
                return key;
            }
        }
        throw Error(`HybridLookup::findKeyFromIndex() - key with value '${index}' was not found`);
    }
    removeIf(predicate) {
        // Loop over the data in reverse and remove if the predicate evaluates to true
        for (let iii = this.m_data.length - 1; iii >= 0; --iii) {
            let key = this.findKeyFromIndex(iii);
            if (predicate(this.m_data[iii], iii, key)) {
                this.m_data.splice(iii, 1);
                this.m_indexMap.delete(key);
                this.decrementIndexForKeys(iii);
            }
        }
    }
    filter(predicate) {
        let results = [];
        for (let iii = 0; iii < this.m_data.length; ++iii) {
            let key = this.findKeyFromIndex(iii);
            if (predicate(this.m_data[iii], iii, key))
                results.push(this.m_data[iii]);
        }
        return results;
    }
    clear() {
        this.m_data.length = 0;
        this.m_indexMap.clear();
    }
    size() {
        return this.m_data.length;
    }
    toString() {
        let s = "[";
        for (let iii = 0; iii < this.m_data.length; ++iii)
            s += `(${iii}|${this.findKeyFromIndex(iii)}):${this.m_data[iii]}, `;
        s += "]";
        return s;
    }
}
export class Token {
    constructor(val, t) {
        this.value = val;
        this.m_t = t;
    }
    value = "";
    // This private member is necessary to ensure that tokens of 
    // different types do not implement the same interface. Without
    // this, we can pass any token of type Token<A> to any function
    // expecting Token<B>, which is what we are trying to disallow
    // by creating tokens in the first place.
    m_t;
}
export class CallbackSet {
    constructor() {
        this.m_callbacks = new HybridLookup();
        this.m_count = 0;
    }
    Register(callback) {
        // Generate a unique lookup token by converting the m_count to a string,
        // add the callback, and then return the token
        let token = this.m_count.toString();
        this.m_count++;
        this.m_callbacks.add(token, callback);
        return new Token(token, callback);
    }
    Revoke(token) {
        // START_DEBUG_ONLY
        if (!this.m_callbacks.containsKey(token.value)) {
            let msg = `CallbackSet does not contain token '${token.value}'`;
            LOG_ERROR(msg);
            throw new Error(msg);
        }
        // END_DEBUG_ONLY
        this.m_callbacks.removeFromKey(token.value);
    }
    Invoke(...args) {
        for (let iii = 0; iii < this.m_callbacks.size(); ++iii)
            this.m_callbacks.getFromIndex(iii)(...args);
    }
    m_callbacks;
    m_count;
}
//# sourceMappingURL=utils.js.map