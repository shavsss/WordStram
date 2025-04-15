# WordStream Unified Firebase Architecture

## Overview

This project now uses a simplified, centralized approach to Firebase integration. All Firebase-related functionality (authentication, Firestore, and storage) is now handled through a single source of truth.

## Key Files

### 1. `src/firebase-service.ts`

This is the **single source of truth** for all Firebase operations:

- Firebase initialization
- Authentication (sign in, sign out, etc.)
- Firestore operations (get, save, delete documents)
- Storage functionality (local and Chrome extension storage)

### 2. `src/hooks/useFirebase.ts`

A React hook that provides access to all Firebase functionality in components:

```typescript
import { useFirebase } from '../hooks/useFirebase';

function MyComponent() {
  const { 
    currentUser, 
    isAuthenticated, 
    signInWithGoogle, 
    saveDocument,
    storage 
  } = useFirebase();

  // Now you can use these functions in your component
}
```

## Benefits of This Approach

1. **No Duplication**: All Firebase code is in one place
2. **Simplified Maintenance**: Changes to Firebase configuration only need to be made in one file
3. **Consistent API**: All components use the same functions in the same way
4. **Better Performance**: Only one initialization process

## Usage Examples

### Authentication

```typescript
const { signInWithGoogle, signOut, currentUser } = useFirebase();

// Sign in
await signInWithGoogle();

// Check if user is signed in
if (currentUser) {
  console.log('User is signed in:', currentUser.displayName);
}

// Sign out
await signOut();
```

### Firestore

```typescript
const { saveDocument, getDocument, deleteDocument } = useFirebase();

// Save data
const docId = await saveDocument('notes/myNote', { title: 'Hello', content: 'World' });

// Get data
const note = await getDocument('notes/myNote');

// Delete data
await deleteDocument('notes/myNote');
```

### Storage

```typescript
const { storage } = useFirebase();

// Save data
await storage.setItem('myKey', { some: 'data' });

// Get data
const data = await storage.getItem('myKey');

// Remove data
await storage.removeItem('myKey');
``` 