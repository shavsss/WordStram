import { useState, useRef, useEffect, useCallback } from 'react';
import { SizeOption } from '@/types/video-notes';

interface Position {
  x: number;
  y: number;
}

interface UseDraggablePanelOptions {
  initialPosition?: Position;
  initialSize?: SizeOption;
}

/**
 * Custom hook to handle draggable panel functionality
 */
export function useDraggablePanel({
  initialPosition = { x: 20, y: 80 },
  initialSize = 'medium'
}: UseDraggablePanelOptions = {}) {
  // Size and position state
  const [sizeOption, setSizeOption] = useState<SizeOption>(initialSize);
  const [position, setPosition] = useState<Position>(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  
  const dragStartPos = useRef<Position>({ x: 0, y: 0 });
  
  // Handle mouse down for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if ((e.target as HTMLElement).closest('textarea')) return;
    
    if (!(e.target as HTMLElement).closest('.header')) return;
    
    setIsDragging(true);
    dragStartPos.current = { 
      x: e.clientX - position.x, 
      y: e.clientY - position.y 
    };
    
    e.preventDefault();
  }, [position]);
  
  // Mouse move and up event handlers for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      setPosition({
        x: e.clientX - dragStartPos.current.x,
        y: e.clientY - dragStartPos.current.y
      });
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);
  
  // Handle size change
  const handleSizeChange = useCallback((size: SizeOption) => {
    setSizeOption(size);
  }, []);
  
  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => !prev);
  }, []);
  
  return {
    sizeOption,
    position,
    isDragging,
    isDarkMode,
    handleMouseDown,
    handleSizeChange,
    toggleDarkMode
  };
} 