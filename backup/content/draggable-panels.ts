/**
 * Draggable Panel Functionality for WordStram2
 * 
 * This module provides functionality to make panels draggable
 * and properly responsive in the WordStram2 extension.
 */

import { createIcon, setPanelSize, togglePanelTheme } from './panel-styles';

interface DraggableOptions {
  handle?: string;         // CSS selector for the drag handle (defaults to panel header)
  boundaryOffset?: number; // Keeps panel this many pixels within viewport
  onDragStart?: (panel: HTMLElement) => void;
  onDragEnd?: (panel: HTMLElement) => void;
  onDragMove?: (panel: HTMLElement, x: number, y: number) => void;
  resetPositionOnResize?: boolean;
  defaultSize?: 's' | 'm' | 'l';
  enableThemeToggle?: boolean;
  enableSizeControls?: boolean;
  rtl?: boolean;          // Right-to-left support
}

// Add type declarations for global window object
declare global {
  interface Window {
    ensurePanelInViewport: (panel: HTMLElement) => void;
  }
}

/**
 * Makes an HTML element draggable with advanced UI controls
 */
export function makePanelDraggable(
  panel: HTMLElement, 
  options: DraggableOptions = {}
): () => void {
  const {
    handle = '.panel-header',
    boundaryOffset = 20,
    onDragStart,
    onDragEnd,
    onDragMove,
    resetPositionOnResize = true,
    defaultSize = 'm',
    enableThemeToggle = true,
    enableSizeControls = true,
    rtl = false
  } = options;
  
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;
  
  // Add base class if not present
  if (!panel.classList.contains('wordstream-panel')) {
    panel.classList.add('wordstream-panel');
  }
  
  // Set default size
  setPanelSize(panel, defaultSize);
  
  // Set RTL class if needed
  if (rtl) {
    panel.classList.add('rtl');
    panel.setAttribute('dir', 'rtl');
  }
  
  // Find or create the handle element
  let handleElement = panel.querySelector(handle);
  
  if (!handleElement) {
    // Create header if it doesn't exist
    handleElement = document.createElement('div');
    handleElement.className = 'panel-header';
    
    // Create title
    const titleElement = document.createElement('h3');
    titleElement.className = 'panel-title';
    titleElement.textContent = panel.getAttribute('data-title') || 'Panel';
    
    // Create controls container
    const controlsElement = document.createElement('div');
    controlsElement.className = 'panel-controls';
    
    // Add size controls
    if (enableSizeControls) {
      const sizeControlsElement = document.createElement('div');
      sizeControlsElement.className = 'size-controls';
      
      // Create size buttons (S, M, L)
      const sizes = [
        { name: 's', label: 'S' },
        { name: 'm', label: 'M' },
        { name: 'l', label: 'L' }
      ];
      
      sizes.forEach(size => {
        const sizeButton = document.createElement('button');
        sizeButton.className = `size-button${size.name === defaultSize ? ' active' : ''}`;
        sizeButton.textContent = size.label;
        sizeButton.setAttribute('data-size', size.name);
        sizeButton.title = `Set to ${size.name === 's' ? 'small' : size.name === 'm' ? 'medium' : 'large'} size`;
        
        sizeButton.addEventListener('click', (e) => {
          e.stopPropagation();
          setPanelSize(panel, size.name as 's' | 'm' | 'l');
        });
        
        sizeControlsElement.appendChild(sizeButton);
      });
      
      controlsElement.appendChild(sizeControlsElement);
    }
    
    // Add theme toggle
    if (enableThemeToggle) {
      const themeToggle = document.createElement('button');
      themeToggle.className = 'theme-toggle';
      themeToggle.title = 'Toggle light/dark theme';
      themeToggle.appendChild(createIcon('sun'));
      
      themeToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePanelTheme(panel);
        
        // Update icon based on current theme
        if (panel.classList.contains('light-mode')) {
          themeToggle.innerHTML = '';
          themeToggle.appendChild(createIcon('moon'));
        } else {
          themeToggle.innerHTML = '';
          themeToggle.appendChild(createIcon('sun'));
        }
      });
      
      controlsElement.appendChild(themeToggle);
    }
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'close-button';
    closeButton.title = 'Close';
    closeButton.appendChild(createIcon('close'));
    
    closeButton.addEventListener('click', () => {
      panel.style.display = 'none';
      
      // Trigger custom event so the app can react
      const event = new CustomEvent('wordstream-panel-closed', { 
        detail: { panelId: panel.id } 
      });
      document.dispatchEvent(event);
    });
    
    controlsElement.appendChild(closeButton);
    
    // Assemble header
    handleElement.appendChild(titleElement);
    handleElement.appendChild(controlsElement);
    
    // Add to panel as first child
    if (panel.firstChild) {
      panel.insertBefore(handleElement, panel.firstChild);
    } else {
      panel.appendChild(handleElement);
    }
  }
  
  // Apply style to the handle to indicate it's draggable
  handleElement.classList.add('draggable');
  
  // Setup event listeners for dragging
  const handleMouseDown = (e: Event): void => {
    // Type cast to MouseEvent
    const mouseEvent = e as MouseEvent;
    
    // Prevent if right-click or if clicking on a button or input
    if (mouseEvent.button !== 0 || 
        (mouseEvent.target as HTMLElement).tagName === 'BUTTON' || 
        (mouseEvent.target as HTMLElement).tagName === 'INPUT' ||
        (mouseEvent.target as HTMLElement).tagName === 'TEXTAREA' ||
        (mouseEvent.target as HTMLElement).closest('button')) {
      return;
    }
    
    mouseEvent.preventDefault();
    
    // Calculate the offset of the mouse pointer relative to the panel's position
    const rect = panel.getBoundingClientRect();
    offsetX = mouseEvent.clientX - rect.left;
    offsetY = mouseEvent.clientY - rect.top;
    
    isDragging = true;
    panel.classList.add('dragging');
    
    // Make sure the panel has position absolute or fixed
    const position = window.getComputedStyle(panel).position;
    if (position !== 'absolute' && position !== 'fixed') {
      panel.style.position = 'fixed';
    }
    
    // Set higher z-index while dragging to ensure it's on top
    panel.style.zIndex = '10001';
    
    if (onDragStart) {
      onDragStart(panel);
    }
  };
  
  const handleMouseMove = (e: Event): void => {
    if (!isDragging) return;
    
    // Type cast to MouseEvent
    const mouseEvent = e as MouseEvent;
    mouseEvent.preventDefault();
    
    // Calculate new position
    let newLeft = mouseEvent.clientX - offsetX;
    let newTop = mouseEvent.clientY - offsetY;
    
    // Ensure panel stays within viewport boundaries
    const rect = panel.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Constrain horizontal position
    if (newLeft < boundaryOffset) {
      newLeft = boundaryOffset;
    } else if (newLeft + rect.width > viewportWidth - boundaryOffset) {
      newLeft = viewportWidth - rect.width - boundaryOffset;
    }
    
    // Constrain vertical position
    if (newTop < boundaryOffset) {
      newTop = boundaryOffset;
    } else if (newTop + rect.height > viewportHeight - boundaryOffset) {
      newTop = viewportHeight - rect.height - boundaryOffset;
    }
    
    // Apply new position
    panel.style.left = `${newLeft}px`;
    panel.style.top = `${newTop}px`;
    
    // Reset any bottom/right positioning to prevent conflicts
    panel.style.bottom = 'auto';
    panel.style.right = 'auto';
    
    if (onDragMove) {
      onDragMove(panel, newLeft, newTop);
    }
  };
  
  const handleMouseUp = (): void => {
    if (!isDragging) return;
    
    isDragging = false;
    panel.classList.remove('dragging');
    
    // Reset z-index to original value after a short delay
    setTimeout(() => {
      panel.style.zIndex = '10000'; // Back to default z-index
    }, 200);
    
    if (onDragEnd) {
      onDragEnd(panel);
    }
  };
  
  /**
   * Ensures panel stays within viewport boundaries when window is resized
   */
  const ensurePanelInViewport = (): void => {
    const rect = panel.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let newLeft = rect.left;
    let newTop = rect.top;
    let needsRepositioning = false;
    
    // Check if panel extends beyond right edge
    if (rect.right > viewportWidth - boundaryOffset) {
      newLeft = viewportWidth - rect.width - boundaryOffset;
      needsRepositioning = true;
    }
    
    // Check if panel extends beyond bottom edge
    if (rect.bottom > viewportHeight - boundaryOffset) {
      newTop = viewportHeight - rect.height - boundaryOffset;
      needsRepositioning = true;
    }
    
    // Check if panel extends beyond left edge
    if (rect.left < boundaryOffset) {
      newLeft = boundaryOffset;
      needsRepositioning = true;
    }
    
    // Check if panel extends beyond top edge
    if (rect.top < boundaryOffset) {
      newTop = boundaryOffset;
      needsRepositioning = true;
    }
    
    // Apply new position if needed
    if (needsRepositioning) {
      panel.style.left = `${newLeft}px`;
      panel.style.top = `${newTop}px`;
      panel.style.bottom = 'auto';
      panel.style.right = 'auto';
    }
  };
  
  // Add event listeners with proper type handling
  handleElement.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  
  // Ensure panel stays in viewport when window is resized
  if (resetPositionOnResize) {
    window.addEventListener('resize', ensurePanelInViewport);
  }
  
  // Initial position check
  ensurePanelInViewport();
  
  // Add history sidebar toggle if this is the right panel
  if (panel.classList.contains('chat-panel') || panel.classList.contains('notes-panel')) {
    addHistorySidebarToggle(panel);
  }
  
  /**
   * Clean up event listeners (call when removing panel)
   */
  return (): void => {
    handleElement.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    window.removeEventListener('resize', ensurePanelInViewport);
  };
}

