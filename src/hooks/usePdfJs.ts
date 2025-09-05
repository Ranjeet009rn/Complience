import { useEffect, useState } from 'react';

export const usePdfJs = (): boolean => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // PDF.js is loaded via CDN in index.html
    if (typeof window !== 'undefined' && window.pdfjsLib) {
      setIsReady(true);
    }
  }, []);

  return isReady;
};
