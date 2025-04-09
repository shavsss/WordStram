/**
 * Firebase Service
 * מספק גישה מרכזית לכל שירותי Firebase
 */

import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, browserLocalPersistence, setPersistence, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot, 
  Firestore, 
  serverTimestamp, 
  orderBy,
  DocumentData,
  QueryDocumentSnapshot 
} from 'firebase/firestore';
import { Note, VideoWithNotes } from '../@types/notes';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAVxAdCx5JW0K7o5B53p_fThHYUPtWRQF4",
  authDomain: "vidlearn-ai.firebaseapp.com",
  projectId: "vidlearn-ai",
  storageBucket: "vidlearn-ai.appspot.com",
  messagingSenderId: "1097713470067",
  appId: "1:1097713470067:web:821f08db03951f83363806",
  measurementId: "G-PQDV30TTX1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Set auth persistence
setPersistence(auth, browserLocalPersistence)
  .then(() => console.log('Firebase: Auth persistence set to local'))
  .catch(error => console.error('Firebase: Error setting auth persistence:', error));

/**
 * אתחול המאזין למצב האימות ועדכון השמירה המקומית
 */
export function initializeAuth() {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // שמירת מידע בסיסי של המשתמש ב-storage המקומי
      chrome.storage.local.set({
        'user_logged_in': true,
        'user_info': {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        }
      });
      
      // שליחת עדכון לכל החלקים בתוסף
      chrome.runtime.sendMessage({
        type: 'AUTH_STATE_CHANGED',
        isLoggedIn: true,
        userInfo: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        }
      }).catch(() => {
        // התעלם משגיאות אם המקבל לא זמין
      });
      
      console.log('Firebase: User logged in:', user.uid);
    } else {
      // מחיקת המידע המקומי
      chrome.storage.local.set({
        'user_logged_in': false,
        'user_info': null
      });
      
      // שליחת עדכון לכל החלקים בתוסף
      chrome.runtime.sendMessage({
        type: 'AUTH_STATE_CHANGED',
        isLoggedIn: false,
        userInfo: null
      }).catch(() => {
        // התעלם משגיאות אם המקבל לא זמין
      });
      
      console.log('Firebase: User logged out');
    }
  });
}

/**
 * התחברות באמצעות חשבון Google
 */
export async function signInWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return { success: true, user: result.user };
  } catch (error) {
    console.error('Firebase: Error signing in with Google:', error);
    return { success: false, error };
  }
}

/**
 * התנתקות מהחשבון הנוכחי
 */
export async function logOut() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Firebase: Error signing out:', error);
    return { success: false, error };
  }
}

/**
 * הוספת מסמך לאוסף Firestore
 * @param collectionPath נתיב האוסף
 * @param data נתוני המסמך
 * @returns מזהה המסמך שנוצר
 */
export async function addDocument(collectionPath: string, data: any) {
  try {
    // וידוא שהמשתמש מחובר
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    
    // הוספת מזהה משתמש ונתוני יצירה
    const docData = {
      ...data,
      userId: auth.currentUser.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const collectionRef = collection(db, collectionPath);
    const docRef = await addDoc(collectionRef, docData);
    
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error(`Firebase: Error adding document to ${collectionPath}:`, error);
    return { success: false, error };
  }
}

/**
 * עדכון מסמך קיים
 * @param documentPath נתיב המסמך
 * @param data נתוני העדכון
 */
export async function updateDocument(documentPath: string, data: any) {
  try {
    // וידוא שהמשתמש מחובר
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    
    // הוספת תאריך עדכון
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    
    const docRef = doc(db, documentPath);
    await updateDoc(docRef, updateData);
    
    return { success: true };
  } catch (error) {
    console.error(`Firebase: Error updating document at ${documentPath}:`, error);
    return { success: false, error };
  }
}

/**
 * מחיקת מסמך
 * @param documentPath נתיב המסמך למחיקה
 */
export async function deleteDocument(documentPath: string) {
  try {
    // וידוא שהמשתמש מחובר
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    
    const docRef = doc(db, documentPath);
    await deleteDoc(docRef);
    
    return { success: true };
  } catch (error) {
    console.error(`Firebase: Error deleting document at ${documentPath}:`, error);
    return { success: false, error };
  }
}

/**
 * קבלת מסמך לפי נתיב
 * @param documentPath נתיב המסמך
 */
export async function getDocument(documentPath: string) {
  try {
    // וידוא שהמשתמש מחובר
    if (!auth.currentUser) {
      throw new Error('User not authenticated');
    }
    
    const docRef = doc(db, documentPath);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { 
        success: true, 
        data: { id: docSnap.id, ...docSnap.data() } 
      };
    } else {
      return { success: false, error: 'Document not found' };
    }
  } catch (error) {
    console.error(`Firebase: Error getting document at ${documentPath}:`, error);
    return { success: false, error };
  }
}

