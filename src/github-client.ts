import * as core from '@actions/core';
import { Octokit } from '@octokit/core';
import { OctokitOptions } from '@octokit/core/dist-types/types';
import { OctokitResponse } from '@octokit/types/dist-types';
import { IInputs } from './inputs';
import { ICreateOrUpdatePullRequestBranchResult } from './service';
import { restEndpointMethods } from '@octokit/plugin-rest-endpoint-methods';
import { Api } from '@octokit/plugin-rest-endpoint-methods/dist-types/types';
import { IWorkflowUtils, WorkflowUtils } from './workflow-utils';
import * as process from 'process';
import { ErrorMessages } from './message';

export interface Repository {
  owner: string;
  repo: string;
}

export interface Pull {
  number: number;
  sha?: string;
  html_url: string;
  action: string;
  created: boolean;
  merged: boolean;
}

export interface IGithubClient {
  preparePullRequest(
    inputs: IInputs,
    result: ICreateOrUpdatePullRequestBranchResult
  ): Promise<Pull>;

  createOrUpdatePullRequest(
    inputs: IInputs,
    result: ICreateOrUpdatePullRequestBranchResult
  ): Promise<Pull>;

  updateIssues(inputs: IInputs, pull: Pull): Promise<void>;

  mergePullRequest(pullRequest: Pull, inputs: IInputs): Promise<Pull>;
}

export class GithubClient implements IGithubClient {
  private readonly workflowUtils: IWorkflowUtils;
  private readonly octokit: InstanceType<typeof Octokit>;
  private readonly api: Api;

  constructor(githubToken: string) {
    this.workflowUtils = new WorkflowUtils();

    const options: OctokitOptions = {};
    if (githubToken) {
      options.auth = `${githubToken}`;
    }
    options.baseUrl = process.env['GITHUB_API_URL'] ?? 'https://api.github.com';
    this.octokit = new Octokit(options);
    this.api = restEndpointMethods(this.octokit);
  }

  async preparePullRequest(
    inputs: IInputs,
    result: ICreateOrUpdatePullRequestBranchResult
  ): Promise<Pull> {
    const pull: Pull = await this.createOrUpdatePullRequest(inputs, result);
    await this.updateIssues(inputs, pull);
    return pull;
  }

  async createOrUpdatePullRequest(
    inputs: IInputs,
    result: ICreateOrUpdatePullRequestBranchResult
  ): Promise<Pull> {
    const repoOwner: string = inputs.REPO_OWNER;
    const repoName: string = inputs.REPO_NAME;
    const repoBranch: string = `${repoOwner}:${result.sourceBranch}`;
    const headBranchFull: string = `${repoOwner}/${repoName}:${repoBranch}`;

    try {
      core.info(`Trying to create the Pull Request`);
      const { data: pull } = await this.api.rest.pulls.create({
        ...({ owner: repoOwner, repo: repoName } as Repository),
        title: inputs.PR_TITLE,
        body: inputs.PR_BODY,
        draft: inputs.DRAFT,
        head: repoBranch,
        head_repo: repoName,
        base: result.targetBranch
      });
      return {
        number: pull.number,
        sha: pull.head.sha,
        html_url: pull.html_url,
        action: result.action,
        created: true,
        merged: false
      } as Pull;
    } catch (e: unknown) {
      if (
        this.workflowUtils
          .getErrorMessage(e)
          .includes(`A pull request already exists for`)
      ) {
        core.info(`A pull request already exists for ${headBranchFull}`);
      } else {
        throw e;
      }
    }

    core.info(`Fetching existing pull request`);
    const { data: pulls } = await this.api.rest.pulls.list({
      ...({ owner: repoOwner, repo: repoName } as Repository),
      state: 'open',
      head: headBranchFull,
      base: result.targetBranch
    });
    core.info(`Attempting update of pull request`);
    const { data: pull } = await this.api.rest.pulls.update({
      ...({ owner: repoOwner, repo: repoName } as Repository),
      pull_number: pulls[0].number,
      title: inputs.PR_TITLE,
      body: inputs.PR_BODY
    });
    core.info(
      `Updated pull request #${pull.number} (${repoBranch} => ${result.targetBranch})`
    );
    return {
      number: pull.number,
      sha: pull.head.sha,
      html_url: pull.html_url,
      action: result.action,
      created: false,
      merged: false
    };
  }

