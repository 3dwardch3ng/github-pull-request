import * as core from '@actions/core';

export interface IInputs {
  GITHUB_TOKEN: string;
  REPO_OWNER: string;
  REPO_NAME: string;
  REMOTE_NAME: string;
  SOURCE_BRANCH_NAME: string;
  TARGET_BRANCH_NAME: string;
  PR_TITLE: string;
  PR_BODY: string;
  DRAFT: boolean;
  REQUIRE_MIDDLE_BRANCH: boolean;
  AUTO_MERGE: boolean;
  MERGE_METHOD: 'merge' | 'squash' | 'rebase';
  MAX_MERGE_RETRIES: number;
  MERGE_RETRY_INTERVAL: number;
  MILESTONE: number | undefined;
  ASSIGNEES: string[] | undefined;
  REVIEWERS: string[] | undefined;
  TEAM_REVIEWERS: string[] | undefined;
  LABELS: string[] | undefined;
  SIGNOFF: boolean;
}

export const prepareInputValues: () => IInputs = (): IInputs => {
  return new Inputs(
    core.getInput('github_token', { required: true }),
    core.getInput('repo_owner', { required: true }),
    core.getInput('repo_name', { required: true }),
    core.getInput('remote_name', { required: false }) || 'origin',
    core.getInput('source_branch', { required: true }),
    core.getInput('target_branch', { required: true }),
    core.getInput('pr_title', { required: true }),
    core.getInput('pr_body', { required: false }),
    core.getInput('draft', { required: false }).toLowerCase() === 'true' ||
      false,
    core
      .getInput('require_middle_branch', { required: false })
      .toLowerCase() === 'true' || false,
    core.getInput('auto_merge', { required: false }).toLowerCase() === 'true' ||
      false,
    core.getInput('merge_method', { required: false }) || 'merge',
    core.getInput('max_merge_retries', { required: false }) || '60',
    core.getInput('merge_retry_interval', { required: false }) || '60',
    core.getInput('milestone', { required: false }),
    core.getInput('assignees', { required: false }).split(','),
    core.getInput('reviewers', { required: false }).split(','),
    core.getInput('team_reviewers', { required: false }).split(','),
    core.getInput('labels', { required: false }).split(','),
    core.getInput('signoff', { required: false }).toLowerCase() === 'true' ||
      false
  );
};

class Inputs implements IInputs {
  private readonly _GITHUB_TOKEN: string;
  private readonly _REPO_OWNER: string;
  private readonly _REPO_NAME: string;
  private readonly _REMOTE_NAME: string;
  private readonly _SOURCE_BRANCH_NAME: string;
  private readonly _TARGET_BRANCH_NAME: string;
  private readonly _PR_TITLE: string;
  private _PR_BODY: string;
  private readonly _DRAFT: boolean;
  private readonly _REQUIRE_MIDDLE_BRANCH: boolean;
  private readonly _AUTO_MERGE: boolean;
  private readonly _MERGE_METHOD: 'merge' | 'squash' | 'rebase';
  private readonly _MAX_MERGE_RETRIES: number;
  private readonly _MERGE_RETRY_INTERVAL: number;
  private readonly _MILESTONE: number | undefined;
  private readonly _ASSIGNEES: string[] | undefined;
  private readonly _REVIEWERS: string[] | undefined;
  private readonly _TEAM_REVIEWERS: string[] | undefined;
  private readonly _LABELS: string[] | undefined;
  private readonly _SIGNOFF: boolean;

