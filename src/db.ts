
import {
  User, Role, Family, Student, Assignment, Chore,
  CalendarEvent, Status, Frequency, Transaction,
  BudgetCategory, SavingsGoal,
  Recipe, MealPlanEntry, ShoppingList, Reward, RewardTransaction,
  PinboardNote, FamilyDocument, OnboardingData,
} from './types';

// ─── Date Helpers ─────────────────────────────────────────────────────────────

const now = new Date();
const iso     = (d: Date) => d.toISOString();
const dateStr = (d: Date) => d.toISOString().split('T')[0];
const daysAgo  = (n: number) => new Date(now.getTime() - n * 86400000);
const daysFrom = (n: number) => new Date(now.getTime() + n * 86400000);

const today        = dateStr(now);
const yesterday    = dateStr(daysAgo(1));
const tomorrow     = dateStr(daysFrom(1));
const dayAfter     = dateStr(daysFrom(2));
const threeDaysAgo = dateStr(daysAgo(3));

// ─── Family & Users ───────────────────────────────────────────────────────────

export const MOCK_FAMILY: Family = {
  id: 'fam-1',
  name: 'The Miller Family',
  inviteCode: 'MILLER2024',
};

export const MOCK_USERS: User[] = [
  { id: 'u-1', name: 'Sarah Miller', email: 'sarah@example.com', role: Role.PARENT, familyId: 'fam-1', avatar: 'https://picsum.photos/seed/sarah/100' },
  { id: 'u-2', name: 'Leo Miller',   email: 'leo@example.com',   role: Role.CHILD,  familyId: 'fam-1', avatar: 'https://picsum.photos/seed/leo/100' },
  { id: 'u-3', name: 'Maya Miller',  email: 'maya@example.com',  role: Role.CHILD,  familyId: 'fam-1', avatar: 'https://picsum.photos/seed/maya/100' },
];

export const SEED_STUDENTS: Student[] = [
  { id: 's-1', familyId: 'fam-1', name: 'Leo Miller',  grade: '5th Grade', notes: 'Enjoys math, needs help with focus.' },
  { id: 's-2', familyId: 'fam-1', name: 'Maya Miller', grade: '2nd Grade', notes: 'Reading champion!' },
];

// ─── Assignments (includes deliberate overdue item for demo) ──────────────────

export const SEED_ASSIGNMENTS: Assignment[] = [
  {
    id: 'a-1',
    studentId: 's-1',
    subject: 'Math',
    title: 'Fraction Multiplication',
    dueDate: today,
    estimatedMinutes: 30,
    status: Status.IN_PROGRESS,
    source: 'Manual',
    createdAt: iso(daysAgo(2)),
    updatedAt: iso(daysAgo(1)),
  },
  {
    id: 'a-2',
    studentId: 's-1',
    subject: 'Science',
    title: 'Solar System Project',
    dueDate: dayAfter,
    estimatedMinutes: 120,
    status: Status.NOT_STARTED,
    source: 'Manual',
    createdAt: iso(daysAgo(3)),
    updatedAt: iso(daysAgo(3)),
  },
  {
    id: 'a-3',
    studentId: 's-2',
    subject: 'Reading',
    title: 'Weekly Reading Log',
    dueDate: tomorrow,
    estimatedMinutes: 15,
    status: Status.DONE,
    source: 'Manual',
    createdAt: iso(daysAgo(4)),
    updatedAt: iso(now),
    completedAt: iso(now),
    completedById: 'u-3',
  },
  {
    id: 'a-4',
    studentId: 's-1',
    subject: 'History',
    title: 'Revolutionary War Essay',
    dueDate: yesterday, // OVERDUE
    estimatedMinutes: 60,
    status: Status.NOT_STARTED,
    source: 'Manual',
    createdAt: iso(daysAgo(5)),
    updatedAt: iso(daysAgo(5)),
  },
];

// ─── Chores (includes deliberate overdue items for demo) ──────────────────────

