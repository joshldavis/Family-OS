import { useState, useEffect, useRef, Dispatch, SetStateAction } from 'react';

function useLocalStorage<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Track the previous key to detect changes and re-read storage instead of overwriting
  const prevKeyRef = useRef<string>(key);

  useEffect(() => {
    if (prevKeyRef.current !== key) {
      // Key changed — read the new key's existing value
      prevKeyRef.current = key;
      try {
        const item = window.localStorage.getItem(key);
        setStoredValue(item !== null ? (JSON.parse(item) as T) : initialValue);
      } catch {
        setStoredValue(initialValue);
      }
      return;
    }
    // Key unchanged — persist the current value
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch {
      // Ignore write errors (e.g. private browsing quota)
    }
  }, [key, storedValue, initialValue]);

  return [storedValue, setStoredValue];
}

export default useLocalStorage;
