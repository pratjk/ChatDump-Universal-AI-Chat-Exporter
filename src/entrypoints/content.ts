import { getExtractor } from '../content/extractors/registry';

export default defineContentScript({
  matches: [
    '*://chatgpt.com/*',
    '*://claude.ai/*',
    '*://gemini.google.com/*',
    '*://chat.deepseek.com/*',
    '*://www.perplexity.ai/*',
    '*://copilot.microsoft.com/*',
    '*://grok.x.ai/*',
    '*://kimi.moonshot.cn/*',
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
          
          // Try to find the input field
          const inputSelectors = [
            'textarea[placeholder*="message"]',
            'textarea[placeholder*="ask"]',
            'textarea[placeholder*="Message"]',
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
            const textarea = inputEl as HTMLTextAreaElement;
            
            // React-native setter trick: bypass React's synthetic event system
            const nativeSetter = Object.getOwnPropertyDescriptor(
              window.HTMLTextAreaElement.prototype, 
              'value'
            )?.set;
            
            if (nativeSetter) {
              nativeSetter.call(textarea, markdown);
            } else {
              textarea.value = markdown;
            }
            
            // Dispatch events that React listens to
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Focus the input so user sees it
            textarea.focus();
            
          } else if (inputEl.isContentEditable) {
            inputEl.textContent = markdown;
            inputEl.dispatchEvent(new InputEvent('input', { bubbles: true }));
            inputEl.focus();
          }
          
          return { success: true };
        } catch (err) {
          return { success: false, error: (err as Error).message };
        }
      }
    });
  },
});
