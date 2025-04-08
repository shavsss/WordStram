/**
 * Panel Styling Utilities
 * 
 * יוטיליטי לסגנונות עבור פאנלים צפים
 */

/**
 * Add custom CSS styles for panels to the document
 */
export function addCustomStyles(): void {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    .wordstream-panel {
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      background-color: white;
      overflow: hidden;
      font-family: Arial, sans-serif;
      transition: width 0.3s, height 0.3s;
      z-index: 999999;
    }
    
    .wordstream-panel.dragging {
      opacity: 0.8;
      transition: none;
    }
    
    /* Size variants */
    .wordstream-panel.size-s {
      width: 300px;
      height: 300px;
    }
    
    .wordstream-panel.size-m {
      width: 400px;
      height: 500px;
    }
    
    .wordstream-panel.size-l {
      width: 600px;
      height: 600px;
    }
    
    .panel-header {
      background-color: #f8f9fa;
      user-select: none;
    }
    
    .panel-content {
      padding: 15px;
      overflow-y: auto;
      height: calc(100% - 50px);
    }
    
    /* Message styles for chat */
    .chat-message {
      margin-bottom: 10px;
      max-width: 80%;
      word-wrap: break-word;
    }
    
    .chat-message.user {
      margin-left: auto;
      background-color: #0084ff;
      color: white;
      border-radius: 18px 18px 0 18px;
      padding: 8px 12px;
    }
    
    .chat-message.bot {
      margin-right: auto;
      background-color: #f1f1f1;
      border-radius: 18px 18px 18px 0;
      padding: 8px 12px;
    }
    
    /* Typing indicator for chat */
    .typing-indicator {
      display: inline-flex;
      align-items: center;
      padding: 6px 12px;
      background-color: #f1f1f1;
      border-radius: 15px;
    }
    
    .typing-indicator span {
      width: 6px;
      height: 6px;
      background-color: #888;
      border-radius: 50%;
      margin: 0 2px;
      animation: typing 1.4s infinite both;
    }
    
    .typing-indicator span:nth-child(2) {
      animation-delay: 0.2s;
    }
    
    .typing-indicator span:nth-child(3) {
      animation-delay: 0.4s;
    }
    
    @keyframes typing {
      0% { transform: scale(1); opacity: 0.7; }
      50% { transform: scale(1.2); opacity: 1; }
      100% { transform: scale(1); opacity: 0.7; }
    }
  `;
  
  document.head.appendChild(styleElement);
}

/**
 * Create SVG icon for various panel controls
 * @param iconType Type of icon to create ('close', 'chat', 'note')
 * @returns SVG element with the specified icon
 */
export function createIcon(iconType: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  
  switch (iconType) {
    case 'close':
      // X icon
      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line1.setAttribute('x1', '18');
      line1.setAttribute('y1', '6');
      line1.setAttribute('x2', '6');
      line1.setAttribute('y2', '18');
      
      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.setAttribute('x1', '6');
      line2.setAttribute('y1', '6');
      line2.setAttribute('x2', '18');
      line2.setAttribute('y2', '18');
      
      svg.appendChild(line1);
      svg.appendChild(line2);
      break;
      
    case 'chat':
      // Message square icon
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');
      svg.appendChild(path);
      break;
      
    case 'note':
      // File text icon
      const notePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      notePath.setAttribute('d', 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z');
      
      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      polyline.setAttribute('points', '14 2 14 8 20 8');
      
      const line3 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line3.setAttribute('x1', '16');
      line3.setAttribute('y1', '13');
      line3.setAttribute('x2', '8');
      line3.setAttribute('y2', '13');
      
      const line4 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line4.setAttribute('x1', '16');
      line4.setAttribute('y1', '17');
      line4.setAttribute('x2', '8');
      line4.setAttribute('y2', '17');
      
      const polyline2 = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      polyline2.setAttribute('points', '10 9 9 9 8 9');
      
      svg.appendChild(notePath);
      svg.appendChild(polyline);
      svg.appendChild(line3);
      svg.appendChild(line4);
      svg.appendChild(polyline2);
      break;
  }
  
  return svg;
}

/**
 * Ensure panel stays within viewport
 * @param panel Panel element to check
 */
export function ensurePanelInViewport(panel: HTMLElement): void {
  const rect = panel.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Check if panel is outside viewport horizontally
  if (rect.right > viewportWidth) {
    panel.style.left = 'auto';
    panel.style.right = '20px';
  } else if (rect.left < 0) {
    panel.style.left = '20px';
    panel.style.right = 'auto';
  }
  
  // Check if panel is outside viewport vertically
  if (rect.bottom > viewportHeight) {
    panel.style.top = 'auto';
    panel.style.bottom = '20px';
  } else if (rect.top < 0) {
    panel.style.top = '20px';
    panel.style.bottom = 'auto';
  }
}

export default {
  addCustomStyles,
  createIcon,
  ensurePanelInViewport
}; 