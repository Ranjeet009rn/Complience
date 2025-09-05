import { useEffect, useState } from 'react';

export const useTesseract = (): boolean => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Tesseract.js is loaded via CDN in index.html
    if (typeof window !== 'undefined' && window.Tesseract) {
      setIsReady(true);
    }
  }, []);

  return isReady;
};
