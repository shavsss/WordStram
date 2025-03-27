import { initializeFirebase } from './firebase/firebase-config';
import { createAuthContainer } from './components/auth/auth-container';
import { listenToUserData, UserData, Word, Note } from './services/data-service';
import { User } from 'firebase/auth';

// Initialize Firebase
initializeFirebase();

// Wait for DOM content to be loaded
document.addEventListener('DOMContentLoaded', () => {
  // Get container elements
  const appContainer = document.getElementById('app-container');
  const authContainer = document.getElementById('auth-container');
  const dataContainer = document.getElementById('data-container');
  
  if (!appContainer || !authContainer || !dataContainer) {
    console.error('Required containers not found in the DOM');
    return;
  }
  
  // Initialize auth container with callback for auth state changes
  const { onAuthStateChange } = createAuthContainer(authContainer);

  // Handle auth state changes
  onAuthStateChange((user: User | null) => {
    handleAuthChange(user);
    
    // If user is authenticated, listen for their data
    if (user) {
      listenToUserData(user.uid, renderUserData);
    }
  });
  
  // Function to handle authentication state changes
  function handleAuthChange(user: User | null) {
    if (user) {
      dataContainer!.style.display = 'block';
      
      // Set initial loading state
      dataContainer!.innerHTML = '<div class="loading">Loading data...</div>';
    } else {
      dataContainer!.style.display = 'none';
    }
  }
  
  // Function to render user data in the data container
  function renderUserData(userData: UserData | null) {
    if (!userData) {
      dataContainer!.innerHTML = '<div class="empty-state">No data available. Start watching videos to collect words!</div>';
      return;
    }

    dataContainer!.innerHTML = '';
    
    // Create stats section
    const statsSection = document.createElement('section');
    statsSection.innerHTML = `
      <h3>Your Statistics</h3>
      <div class="stats-container">
        <div class="stat-item">
          <div class="stat-value">${userData.stats?.totalWords || 0}</div>
          <div class="stat-label">Words</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${userData.stats?.videosWatched || 0}</div>
          <div class="stat-label">Videos</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${userData.stats?.totalNotes || 0}</div>
          <div class="stat-label">Notes</div>
        </div>
      </div>
    `;

    // Create recent words section
    const wordsSection = document.createElement('section');
    wordsSection.innerHTML = `<h3>Recent Words</h3>`;

    if (userData.words && Object.keys(userData.words).length > 0) {
      const wordsList = document.createElement('ul');
      wordsList.className = 'words-list';
      
      // Get the 5 most recent words
      const recentWords = Object.values(userData.words)
        .sort((a: Word, b: Word) => b.timestamp - a.timestamp)
        .slice(0, 5);
        
      recentWords.forEach((word: Word) => {
        const wordItem = document.createElement('li');
        wordItem.className = 'word-item';
        wordItem.innerHTML = `
          <span class="word-original">${word.original}</span>
          <span class="word-translation">${word.translation}</span>
        `;
        wordsList.appendChild(wordItem);
      });
      
      wordsSection.appendChild(wordsList);
      
      if (Object.keys(userData.words).length > 5) {
        const viewAllLink = document.createElement('a');
        viewAllLink.href = '#';
        viewAllLink.className = 'view-all-link';
        viewAllLink.textContent = 'View all words';
        viewAllLink.onclick = () => {
          // Open words page
          chrome.tabs.create({ url: chrome.runtime.getURL('words.html') });
          return false;
        };
        wordsSection.appendChild(viewAllLink);
      }
    } else {
      wordsSection.innerHTML += '<div class="empty-state">No words saved yet</div>';
    }

    // Create recent notes section
    const notesSection = document.createElement('section');
    notesSection.innerHTML = `<h3>Recent Notes</h3>`;

    if (userData.notes && Object.keys(userData.notes).length > 0) {
      const notesList = document.createElement('ul');
      notesList.className = 'notes-list';
      
      // Get the 3 most recent notes
      const recentNotes = Object.values(userData.notes)
        .sort((a: Note, b: Note) => b.timestamp - a.timestamp)
        .slice(0, 3);
        
      recentNotes.forEach((note: Note) => {
        const noteItem = document.createElement('li');
        noteItem.className = 'note-item';
        noteItem.innerHTML = `
          <div class="note-text">${note.text}</div>
          <div class="note-video-title">${note.videoTitle || 'Unknown video'}</div>
        `;
        notesList.appendChild(noteItem);
      });
      
      notesSection.appendChild(notesList);
      
      if (Object.keys(userData.notes).length > 3) {
        const viewAllLink = document.createElement('a');
        viewAllLink.href = '#';
        viewAllLink.className = 'view-all-link';
        viewAllLink.textContent = 'View all notes';
        viewAllLink.onclick = () => {
          // Open notes page
          chrome.tabs.create({ url: chrome.runtime.getURL('notes.html') });
          return false;
        };
        notesSection.appendChild(viewAllLink);
      }
    } else {
      notesSection.innerHTML += '<div class="empty-state">No notes saved yet</div>';
    }

    // Add all sections to the data container
    dataContainer!.appendChild(statsSection);
    dataContainer!.appendChild(wordsSection);
    dataContainer!.appendChild(notesSection);
  }
}); 