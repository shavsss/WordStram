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
  addSignOutButton(container);
  
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
 * מוסיף את כפתור ההתנתקות למיכל
 */
function addSignOutButton(container: HTMLElement): void {
  // Create Sign Out button
  const signOutButton = document.createElement('button');
  signOutButton.id = 'wordstream-signout-button';
  signOutButton.className = 'wordstream-floating-button';
  signOutButton.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <polyline points="16 17 21 12 16 7"></polyline>
      <line x1="21" y1="12" x2="9" y2="12"></line>
    </svg>
  `;
  signOutButton.setAttribute('title', 'Sign Out from WordStream');
  
  // Add button to container
  container.appendChild(signOutButton);
  
  // Add event listener
  signOutButton.addEventListener('click', handleSignOutButtonClick);
}

/**
 * מטפל בלחיצה על כפתור ההתנתקות
 */
async function handleSignOutButtonClick(): Promise<void> {
  try {
    console.log('WordStream: Sign Out button clicked, signing out user');
    
    // שליחת הודעה לסקריפט הרקע לבצע התנתקות
    chrome.runtime.sendMessage({ action: 'SIGN_OUT' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('WordStream: Error during sign out', chrome.runtime.lastError);
        return;
      }
      
      console.log('WordStream: User signed out successfully', response);
      
      // אם קיים popup או UI שמציג את מצב ההתחברות, כאן אפשר לעדכן אותו
      
      // הסרת הכפתורים הצפים מהמסך אחרי ההתנתקות
      if (controlsContainer && document.body.contains(controlsContainer)) {
        document.body.removeChild(controlsContainer);
        controlsContainer = null;
      }
    });
  } catch (error) {
    console.error('WordStream: Error signing out:', error);
  }
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