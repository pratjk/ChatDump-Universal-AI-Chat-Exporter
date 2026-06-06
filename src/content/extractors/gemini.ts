import { Conversation, Message, ConversationSchema } from '../../shared/schema';

export function isGemini(): boolean {
  return window.location.hostname === 'gemini.google.com';
}

export async function extractGemini(): Promise<Conversation> {
  // Strategy 1: data-testid based
  let messageEls = Array.from(document.querySelectorAll(
    '[data-testid="user-query"], [data-testid="model-response"]'
  ));
  
  // Strategy 2: role-based list items
  if (messageEls.length === 0) {
    messageEls = Array.from(document.querySelectorAll('div[role="listitem"]'))
      .filter(el => el.querySelector('img, svg, .markdown, .prose'));
  }
  
  // Strategy 3: broad fallback
  if (messageEls.length === 0) {
    const container = document.querySelector('main') || document.body;
    messageEls = Array.from(container.querySelectorAll('div > div'))
      .filter(el => {
        const text = el.textContent || '';
        return text.length > 20 && el.children.length > 0;
      });
  }

  if (messageEls.length === 0) {
    throw new Error('No Gemini messages found.');
  }

  const messages: Message[] = [];
  
  messageEls.forEach((el, index) => {
    const testId = el.getAttribute('data-testid');
    const isUser = testId === 'user-query' 
      || !!el.querySelector('img[alt*="user"], [aria-label*="You"]');
    const role = isUser ? 'user' : 'assistant';
    
    const contentEl = el.querySelector('.markdown, .prose, [class*="content"]');
    const content = contentEl?.textContent?.trim() 
      || el.textContent?.trim() 
      || '';
    
    if (!content || content.length < 2) return;
    
    messages.push({
      id: `msg-${index}`,
      role,
      content,
    });
  });

  const title = document.title.replace(' - Gemini', '').trim();

  const result = {
    version: '1.0' as const,
    metadata: {
      source: 'gemini',
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
