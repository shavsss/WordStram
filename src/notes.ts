import { initializeFirebase } from './firebase/firebase-config';
import { getAuthInstance } from './firebase/firebase-config';
import { createAuthContainer } from './components/auth/auth-container';
import { getUserData, Note, deleteNote } from './services/data-service';

// Initialize Firebase
initializeFirebase();

// Global state
let notes: Note[] = [];
let filteredNotes: Note[] = [];
let currentPage = 1;
const pageSize = 12; // Show 12 notes per page (grid layout)
let currentSortMethod = 'newest';
let currentFilter = 'all';
let searchQuery = '';

document.addEventListener('DOMContentLoaded', () => {
  const authContainer = document.getElementById('auth-container');
  const notesContainer = document.getElementById('notes-container');
  const notesContent = document.getElementById('notes-content');
  const userProfile = document.getElementById('user-profile');
  const pagination = document.getElementById('pagination');
  
  if (!authContainer || !notesContainer || !notesContent || !userProfile || !pagination) {
    console.error('Required elements not found');
    return;
  }
  
  // Initialize auth container
  const { onAuthStateChange } = createAuthContainer(authContainer);
  
  // Handle auth state changes
  onAuthStateChange((user) => {
    if (user) {
      // User is authenticated, hide auth container and show notes
      authContainer.style.display = 'none';
      
      // Show user profile
      userProfile.style.display = 'flex';
      const avatar = userProfile.querySelector('.user-avatar');
      const name = userProfile.querySelector('.user-name');
      
      if (avatar && name) {
        const displayName = user.displayName || user.email || 'User';
        avatar.textContent = displayName.charAt(0).toUpperCase();
        name.textContent = displayName;
      }
      
      // Show notes container
      notesContainer.style.display = 'flex';
      
      // Load user data
      loadUserData(user.uid);
    } else {
      // User is not authenticated, show auth container
      authContainer.style.display = 'block';
      notesContainer.style.display = 'none';
      userProfile.style.display = 'none';
      
      // Clear notes data
      notes = [];
      filteredNotes = [];
    }
  });
  
  // Add event listeners for UI controls
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
    filterAndDisplayNotes();
  });
  
  document.getElementById('sort-select')?.addEventListener('change', (e) => {
    currentSortMethod = (e.target as HTMLSelectElement).value;
    filterAndDisplayNotes();
  });
  
  document.getElementById('filter-select')?.addEventListener('change', (e) => {
    currentFilter = (e.target as HTMLSelectElement).value;
    filterAndDisplayNotes();
  });
});

/**
 * Load user data from Firestore
 */
async function loadUserData(userId: string) {
  const notesContent = document.getElementById('notes-content');
  if (!notesContent) return;
  
  try {
    // Show loading state
    notesContent.innerHTML = '<div class="loading">Loading notes...</div>';
    
    // Fetch user data
    const userData = await getUserData(userId);
    
    if (!userData || !userData.notes || Object.keys(userData.notes).length === 0) {
      // No notes found
      displayEmptyState();
    } else {
      // Convert notes object to array for easier processing
      notes = Object.values(userData.notes);
      
      // Initial filtering and display
      filterAndDisplayNotes();
    }
  } catch (error) {
    console.error('Error loading user data:', error);
    notesContent.innerHTML = `
      <div class="empty-state">
        <h3>Error loading notes</h3>
        <p>There was a problem loading your notes. Please try again later.</p>
      </div>
    `;
  }
}

/**
 * Apply filters and sort to notes, then display them
 */
