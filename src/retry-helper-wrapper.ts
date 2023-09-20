import { IRetryHelper, RetryHelper } from './retry-helper';

const defaultMaxAttempts: number = 3;
const defaultMinSeconds: number = 10;
const defaultMaxSeconds: number = 20;

export function createRetryHelper(
  maxAttempts: number,
  minSeconds: number | undefined,
  maxSeconds: number | undefined,
  attemptsInterval: number | undefined
): IRetryHelper {
  return new RetryHelper(maxAttempts, minSeconds, maxSeconds, attemptsInterval);
}

export async function executeWithDefaults<T>(
  action: (...vars: unknown[]) => Promise<T>
): Promise<T> {
  const retryHelper: IRetryHelper = createRetryHelper(
    defaultMaxAttempts,
    defaultMinSeconds,
    defaultMaxSeconds,
    undefined
  );
  return await retryHelper.execute(action);
}

export async function executeWithCustomised<T>(
  maxAttempts: number,
  minSeconds: number | undefined,
  maxSeconds: number | undefined,
  attemptsInterval: number | undefined,
  action: (...vars: unknown[]) => Promise<T>
): Promise<T> {
  const retryHelper: IRetryHelper = createRetryHelper(
    maxAttempts,
    minSeconds,
    maxSeconds,
    attemptsInterval
  );
  return await retryHelper.execute(action);
}
