/**
 * Chats Service
 * 
 * Provides functions for managing chat conversations in Firestore and local storage.
 * Includes functionality for saving, retrieving, and deleting chats, with proper
 * error handling and offline support.
 */

import { doc, getDoc, setDoc, deleteDoc, collection, query, getDocs, Timestamp } from 'firebase/firestore';
import { firestore as db } from '../../config';
import { getCurrentUser } from '../../auth/auth-service';
import { checkFirestoreConnection } from '../../utils/connection-utils';
import { broadcastMessage } from '../../sync/broadcast';
import { queueOperation } from '../../sync/offline-queue';
import { Chat, ChatMessage } from '../../types/chat';

/**
 * Save a chat to Firestore
 * @param chatData Chat data to save
 * @returns Promise with the chat ID
 */
export async function saveChat(chatData: Partial<Chat>): Promise<string> {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const userId = user.uid;

    // Generate an ID if one doesn't exist
    const chatId = chatData.id || Date.now().toString();
    const timestamp = new Date().toISOString();
    
    const chat: Chat = {
      id: chatId,
      userId: userId,
      title: chatData.title || 'New Chat',
      createdAt: chatData.createdAt || timestamp,
      updatedAt: timestamp,
      lastMessageContent: chatData.lastMessageContent,
      lastMessageRole: chatData.lastMessageRole,
      isArchived: chatData.isArchived || false,
      metadata: chatData.metadata || {}
    };

    // Check if we're connected to Firestore
    const isConnected = await checkFirestoreConnection();
    
    if (isConnected) {
      // Save to Firestore
      const chatRef = doc(db, `users/${userId}/chats/${chatId}`);
      await setDoc(chatRef, chat);
      console.log(`WordStream: Chat saved to Firestore: ${chatId}`);
    } else {
      // Queue the operation for later
      console.log(`WordStream: Offline - Queuing chat save operation`);
      queueOperation('saveChat', chat);
    }

    // Save to local storage
    saveChatToLocalStorage(chat);

    // Broadcast to other windows/tabs
    broadcastMessage({ 
      action: 'CHAT_ADDED', 
      chat,
      timestamp: new Date().toISOString()
    });

    return chatId;
  } catch (error) {
    console.error('WordStream: Error saving chat:', error);
    throw error;
  }
}

/**
 * Get all chats for the current user
 * @returns Promise with array of chats
 */
export async function getChats(): Promise<Chat[]> {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const userId = user.uid;

    // Check if we're connected to Firestore
    const isConnected = await checkFirestoreConnection();
    
    if (isConnected) {
      // Get from Firestore
      const chatsCollection = collection(db, `users/${userId}/chats`);
      const chatsQuery = query(chatsCollection);
      const chatsSnapshot = await getDocs(chatsQuery);
      
      const chats = chatsSnapshot.docs.map(doc => doc.data() as Chat);
      console.log(`WordStream: Retrieved ${chats.length} chats from Firestore`);
      
      // Update local storage with the latest data
      updateLocalChats(chats);
      
      return chats;
    } else {
      // Fall back to local storage
      console.log(`WordStream: Offline - Reading chats from local storage`);
      return getChatsFromLocalStorage();
    }
  } catch (error) {
    console.error('WordStream: Error getting chats:', error);
    // Fall back to local storage on error
    return getChatsFromLocalStorage();
  }
}

/**
 * Delete a chat from Firestore and local storage
 * @param chatId ID of the chat to delete
 * @returns Promise resolving to boolean indicating success
 */
export async function deleteChat(chatId: string): Promise<boolean> {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const userId = user.uid;

    // Check if we're connected to Firestore
    const isConnected = await checkFirestoreConnection();
    
    if (isConnected) {
      // Delete from Firestore
      const chatRef = doc(db, `users/${userId}/chats/${chatId}`);
      await deleteDoc(chatRef);
      console.log(`WordStream: Chat deleted from Firestore: ${chatId}`);
    } else {
      // Queue the delete operation for later
      console.log(`WordStream: Offline - Queuing chat delete operation`);
      queueOperation('deleteChat', { id: chatId, userId });
    }

    // Delete from local storage
    deleteChatFromLocalStorage(chatId);

    // Broadcast to other windows/tabs
    broadcastMessage({ 
      action: 'CHAT_DELETED', 
      chatId,
      timestamp: new Date().toISOString() 
    });

    return true;
  } catch (error) {
    console.error(`WordStream: Error deleting chat ${chatId}:`, error);
    return false;
  }
}

