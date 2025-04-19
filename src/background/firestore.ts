/**
 * Firestore utilities for the background service
 */

import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDoc, 
  setDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  updateDoc,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { getCurrentUser } from './auth';

/**
 * Save or update user data in Firestore
 * @param data User data to save
 * @returns Document ID
 */
export async function saveUserData(data: any): Promise<string> {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('No authenticated user');
  }
  
  const db = getFirestore();
  const userRef = doc(db, 'users', user.uid);
  
  await setDoc(userRef, { 
    ...data, 
    updatedAt: Timestamp.now()
  }, { merge: true });
  
  return userRef.id;
}

/**
 * Get user data from Firestore
 * @returns User data or null if not found
 */
export async function getUserData(): Promise<any> {
  const user = getCurrentUser();
  if (!user) {
    return null;
  }
  
  const db = getFirestore();
  const userRef = doc(db, 'users', user.uid);
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    return {
      id: userDoc.id,
      ...userDoc.data()
    };
  }
  
  return null;
}

/**
 * Save a translation to Firestore
 * @param translationData Translation data to save
 * @returns Document ID
 */
export async function saveUserTranslation(translationData: any): Promise<string> {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('No authenticated user');
  }
  
  const db = getFirestore();
  const translationsRef = collection(db, 'translations');
  
  const newTranslation = {
    userId: user.uid,
    ...translationData,
    timestamp: Timestamp.now()
  };
  
  const docRef = await addDoc(translationsRef, newTranslation);
  return docRef.id;
}

/**
 * Get user translations from Firestore
 * @param maxResults Maximum number of results to return
 * @returns Array of translations
 */
export async function getUserTranslations(maxResults: number = 100): Promise<any[]> {
  const user = getCurrentUser();
  if (!user) {
    return [];
  }
  
  const db = getFirestore();
  const translationsQuery = query(
    collection(db, 'translations'),
    where('userId', '==', user.uid),
    orderBy('timestamp', 'desc'),
    limit(maxResults)
  );
  
  const snapshot = await getDocs(translationsQuery);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * Save a note to Firestore
 * @param noteData Note data to save
 * @returns Document ID
 */
export async function saveNoteToFirebase(noteData: any): Promise<string> {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('No authenticated user');
  }
  
  const db = getFirestore();
  const notesRef = collection(db, 'notes');
  
  const newNote = {
    userId: user.uid,
    ...noteData,
    timestamp: Timestamp.now()
  };
  
  const docRef = await addDoc(notesRef, newNote);
  return docRef.id;
}

/**
 * Get user notes from Firestore
 * @param maxResults Maximum number of results to return
 * @returns Array of notes
 */
export async function getUserNotes(maxResults: number = 100): Promise<any[]> {
  const user = getCurrentUser();
  if (!user) {
    return [];
  }
  
  const db = getFirestore();
  const notesQuery = query(
    collection(db, 'notes'),
    where('userId', '==', user.uid),
    orderBy('timestamp', 'desc'),
    limit(maxResults)
  );
  
  const snapshot = await getDocs(notesQuery);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * Save a chat to Firestore
 * @param chatData Chat data to save
 * @returns Document ID
 */
export async function saveChatToFirebase(chatData: any): Promise<string> {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('No authenticated user');
  }
  
  const db = getFirestore();
  const chatsRef = collection(db, 'chats');
  
  const newChat = {
    userId: user.uid,
    ...chatData,
    timestamp: Timestamp.now()
  };
  
  const docRef = await addDoc(chatsRef, newChat);
  return docRef.id;
}

/**
 * Get user chats from Firestore
 * @param maxResults Maximum number of results to return
 * @returns Array of chats
 */
export async function getUserChats(maxResults: number = 50): Promise<any[]> {
  const user = getCurrentUser();
  if (!user) {
    return [];
  }
  
  const db = getFirestore();
  const chatsQuery = query(
    collection(db, 'chats'),
    where('userId', '==', user.uid),
    orderBy('timestamp', 'desc'),
    limit(maxResults)
  );
  
  const snapshot = await getDocs(chatsQuery);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
} 