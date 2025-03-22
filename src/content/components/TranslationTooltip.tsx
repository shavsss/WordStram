import React from 'react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface TranslationTooltipProps {
  word: string;
  translation: string;
  position: { x: number; y: number };
  onClose: () => void;
}

export function TranslationTooltip({
  word,
  translation,
  position,
  onClose
}: TranslationTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return createPortal(
    <div
      ref={tooltipRef}
      className="wordstream-tooltip"
      style={{
        left: `${position.x}px`,
        top: `${position.y + 20}px`
      }}
    >
      <div className="font-bold mb-1">{word}</div>
      <div>{translation}</div>
    </div>,
    document.body
  );
} 