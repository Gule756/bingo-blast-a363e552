/**
 * Security utilities for input validation, sanitization, and anti-tampering.
 */

import { z } from 'zod';

// ── Input Sanitization ──────────────────────────────────────────────

/** Strip all HTML tags and dangerous characters from a string */
export function sanitizeText(input: string): string {
  return input
    .replace(/[<>]/g, '') // Strip angle brackets (XSS vectors)
    .replace(/javascript:/gi, '') // Strip JS protocol
    .replace(/on\w+\s*=/gi, '') // Strip event handlers
    .replace(/data:/gi, '') // Strip data URIs
    .replace(/vbscript:/gi, '') // Strip VB protocol
    .trim();
}

/** Sanitize and truncate text with a max length */
export function sanitizeInput(input: string, maxLength = 100): string {
  return sanitizeText(input).slice(0, maxLength);
}

// ── Validation Schemas ──────────────────────────────────────────────

export const playerNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(30, 'Name must be under 30 characters')
  .regex(/^[a-zA-Z0-9_\s\u1200-\u137F]+$/, 'Only letters, numbers, underscores, and Amharic characters allowed')
  .transform(sanitizeText);

export const txHashSchema = z
  .string()
  .trim()
  .min(10, 'Transaction hash too short')
  .max(128, 'Transaction hash too long')
  .regex(/^[a-fA-F0-9]+$/, 'Invalid transaction hash format');

export const stackIdSchema = z
  .number()
  .int()
  .min(1, 'Invalid stack ID')
  .max(200, 'Invalid stack ID');

export const numberSchema = z
  .number()
  .int()
  .min(1, 'Invalid number')
  .max(75, 'Invalid number');

// ── Anti-Tampering ──────────────────────────────────────────────────

/** Freeze an object deeply to prevent runtime mutation from devtools */
export function deepFreeze<T extends object>(obj: T): Readonly<T> {
  Object.freeze(obj);
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return obj;
}

/** Rate limiter to prevent rapid-fire actions (e.g., spamming bingo claims) */
export class RateLimiter {
  private timestamps: number[] = [];
  constructor(
    private maxActions: number,
    private windowMs: number
  ) {}

  canAct(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);
    if (this.timestamps.length >= this.maxActions) return false;
    this.timestamps.push(now);
    return true;
  }

  reset() {
    this.timestamps = [];
  }
}

// ── CSP Nonce Helper ────────────────────────────────────────────────

/** Generate a random nonce for inline scripts (if needed) */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// ── Prevent DevTools State Manipulation ─────────────────────────────

/** Validate that a game state object hasn't been tampered with */
export function validateGameIntegrity(state: {
  daubedNumbers: Set<number>;
  calledNumbers: { number: number }[];
}): boolean {
  // Every daubed number (except free space marker 0) must be in calledNumbers
  const calledSet = new Set(state.calledNumbers.map(c => c.number));
  for (const num of state.daubedNumbers) {
    if (num === 0) continue; // free space marker
    if (!calledSet.has(num)) return false; // tampered!
  }
  return true;
}
