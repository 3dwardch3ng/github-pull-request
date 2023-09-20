import { IInputs, prepareInputValues } from '../src/inputs';
import {
  createService,
  ICreateOrUpdatePullRequestBranchResult,
  IService,
  Service
} from '../src/service';
import { WorkflowUtils } from '../src/workflow-utils';
import { Pull } from '../src/github-client';
import { GitCommandManager } from '../src/git-command-manager';
import {
  GitSourceSettings,
  IGitSourceSettings
} from '../src/git-source-settings';
import * as core from '@actions/core';
import { IRetryHelper, RetryHelper } from '../src/retry-helper';
import * as RetryHelperWrapper from '../src/retry-helper-wrapper';
import { createRetryHelper } from '../src/retry-helper-wrapper';
import { AnnotationProperties } from '@actions/core';
import { ErrorMessages, WarningMessages } from '../src/message';

/* eslint-disable @typescript-eslint/no-explicit-any */
const infoMock: jest.SpyInstance<void, [message: string]> = jest.spyOn(
  core,
  'info'
);
const warningMock: jest.SpyInstance<
  void,
  [message: string | Error, properties?: AnnotationProperties | undefined]
> = jest.spyOn(core, 'warning');
const startGroupMock: jest.SpyInstance<void, [name: string]> = jest.spyOn(
  core,
  'startGroup'
);
const endGroupMock: jest.SpyInstance<void, []> = jest.spyOn(core, 'endGroup');
const setFailedMock: jest.SpyInstance<void, [message: string | Error]> =
  jest.spyOn(core, 'setFailed');
const getErrorMessageMock: jest.Mock<any, any, any> = jest
  .fn()
  .mockImplementation((error: unknown): string => {
    if (error instanceof Error) return error.message;
    return String(error);
  });
const fileExistsSyncMock: jest.Mock<any, any, any> = jest.fn();
const getRepoPathMock: jest.Mock<any, any, any> = jest.fn();
jest.mock('../src/workflow-utils', () => {
  return {
    ...jest.requireActual('../src/workflow-utils'),
    WorkflowUtils: jest.fn().mockImplementation(() => {
      return {
        getErrorMessage: getErrorMessageMock,
        fileExistsSync: fileExistsSyncMock,
        getRepoPath: getRepoPathMock
      };
    })
  };
});
const gitCommandManagerCreateFunctionMock: jest.Mock<any, any> = jest
  .fn()
  .mockImplementation(async (workingDir: string) => {
    const gitCommandManager: GitCommandManager = new GitCommandManager();
    await gitCommandManager.init(workingDir);
    return gitCommandManager;
  });
