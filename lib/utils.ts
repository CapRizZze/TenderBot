import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Объединяет Tailwind-классы и корректно разрешает конфликтующие значения.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
