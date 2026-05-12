export const createId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);