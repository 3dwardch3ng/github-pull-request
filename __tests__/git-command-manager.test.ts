import * as core from '@actions/core';
import * as exec from '@actions/exec';
import {
  GitCommandManager,
  IWorkingBaseAndType
} from '../src/git/git-command-manager';
import { ErrorMessages } from '../src/message';
import { GitExecOutput } from '../src/git/git-exec-output';

/* eslint-disable @typescript-eslint/no-explicit-any */
const workingDirectory: string = '/home/runner/work/_temp/_github_home';

const infoSpy: jest.SpyInstance<void, [message: string]> = jest.spyOn(
  core,
  'info'
);

const gitCommandManagerCreateFunctionMock: jest.Mock<any, any> = jest
  .fn()
  .mockImplementation(async (workingDir: string) => {
    const gitCommandManager: GitCommandManager = new GitCommandManager();
    await gitCommandManager.init(workingDir);
    return gitCommandManager;
  });
const initMock: jest.Mock<any, any, any> = jest.fn();
jest.mock('../src/git/git-command-manager', () => {
  return {
    ...jest.requireActual('../src/git/git-command-manager'),
    GitCommandManager: jest.fn().mockImplementation(() => {
      return {
        init: initMock
      };
    })
  };
});
const getErrorMessageMock: jest.Mock<any, any, any> = jest
  .fn()
  .mockImplementation((error: unknown): string => {
    if (error instanceof Error) return error.message;
    return String(error);
  });
const fileExistsSyncMock: jest.Mock<any, any, any> = jest.fn();
jest.mock('../src/workflow-utils', () => {
  return {
    WorkflowUtils: jest.fn().mockImplementation(() => {
      return {
        getErrorMessage: getErrorMessageMock,
        fileExistsSync: fileExistsSyncMock
      };
    })
  };
});
jest.mock('@actions/io', () => {
  return {
    which: jest
      .fn()
      .mockImplementation(
        async (tool: string, check: boolean): Promise<string> => {
          if (tool === 'git' && check) {
            return new Promise(resolve => resolve('/usr/bin/git'));
          }
          return new Promise(reject => reject('Tool not found'));
        }
      )
  };
});