/**
 * Add a toggle button for the history sidebar
 */
export function addHistorySidebarToggle(panel: HTMLElement): void {
  const headerElement = panel.querySelector('.panel-header');
  if (!headerElement) return;
  
  const titleElement = headerElement.querySelector('.panel-title');
  if (!titleElement) return;
  
  // Create toggle button
  const toggleButton = document.createElement('button');
  toggleButton.className = 'icon-button history-toggle';
  toggleButton.title = 'Toggle history sidebar';
  toggleButton.appendChild(createIcon(panel.classList.contains('chat-panel') ? 'chat' : 'note'));
  
  // Insert before title
  headerElement.insertBefore(toggleButton, titleElement);
  
  // Add click handler
  toggleButton.addEventListener('click', (e) => {
    e.stopPropagation();
    
    // Toggle the sidebar visibility
    const mainContent = panel.querySelector('.panel-content');
    if (!mainContent) return;
    
    // Check if we already have the layout
    let twoColumnLayout = panel.querySelector('.two-column-layout');
    let sidebar = panel.querySelector('.history-sidebar');
    
    if (!twoColumnLayout) {
      // Set up the two-column layout
      twoColumnLayout = document.createElement('div');
      twoColumnLayout.className = 'two-column-layout';
      
      // Create sidebar
      sidebar = document.createElement('div');
      sidebar.className = 'history-sidebar';
      
      // Create header for sidebar
      const sidebarHeader = document.createElement('div');
      sidebarHeader.className = 'history-header';
      sidebarHeader.textContent = panel.classList.contains('chat-panel') ? 'Chat History' : 'Saved Notes';
      sidebar.appendChild(sidebarHeader);
      
      // Create items container
      const itemsContainer = document.createElement('div');
      itemsContainer.className = 'history-items';
      
      // Example items - this would be populated from real data
      for (let i = 0; i < 5; i++) {
        const item = document.createElement('div');
        item.className = 'history-item';
        
        const itemTitle = document.createElement('div');
        itemTitle.className = 'history-item-title';
        itemTitle.textContent = panel.classList.contains('chat-panel') 
          ? `Chat ${i + 1}` 
          : `Note ${i + 1}`;
        
        const itemMeta = document.createElement('div');
        itemMeta.className = 'history-item-meta';
        itemMeta.textContent = `2023-04-${10 + i}`;
        
        item.appendChild(itemTitle);
        item.appendChild(itemMeta);
        itemsContainer.appendChild(item);
      }
      
      sidebar.appendChild(itemsContainer);
      
      // Create content container
      const contentContainer = document.createElement('div');
      contentContainer.className = 'main-content';
      
      // Move existing content into the main content container
      while (mainContent.firstChild) {
        contentContainer.appendChild(mainContent.firstChild);
      }
      
      // Assemble the layout
      twoColumnLayout.appendChild(sidebar);
      twoColumnLayout.appendChild(contentContainer);
      mainContent.appendChild(twoColumnLayout);
    } else {
      // Toggle visibility
      if (sidebar) {
        const sidebarElement = sidebar as HTMLElement;
        sidebarElement.style.display = sidebarElement.style.display === 'none' ? 'flex' : 'none';
      }
    }
  });
}

