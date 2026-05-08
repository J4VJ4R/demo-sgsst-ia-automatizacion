"use client";

import { useEffect, useState } from "react";

interface CustomLoaderProps {
  isLoading?: boolean;
  className?: string;
  size?: number; // Size of the circle container
}

export function CustomLoader({
  isLoading = true,
  className = "",
  size = 100,
}: CustomLoaderProps) {
  const [show, setShow] = useState(isLoading);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isLoading) {
      const raf = requestAnimationFrame(() => {
        setShow(true);
        setIsVisible(true);
      });
      return () => cancelAnimationFrame(raf);
    }
    const raf = requestAnimationFrame(() => setIsVisible(false));
    const timer = setTimeout(() => setShow(false), 300);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [isLoading]);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/35 transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      } ${className}`}
      data-testid="custom-loader"
    >
      <div
        className="relative flex items-center justify-center rounded-2xl p-[3px] overflow-hidden"
        style={{ width: size, height: size * 0.7 }}
      >
        <div className="absolute inset-[-60%] bg-[conic-gradient(from_0deg,rgba(29,78,216,0)_0deg,rgba(29,78,216,1)_55deg,rgba(34,211,238,1)_110deg,rgba(250,204,21,1)_170deg,rgba(29,78,216,1)_240deg,rgba(29,78,216,0)_360deg)] animate-[spin_1400ms_linear_infinite]" />
        <div className="relative z-10 flex h-full w-full items-center justify-center rounded-[14px] bg-white">
          <div className="relative flex items-center justify-center">
            <svg
              width="88"
              height="88"
              viewBox="0 0 88 88"
              className="energy-loader-bolt"
              role="img"
              aria-label="Cargando"
            >
              <defs>
                <linearGradient id="boltFill" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="rgb(29,78,216)" />
                  <stop offset="0.55" stopColor="rgb(34,211,238)" />
                  <stop offset="1" stopColor="rgb(250,204,21)" />
                </linearGradient>
                <linearGradient id="boltStroke" x1="1" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="rgb(250,204,21)" />
                  <stop offset="0.45" stopColor="rgb(34,211,238)" />
                  <stop offset="1" stopColor="rgb(29,78,216)" />
                </linearGradient>
              </defs>

              <path
                d="M50 6L20 46h22L36 82l32-42H46z"
                fill="url(#boltFill)"
              />
              <path
                d="M50 6L20 46h22L36 82l32-42H46z"
                fill="none"
                stroke="url(#boltStroke)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="energy-loader-stroke"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
