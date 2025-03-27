// Test script for Firebase user authentication and document management

import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import {
  createUserDocument,
  checkIfUserPaid,
  setUserPaymentStatus,
  addWord,
  addNote,
  addHistoryEntry,
  getUserData
} from '../services/firebase/user-service';
import firebaseService from '../services/firebase';

// Firebase configuration is already set in the service

// Initialize Firebase if needed
const app = initializeApp();
const auth = getAuth();

console.log('Starting Firebase user service test...');

/**
 * Main testing function
 */
async function testFirebaseUserService() {
  // 1. First, check if user is logged in
  console.log('Checking current user...');
  const currentUser = firebaseService.getCurrentUser();
  
  if (!currentUser) {
    console.log('No user is currently logged in. Please sign in first:');
    console.log('1. Sign in with Google: await firebaseService.signInWithGoogle()');
    console.log('2. Sign in with Email: await firebaseService.signInWithEmail("email", "password")');
    return;
  }
  
  console.log('Current user:', currentUser);
  
  // 2. Test user document creation
  try {
    console.log('Testing user document creation...');
    await createUserDocument(currentUser);
    console.log('✅ User document created or verified');
  } catch (error) {
    console.error('❌ Error creating user document:', error);
  }
  
  // 3. Test payment status check
  try {
    console.log('Testing payment status check...');
    const isPaid = await checkIfUserPaid(currentUser.uid);
    console.log('Is user paid?', isPaid);
  } catch (error) {
    console.error('❌ Error checking payment status:', error);
  }
  
  // 4. Test setting payment status (admin only)
  try {
    console.log('Testing setting payment status (set to true)...');
    await setUserPaymentStatus(currentUser.uid, true);
    console.log('✅ Payment status set to true');
    
    // Verify change
    const isPaidAfterChange = await checkIfUserPaid(currentUser.uid);
    console.log('Is user paid after change?', isPaidAfterChange);
  } catch (error) {
    console.error('❌ Error setting payment status:', error);
  }
  
  // 5. Test adding a word
  try {
    console.log('Testing adding a word...');
    const word = {
      text: 'hello',
      translation: 'שלום',
      timestamp: new Date().toISOString(),
      context: 'Test context'
    };
    await addWord(currentUser.uid, word);
    console.log('✅ Word added successfully');
  } catch (error) {
    console.error('❌ Error adding word:', error);
  }
  
  // 6. Test adding a note
  try {
    console.log('Testing adding a note...');
    const note = {
      text: 'Test note',
      timestamp: new Date().toISOString(),
      videoId: 'test-video-id'
    };
    await addNote(currentUser.uid, note);
    console.log('✅ Note added successfully');
  } catch (error) {
    console.error('❌ Error adding note:', error);
  }
  
  // 7. Test adding a history entry
  try {
    console.log('Testing adding a history entry...');
    const historyEntry = {
      action: 'visited',
      url: 'https://example.com',
      timestamp: new Date().toISOString()
    };
    await addHistoryEntry(currentUser.uid, historyEntry);
    console.log('✅ History entry added successfully');
  } catch (error) {
    console.error('❌ Error adding history entry:', error);
  }
  
  // 8. Test getting user data
  try {
    console.log('Testing getting user data...');
    const userData = await getUserData(currentUser.uid);
    console.log('User data:', userData);
    console.log('✅ User data retrieved successfully');
  } catch (error) {
    console.error('❌ Error getting user data:', error);
  }
  
  console.log('Firebase user service tests completed!');
}

// Run tests
testFirebaseUserService().catch(error => {
  console.error('Error running tests:', error);
});

/**
 * How to use the test in the browser console:
 * 
 * 1. Import this module:
 * import * as test from './firebase-user-test.js';
 * 
 * 2. To sign in with Google:
 * await firebaseService.signInWithGoogle();
 * 
 * 3. Run the tests:
 * test.testFirebaseUserService();
 * 
 * 4. To log out:
 * await firebaseService.signOut();
 */

export { testFirebaseUserService }; 