'use client';

import React, { useState, useMemo } from 'react';
import { 
  format, isSameDay, isSameMonth, isToday, 
  startOfMonth, endOfMonth, getDay, eachDayOfInterval, addDays, addMonths 
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Props for the DatePicker component
 */
interface DatePickerProps {
  selectedDate: string;
  onChange: (date: string) => void;
  onClose: () => void;
}

/**
 * DatePicker Component
 * 
 * תצוגה גרפית של לוח שנה לבחירת תאריך
 */
export function DatePicker({ selectedDate, onChange, onClose }: DatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate ? new Date(selectedDate) : new Date());
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  
  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = addDays(monthStart, -getDay(monthStart));
    const endDate = addDays(monthEnd, 6 - getDay(monthEnd));
    
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);
  
  /**
   * מעבר לחודש הקודם
   */
  const handlePrevMonth = () => {
    setCurrentMonth(prevMonth => addMonths(prevMonth, -1));
  };
  
  /**
   * מעבר לחודש הבא
   */
  const handleNextMonth = () => {
    setCurrentMonth(prevMonth => addMonths(prevMonth, 1));
  };
  
  /**
   * בחירת תאריך ספציפי
   */
  const handleSelectDate = (date: Date) => {
    onChange(format(date, 'yyyy-MM-dd'));
    onClose();
  };
  
  return (
    <div className="date-picker-calendar">
      <div className="date-picker-header">
        <div className="date-picker-month-year">
          {format(currentMonth, 'MMMM yyyy')}
        </div>
        <div className="date-picker-nav">
          <button onClick={handlePrevMonth} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <button onClick={handleNextMonth} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      
      <div className="date-picker-days">
        {dayNames.map(day => (
          <div key={day} className="date-picker-day-name">{day}</div>
        ))}
        
        {calendarDays.map(day => (
          <div
            key={day.toISOString()}
            className={`date-picker-day ${
              !isSameMonth(day, currentMonth) ? 'outside-month' : ''
            } ${isToday(day) ? 'today' : ''} ${
              selectedDate && isSameDay(day, new Date(selectedDate)) ? 'selected' : ''
            }`}
            onClick={() => handleSelectDate(day)}
          >
            {format(day, 'd')}
          </div>
        ))}
      </div>
    </div>
  );
} 