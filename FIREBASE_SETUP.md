# השלמת הגדרות Firebase לתוסף WordStram2

מסמך זה מפרט את הצעדים האחרונים להשלמת הגדרת Firebase בתוסף.

## פרטי התצורה החסרים

בקובץ `.env` שבתיקייה `src` דרושים הפרטים הבאים:

1. **App ID המלא**
   - יש להחליף את `YOUR_APP_ID` בשורה `FIREBASE_APP_ID=1:719695800723:web:YOUR_APP_ID`

2. **מזהה המדידה**
   - יש להחליף את `YOUR_MEASUREMENT_ID` בשורה `FIREBASE_MEASUREMENT_ID=G-YOUR_MEASUREMENT_ID`

3. **Client ID של OAuth**
   - יש להחליף את `YOUR_CLIENT_ID` בשורה `OAUTH_CLIENT_ID=719695800723-YOUR_CLIENT_ID.apps.googleusercontent.com`

## איך להשיג את הפרטים החסרים

### עבור App ID והמדידות
1. פתח את [קונסולת Firebase](https://console.firebase.google.com/)
2. בחר את הפרויקט `wordstream-extension`
3. לחץ על סמל הגדרות (⚙️) בתפריט הצד ובחר "Project settings"
4. גלול למטה לאזור "Your apps"
5. תחת ה-Web app, תוכל למצוא את פרטי התצורה המלאים כולל App ID ומזהה המדידה

### עבור Client ID של OAuth
1. בקונסולת Firebase, לחץ על "Authentication" בתפריט הצד 
2. בחר את הלשונית "Sign-in method"
3. ב"Sign-in providers", מצא את "Google" ולחץ עליו
4. העתק את ה-Web Client ID מהשדה "Web SDK configuration"

## לאחר עדכון הפרטים

אחרי שעידכנת את כל הפרטים החסרים בקובץ `.env`, הרץ את הפקודה הבאה כדי לבנות מחדש את התוסף:

```
npm run build
```

כעת תוכל להתקין את התוסף מתיקיית `dist`. 