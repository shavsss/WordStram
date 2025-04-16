/**
 * Database Service
 * 
 * Provides centralized access to Firestore database operations.
 * This module uses the Firebase initialization from firebase-init.ts.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  Firestore,
  DocumentData,
  QueryConstraint,
  DocumentReference,
  CollectionReference
} from 'firebase/firestore';

// Import the central Firebase initialization
import { getFirebaseServices } from './firebase-init';

/**
 * Get Firestore instance, initializing if necessary
 */
export async function getFirestore(): Promise<Firestore> {
  const services = await getFirebaseServices();
  if (!services.firestore) {
    throw new Error('Firestore not initialized');
  }
  return services.firestore;
}

/**
 * Get a document from Firestore
 */
export async function getDocument(path: string): Promise<DocumentData | null> {
  try {
    const firestore = await getFirestore();
    const docRef = doc(firestore, path);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting document at ${path}:`, error);
    throw error;
  }
}

/**
 * Save a document to Firestore (create or update)
 */
export async function saveDocument(path: string, data: any, merge: boolean = true): Promise<string> {
  try {
    const firestore = await getFirestore();
    const docRef = doc(firestore, path);
    
    const docData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    
    // Add createdAt if the document doesn't exist
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      docData.createdAt = serverTimestamp();
    }
    
    await setDoc(docRef, docData, { merge });
    return docRef.id;
  } catch (error) {
    console.error(`Error saving document at ${path}:`, error);
    throw error;
  }
}

/**
 * Add a new document to a collection
 */
export async function addDocument(collectionPath: string, data: any): Promise<string> {
  try {
    const firestore = await getFirestore();
    const collectionRef = collection(firestore, collectionPath);
    
    const docData = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collectionRef, docData);
    return docRef.id;
  } catch (error) {
    console.error(`Error adding document to ${collectionPath}:`, error);
    throw error;
  }
}

/**
 * Update an existing document
 */
export async function updateDocument(path: string, data: any): Promise<void> {
  try {
    const firestore = await getFirestore();
    const docRef = doc(firestore, path);
    
    const updateData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error(`Error updating document at ${path}:`, error);
    throw error;
  }
}

/**
 * Delete a document
 */
export async function deleteDocument(path: string): Promise<void> {
  try {
    const firestore = await getFirestore();
    const docRef = doc(firestore, path);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting document at ${path}:`, error);
    throw error;
  }
}

/**
 * Query documents in a collection
 */
export async function queryDocuments(
  collectionPath: string,
  conditions: { field: string, operator: any, value: any }[] = [],
  orderByField?: { field: string, direction: 'asc' | 'desc' }
): Promise<DocumentData[]> {
  try {
    const firestore = await getFirestore();
    const collectionRef = collection(firestore, collectionPath);
    
    // Build query constraints
    const constraints: QueryConstraint[] = conditions.map(
      condition => where(condition.field, condition.operator, condition.value)
    );
    
    // Add ordering if specified
    if (orderByField) {
      constraints.push(orderBy(orderByField.field, orderByField.direction));
    }
    
    // Execute query
    const q = query(collectionRef, ...constraints);
    const querySnapshot = await getDocs(q);
    
    // Return results
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error querying documents in ${collectionPath}:`, error);
    throw error;
  }
}

/**
 * Set up a listener for a document
 */
export function listenToDocument(path: string, callback: (data: DocumentData | null) => void): Promise<() => void> {
  return new Promise(async (resolve, reject) => {
    try {
      const firestore = await getFirestore();
      const docRef = doc(firestore, path);
      
      const unsubscribe = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          callback({ id: snapshot.id, ...snapshot.data() });
        } else {
          callback(null);
        }
      }, (error) => {
        console.error(`Error listening to document at ${path}:`, error);
        callback(null);
      });
      
      resolve(unsubscribe);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Set up a listener for a collection query
 */
export function listenToCollection(
  collectionPath: string,
  callback: (data: DocumentData[]) => void,
  conditions: { field: string, operator: any, value: any }[] = [],
  orderByField?: { field: string, direction: 'asc' | 'desc' }
): Promise<() => void> {
  return new Promise(async (resolve, reject) => {
    try {
      const firestore = await getFirestore();
      const collectionRef = collection(firestore, collectionPath);
      
      // Build query constraints
      const constraints: QueryConstraint[] = conditions.map(
        condition => where(condition.field, condition.operator, condition.value)
      );
      
      // Add ordering if specified
      if (orderByField) {
        constraints.push(orderBy(orderByField.field, orderByField.direction));
      }
      
      // Create and listen to query
      const q = query(collectionRef, ...constraints);
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        callback(items);
      }, (error) => {
        console.error(`Error listening to collection at ${collectionPath}:`, error);
        callback([]);
      });
      
      resolve(unsubscribe);
    } catch (error) {
      reject(error);
    }
  });
}

// Export default object for convenience
export default {
  getFirestore,
  getDocument,
  saveDocument,
  addDocument,
  updateDocument,
  deleteDocument,
  queryDocuments,
  listenToDocument,
  listenToCollection
}; 