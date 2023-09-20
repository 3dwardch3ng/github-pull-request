import { IInputs } from './inputs';
import { ErrorMessages, InfoMessages, WarningMessages } from './message';
import * as core from '@actions/core';
import { IWorkflowUtils, WorkflowUtils } from './workflow-utils';
import {
  GitCommandManager,
  IGitCommandManager,
  IRemoteDetail,
  IWorkingBaseAndType
} from './git-command-manager';
import { GitAuthHelper, IGitAuthHelper } from './git-auth-helper';
import { GitSourceSettings, IGitSourceSettings } from './git-source-settings';
import { GithubClient, IGithubClient, Pull } from './github-client';
import { v4 as uuidv4 } from 'uuid';
import { executeWithCustomised } from './retry-helper-wrapper';

export interface IGitPreparationResponse {
  git: IGitCommandManager;
  gitAuthHelper: IGitAuthHelper;
}

export interface ICreateOrUpdatePullRequestBranchResult {
  action: string;
  sourceBranch: string;
  targetBranch: string;
  hasDiffWithTargetBranch: boolean;
  headSha: string;
}

export function createService(inputs: IInputs): IService {
  return new Service(inputs);
}

export interface IService {
  createPullRequest(): Promise<Pull>;

  mergePullRequestWithRetries(pullRequest: Pull): Promise<Pull>;
}

export class Service implements IService {
  private readonly inputs: IInputs;
  private readonly workflowUtils: IWorkflowUtils;
  private readonly githubClient: IGithubClient;

  constructor(inputs: IInputs) {
    this.inputs = inputs;
    this.workflowUtils = new WorkflowUtils();
    this.githubClient = new GithubClient(this.inputs.GITHUB_TOKEN);
    this.inputDataChecks();
  }

  async createPullRequest(): Promise<Pull> {
    const response: IGitPreparationResponse =
      await this.prepareGitAuthentication();
    const git: IGitCommandManager = response.git;
    const gitAuthHelper: IGitAuthHelper = response.gitAuthHelper;
    let pullRequest: Pull = {
      number: 0,
      sha: '',
      html_url: '',
      action: '',
      created: false,
      merged: false
    } as Pull;

    try {
      core.startGroup('Create or update the pull request branch');
      const result: ICreateOrUpdatePullRequestBranchResult =
        await this.preparePullRequestBranch(git);
      core.endGroup();

      if (result.hasDiffWithTargetBranch) {
        core.startGroup('Pushing the pull request branch');
        await this.pushPullRequestBranch(git, result);
        core.endGroup();

        core.startGroup('Create or update the pull request');
        pullRequest = await this.githubClient.preparePullRequest(
          this.inputs,
          result
        );
        core.endGroup();
      }
    } finally {
      await gitAuthHelper.removeAuth();
    }
    return pullRequest;
  }

  async mergePullRequestWithRetries(pullRequest: Pull): Promise<Pull> {
    const response: IGitPreparationResponse =
      await this.prepareGitAuthentication();
    const gitAuthHelper: IGitAuthHelper = response.gitAuthHelper;
    let pr: Pull = {
      number: pullRequest.number,
      html_url: pullRequest.html_url,
      created: pullRequest.created,
      merged: pullRequest.merged
    } as Pull;

    try {
      pr = await this.mergePullRequest(pr);
    } catch (error) {
      const maxRetries: number = this.inputs.MAX_MERGE_RETRIES;
      const retryInterval: number = this.inputs.MERGE_RETRY_INTERVAL;
      pr = await executeWithCustomised(
        maxRetries,
        undefined,
        undefined,
        retryInterval,
        async (): Promise<Pull> => await this.mergePullRequest(pr)
      );
    } finally {
      await gitAuthHelper.removeAuth();
    }
    return pr;
  }

  async mergePullRequest(pullRequest: Pull): Promise<Pull> {
    try {
      core.startGroup(`Merging pull request #${pullRequest.number}`);
      pullRequest = await this.githubClient.mergePullRequest(
        pullRequest,
        this.inputs
      );
      core.endGroup();
    } catch (error) {
      core.setFailed(this.workflowUtils.getErrorMessage(error));
      throw error;
    }
    return pullRequest;
  }

