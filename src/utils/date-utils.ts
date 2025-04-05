import { format } from 'date-fns';

/**
 * Convert an unsafe date value to a valid date
 * @param value The date value to check
 * @param defaultValue Default value to use in case of error
 * @returns A valid date or the default value
 */
export function safeDate(value: any, defaultValue: Date = new Date()): Date {
  try {
    // Check if value exists
    if (!value) return defaultValue;
    
    // CRITICAL: זיהוי וטיפול במקרה של [object Object] ומקרים דומים
    if (
      value === '[object Object]' || 
      value === '[object Object' ||
      (typeof value === 'string' && (
        value.includes('[object Object]') || 
        value.includes('[object Object')
      )) ||
      (value && typeof value.toString === 'function' && (
        value.toString() === '[object Object]' || 
        value.toString() === '[object Object'
      ))
    ) {
      console.log('WordStream: Intercepted [object Object] value in safeDate, using default date');
      return defaultValue;
    }
    
    // If it's already a Date object, return it if valid
    if (value instanceof Date) {
      // Check if the date is valid
      if (isNaN(value.getTime())) return defaultValue;
      return value;
    }
    
    // Firebase Timestamp object with toDate() method - זיהוי אובייקט Timestamp מ-Firestore
    if (value && typeof value === 'object' && typeof value.toDate === 'function') {
      try {
        const date = value.toDate();
        if (!isNaN(date.getTime())) {
          return date;
        }
      } catch (toDateError) {
        // Continue to other methods
      }
    }
    
    // Objects with seconds property (timestamp-like objects) - זיהוי אובייקט דמוי-Timestamp
    if (value && typeof value === 'object' && 'seconds' in value) {
      try {
        // Safe access to seconds property
        const seconds = typeof value.seconds === 'number' ? value.seconds : parseInt(String(value.seconds), 10);
        if (!isNaN(seconds)) {
          const timestamp = new Date(seconds * 1000);
          if (!isNaN(timestamp.getTime())) {
            return timestamp;
          }
        }
      } catch (secondsError) {
        // Continue to other methods
      }
    }
    
    // If it's a number, check if it's a reasonable timestamp
    if (typeof value === 'number') {
      // Validate against very old or future dates
      // Choose correct interpretation based on size (seconds vs milliseconds)
      const dateValue = value < 10000000000 ? new Date(value * 1000) : new Date(value);
      if (isNaN(dateValue.getTime()) || dateValue.getFullYear() < 1970 || dateValue.getFullYear() > 2100) {
        console.warn('WordStream: Invalid timestamp value:', value);
        return defaultValue;
      }
      return dateValue;
    }
    
    // If it's a string, ensure it's properly formatted
    if (typeof value === 'string') {
      // ביטול שגיאות במחרוזות מיוחדות
      if (value.startsWith('[object') || value.includes('undefined') || value.includes('null')) {
        return defaultValue;
      }
      
      // Common formats: ISO string, Firebase timestamp, etc.
      // Handle Firebase Timestamp objects that might be serialized as strings
      if (value.includes('seconds') && value.includes('nanoseconds')) {
        try {
          const parsedObj = JSON.parse(value);
          if (parsedObj.seconds) {
            return new Date(parsedObj.seconds * 1000);
          }
        } catch (e) {
          // If parsing fails, continue with normal date parsing
        }
      }
      
      // Try to parse as ISO string or other date format
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) {
        console.warn('WordStream: Invalid date string format:', value);
        return defaultValue;
      }
      
      // Additional sanity check for the parsed date
      if (dateValue.getFullYear() < 1970 || dateValue.getFullYear() > 2100) {
        console.warn('WordStream: Date value out of reasonable range:', value);
        return defaultValue;
      }
      
      return dateValue;
    }
    
    // Super aggressive approach for objects - check for common date fields
    if (value && typeof value === 'object') {
      // Common timestamp properties
      const timestampProps = [
        'time', 'date', 'timestamp', 'created', 'createdAt', 
        'modified', 'modifiedAt', 'updated', 'updatedAt'
      ];
      
      // Check for common date properties
      for (const prop of timestampProps) {
        if (prop in value && value[prop] !== null && value[prop] !== undefined) {
          try {
            // Recursive call to safeDate for the property value
            return safeDate(value[prop], defaultValue);
          } catch (propError) {
            // Continue to next property
          }
        }
      }
    }
    
    // For other types, attempt conversion but with extra safety checks
    const dateValue = new Date(String(value));
    
    // Check if the date is valid
    if (isNaN(dateValue.getTime())) {
      console.warn('WordStream: Failed to convert value to date:', value);
      return defaultValue;
    }
    
    // Sanity check the year
    if (dateValue.getFullYear() < 1970 || dateValue.getFullYear() > 2100) {
      console.warn('WordStream: Converted date out of reasonable range:', value);
      return defaultValue;
    }
    
    return dateValue;
  } catch (error) {
    console.warn('WordStream: Error parsing date value:', error);
    return defaultValue;
  }
}

