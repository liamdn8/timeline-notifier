import { DateTime } from 'luxon';
import type { Scenario, ScenarioEvent, TimelineEvent } from '../types';

export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

export const TIMEZONE_OPTIONS = [
  'Asia/Ho_Chi_Minh',
  'Asia/Ho_Chi_Minh',
  'UTC',
  'Asia/Tokyo',
  'Europe/London',
  'America/New_York',
];

export const toUtcIso = (scheduledAtLocal: string, timezone: string) => {
  if (!scheduledAtLocal) {
    return '';
  }

  return DateTime.fromISO(scheduledAtLocal, { zone: timezone }).toUTC().toISO() ?? '';
};

export const normalizeEvent = (
  event: ScenarioEvent,
  timezone: string,
): ScenarioEvent => ({
  ...event,
  scheduledAtUtc: toUtcIso(event.scheduledAtLocal, timezone),
});

export const normalizeScenario = (scenario: Scenario): Scenario => ({
  ...scenario,
  events: scenario.events
    .map((event) => normalizeEvent(event, scenario.timezone))
    .sort((left, right) => left.scheduledAtUtc.localeCompare(right.scheduledAtUtc)),
  updatedAt: new Date().toISOString(),
});

export const getTimelineEvents = (scenario: Scenario): TimelineEvent[] =>
  scenario.events
    .map((event) => ({
      ...event,
      atMillis: DateTime.fromISO(event.scheduledAtUtc, { zone: 'utc' }).toMillis(),
    }))
    .sort((left, right) => left.atMillis - right.atMillis);

export const formatEventTime = (isoUtc: string, timezone: string) =>
  DateTime.fromISO(isoUtc, { zone: 'utc' })
    .setZone(timezone)
    .toFormat('dd LLL yyyy, HH:mm');

export const formatClock = (millis: number, timezone: string) =>
  DateTime.fromMillis(millis, { zone: timezone }).toFormat('HH:mm:ss');

export const formatRelativeCountdown = (targetMillis: number, nowMillis: number) => {
  const diff = Math.max(targetMillis - nowMillis, 0);
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
};

export const getDefaultLocalDateTime = (timezone: string) =>
  DateTime.now().setZone(timezone).plus({ minutes: 5 }).startOf('minute').toFormat("yyyy-LL-dd'T'HH:mm");