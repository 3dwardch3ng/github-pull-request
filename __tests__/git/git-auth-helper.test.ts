import * as core from '@actions/core';
import * as io from '@actions/io';
import * as exec from '@actions/exec';
import {
  createGitCommandManager,
  GitCommandManager,
  IGitCommandManager
} from '../../src/git/git-command-manager';
import {
  GitSourceSettings,
  IGitSourceSettings
} from '../../src/git/git-source-settings';
import {
  createGitAuthHelper,
  IGitAuthHelper
} from '../../src/git/git-auth-helper';
import * as assert from 'assert';
import * as os from 'os';
import { PathLike } from 'fs';
import promises, { FileHandle } from 'fs/promises';
import path from 'path';

/* eslint-disable @typescript-eslint/no-explicit-any */
const repositoryPath: string = 'repositoryPath';
const repositoryOwner: string = 'repositoryOwner';
const repositoryName: string = 'repositoryName';
const authToken: string = 'authToken';
const gitSourceSettings: IGitSourceSettings = new GitSourceSettings(
  repositoryPath,
  repositoryOwner,
  repositoryName,
  false,
  false,
  false,
  authToken,
  undefined,
  '1234567890',
  undefined,
  undefined,
  false,
  false
);

const infoSpy: jest.SpyInstance<void, [message: string]> = jest.spyOn(
  core,
  'info'
);
const debugSpy: jest.SpyInstance<void, [message: string]> = jest.spyOn(
  core,
  'debug'
);
const warningSpy: jest.SpyInstance<void> = jest.spyOn(core, 'warning');
const setSecretSpy: jest.SpyInstance<any, any> = jest.spyOn(core, 'setSecret');
const saveStateSpy: jest.SpyInstance<any, any> = jest.spyOn(core, 'saveState');
const getStateSpy: jest.SpyInstance<any, any> = jest.spyOn(core, 'getState');
const configExistsMock: jest.Mock<any, any, any> = jest
  .fn()
  .mockImplementation(async (): Promise<boolean> => {
    return Promise.resolve(true);
  });
const unsetConfigMock: jest.Mock<any, any, any> = jest
  .fn()
  .mockImplementation(async (): Promise<boolean> => {
    return Promise.resolve(true);
  });
const configMock: jest.Mock<any, any, any> = jest
  .fn()
  .mockImplementation(async (): Promise<void> => {
    return Promise.resolve();
  });
const setEnvironmentVariableMock: jest.Mock<any, any, any> = jest
  .fn()
  .mockImplementation((): void => {});
const gitCommandManagerMock: GitCommandManager = {
  ...jest.requireActual('../../src/git/git-command-manager').GitCommandManager,
  config: configMock,
  configExists: configExistsMock,
  unsetConfig: unsetConfigMock,
  getGitDirectory: jest.fn(),
  setEnvironmentVariable: setEnvironmentVariableMock,
  init: jest.fn()
} as GitCommandManager;
jest.mock('../../src/git/git-command-manager', () => {
  return {
    GitCommandManager: jest.fn().mockImplementation(() => {
      return gitCommandManagerMock;
    }),
    createGitCommandManager: jest.fn().mockImplementation(async () => {
      return Promise.resolve(gitCommandManagerMock);
    })
  };
});
const gitConfigContent: string = `[core]
  \trepositoryformatversion = 0
  \tfilemode = true
  \tbare = false
  \tlogallrefupdates = true
  \tignorecase = true
  \tprecomposeunicode = true
  \thttp.https://github.com/.extraheader = AUTHORIZATION: basic ***
  [remote "origin"]
  \turl = https://github.com/3dwardCh3nG/github-pull-request.git
  \tfetch = +refs/heads/*:refs/remotes/origin/*
  [branch "main"]
  \tremote = origin
  \tmerge = refs/heads/main`;
