import { addCustomStyles, PANEL_SIZES, PanelSize, ensurePanelInViewport, isDarkModeDefault } from './styles';

// State variables
let geminiPanel: HTMLElement | null = null;
let isDarkMode = isDarkModeDefault;
let currentPanelSize: PanelSize = 'medium';

/**
 * עדכון סגנונות התמה
 */
function updateThemeStyles(): void {
  if (!geminiPanel) return;
  
  if (isDarkMode) {
    geminiPanel.classList.add('dark');
    geminiPanel.classList.remove('light');
  } else {
    geminiPanel.classList.add('light');
    geminiPanel.classList.remove('dark');
  }
}

/**
 * עדכון גודל הפאנל
 */
function updateSize(size: PanelSize): void {
  if (!geminiPanel) return;
  
  currentPanelSize = size;
  const { width, height } = PANEL_SIZES[size];
  
  geminiPanel.style.width = width;
  geminiPanel.style.height = height;
  
  // If panel is outside viewport, bring it back
  ensurePanelInViewport(geminiPanel);
}

/**
 * יוצר את פאנל הג'מיני
 * @returns הפאנל שנוצר או שכבר קיים
 */
export function createGeminiPanel(): HTMLElement | null {
  // Check if panel already exists
  const existingPanel = document.getElementById('wordstream-gemini-panel');
  if (existingPanel) {
    geminiPanel = existingPanel as HTMLElement;
    return geminiPanel;
  }

  // Add custom styles if not already added
  addCustomStyles();
  
  // Create panel element
  const panel = document.createElement('div');
  panel.id = 'wordstream-gemini-panel';
  panel.className = `wordstream-panel gemini-panel ${isDarkMode ? 'dark' : 'light'}`;
  panel.style.display = 'none';
  panel.style.width = PANEL_SIZES[currentPanelSize].width;
  panel.style.height = PANEL_SIZES[currentPanelSize].height;
  
  // Create panel content
  panel.innerHTML = `
    <div class="panel-header">
      <h3>Gemini AI Assistant</h3>
      <div class="panel-controls">
        <button class="control-button size-button size-small" title="Small size">
          <span class="size-icon">◻</span>
        </button>
        <button class="control-button size-button size-medium active" title="Medium size">
          <span class="size-icon">◻</span>
        </button>
        <button class="control-button size-button size-large" title="Large size">
          <span class="size-icon">◻</span>
        </button>
        <button class="control-button toggle-theme" title="Toggle theme">
          ${isDarkMode ? '☀️' : '🌙'}
        </button>
        <button class="control-button close-button" title="Close">✕</button>
      </div>
    </div>
    <div class="panel-content">
      <iframe 
        src="https://gemini.google.com/app" 
        width="100%" 
        height="100%" 
        frameborder="0"
        style="border: none; flex: 1;"
      ></iframe>
    </div>
  `;
  
  document.body.appendChild(panel);
  geminiPanel = panel;
  
  // Set panel event handlers
  setupPanelEventHandlers();
  
  return panel;
}

/**
 * התקנת מאזינים לאירועים בפאנל
 */
function setupPanelEventHandlers(): void {
  if (!geminiPanel) return;
  
  // 1. Make the panel draggable
  setupDraggable();
  
  // 2. Theme toggling
  setupThemeToggle();
  
  // 3. Size controls
  setupSizeControls();
  
  // 4. Close button handler
  setupCloseButton();
  
  // Listen for window resize to ensure panel stays in viewport
  window.addEventListener('resize', () => ensurePanelInViewport(geminiPanel!));
}

/**
 * מגדיר את יכולת הגרירה של הפאנל
 */
function setupDraggable(): void {
  if (!geminiPanel) return;
  
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;
  
  const header = geminiPanel.querySelector('.panel-header') as HTMLElement;
  
  if (header) {
    header.addEventListener('mousedown', (e) => {
      // Only initiate drag if not clicking on a control
      if (!(e.target as HTMLElement).closest('button')) {
        isDragging = true;
        offsetX = e.clientX - geminiPanel!.getBoundingClientRect().left;
        offsetY = e.clientY - geminiPanel!.getBoundingClientRect().top;
      }
    });
  }
  
  document.addEventListener('mousemove', (e) => {
    if (isDragging && geminiPanel) {
      geminiPanel.style.left = (e.clientX - offsetX) + 'px';
      geminiPanel.style.top = (e.clientY - offsetY) + 'px';
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (isDragging && geminiPanel) {
      isDragging = false;
      ensurePanelInViewport(geminiPanel);
    }
  });
}

/**
 * מגדיר את כפתור החלפת התמה
 */
function setupThemeToggle(): void {
  if (!geminiPanel) return;
  
  const themeToggle = geminiPanel.querySelector('.toggle-theme');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      isDarkMode = !isDarkMode;
      geminiPanel!.className = `wordstream-panel gemini-panel ${isDarkMode ? 'dark' : 'light'}`;
      updateThemeStyles();
    });
  }
}

/**
 * מגדיר את כפתורי שינוי הגודל
 */
function setupSizeControls(): void {
  if (!geminiPanel) return;
  
  const sizeButtons = geminiPanel.querySelectorAll('.size-button');
  sizeButtons.forEach(button => {
    button.addEventListener('click', () => {
      if (button.classList.contains('size-small')) {
        updateSize('small');
      } else if (button.classList.contains('size-medium')) {
        updateSize('medium');
      } else if (button.classList.contains('size-large')) {
        updateSize('large');
      }
      
      // Update active state for buttons
      sizeButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
    });
  });
}

/**
 * מגדיר את כפתור הסגירה
 */
function setupCloseButton(): void {
  if (!geminiPanel) return;
  
  const closeButton = geminiPanel.querySelector('.close-button');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      if (geminiPanel) {
        geminiPanel.style.display = 'none';
        const event = new CustomEvent('geminiPanelClosed');
        document.dispatchEvent(event);
      }
    });
  }
}

/**
 * מחליף את מצב הנראות של הפאנל
 */
export function togglePanelVisibility(): void {
  const panel = createGeminiPanel();
  
  if (!panel) return;
  
  if (panel.style.display === 'none') {
    panel.style.display = 'flex';
    
    // Position panel in the center of the screen if not already positioned
    if (!panel.style.top || panel.style.top === 'auto') {
      panel.style.top = '100px';
    }
    
    if (!panel.style.left || panel.style.left === 'auto') {
      const width = parseInt(panel.style.width || PANEL_SIZES[currentPanelSize].width);
      panel.style.left = `${(window.innerWidth - width) / 2}px`;
    }
  } else {
    panel.style.display = 'none';
  }
} 