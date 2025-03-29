import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy, 
  Timestamp,
  DocumentData,
  DocumentReference,
  CollectionReference,
  QuerySnapshot,
  writeBatch
} from 'firebase/firestore';
import { firestore } from './config';
import { getCurrentUser } from './auth';
import { Note } from '@/types/video-notes';

// Collection names
const COLLECTIONS = {
  USERS: 'users',
  NOTES: 'notes',
  USER_NOTES: 'user_notes',
  CHATS: 'chats'
};

// Type definitions for Firestore data structures
interface FirestoreNote extends Omit<Note, 'timestamp'> {
  timestamp: Timestamp;
  userId: string;
  videoId: string;
}

// Chat message structure for Firestore
interface FirestoreChatMessage {
  role: string;
  content: string;
  timestamp: Timestamp;
}

// Chat conversation structure for Firestore
interface FirestoreChat {
  conversationId: string;
  userId: string;
  videoId: string;
  videoTitle: string;
  videoURL: string;
  lastUpdated: Timestamp;
  messages: FirestoreChatMessage[];
}

// Convert Firestore data to app data
function convertFirestoreNoteToNote(firestoreNote: FirestoreNote): Note {
  const { timestamp, ...rest } = firestoreNote;
  return {
    ...rest,
    timestamp: timestamp.toDate().toISOString(),
  };
}

// Convert app data to Firestore data
function convertNoteToFirestoreNote(note: Note, userId: string, videoId: string): FirestoreNote {
  return {
    ...note,
    timestamp: Timestamp.fromDate(new Date(note.timestamp)),
    userId,
    videoId
  };
}

/**
 * Initialize required Firestore collections
 * This function ensures that all required collections exist
 */
export async function initializeFirestoreCollections(): Promise<void> {
  try {
    console.log('WordStream: Initializing Firestore collections');
    
    const user = getCurrentUser();
    if (!user) {
      console.log('WordStream: User not authenticated, skipping collection initialization');
      return;
    }
    
    const userId = user.uid;
    
    // Create a user document if it doesn't exist
    const userDocRef = doc(firestore, COLLECTIONS.USERS, userId);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      console.log('WordStream: Creating user document in Firestore');
      await setDoc(userDocRef, {
        email: user.email,
        createdAt: Timestamp.now(),
        lastLogin: Timestamp.now()
      });
    } else {
      // Update last login time
      await updateDoc(userDocRef, {
        lastLogin: Timestamp.now()
      });
    }
    
    console.log('WordStream: Firestore collections initialized successfully');
  } catch (error) {
    console.error('WordStream: Error initializing Firestore collections:', error);
  }
}

/**
 * Get all notes for a specific video for the current user
 * @param videoId The video ID
 * @returns Array of notes
 */
export async function getNotes(videoId: string): Promise<Note[]> {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const userId = user.uid;
    const notesQuery = query(
      collection(firestore, COLLECTIONS.NOTES),
      where('userId', '==', userId),
      where('videoId', '==', videoId),
      orderBy('timestamp', 'asc')
    );
    
    const querySnapshot = await getDocs(notesQuery);
    const notes: Note[] = [];
    
    querySnapshot.forEach((doc) => {
      const firestoreNote = doc.data() as FirestoreNote;
      notes.push(convertFirestoreNoteToNote(firestoreNote));
    });
    
    return notes;
  } catch (error) {
    console.error('Error fetching notes:', error);
    return [];
  }
}

/**
 * Save a note to Firestore
 * @param note The note to save
 * @param videoId The video ID
 * @returns The saved note with updated ID
 */
export async function saveNote(note: Omit<Note, 'id'>, videoId: string): Promise<Note | null> {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const userId = user.uid;
    const newNoteRef = doc(collection(firestore, COLLECTIONS.NOTES));
    const noteId = newNoteRef.id;
    
    const newNote: Note = {
      ...note,
      id: noteId
    };
    
    const firestoreNote = convertNoteToFirestoreNote(newNote, userId, videoId);
    await setDoc(newNoteRef, firestoreNote);
    
    return newNote;
  } catch (error) {
    console.error('Error saving note:', error);
    return null;
  }
}

/**
 * Delete a note from Firestore
 * @param noteId The note ID to delete
 * @returns True if deletion was successful
 */
export async function deleteNote(noteId: string): Promise<boolean> {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const noteRef = doc(firestore, COLLECTIONS.NOTES, noteId);
    await deleteDoc(noteRef);
    return true;
  } catch (error) {
    console.error('Error deleting note:', error);
    return false;
  }
}