const initMock: jest.Mock<any, any, any> = jest.fn();
const getRepoRemoteUrlMock: jest.Mock<any, any, any> = jest.fn();
const getRemoteDetailMock: jest.Mock<any, any, any> = jest.fn();
const getWorkingBaseAndTypeMock: jest.Mock<any, any, any> = jest.fn();
const stashPushMock: jest.Mock<any, any, any> = jest.fn();
const checkoutMock: jest.Mock<any, any, any> = jest.fn();
const pullMock: jest.Mock<any, any, any> = jest.fn();
const fetchMock: jest.Mock<any, any, any> = jest.fn();
const isAheadMock: jest.Mock<any, any, any> = jest.fn();
const revParseMock: jest.Mock<any, any, any> = jest.fn();
const deleteBranchMock: jest.Mock<any, any, any> = jest.fn();
const pushMock: jest.Mock<any, any, any> = jest.fn();
const stashPopMock: jest.Mock<any, any, any> = jest.fn();
const commitsAheadMock: jest.Mock<any, any, any> = jest.fn();
const hasDiffMock: jest.Mock<any, any, any> = jest.fn();
const isEvenMock: jest.Mock<any, any, any> = jest.fn();
const fetchAllMock: jest.Mock<any, any, any> = jest.fn();
const switchMock: jest.Mock<any, any, any> = jest.fn();
jest.mock('../src/git-command-manager', () => {
  return {
    ...jest.requireActual('../src/git-command-manager'),
    GitCommandManager: jest.fn().mockImplementation(() => {
      return {
        init: initMock,
        getRepoRemoteUrl: getRepoRemoteUrlMock,
        getRemoteDetail: getRemoteDetailMock,
        getWorkingBaseAndType: getWorkingBaseAndTypeMock,
        stashPush: stashPushMock,
        checkout: checkoutMock,
        pull: pullMock,
        fetch: fetchMock,
        isAhead: isAheadMock,
        revParse: revParseMock,
        deleteBranch: deleteBranchMock,
        push: pushMock,
        stashPop: stashPopMock,
        commitsAhead: commitsAheadMock,
        hasDiff: hasDiffMock,
        isEven: isEvenMock,
        fetchAll: fetchAllMock,
        switch: switchMock
      };
    })
  };
});
jest.mock('../src/service', () => {
  return {
    createService: jest.fn().mockImplementation((inputs: IInputs) => {
      return new Service(inputs);
    }),
    Service: jest.fn().mockImplementation(() => {
      return {
        createPullRequest: jest.fn(),
        mergePullRequestWithRetries: jest.fn()
      };
    })
  };
});
const preparePullRequestMock: jest.Mock<any, any, any> = jest.fn();
const mergePullRequestMock: jest.Mock<any, any, any> = jest.fn();
jest.mock('../src/github-client', () => {
  return {
    GithubClient: jest.fn().mockImplementation(() => {
      return {
        preparePullRequest: preparePullRequestMock,
        mergePullRequest: mergePullRequestMock
      };
    })
  };
});
const configureAuthMock: jest.Mock<any, any, any> = jest.fn();
const removeAuthMock: jest.Mock<any, any, any> = jest.fn();
jest.mock('../src/git-auth-helper', () => {
  return {
    GitAuthHelper: jest.fn().mockImplementation(() => {
      return {
        configureAuth: configureAuthMock,
        removeAuth: removeAuthMock
      };
    })
  };
});
jest.mock('../src/git-source-settings', () => {
  return {
    GitSourceSettings: jest.fn().mockImplementation(() => {
      return {
        repositoryPath: 'repositoryPath',
        repositoryOwner: 'repositoryOwner',
        repositoryName: 'repositoryName',
        authToken: 'authToken',
        githubServerUrl: undefined,
        workflowOrganizationId: '1234567890',
        sshKey: undefined,
        sshKnownHosts: undefined,
        sshStrict: false,
        persistCredentials: false
      } as IGitSourceSettings;
    })
  };
});
jest.mock('../src/retry-helper-wrapper', () => {
  return {
    ...jest.requireActual('../src/retry-helper-wrapper'),
    executeWithCustomised: jest.fn(),
    createRetryHelper: jest.fn()
  };
});