const buffer: Buffer = Buffer.from(gitConfigContent);
jest.mock('fs/promises', () => {
  return {
    ...jest.requireActual('fs/promises'),
    readFile: jest
      .fn()
      .mockImplementation(
        async (filePath: PathLike | FileHandle): Promise<Buffer | string> => {
          if (filePath === '/.git/config') {
            return Promise.resolve(buffer);
          } else if (filePath === '/home/runner/.ssh/known_hosts') {
            return Promise.resolve('127.0.0.1');
          }
          return Promise.resolve('');
        }
      ),
    writeFile: jest.fn(),
    mkdir: jest.fn()
  };
});
const readFileSpy: jest.SpyInstance = jest.spyOn(promises, 'readFile');
const writeFileSpy: jest.SpyInstance = jest.spyOn(promises, 'writeFile');
const mkdirSpy: jest.SpyInstance = jest.spyOn(promises, 'mkdir');
jest.mock('assert', () => {
  return {
    ...jest.requireActual('assert'),
    ok: jest.fn().mockImplementation((): any => {})
  };
});
jest.mock('@actions/io', () => {
  return {
    ...jest.requireActual('@actions/io'),
    rmRF: jest.fn(),
    which: jest.fn()
  };
});
jest.mock('os');
jest.mock('path', () => {
  return {
    ...jest.requireActual('path'),
    join: jest.fn()
  };
});

