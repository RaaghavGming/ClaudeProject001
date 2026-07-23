import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import cors from 'cors';
import express from 'express';

const app = express();
const port = process.env.PORT || 3001;
const maxMessageLength = 8000;
const maxConversationMessages = 50;

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'Send at least one message.';
  }

  if (messages.length > maxConversationMessages) {
    return `Conversation is too long. Please start a new chat or keep it under ${maxConversationMessages} messages.`;
  }

  for (const message of messages) {
    if (!message || !['user', 'assistant'].includes(message.role)) {
      return 'Each message must have a role of user or assistant.';
    }

    if (typeof message.content !== 'string' || message.content.trim().length === 0) {
      return 'Messages cannot be empty.';
    }

    if (message.content.length > maxMessageLength) {
      return `Messages must be ${maxMessageLength} characters or fewer.`;
    }
  }

  return null;
}

function writeSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  const validationError = validateMessages(messages);

  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Anthropic API key is not configured.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    // Anthropic streams incremental content blocks; each text_delta is forwarded
    // immediately as an SSE token so the browser can render the reply live.
    const stream = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
      max_tokens: 1024,
      messages,
      stream: true
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        writeSse(res, 'token', { text: event.delta.text });
      }
    }

    writeSse(res, 'done', { ok: true });
  } catch (error) {
    console.error('Claude API request failed:', error);
    writeSse(res, 'error', {
      message: 'Sorry, something went wrong while contacting Claude. Check your API key, rate limits, or network connection.'
    });
  } finally {
    res.end();
  }
});

app.listen(port, () => {
  console.log(`Claude chatbot server listening on http://localhost:${port}`);
});