  constructor(
    githubToken: string,
    repoOwner: string,
    repoName: string,
    remoteName: string,
    sourceBranchName: string,
    targetBranchName: string,
    prTitle: string,
    prBody: string,
    draft: boolean,
    requireMiddleBranch: boolean,
    autoMerge: boolean,
    mergeMethod: string,
    maxMergeRetries: string,
    mergeRetryInterval: string,
    milestone: string,
    assignees: string[],
    reviewers: string[],
    teamReviewers: string[],
    labels: string[],
    signoff: boolean
  ) {
    this._GITHUB_TOKEN = githubToken;
    this._REPO_OWNER = this.stringEscape(repoOwner);
    this._REPO_NAME = this.stringEscape(repoName);
    this._REMOTE_NAME = this.stringEscape(remoteName);
    this._SOURCE_BRANCH_NAME = this.stringEscape(sourceBranchName);
    this._TARGET_BRANCH_NAME = this.stringEscape(targetBranchName);
    this._PR_TITLE = prTitle;
    this._PR_BODY = prBody;
    this._DRAFT = draft;
    this._REQUIRE_MIDDLE_BRANCH = requireMiddleBranch;
    this._AUTO_MERGE = autoMerge;
    this._MERGE_METHOD = ['merge', 'squash', 'rebase'].includes(mergeMethod)
      ? (mergeMethod as 'merge' | 'squash' | 'rebase')
      : 'merge';
    this._MAX_MERGE_RETRIES = parseInt(maxMergeRetries);
    this._MERGE_RETRY_INTERVAL = parseInt(mergeRetryInterval);
    this._MILESTONE = milestone !== '' ? parseInt(milestone) : undefined;
    this._ASSIGNEES =
      assignees.length === 1 && assignees[0] === '' ? undefined : assignees;
    this._REVIEWERS =
      reviewers.length === 1 && reviewers[0] === '' ? undefined : reviewers;
    this._TEAM_REVIEWERS =
      teamReviewers.length === 1 && teamReviewers[0] === ''
        ? undefined
        : teamReviewers;
    this._LABELS = labels.length === 1 && labels[0] === '' ? undefined : labels;
    this._SIGNOFF = signoff;
  }

  private stringEscape(str: string): string {
    return str.replace(/(\r\n|\n|\r)/gm, '');
  }

  get GITHUB_TOKEN(): string {
    return this._GITHUB_TOKEN;
  }

  get REPO_OWNER(): string {
    return this._REPO_OWNER;
  }

  get REPO_NAME(): string {
    return this._REPO_NAME;
  }

  get REMOTE_NAME(): string {
    return this._REMOTE_NAME;
  }

  get SOURCE_BRANCH_NAME(): string {
    return this._SOURCE_BRANCH_NAME;
  }

  get TARGET_BRANCH_NAME(): string {
    return this._TARGET_BRANCH_NAME;
  }

  get PR_TITLE(): string {
    return this._PR_TITLE;
  }

  get PR_BODY(): string {
    return this._PR_BODY;
  }

  set PR_BODY(value: string) {
    this._PR_BODY = value;
  }

  get DRAFT(): boolean {
    return this._DRAFT;
  }

  get REQUIRE_MIDDLE_BRANCH(): boolean {
    return this._REQUIRE_MIDDLE_BRANCH;
  }

  get AUTO_MERGE(): boolean {
    return this._AUTO_MERGE;
  }

  get MERGE_METHOD(): 'merge' | 'squash' | 'rebase' {
    return this._MERGE_METHOD;
  }

  get MAX_MERGE_RETRIES(): number {
    return this._MAX_MERGE_RETRIES;
  }

  get MERGE_RETRY_INTERVAL(): number {
    return this._MERGE_RETRY_INTERVAL;
  }

  get MILESTONE(): number | undefined {
    return this._MILESTONE;
  }

  get ASSIGNEES(): string[] | undefined {
    return this._ASSIGNEES;
  }

  get REVIEWERS(): string[] | undefined {
    return this._REVIEWERS;
  }

  get TEAM_REVIEWERS(): string[] | undefined {
    return this._TEAM_REVIEWERS;
  }

  get LABELS(): string[] | undefined {
    return this._LABELS;
  }

  get SIGNOFF(): boolean {
    return this._SIGNOFF;
  }
}