function filterAndDisplayNotes() {
  // Step 1: Apply search filter
  if (searchQuery) {
    filteredNotes = notes.filter(note => 
      note.text.toLowerCase().includes(searchQuery) || 
      (note.videoTitle && note.videoTitle.toLowerCase().includes(searchQuery))
    );
  } else {
    filteredNotes = [...notes];
  }
  
  // Step 2: Apply category filter
  if (currentFilter === 'recent') {
    // Last 7 days
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    filteredNotes = filteredNotes.filter(note => note.timestamp > oneWeekAgo);
  } else if (currentFilter === 'youtube') {
    // YouTube videos
    filteredNotes = filteredNotes.filter(note => 
      note.videoId && (note.videoTitle?.includes('YouTube') || note.videoId.startsWith('yt-'))
    );
  } else if (currentFilter === 'netflix') {
    // Netflix videos
    filteredNotes = filteredNotes.filter(note => 
      note.videoId && (note.videoTitle?.includes('Netflix') || note.videoId.startsWith('nf-'))
    );
  }
  
  // Step 3: Apply sorting
  if (currentSortMethod === 'newest') {
    filteredNotes.sort((a, b) => b.timestamp - a.timestamp);
  } else if (currentSortMethod === 'oldest') {
    filteredNotes.sort((a, b) => a.timestamp - b.timestamp);
  }
  
  // Step 4: Display notes with pagination
  displayNotes();
  updatePagination();
}

/**
 * Display notes in the UI as a grid
 */
function displayNotes() {
  const notesContent = document.getElementById('notes-content');
  if (!notesContent) return;
  
  // Calculate pagination
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedNotes = filteredNotes.slice(startIndex, endIndex);
  
  if (filteredNotes.length === 0) {
    // No notes match the filters
    notesContent.innerHTML = `
      <div class="empty-state">
        <h3>No notes found</h3>
        <p>No notes match your current filters. Try changing your search or filter settings.</p>
      </div>
    `;
    return;
  }
  
  // Create grid for notes
  const notesGrid = document.createElement('div');
  notesGrid.className = 'notes-grid';
  
  // Add cards for each note
  paginatedNotes.forEach(note => {
    const date = new Date(note.timestamp);
    const formattedDate = date.toLocaleDateString();
    
    const noteCard = document.createElement('div');
    noteCard.className = 'note-card';
    noteCard.setAttribute('data-id', note.id);
    
    // Truncate note text if too long
    const maxTextLength = 300;
    let displayText = note.text;
    
    if (displayText.length > maxTextLength) {
      displayText = displayText.substring(0, maxTextLength) + '...';
    }
    
    // Replace newlines with <br> for HTML display
    displayText = displayText.replace(/\n/g, '<br>');
    
    noteCard.innerHTML = `
      <div class="note-content">${displayText}</div>
      <div class="note-meta">
        <div class="note-video-title">${note.videoTitle || 'Unknown video'}</div>
        <div class="note-date">${formattedDate}</div>
      </div>
      <div class="note-actions">
        <button class="note-action-btn" data-action="view" data-id="${note.id}">View</button>
        <button class="note-action-btn delete-btn" data-action="delete" data-id="${note.id}">Delete</button>
      </div>
    `;
    
    notesGrid.appendChild(noteCard);
  });
  
  // Update content
  notesContent.innerHTML = '';
  notesContent.appendChild(notesGrid);
  
  // Add event listeners for action buttons
  document.querySelectorAll('.note-action-btn').forEach(button => {
    button.addEventListener('click', handleNoteAction);
  });
}

/**
 * Handle note actions (view or delete)
 */
function handleNoteAction(e: Event) {
  const button = e.target as HTMLButtonElement;
  const noteId = button.getAttribute('data-id');
  const action = button.getAttribute('data-action');
  
  if (!noteId) return;
  
  if (action === 'view') {
    showNoteDetail(noteId);
  } else if (action === 'delete') {
    handleDeleteNote(noteId);
  }
}

/**
 * Show note detail in a modal
 */
