/**
 * Deterministic per-member color palette.
 * Uses the user's array index so colors are stable as long as the user list
 * order doesn't change, and degrades gracefully for > 6 members.
 */

export interface MemberColors {
  dot:    string;   // Tailwind bg class for the color dot
  badge:  string;   // Tailwind bg + text classes for the pill badge
  border: string;   // Tailwind border-l class for card left accent
  ring:   string;   // Tailwind ring class for avatar ring
}

const PALETTE: MemberColors[] = [
  { dot: 'bg-violet-400', badge: 'bg-violet-100 text-violet-700', border: 'border-l-violet-400', ring: 'ring-violet-300' },
  { dot: 'bg-sky-400',    badge: 'bg-sky-100 text-sky-700',       border: 'border-l-sky-400',    ring: 'ring-sky-300'    },
  { dot: 'bg-emerald-400',badge: 'bg-emerald-100 text-emerald-700',border:'border-l-emerald-400',ring: 'ring-emerald-300'},
  { dot: 'bg-rose-400',   badge: 'bg-rose-100 text-rose-700',     border: 'border-l-rose-400',   ring: 'ring-rose-300'   },
  { dot: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700',   border: 'border-l-amber-400',  ring: 'ring-amber-300'  },
  { dot: 'bg-pink-400',   badge: 'bg-pink-100 text-pink-700',     border: 'border-l-pink-400',   ring: 'ring-pink-300'   },
];

/** Returns the color set for the user at the given index in the family list. */
export function getMemberColors(indexInFamily: number): MemberColors {
  return PALETTE[indexInFamily % PALETTE.length];
}

/** Returns initials (up to 2 characters) from a full name. */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
