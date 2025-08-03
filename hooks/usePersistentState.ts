import { useState, useEffect } from 'react';

/**
 * A custom hook that uses useState and syncs with localStorage.
 * @param key The key to use in localStorage.
 * @param defaultValue The default value to use if nothing is in localStorage.
 */
function usePersistentState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [state, setState] = useState<T>(() => {
        try {
            const storedValue = window.localStorage.getItem(key);
            // We explicitly check for null. If the key doesn't exist, getItem returns null.
            // This ensures that stored values like '[], '{}', 'false', or '0' are all correctly
            // parsed and not treated as falsy, which would incorrectly fall back to the defaultValue.
            if (storedValue !== null) {
                return JSON.parse(storedValue);
            }
            return defaultValue;
        } catch (error) {
            console.error(`Error reading or parsing localStorage key "${key}":`, error);
            return defaultValue;
        }
    });

    useEffect(() => {
        try {
            const serializedState = JSON.stringify(state);
            window.localStorage.setItem(key, serializedState);
        } catch (error) {
            console.error(`Error writing to localStorage key "${key}":`, error);
        }
    }, [key, state]);

    return [state, setState];
}

export default usePersistentState;