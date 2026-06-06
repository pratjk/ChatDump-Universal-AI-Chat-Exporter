import { z } from 'zod';

export const MessageSchema = z.object({
  id: z.string().optional(), // Changed to optional generic string to support msg-0, msg-1, etc.
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
  timestamp: z.string().optional(),
  model: z.string().optional(),
  citations: z.array(z.string()).optional(),
});

export const ConversationSchema = z.object({
  version: z.literal('1.0'),
  metadata: z.object({
    source: z.string(), // 'chatgpt', 'claude', etc.
    title: z.string().optional(),
    model: z.string().optional(),
    url: z.string().optional(),
    exportedAt: z.string().datetime(),
  }),
  messages: z.array(MessageSchema),
});

export type Message = z.infer<typeof MessageSchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
