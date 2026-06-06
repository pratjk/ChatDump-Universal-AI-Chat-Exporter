import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'ChatDump',
    description: 'Export and import AI conversations from ChatGPT, Claude, Gemini, and more',
    version: '1.0.0',
    permissions: ['storage', 'downloads', 'activeTab', 'clipboardWrite'],
    host_permissions: [
      '*://chatgpt.com/*',
      '*://claude.ai/*',
      '*://gemini.google.com/*',
      '*://chat.deepseek.com/*',
      '*://www.perplexity.ai/*',
      '*://copilot.microsoft.com/*',
      '*://grok.x.ai/*',
      '*://kimi.moonshot.cn/*',
    ],
  },
});