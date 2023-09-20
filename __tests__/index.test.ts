import * as core from '@actions/core';
import * as index from '../src/index';
import * as inputs from '../src/inputs';
import { IInputs } from '../src/inputs';
import * as service from '../src/service';
import * as github from '../src/github-client';
import { Pull } from '../src/github-client';

/* eslint-disable @typescript-eslint/no-explicit-any */
const setOutputMock: jest.SpyInstance<
  void,
  [message: string, value: any],
  unknown
> = jest.spyOn(core, 'setOutput');
const setFailedMock: jest.SpyInstance<
  void,
  [message: string | Error],
  unknown
> = jest.spyOn(core, 'setFailed');
const startGroupMock: jest.SpyInstance<void, [message: string], unknown> =
  jest.spyOn(core, 'startGroup');
const endGroupMock: jest.SpyInstance<void, [], unknown> = jest.spyOn(
  core,
  'endGroup'
);
const prepareInputValuesMock: jest.SpyInstance<IInputs, [], unknown> =
  jest.spyOn(inputs, 'prepareInputValues');
let createServiceMock: jest.SpyInstance<service.IService, [IInputs]>;

const createPullRequestFunc: jest.Mock<any, any, any> = jest.fn();
const createPullRequestMock: jest.SpyInstance<
  void,
  [message: string, value: any],
  any
> = createPullRequestFunc.mockImplementation(async (): Promise<github.Pull> => {
  return {
    number: 1,
    sha: 'sha',
    html_url: 'url',
    action: 'created',
    created: true,
    merged: false
  } as github.Pull;
});

const createPullRequestThrowErrorFunc: jest.Mock<any, any, any> = jest.fn();
const createPullRequestThrowErrorMock: jest.SpyInstance<
  void,
  [message: string, value: any],
  any
> = createPullRequestThrowErrorFunc.mockImplementation(
  async (): Promise<github.Pull> => {
    throw new Error('test error');
  }
);
const mergePullRequestWithRetriesFunc: jest.Mock<any, any, any> = jest.fn();
const mergePullRequestWithRetriesMock: jest.SpyInstance<
  void,
  [message: string, value: any],
  any
> = mergePullRequestWithRetriesFunc.mockImplementation(
  async (pullRequest: Pull): Promise<Pull> => {
    return Promise.resolve(pullRequest);
  }
);

const mergePullRequestWithRetriesThrowErrorFunc: jest.Mock<any, any, any> =
  jest.fn();
const mergePullRequestWithRetriesThrowErrorMock: jest.SpyInstance<
  void,
  [message: string, value: any],
  any
> = mergePullRequestWithRetriesThrowErrorFunc.mockImplementation(
  async (): Promise<Pull> => {
    throw new Error('test error');
  }
);
/* eslint-enable */

