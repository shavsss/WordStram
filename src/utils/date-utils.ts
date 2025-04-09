/**
 * Utilities for handling dates in a simple, global way without dependencies
 * פונקציות עזר לטיפול בתאריכים בצורה פשוטה וגלובלית ללא תלויות
 */

import { format as dateFnsFormat } from 'date-fns';

/**
 * המרה בטוחה של מחרוזת תאריך לאובייקט Date
 * @param dateString מחרוזת תאריך
 * @returns אובייקט Date או null אם הפרסור נכשל
 */
export function safeDate(dateString: string | Date | number | null | undefined): Date | null {
  if (!dateString) return null;
  
  try {
    if (dateString instanceof Date) return dateString;
    
    if (typeof dateString === 'number') {
      return new Date(dateString);
    }
    
    // נסיון לפרסר תאריך
    const date = new Date(String(dateString));
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
}

/**
 * מעטפת בטוחה לפונקציית format של date-fns
 * שמונעת קריסה בסביבות עם לוקל שונה
 * @param date תאריך לפורמט
 * @param formatStr מחרוזת פורמט
 * @param options אפשרויות נוספות
 * @returns מחרוזת מפורמטת או ערך ברירת מחדל במקרה של שגיאה
 */
export function safeDateFormat(
  date: string | Date | number | null | undefined,
  formatStr: string,
  defaultValue: string = '-'
): string {
  const parsedDate = safeDate(date);
  if (!parsedDate) return defaultValue;
  
  try {
    // נסיון להשתמש ב-date-fns format
    return dateFnsFormat(parsedDate, formatStr);
  } catch (error) {
    console.error('Error using date-fns format:', error);
    
    // פתרון חלופי במקרה של שגיאה - פורמט בסיסי מובנה של JavaScript
    try {
      if (formatStr.includes('yyyy') || formatStr.includes('YYYY')) {
        // פורמט עם שנה
        return parsedDate.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (formatStr === 'd' || formatStr === 'D') {
        // רק יום בחודש
        return String(parsedDate.getDate());
      } else if (formatStr.includes('HH') || formatStr.includes('mm')) {
        // זמן
        return parsedDate.toISOString().split('T')[1].substring(0, 5); // HH:MM
      }
      // ברירת מחדל
      return parsedDate.toLocaleDateString();
    } catch (backupError) {
      console.error('Error in backup date formatting:', backupError);
      return defaultValue;
    }
  }
}

/**
 * פונקציה בטוחה לפורמוט תאריכים בפורמט בינלאומי
 * @param date תאריך
 * @param defaultValue ערך ברירת מחדל למקרה של שגיאה
 * @returns מחרוזת מפורמטת
 */
export function safeFormatDate(
  date: string | Date | number | null | undefined,
  defaultValue: string = '-'
): string {
  const parsedDate = safeDate(date);
  if (!parsedDate) return defaultValue;
  
  try {
    // פורמט בינלאומי YYYY-MM-DD (ISO)
    const year = parsedDate.getFullYear();
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const day = String(parsedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return defaultValue;
  }
}

/**
 * יצירת תאריך מפורמט בצורה מקומית (לפי הגדרות הדפדפן)
 * @param date תאריך
 * @param defaultValue ערך ברירת מחדל למקרה של שגיאה
 */
export function formatLocalDate(
  date: string | Date | number | null | undefined,
  defaultValue: string = '-'
): string {
  const parsedDate = safeDate(date);
  if (!parsedDate) return defaultValue;
  
  try {
    // שימוש באופן שבו הדפדפן מציג תאריכים לפי הגדרות המערכת של המשתמש
    return parsedDate.toLocaleDateString();
  } catch (error) {
    console.error('Error formatting date locally:', error);
    return defaultValue;
  }
}

/**
 * יצירת מחרוזת שעה מפורמטת בצורה מקומית
 * @param date תאריך
 * @param defaultValue ערך ברירת מחדל למקרה של שגיאה
 */
export function formatLocalTime(
  date: string | Date | number | null | undefined,
  defaultValue: string = '-'
): string {
  const parsedDate = safeDate(date);
  if (!parsedDate) return defaultValue;
  
  try {
    // שימוש באופן שבו הדפדפן מציג שעות לפי הגדרות המערכת של המשתמש
    return parsedDate.toLocaleTimeString();
  } catch (error) {
    console.error('Error formatting time locally:', error);
    return defaultValue;
  }
}

/**
 * בדיקה אם תאריך הוא היום
 * @param date תאריך לבדיקה
 */
export function isToday(date: Date | string | number | null | undefined): boolean {
  const parsedDate = safeDate(date);
  if (!parsedDate) return false;
  
  const today = new Date();
  return (
    parsedDate.getDate() === today.getDate() &&
    parsedDate.getMonth() === today.getMonth() &&
    parsedDate.getFullYear() === today.getFullYear()
  );
}

/**
 * מחזיר מחרוזת יחסית לגבי זמן באנגלית (5 minutes ago, 1 hour ago, etc.)
 * @param date התאריך להצגה יחסית
 * @returns מחרוזת המתארת את הזמן היחסי
 */
export function timeAgo(date: Date | string | number | null | undefined): string {
  const parsedDate = safeDate(date);
  if (!parsedDate) return '';
  
  const now = new Date();
  const diffMs = now.getTime() - parsedDate.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  
  // פחות מדקה
  if (diffSec < 60) return 'just now';
  
  // דקות
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  
  // שעות
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  
  // ימים
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  
  // חודשים
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth} month${diffMonth > 1 ? 's' : ''} ago`;
  
  // שנים
  const diffYear = Math.floor(diffMonth / 12);
  return `${diffYear} year${diffYear > 1 ? 's' : ''} ago`;
} 