/**
 * יצירת מאזין לשינויים באוסף
 * @param collectionPath נתיב האוסף
 * @param whereConditions תנאי סינון (אופציונלי)
 * @param callback פונקציית Callback לקבלת העדכונים
 * @returns פונקציה להסרת המאזין
 */
export function listenToCollection(
  collectionPath: string, 
  whereConditions: { field: string, operator: '==' | '!=' | '>' | '>=' | '<' | '<=', value: any }[] = [],
  callback: (documents: any[]) => void
) {
  try {
    // וידוא שהמשתמש מחובר
    if (!auth.currentUser) {
      console.warn('Firebase: User not authenticated, cannot listen to collection');
      return () => {};
    }
    
    const collectionRef = collection(db, collectionPath);
    
    // בניית השאילתה עם תנאי סינון
    let queryRef = query(collectionRef);
    
    whereConditions.forEach(condition => {
      queryRef = query(queryRef, where(condition.field, condition.operator, condition.value));
    });
    
    // הוספת תנאי נוסף לסינון לפי מזהה המשתמש הנוכחי
    queryRef = query(queryRef, where('userId', '==', auth.currentUser.uid));
    
    // יצירת המאזין ל-Firestore
    const unsubscribe = onSnapshot(queryRef, (snapshot) => {
      const documents = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      callback(documents);
    }, (error) => {
      console.error(`Firebase: Error listening to collection ${collectionPath}:`, error);
      callback([]);
    });
    
    return unsubscribe;
  } catch (error) {
    console.error(`Firebase: Error setting up listener for ${collectionPath}:`, error);
    return () => {};
  }
}

/**
 * הפונקציה מחזירה אם המשתמש מחובר כרגע
 */
export function isUserLoggedIn(): boolean {
  return !!auth.currentUser;
}

/**
 * הפונקציה מחזירה את המשתמש הנוכחי או null
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * פונקציה שמחזירה את ה-userId הנוכחי או null
 */
export function getCurrentUserId(): string | null {
  return auth.currentUser?.uid || null;
}

// פונקציות ספציפיות לפיצ'רים שונים
// ===================================

// ----- פונקציות לעבודה עם הערות ----- //

/**
 * שמירת הערה חדשה
 * @param note נתוני ההערה
 * @returns מזהה ההערה
 */
