import React from 'react';
import { getWindowManager, WindowType } from './WindowManager';

interface FloatingButtonProps {
  type: 'gemini' | 'notes';
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  offset?: { bottom?: number; right?: number; left?: number; top?: number };
  label?: string;
  icon?: string;
  tooltip?: string;
}

const buttonStyles = {
  button: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    color: 'white',
    border: '2px solid rgba(255, 255, 255, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    transition: 'transform 0.2s ease, background-color 0.2s ease',
    position: 'fixed',
    zIndex: 9999,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  } as React.CSSProperties,
  icon: {
    fontSize: '16px',
  },
  tooltip: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    whiteSpace: 'nowrap',
    opacity: 0,
    transition: 'opacity 0.2s ease',
    pointerEvents: 'none',
  } as React.CSSProperties
};

// Colors for different button types
const buttonColors = {
  gemini: {
    normal: 'rgba(138, 43, 226, 0.9)',
    hover: 'rgba(138, 43, 226, 1)'
  },
  notes: {
    normal: 'rgba(46, 125, 50, 0.9)',
    hover: 'rgba(46, 125, 50, 1)'
  }
};

// Icons for different button types
const buttonIcons = {
  gemini: '💬',
  notes: '📝'
};

// Default tooltip positions
const tooltipPositions = {
  'bottom-right': { right: '46px' },
  'bottom-left': { left: '46px' },
  'top-right': { right: '46px' },
  'top-left': { left: '46px' }
};

/**
 * Floating button component for opening windows
 */
export const FloatingButton: React.FC<FloatingButtonProps> = ({
  type,
  position = 'bottom-right',
  offset = { bottom: 80, right: 20 },
  label,
  icon = buttonIcons[type],
  tooltip
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isAvailable, setIsAvailable] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  
  // Set position based on the position prop
  const positionStyles = React.useMemo(() => {
    switch (position) {
      case 'bottom-right':
        return { bottom: offset.bottom || 20, right: offset.right || 20 };
      case 'bottom-left':
        return { bottom: offset.bottom || 20, left: offset.left || 20 };
      case 'top-right':
        return { top: offset.top || 20, right: offset.right || 20 };
      case 'top-left':
        return { top: offset.top || 20, left: offset.left || 20 };
    }
  }, [position, offset]);

  // Set tooltip position based on the position prop
  const tooltipPosition = React.useMemo(() => {
    return tooltipPositions[position];
  }, [position]);

  React.useEffect(() => {
    // Check if the feature is available and if the user is authenticated
    getWindowManager().then(manager => {
      if (type === 'gemini') {
        setIsAvailable(manager.isGeminiAvailable());
      } else {
        setIsAvailable(true); // Notes are always available
      }
      
      setIsAuthenticated(manager.isUserAuthenticated());
    });
  }, [type]);

  const handleClick = async () => {
    const manager = await getWindowManager();
    
    if (type === 'gemini') {
      await manager.toggleGemini();
    } else if (type === 'notes') {
      await manager.toggleNotes();
    }
  };

  if (!isAvailable || !isAuthenticated) {
    return null;
  }

  return (
    <button
      id={`wordstream-${type}-button`}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={label || (type === 'gemini' ? 'Open Gemini Chat' : 'Open Notes')}
      style={{
        ...buttonStyles.button,
        ...positionStyles,
        transform: isHovered ? 'scale(1.1)' : 'scale(1)',
        backgroundColor: isHovered ? buttonColors[type].hover : buttonColors[type].normal,
      }}
    >
      <span style={buttonStyles.icon}>{icon}</span>
      {tooltip && (
        <span 
          style={{
            ...buttonStyles.tooltip,
            ...tooltipPosition,
            opacity: isHovered ? 1 : 0,
          }}
        >
          {tooltip}
        </span>
      )}
    </button>
  );
};

/**
 * Renders a floating button directly to the DOM
 */
export function renderFloatingButton(type: 'gemini' | 'notes', options: Omit<FloatingButtonProps, 'type'> = {}) {
  // Check if there's already a container for this button
  const existingContainer = document.getElementById(`wordstream-${type}-button-container`);
  if (existingContainer) {
    return; // Don't create duplicate buttons
  }

  const container = document.createElement('div');
  container.id = `wordstream-${type}-button-container`;
  document.body.appendChild(container);
  
  // Import React and ReactDOM dynamically
  import('react').then(React => {
    import('react-dom').then(ReactDOM => {
      ReactDOM.render(
        React.createElement(FloatingButton, { 
          type,
          ...options
        }),
        container
      );
    });
  });
} 