  private async preparePullRequestBranch(
    git: IGitCommandManager
  ): Promise<ICreateOrUpdatePullRequestBranchResult> {
    const result: ICreateOrUpdatePullRequestBranchResult = {
      action: 'none',
      sourceBranch: this.inputs.SOURCE_BRANCH_NAME,
      targetBranch: this.inputs.TARGET_BRANCH_NAME,
      hasDiffWithTargetBranch: false,
      headSha: ''
    };

    const workingBaseAndType: IWorkingBaseAndType =
      await git.getWorkingBaseAndType();
    core.info(
      `Working base is ${workingBaseAndType.workingBaseType} '${workingBaseAndType.workingBase}'`
    );

    const stashed: boolean = await git.stashPush(['--include-untracked']);

    if (workingBaseAndType.workingBase !== this.inputs.SOURCE_BRANCH_NAME) {
      await git.fetchAll();
      await git.checkout(this.inputs.SOURCE_BRANCH_NAME);
      await git.pull();
    }

    const tempBranch: string = uuidv4();
    await git.checkout(tempBranch, 'HEAD');

    let pullRequestBranchName: string = this.inputs.SOURCE_BRANCH_NAME;
    if (this.inputs.REQUIRE_MIDDLE_BRANCH) {
      pullRequestBranchName = `${this.inputs.SOURCE_BRANCH_NAME}-merge-to-${this.inputs.TARGET_BRANCH_NAME}`;
      result.sourceBranch = pullRequestBranchName;
    }

    if (!(await git.fetch(this.inputs.REMOTE_NAME, pullRequestBranchName))) {
      core.info(
        `Pull request branch '${pullRequestBranchName}' does not exist yet.`
      );
      await git.checkout(pullRequestBranchName, tempBranch);
      result.hasDiffWithTargetBranch = await git.isAhead(
        `${this.inputs.REMOTE_NAME}/${this.inputs.TARGET_BRANCH_NAME}`,
        pullRequestBranchName,
        ['--']
      );
      if (result.hasDiffWithTargetBranch) {
        result.action = 'created';
        core.info(`Created branch '${pullRequestBranchName}'`);
      } else {
        core.info(
          `Branch '${pullRequestBranchName}' is not ahead of base '${this.inputs.TARGET_BRANCH_NAME}' and will not be created`
        );
      }
    } else {
      core.info(
        `Pull request branch '${pullRequestBranchName}' already exists as remote branch '${this.inputs.REMOTE_NAME}/${pullRequestBranchName}'`
      );
      await git.checkout(pullRequestBranchName);
      const tempBranchCommitsAhead: number = await git.commitsAhead(
        `${this.inputs.REMOTE_NAME}/${this.inputs.TARGET_BRANCH_NAME}`,
        tempBranch
      );
      const branchCommitsAhead: number = await git.commitsAhead(
        `${this.inputs.REMOTE_NAME}/${this.inputs.TARGET_BRANCH_NAME}`,
        pullRequestBranchName
      );
      if (
        (await git.hasDiff([`${pullRequestBranchName}..${tempBranch}`])) ||
        branchCommitsAhead !== tempBranchCommitsAhead ||
        tempBranchCommitsAhead <= 0
      ) {
        core.info(`Resetting '${pullRequestBranchName}'`);
        await git.checkout(pullRequestBranchName, tempBranch);
      }
      if (
        !(await git.isEven(
          `${this.inputs.REMOTE_NAME}/${pullRequestBranchName}`,
          pullRequestBranchName
        ))
      ) {
        result.action = 'updated';
        core.info(`Updated branch '${pullRequestBranchName}'`);
      } else {
        result.action = 'not-updated';
        core.info(
          `Branch '${pullRequestBranchName}' is even with its remote and will not be updated`
        );
      }
      result.hasDiffWithTargetBranch = await git.isAhead(
        this.inputs.TARGET_BRANCH_NAME,
        pullRequestBranchName
      );
    }
    result.headSha = await git.revParse('HEAD');
    await git.deleteBranch(tempBranch, ['--force']);

    await git.checkout(workingBaseAndType.workingBase);

    if (stashed) {
      await git.stashPop();
    }

    return result;
  }

  private async pushPullRequestBranch(
    git: IGitCommandManager,
    result: ICreateOrUpdatePullRequestBranchResult
  ): Promise<void> {
    if (['created', 'updated'].includes(result.action)) {
      core.startGroup(
        `Pushing pull request branch to '${this.inputs.REMOTE_NAME}/${result.sourceBranch}'`
      );
      await git.push([
        '--force-with-lease',
        this.inputs.REMOTE_NAME,
        `${result.sourceBranch}:refs/heads/${result.sourceBranch}`
      ]);
      core.endGroup();
    }
  }

  private async prepareGitAuthentication(): Promise<IGitPreparationResponse> {
    const repoPath: string = this.workflowUtils.getRepoPath();
    const git: IGitCommandManager = await GitCommandManager.create(repoPath);
    const gitSourceSettings: IGitSourceSettings = new GitSourceSettings(
      repoPath,
      this.inputs.REPO_OWNER,
      this.inputs.REPO_NAME,
      this.inputs.GITHUB_TOKEN,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );
    const gitAuthHelper: IGitAuthHelper = new GitAuthHelper(
      git,
      gitSourceSettings
    );
    const remoteUrl: string = await git.getRepoRemoteUrl();
    const remoteDetail: IRemoteDetail = git.getRemoteDetail(remoteUrl);
    core.info(InfoMessages.PR_TARGET_REPO + remoteDetail.repository);

    if ('HTTPS' === remoteDetail.protocol) {
      core.info(InfoMessages.CONFIG_AUTH_HTTPS);
      await gitAuthHelper.configureAuth();
    }

    return {
      git,
      gitAuthHelper
    } as IGitPreparationResponse;
  }

  private inputDataChecks(): void {
    this.checkBodySize();
    this.checkBranchNames();
  }

  private checkBodySize(): void {
    if (this.inputs.PR_BODY.length > 65536) {
      core.warning(WarningMessages.PR_BODY_TOO_LONG);
      this.inputs.PR_BODY = this.inputs.PR_BODY.substring(0, 65536);
    }
  }

  private checkBranchNames(): void {
    if (this.inputs.SOURCE_BRANCH_NAME === this.inputs.TARGET_BRANCH_NAME) {
      throw new Error(ErrorMessages.BRANCH_NAME_SAME_ERROR);
    }
  }
}
