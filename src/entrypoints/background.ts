import { Conversation } from '../shared/schema';

export default defineBackground(() => {
  console.log('[AI Chat Exporter] Background loaded');

  // Handle export requests from popup
  browser.runtime.onMessage.addListener(async (message, sender) => {
    if (message.type === 'EXPORT_CHAT') {
      const { format } = message.payload;
      
      try {
        // Get active tab
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error('No active tab');
        
        // Send extract message to content script
        const response = await browser.tabs.sendMessage(tab.id, { type: 'EXTRACT_CONVERSATION' });
        
        if (!response) {
          throw new Error('No response from content script. Make sure you are on a supported AI chat page and refresh the page.');
        }
        if (!response.success) {
          throw new Error(response.error || 'Failed to extract conversation');
        }
        
        const conversation: Conversation = response.data;
        
        // Convert to requested format
        const { content, mimeType, extension } = await convertFormat(conversation, format);
        
        // Generate download URL safely in Service Worker using base64 data URI
        const downloadUrl = getDownloadUrl(content, mimeType);
        
        const filename = `chat-${conversation.metadata.source}-${Date.now()}.${extension}`;
        
        await browser.downloads.download({
          url: downloadUrl,
          filename,
          saveAs: true,
        });
        
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
  });
});

async function convertFormat(
  conversation: Conversation,
  format: 'json' | 'markdown' | 'html'
): Promise<{ content: string; mimeType: string; extension: string }> {
  switch (format) {
    case 'json':
      return {
        content: JSON.stringify(conversation, null, 2),
        mimeType: 'application/json',
        extension: 'json',
      };
      
    case 'markdown': {
      const md = conversationToMarkdown(conversation);
      return { content: md, mimeType: 'text/markdown', extension: 'md' };
    }
    
    case 'html': {
      const html = conversationToHTML(conversation);
      return { content: html, mimeType: 'text/html', extension: 'html' };
    }
    
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

function conversationToMarkdown(conv: Conversation): string {
  const lines: string[] = [
    `# ${conv.metadata.title || 'AI Conversation'}`,
    ``,
    `**Source:** ${conv.metadata.source}`,
    `**URL:** ${conv.metadata.url || 'N/A'}`,
    `**Exported:** ${conv.metadata.exportedAt}`,
    `---`,
    ``,
  ];
  
  for (const msg of conv.messages) {
    const roleLabel = msg.role === 'user' ? '**User**' : '**Assistant**';
    lines.push(`${roleLabel}${msg.model ? ` (${msg.model})` : ''}:`);
    lines.push('');
    lines.push(msg.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  
  return lines.join('\n');
}

function conversationToHTML(conv: Conversation): string {
  const messagesHtml = conv.messages.map(msg => `
    <div class="message ${msg.role}">
      <div class="role">${msg.role.toUpperCase()}</div>
      <div class="content">${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>
    </div>
  `).join('');
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(conv.metadata.title || 'Chat Export')}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; background-color: #fafafa; color: #333; }
    .message { margin: 1.5rem 0; padding: 1.2rem; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .user { background: #e3f2fd; border-left: 4px solid #2196f3; }
    .assistant { background: #f3e5f5; border-left: 4px solid #9c27b0; }
    .role { font-weight: bold; margin-bottom: 0.5rem; text-transform: uppercase; font-size: 0.85rem; opacity: 0.7; }
    .content { white-space: pre-wrap; font-size: 1rem; }
    @media print { body { padding: 0; background: none; color: #000; } .message { break-inside: avoid; box-shadow: none; border: 1px solid #ddd; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(conv.metadata.title || 'Chat Export')}</h1>
  <p><small>Exported from ${conv.metadata.source} on ${new Date(conv.metadata.exportedAt).toLocaleString()}</small></p>
  <hr>
  ${messagesHtml}
  <script>window.print();</script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getDownloadUrl(content: string, mimeType: string): string {
  const bytes = new TextEncoder().encode(content);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `data:${mimeType};base64,${base64}`;
}
