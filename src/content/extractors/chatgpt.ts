import { Conversation, Message, ConversationSchema } from '../../shared/schema';

export function isChatGPT(): boolean {
  return window.location.hostname === 'chatgpt.com';
}

export async function extractChatGPT(): Promise<Conversation> {
  const scrollContainer = document.querySelector('main > div > div') 
    || document.querySelector('main') 
    || document.documentElement;

  const messages: Message[] = [];
  
  // We don't know how many turns exist. Keep scrolling until no new ones appear.
  let previousCount = 0;
  let stableRounds = 0;
  let maxIndex = 0;
  
  // First pass: discover total turns by scrolling to top
  while (stableRounds < 3) {
    scrollContainer.scrollTo({ top: 0, behavior: 'auto' });
    await delay(1000);
    
    // Count turns by querying fresh each time
    const turns = document.querySelectorAll('[data-testid^="conversation-turn-"]');
    if (turns.length === previousCount) {
      stableRounds++;
    } else {
      stableRounds = 0;
      previousCount = turns.length;
      maxIndex = turns.length;
    }
  }
  
  console.log(`[ChatDump] Discovered ${maxIndex} total turns`);

  // Second pass: extract each turn by scrolling to it fresh
  for (let i = 0; i < maxIndex; i++) {
    // CRITICAL: Re-query the DOM fresh each iteration. Do NOT cache NodeList.
    const turn = document.querySelector(`[data-testid="conversation-turn-${i}"]`);
    
    if (!turn) {
      console.warn(`[ChatDump] Turn ${i}: not found in DOM, skipping`);
      continue;
    }
    
    // Scroll into view to force React hydration
    turn.scrollIntoView({ behavior: 'auto', block: 'center' });
    await delay(600);
    
    // Re-query the turn AFTER scrolling to get the hydrated version
    const freshTurn = document.querySelector(`[data-testid="conversation-turn-${i}"]`);
    if (!freshTurn) continue;
    
    const roleEl = freshTurn.querySelector('[data-message-author-role]');
    const role = roleEl?.getAttribute('data-message-author-role') as 'user' | 'assistant' | null;
    
    if (!role || (role !== 'user' && role !== 'assistant')) {
      console.warn(`[ChatDump] Turn ${i}: no role, skipping`);
      continue;
    }
    
    // Extract content based on role
    let content = '';
    
    if (role === 'assistant') {
      // Assistant uses markdown/prose
      const md = freshTurn.querySelector('.markdown, .prose');
      content = md?.textContent?.trim() || '';
    } else {
      // User message: ChatGPT uses div with class "text-message"
      const selectors = [
        'div.text-message',
        'div[class*="text-message"]',
        'div[class*="whitespace-pre-wrap"]',
        '[dir="auto"]',
        'div[class*="font-normal"]'
      ];
      
      for (const sel of selectors) {
        const el = freshTurn.querySelector(sel);
        if (el && el.textContent && el.textContent.trim().length > 0) {
          content = el.textContent.trim();
          break;
        }
      }
    }
    
    // ULTIMATE FALLBACK: If specific selectors fail, use the turn's textContent
    if (!content) {
      const allText = freshTurn.textContent || '';
      content = allText.trim();
    }
    
    // Clean up: remove "You" or "ChatGPT" prefixes if they leaked in
    content = content.replace(/^(You|ChatGPT)[:\s]*/i, '').trim();

    const timeEl = freshTurn.querySelector('time');
    const timestamp = timeEl?.getAttribute('datetime') || undefined;

    messages.push({
      id: `msg-${i}`,
      role,
      content,
      timestamp,
    });
    
    console.log(`[ChatDump] Turn ${i}: ${role}, content length=${content.length}`);
  }

  console.log(`[ChatDump] Extracted ${messages.length} messages`);

  if (messages.length === 0) {
    throw new Error('Could not extract any messages.');
  }

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
    throw new Error('Validation failed.');
  }

  return parsed.data;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}