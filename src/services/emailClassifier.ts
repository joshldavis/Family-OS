
/**
 * Email Classification Service
 * Uses Claude (Anthropic) to classify pasted email text and extract
 * structured data routable to Family OS modules.
 */

import { ClassifiedEmail, EmailCategory, CalendarEvent, Assignment } from '../types';

export interface FamilyContext {
  familyName: string;
  children: Array<{ name: string; grade: string; school: string }>;
  existingEvents: CalendarEvent[];
  existingAssignments: Assignment[];
}

interface ParsedClassification {
  emails: ClassifiedEmail[];
}

// Strip the <classified> wrapper and parse the JSON array
function parseClassificationResponse(content: string): ClassifiedEmail[] {
  const match = content.match(/<classified>([\s\S]*?)<\/classified>/);
  if (!match) return [];
  try {
    const parsed: ParsedClassification = { emails: JSON.parse(match[1].trim()) };
    return Array.isArray(parsed.emails) ? parsed.emails : [];
  } catch {
    return [];
  }
}

export async function classifyEmails(
  rawTexts: Array<{ id: string; subject: string; from: string; date: string; body: string }>,
  context: FamilyContext,
  apiKey: string
): Promise<ClassifiedEmail[]> {
  if (!rawTexts.length) return [];

  const today = new Date().toISOString().split('T')[0];

  const systemPrompt = `You are the Family OS email intelligence agent. You classify school-related emails and extract structured data.

FAMILY CONTEXT:
Family: ${context.familyName}
Children:
${context.children.map(c => `- ${c.name}, ${c.grade} at ${c.school}`).join('\n')}
Today's date: ${today}

CLASSIFICATION CATEGORIES:
1. calendar_event — Any event with a date/time: field trips, early dismissals, performances, conferences, picture day, spirit week days.
2. assignment — Homework, projects, tests, quizzes, reading logs — anything a student must complete.
3. action_required — Permission slips, forms to sign, payments due, volunteer sign-ups — anything a PARENT must do.
4. behavior_update — ClassDojo points/feedback, progress reports, teacher comments on student behavior.
5. announcement — Newsletters, general info, fundraisers, PTA updates, school closures without specific action needed.
6. irrelevant — Marketing, spam, ClassDojo product promotions, unrelated content.

CLASSDOJO SPECIFICS:
- "New message from [Teacher]" → action_required or announcement depending on content
- "New Class Story post" → announcement
- "New School Story post" → announcement
- "[Child] earned a point" / behavior feedback → behavior_update
- "Upcoming event" → calendar_event
- Ignore: "Try ClassDojo Plus!", "Upgrade your account", marketing footers

RULES:
- Match childName to one of the children above if possible (by name in email or by grade/class match)
- Extract dates in ISO YYYY-MM-DD format when possible
- Set isDuplicate if title+date closely matches an existing item:
  Existing events: ${context.existingEvents.slice(0, 10).map(e => `${e.title} (${e.start})`).join('; ') || 'none'}
  Existing assignments: ${context.existingAssignments.slice(0, 10).map(a => `${a.title} due ${a.dueDate}`).join('; ') || 'none'}
- If unsure about category, use best judgment and lower confidence
- For irrelevant emails, still include them with category "irrelevant" so we can skip them

Return a JSON array wrapped in <classified> tags. Each item must have all fields present.`;

  const emailsText = rawTexts.map((e, i) =>
    `Email ${i + 1}:
ID: ${e.id}
From: ${e.from}
Subject: ${e.subject}
Date: ${e.date}
Body:
${e.body}
---`
  ).join('\n\n');

  const userMessage = `Classify these ${rawTexts.length} email(s) and extract structured data from each:

${emailsText}

Return the full classification array wrapped in <classified> tags like this:
<classified>
[
  {
    "id": "email-id-here",
    "subject": "original subject",
    "from": "sender@example.com",
    "date": "2024-01-15",
    "rawText": "brief excerpt of email body (50 chars max)",
    "category": "calendar_event",
    "confidence": 0.92,
    "childName": "Emma",
    "isDuplicate": false,
    "extractedData": {
      "eventTitle": "Spring Concert",
      "eventDate": "2024-03-15",
      "eventTime": "7:00 PM",
      "eventLocation": "School Auditorium"
    }
  }
]
</classified>`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Classification API error: ${err}`);
  }

  const json = await res.json();
  const textContent: string = json.content
    ?.filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('\n') || '';

  return parseClassificationResponse(textContent);
}

// Classify a single pasted email blob (the UI use case)
export async function classifySingleEmail(
  text: string,
  subject: string,
  from: string,
  context: FamilyContext,
  apiKey: string
): Promise<ClassifiedEmail[]> {
  const id = `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return classifyEmails(
    [{ id, subject, from, date: new Date().toISOString().split('T')[0], body: text }],
    context,
    apiKey
  );
}

// Classify multiple emails from pasted text (split by blank lines between emails)
export function parseEmailSource(raw: string): string {
  // Strip common ClassDojo email template chrome
  return raw
    .replace(/View on ClassDojo[\s\S]*$/i, '')
    .replace(/Download the ClassDojo app[\s\S]*$/i, '')
    .replace(/©[\s\S]*ClassDojo[\s\S]*$/i, '')
    .replace(/Unsubscribe[\s\S]*$/i, '')
    .trim();
}