describe('Test git-command-manager.ts', (): void => {
  describe('Test create function', (): void => {
    it('should create GitCommandManager instance', async (): Promise<void> => {
      GitCommandManager.create = gitCommandManagerCreateFunctionMock;

      const gitCommandManager: GitCommandManager =
        await GitCommandManager.create(workingDirectory);

      expect(gitCommandManager).toBeDefined();
      expect(GitCommandManager).toHaveBeenCalledTimes(1);
      expect(initMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test init function', (): void => {
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should initialise GitCommandManager instance', async (): Promise<void> => {
      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      expect(gitCommandManager).toBeDefined();
      expect(infoSpy).toHaveBeenCalledTimes(2);
      expect(gitCommandManager.workingDirectory).toBe(workingDirectory);
      expect(gitCommandManager.gitPath).toBe('/usr/bin/git');
    });
  });

  describe('Test getRepoRemoteUrl function', (): void => {
    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should return remote url', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args[0] === 'config' &&
            args[1] === '--get' &&
            args[2] === 'remote.origin.url' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from(
                'https://github.com/3dwardCh3nG/github-pull-request.git'
              )
            );
          }
          return new Promise(resolve => resolve(0));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const remoteUrl: string = await gitCommandManager.getRepoRemoteUrl();

      expect(remoteUrl).toBe(
        'https://github.com/3dwardCh3nG/github-pull-request.git'
      );
      expect(execMock).toHaveBeenCalledTimes(1);
      expect(execMock).toHaveBeenCalledWith(
        '/usr/bin/git',
        ['config', '--get', 'remote.origin.url'],
        expect.any(Object)
      );
    });
  });

  describe('Test getRemoteDetail function', (): void => {
    const workingDir: string = '/home/runner/work/_temp/_github_home';
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    afterEach((): void => {
      delete process.env['GITHUB_SERVER_URL'];
    });

    it('should return remote detail', async (): Promise<void> => {
      const remoteUrl: string =
        'https://github.com/3dwardCh3nG/github-pull-request.git';

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(workingDir);

      const remoteDetail: any = gitCommandManager.getRemoteDetail(remoteUrl);

      expect(remoteDetail).toBeDefined();
      expect(remoteDetail.hostname).toBe('git.com');
      expect(remoteDetail.protocol).toBe('HTTPS');
      expect(remoteDetail.repository).toBe('3dwardCh3nG/git-pull-request');
    });

    it('should throw error when input non url as the git server url', async (): Promise<void> => {
      process.env['GITHUB_SERVER_URL'] = 'git.com';
      const remoteUrl: string =
        'https://github.com/3dwardCh3nG/github-pull-request.git';

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(workingDir);

      expect(() => gitCommandManager.getRemoteDetail(remoteUrl)).toThrow(
        new Error('Not a valid GitHub Service URL')
      );
    });

    it('should throw error when remote url is not a valid git url', async (): Promise<void> => {
      const remoteUrl: string =
        'https://gitlab.com/3dwardCh3nG/github-pull-request.git';

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(workingDir);

      expect(() => gitCommandManager.getRemoteDetail(remoteUrl)).toThrow(
        new Error(
          `The format of '${remoteUrl}' is not a valid GitHub repository URL`
        )
      );
    });
  });

  describe('Test getWorkingBaseAndType function', (): void => {
    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    afterEach((): void => {
      delete process.env['GITHUB_REF'];
    });

    it('should success and return working base and type when currently on Pull', async (): Promise<void> => {
      process.env['GITHUB_REF'] = 'refs/pull/1/merge';

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const workingBaseAndType: IWorkingBaseAndType =
        await gitCommandManager.getWorkingBaseAndType();

      expect(workingBaseAndType.workingBase).toBe('refs/remotes/pull/1/merge');
      expect(workingBaseAndType.workingBaseType).toBe('pull');
    });

    it('should success and return working base and type when currently on a branch HEAD', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args[0] === 'symbolic-ref' &&
            args[1] === 'HEAD' &&
            args[2] === '--short' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('this-is-the-develop-branch')
            );
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const workingBaseAndType: IWorkingBaseAndType =
        await gitCommandManager.getWorkingBaseAndType();

      expect(workingBaseAndType.workingBase).toBe('this-is-the-develop-branch');
      expect(workingBaseAndType.workingBaseType).toBe('branch');
      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should success and return HEAD sha and type when currently on a commit as the detached HEAD', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args.length === 3 &&
            args[0] === 'symbolic-ref' &&
            args[1] === 'HEAD' &&
            args[2] === '--short' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stderr?.call(
              options.listeners.stderr,
              Buffer.from('fatal: ref HEAD is not a symbolic ref')
            );
            return new Promise(resolve => resolve(1));
          } else if (
            args.length === 2 &&
            args[0] === 'rev-parse' &&
            args[1] === 'HEAD' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('1b820b962c5249885fc51fb5a1d45bd2cabce14f')
            );
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const workingBaseAndType: IWorkingBaseAndType =
        await gitCommandManager.getWorkingBaseAndType();

      expect(workingBaseAndType.workingBase).toBe(
        '1b820b962c5249885fc51fb5a1d45bd2cabce14f'
      );
      expect(workingBaseAndType.workingBaseType).toBe('commit');
      expect(execMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('Test stashPush function', (): void => {
    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should success and return true', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args.length === 2 &&
            args[0] === 'stash' &&
            args[1] === 'push' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('Stash pushed successfully')
            );
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const result: boolean = await gitCommandManager.stashPush();

      expect(result).toBe(true);
      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should success and return false when there is no local change to push', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args.length === 2 &&
            args[0] === 'stash' &&
            args[1] === 'push' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('No local changes to save')
            );
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const result: boolean = await gitCommandManager.stashPush();

      expect(result).toBe(false);
      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should success and return true with options', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args.length === 3 &&
            args[0] === 'stash' &&
            args[1] === 'push' &&
            args[2] === '--include-untracked' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('Stash pushed successfully')
            );
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const result: boolean = await gitCommandManager.stashPush([
        '--include-untracked'
      ]);

      expect(result).toBe(true);
      expect(execMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test stashPop function', (): void => {
    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should success', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 2 &&
            args[0] === 'stash' &&
            args[1] === 'pop' &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      await gitCommandManager.stashPop();

      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should success with options', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 3 &&
            args[0] === 'stash' &&
            args[1] === 'pop' &&
            args[2] === '--index' &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      await gitCommandManager.stashPop(['--index']);

      expect(execMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test checkout function', (): void => {
    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should success and return true when checkout to a branch', async (): Promise<void> => {
      const ref: string = 'this-is-the-develop-branch';
      const startPoint: string = 'HEAD';
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args.length === 7 &&
            args[0] === 'checkout' &&
            args[1] === '--progress' &&
            args[2] === '--force' &&
            args[3] === '-B' &&
            args[4] === ref &&
            args[5] === startPoint &&
            args[6] === '--' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('this-is-the-develop-branch')
            );
            return new Promise(resolve => resolve(0));
          }
          throw new Error('Wrong arguments');
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      await gitCommandManager.checkout(ref, startPoint);

      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should success and return true when checkout to a branch with startpoint', async (): Promise<void> => {
      const ref: string = 'this-is-the-develop-branch';
      const startPoint: string = 'HEAD';
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args.length === 7 &&
            args[0] === 'checkout' &&
            args[1] === '--progress' &&
            args[2] === '--force' &&
            args[3] === '-B' &&
            args[4] === ref &&
            args[5] === startPoint &&
            args[6] === '--' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('this-is-the-develop-branch')
            );
            return new Promise(resolve => resolve(0));
          }
          throw new Error('Wrong arguments');
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      await gitCommandManager.checkout(ref, startPoint);

      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should success and return true when checkout to a branch with no startPoint given', async (): Promise<void> => {
      const ref: string = 'this-is-the-develop-branch';
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args.length === 5 &&
            args[0] === 'checkout' &&
            args[1] === '--progress' &&
            args[2] === '--force' &&
            args[3] === ref &&
            args[4] === '--' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('this-is-the-develop-branch')
            );
            return new Promise(resolve => resolve(0));
          }
          throw new Error('Wrong arguments');
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      await gitCommandManager.checkout(ref);

      expect(execMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test switch function', (): void => {
    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should success and return true when switch to a branch', async (): Promise<void> => {
      const ref: string = 'this-is-the-develop-branch';
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 2 &&
            args[0] === 'switch' &&
            args[1] === ref &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      await gitCommandManager.switch(ref);

      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should success and return true when checkout to a branch with options and startpoint', async (): Promise<void> => {
      const ref: string = 'this-is-the-develop-branch';
      const startPoint: string = 'HEAD';
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 5 &&
            args[0] === 'switch' &&
            args[1] === '-q' &&
            args[2] === '-c' &&
            args[3] === ref &&
            args[4] === startPoint &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      await gitCommandManager.switch(ref, ['-q'], startPoint);

      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should success and return true when checkout to a branch with no startPoint given', async (): Promise<void> => {
      const ref: string = 'this-is-the-develop-branch';
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args.length === 5 &&
            args[0] === 'checkout' &&
            args[1] === '--progress' &&
            args[2] === '--force' &&
            args[3] === ref &&
            args[4] === '--' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('this-is-the-develop-branch')
            );
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      await gitCommandManager.checkout(ref);

      expect(execMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test fetch function', (): void => {
    const workingDir: string = '/home/runner/work/_temp/_github_home';
    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should success and return true when fetch from remote', async (): Promise<void> => {
      fileExistsSyncMock.mockReturnValue(true);
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 9 &&
            args[0] === '-c' &&
            args[1] === 'protocol.version=2' &&
            args[2] === 'fetch' &&
            args[3] === '--progress' &&
            args[4] === '--no-recurse-submodules' &&
            args[5] === '--unshallow' &&
            args[6] === '--force' &&
            args[7] === 'origin' &&
            args[8] === 'develop:refs/remotes/origin/develop' &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(workingDir);

      const remote: string = 'origin';
      const branch: string = 'develop';

      const result: boolean = await gitCommandManager.fetch(remote, branch);

      expect(result).toBe(true);
      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should success and return true when fetch from remote with fileExistsSync is false', async (): Promise<void> => {
      fileExistsSyncMock.mockReturnValue(false);
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 8 &&
            args[0] === '-c' &&
            args[1] === 'protocol.version=2' &&
            args[2] === 'fetch' &&
            args[3] === '--progress' &&
            args[4] === '--no-recurse-submodules' &&
            args[5] === '--force' &&
            args[6] === 'git' &&
            args[7] === 'develop:refs/remotes/origin/develop' &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(workingDir);

      const remote: string = 'git';
      const branch: string = 'develop';

      const result: boolean = await gitCommandManager.fetch(remote, branch);

      expect(result).toBe(true);
      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should return false when fileExistsSync throws error', async (): Promise<void> => {
      fileExistsSyncMock.mockImplementation(() => {
        throw new Error(ErrorMessages.FILE_EXISTS_CHECK_ERROR);
      });

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(workingDir);

      const remote: string = 'origin';
      const branch: string = 'develop';

      const result: boolean = await gitCommandManager.fetch(remote, branch);

      expect(result).toBe(false);
    });
  });

  describe('Test fetchRemote function', (): void => {
    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should success and use default remote value origin when remote is not given', async (): Promise<void> => {
      fileExistsSyncMock.mockReturnValue(true);
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 9 &&
            args[0] === '-c' &&
            args[1] === 'protocol.version=2' &&
            args[2] === 'fetch' &&
            args[3] === '--progress' &&
            args[4] === '--no-recurse-submodules' &&
            args[5] === '--unshallow' &&
            args[6] === '--force' &&
            args[7] === 'origin' &&
            args[8] === 'develop:refs/remotes/origin/develop' &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const branch: string = 'develop';

      await gitCommandManager.fetchRemote([
        `${branch}:refs/remotes/origin/${branch}`
      ]);

      expect(execMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test fetchAll function', (): void => {
    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should success and use default remote value origin when remote is not given', async (): Promise<void> => {
      fileExistsSyncMock.mockReturnValue(true);
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 1 &&
            args[0] === 'fetch' &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      await gitCommandManager.fetchAll();

      expect(execMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test isAhead function', (): void => {
    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should return true when branch2 is ahead of branch1', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args.length === 5 &&
            args[0] === 'rev-list' &&
            args[1] === '--right-only' &&
            args[2] === '--count' &&
            args[3] === 'branch1...branch2' &&
            args[4] === '--' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('2')
            );
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const branch1: string = 'branch1';
      const branch2: string = 'branch2';

      const result: boolean = await gitCommandManager.isAhead(
        branch1,
        branch2,
        ['--']
      );

      expect(result).toBe(true);
      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should return false when branch2 is not ahead of branch1', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args.length === 4 &&
            args[0] === 'rev-list' &&
            args[1] === '--right-only' &&
            args[2] === '--count' &&
            args[3] === 'branch1...branch2' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('0')
            );
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const branch1: string = 'branch1';
      const branch2: string = 'branch2';

      const result: boolean = await gitCommandManager.isAhead(branch1, branch2);

      expect(result).toBe(false);
      expect(execMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test isBehind function', (): void => {
    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should return true when branch2 is behind branch1', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args.length === 5 &&
            args[0] === 'rev-list' &&
            args[1] === '--left-only' &&
            args[2] === '--count' &&
            args[3] === 'branch1...branch2' &&
            args[4] === '--' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('2')
            );
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const branch1: string = 'branch1';
      const branch2: string = 'branch2';

      const result: boolean = await gitCommandManager.isBehind(
        branch1,
        branch2,
        ['--']
      );

      expect(result).toBe(true);
      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should return false when branch2 is not behind branch1', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args.length === 4 &&
            args[0] === 'rev-list' &&
            args[1] === '--left-only' &&
            args[2] === '--count' &&
            args[3] === 'branch1...branch2' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('0')
            );
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const branch1: string = 'branch1';
      const branch2: string = 'branch2';

      const result: boolean = await gitCommandManager.isBehind(
        branch1,
        branch2
      );

      expect(result).toBe(false);
      expect(execMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test isEven function', (): void => {
    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should return true when branch2 is even with branch1', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args.length === 4 &&
            args[0] === 'rev-list' &&
            args[1] === '--left-only' &&
            args[2] === '--count' &&
            args[3] === 'branch1...branch2' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('0')
            );
            return new Promise(resolve => resolve(0));
          } else if (
            args.length === 4 &&
            args[0] === 'rev-list' &&
            args[1] === '--right-only' &&
            args[2] === '--count' &&
            args[3] === 'branch1...branch2' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('0')
            );
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const branch1: string = 'branch1';
      const branch2: string = 'branch2';

      const result: boolean = await gitCommandManager.isEven(branch1, branch2);

      expect(result).toBe(true);
      expect(execMock).toHaveBeenCalledTimes(2);
    });

    it('should return false when branch2 is ahead branch1', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args.length === 4 &&
            args[0] === 'rev-list' &&
            args[1] === '--left-only' &&
            args[2] === '--count' &&
            args[3] === 'branch1...branch2' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('2')
            );
            return new Promise(resolve => resolve(0));
          } else if (
            args.length === 4 &&
            args[0] === 'rev-list' &&
            args[1] === '--right-only' &&
            args[2] === '--count' &&
            args[3] === 'branch1...branch2' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('0')
            );
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const branch1: string = 'branch1';
      const branch2: string = 'branch2';

      const result: boolean = await gitCommandManager.isEven(branch1, branch2);

      expect(result).toBe(false);
      expect(execMock).toHaveBeenCalledTimes(2);
    });

    it('should return false when branch2 is behind branch1', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args.length === 4 &&
            args[0] === 'rev-list' &&
            args[1] === '--left-only' &&
            args[2] === '--count' &&
            args[3] === 'branch1...branch2' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('0')
            );
            return new Promise(resolve => resolve(0));
          } else if (
            args.length === 4 &&
            args[0] === 'rev-list' &&
            args[1] === '--right-only' &&
            args[2] === '--count' &&
            args[3] === 'branch1...branch2' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('2')
            );
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const branch1: string = 'branch1';
      const branch2: string = 'branch2';

      const result: boolean = await gitCommandManager.isEven(branch1, branch2);

      expect(result).toBe(false);
      expect(execMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test pull function', (): void => {
    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should success when pull from remote with no options', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 1 &&
            args[0] === 'pull' &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      await gitCommandManager.pull();

      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should success when pull from remote with options', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 2 &&
            args[0] === 'pull' &&
            args[1] === '--verbose' &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      await gitCommandManager.pull(['--verbose']);

      expect(execMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test push function', (): void => {
    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should success when push to remote with no options', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 1 &&
            args[0] === 'push' &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      await gitCommandManager.push();

      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should success when push to remote with options', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 2 &&
            args[0] === 'push' &&
            args[1] === '--verbose' &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      await gitCommandManager.push(['--verbose']);

      expect(execMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test deleteBranch function', (): void => {
    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should success when delete branch with no options', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 3 &&
            args[0] === 'branch' &&
            args[1] === '--delete' &&
            args[2] === 'branch-name' &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const branchName: string = 'branch-name';

      await gitCommandManager.deleteBranch(branchName);

      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should success when delete branch with options', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 4 &&
            args[0] === 'branch' &&
            args[1] === '--delete' &&
            args[2] === '--verbose' &&
            args[3] === 'branch-name' &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const branchName: string = 'branch-name';

      await gitCommandManager.deleteBranch(branchName, ['--verbose']);

      expect(execMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test status function', (): void => {
    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should success when status with no options', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args.length === 1 &&
            args[0] === 'status' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('this is status')
            );
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const status: string = await gitCommandManager.status();

      expect(status).toBe('this is status');
      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should success when status with options', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args.length === 2 &&
            args[0] === 'status' &&
            args[1] === '--verbose' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('this is status with verbose')
            );
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const status: string = await gitCommandManager.status(['--verbose']);

      expect(status).toBe('this is status with verbose');
      expect(execMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test hasDiff function', (): void => {
    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should return true when has diff with no options', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 2 &&
            args[0] === 'diff' &&
            args[1] === '--quiet' &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(1));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const result: boolean = await gitCommandManager.hasDiff();

      expect(result).toBe(true);
      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should return true when has diff with options', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 3 &&
            args[0] === 'diff' &&
            args[1] === '--quiet' &&
            args[2] === '--verbose' &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(1));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const result: boolean = await gitCommandManager.hasDiff(['--verbose']);

      expect(result).toBe(true);
      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should return false when has no diff', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 2 &&
            args[0] === 'diff' &&
            args[1] === '--quiet' &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const result: boolean = await gitCommandManager.hasDiff();

      expect(result).toBe(false);
      expect(execMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test config function', (): void => {
    const configKey: string = 'user.name';
    const configValue: string = 'git-actions[bot]';

    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should success when config with globalConfig and add to be true', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 5 &&
            args[0] === 'config' &&
            args[1] === '--global' &&
            args[2] === '--add' &&
            args[3] === configKey &&
            args[4] === configValue &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      await gitCommandManager.config(configKey, configValue, true, true);

      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should success when config with globalConfig and add to be false', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 4 &&
            args[0] === 'config' &&
            args[1] === '--local' &&
            args[2] === configKey &&
            args[3] === configValue &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      await gitCommandManager.config(configKey, configValue, false, false);

      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should success when config with globalConfig and add not provided', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 4 &&
            args[0] === 'config' &&
            args[1] === '--local' &&
            args[2] === configKey &&
            args[3] === configValue &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      await gitCommandManager.config(configKey, configValue);

      expect(execMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test configExists function', (): void => {
    const configKey: string = 'user.name';

    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should return true when config with globalConfig to be true', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 5 &&
            args[0] === 'config' &&
            args[1] === '--global' &&
            args[2] === '--name-only' &&
            args[3] === '--get-regexp' &&
            args[4] === configKey &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const result: boolean = await gitCommandManager.configExists(
        configKey,
        true
      );

      expect(result).toBe(true);
      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should return false when config with globalConfig to be false', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 5 &&
            args[0] === 'config' &&
            args[1] === '--local' &&
            args[2] === '--name-only' &&
            args[3] === '--get-regexp' &&
            args[4] === configKey &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(1));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const result: boolean = await gitCommandManager.configExists(
        configKey,
        false
      );

      expect(result).toBe(false);
      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should return true when config with globalConfig is not provided', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 5 &&
            args[0] === 'config' &&
            args[1] === '--local' &&
            args[2] === '--name-only' &&
            args[3] === '--get-regexp' &&
            args[4] === configKey &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const result: boolean = await gitCommandManager.configExists(configKey);

      expect(result).toBe(true);
      expect(execMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test unsetConfig function', (): void => {
    const configKey: string = 'user.name';

    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should return true when unsetConfig with globalConfig to be true', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 4 &&
            args[0] === 'config' &&
            args[1] === '--global' &&
            args[2] === '--unset-all' &&
            args[3] === configKey &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const result: boolean = await gitCommandManager.unsetConfig(
        configKey,
        true
      );

      expect(result).toBe(true);
      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should return false when unsetConfig with globalConfig to be false', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 4 &&
            args[0] === 'config' &&
            args[1] === '--local' &&
            args[2] === '--unset-all' &&
            args[3] === configKey &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(1));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const result: boolean = await gitCommandManager.unsetConfig(
        configKey,
        false
      );

      expect(result).toBe(false);
      expect(execMock).toHaveBeenCalledTimes(1);
    });

    it('should return true when unsetConfig with globalConfig is not provided', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (gitPath: string, args: string[]): Promise<number> => {
          if (
            args.length === 4 &&
            args[0] === 'config' &&
            args[1] === '--local' &&
            args[2] === '--unset-all' &&
            args[3] === configKey &&
            gitPath === '/usr/bin/git'
          ) {
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const result: boolean = await gitCommandManager.unsetConfig(configKey);

      expect(result).toBe(true);
      expect(execMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test getGitDirectory function', (): void => {
    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should return git directory when getGitDirectory with globalConfig to be true', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args.length === 2 &&
            args[0] === 'rev-parse' &&
            args[1] === '--git-dir' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('.git')
            );
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: GitCommandManager =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const gitDirectory: string = await gitCommandManager.getGitDirectory();

      expect(gitDirectory).toBe('.git');
      expect(execMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test revParse function', (): void => {
    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should return git directory with options', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args.length === 3 &&
            args[0] === 'rev-parse' &&
            args[1] === '--sq' &&
            args[2] === '--git-dir' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.stdout?.call(
              options.listeners.stdout,
              Buffer.from('.git')
            );
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: any =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const gitDirectory: string = await gitCommandManager.revParse(
        '--git-dir',
        ['--sq']
      );

      expect(gitDirectory).toBe('.git');
      expect(execMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test execGit function', (): void => {
    const execSpy: jest.SpyInstance = jest.spyOn(exec, 'exec');
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should success when execGit with debug outputs', async (): Promise<void> => {
      const execMock: jest.SpyInstance = execSpy.mockImplementation(
        async (
          gitPath: string,
          args: string[],
          options: exec.ExecOptions
        ): Promise<number> => {
          if (
            args.length === 2 &&
            args[0] === 'rev-parse' &&
            args[1] === '--git-dir' &&
            gitPath === '/usr/bin/git'
          ) {
            options.listeners?.debug?.call(
              options.listeners.debug,
              'this is debug data'
            );
            return new Promise(resolve => resolve(0));
          }
          return new Promise(resolve => resolve(1));
        }
      );

      const gitCommandManager: any =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      const output: GitExecOutput = await gitCommandManager.execGit([
        'rev-parse',
        '--git-dir'
      ]);

      expect(output.getDebug()).toBe('this is debug data');
      expect(execMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test setEnvironmentVariable function', (): void => {
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should success when setEnvironmentVariable', async (): Promise<void> => {
      const gitCommandManager: any =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      gitCommandManager.setEnvironmentVariable('key', 'value');

      expect(gitCommandManager._gitEnv['key']).toBe('value');
    });
  });

  describe('Test removeEnvironmentVariable function', (): void => {
    let GitCommandManagerRealModule: typeof import('../src/git/git-command-manager');

    beforeAll((): void => {
      GitCommandManagerRealModule = jest.requireActual(
        '../src/git/git-command-manager'
      );
    });

    it('should success when removeEnvironmentVariable', async (): Promise<void> => {
      const gitCommandManager: any =
        await GitCommandManagerRealModule.GitCommandManager.create(
          workingDirectory
        );

      gitCommandManager.setEnvironmentVariable('key', 'value');

      const gitEnv: { [p: string]: string } = gitCommandManager.gitEnv;
      expect(gitEnv['key']).toBe('value');

      gitCommandManager.removeEnvironmentVariable('key');

      expect(gitEnv['key']).toBe(undefined);
    });
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
