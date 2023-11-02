import { IRetryHelper, RetryHelper } from './retry-helper';

export const defaultMaxAttempts: number = 3;
export const defaultMinSeconds: number = 10;
export const defaultMaxSeconds: number = 20;

export function createRetryHelperWithDefaults(): IRetryHelper {
  return new RetryHelper(
    defaultMaxAttempts,
    defaultMinSeconds,
    defaultMaxSeconds,
    undefined
  );
}

export function createRetryHelper(
  maxAttempts: number | undefined,
  minSeconds: number | undefined,
  maxSeconds: number | undefined,
  attemptsInterval: number | undefined
): IRetryHelper {
  return new RetryHelper(
    maxAttempts === undefined ? defaultMaxAttempts : Math.floor(maxAttempts),
    minSeconds === undefined ? defaultMinSeconds : Math.floor(minSeconds),
    maxSeconds === undefined ? defaultMaxSeconds : Math.floor(maxSeconds),
    attemptsInterval === undefined ? undefined : Math.floor(attemptsInterval)
  );
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
