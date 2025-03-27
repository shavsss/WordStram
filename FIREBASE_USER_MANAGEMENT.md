# Firebase User Authentication & Payment Management

This document explains how to use the Firebase authentication and payment management functionality in the WordStream extension.

## Overview

The extension uses Firebase for:
1. User authentication (Google or Email/Password)
2. Storing user-specific data (words, notes, history)
3. Managing payment/subscription status
4. Cloud synchronization across devices

## User Authentication

The authentication system is already set up with the following features:
- Sign in with Google
- Sign in with Email/Password
- Password reset
- User profile data

### Components

- `SignInButton.tsx` - Button component for signing in/out
- `EmailAuthForm.tsx` - Form for email/password authentication
- `SubscriptionStatus.tsx` - Displays user's current subscription status

### Hooks

- `usePaymentStatus` - Hook that provides the user's payment status
- `useUserData` - Hook that provides access to user data and functions to update it

## User Document Management

When a user signs in, a document is automatically created for them in Firestore with the following structure:

```
/users/{userId}/ (document)
  |- email: string
  |- displayName: string
  |- createdAt: timestamp
  |- paid: boolean (default: false)
  |- words: array
  |- notes: array
  |- history: array
```

### Services

The Firebase user management is implemented in `src/services/firebase/user-service.ts` with the following functions:

- `createUserDocument(user)` - Creates/updates the user document in Firestore
- `checkIfUserPaid(userId)` - Checks if a user has paid for premium features
- `setUserPaymentStatus(userId, paid)` - Updates the user's payment status (admin only)
- `addWord(userId, word)` - Adds a word to the user's word list
- `addNote(userId, note)` - Adds a note to the user's notes
- `addHistoryEntry(userId, entry)` - Adds an entry to the user's history
- `getUserData(userId)` - Retrieves all user data
- `setupAuthListener()` - Sets up an auth state listener to create user documents

## Restricting Access to Premium Features

To restrict features to paid users, you can use the `PaidUserCheck` component:

```tsx
import { PaidUserCheck } from '@/components/auth/PaidUserCheck';

// In your component:
<PaidUserCheck>
  {/* Premium feature content here */}
  <PremiumFeature />
</PaidUserCheck>
```

You can also customize the fallback UI:

```tsx
<PaidUserCheck
  fallback={
    <div className="custom-upgrade-prompt">
      <h3>Premium Feature</h3>
      <p>Please upgrade to access this feature.</p>
      <button>Upgrade Now</button>
    </div>
  }
>
  {/* Premium feature content */}
</PaidUserCheck>
```

## Programmatically Checking Payment Status

You can also check payment status in your code using the `usePaymentStatus` hook:

```tsx
import { usePaymentStatus } from '@/hooks/usePaymentStatus';

function MyComponent() {
  const { isLoading, isPaid, userId, error } = usePaymentStatus();
  
  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  if (!userId) return <p>Please sign in</p>;
  
  return (
    <div>
      {isPaid ? (
        <p>Welcome, premium user! Enjoy all features.</p>
      ) : (
        <p>Upgrade to premium to access all features.</p>
      )}
    </div>
  );
}
```

## Data Synchronization

All user data is automatically synchronized across devices when the user is signed in. The extension also maintains local cached copies of data for offline use.

## Firestore Security Rules

The Firestore security rules are set up to protect user data:

1. Only the authenticated user can read/write their own data
2. Public shared word lists can be read by anyone, but only modified by the creator

## Manual Testing

For testing the Firebase user service, you can use the test script at `src/tests/firebase-user-test.js`. This can be run in the browser console after importing:

```javascript
import * as test from './firebase-user-test.js';

// First sign in
await firebaseService.signInWithGoogle();

// Then run the tests
test.testFirebaseUserService();
```

## Production Setup

For the Israeli payment provider integration (future):

1. Create a webhook endpoint in your backend service
2. After a successful payment, the webhook should call `setUserPaymentStatus(userId, true)`
3. The user's payment status will update in Firestore
4. The UI will automatically reflect the premium status

## Troubleshooting

- **Authentication errors**: Check Firebase console for auth issues
- **Firestore errors**: Verify security rules and collection/document paths
- **Payment status not updating**: Check for proper user document creation

## Next Steps

1. Implement the Israeli payment provider integration
2. Add subscription expiration handling
3. Create an admin dashboard for managing user payments 