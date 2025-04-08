/**
 * Utility functions for Firestore paths
 * These functions ensure consistent path construction across the codebase
 */

/**
 * Create a path to the user document
 * @param userId User ID
 * @returns Path to the user document
 */
export function createUserPath(userId: string): string {
  return `users/${userId}`;
}

/**
 * Create a path to the user data collection
 * @param userId User ID
 * @returns Path to the user data collection
 */
export function createUserDataPath(userId: string): string {
  return `users/${userId}/userData`;
}

/**
 * Create a path to a specific user data document
 * @param userId User ID
 * @param docId Document ID
 * @returns Path to the user data document
 */
export function createUserDataDocPath(userId: string, docId: string): string {
  return `users/${userId}/userData/${docId}`;
}

/**
 * Create a path to the words collection
 * @param userId User ID
 * @returns Path to the words collection
 */
export function createWordsPath(userId: string): string {
  return `users/${userId}/words`;
}

/**
 * Create a path to a specific word document
 * @param userId User ID
 * @param wordId Word ID
 * @returns Path to the word document
 */
export function createWordPath(userId: string, wordId: string): string {
  return `users/${userId}/words/${wordId}`;
}

/**
 * Create a path to the notes collection
 * @param userId User ID
 * @returns Path to the notes collection
 */
export function createNotesPath(userId: string): string {
  return `users/${userId}/notes`;
}

/**
 * Create a path to a specific note document
 * @param userId User ID
 * @param noteId Note ID
 * @returns Path to the note document
 */
export function createNotePath(userId: string, noteId: string): string {
  return `users/${userId}/notes/${noteId}`;
}

/**
 * Create a path to the chats collection
 * @param userId User ID
 * @returns Path to the chats collection
 */
export function createChatsPath(userId: string): string {
  return `users/${userId}/chats`;
}

/**
 * Create a path to a specific chat document
 * @param userId User ID
 * @param chatId Chat ID
 * @returns Path to the chat document
 */
export function createChatPath(userId: string, chatId: string): string {
  return `users/${userId}/chats/${chatId}`;
}

/**
 * Create a path to the videos collection
 * @param userId User ID
 * @returns Path to the videos collection
 */
export function createVideosPath(userId: string): string {
  return `users/${userId}/videos`;
}

/**
 * Create a path to a specific video document
 * @param userId User ID
 * @param videoId Video ID
 * @returns Path to the video document
 */
export function createVideoPath(userId: string, videoId: string): string {
  return `users/${userId}/videos/${videoId}`;
}

/**
 * Create a path to the stats document
 * @param userId User ID
 * @returns Path to the stats document
 */
export function createStatsPath(userId: string): string {
  return `users/${userId}/userData/stats`;
}

/**
 * Create a path to the chat messages collection
 * @param userId User ID
 * @param chatId Chat ID
 * @returns Path to the chat messages collection
 */
export function createChatMessagesPath(userId: string, chatId: string): string {
  return `users/${userId}/chats/${chatId}/messages`;
}

/**
 * Create a path to a specific chat message document
 * @param userId User ID
 * @param chatId Chat ID
 * @param messageId Message ID
 * @returns Path to the chat message document
 */
export function createChatMessagePath(userId: string, chatId: string, messageId: string): string {
  return `users/${userId}/chats/${chatId}/messages/${messageId}`;
}

/**
 * Create a path to the settings document
 * @param userId User ID
 * @returns Path to the settings document
 */
export function createSettingsPath(userId: string): string {
  return `users/${userId}/settings`;
} 