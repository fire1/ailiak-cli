import { resolveSettings } from './config.js';

type JsonRpcSuccess = {
  jsonrpc: '2.0';
  id: string | number | null;
  result: unknown;
};

type JsonRpcError = {
  jsonrpc: '2.0';
  id: string | number | null;
  error: { code: number; message: string; data?: unknown };
};

type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

type McpToolResult = {
  content?: { type: string; text?: string }[];
  isError?: boolean;
};

let rpcId = 0;

export class McpClient {
  constructor(
    private readonly apiUrl: string,
    private readonly token: string,
  ) {}

  static async connect(): Promise<McpClient> {
    const { apiUrl, token } = await resolveSettings();
    return new McpClient(apiUrl, token);
  }

  private endpoint(): string {
    return `${this.apiUrl}/mcp`;
  }

  private async request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = ++rpcId;
    const body = {
      jsonrpc: '2.0',
      id,
      method,
      params: params ?? {},
    };

    const res = await fetch(this.endpoint(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'MCP-Protocol-Version': '2024-11-05',
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(
        res.ok
          ? 'Agent API returned non-JSON.'
          : `Agent API error (${res.status}): ${text.slice(0, 200) || res.statusText}`,
      );
    }

    if (!res.ok) {
      const errObj = data as { error?: string | { message?: string } } | null;
      const msg =
        typeof errObj?.error === 'string'
          ? errObj.error
          : errObj?.error && typeof errObj.error === 'object'
            ? errObj.error.message
            : text.slice(0, 200) || res.statusText;
      throw new Error(msg || `Agent API error (${res.status})`);
    }

    const rpc = data as JsonRpcResponse;
    if (rpc && typeof rpc === 'object' && 'error' in rpc && rpc.error) {
      throw new Error(rpc.error.message || `RPC error ${rpc.error.code}`);
    }
    return (rpc as JsonRpcSuccess).result;
  }

  async callTool<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const result = (await this.request('tools/call', {
      name,
      arguments: args,
    })) as McpToolResult;

    const text = result?.content?.find((c) => c.type === 'text')?.text;
    if (result?.isError) {
      throw new Error(text || `Tool ${name} failed`);
    }
    if (text == null) {
      throw new Error(`Empty response from ${name}`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      // Some tools might return plain text
      return text as T;
    }
  }
}
