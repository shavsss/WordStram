import React from 'react';

interface FloatingButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

/**
 * Reusable floating button component with animation effects
 */
export function FloatingButton({ onClick, icon, label }: FloatingButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-transparent border-none cursor-pointer p-0 outline-none transition-transform duration-200 ease-in-out hover:scale-105 active:scale-95"
      aria-label={label}
    >
      <div className="w-20 h-20 flex flex-col items-center justify-center perspective-[800px]">
        <div className="relative w-full h-full transform-style-preserve-3d transition-transform duration-300 ease-in-out hover:rotate-y-[-5deg] hover:rotate-x-[5deg] hover:translate-z-[10px]">
          <div className="absolute w-full h-full rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/60 flex flex-col items-center justify-center border-3 border-white/85">
            {icon}
            <span className="font-sans text-white text-xs font-bold mt-1 text-shadow-sm">
              {label}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
} 