describe('Test service.ts', (): void => {
  describe('Test createService function', (): void => {
    it('should return a new Service object', (): void => {
      setRequiredProcessEnvValues();
      setOptionalProcessEnvValues();
      const inputs: IInputs = prepareInputValues();

      const service: IService = createService(inputs);

      expect(service).toBeDefined();
      expect(Service).toHaveBeenCalledTimes(1);
      expect(Service).toHaveBeenCalledWith(inputs);
    });
  });

  describe('Test Service class', (): void => {
    const pull: Pull = {
      number: 1,
      sha: 'sha',
      html_url: 'html_url',
      action: 'created',
      created: true,
      merged: false
    } as Pull;
    let ServiceModule: typeof import('../src/service');

    beforeAll((): void => {
      ServiceModule = jest.requireActual('../src/service');
      getRepoPathMock.mockReturnValue('repoPath');
      GitCommandManager.create = gitCommandManagerCreateFunctionMock;
      getRepoRemoteUrlMock.mockReturnValue('repoRemoteUrl');
      getRemoteDetailMock.mockReturnValue({
        hostname: 'www.github.com',
        protocol: 'HTTPS',
        repository: '3dwardch3ng/create-pull-request'
      });
      stashPushMock.mockReturnValue(true);
      revParseMock.mockReturnValue('sha');
      preparePullRequestMock.mockReturnValue(pull);
    });

    describe('Test constructor', (): void => {
      it('should create a new Service object with warning of over sized PR Body message and shortened it', (): void => {
        setRequiredProcessEnvValues();
        setOptionalProcessEnvValues();
        process.env['INPUT_PR_BODY'] = 'x'.repeat(65550);

        const inputs: IInputs = prepareInputValues();

        const service: IService = ServiceModule.createService(inputs);

        expect(warningMock).toHaveBeenCalledTimes(1);
        expect(warningMock).toHaveBeenCalledWith(
          WarningMessages.PR_BODY_TOO_LONG
        );
        expect((service as any).inputs.PR_BODY.length).toEqual(65536);
      });

      it('should throw error if source and target branches are the same', (): void => {
        setRequiredProcessEnvValues();
        setOptionalProcessEnvValues();
        process.env['INPUT_TARGET_BRANCH'] = 'source-branch';

        const inputs: IInputs = prepareInputValues();

        expect(() => ServiceModule.createService(inputs)).toThrow(
          new Error(ErrorMessages.BRANCH_NAME_SAME_ERROR)
        );
      });
    });

    describe('Test createPullRequest function', (): void => {
      it('should success when calling createPullRequest function when PR branch not exists', async (): Promise<void> => {
        getWorkingBaseAndTypeMock.mockReturnValue({
          workingBase: 'develop',
          workingBaseType: 'branch'
        });
        fetchMock.mockReturnValue(false);
        isAheadMock.mockReturnValue(true);

        setRequiredProcessEnvValues();
        setOptionalProcessEnvValues();
        delete process.env['INPUT_REQUIRE_MIDDLE_BRANCH'];
        const inputs: IInputs = prepareInputValues();
        const service: IService = ServiceModule.createService(inputs);

        const result: Pull = await service.createPullRequest();

        expect(getRepoPathMock).toHaveBeenCalledTimes(1);
        expect(gitCommandManagerCreateFunctionMock).toHaveBeenCalledTimes(1);
        expect(GitSourceSettings).toHaveBeenCalledTimes(1);
        expect(infoMock).toHaveBeenCalledTimes(5);
        expect(startGroupMock).toHaveBeenCalledTimes(4);
        expect(endGroupMock).toHaveBeenCalledTimes(4);
        expect(getWorkingBaseAndTypeMock).toHaveBeenCalledTimes(1);
        expect(stashPushMock).toHaveBeenCalledTimes(1);
        expect(fetchAllMock).toHaveBeenCalledTimes(1);
        expect(checkoutMock).toHaveBeenCalledTimes(4);
        expect(pullMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(isAheadMock).toHaveBeenCalledTimes(1);
        expect(revParseMock).toHaveBeenCalledTimes(1);
        expect(deleteBranchMock).toHaveBeenCalledTimes(1);
        expect(pushMock).toHaveBeenCalledTimes(1);
        expect(stashPopMock).toHaveBeenCalledTimes(1);
        expect(preparePullRequestMock).toHaveBeenCalledTimes(1);
        expect(preparePullRequestMock).toHaveBeenCalledWith(inputs, {
          action: 'created',
          sourceBranch: 'source-branch',
          targetBranch: 'target-branch',
          hasDiffWithTargetBranch: true,
          headSha: 'sha'
        } as ICreateOrUpdatePullRequestBranchResult);
        expect(removeAuthMock).toHaveBeenCalledTimes(1);
        expect(result).toEqual(pull);
      });

      it('should success when calling createPullRequest function when PR branch not exists but has no difference with the target branch', async (): Promise<void> => {
        getWorkingBaseAndTypeMock.mockReturnValue({
          workingBase: 'develop',
          workingBaseType: 'branch'
        });
        fetchMock.mockReturnValue(false);
        isAheadMock.mockReturnValue(false);

        setRequiredProcessEnvValues();
        setOptionalProcessEnvValues();
        delete process.env['INPUT_REQUIRE_MIDDLE_BRANCH'];
        const inputs: IInputs = prepareInputValues();
        const service: IService = ServiceModule.createService(inputs);

        const result: Pull = await service.createPullRequest();

        expect(getRepoPathMock).toHaveBeenCalledTimes(1);
        expect(gitCommandManagerCreateFunctionMock).toHaveBeenCalledTimes(1);
        expect(GitSourceSettings).toHaveBeenCalledTimes(1);
        expect(infoMock).toHaveBeenCalledTimes(5);
        expect(startGroupMock).toHaveBeenCalledTimes(1);
        expect(endGroupMock).toHaveBeenCalledTimes(1);
        expect(getWorkingBaseAndTypeMock).toHaveBeenCalledTimes(1);
        expect(stashPushMock).toHaveBeenCalledTimes(1);
        expect(fetchAllMock).toHaveBeenCalledTimes(1);
        expect(checkoutMock).toHaveBeenCalledTimes(4);
        expect(pullMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(isAheadMock).toHaveBeenCalledTimes(1);
        expect(revParseMock).toHaveBeenCalledTimes(1);
        expect(deleteBranchMock).toHaveBeenCalledTimes(1);
        expect(pushMock).toHaveBeenCalledTimes(0);
        expect(stashPopMock).toHaveBeenCalledTimes(1);
        expect(preparePullRequestMock).toHaveBeenCalledTimes(0);
        expect(removeAuthMock).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
          number: 0,
          sha: '',
          html_url: '',
          action: '',
          created: false,
          merged: false
        } as Pull);
      });

      it('should success when calling createPullRequest function when PR branch already exists', async (): Promise<void> => {
        let tempBranchName: string = '';
        getWorkingBaseAndTypeMock.mockReturnValue({
          workingBase: 'sha',
          workingBaseType: 'commit'
        });
        fetchMock.mockReturnValue(true);
        hasDiffMock.mockReturnValue(false);
        commitsAheadMock.mockImplementation(
          (branch1: string, branch2: string) => {
            if (branch1 === 'remote-name/target-branch') {
              if (
                branch2 !== 'source-branch' &&
                !branch2.includes('-merge-to-')
              ) {
                tempBranchName = branch2;
              }
              return 0;
            }
            return 0;
          }
        );
        isEvenMock.mockReturnValue(false);
        isAheadMock.mockReturnValue(true);

        setRequiredProcessEnvValues();
        setOptionalProcessEnvValues();
        const inputs: IInputs = prepareInputValues();
        const service: IService = ServiceModule.createService(inputs);

        const result: Pull = await service.createPullRequest();

        expect(getRepoPathMock).toHaveBeenCalledTimes(1);
        expect(gitCommandManagerCreateFunctionMock).toHaveBeenCalledTimes(1);
        expect(GitSourceSettings).toHaveBeenCalledTimes(1);
        expect(infoMock).toHaveBeenCalledTimes(6);
        expect(startGroupMock).toHaveBeenCalledTimes(4);
        expect(endGroupMock).toHaveBeenCalledTimes(4);
        expect(getWorkingBaseAndTypeMock).toHaveBeenCalledTimes(1);
        expect(stashPushMock).toHaveBeenCalledTimes(1);
        expect(fetchAllMock).toHaveBeenCalledTimes(1);
        expect(checkoutMock).toHaveBeenCalledTimes(5);
        expect(pullMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(isAheadMock).toHaveBeenCalledTimes(1);
        expect(revParseMock).toHaveBeenCalledTimes(1);
        expect(deleteBranchMock).toHaveBeenCalledTimes(1);
        expect(deleteBranchMock).toHaveBeenCalledWith(tempBranchName, [
          '--force'
        ]);
        expect(pushMock).toHaveBeenCalledTimes(1);
        expect(stashPopMock).toHaveBeenCalledTimes(1);
        expect(preparePullRequestMock).toHaveBeenCalledTimes(1);
        expect(preparePullRequestMock).toHaveBeenCalledWith(inputs, {
          action: 'updated',
          sourceBranch: 'source-branch-merge-to-target-branch',
          targetBranch: 'target-branch',
          hasDiffWithTargetBranch: true,
          headSha: 'sha'
        } as ICreateOrUpdatePullRequestBranchResult);
        expect(removeAuthMock).toHaveBeenCalledTimes(1);
        expect(commitsAheadMock).toHaveBeenCalledTimes(2);
        expect(hasDiffMock).toHaveBeenCalledTimes(1);
        expect(isEvenMock).toHaveBeenCalledTimes(1);
        expect(result).toEqual(pull);
      });

      it('should success when calling createPullRequest function when PR branch already exists but no code difference', async (): Promise<void> => {
        let tempBranchName: string = '';
        getWorkingBaseAndTypeMock.mockReturnValue({
          workingBase: 'sha',
          workingBaseType: 'commit'
        });
        fetchMock.mockReturnValue(true);
        hasDiffMock.mockReturnValue(false);
        commitsAheadMock.mockImplementation(
          (branch1: string, branch2: string) => {
            if (branch1 === 'remote-name/target-branch') {
              if (
                branch2 !== 'source-branch' &&
                !branch2.includes('-merge-to-')
              ) {
                tempBranchName = branch2;
              }
              return 0;
            }
            return 0;
          }
        );
        isEvenMock.mockReturnValue(true);
        isAheadMock.mockReturnValue(true);

        setRequiredProcessEnvValues();
        setOptionalProcessEnvValues();
        const inputs: IInputs = prepareInputValues();
        const service: IService = ServiceModule.createService(inputs);

        const result: Pull = await service.createPullRequest();

        expect(getRepoPathMock).toHaveBeenCalledTimes(1);
        expect(gitCommandManagerCreateFunctionMock).toHaveBeenCalledTimes(1);
        expect(GitSourceSettings).toHaveBeenCalledTimes(1);
        expect(infoMock).toHaveBeenCalledTimes(6);
        expect(startGroupMock).toHaveBeenCalledTimes(3);
        expect(endGroupMock).toHaveBeenCalledTimes(3);
        expect(getWorkingBaseAndTypeMock).toHaveBeenCalledTimes(1);
        expect(stashPushMock).toHaveBeenCalledTimes(1);
        expect(fetchAllMock).toHaveBeenCalledTimes(1);
        expect(checkoutMock).toHaveBeenCalledTimes(5);
        expect(pullMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(isAheadMock).toHaveBeenCalledTimes(1);
        expect(revParseMock).toHaveBeenCalledTimes(1);
        expect(deleteBranchMock).toHaveBeenCalledTimes(1);
        expect(deleteBranchMock).toHaveBeenCalledWith(tempBranchName, [
          '--force'
        ]);
        expect(pushMock).toHaveBeenCalledTimes(0);
        expect(stashPopMock).toHaveBeenCalledTimes(1);
        expect(preparePullRequestMock).toHaveBeenCalledTimes(1);
        expect(preparePullRequestMock).toHaveBeenCalledWith(inputs, {
          action: 'not-updated',
          sourceBranch: 'source-branch-merge-to-target-branch',
          targetBranch: 'target-branch',
          hasDiffWithTargetBranch: true,
          headSha: 'sha'
        } as ICreateOrUpdatePullRequestBranchResult);
        expect(removeAuthMock).toHaveBeenCalledTimes(1);
        expect(commitsAheadMock).toHaveBeenCalledTimes(2);
        expect(hasDiffMock).toHaveBeenCalledTimes(1);
        expect(isEvenMock).toHaveBeenCalledTimes(1);
        expect(result).toEqual(pull);
      });

      it('should throw error when calling createPullRequest function when there is an error from the inner logic', async (): Promise<void> => {
        getWorkingBaseAndTypeMock.mockReturnValue({
          workingBase: 'develop',
          workingBaseType: 'branch'
        });
        fetchMock.mockReturnValue(false);
        isAheadMock.mockReturnValue(true);
        const preparePullRequestError: Error = new Error(
          'Error when calling githubClient.preparePullRequest'
        );
        preparePullRequestMock.mockImplementation(() => {
          throw preparePullRequestError;
        });

        setRequiredProcessEnvValues();
        setOptionalProcessEnvValues();
        delete process.env['INPUT_REQUIRE_MIDDLE_BRANCH'];
        const inputs: IInputs = prepareInputValues();
        const service: IService = ServiceModule.createService(inputs);

        await expect(service.createPullRequest()).rejects.toThrow(
          preparePullRequestError
        );

        expect(getRepoPathMock).toHaveBeenCalledTimes(1);
        expect(gitCommandManagerCreateFunctionMock).toHaveBeenCalledTimes(1);
        expect(GitSourceSettings).toHaveBeenCalledTimes(1);
        expect(infoMock).toHaveBeenCalledTimes(5);
        expect(startGroupMock).toHaveBeenCalledTimes(4);
        expect(endGroupMock).toHaveBeenCalledTimes(3);
        expect(getWorkingBaseAndTypeMock).toHaveBeenCalledTimes(1);
        expect(stashPushMock).toHaveBeenCalledTimes(1);
        expect(fetchAllMock).toHaveBeenCalledTimes(1);
        expect(checkoutMock).toHaveBeenCalledTimes(4);
        expect(pullMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(isAheadMock).toHaveBeenCalledTimes(1);
        expect(revParseMock).toHaveBeenCalledTimes(1);
        expect(deleteBranchMock).toHaveBeenCalledTimes(1);
        expect(pushMock).toHaveBeenCalledTimes(1);
        expect(stashPopMock).toHaveBeenCalledTimes(1);
        expect(preparePullRequestMock).toHaveBeenCalledTimes(1);
        expect(removeAuthMock).toHaveBeenCalledTimes(1);
      });
    });

    describe('Test mergePullRequestWithRetries function', (): void => {
      it('should success when calling mergePullRequestWithRetries function', async (): Promise<void> => {
        const mergedPull: Pull = {
          number: 2,
          sha: 'sha1',
          html_url: 'html_url1',
          action: 'merged',
          created: false,
          merged: true
        } as Pull;
        mergePullRequestMock.mockReturnValue(mergedPull);

        setRequiredProcessEnvValues();
        setOptionalProcessEnvValues();
        const inputs: IInputs = prepareInputValues();
        const service: IService = ServiceModule.createService(inputs);

        const result: Pull = await service.mergePullRequestWithRetries(pull);

        expect(infoMock).toHaveBeenCalledTimes(2);
        expect(startGroupMock).toHaveBeenCalledTimes(1);
        expect(mergePullRequestMock).toHaveBeenCalledTimes(1);
        expect(endGroupMock).toHaveBeenCalledTimes(1);
        expect(removeAuthMock).toHaveBeenCalledTimes(1);
        expect(result).toEqual(mergedPull);
      });

      it('should trigger the retry and then fail the action execution when githubClient.mergePullRequest throws the error', async (): Promise<void> => {
        const error: Error = Error(
          'Error when calling githubClient.mergePullRequest'
        );
        mergePullRequestMock.mockImplementation(() => {
          throw error;
        });
        const executeWithCustomisedMock: jest.SpyInstance = jest
          .spyOn(RetryHelperWrapper, 'executeWithCustomised')
          .mockImplementation(
            async (
              maxAttempts: number,
              minSeconds: number | undefined,
              maxSeconds: number | undefined,
              attemptsInterval: number | undefined,
              action: (...vars: unknown[]) => Promise<any>
            ): Promise<any> => {
              const retryHelper: IRetryHelper = createRetryHelper(
                maxAttempts,
                minSeconds,
                maxSeconds,
                attemptsInterval
              );
              return await retryHelper.execute(action);
            }
          );
        const createRetryHelperMock: jest.SpyInstance = jest
          .spyOn(RetryHelperWrapper, 'createRetryHelper')
          .mockImplementation(
            (
              maxAttempts: number,
              minSeconds: number | undefined,
              maxSeconds: number | undefined,
              attemptsInterval: number | undefined
            ): RetryHelper => {
              return new RetryHelper(
                maxAttempts,
                minSeconds,
                maxSeconds,
                attemptsInterval
              );
            }
          );

        setRequiredProcessEnvValues();
        setOptionalProcessEnvValues();
        delete process.env['INPUT_REQUIRE_MIDDLE_BRANCH'];
        const inputs: IInputs = prepareInputValues();
        const service: IService = ServiceModule.createService(inputs);

        await expect(service.mergePullRequestWithRetries(pull)).rejects.toThrow(
          error
        );

        expect(infoMock).toHaveBeenCalledTimes(7);
        expect(startGroupMock).toHaveBeenCalledTimes(4);
        expect(mergePullRequestMock).toHaveBeenCalledTimes(4);
        expect(endGroupMock).toHaveBeenCalledTimes(0);
        expect(executeWithCustomisedMock).toHaveBeenCalledTimes(1);
        expect(createRetryHelperMock).toHaveBeenCalledTimes(1);
        expect(WorkflowUtils).toHaveBeenCalledTimes(2);
        expect(setFailedMock).toHaveBeenCalledTimes(4);
        expect(removeAuthMock).toHaveBeenCalledTimes(1);
      });

      it('should success but trigger the retry and then fail the action execution when githubClient.mergePullRequest throws the error on for the first time', async (): Promise<void> => {
        const mergedPull: Pull = {
          number: 2,
          sha: 'sha1',
          html_url: 'html_url1',
          action: 'merged',
          created: false,
          merged: true
        } as Pull;
        const error: Error = Error(
          'Error when calling githubClient.mergePullRequest'
        );
        mergePullRequestMock.mockImplementationOnce(() => {
          throw error;
        });
        mergePullRequestMock.mockImplementationOnce(() => {
          return mergedPull;
        });
        const executeWithCustomisedMock: jest.SpyInstance = jest
          .spyOn(RetryHelperWrapper, 'executeWithCustomised')
          .mockImplementation(
            async (
              maxAttempts: number,
              minSeconds: number | undefined,
              maxSeconds: number | undefined,
              attemptsInterval: number | undefined,
              action: (...vars: unknown[]) => Promise<any>
            ): Promise<any> => {
              const retryHelper: IRetryHelper = createRetryHelper(
                maxAttempts,
                minSeconds,
                maxSeconds,
                attemptsInterval
              );
              return await retryHelper.execute(action);
            }
          );
        const createRetryHelperMock: jest.SpyInstance = jest
          .spyOn(RetryHelperWrapper, 'createRetryHelper')
          .mockImplementation(
            (
              maxAttempts: number,
              minSeconds: number | undefined,
              maxSeconds: number | undefined,
              attemptsInterval: number | undefined
            ): RetryHelper => {
              return new RetryHelper(
                maxAttempts,
                minSeconds,
                maxSeconds,
                attemptsInterval
              );
            }
          );

        setRequiredProcessEnvValues();
        setOptionalProcessEnvValues();
        delete process.env['INPUT_REQUIRE_MIDDLE_BRANCH'];
        const inputs: IInputs = prepareInputValues();
        const service: IService = ServiceModule.createService(inputs);

        const result: Pull = await service.mergePullRequestWithRetries(pull);

        expect(infoMock).toHaveBeenCalledTimes(2);
        expect(startGroupMock).toHaveBeenCalledTimes(2);
        expect(mergePullRequestMock).toHaveBeenCalledTimes(2);
        expect(endGroupMock).toHaveBeenCalledTimes(1);
        expect(executeWithCustomisedMock).toHaveBeenCalledTimes(1);
        expect(createRetryHelperMock).toHaveBeenCalledTimes(1);
        expect(WorkflowUtils).toHaveBeenCalledTimes(2);
        expect(setFailedMock).toHaveBeenCalledTimes(1);
        expect(removeAuthMock).toHaveBeenCalledTimes(1);
        expect(result).toEqual(mergedPull);
      });
    });
  });
});

function setRequiredProcessEnvValues(): void {
  process.env['INPUT_GITHUB_TOKEN'] = 'github-token';
  process.env['INPUT_REPO_OWNER'] = '3dwardch3ng';
  process.env['INPUT_REPO_NAME'] = 'github-pull-request';
  process.env['INPUT_SOURCE_BRANCH'] = 'source-branch';
  process.env['INPUT_TARGET_BRANCH'] = 'target-branch';
  process.env['INPUT_PR_TITLE'] = 'pr-title';
}

function setOptionalProcessEnvValues(): void {
  process.env['INPUT_REMOTE_NAME'] = 'remote-name';
  process.env['INPUT_PR_BODY'] = 'pr-body';
  process.env['INPUT_DRAFT'] = 'true';
  process.env['INPUT_REQUIRE_MIDDLE_BRANCH'] = 'true';
  process.env['INPUT_AUTO_MERGE'] = 'true';
  process.env['INPUT_MAX_MERGE_RETRIES'] = '3';
  process.env['INPUT_MERGE_RETRY_INTERVAL'] = '1';
  process.env['INPUT_MILESTONE'] = '2';
  process.env['INPUT_ASSIGNEES'] = '3dwardch3ng';
  process.env['INPUT_REVIEWERS'] = '3dwardch3ng';
  process.env['INPUT_TEAM_REVIEWERS'] = '3dwardch3ng';
  process.env['INPUT_LABELS'] = 'label';
  process.env['INPUT_SIGNOFF'] = 'true';
  process.env['INPUT_MERGE_METHOD'] = 'squash';
}
/* eslint-enable @typescript-eslint/no-explicit-any */
