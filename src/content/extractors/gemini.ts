import { Conversation, Message } from '../../shared/schema';

export function isGemini(): boolean {
  return window.location.hostname === 'gemini.google.com';
}

export async function extractGemini(): Promise<Conversation> {
  const container = document.querySelector('div[data-testid="conversation"]')
    || document.querySelector('main')
    || document.querySelector('conversation-container');
    
  if (!container) throw new Error('Could not find Gemini conversation');

  // Gemini message selectors
  const turns = container.querySelectorAll('[data-testid="conversation-turn"], [data-testid="user-query"], [data-testid="model-response"], conversation-turn');
  
  const messages: Message[] = [];
  
  turns.forEach((turn, index) => {
    const isUser = turn.getAttribute('data-testid') === 'user-query' 
      || !!turn.querySelector('[data-testid="user-query"]')
      || turn.tagName.toLowerCase() === 'user-query'
      || turn.querySelector('user-query');
      
    const role = isUser ? 'user' : 'assistant';
    
    const contentEl = turn.querySelector('.markdown, .prose, [class*="response-content"], [class*="message-content"]');
    const content = contentEl?.textContent?.trim() || turn.textContent?.trim() || '';
    
    messages.push({
      id: `msg-${index}`,
      role,
      content,
    });
  });

  const titleEl = document.querySelector('title');
  const title = titleEl?.textContent?.replace(' - Gemini', '').trim();

  return {
    version: '1.0',
    metadata: {
      source: 'gemini',
      title,
      url: window.location.href,
      exportedAt: new Date().toISOString(),
    },
    messages,
  };
}
