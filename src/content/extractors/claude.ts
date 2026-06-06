import { Conversation, Message } from '../../shared/schema';

export function isClaude(): boolean {
  return window.location.hostname === 'claude.ai';
}

export async function extractClaude(): Promise<Conversation> {
  // Claude uses Shadow DOM or standard elements
  const container = document.querySelector('div[data-testid="chat-messages"]')
    || document.querySelector('.flex-col.gap-4')
    || document.querySelector('main');
    
  if (!container) throw new Error('Could not find Claude conversation');

  // Claude messages are in article elements or specific data-testid containers
  const messageEls = container.querySelectorAll('[data-testid="user-message"], [data-testid="assistant-message"], [class*="UserMessage"], [class*="AssistantMessage"]');
  
  const messages: Message[] = [];
  
  messageEls.forEach((el, index) => {
    const isUser = el.getAttribute('data-testid') === 'user-message' || el.className.includes('UserMessage');
    const role = isUser ? 'user' : 'assistant';
    
    // Content might be in shadow DOM or nested divs
    let content = '';
    
    // Try to find prose/markdown content
    const proseEl = el.querySelector('.prose, [class*="font-claude"], [class*="message-content"]');
    if (proseEl) {
      content = proseEl.textContent?.trim() || '';
    } else {
      content = el.textContent?.trim() || '';
    }
    
    messages.push({
      id: `msg-${index}`,
      role,
      content,
    });
  });

  // Get title from sidebar or page
  const titleEl = document.querySelector('h1, [class*="chat-title"], title');
  let title = titleEl?.textContent?.trim();
  if (title && title.endsWith(' - Claude')) {
    title = title.replace(' - Claude', '');
  }

  return {
    version: '1.0',
    metadata: {
      source: 'claude',
      title,
      url: window.location.href,
      exportedAt: new Date().toISOString(),
    },
    messages,
  };
}
