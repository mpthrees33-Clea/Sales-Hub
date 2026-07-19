import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** First 6 chars of an id for monospace UI references ("logged #a1b2c3"). */
export function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 6);
}
