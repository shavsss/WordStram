/**
 * Shared styles for WordStram2 panels (Chat and Notes)
 */

/**
 * Applies improved styles to the WordStram2 panels
 */
export function applyPanelStyles(): void {
  if (document.querySelector('#wordstream-panel-styles')) {
    return;
  }
  
  const styleElement = document.createElement('style');
  styleElement.id = 'wordstream-panel-styles';
  styleElement.textContent = `
    /* Fix white background and overflow issues - more aggressive styling */
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: transparent !important;
      overflow: hidden !important; /* Prevents scrolling and excess background */
    }
    
    body > *, div > *, #root, .wordstream-app, #app, .App, .app-container, .app-wrapper, .extension-container {
      background-color: transparent !important;
    }
    
    #root, .wordstream-app, .app-container, .app-wrapper, #app, .App, .extension-container, .extension-wrapper, .extension-popup {
      width: 100% !important;
      height: 100% !important;
      background-color: transparent !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
    }
    
    /* Force all elements to use box-sizing: border-box */
    *, *::before, *::after {
      box-sizing: border-box !important;
    }
    
    .container, .main-content, .panel-content, .wordstream-panel .panel-content, .content-wrapper, .content-container {
      max-width: 100% !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      background-color: transparent !important;
    }
    
    /* Grok-inspired design with compact, elegant styling */
    /* Base panel styles */
    .wordstream-panel {
      position: fixed !important;
      background-color: #16181c !important; /* Darker, more like Grok */
      color: #ffffff !important;
      border-radius: 16px !important; /* More rounded, Grok-like */
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1) !important;
      z-index: 10000 !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      transition: box-shadow 0.3s ease, transform 0.2s ease !important;
      min-width: 320px !important;
      min-height: 400px !important;
      max-width: 800px !important;
      max-height: 90vh !important;
      height: 600px !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important; /* Elegant border like Grok */
      /* Ensure opaque background with multiple approaches */
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
    
    /* More aggressive background styling for all panel children */
    .wordstream-panel::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #16181c !important;
      z-index: -1;
      border-radius: 16px !important;
    }
    
    /* Make sure nested elements don't have transparent backgrounds */
    .wordstream-panel > * {
      background-color: #16181c !important;
    }
    
    /* Size variations - more compact */
    .wordstream-panel.size-s {
      width: 320px !important;
      height: 450px !important;
      bottom: 10px !important; /* Closer to bottom like Grok */
    }
    
    .wordstream-panel.size-m {
      width: 380px !important;
      height: 550px !important;
      bottom: 10px !important;
    }
    
    .wordstream-panel.size-l {
      width: 450px !important;
      height: 650px !important;
      bottom: 10px !important;
    }
    
    /* Make sure panel is fully visible even at smaller screen sizes */
    @media (max-height: 700px) {
      .wordstream-panel.size-l {
        height: calc(100vh - 50px) !important;
        max-height: 650px !important;
      }
    }
    
    @media (max-height: 600px) {
      .wordstream-panel.size-m {
        height: calc(100vh - 50px) !important;
        max-height: 550px !important;
      }
    }
    
    @media (max-height: 500px) {
      .wordstream-panel.size-s {
        height: calc(100vh - 50px) !important;
        max-height: 450px !important;
      }
    }
    
    /* Light mode - more elegant, Grok-inspired */
    .wordstream-panel.light-mode {
      background-color: #ffffff !important;
      color: #111827 !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05) !important;
      border: 1px solid rgba(0, 0, 0, 0.05) !important;
    }
    
    .wordstream-panel.light-mode::before {
      background-color: #ffffff !important;
    }
    
    .wordstream-panel.light-mode > * {
      background-color: #ffffff !important;
    }
    
    /* Styles when dragging */
    .wordstream-panel.dragging {
      box-shadow: 0 12px 42px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(59, 130, 246, 0.5) !important;
      opacity: 0.98 !important;
      transform: scale(1.005) !important;
      transition: box-shadow 0.2s ease, transform 0.1s ease !important;
    }
    
    .wordstream-panel.light-mode.dragging {
      box-shadow: 0 12px 42px rgba(0, 0, 0, 0.15), 0 0 0 2px rgba(59, 130, 246, 0.5) !important;
    }
    
    /* Panel header - more compact, Grok-like */
    .wordstream-panel .panel-header {
      flex: 0 0 auto !important;
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      padding: 8px 12px !important; /* Smaller padding like Grok */
      background-color: #212327 !important; /* Darker, like Grok */
      border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
      user-select: none !important;
      width: 100% !important;
    }
    
    .wordstream-panel.light-mode .panel-header {
      background-color: #f8fafc !important;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05) !important;
    }
    
    /* Make header draggable visually */
    .wordstream-panel .panel-header.draggable {
      cursor: move !important;
      position: relative !important;
    }
    
    /* Size controls in header */
    .wordstream-panel .size-controls {
      display: flex !important;
      align-items: center !important;
      gap: 3px !important;
      margin-left: auto !important;
      margin-right: 12px !important;
    }
    
    .wordstream-panel .size-button {
      width: 26px !important;
      height: 26px !important;
      border-radius: 8px !important; /* More rounded */
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      background-color: #333639 !important; /* Grok-like */
      color: #ffffff !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      transition: background-color 0.2s ease, border-color 0.2s ease !important;
    }
    
    .wordstream-panel .size-button:hover {
      background-color: #3a416b !important;
    }
    
    .wordstream-panel .size-button.active {
      background-color: #4361ee !important;
      border-color: #3a50e6 !important;
    }
    
    .wordstream-panel.light-mode .size-button {
      background-color: #f1f5f9 !important;
      border-color: #e2e8f0 !important;
      color: #64748b !important;
    }
    
    .wordstream-panel.light-mode .size-button:hover {
      background-color: #e2e8f0 !important;
    }
    
    .wordstream-panel.light-mode .size-button.active {
      background-color: #3b82f6 !important;
      border-color: #2563eb !important;
      color: #ffffff !important;
    }
    
    /* Theme toggle button */
    .wordstream-panel .theme-toggle {
      width: 28px !important;
      height: 28px !important;
      border-radius: 50% !important;
      border: none !important;
      background-color: transparent !important;
      color: #fbbf24 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      cursor: pointer !important;
      transition: background-color 0.2s ease, color 0.2s ease !important;
    }
    
    .wordstream-panel .theme-toggle:hover {
      background-color: rgba(255, 255, 255, 0.1) !important;
    }
    
    .wordstream-panel.light-mode .theme-toggle {
      color: #f59e0b !important;
    }
    
    .wordstream-panel.light-mode .theme-toggle:hover {
      background-color: rgba(0, 0, 0, 0.05) !important;
    }
    
    /* Panel title */
    .wordstream-panel .panel-title {
      margin: 0 !important;
      font-size: 16px !important;
      font-weight: 600 !important;
      color: #ffffff !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    
    .wordstream-panel.light-mode .panel-title {
      color: #111827 !important;
    }
    
    /* Panel controls (close button etc) */
    .wordstream-panel .panel-controls {
      display: flex !important;
      align-items: center !important;
      gap: 6px !important; /* Smaller gap like Grok */
    }
    
    /* Close button */
    .wordstream-panel .close-button {
      background: none !important;
      border: none !important;
      color: #ffffff !important;
      font-size: 18px !important;
      cursor: pointer !important;
      width: 28px !important;
      height: 28px !important;
      border-radius: 50% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: background-color 0.2s ease !important;
      padding: 0 !important;
    }
    
    .wordstream-panel.light-mode .close-button {
      color: #64748b !important;
    }
    
    .wordstream-panel .close-button:hover {
      background-color: rgba(255, 255, 255, 0.15) !important;
    }
    
    .wordstream-panel.light-mode .close-button:hover {
      background-color: rgba(0, 0, 0, 0.05) !important;
    }
    
    /* Panel content */
    .wordstream-panel .panel-content {
      flex: 1 !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      position: relative !important;
      background-color: #16181c !important; /* Darker like Grok */
      width: 100% !important;
      height: calc(100% - 48px) !important; /* Subtract header height */
    }
    
    .wordstream-panel.light-mode .panel-content {
      background-color: #ffffff !important;
    }
    
    /* Two-column layout for history and active content */
    .wordstream-panel .two-column-layout {
      flex: 1 !important;
      display: flex !important;
      overflow: hidden !important;
      width: 100% !important;
    }
    
    .wordstream-panel .history-sidebar {
      width: 260px !important;
      flex-shrink: 0 !important;
      background-color: #212327 !important; /* Darker like Grok */
      border-right: 1px solid rgba(255, 255, 255, 0.05) !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
    }
    
    .wordstream-panel.light-mode .history-sidebar {
      background-color: #f8fafc !important;
      border-right-color: rgba(0, 0, 0, 0.05) !important;
    }
    
    .wordstream-panel .main-content {
      flex: 1 !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      width: 100% !important;
      max-width: 100% !important; /* Ensure no overflow */
      background-color: #16181c !important;
    }
    
    .wordstream-panel.light-mode .main-content {
      background-color: #ffffff !important;
    }
    
    /* Conversation/notes area - scrollable */
    .wordstream-panel .conversation-area,
    .wordstream-panel .notes-container {
      flex: 1 !important;
      overflow-y: auto !important;
      padding: 8px 12px !important; /* Smaller padding like Grok */
      display: flex !important;
      flex-direction: column !important;
      gap: 8px !important; /* Smaller gap like Grok */
      scrollbar-width: thin !important;
      scrollbar-color: #475569 #16181c !important;
      width: 100% !important;
      height: calc(100% - 80px) !important; /* Adjust for input height */
      max-width: 100% !important; /* Prevent horizontal overflow */
      background-color: #16181c !important;
    }
    
    .wordstream-panel.light-mode .conversation-area,
    .wordstream-panel.light-mode .notes-container {
      scrollbar-color: #cbd5e1 #ffffff !important;
      background-color: #ffffff !important;
    }
    
    /* Message styles for chat */
    .wordstream-panel .message {
      max-width: 85% !important;
      padding: 10px !important; /* Smaller padding like Grok */
      border-radius: 16px !important; /* More rounded, Grok-like */
      position: relative !important;
      width: fit-content !important; /* Ensure content fits within container */
      word-wrap: break-word !important; /* Ensure text wraps inside message bubbles */
    }
    
    .wordstream-panel .user-message {
      background-color: #2563eb !important; /* Brighter blue like Grok */
      color: #ffffff !important;
      align-self: flex-end !important;
      border-bottom-right-radius: 4px !important;
      text-align: left !important;
    }
    
    .wordstream-panel .assistant-message {
      background-color: #212327 !important; /* Darker like Grok */
      color: #ffffff !important;
      align-self: flex-start !important;
      border-bottom-left-radius: 4px !important;
      text-align: left !important;
    }
    
    .wordstream-panel.light-mode .assistant-message {
      background-color: #f1f5f9 !important;
      color: #334155 !important;
    }
    
    /* Input container - fixed to bottom */
    .wordstream-panel .input-container,
    .wordstream-panel .panel-footer {
      flex: 0 0 auto !important;
      padding: 8px 12px !important; /* Smaller padding like Grok */
      background-color: #16181c !important; /* Darker like Grok */
      border-top: 1px solid rgba(255, 255, 255, 0.05) !important;
      display: flex !important;
      gap: 6px !important; /* Smaller gap like Grok */
      align-items: center !important;
      width: 100% !important;
      position: absolute !important;
      bottom: 0 !important;
      left: 0 !important;
      right: 0 !important;
      box-sizing: border-box !important; /* Ensure padding is included in width */
    }
    
    .wordstream-panel.light-mode .input-container,
    .wordstream-panel.light-mode .panel-footer {
      background-color: #f8fafc !important;
      border-top: 1px solid rgba(0, 0, 0, 0.05) !important;
    }
    
    /* Text area / input fields */
    .wordstream-panel textarea,
    .wordstream-panel input[type="text"] {
      flex: 1 !important;
      min-height: 40px !important; /* Smaller height, Grok-like */
      max-height: 100px !important; /* Smaller max-height, Grok-like */
      border-radius: 16px !important; /* More rounded, Grok-like */
      background-color: #212327 !important; /* Darker like Grok */
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      color: #ffffff !important;
      padding: 10px 14px !important; /* Smaller padding like Grok */
      outline: none !important;
      resize: none !important;
      font-family: inherit !important;
      font-size: 14px !important;
      width: 100% !important;
      box-sizing: border-box !important;
      transition: border-color 0.2s ease, background-color 0.2s ease !important;
    }
    
    .wordstream-panel.light-mode textarea,
    .wordstream-panel.light-mode input[type="text"] {
      background-color: #ffffff !important;
      border: 1px solid rgba(0, 0, 0, 0.1) !important;
      color: #1e293b !important;
    }
    
    .wordstream-panel textarea::placeholder,
    .wordstream-panel input[type="text"]::placeholder {
      color: #94a3b8;
    }
    
    .wordstream-panel.light-mode textarea::placeholder,
    .wordstream-panel.light-mode input[type="text"]::placeholder {
      color: #94a3b8;
    }
    
    .wordstream-panel textarea:focus,
    .wordstream-panel input[type="text"]:focus {
      border-color: #3b82f6;
      background-color: #333639; /* Darker when focused, Grok-like */
    }
    
    .wordstream-panel.light-mode textarea:focus,
    .wordstream-panel.light-mode input[type="text"]:focus {
      border-color: #3b82f6;
      background-color: #ffffff;
    }
    
    /* Buttons */
    .wordstream-panel .action-button {
      background-color: #2563eb !important; /* Brighter blue like Grok */
      color: #ffffff !important;
      border: none !important;
      border-radius: 16px !important; /* More rounded, Grok-like */
      padding: 6px 12px !important; /* Smaller padding like Grok */
      font-size: 14px !important;
      font-weight: 500 !important;
      cursor: pointer !important;
      transition: background-color 0.2s ease !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 6px !important;
      height: 40px !important; /* Smaller height, Grok-like */
    }
    
    .wordstream-panel .action-button:hover {
      background-color: #1d4ed8 !important; /* Slightly darker blue when hovered */
    }
    
    .wordstream-panel .action-button:disabled {
      background-color: #333639 !important; /* Darker like Grok */
      cursor: not-allowed !important;
    }
    
    .wordstream-panel .send-button {
      border-radius: 16px !important; /* More rounded, Grok-like */
      width: 40px !important; /* Smaller width, Grok-like */
      height: 40px !important; /* Smaller height, Grok-like */
      padding: 0 !important;
    }
    
    /* All other elements inside the panel should have dark background */
    .wordstream-panel * {
      background-color: inherit;
    }
    
    /* Fix any stacking context issues */
    .wordstream-panel {
      isolation: isolate !important;
    }
    
    /* Error message styling */
    .wordstream-panel .error-message {
      color: #ef4444 !important;
      background-color: rgba(239, 68, 68, 0.1) !important;
      padding: 8px 12px !important;
      border-radius: 8px !important;
      margin: 8px !important;
      font-size: 13px !important;
      text-align: center !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
    
    /* Typing indicator for chat */
    .typing-indicator {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 5px;
      height: 20px;
      padding: 5px 10px;
    }
    
    .typing-indicator span {
      display: block;
      width: 8px;
      height: 8px;
      background-color: #4b5563;
      border-radius: 50%;
      opacity: 0.4;
      animation: typingAnimation 1.4s infinite ease-in-out both;
    }
    
    .typing-indicator span:nth-child(1) {
      animation-delay: 0s;
    }
    
    .typing-indicator span:nth-child(2) {
      animation-delay: 0.2s;
    }
    
    .typing-indicator span:nth-child(3) {
      animation-delay: 0.4s;
    }
    
    @keyframes typingAnimation {
      0%, 80%, 100% { 
        transform: scale(0.6);
        opacity: 0.4;
      }
      40% { 
        transform: scale(1);
        opacity: 1;
      }
    }
    
    /* System message styling */
    .system-message {
      width: 100%;
      border-radius: 8px;
      background-color: rgba(59, 130, 246, 0.05);
      border: 1px solid rgba(59, 130, 246, 0.1);
    }
    
    .system-message .message-content {
      padding: 16px;
    }
    
    .system-message h3 {
      margin-top: 0;
      color: #3b82f6;
      font-size: 16px;
    }
    
    /* API Setup message styling */
    .api-setup-message {
      width: 100%;
      border-radius: 8px;
      background-color: rgba(249, 115, 22, 0.05);
      border: 1px solid rgba(249, 115, 22, 0.1);
    }
    
    .api-setup-message h3 {
      margin-top: 0;
      color: #f97316;
      font-size: 16px;
    }
    
    .api-setup-message a {
      color: #2563eb;
      text-decoration: none;
    }
    
    .api-setup-message a:hover {
      text-decoration: underline;
    }
    
    .api-setup-message ol {
      padding-left: 24px;
    }
    
    .api-setup-message li {
      margin-bottom: 8px;
    }
    
    /* User/Assistant message bubbles */
    .message {
      margin-bottom: 12px;
      max-width: 90%;
      animation: fadeIn 0.3s ease-out;
    }
    
    .user-message {
      margin-left: auto;
    }
    
    .assistant-message {
      margin-right: auto;
    }
    
    .user-message .message-content {
      background-color: #3b82f6;
      color: #ffffff;
      border-radius: 12px 12px 0 12px;
      padding: 8px 12px;
    }
    
    .assistant-message .message-content {
      background-color: #f3f4f6;
      color: #1f2937;
      border-radius: 12px 12px 12px 0;
      padding: 8px 12px;
    }
    
    /* Animation for new messages */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    /* Gemini panel specific styling */
    .gemini-panel .conversation-area {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      height: 100%;
      overflow-y: auto;
      flex: 1;
    }
    
    .gemini-panel .panel-content {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
  `;
  
  document.head.appendChild(styleElement);
}

