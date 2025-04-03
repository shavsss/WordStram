# Hooks

תיקייה זו מכילה React Hooks גלובליים שיכולים לשמש ברחבי האפליקציה. הוקים אלו מספקים פונקציונליות משותפת שאינה ספציפית לפיצ'ר מסוים.

## הוקים זמינים

### `useAuth.ts`
הוק לניהול אימות משתמשים, מתממשק עם Firebase Auth ועם האובייקט הגלובלי WordStream.

```typescript
const { currentUser, isAuthenticated, signInWithEmail, signOut } = useAuth();
```

### `useVideo.ts`
הוק לאינטראקציה עם הסרטון הנוכחי, כולל פונקציות לקבלת ושליטה במצב הסרטון.

```typescript
const { currentTime, duration, videoId, seekTo, getVideoTime, formatTime } = useVideo();
```

### `useLocalStorage.ts`
הוק לגישה וניהול של אחסון מקומי עם תמיכה בטיפוסים.

```typescript
const [value, setValue] = useLocalStorage<string[]>('my-key', []);
```

## הנחיות לכתיבת Hooks

1. **שמות קבצים** - התחילו תמיד ב-`use` ובהמשך camelCase (למשל `useMyFeature.ts`).
2. **תיעוד** - יש לספק הערות JSDoc המתארות את ההוק ואת הפרמטרים והערכים המוחזרים שלו.
3. **טיפוסים** - יש להשתמש בטיפוסים מפורשים עבור כל הפרמטרים והערכים המוחזרים.
4. **ניהול טעויות** - יש לטפל בטעויות בצורה מסודרת ולהחזיר ערכי שגיאה מתאימים.
5. **ניקוי משאבים** - יש לוודא ניקוי משאבים מתאים ב-`useEffect`.

## דוגמה למבנה הוק

```typescript
/**
 * הוק לניהול [תיאור]
 * @param param1 תיאור הפרמטר הראשון
 * @returns ערכים וחשבוניות שההוק מחזיר
 */
export function useMyHook(param1: Type1): ReturnType {
  const [state, setState] = useState<StateType>(initialState);
  
  useEffect(() => {
    // אתחול
    
    return () => {
      // ניקוי
    };
  }, [dependencies]);
  
  const handleSomething = useCallback(() => {
    // פונקציונליות
  }, [dependencies]);
  
  return {
    state,
    handleSomething
  };
} 