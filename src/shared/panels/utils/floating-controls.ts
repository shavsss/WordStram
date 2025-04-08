/**
 * FloatingControls utility
 * שירות צף לפקדים במסך
 */

/**
 * Options for floating controls
 * אפשרויות לפקדים צפים
 */
export interface FloatingControlsOptions {
  /**
   * Initial position of the controls
   * מיקום התחלתי של הפקדים
   */
  position?: {
    /**
     * X coordinate
     * קואורדינטה X
     */
    x: number;
    
    /**
     * Y coordinate
     * קואורדינטה Y
     */
    y: number;
  };
  
  /**
   * Whether to show the controls immediately
   * האם להציג את הפקדים מיד
   */
  show?: boolean;
  
  /**
   * CSS classes to add to the controls
   * מחלקות CSS להוספה לפקדים
   */
  className?: string;
  
  /**
   * Element to attach the controls to
   * אלמנט להצמדת הפקדים אליו
   */
  target?: HTMLElement;
}

/**
 * Create draggable floating controls
 * יצירת פקדים צפים גרירים
 * @param id ID for the controls
 * @param content HTML content for the controls
 * @param options Options for the controls
 * @returns The created controls element
 */
export function createFloatingControls(
  id: string,
  content: string | HTMLElement,
  options: FloatingControlsOptions = {}
): HTMLElement {
  // Check if controls already exist
  // בדיקה אם הפקדים כבר קיימים
  const existingControls = document.getElementById(id);
  if (existingControls) {
    existingControls.remove();
  }
  
  // Create controls container
  // יצירת מיכל הפקדים
  const controls = document.createElement('div');
  controls.id = id;
  controls.className = `floating-controls ${options.className || ''}`;
  controls.style.position = 'fixed';
  controls.style.zIndex = '9999';
  controls.style.background = 'white';
  controls.style.padding = '10px';
  controls.style.borderRadius = '5px';
  controls.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
  controls.style.cursor = 'move';
  controls.style.userSelect = 'none';
  controls.style.display = options.show === false ? 'none' : 'block';
  
  // Set initial position
  // הגדרת מיקום התחלתי
  if (options.position) {
    controls.style.left = `${options.position.x}px`;
    controls.style.top = `${options.position.y}px`;
  } else {
    controls.style.right = '20px';
    controls.style.top = '20px';
  }
  
  // Add content
  // הוספת תוכן
  if (typeof content === 'string') {
    controls.innerHTML = content;
  } else {
    controls.appendChild(content);
  }
  
  // Add to target or document body
  // הוספה לאלמנט יעד או לגוף המסמך
  const target = options.target || document.body;
  target.appendChild(controls);
  
  // Make draggable
  // הפיכה לגריר
  addDraggableCode(controls);
  
  return controls;
}

/**
 * Add draggable functionality to an element
 * הוספת פונקציונליות גרירה לאלמנט
 * @param element Element to make draggable
 */
export function addDraggableCode(element: HTMLElement): void {
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;
  
  element.addEventListener('mousedown', startDrag);
  element.addEventListener('touchstart', handleTouchStart, { passive: false });
  
  function startDrag(e: MouseEvent): void {
    isDragging = true;
    offsetX = e.clientX - element.getBoundingClientRect().left;
    offsetY = e.clientY - element.getBoundingClientRect().top;
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
    
    e.preventDefault();
  }
  
  function handleTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      offsetX = touch.clientX - element.getBoundingClientRect().left;
      offsetY = touch.clientY - element.getBoundingClientRect().top;
      
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      
      e.preventDefault();
    }
  }
  
  function drag(e: MouseEvent): void {
    if (isDragging) {
      const left = e.clientX - offsetX;
      const top = e.clientY - offsetY;
      
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
      
      e.preventDefault();
    }
  }
  
  function handleTouchMove(e: TouchEvent): void {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const left = touch.clientX - offsetX;
      const top = touch.clientY - offsetY;
      
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
      
      e.preventDefault();
    }
  }
  
  function stopDrag(): void {
    isDragging = false;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
  }
  
  function handleTouchEnd(): void {
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  }
}

/**
 * Add exact functionality for draggable floating controls used by detectors
 * הוספת פונקציונליות מדויקת לפקדים צפים גרירים המשמשים גלאים
 * @param element Element to make draggable
 */
export function addExactDraggableCode(element: HTMLElement): void {
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;
  
  element.addEventListener('mousedown', startDrag);
  element.addEventListener('touchstart', handleTouchStart, { passive: false });
  
  function startDrag(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    
    // Don't start drag if clicking a button or interactive element
    // לא להתחיל גרירה אם לוחצים על כפתור או אלמנט אינטראקטיבי
    if (target.tagName === 'BUTTON' || 
        target.tagName === 'INPUT' || 
        target.tagName === 'SELECT' || 
        target.tagName === 'A' ||
        target.closest('.non-draggable')) {
      return;
    }
    
    isDragging = true;
    offsetX = e.clientX - element.getBoundingClientRect().left;
    offsetY = e.clientY - element.getBoundingClientRect().top;
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
    
    e.preventDefault();
  }
  
  function handleTouchStart(e: TouchEvent): void {
    const target = e.target as HTMLElement;
    
    // Don't start drag if touching a button or interactive element
    // לא להתחיל גרירה אם נוגעים בכפתור או אלמנט אינטראקטיבי
    if (target.tagName === 'BUTTON' || 
        target.tagName === 'INPUT' || 
        target.tagName === 'SELECT' || 
        target.tagName === 'A' ||
        target.closest('.non-draggable')) {
      return;
    }
    
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      offsetX = touch.clientX - element.getBoundingClientRect().left;
      offsetY = touch.clientY - element.getBoundingClientRect().top;
      
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      
      e.preventDefault();
    }
  }
  
  function drag(e: MouseEvent): void {
    if (isDragging) {
      const left = e.clientX - offsetX;
      const top = e.clientY - offsetY;
      
      // Keep within window bounds
      // שמירה בתוך גבולות החלון
      const maxX = window.innerWidth - element.offsetWidth;
      const maxY = window.innerHeight - element.offsetHeight;
      
      element.style.left = `${Math.max(0, Math.min(left, maxX))}px`;
      element.style.top = `${Math.max(0, Math.min(top, maxY))}px`;
      
      e.preventDefault();
    }
  }
  
  function handleTouchMove(e: TouchEvent): void {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const left = touch.clientX - offsetX;
      const top = touch.clientY - offsetY;
      
      // Keep within window bounds
      // שמירה בתוך גבולות החלון
      const maxX = window.innerWidth - element.offsetWidth;
      const maxY = window.innerHeight - element.offsetHeight;
      
      element.style.left = `${Math.max(0, Math.min(left, maxX))}px`;
      element.style.top = `${Math.max(0, Math.min(top, maxY))}px`;
      
      e.preventDefault();
    }
  }
  
  function stopDrag(): void {
    isDragging = false;
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
  }
  
  function handleTouchEnd(): void {
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  }
}

export default {
  addExactDraggableCode,
  createFloatingControls,
  addDraggableCode
}; 