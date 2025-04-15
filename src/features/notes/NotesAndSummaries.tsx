import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { Note, VideoNote, VideoWithNotes, NotesStorage } from './types';
import { saveNote, deleteNote } from '../../auth/database';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

interface NotesAndSummariesProps {
  onBack: () => void;
}

// Helper function to safely format dates
function formatDate(date: Date | string | number | null | undefined, formatStr: string): string {
  try {
    if (!date) return 'N/A';
    
    // If it's a string, try to convert it to a Date
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if it's a valid date
    if (dateObj instanceof Date && isNaN(dateObj.getTime())) {
      return 'Invalid date';
    }
    
    return format(dateObj, formatStr);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Error formatting date';
  }
}

export function NotesAndSummaries({ onBack }: NotesAndSummariesProps) {
  const [videosWithNotes, setVideosWithNotes] = useState<VideoWithNotes[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoWithNotes | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isDeletingNote, setIsDeletingNote] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'list' | 'video'>('list');
  
  // Handle click outside to close export menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Setup synchronization and listeners for real-time updates
  useEffect(() => {
    let broadcastCleanup: (() => void) | null = null;

    async function initializeSync() {
      try {
        // Setup listener for window message events
        const messageHandler = (event: MessageEvent) => {
          if (!event.data || typeof event.data !== 'object') return;
          handleBroadcastMessage(event.data);
        };
        
        window.addEventListener('message', messageHandler);
        
        return () => {
          if (broadcastCleanup) broadcastCleanup();
          window.removeEventListener('message', messageHandler);
        };
      } catch (error) {
        console.error('Error initializing in NotesAndSummaries:', error);
        return () => {};
      }
    }
    
    // Call the async initialization function
    const cleanup = initializeSync();
    
    // Cleanup on unmount
    return () => {
      cleanup.then(cleanupFn => cleanupFn && cleanupFn());
    };
  }, []);
  
  // Process broadcast messages
  const handleBroadcastMessage = useCallback((message: any) => {
    // Handle note deletion
    if (message.action === 'NOTE_DELETED' && message.noteId) {
      console.log('Received note deletion broadcast:', message.noteId);
      
      // Update the current video notes if it's selected
      if (selectedVideo && selectedVideo.notes) {
        setSelectedVideo(prev => {
          if (!prev) return null;
          return {
            ...prev,
            notes: prev.notes.filter(note => note.id !== message.noteId)
          };
        });
      }
      
      // Update the videos list if needed
      setVideosWithNotes(prevVideos => {
        return prevVideos.map(video => {
          return {
            ...video,
            notes: video.notes.filter(note => note.id !== message.noteId)
          };
        });
      });
    }
    
    // Handle note added
    if (message.action === 'NOTE_ADDED' && message.note) {
      console.log('Received new note broadcast:', message.note.id);
      
      const newNote = message.note;
      const videoId = newNote.videoId;
      
      if (!videoId) return;
      
      // Check if we already have this video in our list
      const existingVideoIndex = videosWithNotes.findIndex(v => v.videoId === videoId);
      
      if (existingVideoIndex >= 0) {
        // Update existing video's notes
        setVideosWithNotes(prevVideos => {
          const updatedVideos = [...prevVideos];
          
          // Check if note already exists
          const existingNoteIndex = updatedVideos[existingVideoIndex].notes.findIndex(n => n.id === newNote.id);
          
          if (existingNoteIndex >= 0) {
            // Update existing note
            updatedVideos[existingVideoIndex].notes[existingNoteIndex] = newNote;
          } else {
            // Add new note
            updatedVideos[existingVideoIndex].notes.push(newNote);
          }
          
          // Update lastUpdated
          updatedVideos[existingVideoIndex].lastUpdated = new Date().toISOString();
          
          return updatedVideos;
        });
        
        // Also update selected video if needed
        if (selectedVideo && selectedVideo.videoId === videoId) {
          setSelectedVideo(prev => {
            if (!prev) return null;
            
            // Check if note already exists
            const existingNoteIndex = prev.notes.findIndex(n => n.id === newNote.id);
            
            if (existingNoteIndex >= 0) {
              // Update existing note
              const updatedNotes = [...prev.notes];
              updatedNotes[existingNoteIndex] = newNote;
              
              return {
                ...prev,
                notes: updatedNotes,
                lastUpdated: new Date().toISOString()
              };
            } else {
              // Add new note
              return {
                ...prev,
                notes: [...prev.notes, newNote],
                lastUpdated: new Date().toISOString()
              };
            }
          });
        }
      } else {
        // This is a new video, create it
        const newVideo: VideoWithNotes = {
          videoId,
          videoTitle: newNote.videoTitle || 'Unknown Video',
          videoURL: newNote.videoURL || `https://www.youtube.com/watch?v=${videoId}`,
          lastUpdated: new Date().toISOString(),
          notes: [newNote]
        };
        
        setVideosWithNotes(prevVideos => [newVideo, ...prevVideos]);
      }
    }
    
    // Handle sync complete event
    if (message.action === 'NOTES_SYNCED') {
      console.log('Received notes sync broadcast');
      // Reload all notes
      loadAllNotes();
    }
  }, [selectedVideo, videosWithNotes]);

  // Load notes from storage
  const loadAllNotes = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Implementation will be added to load from Firebase via auth/database
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading notes:', error);
      setError('Failed to load notes. Please try again later.');
      setIsLoading(false);
    }
  };

  // Format video time for display
  const formatVideoTime = (seconds: number): string => {
    if (isNaN(seconds)) return '00:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(remainingSeconds).padStart(2, '0');
    
    return `${formattedMinutes}:${formattedSeconds}`;
  };

  // View a specific video's notes
  const viewVideoNotes = (video: VideoWithNotes) => {
    setSelectedVideo(video);
    setMode('video');
  };

  // Go back to the list view
  const backToList = () => {
    setSelectedVideo(null);
    setMode('list');
  };

  // Delete a specific note
  const deleteNote = async (noteId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this note?')) {
      return;
    }
    
    try {
      setIsDeletingNote(noteId);
      
      // Delete from database
      if (selectedVideo) {
        await deleteNote(selectedVideo.videoId, noteId);
      }
      
      // Update UI
      if (selectedVideo) {
        setSelectedVideo(prev => {
          if (!prev) return null;
          return {
            ...prev,
            notes: prev.notes.filter(note => note.id !== noteId)
          };
        });
      }
      
      setVideosWithNotes(prev => {
        return prev.map(video => {
          return {
            ...video,
            notes: video.notes.filter(note => note.id !== noteId)
          };
        }).filter(video => video.notes.length > 0);
      });
      
      setIsDeletingNote(null);
    } catch (error) {
      console.error('Error deleting note:', error);
      setIsDeletingNote(null);
    }
  };

  // Export notes as a document
  const exportNotes = async (video: VideoWithNotes, format: 'docx' | 'txt' | 'html' | 'json' = 'docx') => {
    try {
      setIsExporting(true);
      setShowExportMenu(false);
      
      if (format === 'docx') {
        // Create a new Document
        const doc = new Document({
          sections: [
            {
              properties: {},
              children: [
                new Paragraph({
                  text: `Notes for: ${video.videoTitle}`,
                  heading: HeadingLevel.HEADING_1,
                  alignment: AlignmentType.CENTER,
                  border: {
                    bottom: {
                      color: "auto",
                      space: 1,
                      style: BorderStyle.SINGLE,
                      size: 6,
                    },
                  },
                }),
                new Paragraph({
                  text: `Exported on: ${new Date().toLocaleDateString()}`,
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  text: `Video URL: ${video.videoURL}`,
                  alignment: AlignmentType.CENTER,
                }),
                new Paragraph({
                  text: "",
                }),
                ...video.notes.flatMap((note, index) => {
                  return [
                    new Paragraph({
                      text: `Note ${index + 1}: ${note.title || 'Untitled Note'}`,
                      heading: HeadingLevel.HEADING_2,
                    }),
                    note.videoTime !== undefined
                      ? new Paragraph({
                          text: `Timestamp: ${formatVideoTime(note.videoTime)}`,
                          alignment: AlignmentType.LEFT,
                        })
                      : new Paragraph({}),
                    new Paragraph({
                      text: `Created: ${new Date(note.createdAt).toLocaleString()}`,
                      alignment: AlignmentType.LEFT,
                    }),
                    new Paragraph({
                      text: note.content,
                      alignment: AlignmentType.LEFT,
                    }),
                    new Paragraph({
                      text: "",
                    }),
                  ];
                }),
              ],
            },
          ],
        });

        // Generate and save the DOCX file
        const buffer = await Packer.toBuffer(doc);
        saveAs(
          new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }),
          `${video.videoTitle.replace(/[^a-z0-9]/gi, "_")}_notes.docx`
        );
      } else if (format === 'txt') {
        // Create text content
        let content = `Notes for: ${video.videoTitle}\n`;
        content += `Exported on: ${new Date().toLocaleDateString()}\n`;
        content += `Video URL: ${video.videoURL}\n\n`;
        
        video.notes.forEach((note, index) => {
          content += `--- Note ${index + 1}: ${note.title || 'Untitled Note'} ---\n`;
          if (note.videoTime !== undefined) {
            content += `Timestamp: ${formatVideoTime(note.videoTime)}\n`;
          }
          content += `Created: ${new Date(note.createdAt).toLocaleString()}\n`;
          content += `${note.content}\n\n`;
        });
        
        // Save as text file
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, `${video.videoTitle.replace(/[^a-z0-9]/gi, '_')}_notes.txt`);
      } else if (format === 'json') {
        // Export as JSON
        const jsonData = JSON.stringify(video, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json;charset=utf-8' });
        saveAs(blob, `${video.videoTitle.replace(/[^a-z0-9]/gi, '_')}_notes.json`);
      }
      
      setIsExporting(false);
    } catch (error) {
      console.error('Error exporting notes:', error);
      setIsExporting(false);
    }
  };

  // Open video in a new tab
  const openVideo = (url: string, event: React.MouseEvent) => {
    event.stopPropagation();
    window.open(url, '_blank');
  };

  // Export menu component
  const ExportMenu = () => (
    <div 
      ref={exportMenuRef} 
      className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50"
      style={{
        position: 'absolute',
        right: '0',
        marginTop: '8px',
        width: '192px',
        backgroundColor: 'white',
        borderRadius: '6px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        padding: '4px 0',
        zIndex: 50,
      }}
    >
      <button
        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
        onClick={() => selectedVideo && exportNotes(selectedVideo, 'docx')}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '8px 16px',
          fontSize: '14px',
          color: '#374151',
        }}
      >
        Export as Word (.docx)
      </button>
      <button
        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
        onClick={() => selectedVideo && exportNotes(selectedVideo, 'txt')}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '8px 16px',
          fontSize: '14px',
          color: '#374151',
        }}
      >
        Export as Text (.txt)
      </button>
      <button
        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
        onClick={() => selectedVideo && exportNotes(selectedVideo, 'json')}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          padding: '8px 16px',
          fontSize: '14px',
          color: '#374151',
        }}
      >
        Export as JSON
      </button>
    </div>
  );

  // Component for the main notes UI
  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-gray-200">
        {mode === 'video' && (
          <button 
            onClick={backToList} 
            className="mr-2 text-gray-600 hover:text-gray-900"
          >
            &larr; Back
          </button>
        )}
        <h2 className="text-xl font-semibold flex-grow">
          {mode === 'list' ? 'Notes & Summaries' : selectedVideo?.videoTitle}
        </h2>
        {mode === 'video' && (
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="ml-2 px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              disabled={isExporting}
            >
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
            {showExportMenu && <ExportMenu />}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-grow overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="text-center text-red-500 p-4">{error}</div>
        ) : mode === 'list' ? (
          videosWithNotes.length === 0 ? (
            <div className="text-center text-gray-500 p-4">
              No notes found. Watch videos and create notes to see them here.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {videosWithNotes.map((video) => (
                <div
                  key={video.videoId}
                  onClick={() => viewVideoNotes(video)}
                  className="bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer border border-gray-200"
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0 w-24 h-16 bg-gray-200 rounded overflow-hidden mr-4">
                      {video.videoThumbnail ? (
                        <img
                          src={video.videoThumbnail}
                          alt={video.videoTitle}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          No Image
                        </div>
                      )}
                    </div>
                    <div className="flex-grow">
                      <h3 className="font-medium text-gray-900 mb-1 line-clamp-1">{video.videoTitle}</h3>
                      <p className="text-sm text-gray-500 mb-2">
                        {video.notes.length} note{video.notes.length !== 1 ? 's' : ''}
                      </p>
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => openVideo(video.videoURL, e)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Open Video
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          selectedVideo && (
            <div className="space-y-4">
              {selectedVideo.notes.length === 0 ? (
                <div className="text-center text-gray-500 p-4">
                  No notes found for this video.
                </div>
              ) : (
                selectedVideo.notes.map((note) => (
                  <div
                    key={note.id}
                    className="bg-white p-4 rounded-lg shadow border border-gray-200"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-medium text-gray-900">
                        {note.title || 'Untitled Note'}
                        {note.videoTime !== undefined && (
                          <span className="ml-2 text-sm text-gray-500">
                            @ {formatVideoTime(note.videoTime)}
                          </span>
                        )}
                      </h3>
                      <button
                        onClick={(e) => deleteNote(note.id, e)}
                        className="text-red-500 hover:text-red-700"
                        disabled={isDeletingNote === note.id}
                      >
                        {isDeletingNote === note.id ? '...' : 'Delete'}
                      </button>
                    </div>
                    <div className="whitespace-pre-wrap text-gray-700">{note.content}</div>
                    <div className="mt-2 text-xs text-gray-400">
                      Created: {formatDate(note.createdAt, 'dd/MM/yyyy HH:mm')}
                    </div>
                  </div>
                ))
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
} 