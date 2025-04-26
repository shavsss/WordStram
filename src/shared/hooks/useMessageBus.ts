import { useEffect, useCallback } from 'react';
import messageBus from '../message-bus';
import { MessageType } from '../message-types';

/**
 * Hook for interacting with the message bus
 * @param messageType Message type to register a handler for
 * @param handler Handler function for the message type
 * @returns Object with methods to send messages
 */
export function useMessageBus(
  messageType: MessageType,
  handler: (message: any, sender: chrome.runtime.MessageSender) => any
) {
  useEffect(() => {
    // Register handler for this message type
    const unregister = messageBus.registerHandler(messageType, handler);
    
    // Cleanup when unmounting
    return unregister;
  }, [messageType, handler]);
  
  const sendMessage = useCallback(
    (payload?: any) => messageBus.sendMessage({ type: messageType, payload }),
    [messageType]
  );
  
  const sendToTab = useCallback(
    (tabId: number, payload?: any) => 
      messageBus.sendMessageToTab(tabId, { type: messageType, payload }),
    [messageType]
  );
  
  const broadcast = useCallback(
    (payload?: any) => 
      messageBus.broadcastToTabs({ type: messageType, payload }),
    [messageType]
  );
  
  return { sendMessage, sendToTab, broadcast };
} 