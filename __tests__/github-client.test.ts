import * as core from '@actions/core';
import { GithubClient, Pull } from '../src/github-client';
import { WorkflowUtils } from '../src/workflow-utils';
import { Octokit } from '@octokit/core';
import { OctokitOptions } from '@octokit/core/dist-types/types';
import PluginRestEndpointMethods from '@octokit/plugin-rest-endpoint-methods';
import { IInputs } from '../src/inputs';
import { ICreateOrUpdatePullRequestBranchResult } from '../src/service';
import { Api } from '@octokit/plugin-rest-endpoint-methods/dist-types/types';
import { AnnotationProperties } from '@actions/core';
import { ErrorMessages } from '../src/message';
import { OctokitResponse } from '@octokit/types/dist-types';

/* eslint-disable @typescript-eslint/no-explicit-any */
const apiRestPullsCreateMock: jest.Mock = jest.fn();
const apiRestPullsListMock: jest.Mock = jest.fn();
const apiRestPullsUpdateMock: jest.Mock = jest.fn();
const apiRestPullsRequestReviewersMock: jest.Mock = jest.fn();
const apiRestPullsMergeMock: jest.Mock = jest.fn();
const apiRestIssuesUpdateMock: jest.Mock = jest.fn();
const apiRestIssuesAddLabelsMock: jest.Mock = jest.fn();
const apiRestIssuesAddAssigneesMock: jest.Mock = jest.fn();
const apiMock: Api = getApiMock();
const infoMock: jest.SpyInstance<void, [message: string], any> = jest.spyOn(
  core,
  'info'
);
const errorMock: jest.SpyInstance<
  void,
  [message: string | Error, properties?: AnnotationProperties]
> = jest.spyOn(core, 'error').mockImplementation(() => {});

const getErrorMessageMock: jest.Mock<any, any, any> = jest
  .fn()
  .mockImplementation((error: unknown): string => {
    if (error instanceof Error) return error.message;
    return String(error);
  });
jest.mock('../src/workflow-utils', () => {
  return {
    WorkflowUtils: jest.fn().mockImplementation(() => {
      return {
        getErrorMessage: getErrorMessageMock
      };
    })
  };
});
jest.mock('@octokit/core', () => {
  return {
    Octokit: jest.fn().mockImplementation(() => {})
  };
});
jest.mock('@octokit/plugin-rest-endpoint-methods', () => {
  return {
    restEndpointMethods: jest.fn().mockImplementation(() => apiMock)
  };
});