/**
 * Add the timestamp jump functionality to notes
 */
export function addJumpToTimestampButtons(panel: HTMLElement): void {
  const noteItems = panel.querySelectorAll('.note-item');
  
  noteItems.forEach(note => {
    const timestampElement = note.querySelector('.note-timestamp');
    if (!timestampElement) return;
    
    // Extract timestamp in seconds if available
    const timeString = timestampElement.getAttribute('data-time');
    if (!timeString) return;
    
    const seconds = parseInt(timeString, 10);
    if (isNaN(seconds)) return;
    
    // Create jump button if it doesn't exist
    if (!note.querySelector('.jump-button')) {
      const jumpBtn = document.createElement('button');
      jumpBtn.className = 'jump-button';
      jumpBtn.title = 'Jump to this point in the video';
      
      const iconElement = createIcon('jump');
      jumpBtn.appendChild(iconElement);
      jumpBtn.appendChild(document.createTextNode(' Jump'));
      
      jumpBtn.addEventListener('click', () => {
        // Find the video element
        const videoElement = document.querySelector('video');
        if (videoElement) {
          videoElement.currentTime = seconds;
          videoElement.play().catch(err => console.error('Failed to play video:', err));
        }
      });
      
      // Add to timestamp container
      timestampElement.appendChild(jumpBtn);
    }
  });
}