describe('Test git-auth-helper.ts', (): void => {
  let gitCommanderManager: IGitCommandManager;

  beforeAll(async (): Promise<void> => {
    gitCommanderManager = await createGitCommandManager(
      repositoryPath,
      false,
      false
    );
  });

  describe('Test constructor', (): void => {
    afterAll((): void => {
      delete process.env['GITHUB_SERVER_URL'];
    });

    it('should create an instance with initialised values', (): void => {
      const basicCredential: string = Buffer.from(
        `x-access-token:${authToken}`,
        'utf8'
      ).toString('base64');

      const gitAuthHelper: IGitAuthHelper = createGitAuthHelper(
        gitCommanderManager,
        gitSourceSettings
      );
      expect(gitAuthHelper).toBeDefined();
      expect(gitAuthHelper.tokenConfigKey).toEqual(
        'http.https://github.com/.extraheader'
      );
      expect(setSecretSpy).toHaveBeenCalledTimes(1);
      expect(setSecretSpy).toHaveBeenCalledWith(basicCredential);
      expect(gitAuthHelper.tokenConfigValue).toEqual(
        `AUTHORIZATION: basic ${basicCredential}`
      );
      expect(gitAuthHelper.insteadOfKey).toEqual(
        `url.https://github.com/.insteadOf`
      );
      expect(gitAuthHelper.insteadOfValues).toEqual([
        'git@git.com:',
        'org-1234567890@git.com:'
      ]);
    });

    it('should create an instance with initialised values without having server url in settings', (): void => {
      const githubServerUrl: string = 'https://github.com.au';
      process.env['GITHUB_SERVER_URL'] = githubServerUrl;

      const gitAuthHelper: IGitAuthHelper = createGitAuthHelper(
        gitCommanderManager,
        gitSourceSettings
      );

      expect(gitAuthHelper).toBeDefined();
      expect(gitAuthHelper.tokenConfigKey).toEqual(
        'http.https://github.com.au/.extraheader'
      );
    });
  });

  describe('Test configureAuth function', (): void => {
    let whichMock: jest.SpyInstance;
    let pathJoinMock: jest.SpyInstance;
    let assertOkSpy: jest.SpyInstance<any, any>;

    function pathJoinFuncMock(...paths: string[]): string {
      return paths.join('/');
    }

    beforeEach((): void => {
      jest.spyOn(io, 'rmRF').mockImplementation(async (): Promise<void> => {});
      whichMock = jest
        .spyOn(io, 'which')
        .mockImplementation(
          async (tool: string, check?: boolean): Promise<string> => {
            if (tool === 'ssh' && check) {
              return Promise.resolve('/usr/bin/ssh');
            } else if (tool === 'git' && check) {
              return Promise.resolve('/usr/bin/git');
            } else if (tool === 'icacls.exe' && check === undefined) {
              return Promise.resolve('C:\\Windows\\System32\\icacls.exe');
            }
            return Promise.resolve('');
          }
        );
      jest.spyOn(os, 'homedir').mockReturnValue('/home/runner');
      pathJoinMock = jest
        .spyOn(path, 'join')
        .mockImplementation(pathJoinFuncMock);
      assertOkSpy = jest.spyOn(assert, 'ok');
    });

    afterEach((): void => {
      jest.resetModules();
    });

    it('should call removeToken and configureToken and success', async (): Promise<void> => {
      const gitAuthHelper: IGitAuthHelper = createGitAuthHelper(
        gitCommanderManager,
        gitSourceSettings
      );

      await gitAuthHelper.configureAuth();

      expect(configExistsMock).toHaveBeenCalledTimes(2);
      expect(configExistsMock).toHaveBeenCalledWith('core.sshCommand');
      expect(configExistsMock).toHaveBeenCalledWith(
        'http.https://github.com/.extraheader'
      );
      expect(unsetConfigMock).toHaveBeenCalledTimes(2);
      expect(unsetConfigMock).toHaveBeenCalledWith('core.sshCommand');
      expect(unsetConfigMock).toHaveBeenCalledWith(
        'http.https://github.com/.extraheader'
      );
      expect(configMock).toHaveBeenCalledTimes(1);
      expect(configMock).toHaveBeenCalledWith(
        'http.https://github.com/.extraheader',
        `AUTHORIZATION: basic ***`,
        undefined
      );
      expect(assertOkSpy).toHaveBeenCalledTimes(3);
    });

    it('should call additional removeSsh and configureSsh and success', async (): Promise<void> => {
      const basicCredential: string = Buffer.from(
        `x-access-token:${authToken}`,
        'utf8'
      ).toString('base64');

      const runnerTemp: string = '/usr/bin';
      process.env['RUNNER_TEMP'] = runnerTemp;

      const githubServerUrl: string = 'https://www.github.com.au';
      const sshKey: string = 'sshKey';
      const sshKnownHosts: string = 'sshKnownHosts';
      const sshStrict: boolean = true;
      const persistCredentials: boolean = true;
      const gitSourceSettingsOverride: IGitSourceSettings =
        new GitSourceSettings(
          repositoryPath,
          repositoryOwner,
          repositoryName,
          false,
          false,
          false,
          authToken,
          githubServerUrl,
          '1234567890',
          sshKey,
          sshKnownHosts,
          sshStrict,
          persistCredentials
        );

      const gitAuthHelper: IGitAuthHelper = createGitAuthHelper(
        gitCommanderManager,
        gitSourceSettingsOverride
      );

      await gitAuthHelper.configureAuth();

      const sshKeyPath: string = gitAuthHelper.sshKeyPath;
      const slashIndex: number = sshKeyPath.lastIndexOf('/');
      const uuid4: string = sshKeyPath.substring(slashIndex + 1);
      const sshKnownHostsPath: string = `/usr/bin/${uuid4}_known_hosts`;
      const sshKeyPathBaseName: string = path.basename(
        gitAuthHelper.sshKeyPath
      );
      const sshKnownHostsPathBaseName: string = path.basename(
        gitAuthHelper.sshKnownHostsPath
      );
      let sshCommand: string = `"/usr/bin/ssh" -i "$RUNNER_TEMP/${sshKeyPathBaseName}"`;
      sshCommand += ' -o StrictHostKeyChecking=yes -o CheckHostIP=no';
      sshCommand += ` -o "UserKnownHostsFile=$RUNNER_TEMP/${sshKnownHostsPathBaseName}"`;

      // removeAuth()
      expect(configExistsMock).toHaveBeenCalledTimes(2);
      expect(configExistsMock).toHaveBeenCalledWith('core.sshCommand');
      expect(configExistsMock).toHaveBeenCalledWith(
        'http.https://www.github.com.au/.extraheader'
      );
      expect(unsetConfigMock).toHaveBeenCalledTimes(2);
      expect(unsetConfigMock).toHaveBeenCalledWith('core.sshCommand');
      expect(unsetConfigMock).toHaveBeenCalledWith(
        'http.https://www.github.com.au/.extraheader'
      );
      // configureSsh()
      expect(assertOkSpy).toHaveBeenCalledTimes(4);
      expect(assertOkSpy).toHaveBeenCalledWith(
        runnerTemp,
        'RUNNER_TEMP is not defined'
      );
      expect(assertOkSpy).toHaveBeenCalledWith(
        true,
        'Unexpected configureToken parameter combinations'
      );
      expect(assertOkSpy).toHaveBeenCalledWith(
        '/.git/config',
        'configPath is not defined'
      );
      expect(assertOkSpy).toHaveBeenCalledWith(
        `AUTHORIZATION: basic ${basicCredential}`,
        'tokenConfigValue is not defined'
      );
      expect(pathJoinMock).toHaveBeenCalledTimes(4);
      expect(pathJoinMock).toHaveBeenCalledWith(runnerTemp, uuid4);
      expect(pathJoinMock).toHaveBeenCalledWith(
        '/home/runner',
        '.ssh',
        'known_hosts'
      );
      expect(pathJoinMock).toHaveBeenCalledWith(
        runnerTemp,
        `${uuid4}_known_hosts`
      );
      expect(pathJoinMock).toHaveBeenCalledWith(undefined, '.git', 'config');
      expect(saveStateSpy).toHaveBeenCalledTimes(2);
      expect(saveStateSpy).toHaveBeenCalledWith('sshKeyPath', sshKeyPath);
      expect(saveStateSpy).toHaveBeenCalledWith(
        'sshKnownHostsPath',
        sshKnownHostsPath
      );
      expect(gitAuthHelper.sshKnownHostsPath).toEqual(sshKnownHostsPath);
      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledWith(
        `Temporarily overriding GIT_SSH_COMMAND=${sshCommand}`
      );
      expect(setEnvironmentVariableMock).toHaveBeenCalledTimes(1);
      expect(setEnvironmentVariableMock).toHaveBeenCalledWith(
        `GIT_SSH_COMMAND`,
        sshCommand
      );
      expect(configMock).toHaveBeenCalledTimes(2);
      expect(configMock).toHaveBeenCalledWith('core.sshCommand', sshCommand);
      expect(configMock).toHaveBeenCalledWith(
        'http.https://www.github.com.au/.extraheader',
        'AUTHORIZATION: basic ***',
        undefined
      );
      // configureToken()
    });

    it('when IS_WINDOWS is true and success', async (): Promise<void> => {
      process.env['USERDOMAIN'] = 'userdomain';
      process.env['USERNAME'] = 'username';
      const rmRFMock: jest.SpyInstance<
        Promise<void>,
        [inputPath: string]
      > = jest
        .spyOn(io, 'rmRF')
        .mockImplementation(async (inputPath: string): Promise<void> => {
          if (inputPath === '/usr/bin/sshKeyPath') {
            throw new Error('Test remove ssh key error');
          } else {
            return Promise.resolve();
          }
        });
      unsetConfigMock.mockImplementation(
        async (configKey: string): Promise<boolean> => {
          if (configKey === 'core.sshCommand') {
            return Promise.resolve(false);
          } else {
            return Promise.resolve(true);
          }
        }
      );
      getStateSpy.mockImplementation((key: string): string => {
        if (key === 'sshKnownHostsPath') {
          return '/usr/bin/30d7c7dd-da82-4242-91d4-33862a40d68d_known_hosts';
        }
        return '';
      });

      const sshKey: string = 'sshKey';
      const sshKnownHosts: string = 'sshKnownHosts';
      const sshStrict: boolean = true;
      const persistCredentials: boolean = true;
      const gitSourceSettingsOverride: IGitSourceSettings =
        new GitSourceSettings(
          repositoryPath,
          repositoryOwner,
          repositoryName,
          false,
          false,
          false,
          authToken,
          undefined,
          '1234567890',
          sshKey,
          sshKnownHosts,
          sshStrict,
          persistCredentials
        );

      const gitAuthHelper: IGitAuthHelper = createGitAuthHelper(
        gitCommanderManager,
        gitSourceSettingsOverride
      );
      jest
        .spyOn(gitAuthHelper, 'sshKeyPath', 'get')
        .mockReturnValue('/usr/bin/sshKeyPath');
      const execMock: jest.SpyInstance<any, any> = jest
        .spyOn(exec, 'exec')
        .mockImplementation(async (): Promise<number> => {
          return Promise.resolve(0);
        });

      await gitAuthHelper.configureAuth();

      // removeSsh()
      expect(rmRFMock).toHaveBeenCalledTimes(2);
      expect(rmRFMock).toHaveBeenCalledWith('/usr/bin/sshKeyPath');
      expect(rmRFMock).toHaveBeenCalledWith(
        '/usr/bin/30d7c7dd-da82-4242-91d4-33862a40d68d_known_hosts'
      );
      expect(debugSpy).toHaveBeenCalledTimes(2);
      expect(debugSpy).toHaveBeenCalledWith('Test remove ssh key error');
      expect(debugSpy).toHaveBeenCalledWith('Server URL: "https://github.com"');
      expect(warningSpy).toHaveBeenCalledTimes(2);
      expect(warningSpy).toHaveBeenCalledWith(
        "Failed to remove SSH key '/usr/bin/sshKeyPath'"
      );
      expect(warningSpy).toHaveBeenCalledWith(
        "Failed to remove 'core.sshCommand' from the git config"
      );
      expect(getStateSpy).toHaveBeenCalledTimes(1);
      expect(getStateSpy).toHaveBeenCalledWith('sshKnownHostsPath');
      expect(whichMock).toHaveBeenCalledTimes(2);
      expect(whichMock).toHaveBeenCalledWith('icacls.exe');
      expect(whichMock).toHaveBeenCalledWith('ssh', true);
      expect(execMock).toHaveBeenCalledTimes(2);
      expect(execMock).toHaveBeenCalledWith(
        '"C:\\Windows\\System32\\icacls.exe" "/usr/bin/sshKeyPath" /grant:r "userdomain\\username:F"'
      );
      expect(execMock).toHaveBeenCalledWith(
        '"C:\\Windows\\System32\\icacls.exe" "/usr/bin/sshKeyPath" /inheritance:r'
      );
    });

    it('when git config value is empty, Error should be thrown', async (): Promise<void> => {
      jest
        .spyOn(promises, 'readFile')
        .mockImplementation(
          async (filePath: PathLike | FileHandle): Promise<Buffer | string> => {
            if (filePath === '/.git/config') {
              return Promise.resolve('');
            } else if (filePath === '/home/runner/.ssh/known_hosts') {
              return Promise.resolve('127.0.0.1');
            }
            return Promise.resolve('');
          }
        );
      unsetConfigMock.mockImplementation(async (): Promise<boolean> => {
        return Promise.resolve(true);
      });
      getStateSpy.mockImplementation((key: string): string => {
        if (key === 'sshKnownHostsPath') {
          return '/usr/bin/30d7c7dd-da82-4242-91d4-33862a40d68d_known_hosts';
        }
        return '';
      });
      const rmRFMock: jest.SpyInstance<
        Promise<void>,
        [inputPath: string]
      > = jest
        .spyOn(io, 'rmRF')
        .mockImplementation(async (inputPath: string): Promise<void> => {
          if (inputPath === '/usr/bin/sshKeyPath') {
            /* eslint-disable-next-line no-throw-literal */
            throw 'rmRF string error';
          } else {
            return Promise.resolve();
          }
        });

      const sshKey: string = 'sshKey';
      const sshKnownHosts: string = 'sshKnownHosts';
      const sshStrict: boolean = true;
      const persistCredentials: boolean = true;
      const gitSourceSettingsOverride: IGitSourceSettings =
        new GitSourceSettings(
          repositoryPath,
          repositoryOwner,
          repositoryName,
          false,
          false,
          false,
          authToken,
          undefined,
          '1234567890',
          sshKey,
          sshKnownHosts,
          sshStrict,
          persistCredentials
        );

      const gitAuthHelper: IGitAuthHelper = createGitAuthHelper(
        gitCommanderManager,
        gitSourceSettingsOverride
      );
      jest
        .spyOn(gitAuthHelper, 'sshKeyPath', 'get')
        .mockReturnValue('/usr/bin/sshKeyPath');

      await expect(gitAuthHelper.configureAuth()).rejects.toThrow(
        new Error('Unable to replace auth placeholder in /.git/config')
      );

      expect(rmRFMock).toHaveBeenCalledTimes(2);
      expect(configExistsMock).toHaveBeenCalledTimes(2);
      expect(unsetConfigMock).toHaveBeenCalledTimes(2);
      expect(warningSpy).toHaveBeenCalledTimes(1);
      expect(mkdirSpy).toHaveBeenCalledTimes(1);
      expect(writeFileSpy).toHaveBeenCalledTimes(2);
      expect(readFileSpy).toHaveBeenCalledTimes(2);
    });

    it('when readFile of userKnownHostPath throw issue of ENOENT, Error should NOT be thrown', async (): Promise<void> => {
      jest
        .spyOn(promises, 'readFile')
        .mockImplementation(
          async (filePath: PathLike | FileHandle): Promise<Buffer | string> => {
            if (filePath === '/.git/config') {
              return Promise.resolve(buffer);
            } else if (filePath === '/home/runner/.ssh/known_hosts') {
              /* eslint-disable-next-line no-throw-literal */
              throw { code: 'ENOENT' };
            }
            return Promise.resolve('');
          }
        );
      unsetConfigMock.mockImplementation(async (): Promise<boolean> => {
        return Promise.resolve(true);
      });
      getStateSpy.mockImplementation((): string => {
        return '';
      });
      const rmRFMock: jest.SpyInstance<
        Promise<void>,
        [inputPath: string]
      > = jest.spyOn(io, 'rmRF').mockImplementation(async (): Promise<void> => {
        return Promise.resolve();
      });

      const sshKey: string = 'sshKey';
      const sshKnownHosts: string = 'sshKnownHosts';
      const sshStrict: boolean = true;
      const persistCredentials: boolean = true;
      const gitSourceSettingsOverride: IGitSourceSettings =
        new GitSourceSettings(
          repositoryPath,
          repositoryOwner,
          repositoryName,
          false,
          false,
          false,
          authToken,
          undefined,
          '1234567890',
          sshKey,
          sshKnownHosts,
          sshStrict,
          persistCredentials
        );

      const gitAuthHelper: IGitAuthHelper = createGitAuthHelper(
        gitCommanderManager,
        gitSourceSettingsOverride
      );
      jest
        .spyOn(gitAuthHelper, 'sshKeyPath', 'get')
        .mockReturnValue('/usr/bin/sshKeyPath');

      await gitAuthHelper.configureAuth();

      expect(rmRFMock).toHaveBeenCalledTimes(1);
      expect(configExistsMock).toHaveBeenCalledTimes(2);
      expect(unsetConfigMock).toHaveBeenCalledTimes(2);
      expect(mkdirSpy).toHaveBeenCalledTimes(1);
      expect(writeFileSpy).toHaveBeenCalledTimes(3);
      expect(readFileSpy).toHaveBeenCalledTimes(2);
    });

    it('when readFile of userKnownHostPath throw an issue of non-ENOENT, Error should be thrown', async (): Promise<void> => {
      jest
        .spyOn(promises, 'readFile')
        .mockImplementation(
          async (filePath: PathLike | FileHandle): Promise<Buffer | string> => {
            if (filePath === '/.git/config') {
              return Promise.resolve(buffer);
            } else if (filePath === '/home/runner/.ssh/known_hosts') {
              throw new Error('non-ENOENT error message');
            }
            return Promise.resolve('');
          }
        );
      unsetConfigMock.mockImplementation(async (): Promise<boolean> => {
        return Promise.resolve(true);
      });
      getStateSpy.mockImplementation((): string => {
        return '';
      });
      const rmRFMock: jest.SpyInstance<
        Promise<void>,
        [inputPath: string]
      > = jest.spyOn(io, 'rmRF').mockImplementation(async (): Promise<void> => {
        return Promise.resolve();
      });

      const sshKey: string = 'sshKey';
      const sshKnownHosts: string = 'sshKnownHosts';
      const sshStrict: boolean = true;
      const persistCredentials: boolean = true;
      const gitSourceSettingsOverride: IGitSourceSettings =
        new GitSourceSettings(
          repositoryPath,
          repositoryOwner,
          repositoryName,
          false,
          false,
          false,
          authToken,
          undefined,
          '1234567890',
          sshKey,
          sshKnownHosts,
          sshStrict,
          persistCredentials
        );

      const gitAuthHelper: IGitAuthHelper = createGitAuthHelper(
        gitCommanderManager,
        gitSourceSettingsOverride
      );
      jest
        .spyOn(gitAuthHelper, 'sshKeyPath', 'get')
        .mockReturnValue('/usr/bin/sshKeyPath');

      await expect(gitAuthHelper.configureAuth()).rejects.toThrow(
        new Error('non-ENOENT error message')
      );

      expect(rmRFMock).toHaveBeenCalledTimes(1);
      expect(configExistsMock).toHaveBeenCalledTimes(2);
      expect(unsetConfigMock).toHaveBeenCalledTimes(2);
      expect(mkdirSpy).toHaveBeenCalledTimes(1);
      expect(writeFileSpy).toHaveBeenCalledTimes(1);
      expect(readFileSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test configureToken function', (): void => {
    it('should call removeToken and configureToken and success', async (): Promise<void> => {
      const gitAuthHelper: any = createGitAuthHelper(
        gitCommanderManager,
        gitSourceSettings
      );

      await expect(() =>
        gitAuthHelper.configureToken('configPath', true)
      ).rejects.toThrow(
        new Error('Unable to replace auth placeholder in configPath')
      );

      const assertOkSpy: jest.SpyInstance<any, any> = jest.spyOn(assert, 'ok');
      expect(assertOkSpy).toHaveBeenCalledTimes(2);
    });
  });
});
/* eslint-enable @typescript-eslint/no-explicit-any */
