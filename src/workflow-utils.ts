import * as core from '@actions/core';
import * as path from 'path';
import { ErrorMessages } from './message';
import fs from 'fs';

export interface IWorkflowUtils {
  getRepoPath(relativePath?: string): string;

  fileExistsSync(filePath: string): boolean;

  getErrorMessage(error: unknown): string;
}

export class WorkflowUtils implements IWorkflowUtils {
  getRepoPath(relativePath?: string): string {
    let ghWorkspacePath: string | undefined = process.env['GITHUB_WORKSPACE'];
    if (!ghWorkspacePath) {
      throw new Error(ErrorMessages.GITHUB_WORKSPACE_NOT_DEFINED);
    }
    ghWorkspacePath = path.resolve(ghWorkspacePath);
    core.debug(`githubWorkspacePath: ${ghWorkspacePath}`);

    let repoPath: string = ghWorkspacePath;
    if (relativePath) repoPath = path.resolve(ghWorkspacePath, relativePath);

    core.debug(`repoPath: ${repoPath}`);
    return repoPath;
  }

  fileExistsSync(filePath: string): boolean {
    if (!filePath) {
      throw new Error(ErrorMessages.FILE_EXISTS_CHECK_INPUT_ERROR);
    }

    let stats: fs.Stats;
    try {
      stats = fs.statSync(filePath);
    } catch (error: unknown) {
      if (
        this.hasErrorCode(error as { code: string }) &&
        (error as { code: string }).code === 'ENOENT'
      ) {
        return false;
      }

      throw new Error(
        ErrorMessages.FILE_EXISTS_CHECK_ERROR + this.getErrorMessage(error)
      );
    }

    return !stats.isDirectory();
  }

  getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }

  private hasErrorCode(error: { code: string }): error is { code: string } {
    return typeof (error && error.code) === 'string';
  }
}
