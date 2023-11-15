import {
  createRetryHelper,
  createRetryHelperWithDefaults,
  executeWithCustomised,
  executeWithDefaults
} from '../src/retry-helper-wrapper';
import { RetryHelper } from '../src/retry-helper';

/* eslint-disable @typescript-eslint/no-explicit-any */
const executeFuncMock: jest.Mock<any, any, any> = jest.fn();
jest.mock('../src/retry-helper', () => {
  return {
    RetryHelper: jest.fn().mockImplementation(() => {
      return { execute: executeFuncMock };
    })
  };
});

describe('Test retry-helper-wrapper.ts', (): void => {
  describe('Test createRetryHelper function', (): void => {
    it('should create RetryHelper instance with given values', (): void => {
      createRetryHelper(2, 15, 20, undefined);
      expect(RetryHelper).toHaveBeenCalledTimes(1);
      expect(RetryHelper).toHaveBeenCalledWith(2, 15, 20, undefined);
    });
  });

  describe('Test createRetryHelperWithDefaults function', (): void => {
    it('should create RetryHelper instance with default values', (): void => {
      createRetryHelperWithDefaults();
      expect(RetryHelper).toHaveBeenCalledTimes(1);
      expect(RetryHelper).toHaveBeenCalledWith(3, 10, 20, undefined);
    });
  });

  describe('Test executeWithDefaults function', (): void => {
    it('should call execute with default values', async (): Promise<void> => {
      await executeWithDefaults(async (): Promise<string> => {
        return new Promise(resolve => resolve('test'));
      });
      expect(RetryHelper).toHaveBeenCalledTimes(1);
      expect(RetryHelper).toHaveBeenCalledWith(3, 10, 20, undefined);
      expect(executeFuncMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test executeWithCustomised function', (): void => {
    it('should call execute with input values with random interval when attemptsInterval is undefined', async (): Promise<void> => {
      await executeWithCustomised(
        2,
        2,
        5,
        undefined,
        async (): Promise<string> => {
          return new Promise(resolve => resolve('test'));
        }
      );
      expect(RetryHelper).toHaveBeenCalledTimes(1);
      expect(RetryHelper).toHaveBeenCalledWith(2, 2, 5, undefined);
      expect(executeFuncMock).toHaveBeenCalledTimes(1);
    });

    it('should call execute with input values with fixed interval when attemptsInterval is provided', async (): Promise<void> => {
      await executeWithCustomised(2, 1, 3, 2, async (): Promise<string> => {
        return new Promise(resolve => resolve('test'));
      });
      expect(RetryHelper).toHaveBeenCalledTimes(1);
      expect(RetryHelper).toHaveBeenCalledWith(2, 1, 3, 2);
      expect(executeFuncMock).toHaveBeenCalledTimes(1);
    });
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
