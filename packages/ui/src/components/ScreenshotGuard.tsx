'use client'
import React, { useState, useEffect, ReactNode } from 'react';

interface ScreenshotGuardProps {
  children: ReactNode;
  blurAmount?: string;     // e.g. "10px"
  blurDurationMs?: number; // e.g. 2000
}

const ScreenshotGuard: React.FC<ScreenshotGuardProps> = ({
  children,
  blurAmount = '10px',
  blurDurationMs = 2000,
}) => {
  const [isBlurred, setIsBlurred] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const triggerBlur = () => {
      if (isBlurred) return;
      setIsBlurred(true);
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setIsBlurred(false), blurDurationMs);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // ANY Command+Shift or Ctrl+Shift combo
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        triggerBlur();
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        triggerBlur();
      }
    };

    const onWindowBlur = () => {
      triggerBlur();
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
      clearTimeout(timeoutId);
    };
  }, [isBlurred, blurDurationMs]);

  return (
    <div
      style={{
        filter: isBlurred ? `blur(${blurAmount})` : 'none',
        transition: 'filter 150ms ease-out',
      }}
    >
      {/* <h1>Please refresh</h1> */}
      {children}
    </div>
  );
};

export default ScreenshotGuard;

