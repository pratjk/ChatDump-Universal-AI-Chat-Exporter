import { Conversation, Message, ConversationSchema } from '../../shared/schema';

export function isChatGPT(): boolean {
  return window.location.hostname === 'chatgpt.com';
}

export async function extractChatGPT(): Promise<Conversation> {
  // Step 1: Get all turn elements (they exist but some are empty/virtualized)
  const allTurns = document.querySelectorAll('[data-testid^="conversation-turn-"]');
  
  if (allTurns.length === 0) {
    throw new Error('No conversation turns found. Are you on a chat page?');
  }

  console.log(`[ChatDump] Found ${allTurns.length} turn shells in DOM`);

  const messages: Message[] = [];

  // Step 2: Scroll through each turn one by one, extracting as we go
  for (let i = 0; i < allTurns.length; i++) {
    const turn = allTurns[i];
    
    // Scroll this specific turn into view so React hydrates it
    turn.scrollIntoView({ behavior: 'auto', block: 'center' });
    await delay(500); // Wait for React to mount content
    
    // Try extraction
    const roleEl = turn.querySelector('[data-message-author-role]');
    const role = roleEl?.getAttribute('data-message-author-role') as 'user' | 'assistant' | null;
    
    if (!role || (role !== 'user' && role !== 'assistant')) {
      console.warn(`[ChatDump] Turn ${i}: no role found after scroll, skipping`);
      continue;
    }
    
    // Extract content based on role
    let content = '';
    
    if (role === 'assistant') {
      const md = turn.querySelector('.markdown, .prose');
      content = md?.textContent?.trim() || '';
    } else {
      const userTextEl = turn.querySelector(
        'div[class*="whitespace-pre-wrap"], ' +
        'div.text-message, ' +
        'div[class*="text-message"], ' +
        '[dir="auto"].text-message'
      );
      content = userTextEl?.textContent?.trim() || '';
    }
    
    // Fallback: grab raw text and clean it
    if (!content) {
      content = turn.textContent
        ?.replace(/^(You|ChatGPT|User|Assistant)[:\s]*/i, '')
        .replace(/\n+/g, '\n')
        .trim() || '';
    }
    
    // Timestamp
    const timeEl = turn.querySelector('time');
    const timestamp = timeEl?.getAttribute('datetime') || undefined;

    messages.push({
      id: `msg-${i}`,
      role,
      content,
      timestamp,
    });
    
    console.log(`[ChatDump] Turn ${i}: extracted ${role} message, length=${content.length}`);
  }

  console.log(`[ChatDump] Extracted ${messages.length} of ${allTurns.length} turns`);

  if (messages.length === 0) {
    throw new Error('Could not extract any messages. All turns appeared empty.');
  }

  // Get title
  const title = document.title.replace(' - ChatGPT', '').trim();

  const result = {
    version: '1.0' as const,
    metadata: {
      source: 'chatgpt',
      title: title || undefined,
      url: window.location.href,
      exportedAt: new Date().toISOString(),
    },
    messages,
  };

  const parsed = ConversationSchema.safeParse(result);
  if (!parsed.success) {
    console.error('Schema validation failed:', parsed.error);
    throw new Error('Validation failed. Site structure may have changed.');
  }

  return parsed.data;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
