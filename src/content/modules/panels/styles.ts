// Panel style constants
export const isDarkModeDefault = window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;

export type PanelSize = 'small' | 'medium' | 'large';

// Panel size configurations
export const PANEL_SIZES: Record<PanelSize, { width: string; height: string }> = {
  small: { width: '350px', height: '400px' },
  medium: { width: '450px', height: '500px' },
  large: { width: '550px', height: '600px' }
};

/**
 * מוסיף את סגנונות CSS הדרושים עבור הפאנלים והכפתורים
 */
export function addCustomStyles(): void {
  // Skip if styles are already added
  const existingStylesheet = document.getElementById('wordstream-custom-styles');
  if (existingStylesheet) return;

  const style = document.createElement('style');
  style.id = 'wordstream-custom-styles';
  style.textContent = `
    .wordstream-floating-button {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background-color: rgba(30, 30, 30, 0.8);
      color: white;
      border: none;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      cursor: pointer;
      transition: transform 0.3s, background-color 0.3s;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      z-index: 9999;
    }
    
    .wordstream-floating-button:hover {
      transform: scale(1.1);
      background-color: rgba(50, 50, 50, 0.9);
    }
    
    .wordstream-panel {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 10%;
      right: 20px;
      z-index: 9998;
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    }
    
    .wordstream-panel.light {
      background-color: rgba(255, 255, 255, 0.95);
      color: #333;
      border: 1px solid #ddd;
    }
    
    .wordstream-panel.dark {
      background-color: rgba(30, 30, 30, 0.95);
      color: #e0e0e0;
      border: 1px solid #444;
    }
    
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      cursor: move;
    }
    
    .panel-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 500;
    }
    
    .panel-controls {
      display: flex;
      gap: 8px;
    }
    
    .panel-content {
      flex: 1;
      padding: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    .control-button {
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 4px;
      transition: background-color 0.2s;
    }
    
    .light .control-button {
      color: #444;
    }
    
    .light .control-button:hover {
      background-color: rgba(0, 0, 0, 0.05);
    }
    
    .dark .control-button {
      color: #e0e0e0;
    }
    
    .dark .control-button:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
    
    .close-button:hover {
      color: #f44336;
    }
    
    /* Size buttons */
    .size-button {
      width: 24px;
      height: 24px;
      opacity: 0.6;
    }
    
    .size-button.active {
      opacity: 1;
    }
    
    .size-small .size-icon {
      transform: scale(0.8);
    }
    
    .size-large .size-icon {
      transform: scale(1.2);
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * וודא שהפאנל נשאר בתוך גבולות החלון
 */
export function ensurePanelInViewport(panel: HTMLElement): void {
  if (!panel) return;
  
  const rect = panel.getBoundingClientRect();
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  
  if (rect.right > windowWidth) {
    panel.style.left = `${windowWidth - rect.width - 20}px`;
  }
  
  if (rect.bottom > windowHeight) {
    panel.style.top = `${windowHeight - rect.height - 20}px`;
  }
  
  if (rect.left < 0) {
    panel.style.left = '20px';
  }
  
  if (rect.top < 0) {
    panel.style.top = '20px';
  }
} 