/**
 * Format a date safely
 * @param value The date value
 * @param formatStr Format string
 * @param fallbackStr What to return in case of error
 * @returns Formatted date string or fallback
 */
export function safeFormatDate(value: any, formatStr: string = 'dd/MM/yyyy', fallbackStr: string = 'N/A'): string {
  try {
    const date = safeDate(value);
    return format(date, formatStr);
  } catch (error) {
    console.warn('WordStream: Error formatting date:', error);
    return fallbackStr;
  }
}

/**
 * Check if a value is a valid timestamp
 * @param value The value to check
 * @returns True if the value is a valid timestamp
 */
export function isValidTimestamp(value: any): boolean {
  if (!value) return false;
  
  // Check if it's a number
  if (typeof value === 'number') {
    // Check if it's a reasonable timestamp (between 1970 and 2100)
    const date = new Date(value);
    return !isNaN(date.getTime()) && date.getFullYear() >= 1970 && date.getFullYear() <= 2100;
  }
  
  // Check if it's a Date object
  if (value instanceof Date) {
    return !isNaN(value.getTime()) && value.getFullYear() >= 1970 && value.getFullYear() <= 2100;
  }
  
  // Try to parse as string
  try {
    const date = new Date(String(value));
    return !isNaN(date.getTime()) && date.getFullYear() >= 1970 && date.getFullYear() <= 2100;
  } catch (error) {
    return false;
  }
}

/**
 * Safely process a collection of items that might contain date fields
 * @param items Array of items
 * @param dateFields Array of field names that should be processed as dates
 * @returns Processed array with safe dates
 */
export function processDateFields<T>(items: T[], dateFields: string[]): T[] {
  if (!Array.isArray(items)) return [];
  
  return items.map(item => {
    if (!item) return item;
    
    const result = { ...item } as Record<string, any>;
    
    dateFields.forEach(field => {
      if (field in result) {
        result[field] = safeDate(result[field]);
      }
    });
    
    return result as unknown as T;
  });
}

/**
 * Safely transforms a Firestore timestamp to a Date object
 * Now with extreme robustness for handling any possible input
 * @param value Any valid timestamp value from Firestore
 * @returns A valid Date object, always! Never returns null.
 */