export const SEED_CHORES: Chore[] = [
  {
    id: 'c-1',
    assigneeId: 'u-2',
    title: 'Empty Dishwasher',
    frequency: Frequency.DAILY,
    dueDate: today,
    status: Status.NOT_STARTED,
    createdAt: iso(daysAgo(7)),
    updatedAt: iso(daysAgo(1)),
  },
  {
    id: 'c-2',
    assigneeId: 'u-3',
    title: 'Feed the Dog',
    frequency: Frequency.DAILY,
    dueDate: today,
    status: Status.DONE,
    createdAt: iso(daysAgo(7)),
    updatedAt: iso(now),
    completedAt: iso(now),
    completedById: 'u-3',
  },
  {
    id: 'c-3',
    assigneeId: 'u-2',
    title: 'Take Out Trash',
    frequency: Frequency.WEEKLY,
    dueDate: threeDaysAgo, // OVERDUE
    status: Status.NOT_STARTED,
    createdAt: iso(daysAgo(10)),
    updatedAt: iso(daysAgo(3)),
  },
  {
    id: 'c-4',
    assigneeId: 'u-1',
    title: 'Grocery Run',
    frequency: Frequency.ONE_TIME,
    dueDate: tomorrow,
    status: Status.NOT_STARTED,
    createdAt: iso(daysAgo(1)),
    updatedAt: iso(daysAgo(1)),
  },
  {
    id: 'c-5',
    assigneeId: 'u-3',
    title: 'Clean Room',
    frequency: Frequency.WEEKLY,
    dueDate: yesterday, // OVERDUE
    status: Status.NOT_STARTED,
    createdAt: iso(daysAgo(7)),
    updatedAt: iso(daysAgo(7)),
  },
];

// ─── Calendar Events ──────────────────────────────────────────────────────────

export const SEED_EVENTS: CalendarEvent[] = [
  {
    id: 'e-1',
    familyId: 'fam-1',
    title: 'Soccer Practice',
    start: `${today}T16:00:00`,
    end: `${today}T17:30:00`,
    location: 'West Park',
    attendeeIds: ['u-2'],
    createdAt: iso(daysAgo(3)),
  },
  {
    id: 'e-2',
    familyId: 'fam-1',
    title: 'Family Pizza Night',
    start: `${tomorrow}T18:30:00`,
    end: `${tomorrow}T20:00:00`,
    attendeeIds: ['u-1', 'u-2', 'u-3'],
    createdAt: iso(daysAgo(2)),
  },
  {
    id: 'e-3',
    familyId: 'fam-1',
    title: 'Dentist Appointment',
    start: `${dayAfter}T09:00:00`,
    end: `${dayAfter}T10:00:00`,
    location: "Dr. Smile's Office",
    attendeeIds: ['u-2'],
    createdAt: iso(daysAgo(5)),
  },
];

// ─── Finance ──────────────────────────────────────────────────────────────────

export const SEED_TRANSACTIONS: Transaction[] = [
  {
    id: 't-1',
    familyId: 'fam-1',
    date: today,
    description: 'Whole Foods Market',
    amount: 84.50,
    category: 'Groceries',
    type: 'expense',
    source: 'manual',
    createdAt: iso(now),
  },
  {
    id: 't-2',
    familyId: 'fam-1',
    date: yesterday,
    description: 'Shell Gas Station',
    amount: 45.00,
    category: 'Transport',
    type: 'expense',
    source: 'manual',
    createdAt: iso(daysAgo(1)),
  },
  {
    id: 't-3',
    familyId: 'fam-1',
    date: yesterday,
    description: 'Netflix Subscription',
    amount: 15.99,
    category: 'Entertainment',
    type: 'expense',
    source: 'manual',
    createdAt: iso(daysAgo(1)),
  },
  {
    id: 't-4',
    familyId: 'fam-1',
    date: today,
    description: 'Monthly Salary',
    amount: 4200.00,
    category: 'Income',
    type: 'income',
    source: 'manual',
    createdAt: iso(now),
  },
];

export const SEED_BUDGETS: BudgetCategory[] = [
  { id: 'b-1', name: 'Groceries',     limit: 800, spent: 420, color: '#6366f1' },
  { id: 'b-2', name: 'Dining Out',    limit: 300, spent: 285, color: '#f59e0b' },
  { id: 'b-3', name: 'Utilities',     limit: 400, spent: 310, color: '#10b981' },
  { id: 'b-4', name: 'Entertainment', limit: 200, spent: 45,  color: '#ec4899' },
];

