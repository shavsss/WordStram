import React, { useState, useEffect, useRef } from 'react';
import { ChatsStorage, ChatConversation, ExportFormat, VideoChatsMap } from '@/types/chats';
import { GeminiMessage } from '@/services/gemini/gemini-service';
import { FileText, Download, ExternalLink, Clock, Calendar, Trash2, ChevronLeft, Check, ChevronDown, MessageSquare, ChevronRight, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format as formatDate } from 'date-fns';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';

interface SavedChatsProps {
  onBack: () => void;
}

// מבנה נתונים שמקבץ שיחות לפי videoId
interface GroupedChats {
  [videoId: string]: {
    videoTitle: string;
    videoURL: string;
    lastUpdated: string;
    totalMessages: number;
    conversations: ChatConversation[];
  }
}

export function SavedChats({ onBack }: SavedChatsProps) {
  const [savedChats, setSavedChats] = useState<ChatConversation[]>([]);
  const [groupedChats, setGroupedChats] = useState<GroupedChats>({});
  const [expandedGroups, setExpandedGroups] = useState<{[videoId: string]: boolean}>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChat, setSelectedChat] = useState<ChatConversation | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  
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

  // Load saved chats when component mounts
  useEffect(() => {
    loadAllChats();
  }, []);
  
  // קיבוץ הצ'אטים לפי videoId
  useEffect(() => {
    if (savedChats.length > 0) {
      const grouped: GroupedChats = {};
      
      // קיבוץ הצ'אטים לפי videoId
      savedChats.forEach(chat => {
        if (!grouped[chat.videoId]) {
          grouped[chat.videoId] = {
            videoTitle: chat.videoTitle,
            videoURL: chat.videoURL,
            lastUpdated: chat.lastUpdated,
            totalMessages: chat.messages.length,
            conversations: [chat]
          };
        } else {
          // עדכון מידע מצטבר על הוידאו
          grouped[chat.videoId].conversations.push(chat);
          grouped[chat.videoId].totalMessages += chat.messages.length;
          
          // עדכון תאריך העדכון האחרון אם יש צ'אט חדש יותר
          if (new Date(chat.lastUpdated) > new Date(grouped[chat.videoId].lastUpdated)) {
            grouped[chat.videoId].lastUpdated = chat.lastUpdated;
          }
        }
      });
      
      // מיון השיחות בכל וידאו לפי תאריך (החדש ביותר קודם)
      Object.keys(grouped).forEach(videoId => {
        grouped[videoId].conversations.sort((a, b) => 
          new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
        );
      });
      
      setGroupedChats(grouped);
    } else {
      setGroupedChats({});
    }
  }, [savedChats]);

  // Load all saved chats from storage
  const loadAllChats = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('WordStream: Attempting to load chats from storage');
      
      // Check if Chrome API is available
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        const errorMsg = 'Chrome storage API not available';
        console.error('WordStream ERROR:', errorMsg);
        setError(errorMsg);
        setIsLoading(false);
        return;
      }
      
      chrome.storage.local.get(['chats_storage', 'video_chats_map'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('WordStream: Error loading chats from storage:', chrome.runtime.lastError);
          setError(`Error loading saved chats: ${chrome.runtime.lastError.message}`);
          setIsLoading(false);
          return;
        }

        console.log('WordStream: Chats loaded from storage:', result.chats_storage);
        const chatsStorage: ChatsStorage = result.chats_storage || {};
        
        // Convert object to array and sort by lastUpdated (most recent first)
        const chatsList = Object.values(chatsStorage)
          .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
        
        console.log('WordStream: Processed chats list:', chatsList.length, 'chats');
        setSavedChats(chatsList);
        setIsLoading(false);
      });
    } catch (err) {
      console.error('WordStream: Exception while loading chats:', err);
      setError(`Failed to load saved chats: ${err}`);
      setIsLoading(false);
    }
  };

  // פונקציה להרחבה או צמצום קבוצה
  const toggleGroupExpansion = (videoId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedGroups(prev => ({
      ...prev,
      [videoId]: !prev[videoId]
    }));
  };

  // View a specific chat
  const viewChat = (chat: ChatConversation) => {
    setSelectedChat(chat);
  };

  // Go back to chat list
  const backToList = () => {
    setSelectedChat(null);
  };

  // Delete a saved chat
  const deleteChat = (conversationId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (window.confirm('Are you sure you want to delete this saved chat?')) {
      console.log('WordStream: Deleting chat for conversationId:', conversationId);
      
      // Check if Chrome API is available
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        const errorMsg = 'Chrome storage API not available';
        console.error('WordStream ERROR:', errorMsg);
        alert(errorMsg);
        return;
      }
      
      try {
        chrome.storage.local.get(['chats_storage', 'video_chats_map'], (result) => {
          if (chrome.runtime.lastError) {
            console.error('WordStream ERROR: Failed to get storage for deletion:', chrome.runtime.lastError);
            alert(`Error retrieving storage: ${chrome.runtime.lastError.message}`);
            return;
          }
          
          const chatsStorage: ChatsStorage = result.chats_storage || {};
          const videoChatsMap: VideoChatsMap = result.video_chats_map || {};
          console.log('WordStream: Current chats storage:', chatsStorage);
          
          // זיהוי ה-videoId של השיחה שנמחקת
          const videoId = chatsStorage[conversationId]?.videoId;
          
          // מחיקת השיחה ממאגר השיחות
          delete chatsStorage[conversationId];
          
          // עדכון מיפוי סרטון-לשיחות: הסרת ה-conversationId מהרשימה
          if (videoId && videoChatsMap[videoId]) {
            videoChatsMap[videoId] = videoChatsMap[videoId].filter(id => id !== conversationId);
            
            // אם אין יותר שיחות לסרטון זה, מסיר את הערך לגמרי
            if (videoChatsMap[videoId].length === 0) {
              delete videoChatsMap[videoId];
            }
          }
          
          // Save updated storage
          console.log('WordStream: Saving updated chats storage after deletion');
          chrome.storage.local.set({ 
            chats_storage: chatsStorage,
            video_chats_map: videoChatsMap 
          }, () => {
            if (chrome.runtime.lastError) {
              console.error('WordStream ERROR: Error saving chats after deletion:', chrome.runtime.lastError);
              alert(`Error saving: ${chrome.runtime.lastError.message}`);
              return;
            }
            
            console.log('WordStream: Chats saved successfully after deletion');
            // Refresh the list
            loadAllChats();
            
            // If the deleted chat was selected, go back to list
            if (selectedChat?.conversationId === conversationId) {
              setSelectedChat(null);
            }
          });
        });
      } catch (error) {
        console.error('WordStream ERROR: Exception in deletion process:', error);
        alert(`Error during deletion: ${error}`);
      }
    }
  };

  // מחיקת כל השיחות של וידאו מסוים
  const deleteVideoChats = (videoId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!groupedChats[videoId] || !window.confirm(`Are you sure you want to delete all ${groupedChats[videoId].conversations.length} chats for this video?`)) {
      return;
    }
    
    // Check if Chrome API is available
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      const errorMsg = 'Chrome storage API not available';
      console.error('WordStream ERROR:', errorMsg);
      alert(errorMsg);
      return;
    }
    
    try {
      chrome.storage.local.get(['chats_storage', 'video_chats_map'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('WordStream ERROR: Failed to get storage for deletion:', chrome.runtime.lastError);
          alert(`Error retrieving storage: ${chrome.runtime.lastError.message}`);
          return;
        }
        
        const chatsStorage: ChatsStorage = result.chats_storage || {};
        const videoChatsMap: VideoChatsMap = result.video_chats_map || {};
        
        // מחיקת כל השיחות הקשורות לוידאו זה
        const conversationsToDelete = groupedChats[videoId].conversations.map(c => c.conversationId);
        conversationsToDelete.forEach(conversationId => {
          delete chatsStorage[conversationId];
        });
        
        // מחיקת הוידאו ממיפוי סרטון-לשיחות
        delete videoChatsMap[videoId];
        
        // שמירת המידע המעודכן
        chrome.storage.local.set({ 
          chats_storage: chatsStorage,
          video_chats_map: videoChatsMap 
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('WordStream ERROR: Error saving chats after deletion:', chrome.runtime.lastError);
            alert(`Error saving: ${chrome.runtime.lastError.message}`);
            return;
          }
          
          console.log('WordStream: All video chats deleted successfully');
          loadAllChats();
          
          // If one of the deleted chats was selected, go back to list
          if (selectedChat && conversationsToDelete.includes(selectedChat.conversationId)) {
            setSelectedChat(null);
          }
        });
      });
    } catch (error) {
      console.error('WordStream ERROR: Exception in deletion process:', error);
      alert(`Error during deletion: ${error}`);
    }
  };

  // Export chat based on format
  const exportChat = async (chat: ChatConversation, format: ExportFormat = 'docx') => {
    setIsExporting(true);
    setShowExportMenu(false);
    
    try {
      if (format === 'docx') {
        // Create a new document
        const doc = new Document({
          sections: [
            {
              properties: {},
              children: [
                new Paragraph({
                  text: "Saved Chat Conversation",
                  heading: HeadingLevel.HEADING_1,
                  spacing: {
                    after: 200,
                  },
                }),
                new Paragraph({
                  text: `Video: ${chat.videoTitle}`,
                  heading: HeadingLevel.HEADING_2,
                  spacing: {
                    after: 100,
                  },
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: "Watch video: ", bold: true }),
                    new TextRun({ text: chat.videoURL, color: "0000FF", underline: { type: "single" } }),
                  ],
                  spacing: {
                    after: 200,
                  },
                }),
                new Paragraph({
                  text: "Conversation",
                  heading: HeadingLevel.HEADING_2,
                  spacing: {
                    before: 200,
                    after: 200,
                  },
                }),
                ...chat.messages.map((message, index) => {
                  // Format each message as a paragraph
                  return new Paragraph({
                    children: [
                      new TextRun({
                        text: `${message.role === 'user' ? '👤 You: ' : '🤖 Assistant: '}`,
                        bold: true,
                      }),
                      new TextRun({
                        text: message.content,
                        break: 1,
                      }),
                    ],
                    spacing: {
                      before: 100,
                      after: 100,
                    },
                    border: {
                      bottom: {
                        color: "#CCCCCC",
                        style: BorderStyle.SINGLE,
                        size: 1,
                      },
                    },
                    indent: {
                      left: message.role === 'user' ? 0 : 200,
                      right: message.role === 'user' ? 200 : 0,
                    },
                  });
                }),
                new Paragraph({
                  text: `Exported on: ${formatDate(new Date(), "PPpp")}`,
                  spacing: {
                    before: 200,
                  },
                  alignment: AlignmentType.RIGHT,
                }),
              ],
            },
          ],
        });

        // Create a blob from the document
        const buffer = await Packer.toBlob(doc);
        
        // Save document
        saveAs(buffer, `Chat-${chat.conversationId.substring(0, 10)}-${formatDate(new Date(), "yyyy-MM-dd")}.docx`);
      } else if (format === 'txt') {
        // Create a simple text version
        let textContent = `SAVED CHAT CONVERSATION\n`;
        textContent += `=========================\n\n`;
        textContent += `Video: ${chat.videoTitle}\n`;
        textContent += `URL: ${chat.videoURL}\n`;
        textContent += `Exported: ${formatDate(new Date(), "PPpp")}\n\n`;
        textContent += `CONVERSATION\n`;
        textContent += `=========================\n\n`;
        
        chat.messages.forEach((message, index) => {
          textContent += `${message.role === 'user' ? 'YOU' : 'ASSISTANT'}: ${message.content}\n\n`;
        });
        
        // Create a blob and download
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, `Chat-${chat.conversationId.substring(0, 10)}-${formatDate(new Date(), "yyyy-MM-dd")}.txt`);
      } else if (format === 'md') {
        // Create a Markdown version
        let mdContent = `# Saved Chat Conversation\n\n`;
        mdContent += `## Video: ${chat.videoTitle}\n\n`;
        mdContent += `Watch video: [${chat.videoURL}](${chat.videoURL})\n\n`;
        mdContent += `## Conversation\n\n`;
        
        chat.messages.forEach((message, index) => {
          mdContent += `### ${message.role === 'user' ? '👤 You' : '🤖 Assistant'}\n\n`;
          mdContent += `${message.content}\n\n`;
          mdContent += `---\n\n`;
        });
        
        mdContent += `*Exported on: ${formatDate(new Date(), "PPpp")}*`;
        
        // Create a blob and download
        const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
        saveAs(blob, `Chat-${chat.conversationId.substring(0, 10)}-${formatDate(new Date(), "yyyy-MM-dd")}.md`);
      } else if (format === 'json') {
        // Create a JSON version - just export the raw data
        const blob = new Blob([JSON.stringify(chat, null, 2)], { type: 'application/json;charset=utf-8' });
        saveAs(blob, `Chat-${chat.conversationId.substring(0, 10)}-${formatDate(new Date(), "yyyy-MM-dd")}.json`);
      }
    } catch (err) {
      console.error('Error exporting chat:', err);
      alert(`Error exporting chat: ${err}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Open the video URL
  const openVideo = (url: string, event: React.MouseEvent) => {
    event.stopPropagation();
    window.open(url, '_blank');
  };

  // Export menu component
  const ExportMenu = () => (
    <div 
      ref={exportMenuRef}
      className="absolute left-0 top-full mt-2 w-56 rounded-lg shadow-xl bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 z-50 border border-gray-200 dark:border-slate-700 overflow-hidden animate-fadeIn"
      style={{ minWidth: '180px', maxWidth: '100%' }}
    >
      <div className="py-1" role="menu" aria-orientation="vertical">
        {(['docx', 'txt', 'md', 'json'] as ExportFormat[]).map(format => (
          <button
            key={format}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center transition-colors"
            onClick={() => selectedChat && exportChat(selectedChat, format)}
            role="menuitem"
          >
            <Download className="mr-2 h-4 w-4 text-indigo-500 dark:text-indigo-400" />
            <span>Export as <span className="font-medium">{format.toUpperCase()}</span></span>
          </button>
        ))}
      </div>
    </div>
  );

  // Helper functions for styling
  const getMessageBackgroundColor = (role: string, isDark: boolean): string => {
    if (role === 'user') {
      return isDark ? 'bg-blue-900/30' : 'bg-blue-50';
    }
    return isDark ? 'bg-gray-800' : 'bg-gray-50';
  };

  const getMessageTextColor = (role: string, isDark: boolean): string => {
    if (role === 'user') {
      return isDark ? 'text-blue-200' : 'text-blue-800';
    }
    return isDark ? 'text-gray-200' : 'text-gray-800';
  };

  // Render the component
  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-gray-200 dark:border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 backdrop-blur-sm rounded-t-lg">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-400 dark:to-purple-500 drop-shadow-sm">
          <span className="text-gray-600 dark:text-white text-opacity-75 mr-1">💬</span>
          <span className="tracking-wide">Saved Chats</span>
        </h2>
        <button
          onClick={selectedChat ? backToList : onBack}
          className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors text-gray-600 dark:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-500 rounded-full border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="text-center py-8 px-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 shadow-lg">
            <div className="text-red-500 dark:text-red-400 text-5xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">Error Loading Chats</h3>
            <p className="text-red-600 dark:text-slate-300">{error}</p>
          </div>
        ) : selectedChat ? (
          // View a specific chat
          <div className="space-y-4 animate-fadeIn">
            {/* Chat Title Card with Back Button */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-md backdrop-blur-sm mb-4 transition-all hover:shadow-lg">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{selectedChat.videoTitle}</h3>
                <button 
                  onClick={backToList}
                  className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors text-gray-600 dark:text-white"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                </button>
              </div>
              
              <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 space-x-4 mb-3">
                <span className="inline-flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  {new Date(selectedChat.lastUpdated).toLocaleDateString()} {new Date(selectedChat.lastUpdated).toLocaleTimeString()}
                </span>
                <span className="inline-flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                  {selectedChat.messages.length} messages
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-800/50 rounded text-indigo-700 dark:text-indigo-300 text-xs font-medium transition-colors flex items-center"
                    aria-haspopup="true"
                    aria-expanded={showExportMenu}
                  >
                    <Download className="mr-1 h-3 w-3" />
                    Export
                    <ChevronDown className={`ml-1 h-3 w-3 transform transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showExportMenu && <ExportMenu />}
                </div>
                
                <button
                  onClick={(e) => openVideo(selectedChat.videoURL, e)}
                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded text-gray-700 dark:text-white text-xs font-medium transition-colors flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  Open Video
                </button>
              </div>
            </div>
            
            {/* Chat Messages */}
            {selectedChat.messages.length > 0 ? (
              <div className="space-y-3 pb-4">
                {selectedChat.messages.map((message, index) => (
                  <div 
                    key={index} 
                    className={`message-item p-4 rounded-xl border ${
                      message.role === 'user' 
                        ? 'border-blue-200 dark:border-blue-900/40 ml-8' 
                        : 'border-gray-200 dark:border-slate-700 mr-8'
                    } ${getMessageBackgroundColor(message.role, document.documentElement.classList.contains('dark'))} shadow-sm transition-all`}
                  >
                    <div className="font-semibold mb-2 flex items-center">
                      {message.role === 'user' ? (
                        <>
                          <div className="bg-blue-500 text-white p-1 rounded-full mr-2">
                            <div className="h-4 w-4 flex items-center justify-center">👤</div>
                          </div>
                          <span>You</span>
                        </>
                      ) : (
                        <>
                          <div className="bg-indigo-500 text-white p-1 rounded-full mr-2">
                            <div className="h-4 w-4 flex items-center justify-center">🤖</div>
                          </div>
                          <span>Assistant</span>
                        </>
                      )}
                    </div>
                    <div className={`${getMessageTextColor(message.role, document.documentElement.classList.contains('dark'))} whitespace-pre-wrap`}>
                      {message.content}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-inner p-8">
                <div className="text-5xl mb-4">💬</div>
                <h3 className="text-xl font-semibold text-gray-700 dark:text-slate-300 mb-1">No Messages Found</h3>
                <p className="text-gray-500 dark:text-slate-400 text-center">
                  This chat doesn't contain any messages. This might be due to data corruption or an error during saving.
                </p>
              </div>
            )}
          </div>
        ) : Object.keys(groupedChats).length > 0 ? (
          // רשימת קבוצות של צ'אטים לפי וידאו
          <div className="grid grid-cols-1 gap-4 animate-fadeIn">
            {Object.entries(groupedChats)
              .sort(([, a], [, b]) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
              .map(([videoId, group]) => (
                <div key={videoId} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                  {/* כותרת הקבוצה - לחיצה תרחיב/תצמצם */}
                  <div 
                    className="p-4 flex justify-between items-start cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/80 transition-colors"
                    onClick={(e) => toggleGroupExpansion(videoId, e)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Video className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                        <h3 className="text-lg font-medium text-gray-800 dark:text-slate-100 line-clamp-1">
                          {group.videoTitle}
                        </h3>
                        <span className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 text-xs px-2 py-0.5 rounded-full">
                          {group.conversations.length} chat{group.conversations.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      
                      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 space-x-4 mt-1">
                        <span className="inline-flex items-center">
                          <Calendar className="mr-1 h-3 w-3" />
                          {new Date(group.lastUpdated).toLocaleDateString()}
                        </span>
                        <span className="inline-flex items-center">
                          <MessageSquare className="mr-1 h-3 w-3" />
                          {group.totalMessages} message{group.totalMessages !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <button
                        onClick={(e) => openVideo(group.videoURL, e)}
                        className="p-1.5 text-indigo-600 hover:text-indigo-500 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:text-indigo-300 dark:hover:bg-indigo-900/30 rounded-full transition-colors mr-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                      </button>
                      <button
                        onClick={(e) => deleteVideoChats(videoId, e)}
                        className="p-1.5 text-red-600 hover:text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/30 rounded-full transition-colors mr-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                      <div 
                        className={`p-1 rounded transition-colors ${expandedGroups[videoId] ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'text-gray-400'}`}
                      >
                        {expandedGroups[videoId] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </div>
                    </div>
                  </div>
                  
                  {/* רשימת השיחות בתוך הקבוצה - מוצגת רק כשהקבוצה מורחבת */}
                  {expandedGroups[videoId] && (
                    <div className="border-t border-gray-100 dark:border-slate-700/50 divide-y divide-gray-100 dark:divide-slate-700/30">
                      {group.conversations.map((chat) => (
                        <div 
                          key={chat.conversationId} 
                          className="p-4 pl-8 hover:bg-gray-50 dark:hover:bg-slate-700/40 cursor-pointer transition-colors flex justify-between items-center"
                          onClick={() => viewChat(chat)}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4 text-indigo-400 dark:text-indigo-300" />
                              <span className="text-sm font-medium text-gray-700 dark:text-slate-200">
                                Conversation - {new Date(chat.lastUpdated).toLocaleTimeString()}
                              </span>
                              <span className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full">
                                {chat.messages.length} message{chat.messages.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            
                            {chat.messages.length > 0 && (
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-1 pl-6">
                                <span className="font-medium">{chat.messages[0].role === 'user' ? 'You: ' : 'AI: '}</span>
                                {chat.messages[0].content}
                              </p>
                            )}
                          </div>
                          
                          <button
                            onClick={(e) => deleteChat(chat.conversationId, e)}
                            className="p-1 text-red-600 hover:text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/30 rounded-full transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        ) : (
          // Empty state
          <div className="flex flex-col items-center justify-center h-64 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-inner p-8">
            <div className="text-5xl mb-4">💬</div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-slate-300 mb-1">No Saved Chats</h3>
            <p className="text-gray-500 dark:text-slate-400 text-center">
              You haven't saved any chats yet. Chats are automatically saved when you talk with the AI Assistant while watching videos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 