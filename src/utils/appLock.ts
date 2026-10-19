export type AppLockTimerUnit = 'seconds' | 'minutes';

export type AppLockConfig = {
  enabled: boolean;
  salt: string;
  hash: string;
  updatedAt?: string;
  autoLockEnabled: boolean;
  autoLockValue: number;
  autoLockUnit: AppLockTimerUnit;
};

export const DEFAULT_APP_LOCK_TIMER_VALUE = 5;
export const DEFAULT_APP_LOCK_TIMER_UNIT: AppLockTimerUnit = 'minutes';
export const MAX_APP_LOCK_DURATION_SECONDS = 7 * 24 * 60 * 60;

export const normalizeAppLockConfig = (value: unknown): AppLockConfig | null => {
  const candidate = value as Partial<AppLockConfig> | null;
  if (!candidate?.enabled || typeof candidate.salt !== 'string' || typeof candidate.hash !== 'string') return null;

  const unit: AppLockTimerUnit = candidate.autoLockUnit === 'seconds' ? 'seconds' : DEFAULT_APP_LOCK_TIMER_UNIT;
  const requestedValue = Math.floor(Number(candidate.autoLockValue));
  const maximumValue = unit === 'seconds' ? MAX_APP_LOCK_DURATION_SECONDS : MAX_APP_LOCK_DURATION_SECONDS / 60;
  const autoLockValue = Number.isFinite(requestedValue) && requestedValue >= 1
    ? Math.min(requestedValue, maximumValue)
    : DEFAULT_APP_LOCK_TIMER_VALUE;

  return {
    enabled: true,
    salt: candidate.salt,
    hash: candidate.hash,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : undefined,
    autoLockEnabled: candidate.autoLockEnabled === true,
    autoLockValue,
    autoLockUnit: unit
  };
};

export const getAppLockDurationMs = (config: AppLockConfig | null | undefined): number | null => {
  if (!config?.enabled || !config.autoLockEnabled) return null;
  const multiplier = config.autoLockUnit === 'seconds' ? 1000 : 60_000;
  const durationMs = Math.floor(config.autoLockValue) * multiplier;
  return durationMs >= 1000 && durationMs <= MAX_APP_LOCK_DURATION_SECONDS * 1000 ? durationMs : null;
};