export const SEED_SAVINGS: SavingsGoal[] = [
  { id: 'sg-1', name: 'Summer Vacation', targetAmount: 5000,  currentAmount: 3200, dueDate: '2025-07-01' },
  { id: 'sg-2', name: 'Emergency Fund',  targetAmount: 10000, currentAmount: 8500 },
];

// ─── Meal Planning Seed Data ──────────────────────────────────────────────────

export const SEED_RECIPES: Recipe[] = [
  {
    id: 'r-1', familyId: 'fam-1',
    name: 'Spaghetti Bolognese',
    description: 'Classic Italian meat sauce over spaghetti.',
    prepTime: 15, cookTime: 45, servings: 4,
    tags: ['Italian', 'Pasta', 'Family Favorite'],
    ingredients: [
      { name: 'Ground beef',   amount: '1',  unit: 'lb' },
      { name: 'Spaghetti',     amount: '12', unit: 'oz' },
      { name: 'Tomato sauce',  amount: '24', unit: 'oz' },
      { name: 'Garlic cloves', amount: '3',  unit: 'cloves' },
      { name: 'Onion',         amount: '1',  unit: 'medium' },
    ],
    instructions: 'Brown beef with garlic and onion. Add tomato sauce and simmer 30 min. Cook pasta and combine.',
  },
  {
    id: 'r-2', familyId: 'fam-1',
    name: 'Taco Tuesday',
    description: 'Seasoned ground beef tacos with all the fixings.',
    prepTime: 10, cookTime: 20, servings: 4,
    tags: ['Mexican', 'Quick', 'Family Favorite'],
    ingredients: [
      { name: 'Ground beef',    amount: '1',  unit: 'lb' },
      { name: 'Taco shells',    amount: '12', unit: 'shells' },
      { name: 'Taco seasoning', amount: '1',  unit: 'packet' },
      { name: 'Shredded cheese', amount: '1', unit: 'cup' },
      { name: 'Lettuce',        amount: '1',  unit: 'cup' },
      { name: 'Tomatoes',       amount: '2',  unit: 'medium' },
    ],
    instructions: 'Brown beef with seasoning. Warm shells. Assemble with toppings.',
  },
  {
    id: 'r-3', familyId: 'fam-1',
    name: 'Sheet Pan Chicken & Veggies',
    description: 'Easy one-pan roasted chicken thighs with seasonal vegetables.',
    prepTime: 10, cookTime: 35, servings: 4,
    tags: ['Healthy', 'One-Pan', 'Easy'],
    ingredients: [
      { name: 'Chicken thighs',  amount: '4', unit: 'pieces' },
      { name: 'Broccoli florets', amount: '2', unit: 'cups' },
      { name: 'Bell peppers',    amount: '2', unit: 'medium' },
      { name: 'Olive oil',       amount: '3', unit: 'tbsp' },
      { name: 'Garlic powder',   amount: '1', unit: 'tsp' },
    ],
    instructions: 'Toss chicken and veggies with oil and seasoning. Roast at 425°F for 35 min.',
  },
  {
    id: 'r-4', familyId: 'fam-1',
    name: 'Overnight Oats',
    description: 'Prep-ahead creamy oats for busy mornings.',
    prepTime: 5, cookTime: 0, servings: 2,
    tags: ['Breakfast', 'Healthy', 'Meal Prep'],
    ingredients: [
      { name: 'Rolled oats', amount: '1',   unit: 'cup' },
      { name: 'Milk',        amount: '1',   unit: 'cup' },
      { name: 'Yogurt',      amount: '0.5', unit: 'cup' },
      { name: 'Honey',       amount: '2',   unit: 'tbsp' },
      { name: 'Berries',     amount: '0.5', unit: 'cup' },
    ],
    instructions: 'Combine oats, milk, yogurt, and honey. Refrigerate overnight. Top with berries before serving.',
  },
];