describe('Test github-client.ts', (): void => {
  let restEndpointMethodsSpy: jest.SpyInstance;

  describe('Test constructor', (): void => {
    beforeEach((): void => {
      restEndpointMethodsSpy = jest.spyOn(
        PluginRestEndpointMethods,
        'restEndpointMethods'
      );
    });

    afterEach((): void => {
      delete process.env['GITHUB_API_URL'];
    });

    it('should create a new instance of GithubClient', (): void => {
      process.env['GITHUB_API_URL'] = 'GITHUB_API_URL';

      const githubClient: GithubClient = new GithubClient('token');

      expect(githubClient).toBeInstanceOf(GithubClient);
      expect(WorkflowUtils).toHaveBeenCalledTimes(1);
      expect(Octokit).toHaveBeenCalledWith({
        auth: 'token',
        baseUrl: 'GITHUB_API_URL'
      } as OctokitOptions);
      expect(restEndpointMethodsSpy).toHaveBeenCalledTimes(1);
      expect(restEndpointMethodsSpy).toHaveBeenCalledWith(expect.any(Octokit));
    });

    it('should create a new instance of GithubClient with default GITHUB_API_URL and no token', (): void => {
      const githubClient: GithubClient = new GithubClient('');

      expect(githubClient).toBeInstanceOf(GithubClient);
      expect(WorkflowUtils).toHaveBeenCalledTimes(1);
      expect(Octokit).toHaveBeenCalledWith({
        baseUrl: 'https://api.github.com'
      } as OctokitOptions);
    });
  });

  describe('Test preparePullRequest function', (): void => {
    beforeAll((): void => {
      restEndpointMethodsSpy = jest.spyOn(
        PluginRestEndpointMethods,
        'restEndpointMethods'
      );
    });

    it('should create a PR and return Pull object', async (): Promise<void> => {
      const githubClient: GithubClient = new GithubClient('');
      const inputs: IInputs = {
        GITHUB_TOKEN: 'GITHUB_TOKEN',
        REPO_OWNER: 'REPO_OWNER',
        REPO_NAME: 'REPO_NAME',
        SOURCE_BRANCH_NAME: 'SOURCE_BRANCH_NAME',
        TARGET_BRANCH_NAME: 'TARGET_BRANCH_NAME',
        PR_TITLE: 'PR_TITLE',
        DRAFT: false,
        REQUIRE_MIDDLE_BRANCH: false,
        AUTO_MERGE: false,
        MERGE_METHOD: 'merge',
        MAX_MERGE_RETRIES: 60,
        MERGE_RETRY_INTERVAL: 60,
        SIGNOFF: false
      } as IInputs;
      const result: ICreateOrUpdatePullRequestBranchResult = {
        action: 'created',
        sourceBranch: 'sourceBranch',
        targetBranch: 'targetBranch',
        hasDiffWithTargetBranch: false,
        headSha: ''
      } as ICreateOrUpdatePullRequestBranchResult;
      const pull: Pull = {
        number: 1,
        html_url: 'html_url',
        created: true
      } as Pull;

      const createOrUpdatePullRequestSpy: jest.SpyInstance = jest
        .spyOn(githubClient, 'createOrUpdatePullRequest')
        .mockImplementation(async (): Promise<Pull> => {
          return Promise.resolve(pull);
        });
      const updateIssuesSpy: jest.SpyInstance = jest
        .spyOn(githubClient, 'updateIssues')
        .mockImplementation(async (): Promise<void> => {
          return Promise.resolve();
        });

      const pullRequest: Pull = await githubClient.preparePullRequest(
        inputs,
        result
      );

      expect(pullRequest).toEqual(pull);
      expect(createOrUpdatePullRequestSpy).toHaveBeenCalledTimes(1);
      expect(createOrUpdatePullRequestSpy).toHaveBeenCalledWith(inputs, result);
      expect(updateIssuesSpy).toHaveBeenCalledTimes(1);
      expect(updateIssuesSpy).toHaveBeenCalledWith(inputs, pull);
    });
  });

  describe('Test createOrUpdatePullRequest function', (): void => {
    const inputs: IInputs = {
      GITHUB_TOKEN: 'GITHUB_TOKEN',
      REPO_OWNER: 'REPO_OWNER',
      REPO_NAME: 'REPO_NAME',
      SOURCE_BRANCH_NAME: 'SOURCE_BRANCH_NAME',
      TARGET_BRANCH_NAME: 'TARGET_BRANCH_NAME',
      PR_TITLE: 'PR_TITLE',
      PR_BODY: 'PR_BODY',
      DRAFT: false,
      REQUIRE_MIDDLE_BRANCH: false,
      AUTO_MERGE: false,
      MERGE_METHOD: 'merge',
      MAX_MERGE_RETRIES: 60,
      MERGE_RETRY_INTERVAL: 60,
      SIGNOFF: false
    } as IInputs;
    const result: ICreateOrUpdatePullRequestBranchResult = {
      action: 'created',
      sourceBranch: 'sourceBranch',
      targetBranch: 'targetBranch',
      hasDiffWithTargetBranch: false,
      headSha: ''
    } as ICreateOrUpdatePullRequestBranchResult;

    it('should create a PR and return Pull object', async (): Promise<void> => {
      apiRestPullsCreateMock.mockImplementation((): any => {
        return {
          data: {
            number: 1,
            head: {
              sha: 'sha_1'
            },
            html_url: 'html_url_1'
          }
        };
      });

      const githubClient: GithubClient = new GithubClient('');

      const pull: Pull = await githubClient.createOrUpdatePullRequest(
        inputs,
        result
      );

      expect(pull).toEqual({
        number: 1,
        sha: 'sha_1',
        html_url: 'html_url_1',
        action: 'created',
        created: true,
        merged: false
      } as Pull);
      expect(infoMock).toHaveBeenCalledTimes(1);
      expect(apiRestPullsCreateMock).toHaveBeenCalledTimes(1);
      expect(apiRestPullsListMock).toHaveBeenCalledTimes(0);
      expect(apiRestPullsUpdateMock).toHaveBeenCalledTimes(0);
    });

    it('should update a PR when exists and return Pull object', async (): Promise<void> => {
      result.action = 'updated';
      apiRestPullsCreateMock.mockImplementation((): any => {
        throw Error('A pull request already exists for');
      });
      apiRestPullsListMock.mockImplementation((): any => {
        return {
          data: [
            {
              number: 1,
              head: {
                sha: 'sha_1'
              },
              html_url: 'html_url_1'
            },
            {
              number: 2,
              head: {
                sha: 'sha_2'
              },
              html_url: 'html_url_2'
            }
          ]
        };
      });
      apiRestPullsUpdateMock.mockImplementation((): any => {
        return {
          data: {
            number: 1,
            head: {
              sha: 'sha_1'
            },
            html_url: 'html_url_1'
          }
        };
      });

      const githubClient: GithubClient = new GithubClient('');

      const pull: Pull = await githubClient.createOrUpdatePullRequest(
        inputs,
        result
      );

      expect(pull).toEqual({
        number: 1,
        sha: 'sha_1',
        html_url: 'html_url_1',
        action: 'updated',
        created: false,
        merged: false
      } as Pull);
      expect(infoMock).toHaveBeenCalledTimes(5);
      expect(apiRestPullsCreateMock).toHaveBeenCalledTimes(1);
      expect(apiRestPullsListMock).toHaveBeenCalledTimes(1);
      expect(apiRestPullsUpdateMock).toHaveBeenCalledTimes(1);
    });

    it('should throw an error', async (): Promise<void> => {
      apiRestPullsCreateMock.mockImplementation((): any => {
        throw Error();
      });

      const githubClient: GithubClient = new GithubClient('');

      await expect(
        githubClient.createOrUpdatePullRequest(inputs, result)
      ).rejects.toThrow(new Error());
      expect(infoMock).toHaveBeenCalledTimes(1);
      expect(apiRestPullsCreateMock).toHaveBeenCalledTimes(1);
      expect(apiRestPullsListMock).toHaveBeenCalledTimes(0);
      expect(apiRestPullsUpdateMock).toHaveBeenCalledTimes(0);
    });
  });

  describe('Test updateIssues function', (): void => {
    const inputs: IInputs = {
      GITHUB_TOKEN: 'GITHUB_TOKEN',
      REPO_OWNER: 'REPO_OWNER',
      REPO_NAME: 'REPO_NAME',
      SOURCE_BRANCH_NAME: 'SOURCE_BRANCH_NAME',
      TARGET_BRANCH_NAME: 'TARGET_BRANCH_NAME',
      PR_TITLE: 'PR_TITLE',
      PR_BODY: 'PR_BODY',
      DRAFT: false,
      REQUIRE_MIDDLE_BRANCH: false,
      AUTO_MERGE: false,
      MERGE_METHOD: 'merge',
      MAX_MERGE_RETRIES: 60,
      MERGE_RETRY_INTERVAL: 60,
      SIGNOFF: false,
      MILESTONE: 1,
      LABELS: ['label1', 'label2'],
      ASSIGNEES: ['assignee1', 'assignee2'],
      REVIEWERS: ['reviewer1', 'reviewer2'],
      TEAM_REVIEWERS: ['org1/group1/teamReviewer1', 'teamReviewer2']
    } as IInputs;
    const pull: Pull = {
      number: 1,
      sha: 'sha_1',
      html_url: 'html_url_1',
      action: 'updated',
      created: false,
      merged: false
    } as Pull;

    it('should update issue', async (): Promise<void> => {
      const githubClient: GithubClient = new GithubClient('');

      await githubClient.updateIssues(inputs, pull);

      expect(apiRestIssuesUpdateMock).toHaveBeenCalledTimes(1);
      expect(apiRestIssuesUpdateMock).toHaveBeenCalledWith({
        owner: inputs.REPO_OWNER,
        repo: inputs.REPO_NAME,
        issue_number: 1,
        milestone: inputs.MILESTONE
      });
      expect(apiRestIssuesAddLabelsMock).toHaveBeenCalledTimes(1);
      expect(apiRestIssuesAddLabelsMock).toHaveBeenCalledWith({
        owner: inputs.REPO_OWNER,
        repo: inputs.REPO_NAME,
        issue_number: 1,
        labels: inputs.LABELS
      });
      expect(apiRestIssuesAddAssigneesMock).toHaveBeenCalledTimes(1);
      expect(apiRestIssuesAddAssigneesMock).toHaveBeenCalledWith({
        owner: inputs.REPO_OWNER,
        repo: inputs.REPO_NAME,
        issue_number: 1,
        assignees: inputs.ASSIGNEES
      });
      expect(apiRestPullsRequestReviewersMock).toHaveBeenCalledTimes(1);
      expect(apiRestPullsRequestReviewersMock).toHaveBeenCalledWith({
        owner: inputs.REPO_OWNER,
        repo: inputs.REPO_NAME,
        pull_number: 1,
        reviewers: inputs.REVIEWERS,
        team_reviewers: ['teamReviewer1', 'teamReviewer2']
      });
      expect(infoMock).toHaveBeenCalledTimes(5);
    });

    it('should output error message when update issue via requestReviewers throw expected error', async (): Promise<void> => {
      const errorMessage: Error = new Error(
        ErrorMessages.ERROR_PR_REVIEW_TOKEN_SCOPE
      );

      apiRestPullsRequestReviewersMock.mockImplementation(
        async (): Promise<void> => {
          throw errorMessage;
        }
      );
      const githubClient: GithubClient = new GithubClient('');

      await expect(githubClient.updateIssues(inputs, pull)).rejects.toThrow(
        errorMessage
      );
      expect(errorMock).toHaveBeenCalledTimes(1);
      expect(errorMock).toHaveBeenCalledWith(
        ErrorMessages.UPDATE_REVIEWER_ERROR
      );
      expect(getErrorMessageMock).toHaveBeenCalledTimes(1);
      expect(getErrorMessageMock).toHaveBeenCalledWith(errorMessage);
      expect(apiRestIssuesUpdateMock).toHaveBeenCalledTimes(1);
      expect(apiRestIssuesAddLabelsMock).toHaveBeenCalledTimes(1);
      expect(apiRestIssuesAddAssigneesMock).toHaveBeenCalledTimes(1);
      expect(apiRestPullsRequestReviewersMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test mergePullRequest function', (): void => {
    const inputs: IInputs = {
      GITHUB_TOKEN: 'GITHUB_TOKEN',
      REPO_OWNER: 'REPO_OWNER',
      REPO_NAME: 'REPO_NAME',
      SOURCE_BRANCH_NAME: 'SOURCE_BRANCH_NAME',
      TARGET_BRANCH_NAME: 'TARGET_BRANCH_NAME',
      PR_TITLE: 'PR_TITLE',
      PR_BODY: 'PR_BODY',
      DRAFT: false,
      REQUIRE_MIDDLE_BRANCH: false,
      AUTO_MERGE: false,
      MERGE_METHOD: 'merge',
      MAX_MERGE_RETRIES: 60,
      MERGE_RETRY_INTERVAL: 60,
      SIGNOFF: false,
      MILESTONE: 1,
      LABELS: ['label1', 'label2'],
      ASSIGNEES: ['assignee1', 'assignee2'],
      REVIEWERS: ['reviewer1', 'reviewer2'],
      TEAM_REVIEWERS: ['org1/group1/teamReviewer1', 'teamReviewer2']
    } as IInputs;
    const pull: Pull = {
      number: 1,
      sha: 'sha_1',
      html_url: 'html_url_1',
      action: 'updated',
      created: false,
      merged: false
    } as Pull;

    it('should merge pull request', async (): Promise<void> => {
      const mergeResponse: OctokitResponse<
        { sha: string; merged: boolean; message: string },
        200
      > = {
        data: {
          sha: 'sha_1',
          merged: true,
          message: 'message'
        },
        status: 200,
        headers: {},
        url: ''
      };
      apiRestPullsMergeMock.mockImplementation(() => mergeResponse);

      const githubClient: GithubClient = new GithubClient('');

      const pullRequest: Pull = await githubClient.mergePullRequest(
        pull,
        inputs
      );

      expect(pullRequest).toEqual({
        number: 1,
        sha: 'sha_1',
        html_url: 'html_url_1',
        action: 'updated',
        created: false,
        merged: true
      });
      expect(apiRestPullsMergeMock).toHaveBeenCalledTimes(1);
      expect(apiRestPullsMergeMock).toHaveBeenCalledWith({
        owner: inputs.REPO_OWNER,
        repo: inputs.REPO_NAME,
        pull_number: 1,
        merge_method: inputs.MERGE_METHOD
      });
    });
  });
});

function getApiMock(): Api {
  return {
    rest: {
      pulls: {
        create: apiRestPullsCreateMock,
        list: apiRestPullsListMock,
        update: apiRestPullsUpdateMock,
        requestReviewers: apiRestPullsRequestReviewersMock,
        merge: apiRestPullsMergeMock
      },
      issues: {
        update: apiRestIssuesUpdateMock,
        addLabels: apiRestIssuesAddLabelsMock,
        addAssignees: apiRestIssuesAddAssigneesMock
      }
    } as any
  } as Api;
}
/* eslint-enable */
