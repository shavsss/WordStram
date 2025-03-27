import { useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getUserData, addWord, addNote, addHistoryEntry } from '../services/firebase/user-service';

interface UserDataHook {
  isLoading: boolean;
  userData: any | null;
  error: Error | null;
  addUserWord: (word: any) => Promise<void>;
  addUserNote: (note: any) => Promise<void>;
  addUserHistoryEntry: (entry: any) => Promise<void>;
  refreshUserData: () => Promise<void>;
}

/**
 * Hook to fetch and update user data
 * @returns User data and functions to update it
 */
export function useUserData(): UserDataHook {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [userData, setUserData] = useState<any | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Function to fetch user data
  const fetchUserData = async (uid: string) => {
    setIsLoading(true);
    try {
      const data = await getUserData(uid);
      setUserData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch user data'));
    } finally {
      setIsLoading(false);
    }
  };

  // Set up auth state listener
  useEffect(() => {
    const auth = getAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        fetchUserData(user.uid);
      } else {
        setUserId(null);
        setUserData(null);
        setIsLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, []);

  // Function to add a word
  const addUserWord = async (word: any) => {
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    await addWord(userId, word);
    await fetchUserData(userId);
  };

  // Function to add a note
  const addUserNote = async (note: any) => {
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    await addNote(userId, note);
    await fetchUserData(userId);
  };

  // Function to add a history entry
  const addUserHistoryEntry = async (entry: any) => {
    if (!userId) {
      throw new Error('User not authenticated');
    }
    
    await addHistoryEntry(userId, entry);
    await fetchUserData(userId);
  };

  // Function to refresh user data
  const refreshUserData = async () => {
    if (userId) {
      await fetchUserData(userId);
    }
  };

  return {
    isLoading,
    userData,
    error,
    addUserWord,
    addUserNote,
    addUserHistoryEntry,
    refreshUserData,
  };
}

export default useUserData; 