/**
 * Add a message to a chat
 * @param chatId Chat ID
 * @param message Message to add
 * @returns Promise with the message ID
 */
export async function addChatMessage(chatId: string, message: Partial<ChatMessage>): Promise<string> {
  try {
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const userId = user.uid;
    
    // Check if the chat exists
    const chats = await getChats();
    const existingChat = chats.find(chat => chat.id === chatId);
    
    if (!existingChat) {
      throw new Error(`Chat ${chatId} not found`);
    }
    
    // Generate message ID
    const messageId = message.id || Date.now().toString();
    const timestamp = new Date().toISOString();
    
    // Prepare message data
    const messageData: ChatMessage = {
      id: messageId,
      chatId: chatId,
      content: message.content || '',
      role: message.role || 'user',
      createdAt: message.createdAt || timestamp,
      metadata: message.metadata || {}
    };
    
    // Update chat with last message
    const updatedChat: Chat = {
      ...existingChat,
      updatedAt: timestamp,
      lastMessageContent: messageData.content,
      lastMessageRole: messageData.role
    };
    
    // Check if we're connected to Firestore
    const isConnected = await checkFirestoreConnection();
    
    if (isConnected) {
      // Update chat in Firestore
      const chatRef = doc(db, `users/${userId}/chats/${chatId}`);
      await setDoc(chatRef, updatedChat, { merge: true });
      
      // Save message to Firestore
      const messageRef = doc(db, `users/${userId}/chats/${chatId}/messages/${messageId}`);
      await setDoc(messageRef, messageData);
      
      console.log(`WordStream: Message added to chat ${chatId}: ${messageId}`);
    } else {
      // Queue operations for later
      console.log(`WordStream: Offline - Queuing message add operation`);
      queueOperation('updateChat', updatedChat);
      queueOperation('addChatMessage', { chatId, message: messageData });
    }
    
    // Update local storage
    saveChatToLocalStorage(updatedChat);
    
    // Broadcast update
    broadcastMessage({
      action: 'CHAT_UPDATED',
      chat: updatedChat,
      timestamp: new Date().toISOString()
    });
    
    return messageId;
  } catch (error) {
    console.error('WordStream: Error adding chat message:', error);
    throw error;
  }
}

// Local Storage Helpers

/**
 * Save a chat to local storage
 * @param chat Chat to save
 */
function saveChatToLocalStorage(chat: Chat): void {
  try {
    // Get existing chats
    const chats = getChatsFromLocalStorage();
    
    // Find index of existing chat or -1 if not found
    const existingIndex = chats.findIndex(c => c.id === chat.id);
    
    if (existingIndex >= 0) {
      // Update existing chat
      chats[existingIndex] = chat;
    } else {
      // Add new chat
      chats.push(chat);
    }
    
    // Save updated chats list
    chrome.storage.sync.set({ chats }, () => {
      console.log(`WordStream: Chat saved to local storage: ${chat.id}`);
    });
  } catch (error) {
    console.error('WordStream: Error saving chat to local storage:', error);
  }
}

/**
 * Get all chats from local storage
 * @returns Array of chats
 */
function getChatsFromLocalStorage(): Chat[] {
  try {
    // Since chrome.storage is async but we need to return synchronously,
    // we'll return a cached value
    let result: Chat[] = [];
    
    chrome.storage.sync.get('chats', (data) => {
      if (data.chats && Array.isArray(data.chats)) {
        result = data.chats;
      }
    });
    
    return result;
  } catch (error) {
    console.error('WordStream: Error getting chats from local storage:', error);
    return [];
  }
}

/**
 * Update local storage with latest chats
 * @param chats Array of chats to save
 */
function updateLocalChats(chats: Chat[]): void {
  try {
    chrome.storage.sync.set({ chats }, () => {
      console.log(`WordStream: Updated ${chats.length} chats in local storage`);
    });
  } catch (error) {
    console.error('WordStream: Error updating chats in local storage:', error);
  }
}

/**
 * Delete a chat from local storage
 * @param chatId ID of the chat to delete
 */
function deleteChatFromLocalStorage(chatId: string): void {
  try {
    // Get existing chats
    const chats = getChatsFromLocalStorage();
    
    // Filter out the chat to delete
    const updatedChats = chats.filter(chat => chat.id !== chatId);
    
    // Save updated chats list
    chrome.storage.sync.set({ chats: updatedChats }, () => {
      console.log(`WordStream: Chat deleted from local storage: ${chatId}`);
    });
  } catch (error) {
    console.error(`WordStream: Error deleting chat ${chatId} from local storage:`, error);
  }
} 