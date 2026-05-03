
export const fuzzyMatch = (query, text) => {
    if (!query) return true;
    if (text === null || text === undefined) return false;
    
    const q = query.toString().toLowerCase().trim();
    const t = text.toString().toLowerCase();
    
    if (t.includes(q)) return true;
    
    let qIdx = 0;
    for (let i = 0; i < t.length; i++) {
        if (t[i] === q[qIdx]) {
            qIdx++;
        }
        if (qIdx === q.length) {
            return true;
        }
    }
    return false;
};

export const fuzzySearch = (query, item, fields) => {
    if (!query || !query.trim()) return true;
    
    return fields.some(field => {
        const parts = field.split('.');
        
        let currentValues = [item];
        
        for (const part of parts) {
            const nextValues = [];
            for (const val of currentValues) {
                if (val && typeof val === 'object') {
                    if (Array.isArray(val[part])) {
                        nextValues.push(...val[part]);
                    } else if (val[part] !== undefined && val[part] !== null) {
                        nextValues.push(val[part]);
                    }
                }
            }
            currentValues = nextValues;
        }
        
        return currentValues.some(val => fuzzyMatch(query, val));
    });
};