/**
 * Add the draggable functionality from the provided code snippet
 * This is a simplified version of the same functionality as above but follows the user's exact code
 */
export function addExactDraggableCode(chatWindow: HTMLElement): void {
  // First add base classes for styling
  chatWindow.classList.add('wordstream-panel');
  
  // Make sure we have a header area
  if (!chatWindow.querySelector('.panel-header')) {
    const existingFirstChild = chatWindow.firstChild;
    
    // Create header
    const header = document.createElement('div');
    header.className = 'panel-header draggable';
    
    // Create title
    const title = document.createElement('h3');
    title.className = 'panel-title';
    title.textContent = chatWindow.classList.contains('gemini-panel') ? 'Gemini Chat' : 'Notes';
    header.appendChild(title);
    
    // Create controls
    const controls = document.createElement('div');
    controls.className = 'panel-controls';
    
    // Size buttons
    const sizeControls = document.createElement('div');
    sizeControls.className = 'size-controls';
    
    ['S', 'M', 'L'].forEach((size, i) => {
      const btn = document.createElement('button');
      const sizeKey = size.toLowerCase();
      // Make S the default selected size (was previously M at index 1)
      btn.className = `size-button${sizeKey === 's' ? ' active' : ''}`;
      btn.textContent = size;
      btn.setAttribute('data-size', sizeKey);
      
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // First remove active class from all buttons
        const allSizeButtons = chatWindow.querySelectorAll('.size-button');
        allSizeButtons.forEach(button => button.classList.remove('active'));
        
        // Add active class to this button
        btn.classList.add('active');
        
        // Apply the size
        setPanelSize(chatWindow, sizeKey as 's' | 'm' | 'l');
        
        // Ensure the panel stays in viewport after resize
        ensurePanelInViewport(chatWindow);
      });
      
      sizeControls.appendChild(btn);
    });
    
    controls.appendChild(sizeControls);
    
    // Theme toggle
    const themeToggle = document.createElement('button');
    themeToggle.className = 'theme-toggle';
    themeToggle.appendChild(createIcon('sun'));
    
    themeToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePanelTheme(chatWindow);
      themeToggle.innerHTML = '';
      themeToggle.appendChild(createIcon(
        chatWindow.classList.contains('light-mode') ? 'moon' : 'sun'
      ));
    });
    
    controls.appendChild(themeToggle);
    
    // Add close button if it doesn't exist
    if (!chatWindow.querySelector('.close-button')) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-button';
      closeBtn.appendChild(createIcon('close'));
      
      closeBtn.addEventListener('click', () => {
        chatWindow.style.display = 'none';
      });
      
      controls.appendChild(closeBtn);
    }
    
    header.appendChild(controls);
    
    // Insert header at the beginning
    if (existingFirstChild) {
      chatWindow.insertBefore(header, existingFirstChild);
    } else {
      chatWindow.appendChild(header);
    }
  }
  
  // Set default size to S (was M before)
  if (!chatWindow.classList.contains('size-s') && 
      !chatWindow.classList.contains('size-m') && 
      !chatWindow.classList.contains('size-l')) {
    setPanelSize(chatWindow, 's');
  }
  
  // Original draggable code as requested
  let isDragging = false;
  let offsetX: number, offsetY: number;

  const header = chatWindow.querySelector('.panel-header');
  
  if (header) {
    const headerElement = header as HTMLElement;
    headerElement.addEventListener('mousedown', (e: MouseEvent) => {
      // Ignore if clicking on buttons
      if ((e.target as HTMLElement).tagName === 'BUTTON' || 
          (e.target as HTMLElement).closest('button')) {
        return;
      }
      
      isDragging = true;
      chatWindow.classList.add('dragging');
      
      const rect = chatWindow.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
    });
  }

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    // Calculate new position
    let newLeft = e.clientX - offsetX;
    let newTop = e.clientY - offsetY;
    
    // Keep within viewport with better boundary margin (20px)
    const rect = chatWindow.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const boundaryMargin = 20;
    
    if (newLeft < boundaryMargin) newLeft = boundaryMargin;
    if (newTop < boundaryMargin) newTop = boundaryMargin;
    
    if (newLeft + rect.width > viewportWidth - boundaryMargin) {
      newLeft = viewportWidth - rect.width - boundaryMargin;
    }
    
    if (newTop + rect.height > viewportHeight - boundaryMargin) {
      newTop = viewportHeight - rect.height - boundaryMargin;
    }
    
    // Apply new positions
    chatWindow.style.left = newLeft + 'px';
    chatWindow.style.top = newTop + 'px';
    chatWindow.style.bottom = 'auto'; // reset bottom/right when dragging
    chatWindow.style.right = 'auto';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    chatWindow.classList.remove('dragging');
  });
  
  // Initial size for S (smaller than before)
  // Width is set by the size-s class
  
  // Initial position if not set
  if (!chatWindow.style.top && !chatWindow.style.bottom) {
    chatWindow.style.top = '80px';
  }
  
  if (!chatWindow.style.left && !chatWindow.style.right) {
    chatWindow.style.right = '20px';
  }
  
  // Ensure panel is within viewport initially and after resize
  ensurePanelInViewport(chatWindow);
  window.addEventListener('resize', () => ensurePanelInViewport(chatWindow));
}

