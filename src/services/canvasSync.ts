
/**
 * Canvas LMS Sync Service
 *
 * TODO: Implement using the Canvas REST API.
 * Base URL: https://<school>.instructure.com/api/v1
 * Auth: Bearer token (user-generated API key from Canvas account settings).
 * Docs: https://canvas.instructure.com/doc/api/
 *
 * All functions currently return mock data.
 */

export interface CanvasCourse {
  id: string;
  name: string;
  courseCode: string;
  enrollmentTerm: string;
}

export interface CanvasAssignment {
  id: string;
  courseId: string;
  name: string;
  description: string;
  dueAt: string | null;    // ISO datetime
  pointsPossible: number;
  submissionTypes: string[];
  htmlUrl: string;
}

export interface CanvasSyncConfig {
  apiKey: string;
  baseUrl: string;    // e.g. https://myschool.instructure.com
  lastSyncAt: string | null;
}

/**
 * Verify the API key by fetching the current user profile.
 * TODO: GET /api/v1/users/self with Authorization: Bearer <apiKey>
 */
export async function testConnection(config: CanvasSyncConfig): Promise<{ success: boolean; userName?: string }> {
  // TODO: fetch(`${config.baseUrl}/api/v1/users/self`, { headers: { Authorization: `Bearer ${config.apiKey}` } })
  if (!config.apiKey || !config.baseUrl) return { success: false };
  return { success: true, userName: 'Mock Student' };
}

/**
 * Fetch all active courses for the authenticated student.
 * TODO: GET /api/v1/courses?enrollment_state=active&per_page=50
 */
export async function fetchCourses(config: CanvasSyncConfig): Promise<CanvasCourse[]> {
  // TODO: Real Canvas API call
  return [
    { id: 'c1', name: 'Mathematics 5', courseCode: 'MATH5', enrollmentTerm: 'Spring 2026' },
    { id: 'c2', name: 'Language Arts', courseCode: 'ELA5',  enrollmentTerm: 'Spring 2026' },
    { id: 'c3', name: 'Science',        courseCode: 'SCI5',  enrollmentTerm: 'Spring 2026' },
  ];
}

/**
 * Fetch upcoming assignments across all courses.
 * TODO: GET /api/v1/courses/<id>/assignments?bucket=upcoming&per_page=50 for each course
 */
export async function fetchAssignments(
  config: CanvasSyncConfig,
  courseIds: string[],
): Promise<CanvasAssignment[]> {
  // TODO: Parallel fetch for each course, merge results, deduplicate
  return courseIds.flatMap((courseId, i) => ([
    {
      id: `a${i}-1`,
      courseId,
      name: `[Mock] Chapter ${i + 1} Quiz`,
      description: 'Complete the end-of-chapter quiz.',
      dueAt: new Date(Date.now() + (i + 1) * 3 * 86400000).toISOString(),
      pointsPossible: 20,
      submissionTypes: ['online_quiz'],
      htmlUrl: 'https://canvas.example.com/courses/1/assignments/1',
    },
  ]));
}

/**
 * Full sync: fetch courses → fetch assignments → return structured data for import.
 */
export async function syncAll(config: CanvasSyncConfig): Promise<{
  courses: CanvasCourse[];
  assignments: CanvasAssignment[];
  syncedAt: string;
}> {
  const courses = await fetchCourses(config);
  const assignments = await fetchAssignments(config, courses.map(c => c.id));
  return { courses, assignments, syncedAt: new Date().toISOString() };
}
