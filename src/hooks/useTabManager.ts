import { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'service_operations_tracker_active_tab';

/**
 * useTabManager — Prevents multiple tabs from polling/interacting simultaneously.
 * Uses localStorage storage events (fires in all other tabs reliably across all
 * browsers including Safari, unlike BroadcastChannel which has Safari quirks).
 */
export function useTabManager() {
  const [isDuplicateTab, setIsDuplicateTab] = useState(false);
  const tabId = useRef(`tab_${Date.now()}_${Math.random().toString(36).substring(7)}`);

  useEffect(() => {
    const myId = tabId.current;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue && event.newValue !== myId) {
        // A different tab just claimed primary — we yield
        setIsDuplicateTab(true);
      }
    };

    window.addEventListener('storage', handleStorage);

    // Claim primary — this fires a storage event in every other open tab
    localStorage.setItem(STORAGE_KEY, myId);

    return () => {
      window.removeEventListener('storage', handleStorage);
      // Only clear the flag if we're still the primary tab
      if (localStorage.getItem(STORAGE_KEY) === myId) {
        localStorage.removeItem(STORAGE_KEY);
      }
    };
  }, []);

  const reactivate = useCallback(() => {
    setIsDuplicateTab(false);
    // Re-claim primary — triggers storage event in the other tab, making it yield
    localStorage.setItem(STORAGE_KEY, tabId.current);
  }, []);

  return { isDuplicateTab, reactivate };
}
