import { useEffect, useRef } from 'react';

/**
 * Ensures initialization code runs only ONCE when page is actually loaded/visited
 * Not on every state change or re-render
 * 
 * This properly handles:
 * - Initial page load
 * - Back button navigation (page is shown again)
 * - URL parameter changes (counts as new load)
 * - But NOT on state changes within the component
 */
export function usePageLoad(callback: () => Promise<void> | void, dependencies: any[] = []) {
  const initializedRef = useRef(false);
  const prevDepRef = useRef<any[]>(dependencies);

  useEffect(() => {
    // Check if dependencies changed (means URL/route changed)
    const depsChanged = JSON.stringify(prevDepRef.current) !== JSON.stringify(dependencies);
    
    if (!initializedRef.current || depsChanged) {
      initializedRef.current = true;
      prevDepRef.current = dependencies;
      callback();
    }
  }, [callback, ...dependencies]); // Only depend on actual page-level deps, not component state

  return {
    isInitialized: initializedRef.current,
    reset: () => {
      initializedRef.current = false;
    }
  };
}

/**
 * Similar to usePageLoad but uses a simple mounting flag
 * Best for pages where you only need to initialize once per mount
 */
export function usePageMount(callback: () => Promise<void> | void) {
  const isMountedRef = useRef(false);

  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      callback();
    }
  }, []); // Empty dependency array - only run on mount/unmount

  return isMountedRef;
}
