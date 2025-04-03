import { addCustomStyles } from './styles';
import { createGeminiPanel } from './gemini-panel';

// State variable for controls
let controlsContainer: HTMLElement | null = null;

/**
 * יוצר את כפתורי השליטה הצפים
 * @returns מיכל הכפתורים
 */
export function createFloatingControls(): HTMLElement | null {
  // Check if controls already exist
  const existingControls = document.getElementById('wordstream-controls-container');
  if (existingControls) {
    controlsContainer = existingControls as HTMLElement;
    return controlsContainer;
  }
  
  // Add custom styles
  addCustomStyles();
  
  // Create controls container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '50%';
  container.style.left = '20px';
  container.style.transform = 'translateY(-50%)';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.gap = '20px';
  container.style.zIndex = '9999';
  container.id = 'wordstream-controls-container';
  
  // Add buttons to the container
  addGeminiButton(container);
  
  // Add container to document
  document.body.appendChild(container);
  controlsContainer = container;
  
  return container;
}

/**
 * מוסיף את כפתור הג'מיני למיכל
 */
function addGeminiButton(container: HTMLElement): void {
  // Create Gemini button
  const geminiButton = document.createElement('button');
  geminiButton.id = 'wordstream-gemini-button';
  geminiButton.className = 'wordstream-floating-button';
  geminiButton.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white"/>
      <path d="M2 17L12 22L22 17" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M2 12L12 17L22 12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  geminiButton.setAttribute('title', 'AI Assistant');
  
  // Add button to container
  container.appendChild(geminiButton);
  
  // Add event listener
  geminiButton.addEventListener('click', handleGeminiButtonClick);
}

/**
 * מטפל בלחיצה על כפתור הג'מיני
 */
function handleGeminiButtonClick(): void {
  const panel = createGeminiPanel();
  
  if (panel) {
    if (panel.style.display === 'none') {
      panel.style.display = 'flex';
      
      // Position panel if not already positioned
      if (!panel.style.top) {
        panel.style.top = '100px';
      }
      if (!panel.style.left) {
        panel.style.left = `${(window.innerWidth - parseInt(panel.style.width)) / 2}px`;
      }
    } else {
      panel.style.display = 'none';
    }
  }
} 