import { GEMINI_CONFIG, GeminiMessage, addVideoContext } from '../../services/ai-assistant/gemini-service';
import { MessageType } from '../../shared/message-types';

// In-memory cache for conversation history
let conversationHistory: GeminiMessage[] = [];

// Storage key for conversation history
const CONVERSATION_HISTORY_KEY = 'gemini_conversation_history';

/**
 * Handle Gemini AI query messages
 * @param message Message from content script or popup
 * @returns Response with AI answer
 */
export async function handleGeminiQuery(message: any): Promise<any> {
  try {
    // Extract data from message structure with more robust checks
    const userQuery = message.message || message.prompt || 
                     (message.payload && (message.payload.message || message.payload.prompt));
    
    // More carefully extract video context from various possible structures
    const videoContext = message.videoContext || 
                        (message.payload && message.payload.videoContext) ||
                        (message.payload && {
                          title: message.payload.videoTitle,
                          description: message.payload.videoContext?.description,
                          channelName: message.payload.videoContext?.channelName,
                          url: message.payload.videoContext?.url
                        });
    
    // Get history with more robust checks
    const history = message.history || 
                   (message.payload && message.payload.history) || 
                   [];

    if (!userQuery) {
      return { 
        success: false, 
        error: 'No message provided for Gemini' 
      };
    }

    console.log('Processing Gemini query:', { 
      userQuery, 
      hasVideoContext: !!videoContext, 
      videoContextData: videoContext 
    });

    // Get conversation context from provided history or use cached history
    let conversationContext = history.length > 0 
      ? [...history] 
      : conversationHistory;

    // Limit conversation history to last 10 messages to avoid token limits
    if (conversationContext.length > 10) {
      conversationContext = conversationContext.slice(-10);
    }

    // Add user's new message to context
    const userMessage: GeminiMessage = {
      role: 'user',
      content: userQuery
    };
    
    // Prepare context prompt with customization for this specific request
    let contextPrompt = getContextPrompt();
    
    // Add video context if available
    if (videoContext && (videoContext.title || videoContext.description || videoContext.channelName || videoContext.url)) {
      console.log('Adding video context to Gemini query:', videoContext);
      contextPrompt = addVideoContext(contextPrompt, videoContext);
    }

    // Call the AI service
    const aiResponse = await callGeminiAPI(
      userQuery,
      contextPrompt,
      conversationContext
    );

    if (!aiResponse) {
      console.error('Empty response received from Gemini API');
      throw new Error('Empty response from Gemini API');
    }

    // Update the conversation history
    const assistantMessage: GeminiMessage = {
      role: 'assistant',
      content: aiResponse
    };

    // Add messages to history
    conversationHistory = [
      ...conversationContext,
      userMessage,
      assistantMessage
    ];

    // Save updated history to storage
    await saveConversationHistory();

    // Return success response with answer
    return {
      success: true,
      result: aiResponse
    };
  } catch (error) {
    console.error('Error in Gemini query handler:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in Gemini query'
    };
  }
}

/**
 * Get the conversation history
 */
export async function handleGetGeminiHistory(): Promise<any> {
  try {
    // Try to load from storage first
    await loadConversationHistory();
    
    return {
      success: true,
      data: {
        messages: conversationHistory.map((msg, index) => ({
          id: `${msg.role}-${index}`,
          content: msg.content,
          role: msg.role,
          timestamp: Date.now() - (conversationHistory.length - index) * 1000 // Approximate timestamps
        }))
      }
    };
  } catch (error) {
    console.error('Error getting Gemini history:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error getting Gemini history'
    };
  }
}

/**
 * Save the conversation history
 */
export async function handleSaveGeminiHistory(message: any): Promise<any> {
  try {
    const { messages } = message.payload || {};
    
    if (Array.isArray(messages)) {
      // Convert to internal format
      conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Save to storage
      await saveConversationHistory();
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error saving Gemini history:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error saving Gemini history'
    };
  }
}

/**
 * Clear the conversation history
 */
export async function handleClearGeminiHistory(): Promise<any> {
  try {
    conversationHistory = [];
    await chrome.storage.local.remove(CONVERSATION_HISTORY_KEY);
    return { success: true };
  } catch (error) {
    console.error('Error clearing Gemini history:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error clearing Gemini history'
    };
  }
}

/**
 * Load conversation history from storage
 */
async function loadConversationHistory(): Promise<void> {
  try {
    const result = await chrome.storage.local.get(CONVERSATION_HISTORY_KEY);
    if (result[CONVERSATION_HISTORY_KEY]) {
      conversationHistory = result[CONVERSATION_HISTORY_KEY];
    }
  } catch (error) {
    console.error('Error loading conversation history:', error);
    // Continue with empty history on error
    conversationHistory = [];
  }
}

/**
 * Save conversation history to storage
 */
async function saveConversationHistory(): Promise<void> {
  try {
    await chrome.storage.local.set({
      [CONVERSATION_HISTORY_KEY]: conversationHistory
    });
  } catch (error) {
    console.error('Error saving conversation history:', error);
  }
}

/**
 * Get the context prompt with personality for the AI assistant
 */