export async function saveNote(note: any): Promise<{ success: boolean, id?: string, error?: any }> {
  if (!auth.currentUser) {
    return { success: false, error: 'User not authenticated' };
  }
  
  const userId = auth.currentUser.uid;
  const notesPath = `users/${userId}/notes`;
  
  // מידע בסיסי שצריך להיות בכל הערה
  const noteData = {
    ...note,
    userId,
    timestamp: note.timestamp || new Date().toISOString()
  };
  
  if (note.id) {
    // עדכון הערה קיימת
    const notePath = `${notesPath}/${note.id}`;
    try {
      await updateDoc(doc(db, notePath), {
        ...noteData,
        updatedAt: serverTimestamp()
      });
      
      // אם יש מזהה וידאו, עדכן את הקישור אליו
      if (note.videoId) {
        await updateVideoNoteReference(userId, note.videoId, note.id);
      }
      
      return { success: true, id: note.id };
    } catch (error) {
      console.error('Firebase: Error updating note:', error);
      return { success: false, error };
    }
  } else {
    // יצירת הערה חדשה
    try {
      const noteRef = await addDoc(collection(db, notesPath), {
        ...noteData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // אם יש מזהה וידאו, עדכן את הקישור אליו
      if (note.videoId) {
        await updateVideoNoteReference(userId, note.videoId, noteRef.id);
      }
      
      return { success: true, id: noteRef.id };
    } catch (error) {
      console.error('Firebase: Error creating note:', error);
      return { success: false, error };
    }
  }
}

/**
 * עדכון קישור בין הערה לוידאו
 */
async function updateVideoNoteReference(userId: string, videoId: string, noteId: string): Promise<void> {
  try {
    const videoPath = `users/${userId}/videos/${videoId}`;
    const videoRef = doc(db, videoPath);
    const videoDoc = await getDoc(videoRef);
    
    if (videoDoc.exists()) {
      // עדכון מסמך וידאו קיים
      await updateDoc(videoRef, {
        [`noteIds.${noteId}`]: true,
        noteCount: videoDoc.data().noteCount ? videoDoc.data().noteCount + 1 : 1,
        lastUpdated: serverTimestamp()
      });
    } else {
      // יצירת מסמך וידאו חדש
      await setDoc(videoRef, {
        videoId,
        userId,
        noteIds: { [noteId]: true },
        noteCount: 1,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Firebase: Error updating video note reference:', error);
  }
}

/**
 * קבלת הערות לוידאו מסוים
 * @param videoId מזהה הוידאו
 * @returns מערך הערות
 */
export async function getNotes(videoId: string): Promise<{ success: boolean, notes?: Note[], error?: any }> {
  if (!auth.currentUser) {
    return { success: false, error: 'User not authenticated' };
  }
  
  const userId = auth.currentUser.uid;
  const notesPath = `users/${userId}/notes`;
  
  try {
    const notesQuery = query(
      collection(db, notesPath),
      where('videoId', '==', videoId),
      orderBy('videoTime', 'asc')
    );
    
    const querySnapshot = await getDocs(notesQuery);
    
    const notes = querySnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
      id: doc.id,
      ...doc.data()
    })) as Note[];
    
    return { success: true, notes };
  } catch (error) {
    console.error(`Firebase: Error getting notes for video ${videoId}:`, error);
    return { success: false, error };
  }
}

/**
 * האזנה לשינויים בהערות לוידאו מסוים
 * @param videoId מזהה הוידאו
 * @param callback פונקציה לקבלת העדכונים
 * @returns פונקציה להסרת המאזין
 */
export function listenToNotes(videoId: string, callback: (notes: any[]) => void): () => void {
  if (!auth.currentUser) {
    console.warn('Firebase: User not authenticated, cannot listen to notes');
    return () => {};
  }
  
  const userId = auth.currentUser.uid;
  const notesPath = `users/${userId}/notes`;
  
  const notesQuery = query(
    collection(db, notesPath),
    where('videoId', '==', videoId),
    orderBy('videoTime', 'asc')
  );
  
  const unsubscribe = onSnapshot(notesQuery, (snapshot) => {
    const notes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    callback(notes);
  }, (error) => {
    console.error(`Firebase: Error listening to notes for video ${videoId}:`, error);
    callback([]);
  });
  
  return unsubscribe;
}

/**
 * מחיקת הערה
 * @param noteId מזהה ההערה
 * @param videoId מזהה הוידאו (אופציונלי)
 * @returns האם המחיקה הצליחה
 */
export async function deleteNote(noteId: string, videoId?: string): Promise<{ success: boolean, error?: any }> {
  if (!auth.currentUser) {
    return { success: false, error: 'User not authenticated' };
  }
  
  const userId = auth.currentUser.uid;
  const notePath = `users/${userId}/notes/${noteId}`;
  
  try {
    // אם מזהה הוידאו לא סופק, נצטרך לקבל אותו קודם
    if (!videoId) {
      const noteDoc = await getDoc(doc(db, notePath));
      if (noteDoc.exists()) {
        videoId = noteDoc.data().videoId;
      }
    }
    
    // מחיקת ההערה
    await deleteDoc(doc(db, notePath));
    
    // עדכון מסמך הוידאו אם יש צורך
    if (videoId) {
      const videoPath = `users/${userId}/videos/${videoId}`;
      const videoRef = doc(db, videoPath);
      const videoDoc = await getDoc(videoRef);
      
      if (videoDoc.exists()) {
        const videoData = videoDoc.data();
        // מחיקת מזהה ההערה מהרשימה
        const noteIds = videoData.noteIds || {};
        if (noteIds[noteId]) {
          delete noteIds[noteId];
        }
        
        // עדכון מספר ההערות
        const noteCount = Math.max(0, (videoData.noteCount || 1) - 1);
        
        await updateDoc(videoRef, {
          noteIds,
          noteCount,
          lastUpdated: serverTimestamp()
        });
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error(`Firebase: Error deleting note ${noteId}:`, error);
    return { success: false, error };
  }
}

/**
 * פונקציה להשגת כל הערות של משתמש מסוים
 * @param userId מזהה המשתמש
 * @returns מערך של הערות
 */
export const getUserNotes = async (userId: string): Promise<Note[]> => {
  try {
    const q = query(
      collection(db, 'notes'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const notes: Note[] = [];

    querySnapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data() as Note;
      notes.push({
        ...data,
        id: doc.id
      });
    });

    return notes;
  } catch (error) {
    console.error('Error fetching notes:', error);
    return [];
  }
};

/**
 * פונקציה להשגת כל הסרטונים והערות שלהם של משתמש מסוים
 * @param userId מזהה המשתמש
 * @returns מערך של אובייקטים המכילים את פרטי הסרטון והערות שלו
 */
export const getAllVideosWithNotes = async (userId: string): Promise<VideoWithNotes[]> => {
  try {
    const notes = await getUserNotes(userId);
    
    // מיפוי הערות לפי מזהה הסרטון
    const videoMap = new Map<string, Note[]>();
    for (const note of notes) {
      if (!videoMap.has(note.videoId)) {
        videoMap.set(note.videoId, []);
      }
      videoMap.get(note.videoId)?.push(note);
    }
    
    // יצירת מערך התוצאה
    const videosWithNotes: VideoWithNotes[] = [];
    videoMap.forEach((videoNotes, videoId) => {
      if (videoNotes.length > 0) {
        // נקח את המידע מההערה הראשונה
        const firstNote = videoNotes[0];
        const videoWithNotes: VideoWithNotes = {
          videoId,
          videoTitle: firstNote.videoTitle || 'וידאו ללא כותרת',
          videoURL: firstNote.videoURL || '',
          lastUpdated: firstNote.updatedAt ? new Date(firstNote.updatedAt.toDate()).toISOString() : new Date().toISOString(),
          notes: videoNotes.sort((a, b) => a.videoTime - b.videoTime)
        };
        videosWithNotes.push(videoWithNotes);
      }
    });
    
    return videosWithNotes;
  } catch (error) {
    console.error('Error fetching videos with notes:', error);
    return [];
  }
};

// ----- פונקציות לעבודה עם צ'אטים ----- //
// כאן אפשר להוסיף פונקציות דומות לעבודה עם צ'אטים (saveChat, getChats, listenToChats, deleteChat)

/**
 * קבלת רשימת הצ'אטים של המשתמש
 * @returns מערך של צ'אטים
 */
export async function getChats(): Promise<{ success: boolean, data?: any[], error?: any }> {
  if (!auth.currentUser) {
    return { success: false, error: 'User not authenticated', data: [] };
  }
  
  try {
    const userId = auth.currentUser.uid;
    // ממשתמשם בא בינתיים נחזיר מערך ריק
    return { success: true, data: [] };
    
    // כאשר הפיצ'ר יהיה מוכן, נוכל להשתמש בקוד הבא:
    /*
    const chatsPath = `users/${userId}/chats`;
    const q = query(
      collection(db, chatsPath),
      orderBy('updatedAt', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const chats = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return { success: true, data: chats };
    */
  } catch (error) {
    console.error('Firebase: Error fetching chats:', error);
    return { success: false, error, data: [] };
  }
}

/**
 * שמירת צ'אט
 * @param chat נתוני הצ'אט
 * @returns מזהה הצ'אט
 */
export async function saveChat(chat: any): Promise<{ success: boolean, id?: string, error?: any }> {
  if (!auth.currentUser) {
    return { success: false, error: 'User not authenticated' };
  }
  
  try {
    const userId = auth.currentUser.uid;
    const chatsPath = `users/${userId}/chats`;
    
    // אם יש מזהה, נעדכן את הצ'אט הקיים
    if (chat.id) {
      const chatRef = doc(db, `${chatsPath}/${chat.id}`);
      await updateDoc(chatRef, {
        ...chat,
        updatedAt: serverTimestamp()
      });
      
      return { success: true, id: chat.id };
    } 
    // אחרת ניצור צ'אט חדש
    else {
      const chatRef = await addDoc(collection(db, chatsPath), {
        ...chat,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return { success: true, id: chatRef.id };
    }
  } catch (error) {
    console.error('Firebase: Error saving chat:', error);
    return { success: false, error };
  }
}

/**
 * מחיקת צ'אט
 * @param chatId מזהה הצ'אט
 * @returns האם המחיקה הצליחה
 */
export async function deleteChat(chatId: string): Promise<{ success: boolean, error?: any }> {
  if (!auth.currentUser) {
    return { success: false, error: 'User not authenticated' };
  }
  
  try {
    const userId = auth.currentUser.uid;
    const chatPath = `users/${userId}/chats/${chatId}`;
    
    await deleteDoc(doc(db, chatPath));
    
    return { success: true };
  } catch (error) {
    console.error(`Firebase: Error deleting chat ${chatId}:`, error);
    return { success: false, error };
  }
}

// ----- פונקציות לעבודה עם מילים ----- //
// כאן אפשר להוסיף פונקציות דומות לעבודה עם מילים (saveWord, getWords, deleteWord)

// ייצוא המופעים המאותחלים לשימוש ישיר
export { app, auth, db };

// הפעלת אתחול האימות
initializeAuth(); 