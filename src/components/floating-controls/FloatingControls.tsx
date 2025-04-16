import * as React from 'react';
import * as ReactDOM from 'react-dom';

interface FloatingControlsProps {
  onClose: () => void;
  showGemini?: boolean;
  showNotes?: boolean;
  onGeminiClick?: () => void;
  onNotesClick?: () => void;
}

export const FloatingControls: React.FC<FloatingControlsProps> = ({
  onClose,
  showGemini = true,
  showNotes = true,
  onGeminiClick,
  onNotesClick
}) => {
  return (
    <div className="wordstream-floating-controls">
      <div className="wordstream-floating-controls-buttons">
        {showGemini && (
          <button 
            className="wordstream-floating-controls-button gemini"
            onClick={onGeminiClick}
          >
            AI
          </button>
        )}
        {showNotes && (
          <button 
            className="wordstream-floating-controls-button notes"
            onClick={onNotesClick}
          >
            Notes
          </button>
        )}
        <button 
          className="wordstream-floating-controls-button close"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export const renderFloatingControls = (
  container: HTMLElement,
  props: FloatingControlsProps
) => {
  ReactDOM.render(<FloatingControls {...props} />, container);
};

export default FloatingControls; 