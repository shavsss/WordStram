/**
 * פונקציות עזר כלליות
 */

/**
 * יוצר מזהה ייחודי עם אופציה להגדיר תחילית
 * @param prefix תחילית למזהה (אופציונלי)
 * @returns מזהה ייחודי באורך 36 תווים
 */
export function generateUniqueId(prefix?: string): string {
  // יצירת UUID v4
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  
  // החזרת המזהה עם או בלי תחילית
  return prefix ? `${prefix}-${uuid}` : uuid;
}

/**
 * פורמט תאריך בפורמט קריא
 * @param dateString מחרוזת תאריך או אובייקט Date
 * @returns מחרוזת מפורמטת של התאריך
 */
export function formatDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  return new Intl.DateTimeFormat('he-IL', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

/**
 * פורמט זמן בסרטון לתצוגת MM:SS או HH:MM:SS
 * @param seconds מספר שניות
 * @returns מחרוזת מפורמטת של הזמן
 */
export function formatVideoTime(seconds: number): string {
  if (isNaN(seconds)) return '00:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  // פורמט שעות:דקות:שניות אם יש שעות, אחרת דקות:שניות
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
}

/**
 * קיצור טקסט ארוך והוספת אליפסיס
 * @param text הטקסט לקיצור
 * @param maxLength האורך המקסימלי הרצוי
 * @returns הטקסט המקוצר עם אליפסיס אם נדרש
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  
  return `${text.substring(0, maxLength)}...`;
}

/**
 * המרת URL של סרטון ליוטיוב למזהה הסרטון
 * @param url כתובת מלאה של הסרטון
 * @returns מזהה הסרטון או null אם לא נמצא
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  
  // ביטוי רגולרי לזיהוי מזהי וידאו של יוטיוב במגוון פורמטים
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  
  if (match && match[2].length === 11) {
    return match[2];
  }
  
  return null;
}

/**
 * בדיקה אם ערך הוא אובייקט
 */
export function isObject(value: any): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * מיזוג עמוק של אובייקטים
 */
export function deepMerge<T extends Record<string, any>>(target: T, ...sources: Array<Record<string, any>>): T {
  if (!sources.length) return target;
  
  const source = sources.shift();
  
  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        deepMerge(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }
  
  return deepMerge(target, ...sources);
} 