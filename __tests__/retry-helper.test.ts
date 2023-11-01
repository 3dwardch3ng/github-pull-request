import * as core from '@actions/core';
import { createRetryHelper } from '../src/git/retry-helper-wrapper';
import { ErrorMessages } from '../src/message';

const infoMock: jest.SpyInstance<void, [message: string]> = jest.spyOn(
  core,
  'info'
);

/* eslint-disable @typescript-eslint/no-explicit-any */
describe('Test retry-helper.ts', (): void => {
  describe('Test RetryHelper.execute function', (): void => {
    let retryHelperInstance: any;
    let sleepMock: jest.SpyInstance<void, any[]>;
    let retryFuncMock: jest.Mock<any, any, any>;
    let getSleepAmountSpy: jest.SpyInstance<void, any[]>;

    afterEach((): void => {
      retryHelperInstance = undefined;
      sleepMock.mockClear();
      retryFuncMock.mockClear();
      getSleepAmountSpy.mockClear();
    });

    it('should retry default 3 times with random interval', async (): Promise<void> => {
      retryHelperInstance = createRetryHelper(3, 10, 20, undefined);
      retryFuncMock = jest
        .fn()
        .mockImplementation(async (): Promise<string> => {
          throw new Error('test');
        });
      sleepMock = jest
        .spyOn(retryHelperInstance, 'sleep')
        .mockImplementation(async (): Promise<void> => {
          return new Promise(resolve => setTimeout(resolve, 1000));
        });
      getSleepAmountSpy = jest.spyOn(retryHelperInstance, 'getSleepAmount');

      await expect(retryHelperInstance.execute(retryFuncMock)).rejects.toEqual(
        new Error('test')
      );
      expect(retryFuncMock).toHaveBeenCalledTimes(3);
      expect(sleepMock).toHaveBeenCalledTimes(2);
      expect(getSleepAmountSpy).toHaveBeenCalledTimes(2);
      expect(infoMock).toHaveBeenCalledTimes(5);
    });

    it('should retry 5 times with random interval', async (): Promise<void> => {
      retryHelperInstance = createRetryHelper(5, 1, 5, undefined);
      retryFuncMock = jest
        .fn()
        .mockImplementation(async (): Promise<string> => {
          throw new Error('test');
        });
      sleepMock = jest
        .spyOn(retryHelperInstance, 'sleep')
        .mockImplementation(async (): Promise<void> => {
          return new Promise(resolve => setTimeout(resolve, 1000));
        });
      getSleepAmountSpy = jest.spyOn(retryHelperInstance, 'getSleepAmount');

      await expect(retryHelperInstance.execute(retryFuncMock)).rejects.toEqual(
        new Error('test')
      );
      expect(retryFuncMock).toHaveBeenCalledTimes(5);
      expect(sleepMock).toHaveBeenCalledTimes(4);
      expect(getSleepAmountSpy).toHaveBeenCalledTimes(4);
      expect(infoMock).toHaveBeenCalledTimes(9);
    });

    it('should retry 2 times with input interval', async (): Promise<void> => {
      retryHelperInstance = createRetryHelper(3, 10, 20, 1);
      retryFuncMock = jest
        .fn()
        .mockImplementation(async (): Promise<string> => {
          throw new Error('test');
        });
      sleepMock = jest.spyOn(retryHelperInstance, 'sleep');
      getSleepAmountSpy = jest.spyOn(retryHelperInstance, 'getSleepAmount');

      await expect(retryHelperInstance.execute(retryFuncMock)).rejects.toEqual(
        new Error('test')
      );
      expect(retryFuncMock).toHaveBeenCalledTimes(3);
      expect(sleepMock).toHaveBeenCalledTimes(2);
      expect(sleepMock).toHaveBeenCalledWith(1);
      expect(getSleepAmountSpy).toHaveBeenCalledTimes(2);
      expect(infoMock).toHaveBeenCalledTimes(5);
    });
  });

  describe('Test constructor', (): void => {
    it('should create RetryHelper instance when minSeconds and maxSeconds are undefined but attemptsInterval is not', (): void => {
      const retryHelperInstance: any = createRetryHelper(
        3,
        undefined,
        undefined,
        5
      );
      expect(retryHelperInstance).toBeDefined();
      expect(retryHelperInstance.minSeconds).toBe(undefined);
      expect(retryHelperInstance.maxSeconds).toBe(undefined);
    });

    it('should throw error when minSeconds is greater than maxSeconds', (): void => {
      expect((): any => createRetryHelper(3, 20, 10, undefined)).toThrow(
        new Error(ErrorMessages.RETRY_HELPER_MIN_SECONDS_MAX_SECONDS_ERROR)
      );
    });
  });

  describe('Test getSleepAmount function', (): void => {
    it('should throw error when minSeconds and maxSeconds are undefined and attemptsInterval is also undefined', (): void => {
      const retryHelperInstance: any = createRetryHelper(
        3,
        undefined,
        undefined,
        undefined
      );
      expect(retryHelperInstance).toBeDefined();
      expect((): any => retryHelperInstance.getSleepAmount()).toThrow(
        new Error(
          "minSeconds and maxSeconds cannot be undefined when attemptsInterval isn't provided"
        )
      );
    });
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