/**
 * Update a note in Firestore
 * @param noteId The note ID to update
 * @param updatedData The updated note data
 * @returns True if update was successful
 */
export async function updateNote(noteId: string, updatedData: Partial<Omit<Note, 'id'>>): Promise<boolean> {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const noteRef = doc(firestore, COLLECTIONS.NOTES, noteId);
    
    // Convert timestamp if it exists
    if (updatedData.timestamp) {
      updatedData.timestamp = Timestamp.fromDate(new Date(updatedData.timestamp)) as unknown as string;
    }
    
    await updateDoc(noteRef, updatedData as DocumentData);
    return true;
  } catch (error) {
    console.error('Error updating note:', error);
    return false;
  }
}

/**
 * Save chat conversation to Firestore
 * @param chatData The chat data to save
 * @returns The saved chat ID if successful, null otherwise
 */
export async function saveChat(chatData: {
  conversationId: string;
  videoId: string;
  videoTitle: string;
  videoURL: string;
  messages: { role: string; content: string; }[];
}): Promise<string | null> {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const userId = user.uid;
    const chatId = chatData.conversationId;
    const chatRef = doc(firestore, COLLECTIONS.CHATS, chatId);
    
    const firestoreChat: FirestoreChat = {
      conversationId: chatId,
      userId,
      videoId: chatData.videoId,
      videoTitle: chatData.videoTitle,
      videoURL: chatData.videoURL,
      lastUpdated: Timestamp.now(),
      messages: chatData.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: Timestamp.now()
      }))
    };
    
    await setDoc(chatRef, firestoreChat);
    console.log('WordStream: Chat saved to Firestore successfully');
    return chatId;
  } catch (error) {
    console.error('WordStream: Error saving chat to Firestore:', error);
    return null;
  }
}

/**
 * Get all chats for the current user
 * @returns Array of chat conversations
 */
export async function getUserChats(): Promise<any[]> {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const userId = user.uid;
    const chatsQuery = query(
      collection(firestore, COLLECTIONS.CHATS),
      where('userId', '==', userId),
      orderBy('lastUpdated', 'desc')
    );
    
    const querySnapshot = await getDocs(chatsQuery);
    const chats: any[] = [];
    
    querySnapshot.forEach((doc) => {
      const firestoreChat = doc.data() as FirestoreChat;
      chats.push({
        ...firestoreChat,
        lastUpdated: firestoreChat.lastUpdated.toDate().toISOString(),
        messages: firestoreChat.messages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp.toDate().toISOString()
        }))
      });
    });
    
    return chats;
  } catch (error) {
    console.error('WordStream: Error fetching user chats:', error);
    return [];
  }
}

/**
 * Save words to Firestore
 * @param words Array of word objects to save
 * @returns Promise that resolves to true if successful
 */
export async function saveWords(words: any[]): Promise<boolean> {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const userId = user.uid;
    
    // Create a batch to handle multiple documents
    const batch = writeBatch(firestore);
    
    // Process each word
    for (const word of words) {
      const wordId = word.id || `word_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      const wordRef = doc(firestore, 'words', wordId);
      
      // Add userId to word data
      const wordData = {
        ...word,
        userId,
        lastUpdated: Timestamp.now()
      };
      
      batch.set(wordRef, wordData);
    }
    
    // Commit the batch
    await batch.commit();
    console.log(`WordStream: Successfully saved ${words.length} words to Firestore`);
    return true;
  } catch (error) {
    console.error('WordStream: Error saving words to Firestore:', error);
    return false;
  }
}

/**
 * Get all words for the current user
 * @returns Promise resolving to array of word objects
 */
export async function getUserWords(): Promise<any[]> {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const userId = user.uid;
    
    // Query words for this user
    const wordsQuery = query(
      collection(firestore, 'words'),
      where('userId', '==', userId),
      orderBy('lastUpdated', 'desc')
    );
    
    const querySnapshot = await getDocs(wordsQuery);
    const words: any[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Convert Firestore timestamps to ISO strings
      const word = {
        ...data,
        lastUpdated: data.lastUpdated ? data.lastUpdated.toDate().toISOString() : new Date().toISOString()
      };
      
      words.push(word);
    });
    
    console.log(`WordStream: Successfully loaded ${words.length} words from Firestore`);
    return words;
  } catch (error) {
    console.error('WordStream: Error loading words from Firestore:', error);
    return [];
  }
} 