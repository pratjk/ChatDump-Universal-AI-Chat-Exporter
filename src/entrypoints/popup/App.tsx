import { useState } from 'react';
import { browser } from 'wxt/browser';
import { Conversation } from '../../shared/schema';

function App() {
  const [format, setFormat] = useState<'json' | 'markdown' | 'html'>('json');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleExport = async () => {
    setStatus('loading');
    setErrorMsg('');
    
    try {
      // Validate we're on a supported page
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      const url = tab?.url || '';
      const supportedHosts = [
        'chatgpt.com', 'claude.ai', 'gemini.google.com',
        'chat.deepseek.com', 'perplexity.ai', 'copilot.microsoft.com',
        'grok.x.ai', 'kimi.moonshot.cn'
      ];
      
      const isSupported = supportedHosts.some(host => url.includes(host));
      if (!isSupported) {
        throw new Error('Please navigate to a supported AI chat page (ChatGPT, Claude, Gemini, etc.)');
      }

      const response = await browser.runtime.sendMessage({
        type: 'EXPORT_CHAT',
        payload: { format },
      });
      
      if (response && response.success) {
        setStatus('success');
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        throw new Error(response?.error || 'Failed to trigger export');
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg((err as Error).message);
    }
  };

  const handleImport = async () => {
    setImportStatus('loading');
    setErrorMsg('');
    
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.md,.txt';
      
      input.onchange = async (e) => {
        try {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) {
            setImportStatus('idle');
            return;
          }
          
          const text = await file.text();
          let conversation: Conversation;
          
          if (file.name.endsWith('.json')) {
            conversation = JSON.parse(text);
          } else {
            conversation = parseMarkdownToConversation(text);
          }
          
          // Send to content script to paste
          const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
          if (!tab?.id) {
            throw new Error('No active tab found. Switch to an active chat tab.');
          }
          
          const response = await browser.tabs.sendMessage(tab.id, {
            type: 'PASTE_CONVERSATION',
            payload: { conversation },
          });
          
          if (!response) {
            throw new Error('No response from content script. Make sure you are on a supported AI chat page.');
          }
          if (response.success) {
            setImportStatus('success');
            setTimeout(() => setImportStatus('idle'), 3000);
          } else {
            throw new Error(response.error || 'Failed to import conversation');
          }
        } catch (innerErr) {
          setImportStatus('error');
          setErrorMsg((innerErr as Error).message);
        }
      };
      
      input.click();
    } catch (err) {
      setImportStatus('error');
      setErrorMsg((err as Error).message);
    }
  };

  function parseMarkdownToConversation(md: string): Conversation {
    const lines = md.split('\n');
    const messages: import('../../shared/schema').Message[] = [];
    let currentRole: 'user' | 'assistant' | null = null;
    let currentContent: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Match various user formats
      if (
        trimmed.startsWith('**User**') || 
        trimmed.startsWith('User:') || 
        trimmed.startsWith('**User:**') ||
        trimmed.startsWith('### User')
      ) {
        if (currentRole) {
          messages.push({ 
            role: currentRole, 
            content: currentContent.join('\n').trim(), 
            id: `msg-${messages.length}` 
          });
        }
        currentRole = 'user';
        currentContent = [];
      } 
      // Match various assistant/model formats
      else if (
        trimmed.startsWith('**Assistant**') || 
        trimmed.startsWith('Assistant:') || 
        trimmed.startsWith('**Assistant:**') ||
        trimmed.startsWith('**Model**') ||
        trimmed.startsWith('**Model:**') ||
        trimmed.startsWith('### Assistant') ||
        trimmed.startsWith('### AI')
      ) {
        if (currentRole) {
          messages.push({ 
            role: currentRole, 
            content: currentContent.join('\n').trim(), 
            id: `msg-${messages.length}` 
          });
        }
        currentRole = 'assistant';
        currentContent = [];
      } 
      // Add content lines if we are tracking a message turn
      else if (currentRole && trimmed !== '---' && !trimmed.startsWith('#')) {
        currentContent.push(line);
      }
    }
    
    if (currentRole) {
      messages.push({ 
        role: currentRole, 
        content: currentContent.join('\n').trim(), 
        id: `msg-${messages.length}` 
      });
    }
    
    if (messages.length === 0) {
      // Fallback: If no markers found, import entire text as a user message
      messages.push({
        role: 'user',
        content: md.trim(),
        id: 'msg-0'
      });
    }
    
    return {
      version: '1.0',
      metadata: { 
        source: 'import', 
        exportedAt: new Date().toISOString() 
      },
      messages,
    };
  }

  return (
    <div className="app-container">
      <div className="header">
        <div className="logo-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>
        <div className="logo-text">ChatDump</div>
      </div>

      <div className="form-group">
        <div className="section-label">Export Options</div>
        <div style={{ marginBottom: 12 }} className="select-container">
          <select 
            value={format} 
            onChange={(e) => setFormat(e.target.value as any)}
            className="custom-select"
          >
            <option value="json">JSON (Structured Data)</option>
            <option value="markdown">Markdown (.md format)</option>
            <option value="html">HTML (Print-ready / PDF)</option>
          </select>
          <div className="select-arrow">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={status === 'loading'}
          className="btn-primary"
        >
          {status === 'loading' ? (
            <>
              <div className="spinner" />
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Export Conversation</span>
            </>
          )}
        </button>

        {status === 'success' && (
          <div className="status-msg success">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Export started! Check your downloads folder.</span>
          </div>
        )}

        {status === 'error' && (
          <div className="status-msg error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      <div className="divider" />

      <div className="form-group">
        <div className="section-label">Import Options</div>
        <button
          onClick={handleImport}
          disabled={importStatus === 'loading'}
          className="btn-secondary"
        >
          {importStatus === 'loading' ? (
            <>
              <div className="spinner" style={{ borderTopColor: 'var(--primary)' }} />
              <span>Reading File...</span>
            </>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Import to Chat Input</span>
            </>
          )}
        </button>

        {importStatus === 'success' && (
          <div className="status-msg success">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Imported successfully into chat input field!</span>
          </div>
        )}

        {importStatus === 'error' && (
          <div className="status-msg error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      <p className="footer-text">
        Works seamlessly on <strong>ChatGPT</strong>, <strong>Claude</strong>, and <strong>Gemini</strong>.
      </p>
    </div>
  );
}

export default App;