  async updateIssues(inputs: IInputs, pull: Pull): Promise<void> {
    const repoOwner: string = inputs.REPO_OWNER;
    const repoName: string = inputs.REPO_NAME;

    // Apply milestone
    if (inputs.MILESTONE) {
      core.info(`Applying milestone '${inputs.MILESTONE}'`);
      await this.api.rest.issues.update({
        ...({ owner: repoOwner, repo: repoName } as Repository),
        issue_number: pull.number,
        milestone: inputs.MILESTONE
      });
    }

    // Apply labels
    if (inputs.LABELS && inputs.LABELS.length > 0) {
      core.info(`Applying labels '${inputs.LABELS}'`);
      await this.api.rest.issues.addLabels({
        ...({ owner: repoOwner, repo: repoName } as Repository),
        issue_number: pull.number,
        labels: inputs.LABELS
      });
    }

    // Apply assignees
    if (inputs.ASSIGNEES && inputs.ASSIGNEES.length > 0) {
      core.info(`Applying assignees '${inputs.ASSIGNEES}'`);
      await this.api.rest.issues.addAssignees({
        ...({ owner: repoOwner, repo: repoName } as Repository),
        issue_number: pull.number,
        assignees: inputs.ASSIGNEES
      });
    }

    // Request reviewers and team reviewers
    const requestReviewersParams: {
      reviewers: string[];
      team_reviewers: string[];
    } = { reviewers: [], team_reviewers: [] };
    if (inputs.REVIEWERS && inputs.REVIEWERS.length > 0) {
      requestReviewersParams['reviewers'] = inputs.REVIEWERS;
      core.info(`Requesting reviewers '${inputs.REVIEWERS}'`);
    }
    if (inputs.TEAM_REVIEWERS && inputs.TEAM_REVIEWERS.length > 0) {
      const teams: string[] = this.stripOrgPrefixFromTeams(
        inputs.TEAM_REVIEWERS
      );
      requestReviewersParams['team_reviewers'] = teams;
      core.info(`Requesting team reviewers '${teams}'`);
    }
    if (Object.keys(requestReviewersParams).length > 0) {
      try {
        await this.api.rest.pulls.requestReviewers({
          ...({ owner: repoOwner, repo: repoName } as Repository),
          pull_number: pull.number,
          ...requestReviewersParams
        });
      } catch (e) {
        if (
          this.workflowUtils
            .getErrorMessage(e)
            .includes(ErrorMessages.ERROR_PR_REVIEW_TOKEN_SCOPE)
        ) {
          core.error(ErrorMessages.UPDATE_REVIEWER_ERROR);
        }
        throw e;
      }
    }
  }

  async mergePullRequest(pullRequest: Pull, inputs: IInputs): Promise<Pull> {
    const repoOwner: string = inputs.REPO_OWNER;
    const repoName: string = inputs.REPO_NAME;

    const mergeResponse: OctokitResponse<
      { sha: string; merged: boolean; message: string },
      200
    > = await this.api.rest.pulls.merge({
      ...({ owner: repoOwner, repo: repoName } as Repository),
      pull_number: pullRequest.number,
      merge_method: inputs.MERGE_METHOD
    });
    pullRequest.merged = mergeResponse.data.merged;
    return pullRequest;
  }

  private stripOrgPrefixFromTeams(teams: string[]): string[] {
    return teams.map((team: string) => {
      const slashIndex: number = team.lastIndexOf('/');
      if (slashIndex > 0) {
        return team.substring(slashIndex + 1);
      }
      return team;
    });
  }
}
