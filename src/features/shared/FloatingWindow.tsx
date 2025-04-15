/**
 * Floating Window Component
 * Provides a reusable floating window for various features
 */

import React, { useState, useEffect, useRef, ReactNode } from 'react';
import './FloatingWindow.css';

interface FloatingWindowProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  isVisible: boolean;
  width?: string;
  height?: string;
  initialPosition?: { x: number; y: number };
  className?: string;
}

export function FloatingWindow({
  title,
  children,
  onClose,
  isVisible,
  width = '350px',
  height = '450px',
  initialPosition = { x: 20, y: 20 },
  className = ''
}: FloatingWindowProps) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  // Initialize position at the center of the screen if not specified
  useEffect(() => {
    if (!initialPosition) {
      const centerX = (window.innerWidth - parseInt(width, 10)) / 2;
      const centerY = (window.innerHeight - parseInt(height, 10)) / 2;
      setPosition({ x: centerX, y: centerY });
    }
  }, [initialPosition, width, height]);

  // Handle mouse down (start dragging)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (windowRef.current) {
      const rect = windowRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  // Handle mouse move (dragging)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && windowRef.current) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;
        
        // Ensure the window stays within the viewport
        const windowWidth = windowRef.current.offsetWidth;
        const windowHeight = windowRef.current.offsetHeight;
        
        const maxX = window.innerWidth - windowWidth;
        const maxY = window.innerHeight - windowHeight;
        
        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      }
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
  }, [isDragging, dragOffset]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      ref={windowRef}
      className={`wordstream-floating-window ${className} ${isDragging ? 'dragging' : ''}`}
      style={{
        width,
        height,
        left: `${position.x}px`,
        top: `${position.y}px`
      }}
    >
      <div 
        className="wordstream-floating-window-header"
        onMouseDown={handleMouseDown}
      >
        <h3 className="wordstream-floating-window-title">{title}</h3>
        <button 
          className="wordstream-floating-window-close"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="wordstream-floating-window-content">
        {children}
      </div>
    </div>
  );
} 