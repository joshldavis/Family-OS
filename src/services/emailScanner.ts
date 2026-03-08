
/**
 * Email Scanner Service — Stub
 *
 * Currently supports manual paste-text input.
 * Future: swap in Gmail MCP via Anthropic API mcp_servers parameter.
 *
 * When Gmail MCP is ready, replace `scanFromPastedText` with a call like:
 *
 * const response = await fetch("https://api.anthropic.com/v1/messages", {
 *   method: "POST",
 *   headers: { ... },
 *   body: JSON.stringify({
 *     model: "claude-sonnet-4-20250514",
 *     mcp_servers: [{ type: "url", url: "https://gmail.mcp.claude.com/mcp", name: "gmail" }],
 *     messages: [...],
 *   }),
 * });
 */

export interface RawEmailInput {
  id: string;
  subject: string;
  from: string;
  date: string;
  body: string;
}

/**
 * Wraps manually-pasted email text into the RawEmailInput shape.
 * This is the current "scan" method — paste text, we classify it.
 */
export function scanFromPastedText(
  text: string,
  subject: string = 'Pasted Email',
  from: string = 'unknown@school.edu'
): RawEmailInput[] {
  return [
    {
      id: `paste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      subject,
      from,
      date: new Date().toISOString().split('T')[0],
      body: text.trim(),
    },
  ];
}

/**
 * Future Gmail MCP scanner — placeholder.
 * Will be implemented when Gmail OAuth / MCP auth is resolved.
 */
export async function scanViaGmailMcp(
  _config: {
    schoolDomains: string[];
    includeClassDojo: boolean;
    includeGoogleClassroom: boolean;
    sinceDaysAgo: number;
    apiKey: string;
  }
): Promise<RawEmailInput[]> {
  throw new Error(
    'Gmail MCP scanning is not yet available in this build. Use paste-text scanning instead.'
  );
}