// Generate a week of meal plan starting from Monday of this week
const getMonday = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
};
const monday    = getMonday();
const weekDates = Array.from({ length: 7 }, (_, i) => {
  const d = new Date(monday + 'T12:00:00');
  d.setDate(d.getDate() + i);
  return d.toISOString().split('T')[0];
});

export const SEED_MEAL_PLAN: MealPlanEntry[] = [
  { id: 'mp-1', familyId: 'fam-1', date: weekDates[0], mealType: 'breakfast', recipeId: 'r-4', customMeal: null },
  { id: 'mp-2', familyId: 'fam-1', date: weekDates[0], mealType: 'dinner',    recipeId: 'r-1', customMeal: null },
  { id: 'mp-3', familyId: 'fam-1', date: weekDates[1], mealType: 'dinner',    recipeId: 'r-2', customMeal: null },
  { id: 'mp-4', familyId: 'fam-1', date: weekDates[3], mealType: 'dinner',    recipeId: 'r-3', customMeal: null },
  { id: 'mp-5', familyId: 'fam-1', date: weekDates[4], mealType: 'dinner',    recipeId: null,  customMeal: 'Pizza Night 🍕' },
];

export const SEED_SHOPPING_LISTS: ShoppingList[] = [
  {
    id: 'sl-1', familyId: 'fam-1',
    name: 'Weekly Groceries',
    createdAt: today,
    items: [
      { id: 'si-1', name: 'Ground beef',    amount: '2 lb',     category: 'Meat & Seafood', checked: false, recipeSource: 'Taco Tuesday' },
      { id: 'si-2', name: 'Spaghetti',      amount: '12 oz',    category: 'Pantry',         checked: true,  recipeSource: 'Spaghetti Bolognese' },
      { id: 'si-3', name: 'Tomato sauce',   amount: '24 oz',    category: 'Pantry',         checked: false, recipeSource: 'Spaghetti Bolognese' },
      { id: 'si-4', name: 'Chicken thighs', amount: '4 pieces', category: 'Meat & Seafood', checked: false, recipeSource: 'Sheet Pan Chicken' },
      { id: 'si-5', name: 'Broccoli',       amount: '1 head',   category: 'Produce',        checked: false },
      { id: 'si-6', name: 'Milk',           amount: '1 gal',    category: 'Dairy',          checked: true },
      { id: 'si-7', name: 'Eggs',           amount: '1 dozen',  category: 'Dairy',          checked: false },
      { id: 'si-8', name: 'Bread',          amount: '1 loaf',   category: 'Bakery',         checked: false },
    ],
  },
];

// ─── Allowance & Rewards Seed Data ────────────────────────────────────────────

export const SEED_REWARDS: Reward[] = [
  { id: 'rw-1', familyId: 'fam-1', name: 'Extra Screen Time',  description: '30 extra minutes of TV or games',        pointCost: 50,  emoji: '📺' },
  { id: 'rw-2', familyId: 'fam-1', name: 'Choose Dinner',      description: 'Pick what the family has for dinner',     pointCost: 75,  emoji: '🍕' },
  { id: 'rw-3', familyId: 'fam-1', name: 'Sleepover Pass',     description: 'Invite a friend for a sleepover',         pointCost: 150, emoji: '🛏️' },
  { id: 'rw-4', familyId: 'fam-1', name: 'Movie Night Pick',   description: 'You choose the family movie this weekend', pointCost: 60,  emoji: '🎬' },
  { id: 'rw-5', familyId: 'fam-1', name: '$5 Allowance Bonus', description: 'Extra $5 added to your allowance',        pointCost: 100, emoji: '💵' },
];

export const SEED_REWARD_TRANSACTIONS: RewardTransaction[] = [
  { id: 'rt-1', familyId: 'fam-1', userId: 'u-2', type: 'earned',   points: 10,  description: 'Empty Dishwasher',            date: yesterday },
  { id: 'rt-2', familyId: 'fam-1', userId: 'u-2', type: 'earned',   points: 15,  description: 'Take Out Trash',              date: yesterday },
  { id: 'rt-3', familyId: 'fam-1', userId: 'u-3', type: 'earned',   points: 10,  description: 'Feed the Dog',                date: today },
  { id: 'rt-4', familyId: 'fam-1', userId: 'u-2', type: 'redeemed', points: -50, description: 'Redeemed: Extra Screen Time', date: today },
  { id: 'rt-5', familyId: 'fam-1', userId: 'u-3', type: 'earned',   points: 20,  description: 'Clean Bedroom',               date: today },
];

