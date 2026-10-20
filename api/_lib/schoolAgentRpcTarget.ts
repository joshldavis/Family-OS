/**
 * FOS-007 server-only activation guard. The project reference is nonsecret
 * catalog metadata confirmed for the shared made-again workspace. Preview
 * must never execute against that shared project.
 */
export const FAMILY_OS_SHARED_PROJECT_REF = 'mivuyqyayhiolelrfyxu';

export interface SchoolAgentRpcConfiguration {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  vercelEnvironment?: string;
  executionEnabled?: string;
}

export type SchoolAgentRpcTarget =
  | { ok: true; url: string }
  | { ok: false; reason:
    'disabled' | 'unsafe_environment' | 'missing_configuration' | 'wrong_project' };

/** No secret or supplied URL is included in rejection results. */
export function validateSchoolAgentRpcTarget(
  config: SchoolAgentRpcConfiguration,
): SchoolAgentRpcTarget {
  if (config.executionEnabled !== 'true') return { ok: false, reason: 'disabled' };
  if (config.vercelEnvironment !== 'production') {
    return { ok: false, reason: 'unsafe_environment' };
  }
  if (!config.supabaseUrl || !config.serviceRoleKey) {
    return { ok: false, reason: 'missing_configuration' };
  }
  try {
    const url = new URL(config.supabaseUrl);
    const expectedHost = `${FAMILY_OS_SHARED_PROJECT_REF}.supabase.co`;
    if (url.protocol !== 'https:' || url.hostname !== expectedHost ||
        url.port || url.username || url.password || url.pathname !== '/' ||
        url.search || url.hash || url.origin !== `https://${expectedHost}`) {
      return { ok: false, reason: 'wrong_project' };
    }
    return { ok: true, url: url.origin };
  } catch {
    return { ok: false, reason: 'wrong_project' };
  }
}