describe('Test index.ts', (): void => {
  describe('Test run function', (): void => {
    it('should call createPullRequest only when AUTO_MERGE is false', async (): Promise<void> => {
      createServiceMock = jest
        .spyOn(service, 'createService')
        .mockImplementation(
          (i: IInputs): service.IService => createService(i, false, false)
        );

      prepareInputValuesMock.mockImplementation(() =>
        getInputsWithAutoMergeValues(false)
      );

      await index.run();

      verifyMocks();
      expect(startGroupMock).toHaveBeenCalledTimes(2);
      expect(endGroupMock).toHaveBeenCalledTimes(2);
      expect(mergePullRequestWithRetriesMock).toHaveBeenCalledTimes(0);
    });

    it('should call createPullRequest and mergePullRequestWithRetries only when AUTO_MERGE is true', async (): Promise<void> => {
      createServiceMock = jest
        .spyOn(service, 'createService')
        .mockImplementation(
          (i: IInputs): service.IService => createService(i, false, false)
        );

      prepareInputValuesMock.mockImplementation(() =>
        getInputsWithAutoMergeValues(true)
      );

      await index.run();

      verifyMocks();
      expect(startGroupMock).toHaveBeenCalledTimes(3);
      expect(endGroupMock).toHaveBeenCalledTimes(3);
      expect(mergePullRequestWithRetriesMock).toHaveBeenCalledTimes(1);
    });

    it('should throw error when createPullRequest throws error', async (): Promise<void> => {
      createServiceMock = jest
        .spyOn(service, 'createService')
        .mockImplementation(
          (i: IInputs): service.IService => createService(i, true, true)
        );

      prepareInputValuesMock.mockImplementation(() =>
        getInputsWithAutoMergeValues(false)
      );

      await index.run();

      verifyMocksWithError();
      expect(startGroupMock).toHaveBeenCalledTimes(1);
      expect(createPullRequestMock).toHaveBeenCalledTimes(0);
      expect(createPullRequestThrowErrorMock).toHaveBeenCalledTimes(1);
      expect(mergePullRequestWithRetriesMock).toHaveBeenCalledTimes(0);
      expect(mergePullRequestWithRetriesThrowErrorMock).toHaveBeenCalledTimes(
        0
      );
    });

    it('should throw error when mergePullRequestWithRetries throws error', async (): Promise<void> => {
      createServiceMock = jest
        .spyOn(service, 'createService')
        .mockImplementation(
          (i: IInputs): service.IService => createService(i, false, true)
        );

      prepareInputValuesMock.mockImplementation(() =>
        getInputsWithAutoMergeValues(true)
      );

      await index.run();

      verifyMocksWithError();
      expect(startGroupMock).toHaveBeenCalledTimes(2);
      expect(endGroupMock).toHaveBeenCalledTimes(1);
      expect(createPullRequestMock).toHaveBeenCalledTimes(1);
      expect(createPullRequestThrowErrorMock).toHaveBeenCalledTimes(0);
      expect(mergePullRequestWithRetriesMock).toHaveBeenCalledTimes(0);
      expect(mergePullRequestWithRetriesThrowErrorMock).toHaveBeenCalledTimes(
        1
      );
    });
  });
});

function createService(
  i: IInputs,
  createPullRequestThrowError: boolean,
  mergePullRequestWithRetriesThrowError: boolean
): service.IService {
  return {
    createPullRequest: !createPullRequestThrowError
      ? createPullRequestFunc
      : createPullRequestThrowErrorMock,
    mergePullRequestWithRetries: !mergePullRequestWithRetriesThrowError
      ? mergePullRequestWithRetriesFunc
      : mergePullRequestWithRetriesThrowErrorFunc
  } as service.IService;
}

function getInputsWithAutoMergeValues(autoMerge: boolean): inputs.IInputs {
  return {
    GITHUB_TOKEN: 'token',
    REPO_OWNER: '3dwardch3ng',
    REPO_NAME: 'github-pull-request',
    REMOTE_NAME: 'origin',
    SOURCE_BRANCH_NAME: 'source-branch',
    TARGET_BRANCH_NAME: 'target-branch',
    PR_TITLE: 'test-pr-title',
    PR_BODY: 'test-pr-title',
    DRAFT: false,
    REQUIRE_MIDDLE_BRANCH: false,
    AUTO_MERGE: autoMerge,
    MERGE_METHOD: 'merge',
    MAX_MERGE_RETRIES: 60,
    MERGE_RETRY_INTERVAL: 60,
    MILESTONE: undefined,
    ASSIGNEES: undefined,
    REVIEWERS: undefined,
    TEAM_REVIEWERS: undefined,
    LABELS: undefined,
    SIGNOFF: false
  } as IInputs;
}

function verifyMocks(): void {
  expect(prepareInputValuesMock).toHaveBeenCalledTimes(1);
  expect(createServiceMock).toHaveBeenCalledTimes(1);
  expect(setOutputMock).toHaveBeenCalledTimes(6);
  expect(setFailedMock).toHaveBeenCalledTimes(0);
  expect(createPullRequestMock).toHaveBeenCalledTimes(1);
}

function verifyMocksWithError(): void {
  expect(prepareInputValuesMock).toHaveBeenCalledTimes(1);
  expect(createServiceMock).toHaveBeenCalledTimes(1);
  expect(setOutputMock).toHaveBeenCalledTimes(0);
  expect(setFailedMock).toHaveBeenCalledTimes(1);
}
