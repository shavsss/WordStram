import { MessageType } from '../../shared/message-types';

export interface GeminiMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GeminiConfig {
  apiKey: string;
  model: string;
  fallbackModel: string;
  secondaryFallbackModel: string;
  maxTokens: number;
}

/**
 * Default configuration for Gemini API
 */
export const GEMINI_CONFIG: GeminiConfig = {
  apiKey: process.env.GEMINI_API_KEY || 'AIzaSyCLBHKWu7l78tS2xVmizicObSb0PpUqsxM',
  model: 'gemini-pro-latest',
  fallbackModel: 'gemini-1.5-pro',
  secondaryFallbackModel: 'gemini-1.5-flash',
  maxTokens: 8192
};

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
 * Send a query to Gemini AI
 * @param query User's query
 * @param history Previous conversation history
 * @param videoContext Context about the current video
 * @returns Promise resolving to the AI's response
 */
export async function sendToGemini(
  query: string,
  history: GeminiMessage[],
  videoContext?: {
    title?: string;
    description?: string;
    channelName?: string;
    url?: string;
  }
): Promise<string> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: MessageType.GEMINI_QUERY,
      payload: {
        message: query,
        history: history,
        videoTitle: videoContext?.title,
        videoContext: {
          description: videoContext?.description,
          channelName: videoContext?.channelName,
          url: videoContext?.url
        }
      }
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to get response from Gemini');
    }
    
    return response.result || response.answer || 'No answer received';
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return "Sorry, I couldn't process your request at this time. Please try again later.";
  }
}

/**
 * Enhance the context prompt with video information
 * @param basePrompt The base AI context prompt
 * @param videoContext Video information object
 * @returns Enhanced context prompt
 */
export function addVideoContext(basePrompt: string, videoContext: any): string {
  if (!videoContext) return basePrompt;
  
  let videoInfo = '';
  
  if (videoContext.title) {
    videoInfo += `\nVIDEO TITLE: "${videoContext.title}"`;
  }
  
  if (videoContext.channelName) {
    videoInfo += `\nCHANNEL: "${videoContext.channelName}"`;
  }
  
  if (videoContext.url) {
    videoInfo += `\nVIDEO URL: ${videoContext.url}`;
  }
  
  if (videoContext.description) {
    // Truncate description if it's too long (>500 chars)
    const desc = videoContext.description.length > 500 
      ? videoContext.description.substring(0, 500) + '...' 
      : videoContext.description;
    
    videoInfo += `\nVIDEO DESCRIPTION: "${desc}"`;
  }
  
  if (videoInfo) {
    return basePrompt + `\n\nIMPORTANT - THE USER IS CURRENTLY WATCHING THIS VIDEO:${videoInfo}\n\nUse this video context to provide more relevant information when appropriate for the query. Only reference the video if the user's question relates to it. If they're asking something unrelated to the video, focus on answering their specific question without mentioning the video.`;
  }
  
  return basePrompt;
} 