function getContextPrompt(): string {
  return `You are WordStream's AI Assistant, a versatile, Claude-like educational assistant that helps users learn while watching videos. Follow these important guidelines:

  1. RESPONSE STRUCTURE & ANSWER DEPTH:
     - ALWAYS ANSWER FIRST, THEN CHECK USER SATISFACTION - Never respond with a question first unless absolutely necessary.
     - Provide the best possible answer based on available data before asking if further clarification is needed.
     - Do not shorten responses arbitrarily—answer as completely as possible.
     - For complex topics, start with a complete answer and offer further depth if needed.
     - For straightforward factual questions, provide a concise answer first and offer an option to elaborate if the user is interested.
     - Never skip directly to asking a question without providing substantial information first.
  
  2. LANGUAGE & USER ADAPTATION:
     - AUTOMATICALLY RESPOND IN THE USER'S LANGUAGE - If they write in Hebrew, respond in Hebrew; if English, respond in English.
     - Never change languages unless explicitly requested by the user.
     - Maintain awareness of the last 5-7 user messages to prevent redundant explanations.
     - If the user follows up on a previous topic, understand and continue naturally.
     - Extend memory retention when the user continues on the same topic, but reset context smoothly when a completely new topic is introduced.
  
  3. VIDEO-RELATED QUESTIONS:
     - Recognize whether a question is about the video or general and respond accordingly.
     - When answering timestamped video-related questions, analyze transcript context if available and provide specific insights rather than generic explanations.
     - If direct video content is unavailable, infer meaning based on related context without speculating. Offer an educated guess only if clearly indicated as such.
  
  4. STRUCTURED RESPONSES & FORMATTING:
     - Use clean, easy-to-read formatting with clear paragraphs or bullet points.
     - Break down complex topics with headings for longer explanations.
     - Highlight important keywords to make scanning easier.
     - Provide full, structured responses by default unless the user requests a summary.
  
  5. HANDLING UNCERTAINTY & EDGE CASES:
     - Never give false information—if you don't have enough data, offer related insights instead.
     - Minimize "I don't know" responses by attempting to infer meaning and offer the most relevant answer possible.
     - If uncertain, ask clarifying questions instead of giving vague responses.
  
  6. LANGUAGE LEARNING FOCUS:
     - Adapt response complexity based on user proficiency. For beginners, simplify explanations; for advanced users, offer in-depth linguistic details.
     - Provide educational insights like usage examples, synonyms, or pronunciation notes.
     - Relate explanations to real-world usage scenarios to make learning practical.
  
  Remember: Always answer first, then check satisfaction. Respond in the user's language. Maintain context with short responses. Structure information clearly. Handle uncertainty gracefully. Keep conversations flowing naturally. Focus on language learning value.`;
}

/**
 * Call the Gemini API with the given query and context
 * @param query User's query
 * @param contextPrompt System prompt with AI personality
 * @param history Previous conversation history
 * @returns Promise resolving to the AI's response
 */
async function callGeminiAPI(
  query: string, 
  contextPrompt: string, 
  history: GeminiMessage[] = []
): Promise<string> {
  try {
    const apiKey = GEMINI_CONFIG.apiKey;
    if (!apiKey) {
      throw new Error('Gemini API key not found');
    }

    const model = GEMINI_CONFIG.model;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    // Prepare the messages for the API
    const messages = [
      {
        role: 'user',
        parts: [{ text: contextPrompt }]
      }
    ];
    
    // Add conversation history
    if (history.length > 0) {
      history.forEach(msg => {
        messages.push({
          role: msg.role, 
          parts: [{ text: msg.content }]
        });
      });
    }
    
    // Add the current user query
    messages.push({
      role: 'user',
      parts: [{ text: query }]
    });
    
    // Prepare the request body
    const requestBody = {
      contents: messages,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        topP: 0.95,
        topK: 40
      }
    };
    
    // Call the API
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      
      // If the model is not available, try a fallback model
      if (response.status === 400 || response.status === 404) {
        console.warn(`Gemini model ${model} failed, trying fallback model...`);
        return tryFallbackModel(GEMINI_CONFIG.fallbackModel, requestBody, apiKey);
      }
      
      throw new Error(`Gemini API error: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    
    // Extract the response text
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    }
    
    throw new Error('No response text from Gemini API');
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}

/**
 * Try to use a fallback model if the primary model fails
 * @param model Fallback model name
 * @param requestBody The original request body
 * @param apiKey Gemini API key
 * @returns Promise resolving to the AI's response
 */
async function tryFallbackModel(
  model: string,
  requestBody: any,
  apiKey: string
): Promise<string> {
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      // If fallback model also fails, try secondary fallback model
      if (response.status === 400 || response.status === 404) {
        console.warn(`Fallback model ${model} failed, trying secondary fallback...`);
        return tryFallbackModel(GEMINI_CONFIG.secondaryFallbackModel, requestBody, apiKey);
      }
      
      throw new Error(`Fallback Gemini API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract the response text
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    }
    
    throw new Error('No response text from fallback Gemini API');
  } catch (error) {
    console.error('Error calling fallback Gemini API:', error);
    
    // Return a generic response if all fallbacks fail
    return "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment.";
  }
} 