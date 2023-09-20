import * as core from '@actions/core';
import { WorkflowUtils } from '../src/workflow-utils';
import { ErrorMessages } from '../src/message';
import path from 'path';
import fs from 'fs';

/* eslint-disable @typescript-eslint/no-explicit-any, no-throw-literal */
jest.mock('path', () => {
  return {
    resolve: jest.fn().mockImplementation((...paths: string[]): string => {
      return paths.join('/');
    })
  };
});
const debugMock: jest.SpyInstance<void, [message: string]> = jest.spyOn(
  core,
  'debug'
);
describe('Test workflow-utils.ts', (): void => {
  let resolveSpy: jest.SpyInstance<string, string[]>;

  beforeAll((): void => {
    resolveSpy = jest.spyOn(path, 'resolve');
  });

  describe('Test getRepoPath function', (): void => {
    it('will return repoPath with relativePath', (): void => {
      const workspacePath: string = 'workspacePath';
      process.env['GITHUB_WORKSPACE'] = workspacePath;
      const relativePath: string = 'relativePath';

      const workflowUtils: WorkflowUtils = new WorkflowUtils();
      const repoPath: string = workflowUtils.getRepoPath(relativePath);

      expect(workflowUtils).toBeDefined();
      expect(resolveSpy).toHaveBeenCalledTimes(2);
      expect(repoPath).toEqual('workspacePath/relativePath');
      expect(debugMock).toHaveBeenCalledTimes(2);
    });

    it('will return repoPath without relativePath', (): void => {
      const workspacePath: string = 'workspacePath';
      process.env['GITHUB_WORKSPACE'] = workspacePath;

      const workflowUtils: WorkflowUtils = new WorkflowUtils();
      const repoPath: string = workflowUtils.getRepoPath();

      expect(workflowUtils).toBeDefined();
      expect(resolveSpy).toHaveBeenCalledTimes(1);
      expect(repoPath).toEqual('workspacePath');
      expect(debugMock).toHaveBeenCalledTimes(2);
    });

    it('will throw error when GITHUB_WORKSPACE is not defined', (): void => {
      delete process.env['GITHUB_WORKSPACE'];
      const workflowUtils: WorkflowUtils = new WorkflowUtils();
      expect(() => workflowUtils.getRepoPath()).toThrow(
        new Error(ErrorMessages.GITHUB_WORKSPACE_NOT_DEFINED)
      );
    });
  });

  describe('Test fileExistsSync function', (): void => {
    it('will return true when file exists', (): void => {
      jest.spyOn(fs, 'statSync').mockImplementation(() => {
        return { isDirectory: (): boolean => false } as fs.Stats;
      });

      const workflowUtils: WorkflowUtils = new WorkflowUtils();
      const fileExists: boolean = workflowUtils.fileExistsSync('test');

      expect(workflowUtils).toBeDefined();
      expect(fileExists).toBeTruthy();
    });

    it('will return false when searched is a directory', (): void => {
      jest.spyOn(fs, 'statSync').mockImplementation(() => {
        return { isDirectory: (): boolean => true } as fs.Stats;
      });

      const workflowUtils: WorkflowUtils = new WorkflowUtils();
      const fileExists: boolean = workflowUtils.fileExistsSync('test');

      expect(workflowUtils).toBeDefined();
      expect(fileExists).toBeFalsy();
    });

    it('will return false when file cannot be found, and statSync throw an object with code ENOENT', (): void => {
      jest.spyOn(fs, 'statSync').mockImplementation(() => {
        throw new FileSateSyncError('error', 'ENOENT');
      });

      const workflowUtils: WorkflowUtils = new WorkflowUtils();
      const fileExists: boolean = workflowUtils.fileExistsSync('test');

      expect(workflowUtils).toBeDefined();
      expect(fileExists).toBeFalsy();
    });

    it('will throw error when error code is not ENOENT', (): void => {
      jest.spyOn(fs, 'statSync').mockImplementation(() => {
        throw new Error('dummy error');
      });

      const workflowUtils: WorkflowUtils = new WorkflowUtils();
      expect(() => workflowUtils.fileExistsSync('test')).toThrow(
        new Error(`${ErrorMessages.FILE_EXISTS_CHECK_ERROR}dummy error`)
      );
    });

    it('will throw error when error of a string', (): void => {
      jest.spyOn(fs, 'statSync').mockImplementation(() => {
        throw 'string error';
      });

      const workflowUtils: WorkflowUtils = new WorkflowUtils();
      expect(() => workflowUtils.fileExistsSync('test')).toThrow(
        new Error(`${ErrorMessages.FILE_EXISTS_CHECK_ERROR}string error`)
      );
    });

    it('will throw error when filePath is empty', (): void => {
      const workflowUtils: WorkflowUtils = new WorkflowUtils();
      expect(() => workflowUtils.fileExistsSync('')).toThrow(
        new Error(ErrorMessages.FILE_EXISTS_CHECK_INPUT_ERROR)
      );
    });
  });
});
/* eslint-enable */

class FileSateSyncError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}
