import { directoryExistsSync, fileExistsSync } from '../../src/git/fs-helper';
import fs from 'fs';
import { BigIntStats, Stats } from 'node:fs';

describe('Test fs-helper.ts', (): void => {
  describe('Test directoryExistsSync function', (): void => {
    it('should throw error when path is not provided', (): void => {
      expect(() => directoryExistsSync('', false)).toThrow(
        new Error("Arg 'path' must not be empty")
      );
    });

    it("should return false when provided path doesn't exist and is not required", (): void => {
      jest
        .spyOn(fs, 'statSync')
        .mockImplementation((): Stats | BigIntStats | undefined => {
          /* eslint-disable-next-line no-throw-literal */
          throw { code: 'ENOENT' };
        });
      const result: boolean = directoryExistsSync('path', false);
      expect(result).toBe(false);
    });

    it(`should throw error when provided path doesn't exist but is required`, (): void => {
      jest
        .spyOn(fs, 'statSync')
        .mockImplementation((): Stats | BigIntStats | undefined => {
          /* eslint-disable-next-line no-throw-literal */
          throw { code: 'ENOENT' };
        });
      expect(() => directoryExistsSync('path', true)).toThrow(
        new Error("Directory 'path' does not exist")
      );
    });

    it('should throw error when provided path exists but having other issue and the file is required', (): void => {
      jest
        .spyOn(fs, 'statSync')
        .mockImplementation((): Stats | BigIntStats | undefined => {
          throw new Error('Some other error');
        });
      expect(() => directoryExistsSync('path', true)).toThrow(
        new Error(
          "Encountered an error when checking whether path 'path' exists: Some other error"
        )
      );
    });

    it('should return true when provided path is valid and is a directory', (): void => {
      jest
        .spyOn(fs, 'statSync')
        .mockImplementation((): Stats | BigIntStats | undefined => {
          return { isDirectory: (): boolean => true } as Stats;
        });
      const result: boolean = directoryExistsSync('path', true);
      expect(result).toBe(true);
    });

    it('should return false when provided path is valid, is not a directory, and is not required', (): void => {
      jest
        .spyOn(fs, 'statSync')
        .mockImplementation((): Stats | BigIntStats | undefined => {
          return { isDirectory: (): boolean => false } as Stats;
        });
      const result: boolean = directoryExistsSync('path', false);
      expect(result).toBe(false);
    });

    it('should throw error when provided path is valid and is not a directory, and is required', (): void => {
      jest
        .spyOn(fs, 'statSync')
        .mockImplementation((): Stats | BigIntStats | undefined => {
          return { isDirectory: (): boolean => false } as Stats;
        });
      expect(() => directoryExistsSync('path', true)).toThrow(
        new Error("Directory 'path' does not exist")
      );
    });
  });

  describe('Test fileExistsSync function', (): void => {
    it('should throw error when path is not provided', (): void => {
      expect(() => fileExistsSync('')).toThrow(
        new Error("Arg 'path' must not be empty")
      );
    });

    it('should return false when provided path is empty file', (): void => {
      jest
        .spyOn(fs, 'statSync')
        .mockImplementation((): Stats | BigIntStats | undefined => {
          /* eslint-disable-next-line no-throw-literal */
          throw { code: 'ENOENT' };
        });
      const result: boolean = fileExistsSync('path');
      expect(result).toBe(false);
    });

    it('should throw error when provided path is not empty file but still having error', (): void => {
      jest
        .spyOn(fs, 'statSync')
        .mockImplementation((): Stats | BigIntStats | undefined => {
          throw new Error('Some other error');
        });
      expect(() => fileExistsSync('path')).toThrow(
        new Error(
          "Encountered an error when checking whether path 'path' exists: Some other error"
        )
      );
    });

    it('should return true when provided path is valid and is not a directory', (): void => {
      jest
        .spyOn(fs, 'statSync')
        .mockImplementation((): Stats | BigIntStats | undefined => {
          return { isDirectory: (): boolean => false } as Stats;
        });
      const result: boolean = fileExistsSync('path');
      expect(result).toBe(true);
    });

    it('should return false when provided path is valid, but is a directory', (): void => {
      jest
        .spyOn(fs, 'statSync')
        .mockImplementation((): Stats | BigIntStats | undefined => {
          return { isDirectory: (): boolean => true } as Stats;
        });
      const result: boolean = fileExistsSync('path');
      expect(result).toBe(false);
    });
  });
});
