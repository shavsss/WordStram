import { format, isValid, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

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
    
    // נסיון לפרסר כ-ISO
    const parsedDate = parseISO(String(dateString));
    if (isValid(parsedDate)) {
      return parsedDate;
    }
    
    // נסיון לפרסר כתאריך רגיל
    const date = new Date(String(dateString));
    return isValid(date) ? date : null;
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
}

/**
 * פונקציה בטוחה לפורמוט תאריכים
 * @param date תאריך
 * @param formatStr מחרוזת פורמט
 * @param defaultValue ערך ברירת מחדל למקרה של שגיאה
 * @returns מחרוזת מפורמטת
 */
export function safeFormatDate(
  date: string | Date | number | null | undefined, 
  formatStr: string = 'dd/MM/yyyy', 
  defaultValue: string = '-'
): string {
  const parsedDate = safeDate(date);
  if (!parsedDate) return defaultValue;
  
  try {
    return format(parsedDate, formatStr, { locale: he });
  } catch (error) {
    console.error('Error formatting date:', error);
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
 * מחזיר מחרוזת יחסית לגבי זמן (לפני 5 דקות, לפני שעה, וכו')
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
  if (diffSec < 60) return 'לפני רגע';
  
  // דקות
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `לפני ${diffMin} דקות`;
  
  // שעות
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `לפני ${diffHour} שעות`;
  
  // ימים
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `לפני ${diffDay} ימים`;
  
  // חודשים
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `לפני ${diffMonth} חודשים`;
  
  // שנים
  const diffYear = Math.floor(diffMonth / 12);
  return `לפני ${diffYear} שנים`;
} 