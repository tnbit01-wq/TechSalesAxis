'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Handles CSS and state refresh on back button navigation
 * Uses Next.js 13+ router.refresh() for proper cache invalidation
 */
export default function CSSReloadOnNavigation() {
  const router = useRouter();

  useEffect(() => {
    let isNavigating = false;

    // Handle back/forward button with router.refresh()
    const handlePopState = () => {
      if (isNavigating) return;
      isNavigating = true;

      // Use router.refresh() to re-fetch and re-render
      // This ensures CSS from server is properly applied
      router.refresh();

      // Reset flag after refresh
      setTimeout(() => {
        isNavigating = false;
      }, 500);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [router]);

  return null;
}
