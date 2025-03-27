import { initializeFirebase } from './firebase/firebase-config';
import { getAuthInstance } from './firebase/firebase-config';
import { createAuthContainer } from './components/auth/auth-container';
import { getUserData, Word, deleteWord } from './services/data-service';

// Initialize Firebase
initializeFirebase();

// Global state
let words: Word[] = [];
let filteredWords: Word[] = [];
let currentPage = 1;
const pageSize = 20;
let currentSortMethod = 'newest';
let currentFilter = 'all';
let searchQuery = '';

document.addEventListener('DOMContentLoaded', () => {
  const authContainer = document.getElementById('auth-container');
  const wordsContainer = document.getElementById('words-container');
  const wordsContent = document.getElementById('words-content');
  const userProfile = document.getElementById('user-profile');
  const pagination = document.getElementById('pagination');
  
  if (!authContainer || !wordsContainer || !wordsContent || !userProfile || !pagination) {
    console.error('Required elements not found');
    return;
  }
  
  // Initialize auth container
  const { onAuthStateChange } = createAuthContainer(authContainer);
  
  // Handle auth state changes
  onAuthStateChange((user) => {
    if (user) {
      // User is authenticated, hide auth container and show words
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
      
      // Show words container
      wordsContainer.style.display = 'flex';
      
      // Load user data
      loadUserData(user.uid);
    } else {
      // User is not authenticated, show auth container
      authContainer.style.display = 'block';
      wordsContainer.style.display = 'none';
      userProfile.style.display = 'none';
      
      // Clear words data
      words = [];
      filteredWords = [];
    }
  });
  
  // Add event listeners for UI controls
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
    filterAndDisplayWords();
  });
  
  document.getElementById('sort-select')?.addEventListener('change', (e) => {
    currentSortMethod = (e.target as HTMLSelectElement).value;
    filterAndDisplayWords();
  });
  
  document.getElementById('filter-select')?.addEventListener('change', (e) => {
    currentFilter = (e.target as HTMLSelectElement).value;
    filterAndDisplayWords();
  });
});

/**
 * Load user data from Firestore
 */
async function loadUserData(userId: string) {
  const wordsContent = document.getElementById('words-content');
  if (!wordsContent) return;
  
  try {
    // Show loading state
    wordsContent.innerHTML = '<div class="loading">Loading words...</div>';
    
    // Fetch user data
    const userData = await getUserData(userId);
    
    if (!userData || !userData.words || Object.keys(userData.words).length === 0) {
      // No words found
      displayEmptyState();
    } else {
      // Convert words object to array for easier processing
      words = Object.values(userData.words);
      
      // Initial filtering and display
      filterAndDisplayWords();
    }
  } catch (error) {
    console.error('Error loading user data:', error);
    wordsContent.innerHTML = `
      <div class="empty-state">
        <h3>Error loading words</h3>
        <p>There was a problem loading your vocabulary. Please try again later.</p>
      </div>
    `;
  }
}

/**
 * Apply filters and sort to words, then display them
 */
function filterAndDisplayWords() {
  // Step 1: Apply search filter
  if (searchQuery) {
    filteredWords = words.filter(word => 
      word.original.toLowerCase().includes(searchQuery) || 
      word.translation.toLowerCase().includes(searchQuery)
    );
  } else {
    filteredWords = [...words];
  }
  
  // Step 2: Apply category filter
  if (currentFilter === 'recent') {
    // Last 7 days
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    filteredWords = filteredWords.filter(word => word.timestamp > oneWeekAgo);
  } else if (currentFilter === 'youtube') {
    // YouTube videos
    filteredWords = filteredWords.filter(word => 
      word.videoId && (word.videoTitle?.includes('YouTube') || word.context?.includes('YouTube'))
    );
  } else if (currentFilter === 'netflix') {
    // Netflix videos
    filteredWords = filteredWords.filter(word => 
      word.videoId && (word.videoTitle?.includes('Netflix') || word.context?.includes('Netflix'))
    );
  }
  
  // Step 3: Apply sorting
  if (currentSortMethod === 'newest') {
    filteredWords.sort((a, b) => b.timestamp - a.timestamp);
  } else if (currentSortMethod === 'oldest') {
    filteredWords.sort((a, b) => a.timestamp - b.timestamp);
  } else if (currentSortMethod === 'original') {
    filteredWords.sort((a, b) => a.original.localeCompare(b.original));
  } else if (currentSortMethod === 'translation') {
    filteredWords.sort((a, b) => a.translation.localeCompare(b.translation));
  }
  
  // Step 4: Display words with pagination
  displayWords();
  updatePagination();
}

