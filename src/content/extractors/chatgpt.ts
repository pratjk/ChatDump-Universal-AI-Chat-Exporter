import { Conversation, Message, ConversationSchema } from '../../shared/schema';
import { scrollToLoadAll } from './utils';

export function isChatGPT(): boolean {
  return window.location.hostname === 'chatgpt.com';
}

export async function extractChatGPT(): Promise<Conversation> {
  // Wait for conversation to be present
  const container = await waitForElement('main [class*="conversation"]') 
    || document.querySelector('main');
  
  if (!container) throw new Error('Could not find ChatGPT conversation container');

  // Trigger auto-scroll on main element to lazy load all previous turns
  const main = document.querySelector('main');
  if (main) {
    await scrollToLoadAll(main, '[data-testid^="conversation-turn-"]');
  }

  // Get all message turns - try starts-with and standard selectors
  let turns = container.querySelectorAll('[data-testid^="conversation-turn-"]');
  if (turns.length === 0) {
    turns = container.querySelectorAll('[data-testid*="conversation-turn"]');
  }
  if (turns.length === 0) {
    // Fallback if ChatGPT structures change
    turns = container.querySelectorAll('[class*="conversation-turn"]');
  }
  
  const messages: Message[] = [];
  
  turns.forEach((turn, index) => {
    const roleEl = turn.querySelector('[data-message-author-role]');
    const role = roleEl?.getAttribute('data-message-author-role') as 'user' | 'assistant';
    
    if (!role || (role !== 'user' && role !== 'assistant')) return;
    
    // Content extraction
    const contentEl = turn.querySelector('.markdown, .prose, [class*="message-content"]');
    const content = contentEl?.textContent?.trim() || '';
    
    // Timestamp (if available)
    const timeEl = turn.querySelector('time, [class*="timestamp"]');
    const timestamp = timeEl?.getAttribute('datetime') || undefined;
    
    messages.push({
      id: `msg-${index}`,
      role,
      content,
      timestamp,
    });
  });

  // Get title
  const titleEl = document.querySelector('title');
  const title = titleEl?.textContent?.replace(' - ChatGPT', '').trim();

  const result = {
    version: '1.0' as const,
    metadata: {
      source: 'chatgpt',
      title,
      url: window.location.href,
      exportedAt: new Date().toISOString(),
    },
    messages,
  };

  const parsed = ConversationSchema.safeParse(result);
  if (!parsed.success) {
    console.error('Schema validation failed:', parsed.error);
    throw new Error('Extracted conversation failed validation. Site structure may have changed.');
  }

  return parsed.data;
}

function waitForElement(selector: string, timeout = 5000): Promise<Element | null> {
  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);
    
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}
