/**
 * Deduplication identity for a manually pasted school message.
 * The identifier contains no raw message text and remains stable when
 * an email is rescanned in another session.
 *
 * This is NOT an authentication signature and does not replace server-side
 * uniqueness constraints when proposals become executable.
 */
export async function fingerprintPastedSchoolEmail(input: {
  subject: string;
  from: string;
  body: string;
}): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure hashing is unavailable. Cannot safely deduplicate this message.');
  }
  const source = JSON.stringify([
    'school_email_v1',
    input.from.trim().toLocaleLowerCase('en-US'),
    input.subject.trim().replace(/\s+/g, ' '),
    input.body.trim().replace(/\r\n/g, '\n'),
  ]);
  const bytes = new TextEncoder().encode(source);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return 'pasted-sha256-' +
    [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}
