
/**
 * Google Classroom Sync Service
 *
 * TODO: Implement using the Google Classroom API.
 * Auth: OAuth2 — scopes needed:
 *   https://www.googleapis.com/auth/classroom.courses.readonly
 *   https://www.googleapis.com/auth/classroom.coursework.me.readonly
 *   https://www.googleapis.com/auth/classroom.rosters.readonly
 * Docs: https://developers.google.com/classroom/reference/rest
 *
 * All functions currently return mock data.
 */

export interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
  teacherName?: string;
  enrollmentCode: string;
}

export interface ClassroomCoursework {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  dueDate?: { year: number; month: number; day: number };
  dueTime?: { hours: number; minutes: number };
  maxPoints?: number;
  alternateLink: string;
  workType: 'ASSIGNMENT' | 'SHORT_ANSWER_QUESTION' | 'MULTIPLE_CHOICE_QUESTION';
}

export interface StudentMapping {
  studentId: string;   // Family OS user ID
  studentName: string;
  googleUserId: string;
  courseIds: string[]; // Classroom course IDs this student is enrolled in
}

export interface ClassroomSyncConfig {
  accessToken: string | null;
  studentMappings: StudentMapping[];
  lastSyncAt: string | null;
}

export const DEFAULT_CLASSROOM_CONFIG: ClassroomSyncConfig = {
  accessToken: null,
  studentMappings: [],
  lastSyncAt: null,
};

/**
 * Initiate Google OAuth flow for Classroom.
 * TODO: Build OAuth URL with classroom scopes and redirect_uri.
 */
export async function connectClassroom(): Promise<{ accessToken: string }> {
  // TODO: window.location.href = buildOAuthUrl({ scope: 'classroom.courses.readonly ...', ... });
  throw new Error('Google Classroom OAuth not yet configured. Add VITE_GOOGLE_CLIENT_ID to .env');
}

export function disconnectClassroom(): ClassroomSyncConfig {
  return DEFAULT_CLASSROOM_CONFIG;
}

/**
 * Fetch all active courses the authenticated user (student/guardian) is enrolled in.
 * TODO: GET https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE
 */
export async function fetchCourses(_accessToken: string): Promise<ClassroomCourse[]> {
  // TODO: Real Classroom API call
  return [
    { id: 'gc1', name: 'Math — Ms. Johnson',    section: 'Period 3', teacherName: 'Ms. Johnson',   enrollmentCode: 'abc123' },
    { id: 'gc2', name: 'English — Mr. Reyes',   section: 'Period 1', teacherName: 'Mr. Reyes',     enrollmentCode: 'def456' },
    { id: 'gc3', name: 'Science — Mrs. Patel',  section: 'Period 5', teacherName: 'Mrs. Patel',    enrollmentCode: 'ghi789' },
  ];
}

/**
 * Fetch upcoming coursework (assignments) for a given course.
 * TODO: GET https://classroom.googleapis.com/v1/courses/<courseId>/courseWork
 *       Filter by dueDate >= today, orderBy dueDate
 */
export async function fetchCoursework(
  _accessToken: string,
  courseId: string,
): Promise<ClassroomCoursework[]> {
  // TODO: Real Classroom API call
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 4); // 4 days from now, using setDate for correct month rollover
  return [
    {
      id: `cw-${courseId}-1`,
      courseId,
      title: `[Mock] Chapter Review — ${courseId}`,
      description: 'Complete the chapter review questions.',
      dueDate: { year: dueDate.getFullYear(), month: dueDate.getMonth() + 1, day: dueDate.getDate() },
      dueTime: { hours: 23, minutes: 59 },
      maxPoints: 100,
      alternateLink: 'https://classroom.google.com',
      workType: 'ASSIGNMENT',
    },
  ];
}

/**
 * Full sync for all mapped students: fetch courses → fetch coursework → return import-ready data.
 */
export async function syncAll(config: ClassroomSyncConfig): Promise<{
  courses: ClassroomCourse[];
  coursework: ClassroomCoursework[];
  syncedAt: string;
}> {
  if (!config.accessToken) throw new Error('Not connected to Google Classroom');
  const courses   = await fetchCourses(config.accessToken);
  const coursework = (await Promise.all(
    courses.map(c => fetchCoursework(config.accessToken!, c.id))
  )).flat();
  return { courses, coursework, syncedAt: new Date().toISOString() };
}