function showNoteDetail(noteId: string) {
  const note = notes.find(n => n.id === noteId);
  if (!note) return;
  
  // Create modal overlay
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `;
  
  // Format note date
  const date = new Date(note.timestamp);
  const formattedDate = date.toLocaleString();
  
  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  modalContent.style.cssText = `
    background-color: white;
    border-radius: 8px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    padding: 24px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  `;
  
  // Replace newlines with <br> for HTML display
  const noteText = note.text.replace(/\n/g, '<br>');
  
  modalContent.innerHTML = `
    <h3 style="margin-top: 0;">${note.videoTitle || 'Note'}</h3>
    <p style="white-space: pre-wrap; line-height: 1.5;">${noteText}</p>
    <div style="color: var(--light-text); font-size: 14px; margin-top: 16px;">
      ${formattedDate}
    </div>
    <div style="margin-top: 24px; text-align: right;">
      <button class="close-modal-btn" style="
        padding: 8px 16px;
        background-color: var(--primary-color);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      ">Close</button>
    </div>
  `;
  
  // Add to DOM
  modalOverlay.appendChild(modalContent);
  document.body.appendChild(modalOverlay);
  
  // Close modal on button click or overlay click
  document.querySelector('.close-modal-btn')?.addEventListener('click', () => {
    document.body.removeChild(modalOverlay);
  });
  
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      document.body.removeChild(modalOverlay);
    }
  });
}

/**
 * Handle note deletion
 */
async function handleDeleteNote(noteId: string) {
  // Confirm deletion
  const confirmDelete = confirm('Are you sure you want to delete this note?');
  if (!confirmDelete) return;
  
  try {
    const auth = getAuthInstance();
    if (!auth.currentUser) return;
    
    // Delete note from Firestore
    await deleteNote(auth.currentUser.uid, noteId);
    
    // Remove note from local data
    notes = notes.filter(note => note.id !== noteId);
    filteredNotes = filteredNotes.filter(note => note.id !== noteId);
    
    // Re-render notes
    filterAndDisplayNotes();
    
    // Show success toast
    showToast('Note deleted successfully', 'success');
  } catch (error) {
    console.error('Error deleting note:', error);
    showToast('Error deleting note', 'error');
  }
}

/**
 * Update pagination UI
 */
function updatePagination() {
  const pagination = document.getElementById('pagination');
  if (!pagination) return;
  
  // Calculate total pages
  const totalPages = Math.ceil(filteredNotes.length / pageSize);
  
  if (totalPages <= 1) {
    // No pagination needed
    pagination.innerHTML = '';
    return;
  }
  
  // Create pagination buttons
  let paginationHtml = '';
  
  // Previous button
  paginationHtml += `
    <button class="pagination-btn prev-btn" ${currentPage === 1 ? 'disabled' : ''}>
      &laquo; Previous
    </button>
  `;
  
  // Page buttons
  const maxButtons = 5;
  const startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  const endPage = Math.min(totalPages, startPage + maxButtons - 1);
  
  for (let i = startPage; i <= endPage; i++) {
    paginationHtml += `
      <button class="pagination-btn page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">
        ${i}
      </button>
    `;
  }
  
  // Next button
  paginationHtml += `
    <button class="pagination-btn next-btn" ${currentPage === totalPages ? 'disabled' : ''}>
      Next &raquo;
    </button>
  `;
  
  // Update content
  pagination.innerHTML = paginationHtml;
  
  // Add event listeners
  document.querySelector('.prev-btn')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      filterAndDisplayNotes();
    }
  });
  
  document.querySelector('.next-btn')?.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      filterAndDisplayNotes();
    }
  });
  
  document.querySelectorAll('.page-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const pageButton = e.target as HTMLButtonElement;
      const page = parseInt(pageButton.getAttribute('data-page') || '1');
      currentPage = page;
      filterAndDisplayNotes();
    });
  });
}

/**
 * Display empty state when no notes are found
 */
function displayEmptyState() {
  const notesContent = document.getElementById('notes-content');
  if (!notesContent) return;
  
  notesContent.innerHTML = `
    <div class="empty-state">
      <h3>No notes saved yet</h3>
      <p>Start watching videos and take notes to build your collection.</p>
      <a href="https://youtube.com" class="start-btn" target="_blank">Start Watching on YouTube</a>
    </div>
  `;
}

/**
 * Show toast notification
 */
function showToast(message: string, type: 'success' | 'error' = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 16px;
    background-color: ${type === 'success' ? 'var(--success-color)' : 'var(--danger-color)'};
    color: white;
    border-radius: 4px;
    font-size: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    z-index: 1000;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  
  // Fade in
  setTimeout(() => {
    toast.style.opacity = '1';
  }, 10);
  
  // Fade out and remove
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
} 