// ─── Pinboard Seed Data ───────────────────────────────────────────────────────

export const SEED_NOTES: PinboardNote[] = [
  { id: 'n-1', familyId: 'fam-1', authorId: 'u-1', content: "Don't forget Leo's soccer cleats need to be replaced before the tournament!", color: 'yellow', pinned: true,  createdAt: today },
  { id: 'n-2', familyId: 'fam-1', authorId: 'u-1', content: 'Parent-teacher conferences are next Thursday at 5pm. Mark your calendars! 📅',    color: 'blue',   pinned: false, createdAt: today },
  { id: 'n-3', familyId: 'fam-1', authorId: 'u-2', content: 'Can we please get more cereal? We ran out this morning 🥣',                       color: 'green',  pinned: false, createdAt: yesterday },
  { id: 'n-4', familyId: 'fam-1', authorId: 'u-3', content: 'I got an A on my spelling test! 🌟',                                               color: 'pink',   pinned: true,  createdAt: yesterday },
];

// ─── Document Vault Seed Data ─────────────────────────────────────────────────

export const SEED_DOCUMENTS: FamilyDocument[] = [
  { id: 'd-1', familyId: 'fam-1', name: 'Home Insurance Policy',    category: 'Insurance', expiryDate: '2026-08-01', notes: 'Policy #: HI-2024-8821',           createdAt: today },
  { id: 'd-2', familyId: 'fam-1', name: 'Car Insurance — Honda',    category: 'Insurance', expiryDate: '2026-04-15', notes: 'Geico policy, 6-month renewal',     createdAt: today },
  { id: 'd-3', familyId: 'fam-1', name: 'Leo — Vaccination Record', category: 'Medical',                             notes: 'All shots up to date',             createdAt: yesterday },
  { id: 'd-4', familyId: 'fam-1', name: 'Maya — Vaccination Record',category: 'Medical',                             notes: 'Needs flu shot this fall',         createdAt: yesterday },
  { id: 'd-5', familyId: 'fam-1', name: 'Leo — School Enrollment',  category: 'School',   expiryDate: '2026-06-30', notes: 'Lincoln Elementary, 5th grade',     createdAt: yesterday },
  { id: 'd-6', familyId: 'fam-1', name: 'Trust & Will',             category: 'Legal',                               notes: 'Notarized copy in fireproof safe', createdAt: yesterday },
  { id: 'd-7', familyId: 'fam-1', name: '2024 Tax Return',          category: 'Financial',                           notes: 'Filed April 2025',                 createdAt: yesterday },
  { id: 'd-8', familyId: 'fam-1', name: 'Passport — Sarah',         category: 'Legal',    expiryDate: '2027-11-03', notes: 'Expires Nov 2027',                  createdAt: yesterday },
];

// ─── Dynamic Family Generator ─────────────────────────────────────────────────

const gradeToAge = (grade: string): number => {
  const g = grade.toLowerCase().replace(/\s*(grade|th|st|nd|rd)\s*/gi, '').trim();
  const map: Record<string, number> = {
    'k': 5, 'kindergarten': 5, 'pre-k': 4, 'prek': 4,
    '1': 6, '2': 7, '3': 8, '4': 9, '5': 10,
    '6': 11, '7': 12, '8': 13, '9': 14,
    '10': 15, '11': 16, '12': 17,
  };
  return map[g] || 10;
};

const choresByAge = (age: number): string[] => {
  if (age <= 6)  return ['Make your bed', 'Pick up toys', 'Put dirty clothes in hamper'];
  if (age <= 9)  return ['Clear the dinner table', 'Feed the pet', 'Help set the table', 'Water plants'];
  if (age <= 12) return ['Empty the dishwasher', 'Take out trash', 'Vacuum living room'];
  return ['Do own laundry', 'Mow the lawn', 'Help cook dinner'];
};

