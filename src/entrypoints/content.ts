import { getExtractor } from '../content/extractors/registry';

export default defineContentScript({
  matches: [
    '*://chatgpt.com/*',
    '*://claude.ai/*',
    '*://gemini.google.com/*'
  ],
  main() {
    console.log('[AI Chat Exporter] Content script loaded');
    
    // Listen for messages from background/popup
    browser.runtime.onMessage.addListener(async (message) => {
      if (message.type === 'EXTRACT_CONVERSATION') {
        const extractor = getExtractor();
        if (!extractor) {
          return { success: false, error: 'No extractor for this site' };
        }
        
        try {
          const conversation = await extractor.extract();
          return { success: true, data: conversation };
        } catch (err) {
          return { success: false, error: (err as Error).message };
        }
      }
      
      if (message.type === 'PASTE_CONVERSATION') {
        try {
          const { conversation } = message.payload;
          const markdown = conversation.messages
            .map((m: any) => `**${m.role === 'user' ? 'User' : 'Assistant'}**:\n${m.content}`)
            .join('\n\n---\n\n');
          
          // Find input field
          const inputSelectors = [
            'textarea[placeholder*="message"]',
            'textarea[placeholder*="ask"]',
            'div[contenteditable="true"]',
            'textarea',
          ];
          
          let inputEl: HTMLElement | null = null;
          for (const sel of inputSelectors) {
            inputEl = document.querySelector(sel);
            if (inputEl) break;
          }
          
          if (!inputEl) {
            return { success: false, error: 'Could not find chat input field' };
          }
          
          if (inputEl.tagName === 'TEXTAREA') {
            (inputEl as HTMLTextAreaElement).value = markdown;
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (inputEl.isContentEditable) {
            inputEl.textContent = markdown;
            inputEl.dispatchEvent(new InputEvent('input', { bubbles: true }));
          }
          
          return { success: true };
        } catch (err) {
          return { success: false, error: (err as Error).message };
        }
      }
    });
  },
});
