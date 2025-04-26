import { initializeApp } from 'firebase/app';
import { FIREBASE_CONFIG } from '../../config/firebase';

// Initialize Firebase
export const app = initializeApp(FIREBASE_CONFIG); 