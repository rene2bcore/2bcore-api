import Anthropic from '@anthropic-ai/sdk';
import type { Message } from '../../application/dtos/ai.dto.js';
import { AiProviderError } from '../../domain/errors/index.js';

export interface ChatParams {
  model: string;
  messages: Message[];
  system?: string | undefined;
  maxTokens: number;
}

export interface ChatResult {
  id: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  stopReason: string;
}

export interface StreamDelta {
  type: 'delta' | 'done';
  text?: string | undefined;
  usage?: { inputTokens: number; outputTokens: number } | undefined;
}

export interface IAnthropicClient {
  chat(params: ChatParams): Promise<ChatResult>;
  chatStream(params: ChatParams): AsyncIterable<StreamDelta>;
}

export class AnthropicClient implements IAnthropicClient {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    try {
      const response = await this.client.messages.create({
        model: params.model,
        max_tokens: params.maxTokens,
        messages: params.messages,
        ...(params.system ? { system: params.system } : {}),
      });

      const content = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return {
        id: response.id,
        content,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        model: response.model,
        stopReason: response.stop_reason ?? 'end_turn',
      };
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        throw new AiProviderError(`Anthropic API error: ${err.message}`);
      }
      throw err;
    }
  }

  async *chatStream(params: ChatParams): AsyncGenerator<StreamDelta> {
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const stream = this.client.messages.stream({
        model: params.model,
        max_tokens: params.maxTokens,
        messages: params.messages,
        ...(params.system ? { system: params.system } : {}),
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield { type: 'delta', text: event.delta.text };
        } else if (event.type === 'message_start') {
          inputTokens = event.message.usage.input_tokens;
        } else if (event.type === 'message_delta' && event.usage) {
          outputTokens = event.usage.output_tokens;
        }
      }
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        throw new AiProviderError(`Anthropic API error: ${err.message}`);
      }
      throw err;
    }

    yield { type: 'done', usage: { inputTokens, outputTokens } };
  }
}
