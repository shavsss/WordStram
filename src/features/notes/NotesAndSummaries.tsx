import React, { useState, useEffect } from 'react';
import { Message, MessageType, createMessage } from '../../shared/message';
import { getPortConnection } from '../../utils/port-connection';

interface NotesAndSummariesProps {
  onBack: () => void;
}

/**
 * Component for displaying notes and summaries
 */
export const NotesAndSummaries: React.FC<NotesAndSummariesProps> = ({ onBack }) => {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Fetch notes when component mounts
    const fetchNotes = async () => {
      try {
        setLoading(true);
        
        const portConnection = getPortConnection();
        const response = await portConnection.sendMessage(
          createMessage(MessageType.GET_SETTINGS, { section: 'notes' }),
          MessageType.SETTINGS_UPDATED
        );
        
        if (response.error) {
          setError(response.error);
        } else if (response.data?.notes) {
          setNotes(response.data.notes);
        }
      } catch (err) {
        setError('Failed to load notes');
        console.error('Error loading notes:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchNotes();
  }, []);
  
  return (
    <div className="notes-and-summaries">
      <div className="notes-header">
        <button className="back-button" onClick={onBack}>
          &larr; חזרה
        </button>
        <h2>הערות וסיכומים</h2>
      </div>
      
      {loading ? (
        <div className="loading">טוען...</div>
      ) : error ? (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={onBack}>חזרה</button>
        </div>
      ) : notes.length === 0 ? (
        <div className="empty-state">
          <p>אין הערות או סיכומים שמורים</p>
          <button onClick={onBack}>חזרה</button>
        </div>
      ) : (
        <div className="notes-list">
          {notes.map((note, index) => (
            <div key={index} className="note-card">
              <div className="note-title">{note.title || 'הערה ללא כותרת'}</div>
              <div className="note-timestamp">
                {new Date(note.timestamp).toLocaleString('he-IL')}
              </div>
              <div className="note-content">{note.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 