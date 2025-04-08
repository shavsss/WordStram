# מבנה נתונים ב-Firebase

מסמך זה מתאר את מבנה הנתונים ב-Firebase Firestore עבור אפליקציית WordStream.

## מבנה הנתונים המרכזי

מבנה הנתונים ב-Firestore מאורגן באופן היררכי:

```
users/{userId}/
  ├── videos/{videoId}/
  │    ├── notes/{noteId}
  │    └── chats/{conversationId}
  ├── words/{wordId}
  └── settings/{settingId}
```

### הסבר על מבנה הנתונים

#### 1. **משתמשים** - `users/{userId}`
- המזהה של המשתמש הוא ה-UID שמתקבל מ-Firebase Authentication
- כל משתמש מכיל קולקציה של סרטונים, מילים והגדרות

#### 2. **סרטונים** - `videos/{videoId}`
- הקולקציה מכילה את כל הסרטונים שהמשתמש צפה בהם
- `videoId` הוא בדרך כלל מזהה ייחודי של הסרטון (לדוגמה, מזהה YouTube)
- כל סרטון מכיל מידע כגון:
  - `videoTitle` - כותרת הסרטון
  - `videoURL` - כתובת URL של הסרטון
  - `lastViewed` - זמן הצפייה האחרון
  - `lastUpdated` - זמן העדכון האחרון
  - `platform` - הפלטפורמה של הסרטון (youtube, netflix וכו')
  - `thumbnailURL` - כתובת התמונה המוקטנת של הסרטון (אופציונלי)

#### 3. **הערות** - `notes/{noteId}`
- תת-קולקציה של סרטון המכילה את כל ההערות עבור אותו סרטון
- כל הערה מכילה:
  - `content` - תוכן ההערה (טקסט)
  - `timestamp` - זמן יצירת ההערה (Timestamp)
  - `videoTime` - הזמן בסרטון שאליו מתייחסת ההערה (בשניות)

#### 4. **צ'אטים** - `chats/{conversationId}`
- תת-קולקציה של סרטון המכילה את כל שיחות הצ'אט עבור אותו סרטון
- כל שיחת צ'אט מכילה:
  - `conversationId` - מזהה ייחודי של השיחה
  - `videoId` - מזהה הסרטון המשויך
  - `videoTitle` - כותרת הסרטון
  - `videoURL` - כתובת URL של הסרטון
  - `lastUpdated` - זמן העדכון האחרון (Timestamp)
  - `messages` - מערך של הודעות בשיחה, כל הודעה מכילה:
    - `role` - תפקיד השולח ('user' או 'assistant')
    - `content` - תוכן ההודעה
    - `timestamp` - זמן שליחת ההודעה (Timestamp)

#### 5. **מילים** - `words/{wordId}`
- קולקציה המכילה את כל המילים שהמשתמש שמר
- כל רשומת מילה מכילה:
  - `originalWord` - המילה המקורית
  - `translatedWord` - התרגום של המילה
  - `sourceLanguage` - שפת המקור
  - `targetLanguage` - שפת היעד
  - `context` - ההקשר שבו המילה הופיעה (אופציונלי)
  - `timestamp` - זמן השמירה (Timestamp)
  - `videoId` - מזהה הסרטון שממנו נשמרה המילה (אופציונלי)
  - `videoTitle` - כותרת הסרטון (אופציונלי)

## גישה לנתונים

### קריאת נתונים
לדוגמה, כדי לקרוא את כל ההערות עבור סרטון מסוים:

```typescript
const notesRef = collection(firestore, `users/${userId}/videos/${videoId}/notes`);
const notesSnapshot = await getDocs(notesRef);
const notes = notesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```

### כתיבת נתונים
לדוגמה, כדי לשמור הערה חדשה:

```typescript
const notesRef = collection(firestore, `users/${userId}/videos/${videoId}/notes`);
const docRef = await addDoc(notesRef, {
  content: 'תוכן ההערה',
  timestamp: Timestamp.now(),
  videoTime: 45.2 // זמן בסרטון בשניות
});
```

### האזנה לשינויים בזמן אמת
לדוגמה, האזנה לשינויים בהערות:

```typescript
const notesRef = collection(firestore, `users/${userId}/videos/${videoId}/notes`);
const unsubscribe = onSnapshot(notesRef, (snapshot) => {
  const notes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  // עשה משהו עם הנתונים המעודכנים
});

// מאוחר יותר, כדי להפסיק את ההאזנה:
unsubscribe();
```

## ניהול סנכרון

האפליקציה מנהלת סנכרון דו-כיווני בין LocalStorage ל-Firestore באמצעות הפונקציות הבאות:

1. `syncChatsBetweenStorageAndFirestore()` - סנכרון דו-כיווני של צ'אטים
2. `syncVideosToLocalStorage()` - סנכרון סרטונים מ-Firestore ל-LocalStorage
3. `syncNotesToLocalStorage()` - סנכרון הערות מ-Firestore ל-LocalStorage
4. `syncChatsToLocalStorage()` - סנכרון צ'אטים מ-Firestore ל-LocalStorage

מומלץ להריץ את פונקציית `syncChatsBetweenStorageAndFirestore()` בעת:
- התחברות משתמש למערכת
- אתחול האפליקציה
- שינויים משמעותיים בנתונים

## איתור תקלות

בעת איתור תקלות במערכת הנתונים, מומלץ:

1. לבדוק את הקונסול לקבלת הודעות שגיאה מפורטות
2. להשתמש בפונקציות דיבוג:
   - `debugFirestoreStructure(userId)` - לבדיקת מבנה הנתונים הכללי
   - `debugChats(userId)` - לבדיקה מפורטת של צ'אטים

3. לוודא שהמשתמש מחובר למערכת לפני כל פעולת קריאה/כתיבה
4. לבדוק את מבנה הנתנוים ב-Firebase Console בכתובת הבאה:
   https://console.firebase.google.com/project/YOUR_PROJECT_ID/firestore/data/ 