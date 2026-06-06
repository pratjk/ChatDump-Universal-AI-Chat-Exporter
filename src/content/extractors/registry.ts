import { isChatGPT, extractChatGPT } from './chatgpt';
import { isClaude, extractClaude } from './claude';
import { isGemini, extractGemini } from './gemini';

export interface SiteExtractor {
  name: string;
  match: (url: URL) => boolean;
  extract: () => Promise<import('../../shared/schema').Conversation>;
}

const extractors: SiteExtractor[] = [
  {
    name: 'chatgpt',
    match: (url) => url.hostname === 'chatgpt.com',
    extract: extractChatGPT,
  },
  {
    name: 'claude',
    match: (url) => url.hostname === 'claude.ai',
    extract: extractClaude,
  },
  {
    name: 'gemini',
    match: (url) => url.hostname === 'gemini.google.com',
    extract: extractGemini,
  },
];

export function getExtractor(url: URL = new URL(window.location.href)): SiteExtractor | null {
  return extractors.find((e) => e.match(url)) || null;
}
