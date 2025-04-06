import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Note, VideoNote, VideoWithNotes, NotesStorage } from '@/features/notes/types';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/Spinner';
import { File, ChevronLeft, FileText, Download, DownloadCloud, Trash2, ExternalLink, Clock, Calendar, Video, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import * as BackgroundMessaging from '@/utils/background-messaging';
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
    
    return format(dateObj, formatStr, { locale: enUS });
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
    let syncCleanup: (() => void) | null = null;
    let broadcastCleanup: (() => void) | null = null;

    async function initializeSync() {
      try {
        // Initialize data sync with Firestore (this also sets up broadcast listener internally)
        syncCleanup = await BackgroundMessaging.initializeDataSync();
        
        // Setup additional listener for localStorage broadcast events
        broadcastCleanup = BackgroundMessaging.setupBroadcastListener((message) => {
          handleBroadcastMessage(message);
        });
        
        // Setup listener for window message events
        const messageHandler = (event: MessageEvent) => {
          if (!event.data || typeof event.data !== 'object') return;
          handleBroadcastMessage(event.data);
        };
        
        window.addEventListener('message', messageHandler);
        
        return () => {
          if (syncCleanup) syncCleanup();
          if (broadcastCleanup) broadcastCleanup();
          window.removeEventListener('message', messageHandler);
        };
      } catch (error) {
        console.error('WordStream: Error initializing sync in NotesAndSummaries:', error);
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
      console.log('WordStream: Received note deletion broadcast in popup:', message.noteId);
      
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
      console.log('WordStream: Received new note broadcast in popup:', message.noteId);
      
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
      console.log('WordStream: Received notes sync broadcast in popup');
      // Reload all notes
      loadAllNotes();
    }
  }, [selectedVideo, videosWithNotes]);

  // Load notes when component mounts
  useEffect(() => {
    loadAllNotes();
    
    // Check connection to Firestore
    BackgroundMessaging.checkFirestoreConnection()
      .then(status => {
        console.log('WordStream: Firestore connection status:', status);
        if (!status.connected && status.error) {
          console.warn(`WordStream: Firestore connection issue: ${status.error}`);
        }
      })
      .catch(err => {
        console.error('WordStream: Error checking Firestore connection:', err);
      });
  }, []);

  // Force sync notes with Firestore
  const syncWithFirestore = async () => {
    try {
      setIsSyncing(true);
      console.log('WordStream: Syncing notes with Firestore');
      
      // במקום גישה ישירה לfirestoreService, השתמש ב-BackgroundMessaging
      const connectionStatus = await BackgroundMessaging.checkFirestoreConnection();
      
      if (!connectionStatus.connected || !connectionStatus.authenticated) {
        setError('Connection error: Unable to access user account or server');
        setIsSyncing(false);
        return;
      }
      
      setIsSyncing(false);
      loadAllNotes();
    } catch (error) {
      console.error('WordStream: Error syncing with Firestore:', error);
      setError('Error syncing notes');
      setIsSyncing(false);
    }
  };

  // Load all notes from Firestore and local storage
  const loadAllNotes = async () => {
    try {
      setIsLoading(true);
      setSelectedVideo(null);
      
      // Get notes using background messaging
      const videosWithNotes = await BackgroundMessaging.getAllVideosWithNotes();
      
      if (videosWithNotes && videosWithNotes.length > 0) {
        // Make sure each video has title and URL
        const processedVideos = videosWithNotes.map(video => {
          // Ensure video title exists and is properly formatted
          if (!video.videoTitle || video.videoTitle === 'Unknown Video') {
            // Try to extract title from URL or videoId
            const videoId = video.videoId;
            video.videoTitle = video.videoTitle || `Video: ${videoId}`;
          }
          
          // Ensure video URL exists
          if (!video.videoURL && video.videoId) {
            video.videoURL = `https://www.youtube.com/watch?v=${video.videoId}`;
          }
          
          // Ensure notes are sorted by timestamp (newest first)
          if (video.notes && Array.isArray(video.notes)) {
            video.notes = video.notes.sort((a, b) => {
              return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            });
            
            // Process each note to ensure it has all required fields
            video.notes = video.notes.map(note => {
              // Add formatted time display if videoTime exists
              if (note.videoTime && !note.formattedTime) {
                note.formattedTime = formatVideoTime(note.videoTime);
              }
              
              return note;
            });
          }
          
          return video;
        });
        
        setVideosWithNotes(processedVideos);
        setMode('list');
        setError(null);
      } else {
        setVideosWithNotes([]);
        setError('No notes found');
      }
      
      setIsLoading(false);
    } catch (loadError) {
      console.error('WordStream: Error loading notes:', loadError);
      setError('Error loading notes');
      setIsLoading(false);
    }
  };

  // Format video time (seconds) to HH:MM:SS format
  const formatVideoTime = (seconds: number): string => {
    try {
      if (isNaN(seconds)) return 'N/A';
      
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      
      if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      } else {
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
    } catch (error) {
      console.error('Error formatting video time:', error);
      return 'N/A';
    }
  };

  // View notes for a specific video
  const viewVideoNotes = (video: VideoWithNotes) => {
    setSelectedVideo(video);
  };

  // Go back to video list
  const backToList = () => {
    setSelectedVideo(null);
  };

  // Delete individual note
  const deleteNote = async (noteId: string, event: React.MouseEvent) => {
    try {
      event.stopPropagation();
      
      if (!window.confirm('Are you sure you want to delete this note?')) {
        return;
      }
      
      // מחיקה מקומית
      if (selectedVideo) {
        const filteredNotes = selectedVideo.notes.filter(note => note.id !== noteId);
        setSelectedVideo({
          ...selectedVideo,
          notes: filteredNotes
        });
      }
      
      // במקום גישה ישירה לfirestoreService, השתמש ב-BackgroundMessaging
      const success = await BackgroundMessaging.deleteNote(noteId);
      
      if (!success) {
        console.error('WordStream: Failed to delete note from Firestore');
        setError('Error deleting note');
        // במקרה של שגיאה, רענן את הרשימה
        if (selectedVideo) {
          viewVideoNotes(selectedVideo);
        }
      }
    } catch (error) {
      console.error('WordStream: Error deleting note:', error);
      setError('Error deleting note');
    }
  };

  // Delete a video's notes
  const deleteVideoNotes = (videoId: string, event: React.MouseEvent) => {
    try {
      event.stopPropagation();
      
      if (!window.confirm(`Are you sure you want to delete all notes for this video?`)) {
        return;
      }
      
      // מחיקה מהרשימה המקומית
      const updatedVideos = videosWithNotes.filter(video => video.videoId !== videoId);
      setVideosWithNotes(updatedVideos);
      
      // שליחת אירוע מחיקה לרקע
      const message = {
        action: 'deleteAllNotesForVideo',
        videoId
      };
      
      // שלח הודעה לbackground script דרך BackgroundMessaging
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          console.error('WordStream: Error deleting video notes:', chrome.runtime.lastError || response?.error);
          setError('Error deleting notes');
          // רענן את הרשימה במקרה של כישלון
          loadAllNotes();
        }
      });
    } catch (error) {
      console.error('WordStream: Error deleting video notes:', error);
      setError('Error deleting notes');
    }
  };

  // Export notes based on format
  const exportNotes = async (video: VideoWithNotes, format: 'docx' | 'txt' | 'html' | 'json' = 'docx') => {
    setIsExporting(true);
    setShowExportMenu(false);
    
    try {
      if (!video || !video.notes) {
        throw new Error("Video data is not valid for export");
      }
      
      const safeNotes = Array.isArray(video.notes) ? video.notes : [];
      
      if (format === 'docx') {
        // Create a new document
        const doc = new Document({
          sections: [
            {
              properties: {},
              children: [
                new Paragraph({
                  text: "Summary & Notes",
                  heading: HeadingLevel.HEADING_1,
                  thematicBreak: true,
                  spacing: {
                    after: 200,
                  },
                }),
                new Paragraph({
                  text: `Video: ${video.videoTitle}`,
                  heading: HeadingLevel.HEADING_2,
                  spacing: {
                    after: 100,
                  },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `URL: `,
                      bold: true,
                    }),
                    new TextRun(video.videoURL),
                  ],
                  spacing: {
                    after: 100,
                  },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Export Date: `,
                      bold: true,
                    }),
                    new TextRun(formatDate(new Date(), 'dd/MM/yyyy HH:mm')),
                  ],
                  spacing: {
                    after: 200,
                  },
                }),
                new Paragraph({
                  text: "Notes",
                  heading: HeadingLevel.HEADING_2,
                  thematicBreak: true,
                  spacing: {
                    after: 200,
                  },
                }),
                // Add each note
                ...safeNotes.flatMap((note) => [
                  new Paragraph({
                    text: `Time: ${note.formattedTime || 'No timestamp'}`,
                    spacing: {
                      before: 160,
                    },
                    border: {
                      top: {
                        color: "#EEEEEE",
                        space: 1,
                        style: BorderStyle.SINGLE,
                        size: 1,
                      },
                    },
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: note.content,
                        size: 24,
                      }),
                    ],
                    spacing: {
                      after: 80,
                    },
                  }),
                  new Paragraph({
                    text: `Created: ${formatDate(new Date(note.timestamp), 'dd/MM/yyyy HH:mm')}`,
                    alignment: AlignmentType.RIGHT,
                    spacing: {
                      after: 160,
                    },
                  }),
                ]),
              ],
            },
          ],
        });

        // Generate the DOCX file
        Packer.toBlob(doc).then((blob) => {
          saveAs(blob, `notes_${video.videoId}.docx`);
        });
      } else if (format === 'txt') {
        // Export as plain text
        let content = '';
        
        // Create header
        content += `Summary & Notes\n`;
        content += `=============\n\n`;
        content += `Title: ${video.videoTitle}\n`;
        content += `URL: ${video.videoURL}\n`;
        content += `Exported on: ${formatDate(new Date(), 'dd/MM/yyyy HH:mm')}\n\n`;
        
        // Add notes
        content += `Notes:\n`;
        content += `------\n\n`;
        
        safeNotes.forEach((note) => {
          content += `Time: ${note.formattedTime || 'N/A'}\n`;
          content += `Note: ${note.content}\n`;
          content += `Created: ${formatDate(new Date(note.timestamp), 'dd/MM/yyyy HH:mm')}\n\n`;
        });
        
        // Create download link
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notes_${video.videoId}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (format === 'html') {
        // Export as HTML
        let content = '<html><head><title>Summary & Notes</title></head><body>';
        content += `<h1>${video.videoTitle}</h1>`;
        content += `<p>URL: ${video.videoURL}</p>`;
        content += `<p>Exported on: ${formatDate(new Date(), 'dd/MM/yyyy HH:mm')}</p>`;
        content += '<h2>Notes</h2>';
        content += '<ul>';
        
        safeNotes.forEach((note) => {
          content += `<li>${note.formattedTime || 'N/A'} - ${note.content}</li>`;
        });
        
        content += '</ul>';
        content += '</body></html>';
        
        const blob = new Blob([content], { type: 'text/html' });
        saveAs(blob, `notes_${video.videoId}.html`);
      } else if (format === 'json') {
        // Export as JSON
        const jsonData = JSON.stringify(video, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        saveAs(blob, `notes_${video.videoId}.json`);
      }
    } catch (err) {
      console.error('Failed to export notes:', err);
      alert('Failed to export notes. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Open the video in a new tab
  const openVideo = (url: string, event: React.MouseEvent) => {
    event.stopPropagation();
    window.open(url, '_blank');
  };

  // Export menu component
  const ExportMenu = () => (
    <div className="relative" ref={exportMenuRef}>
      <Button
        onClick={() => setShowExportMenu(!showExportMenu)}
        disabled={isExporting}
        className="bg-blue-600 hover:bg-blue-700 text-white flex items-center"
        aria-haspopup="true"
        aria-expanded={showExportMenu}
      >
        {isExporting ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
        ) : (
          <Download size={16} className="mr-2" />
        )}
        Export Notes
        <ChevronDown size={16} className={`ml-2 transform transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
      </Button>
      
      {showExportMenu && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-lg shadow-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 z-[100] overflow-hidden animate-fadeIn"
             style={{ minWidth: '180px', maxWidth: '100%', position: 'relative' }}>
          <div className="py-1" role="menu" aria-orientation="vertical">
            {(['docx', 'txt', 'html', 'json'] as ('docx' | 'txt' | 'html' | 'json')[]).map(format => (
              <button
                key={format}
                className="flex items-center w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                onClick={() => exportNotes(selectedVideo!, format)}
              >
                <Download className="mr-2 h-4 w-4 text-blue-500 dark:text-blue-400" />
                <span>Export as <span className="font-medium">{format.toUpperCase()}</span></span>
                {format === 'docx' && (
                  <span className="ml-auto text-xs text-blue-500">Recommended</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Render the component
  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-gray-200 dark:border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 backdrop-blur-sm rounded-t-lg">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-400 dark:to-indigo-500 drop-shadow-sm">
          <span className="text-gray-600 dark:text-white text-opacity-75 mr-1">📝</span>
          <span className="tracking-wide">Notes & Summaries</span>
        </h2>
        
        <div className="flex items-center gap-2">
          {/* Sync button */}
          <button
            onClick={syncWithFirestore}
            disabled={isSyncing}
            className="p-2 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-blue-600 dark:text-blue-400 disabled:opacity-50"
            title="Sync notes with Firestore"
          >
            <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
          </button>
          
          {/* Back button */}
          <button
            onClick={selectedVideo ? backToList : onBack}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors text-gray-600 dark:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-slate-700 scrollbar-track-gray-100 dark:scrollbar-track-slate-800">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 px-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 shadow-lg">
            <div className="text-red-500 dark:text-red-400 text-5xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">Error Loading Notes</h3>
            <p className="text-red-600 dark:text-slate-300">{error}</p>
            
            <button 
              onClick={syncWithFirestore}
              disabled={isSyncing}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center gap-2 mx-auto"
            >
              {isSyncing ? (
                <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
              ) : (
                <RefreshCw size={16} />
              )}
              Try Again
            </button>
          </div>
        ) : selectedVideo ? (
          // Video notes view
          <div className="space-y-4 animate-fadeIn">
            {/* Video Title Card with Back Button */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-md backdrop-blur-sm mb-4 transition-all hover:shadow-lg">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400">{selectedVideo.videoTitle}</h3>
                <button 
                  onClick={backToList}
                  className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors text-gray-600 dark:text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                </button>
              </div>
              
              <div className="flex flex-wrap gap-2 items-center text-xs text-gray-500 dark:text-slate-400">
                <span className="inline-flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  {formatDate(new Date(selectedVideo.lastUpdated), 'dd/MM/yyyy HH:mm')}
                </span>
                <span className="inline-flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  {selectedVideo.notes.length} notes
                </span>
                <div className="flex-grow"></div>
                <div className="relative inline-block">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    disabled={isExporting}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 rounded text-white text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    aria-haspopup="true"
                    aria-expanded={showExportMenu}
                  >
                    {isExporting ? (
                      <>
                        <span className="animate-spin h-3 w-3 border-2 border-white rounded-full border-t-transparent mr-1"></span>
                        Exporting...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Export
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`ml-1 transform transition-transform ${showExportMenu ? 'rotate-180' : ''}`}>
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </>
                    )}
                  </button>
                  
                  {showExportMenu && (
                    <div 
                      ref={exportMenuRef}
                      className="absolute right-0 top-full mt-2 w-56 rounded-lg shadow-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 z-[100] overflow-hidden animate-fadeIn"
                      style={{ minWidth: '180px', maxWidth: '100%', position: 'relative' }}
                    >
                      <div className="py-1" role="menu" aria-orientation="vertical">
                        {(['docx', 'txt', 'html', 'json'] as ('docx' | 'txt' | 'html' | 'json')[]).map(format => (
                          <button
                            key={format}
                            className="flex items-center w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            onClick={() => exportNotes(selectedVideo!, format)}
                          >
                            <Download className="mr-2 h-4 w-4 text-blue-500 dark:text-blue-400" />
                            <span>Export as <span className="font-medium">{format.toUpperCase()}</span></span>
                            {format === 'docx' && (
                              <span className="ml-auto text-xs text-blue-500">Recommended</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={(e) => openVideo(selectedVideo.videoURL, e)}
                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded text-gray-700 dark:text-white text-xs font-medium transition-colors flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  Open Video
                </button>
              </div>
            </div>
            
            {/* Notes List */}
            {selectedVideo.notes.length > 0 ? (
              <div className="space-y-3 pb-4">
                {selectedVideo.notes.map((note) => (
                  <div 
                    key={note.id} 
                    className="note-item bg-white dark:bg-slate-800 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden transition-all hover:shadow-md shadow-sm"
                  >
                    <div className="p-3 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
                      <div className="text-sm text-gray-500 dark:text-slate-400">
                        {formatDate(new Date(note.timestamp), 'dd/MM/yyyy HH:mm')}
                      </div>
                      <div className="flex items-center gap-2">
                        {note.videoTime !== undefined && (
                          <div className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-xs font-medium">
                            {note.formattedTime || '00:00'}
                          </div>
                        )}
                        <button 
                          onClick={(e) => deleteNote(note.id, e)}
                          className="p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                          disabled={isDeletingNote === note.id}
                        >
                          {isDeletingNote === note.id ? (
                            <span className="inline-block h-4 w-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></span>
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-slate-700/50">
                      <div className="text-gray-800 dark:text-white whitespace-pre-wrap">{note.content}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-inner p-8">
                <div className="text-5xl mb-4">📝</div>
                <h3 className="text-xl font-semibold text-gray-700 dark:text-slate-300 mb-1">No Notes Found</h3>
                <p className="text-gray-500 dark:text-slate-400 text-center">
                  There are no notes for this video yet. Notes are automatically saved when you create them while watching videos.
                </p>
              </div>
            )}
          </div>
        ) : videosWithNotes.length > 0 ? (
          // Video list view
          <div className="grid grid-cols-1 gap-4 animate-fadeIn">
            {videosWithNotes.map((video) => (
              <div 
                key={video.videoId} 
                className="rounded-xl bg-white hover:bg-gray-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-gray-200 hover:border-blue-200 dark:border-slate-700 dark:hover:border-blue-700 shadow-sm hover:shadow-md p-5 cursor-pointer transition-all"
                onClick={() => viewVideoNotes(video)}
              >
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-medium text-gray-800 dark:text-slate-100 mb-2 line-clamp-1">{video.videoTitle}</h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={(e) => openVideo(video.videoURL, e)}
                      className="p-1.5 text-blue-600 hover:text-blue-500 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/30 rounded-full transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                    </button>
                    <button
                      onClick={(e) => deleteVideoNotes(video.videoId, e)}
                      className="p-1.5 text-red-600 hover:text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/30 rounded-full transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="text-sm text-gray-500 dark:text-slate-400 mb-2">
                  {formatDate(new Date(video.lastUpdated), 'dd/MM/yyyy HH:mm')}
                </div>
                
                <div className="flex items-center text-gray-500 dark:text-slate-400 text-sm">
                  <span className="font-medium mr-1">{video.notes.length}</span> 
                  {video.notes.length === 1 ? 'note' : 'notes'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Empty state
          <div className="flex flex-col items-center justify-center h-64 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-inner p-8">
            <div className="text-5xl mb-4">📝</div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-slate-300 mb-1">No Notes Found</h3>
            <p className="text-gray-500 dark:text-slate-400 text-center">
              You haven't created any notes yet. Notes are automatically saved when you create them while watching videos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 