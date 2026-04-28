import { useEffect, useRef } from 'react';

/**
 * Detects when user presses browser back button
 * Returns callback to run specific logic on back navigation
 */
export function useBackButton(onBackPressed: () => void) {
  const backPressedRef = useRef(false);

  useEffect(() => {
    // Listen for popstate (back/forward button pressed)
    const handlePopState = () => {
      backPressedRef.current = true;
      onBackPressed();
      // Reset flag after callback
      setTimeout(() => {
        backPressedRef.current = false;
      }, 100);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  return backPressedRef;
}

/**
 * Check if this is a back button navigation
 */
export function isBackButtonNavigation(): boolean {
  if (typeof window === 'undefined') return false;
  return (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type === 'back_forward';
}