export const generateFamilyData = (data: OnboardingData) => {
  const ts         = Date.now();
  const familyId   = `fam-${ts}`;
  const todayStr   = new Date().toISOString().split('T')[0];
  const tomorrowStr = new Date(ts + 86400000).toISOString().split('T')[0];
  const nowIso     = new Date().toISOString();
  const inviteCode = `${(data.familyName || 'FAMILY').toUpperCase().replace(/\s/g, '')}${new Date().getFullYear()}`;

  const family: Family = {
    id: familyId,
    name: `The ${data.familyName} Family`,
    inviteCode,
  };

  const parentUser: User = {
    id: `u-parent-${ts}`,
    name: `${data.parent.name} ${data.familyName}`,
    email: data.parent.email || `${data.parent.name.toLowerCase().replace(/\s/g, '.')}@family.local`,
    role: Role.PARENT,
    familyId,
    avatar: `https://picsum.photos/seed/${data.parent.name}/100`,
  };

  const additionalAdultUsers: User[] = (data.additionalAdults || []).map((adult, i) => ({
    id: `u-adult-${ts}-${i}`,
    name: `${adult.name} ${data.familyName}`,
    email: `${adult.name.toLowerCase().replace(/\s/g, '.')}@family.local`,
    role: Role.PARENT,
    familyId,
    avatar: `https://picsum.photos/seed/${adult.name}${i}/100`,
  }));

  const childUsers: User[] = (data.children || []).map((child, i) => ({
    id: `u-child-${ts}-${i}`,
    name: `${child.name} ${data.familyName}`,
    email: `${child.name.toLowerCase().replace(/\s/g, '.')}@family.local`,
    role: Role.CHILD,
    familyId,
    avatar: `https://picsum.photos/seed/${child.name}${i}/100`,
  }));

  const users: User[] = [parentUser, ...additionalAdultUsers, ...childUsers];

  const students: Student[] = (data.children || []).map((child, i) => ({
    id: `s-${ts}-${i}`,
    familyId,
    name: `${child.name} ${data.familyName}`,
    grade: child.grade || 'Unknown Grade',
    notes: child.school ? `Attends ${child.school}` : undefined,
  }));

  // Age-appropriate chores per child
  const chores: Chore[] = [];
  childUsers.forEach((user, i) => {
    const age = gradeToAge(data.children[i]?.grade || '5');
    choresByAge(age).slice(0, 2).forEach((title, j) => {
      chores.push({
        id: `c-${ts}-${i}-${j}`,
        assigneeId: user.id,
        title,
        frequency: Frequency.WEEKLY,
        dueDate: tomorrowStr,
        status: Status.NOT_STARTED,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    });
  });
  // One parent chore
  chores.push({
    id: `c-parent-${ts}`,
    assigneeId: parentUser.id,
    title: 'Weekly Grocery Run',
    frequency: Frequency.WEEKLY,
    dueDate: tomorrowStr,
    status: Status.NOT_STARTED,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  const events: CalendarEvent[] = [
    {
      id: `e-welcome-${ts}`,
      familyId,
      title: `🎉 Welcome to Family OS, ${data.familyName} Family!`,
      start: `${todayStr}T09:00:00`,
      end: `${todayStr}T09:30:00`,
      createdAt: nowIso,
    },
  ];

  const budgets: BudgetCategory[] = [
    { id: `b-${ts}-1`, name: 'Groceries',     limit: 800, spent: 0, color: '#6366f1' },
    { id: `b-${ts}-2`, name: 'Dining Out',    limit: 300, spent: 0, color: '#f59e0b' },
    { id: `b-${ts}-3`, name: 'Utilities',     limit: 400, spent: 0, color: '#10b981' },
    { id: `b-${ts}-4`, name: 'Entertainment', limit: 200, spent: 0, color: '#ec4899' },
  ];

  return {
    family,
    users,
    students,
    chores,
    events,
    budgets,
    assignments: [] as Assignment[],
    transactions: [] as Transaction[],
    savings: [] as SavingsGoal[],
  };
};
