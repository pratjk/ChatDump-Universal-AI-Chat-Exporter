import { Conversation, Message, ConversationSchema } from '../../shared/schema';

export function isClaude(): boolean {
  return window.location.hostname === 'claude.ai';
}

export async function extractClaude(): Promise<Conversation> {
  // Try multiple container strategies
  const container = document.querySelector('main') 
    || document.body;
    
  if (!container) throw new Error('Could not find Claude page');

  // Strategy 1: data-testid messages
  let messageEls = Array.from(container.querySelectorAll(
    '[data-testid="user-message"], [data-testid="assistant-message"]'
  ));
  
  // Strategy 2: article elements (Claude often uses articles)
  if (messageEls.length === 0) {
    messageEls = Array.from(container.querySelectorAll('article'));
  }
  
  // Strategy 3: class-based fallback
  if (messageEls.length === 0) {
    messageEls = Array.from(container.querySelectorAll(
      '[class*="message"], [class*="turn"]'
    )).filter(el => el.textContent && el.textContent.length > 5);
  }

  if (messageEls.length === 0) {
    throw new Error('No Claude messages found. Selectors may have changed.');
  }

  const messages: Message[] = [];
  
  messageEls.forEach((el, index) => {
    // Detect role
    const testId = el.getAttribute('data-testid');
    const className = el.className || '';
    const isUser = testId === 'user-message' 
      || className.includes('user') 
      || className.includes('User');
    const role = isUser ? 'user' : 'assistant';
    
    // Extract content
    let content = '';
    const proseEl = el.querySelector('.prose, [class*="font-claude"], p');
    if (proseEl) {
      content = proseEl.textContent?.trim() || '';
    } else {
      // Remove the role label text if present
      content = el.textContent?.replace(/^(You|Claude)[:\s]*/i, '').trim() || '';
    }
    
    if (!content) return;
    
    messages.push({
      id: `msg-${index}`,
      role,
      content,
    });
  });

  const title = document.title.replace(' - Claude', '').trim();

  const result = {
    version: '1.0' as const,
    metadata: {
      source: 'claude',
      title: title || undefined,
      url: window.location.href,
      exportedAt: new Date().toISOString(),
    },
    messages,
  };

  // Validate
  const parsed = ConversationSchema.safeParse(result);
  if (!parsed.success) {
    console.error('Schema validation failed:', parsed.error);
    throw new Error('Extracted conversation failed validation. Site structure may have changed.');
  }

  return parsed.data;
}