/**
 * Applies theme (light/dark) to a panel
 */
export function togglePanelTheme(panel: HTMLElement): void {
  panel.classList.toggle('light-mode');
}

/**
 * Set panel size (small, medium, large)
 */
export function setPanelSize(panel: HTMLElement, size: 's' | 'm' | 'l'): void {
  // Remove all size classes
  panel.classList.remove('size-s', 'size-m', 'size-l');
  
  // Add the requested size class
  panel.classList.add(`size-${size}`);
  
  // Update active state for size buttons
  const sizeButtons = panel.querySelectorAll('.size-button');
  sizeButtons.forEach(button => {
    if (button instanceof HTMLElement) {
      const buttonSize = button.dataset.size;
      if (buttonSize === size) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    }
  });
}

/**
 * Create SVG icon element
 */
export function createIcon(iconName: string): HTMLElement {
  const iconElement = document.createElement('span');
  
  switch (iconName) {
    case 'sun':
      iconElement.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      `;
      break;
    case 'moon':
      iconElement.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      `;
      break;
    case 'close':
      iconElement.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
      break;
    case 'send':
      iconElement.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      `;
      break;
    case 'jump':
      iconElement.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="13 17 18 12 13 7"></polyline>
          <polyline points="6 17 11 12 6 7"></polyline>
        </svg>
      `;
      break;
    case 'play':
      iconElement.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
      `;
      break;
    case 'time':
      iconElement.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      `;
      break;
    case 'edit':
      iconElement.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      `;
      break;
    case 'delete':
      iconElement.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      `;
      break;
    case 'note':
      iconElement.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      `;
      break;
    case 'chat':
      iconElement.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      `;
      break;
    case 'export':
      iconElement.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
      `;
      break;
    default:
      iconElement.textContent = iconName; // Fallback to text
  }
  
  return iconElement;
}

/**
 * Resize handle types
 */
export type ResizeHandlePosition = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/**
 * Adds resize handles to a panel for manual resizing
 */
export function addResizeHandles(panel: HTMLElement): void {
  // Positions for resize handles
  const positions: ResizeHandlePosition[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  
  positions.forEach(pos => {
    const handle = document.createElement('div');
    handle.className = `resize-handle resize-${pos}`;
    handle.setAttribute('data-direction', pos);
    panel.appendChild(handle);
  });
} 