export function handleFirestoreTimestamp(value: any): Date {
  // Early return for null/undefined - ALWAYS return a valid date
  if (value === null || value === undefined) {
    return new Date();
  }

  try {
    // CRITICAL: Prevent toString() failures by catching Object.prototype.toString
    if (
      value === '[object Object]' || 
      value === '[object Object' ||
      (typeof value === 'string' && (
        value.includes('[object Object]') || 
        value.includes('[object Object')
      )) ||
      (value && typeof value.toString === 'function' && (
        value.toString() === '[object Object]' || 
        value.toString() === '[object Object'
      ))
    ) {
      console.log('WordStream: Intercepted [object Object] value, using current date');
      return new Date();
    }

    // Already a Date - just validate
    if (value instanceof Date) {
      return isValidTimestamp(value) ? value : new Date();
    }

    // Firebase Timestamp object with toDate() method
    if (value && typeof value === 'object' && typeof value.toDate === 'function') {
      try {
        const date = value.toDate();
        return isValidTimestamp(date) ? date : new Date();
      } catch (toDateError) {
        // Continue to other methods
      }
    }

    // Objects with seconds property (timestamp-like objects)
    if (value && typeof value === 'object' && 'seconds' in value) {
      try {
        // Safe access to seconds property
        const seconds = typeof value.seconds === 'number' ? value.seconds : parseInt(String(value.seconds), 10);
        if (!isNaN(seconds)) {
          const timestamp = new Date(seconds * 1000);
          return isValidTimestamp(timestamp) ? timestamp : new Date();
        }
      } catch (secondsError) {
        // Continue to other methods
      }
    }

    // Try parsing as JSON if it's a string
    if (typeof value === 'string') {
      // ביטול שגיאות במחרוזות מיוחדות - מקרים קיצוניים נוספים
      if (value.startsWith('[object') || value.includes('undefined') || value.includes('null')) {
        return new Date();
      }
      
      // Look for timestamp JSON structure
      if (value.includes('seconds') || value.includes('nanoseconds')) {
        try {
          const parsed = JSON.parse(value);
          if (parsed && parsed.seconds) {
            const seconds = typeof parsed.seconds === 'number' ? 
                         parsed.seconds : parseInt(String(parsed.seconds), 10);
            if (!isNaN(seconds)) {
              const timestamp = new Date(seconds * 1000);
              return isValidTimestamp(timestamp) ? timestamp : new Date();
            }
          }
        } catch (parseErr) {
          // If parsing fails, continue to next method
        }
      }
      
      // Try as simple date string
      try {
        const date = new Date(value);
        if (isValidTimestamp(date)) {
          return date;
        }
      } catch (dateError) {
        // Continue
      }
      
      // Extract numeric timestamp from string
      const numberMatch = value.match(/(\d+)/);
      if (numberMatch && numberMatch[1]) {
        const num = parseInt(numberMatch[1], 10);
        if (!isNaN(num)) {
          const timestamp = num < 10000000000 ? new Date(num * 1000) : new Date(num);
          if (isValidTimestamp(timestamp)) {
            return timestamp;
          }
        }
      }
    }
    
    // Handle number values directly
    if (typeof value === 'number') {
      try {
        const timestamp = value < 10000000000 ? new Date(value * 1000) : new Date(value);
        return isValidTimestamp(timestamp) ? timestamp : new Date();
      } catch (numberError) {
        // Continue
      }
    }

    // Super aggressive object inspection - search for any date-like property
    if (value && typeof value === 'object') {
      // Common timestamp properties
      const timestampProps = [
        'time', 'date', 'timestamp', 'created', 'createdAt', 
        'modified', 'modifiedAt', 'updated', 'updatedAt'
      ];
      
      // First depth properties
      for (const prop of timestampProps) {
        if (prop in value && value[prop] !== null && value[prop] !== undefined) {
          const propValue = value[prop];
          
          // Check if property is itself a date
          if (propValue instanceof Date) {
            return isValidTimestamp(propValue) ? propValue : new Date();
          }
          
          // Check if the property has toDate()
          if (typeof propValue === 'object' && propValue && typeof propValue.toDate === 'function') {
            try {
              const date = propValue.toDate();
              return isValidTimestamp(date) ? date : new Date();
            } catch (propToDateError) {
              // Continue
            }
          }
          
          // Check for seconds/nanoseconds pattern
          if (typeof propValue === 'object' && propValue && 'seconds' in propValue) {
            try {
              const seconds = typeof propValue.seconds === 'number' ? 
                          propValue.seconds : parseInt(String(propValue.seconds), 10);
              if (!isNaN(seconds)) {
                const timestamp = new Date(seconds * 1000);
                return isValidTimestamp(timestamp) ? timestamp : new Date();
              }
            } catch (propSecondsError) {
              // Continue
            }
          }
          
          // Try string conversion
          try {
            const asString = String(propValue);
            
            // סינון מיוחד למקרים של [object Object
            if (asString.includes('[object')) {
              continue;
            }
            
            const date = new Date(asString);
            if (isValidTimestamp(date)) {
              return date;
            }
          } catch (propStringError) {
            // Continue
          }
        }
      }
      
      // Second level properties (nested objects)
      for (const key in value) {
        const nestedValue = value[key];
        if (nestedValue && typeof nestedValue === 'object') {
          for (const prop of timestampProps) {
            if (prop in nestedValue && nestedValue[prop] !== null && nestedValue[prop] !== undefined) {
              // Recursive handling for nested timestamp properties
              try {
                const extractedDate = handleFirestoreTimestamp(nestedValue[prop]);
                if (extractedDate) {
                  return extractedDate;
                }
              } catch (nestedError) {
                // Continue
              }
            }
          }
        }
      }
    }

    // Paranoid fallback - ALWAYS return a valid date, never null
    return new Date();
  } catch (error) {
    console.log('WordStream: Date conversion error suppressed, using current date');
    return new Date();
  }
} 