// Export ensurePanelInViewport to make it available globally
export function ensurePanelInViewport(panel: HTMLElement): void {
  const rect = panel.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const boundaryMargin = 20;
  
  let newLeft = rect.left;
  let newTop = rect.top;
  let needsRepositioning = false;
  
  // Check right edge
  if (rect.right > viewportWidth - boundaryMargin) {
    newLeft = viewportWidth - rect.width - boundaryMargin;
    needsRepositioning = true;
  }
  
  // Check bottom edge
  if (rect.bottom > viewportHeight - boundaryMargin) {
    newTop = viewportHeight - rect.height - boundaryMargin;
    needsRepositioning = true;
  }
  
  // Check left edge
  if (rect.left < boundaryMargin) {
    newLeft = boundaryMargin;
    needsRepositioning = true;
  }
  
  // Check top edge
  if (rect.top < boundaryMargin) {
    newTop = boundaryMargin;
    needsRepositioning = true;
  }
  
  // Apply new position if needed
  if (needsRepositioning) {
    panel.style.left = `${newLeft}px`;
    panel.style.top = `${newTop}px`;
    panel.style.bottom = 'auto';
    panel.style.right = 'auto';
  }
}

// Make our functions available globally
window.ensurePanelInViewport = ensurePanelInViewport; 