/**
 * Display words in the UI
 */
function displayWords() {
  const wordsContent = document.getElementById('words-content');
  if (!wordsContent) return;
  
  // Calculate pagination
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedWords = filteredWords.slice(startIndex, endIndex);
  
  if (filteredWords.length === 0) {
    // No words match the filters
    wordsContent.innerHTML = `
      <div class="empty-state">
        <h3>No words found</h3>
        <p>No words match your current filters. Try changing your search or filter settings.</p>
      </div>
    `;
    return;
  }
  
  // Create table for words
  let tableHtml = `
    <table class="words-list">
      <thead>
        <tr>
          <th style="width: 20%">Original</th>
          <th style="width: 20%">Translation</th>
          <th style="width: 35%">Context</th>
          <th style="width: 15%">Date</th>
          <th style="width: 10%">Actions</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  // Add rows for each word
  paginatedWords.forEach(word => {
    const date = new Date(word.timestamp);
    const formattedDate = date.toLocaleDateString();
    
    tableHtml += `
      <tr data-id="${word.id}">
        <td class="word-original">${word.original}</td>
        <td>${word.translation}</td>
        <td class="word-context">${word.context || 'No context'}</td>
        <td class="word-date">${formattedDate}</td>
        <td class="words-actions-cell">
          <button class="word-action-btn delete-btn" data-id="${word.id}">Delete</button>
        </td>
      </tr>
    `;
  });
  
  tableHtml += `
      </tbody>
    </table>
  `;
  
  // Update content
  wordsContent.innerHTML = tableHtml;
  
  // Add event listeners for delete buttons
  document.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', handleDeleteWord);
  });
}

/**
 * Handle word deletion
 */
async function handleDeleteWord(e: Event) {
  const button = e.target as HTMLButtonElement;
  const wordId = button.getAttribute('data-id');
  
  if (!wordId) return;
  
  // Confirm deletion
  const confirmDelete = confirm('Are you sure you want to delete this word?');
  if (!confirmDelete) return;
  
  try {
    const auth = getAuthInstance();
    if (!auth.currentUser) return;
    
    // Delete word from Firestore
    await deleteWord(auth.currentUser.uid, wordId);
    
    // Remove word from local data
    words = words.filter(word => word.id !== wordId);
    filteredWords = filteredWords.filter(word => word.id !== wordId);
    
    // Re-render words
    filterAndDisplayWords();
    
    // Show success toast
    showToast('Word deleted successfully', 'success');
  } catch (error) {
    console.error('Error deleting word:', error);
    showToast('Error deleting word', 'error');
  }
}

/**
 * Update pagination UI
 */
function updatePagination() {
  const pagination = document.getElementById('pagination');
  if (!pagination) return;
  
  // Calculate total pages
  const totalPages = Math.ceil(filteredWords.length / pageSize);
  
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
      filterAndDisplayWords();
    }
  });
  
  document.querySelector('.next-btn')?.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      filterAndDisplayWords();
    }
  });
  
  document.querySelectorAll('.page-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      const pageButton = e.target as HTMLButtonElement;
      const page = parseInt(pageButton.getAttribute('data-page') || '1');
      currentPage = page;
      filterAndDisplayWords();
    });
  });
}

/**
 * Display empty state when no words are found
 */
function displayEmptyState() {
  const wordsContent = document.getElementById('words-content');
  if (!wordsContent) return;
  
  wordsContent.innerHTML = `
    <div class="empty-state">
      <h3>No words saved yet</h3>
      <p>Start watching videos and save words to build your vocabulary.</p>
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