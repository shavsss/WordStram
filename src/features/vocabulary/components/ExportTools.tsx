'use client';

import React, { useState } from 'react';
import { File, FileDown, FileText, FileType, Languages, Download } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Word } from '../types';

interface ExportToolsProps {
  words: Word[];
  loading: boolean;
}

/**
 * קומפוננטת ייצוא נתונים
 */
export function ExportTools({ words, loading }: ExportToolsProps) {
  const [showExportOptions, setShowExportOptions] = useState(false);

  /**
   * ייצוא לקובץ JSON
   */
  const exportToJSON = () => {
    const content = JSON.stringify(words, null, 2);
    downloadFile(content, 'vocabulary.json', 'application/json');
  };

  /**
   * ייצוא לקובץ CSV
   */
  const exportToCSV = () => {
    const headers = ['id', 'word', 'translation', 'language', 'date', 'tags', 'examples', 'notes', 'level', 'lastReviewed', 'reviewCount'];
    const rows = words.map(word => {
      return [
        word.id,
        word.word,
        word.translation,
        word.language,
        word.date,
        word.tags?.join(';') || '',
        word.examples?.join(';') || '',
        word.notes || '',
        word.level?.toString() || '',
        word.lastReviewed || '',
        word.reviewCount?.toString() || ''
      ];
    });
    
    const content = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    downloadFile(content, 'vocabulary.csv', 'text/csv');
  };

  /**
   * ייצוא לקובץ טקסט
   */
  const exportToTXT = () => {
    const content = words.map(word => {
      return `${word.word} - ${word.translation} (${word.language})`;
    }).join('\n');
    
    downloadFile(content, 'vocabulary.txt', 'text/plain');
  };

  /**
   * ייצוא למסמך Anki
   */
  const exportToAnki = () => {
    const content = words.map(word => {
      const tags = word.tags?.join(' ') || '';
      return `${word.word}\t${word.translation}\t${word.examples?.join('<br>') || ''}\t${tags}`;
    }).join('\n');
    
    downloadFile(content, 'vocabulary_anki.txt', 'text/plain');
  };

  /**
   * הורדת הקובץ
   */
  const downloadFile = (content: string, fileName: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="p-2">טוען נתונים...</div>;
  }

  if (!words.length) {
    return <div className="p-2">אין מילים לייצוא</div>;
  }

  return (
    <div className="flex flex-col space-y-2 p-2">
      <Button 
        onClick={() => setShowExportOptions(!showExportOptions)}
        variant="outline"
        size="sm"
      >
        {showExportOptions ? 'הסתר אפשרויות ייצוא' : 'הצג אפשרויות ייצוא'}
      </Button>
      
      {showExportOptions && (
        <div className="flex flex-wrap gap-2 mt-2">
          <Button onClick={exportToJSON} variant="outline" size="sm">
            ייצוא ל-JSON
          </Button>
          <Button onClick={exportToCSV} variant="outline" size="sm">
            ייצוא ל-CSV
          </Button>
          <Button onClick={exportToTXT} variant="outline" size="sm">
            ייצוא לטקסט פשוט
          </Button>
          <Button onClick={exportToAnki} variant="outline" size="sm">
            ייצוא ל-Anki
          </Button>
        </div>
      )}
    </div>
  );
} 