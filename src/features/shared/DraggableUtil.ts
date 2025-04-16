/**
 * Draggable Utility
 * A utility to make HTML elements draggable
 */

/**
 * Makes an element draggable
 * @param element The element to make draggable
 * @param dragHandle Optional handle element (if not provided, the entire element is draggable)
 */
export function makeDraggable(element: HTMLElement, dragHandle?: HTMLElement) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  const handle = dragHandle || element;
  let isDragging = false;
  
  if (handle) {
    handle.addEventListener('mousedown', dragMouseDown);
    handle.style.cursor = 'move';
  }
  
  function dragMouseDown(e: MouseEvent) {
    e.preventDefault();
    // Get the mouse cursor position at startup
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    isDragging = true;
    
    // Add event listeners for move and end
    document.addEventListener('mousemove', elementDrag);
    document.addEventListener('mouseup', closeDragElement);
  }
  
  function elementDrag(e: MouseEvent) {
    if (!isDragging) return;
    
    e.preventDefault();
    // Calculate the new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // Check bounds to prevent dragging off screen
    let newTop = element.offsetTop - pos2;
    let newLeft = element.offsetLeft - pos1;
    
    // Make sure we don't drag off-screen
    if (newTop < 0) newTop = 0;
    if (newLeft < 0) newLeft = 0;
    
    if (newTop + element.clientHeight > window.innerHeight) {
      newTop = window.innerHeight - element.clientHeight;
    }
    
    if (newLeft + element.clientWidth > window.innerWidth) {
      newLeft = window.innerWidth - element.clientWidth;
    }
    
    // Set the element's new position
    element.style.top = newTop + "px";
    element.style.left = newLeft + "px";
    
    // Save position for specific elements
    if (element.id === 'wordstream-chat-panel') {
      localStorage.setItem('wordstream-chat-panel-position', JSON.stringify({
        top: element.style.top,
        left: element.style.left
      }));
    } else if (element.id === 'wordstream-notes-panel') {
      localStorage.setItem('wordstream-notes-panel-position', JSON.stringify({
        top: element.style.top,
        left: element.style.left
      }));
    } else if (element.id === 'wordstream-container') {
      localStorage.setItem('wordstream-container-position', JSON.stringify({
        top: element.style.top,
        left: element.style.left
      }));
    }
  }
  
  function closeDragElement() {
    // Stop moving when mouse button is released
    isDragging = false;
    document.removeEventListener('mousemove', elementDrag);
    document.removeEventListener('mouseup', closeDragElement);
  }
} 