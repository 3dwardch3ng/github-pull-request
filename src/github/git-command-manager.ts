import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { ExecOptions } from '@actions/exec';
import * as fs from 'fs';
import * as fshelper from './fs-helper';
import * as io from '@actions/io';
import * as path from 'path';
import * as regexpHelper from './regexp-helper';
import * as retryHelperWrapper from '../retry-helper-wrapper';
import { IRetryHelper } from '../retry-helper';
import { GitVersion } from './git-version';
import { GitExecOutput } from './git-exec-output';
import { ErrorMessages } from '../message';

export const tagsRefSpec: string = '+refs/tags/*:refs/tags/*';

// Auth header not supported before 2.9
// Wire protocol v2 not supported before 2.18
export const MinimumGitVersion: GitVersion = new GitVersion('2.18');

export interface IGitCommandManager {
  readonly gitPath: string;
  readonly lfs: boolean;
  readonly doSparseCheckout: boolean;
  readonly workingDirectory: string;
  readonly gitEnv: { [key: string]: string };
  readonly retryHelper: IRetryHelper;
  getRepoRemoteUrl(): Promise<string>;
  getRemoteDetail(remoteUrl: string): IRemoteDetail;
  getWorkingBaseAndType(): Promise<IWorkingBaseAndType>;
  stashPush(options?: string[]): Promise<boolean>;
  stashPop(options?: string[]): Promise<void>;
  branchDelete(remote: boolean, branch: string): Promise<void>;
  branchExists(remote: boolean, pattern: string): Promise<boolean>;
  branchList(remote: boolean): Promise<string[]>;
  sparseCheckout(sparseCheckout: string[]): Promise<void>;
  sparseCheckoutNonConeMode(sparseCheckout: string[]): Promise<void>;
  checkout(ref: string, startPoint?: string): Promise<void>;
  checkoutDetach(): Promise<void>;
  config(
    configKey: string,
    configValue: string,
    globalConfig?: boolean,
    add?: boolean
  ): Promise<void>;
  configExists(configKey: string, globalConfig?: boolean): Promise<boolean>;
  fetch(remote: string, branch: string): Promise<boolean>;
  fetchRemote(
    refSpec: string[],
    options: {
      filter?: string;
      fetchDepth?: number;
      fetchTags?: boolean;
      showProgress?: boolean;
    }
  ): Promise<boolean>;
  fetchAll(): Promise<void>;
  isAhead(
    branch1: string,
    branch2: string,
    options?: string[]
  ): Promise<boolean>;
  commitsAhead(
    branch1: string,
    branch2: string,
    options?: string[]
  ): Promise<number>;
  isBehind(
    branch1: string,
    branch2: string,
    options?: string[]
  ): Promise<boolean>;
  commitsBehind(
    branch1: string,
    branch2: string,
    options?: string[]
  ): Promise<number>;
  isEven(branch1: string, branch2: string): Promise<boolean>;
  pull(options?: string[]): Promise<void>;
  push(options?: string[]): Promise<void>;
  deleteBranch(branchName: string, options?: string[]): Promise<void>;
  hasDiff(options?: string[]): Promise<boolean>;
  getDefaultBranch(repositoryUrl: string): Promise<string>;
  getWorkingDirectory(): string;
  init(): Promise<void>;
  isDetached(): Promise<boolean>;
  lfsFetch(ref: string): Promise<void>;
  lfsInstall(): Promise<void>;
  log1(format?: string): Promise<string>;
  remoteAdd(remoteName: string, remoteUrl: string): Promise<void>;
  removeEnvironmentVariable(name: string): void;
  revParse(ref: string): Promise<string>;
  setEnvironmentVariable(name: string, value: string): void;
  shaExists(sha: string): Promise<boolean>;
  submoduleForeach(command: string, recursive: boolean): Promise<string>;
  submoduleSync(recursive: boolean): Promise<void>;
  submoduleUpdate(fetchDepth: number, recursive: boolean): Promise<void>;
  submoduleStatus(): Promise<boolean>;
  tagExists(pattern: string): Promise<boolean>;
  tryClean(): Promise<boolean>;
  tryConfigUnset(configKey: string, globalConfig?: boolean): Promise<boolean>;
  tryDisableAutomaticGarbageCollection(): Promise<boolean>;
  tryGetFetchUrl(): Promise<string>;
  tryReset(): Promise<boolean>;
  execGit(
    args: string[],
    allowAllExitCodes: boolean | undefined,
    silent: boolean | undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customListeners: any | undefined
  ): Promise<GitExecOutput>;
}

export interface IRemoteDetail {
  hostname: string;
  protocol: string;
  repository: string;
}

export interface IWorkingBaseAndType {
  workingBase: string;
  workingBaseType: 'commit' | 'branch' | 'pull';
}

export async function createGitCommandManager(
  workingDirectory: string,
  lfs?: boolean,
  doSparseCheckout?: boolean
): Promise<IGitCommandManager> {
  return await GitCommandManager.createGitCommandManager(
    workingDirectory,
    lfs ?? false,
    doSparseCheckout ?? false
  );
}

export class GitCommandManager implements IGitCommandManager {
  private _gitEnv: { [key: string]: string } = {
    GIT_TERMINAL_PROMPT: '0', // Disable git prompt
    GCM_INTERACTIVE: 'Never' // Disable prompting for git credential manager
  };
  private _gitPath = '';
  private _lfs = false;
  private _doSparseCheckout = false;
  private _workingDirectory = '';
  private _retryHelper: IRetryHelper =
    retryHelperWrapper.createRetryHelperWithDefaults();

  // Private constructor; use createCommandManager()
  private constructor() {}

  async getRepoRemoteUrl(): Promise<string> {
    const result: GitExecOutput = await this.execGit(
      ['config', '--get', 'remote.origin.url'],
      true,
      true
    );
    return result.getStdout().trim();
  }

  getRemoteDetail(remoteUrl: string): IRemoteDetail {
    const githubUrl: string =
      process.env['GITHUB_SERVER_URL'] ?? 'https://github.com';
    return this.githubHttpsUrlValidator(githubUrl, remoteUrl);
  }

  async getWorkingBaseAndType(): Promise<IWorkingBaseAndType> {
    let ref: string | undefined = process.env['GITHUB_REF'];
    if (ref?.includes('/pull/')) {
      const pullName: string = ref.substring('refs/pull/'.length);
      ref = `refs/remotes/pull/${pullName}`;
      return {
        workingBase: ref,
        workingBaseType: 'pull'
      } as IWorkingBaseAndType;
    } else {
      const symbolicRefResult: GitExecOutput = await this.execGit(
        ['symbolic-ref', 'HEAD', '--short'],
        true
      );
      if (symbolicRefResult.exitCode === 0) {
        // ref
        return {
          workingBase: symbolicRefResult.getStdout(),
          workingBaseType: 'branch'
        } as IWorkingBaseAndType;
      } else {
        // detached HEAD
        const headSha: string = await this.revParse('HEAD');
        return {
          workingBase: headSha,
          workingBaseType: 'commit'
        } as IWorkingBaseAndType;
      }
    }
  }

  async stashPush(options?: string[]): Promise<boolean> {
    const args: string[] = ['stash', 'push'];
    if (options) {
      args.push(...options);
    }
    const output: GitExecOutput = await this.execGit(args);
    return output.getStdout().trim() !== 'No local changes to save';
  }

  async stashPop(options?: string[]): Promise<void> {
    const args: string[] = ['stash', 'pop'];
    if (options) {
      args.push(...options);
    }
    await this.execGit(args);
  }

  async branchDelete(remote: boolean, branch: string): Promise<void> {
    const args: string[] = ['branch', '--delete', '--force'];
    if (remote) {
      args.push('--remote');
    }
    args.push(branch);

    await this.execGit(args);
  }

  async branchExists(remote: boolean, pattern: string): Promise<boolean> {
    const args: string[] = ['branch', '--list'];
    if (remote) {
      args.push('--remote');
    }
    args.push(pattern);

    const output: GitExecOutput = await this.execGit(args);
    return !!output.getStdout().trim();
  }

  async branchList(remote: boolean): Promise<string[]> {
    const result: string[] = [];

    // Note, this implementation uses "rev-parse --symbolic-full-name" because the output from
    // "branch --list" is more difficult when in a detached HEAD state.

    // TODO(https://github.com/actions/checkout/issues/786): this implementation uses
    // "rev-parse --symbolic-full-name" because there is a bug
    // in Git 2.18 that causes "rev-parse --symbolic" to output symbolic full names. When
    // 2.18 is no longer supported, we can switch back to --symbolic.

    const args: string[] = ['rev-parse', '--symbolic-full-name'];
    if (remote) {
      args.push('--remotes=origin');
    } else {
      args.push('--branches');
    }

    const stderr: string[] = [];
    const errline: string[] = [];
    const stdout: string[] = [];
    const stdline: string[] = [];

    const listeners: {
      stderr: (data: Buffer) => void;
      errline: (data: Buffer) => void;
      stdout: (data: Buffer) => void;
      stdline: (data: Buffer) => void;
    } = {
      stderr: (data: Buffer): void => {
        stderr.push(data.toString());
      },
      errline: (data: Buffer): void => {
        errline.push(data.toString());
      },
      stdout: (data: Buffer): void => {
        stdout.push(data.toString());
      },
      stdline: (data: Buffer): void => {
        stdline.push(data.toString());
      }
    };

    // Suppress the output in order to avoid flooding annotations with innocuous errors.
    await this.execGit(args, false, true, listeners);

    core.debug(`stderr callback is: ${stderr}`);
    core.debug(`errline callback is: ${errline}`);
    core.debug(`stdout callback is: ${stdout}`);
    core.debug(`stdline callback is: ${stdline}`);

    for (let branch of stdline) {
      branch = branch.trim();
      if (!branch) {
        continue;
      }

      if (branch.startsWith('refs/heads/')) {
        branch = branch.substring('refs/heads/'.length);
      } else if (branch.startsWith('refs/remotes/')) {
        branch = branch.substring('refs/remotes/'.length);
      }

      result.push(branch);
    }

    return result;
  }

  async sparseCheckout(sparseCheckout: string[]): Promise<void> {
    await this.execGit(['sparse-checkout', 'set', ...sparseCheckout]);
  }

  async sparseCheckoutNonConeMode(sparseCheckout: string[]): Promise<void> {
    await this.execGit(['config', 'core.sparseCheckout', 'true']);
    const output: GitExecOutput = await this.execGit([
      'rev-parse',
      '--git-path',
      'info/sparse-checkout'
    ]);
    const sparseCheckoutPath: string = path.join(
      this._workingDirectory,
      output.getStdout().trimRight()
    );
    await fs.promises.appendFile(
      sparseCheckoutPath,
      `\n${sparseCheckout.join('\n')}\n`
    );
  }

  async checkout(ref: string, startPoint?: string): Promise<void> {
    const args: string[] = ['checkout', '--progress', '--force'];
    if (startPoint) {
      args.push('-B', ref, startPoint);
    } else {
      args.push(ref);
    }

    await this.execGit(args);
  }

  async checkoutDetach(): Promise<void> {
    const args: string[] = ['checkout', '--detach'];
    await this.execGit(args);
  }

  async config(
    configKey: string,
    configValue: string,
    globalConfig?: boolean,
    add?: boolean
  ): Promise<void> {
    const args: string[] = ['config', globalConfig ? '--global' : '--local'];
    if (add) {
      args.push('--add');
    }
    args.push(...[configKey, configValue]);
    await this.execGit(args);
  }

  async configExists(
    configKey: string,
    globalConfig?: boolean
  ): Promise<boolean> {
    const pattern: string = regexpHelper.escape(configKey);
    const output: GitExecOutput = await this.execGit(
      [
        'config',
        globalConfig ? '--global' : '--local',
        '--name-only',
        '--get-regexp',
        pattern
      ],
      true
    );
    return output.exitCode === 0;
  }

  async fetch(remote: string, branch: string): Promise<boolean> {
    try {
      await this.fetchRemote(
        [`${branch}:refs/remotes/${remote}/${branch}`],
        {
          options: ['--force']
        },
        remote
      );
      return true;
    } catch {
      return false;
    }
  }

  async fetchRemote(
    refSpec: string[],
    options: {
      filter?: string;
      fetchDepth?: number;
      fetchTags?: boolean;
      showProgress?: boolean;
      options?: string[];
    },
    remoteName?: string
  ): Promise<boolean> {
    const args: string[] = ['-c', 'protocol.version=2', 'fetch'];
    if (!refSpec.some(x => x === tagsRefSpec) && !options.fetchTags) {
      args.push('--no-tags');
    }

    args.push('--prune', '--no-recurse-submodules');
    if (options.showProgress) {
      args.push('--progress');
    }

    if (options.filter) {
      args.push(`--filter=${options.filter}`);
    }

    if (options.fetchDepth && options.fetchDepth > 0) {
      args.push(`--depth=${options.fetchDepth}`);
    } else if (
      fshelper.fileExistsSync(
        path.join(this._workingDirectory, '.git', 'shallow')
      )
    ) {
      args.push('--unshallow');
    }

    if (remoteName) {
      args.push(remoteName);
    } else {
      args.push('origin');
    }
    for (const arg of refSpec) {
      args.push(arg);
    }

    /* eslint-disable-next-line @typescript-eslint/no-this-alias */
    const that: GitCommandManager = this;
    try {
      await this._retryHelper.execute(async (): Promise<void> => {
        await that.execGit(args);
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  async fetchAll(): Promise<void> {
    await this.execGit(['fetch']);
  }

  async isAhead(
    branch1: string,
    branch2: string,
    options?: string[]
  ): Promise<boolean> {
    return (await this.commitsAhead(branch1, branch2, options)) > 0;
  }

  async commitsAhead(
    branch1: string,
    branch2: string,
    options?: string[]
  ): Promise<number> {
    const args: string[] = ['--right-only', '--count'];
    const result: string = await this.revList(
      [`${branch1}...${branch2}`],
      args,
      options
    );
    return Number(result);
  }

  async isBehind(
    branch1: string,
    branch2: string,
    options?: string[]
  ): Promise<boolean> {
    return (await this.commitsBehind(branch1, branch2, options)) > 0;
  }

  async commitsBehind(
    branch1: string,
    branch2: string,
    options?: string[]
  ): Promise<number> {
    const args: string[] = ['--left-only', '--count'];
    const result: string = await this.revList(
      [`${branch1}...${branch2}`],
      args,
      options
    );
    return Number(result);
  }

  async isEven(branch1: string, branch2: string): Promise<boolean> {
    return (
      !(await this.isAhead(branch1, branch2)) &&
      !(await this.isBehind(branch1, branch2))
    );
  }

  async pull(options?: string[]): Promise<void> {
    const args: string[] = ['pull'];
    if (options) {
      args.push(...options);
    }
    await this.execGit(args);
  }

  async push(options?: string[]): Promise<void> {
    const args: string[] = ['push'];
    if (options) {
      args.push(...options);
    }
    await this.execGit(args);
  }

  async deleteBranch(branchName: string, options?: string[]): Promise<void> {
    const args: string[] = ['branch', '--delete'];
    if (options) {
      args.push(...options);
    }
    args.push(branchName);
    await this.execGit(args);
  }

  async hasDiff(options?: string[]): Promise<boolean> {
    const args: string[] = ['diff', '--quiet'];
    if (options) {
      args.push(...options);
    }
    const output: GitExecOutput = await this.execGit(args, true);
    return output.exitCode === 1;
  }

  async getDefaultBranch(repositoryUrl: string): Promise<string> {
    let output: GitExecOutput | undefined;
    await this._retryHelper.execute(async () => {
      output = await this.execGit([
        'ls-remote',
        '--quiet',
        '--exit-code',
        '--symref',
        repositoryUrl,
        'HEAD'
      ]);
    });

    if (output) {
      // Satisfy compiler, will always be set
      for (let line of output.getStdout().trim().split('\n')) {
        line = line.trim();
        if (line.startsWith('ref:') || line.endsWith('HEAD')) {
          return line
            .substr('ref:'.length, line.length - 'ref:'.length - 'HEAD'.length)
            .trim();
        }
      }
    }

    throw new Error('Unexpected output when retrieving default branch');
  }

  getWorkingDirectory(): string {
    return this._workingDirectory;
  }

  async init(): Promise<void> {
    await this.execGit(['init', this._workingDirectory]);
  }

  async isDetached(): Promise<boolean> {
    // Note, "branch --show-current" would be simpler but isn't available until Git 2.22
    const output: GitExecOutput = await this.execGit(
      ['rev-parse', '--symbolic-full-name', '--verify', '--quiet', 'HEAD'],
      true
    );
    return !output.getStdout().trim().startsWith('refs/heads/');
  }

  async lfsFetch(ref: string): Promise<void> {
    const args: string[] = ['lfs', 'fetch', 'origin', ref];

    /* eslint-disable-next-line @typescript-eslint/no-this-alias */
    const that: GitCommandManager = this;
    await this._retryHelper.execute(async (): Promise<void> => {
      await that.execGit(args);
    });
  }

  async lfsInstall(): Promise<void> {
    await this.execGit(['lfs', 'install', '--local']);
  }

  async log1(format?: string): Promise<string> {
    const args: string[] = format ? ['log', '-1', format] : ['log', '-1'];
    const silent: boolean = !format;
    const output: GitExecOutput = await this.execGit(args, false, silent);
    return output.getStdout();
  }

  async remoteAdd(remoteName: string, remoteUrl: string): Promise<void> {
    await this.execGit(['remote', 'add', remoteName, remoteUrl]);
  }

  removeEnvironmentVariable(name: string): void {
    delete this._gitEnv[name];
  }

  /**
   * Resolves a ref to a SHA. For a branch or lightweight tag, the commit SHA is returned.
   * For an annotated tag, the tag SHA is returned.
   * @param {string} ref  For example: 'refs/heads/main' or '/refs/tags/v1'
   * @returns {Promise<string>}
   */
  async revParse(ref: string): Promise<string> {
    const output: GitExecOutput = await this.execGit(['rev-parse', ref]);
    return output.getStdout().trim();
  }

  setEnvironmentVariable(name: string, value: string): void {
    this._gitEnv[name] = value;
  }

  async shaExists(sha: string): Promise<boolean> {
    const args: string[] = [
      'rev-parse',
      '--verify',
      '--quiet',
      `${sha}^{object}`
    ];
    const output: GitExecOutput = await this.execGit(args, true);
    return output.exitCode === 0;
  }

  async submoduleForeach(command: string, recursive: boolean): Promise<string> {
    const args: string[] = ['submodule', 'foreach'];
    if (recursive) {
      args.push('--recursive');
    }
    args.push(command);

    const output: GitExecOutput = await this.execGit(args);
    return output.getStdout();
  }

  async submoduleSync(recursive: boolean): Promise<void> {
    const args: string[] = ['submodule', 'sync'];
    if (recursive) {
      args.push('--recursive');
    }

    await this.execGit(args);
  }

  async submoduleUpdate(fetchDepth: number, recursive: boolean): Promise<void> {
    const args: string[] = ['-c', 'protocol.version=2'];
    args.push('submodule', 'update', '--init', '--force');
    if (fetchDepth > 0) {
      args.push(`--depth=${fetchDepth}`);
    }

    if (recursive) {
      args.push('--recursive');
    }

    await this.execGit(args);
  }

  async submoduleStatus(): Promise<boolean> {
    const output: GitExecOutput = await this.execGit(
      ['submodule', 'status'],
      true
    );
    core.debug(output.getStdout());
    return output.exitCode === 0;
  }

  async tagExists(pattern: string): Promise<boolean> {
    const output: GitExecOutput = await this.execGit([
      'tag',
      '--list',
      pattern
    ]);
    return !!output.getStdout().trim();
  }

  async tryClean(): Promise<boolean> {
    const output: GitExecOutput = await this.execGit(['clean', '-ffdx'], true);
    return output.exitCode === 0;
  }

  async tryConfigUnset(
    configKey: string,
    globalConfig?: boolean
  ): Promise<boolean> {
    const output: GitExecOutput = await this.execGit(
      [
        'config',
        globalConfig ? '--global' : '--local',
        '--unset-all',
        configKey
      ],
      true
    );
    return output.exitCode === 0;
  }

  async tryDisableAutomaticGarbageCollection(): Promise<boolean> {
    const output: GitExecOutput = await this.execGit(
      ['config', '--local', 'gc.auto', '0'],
      true
    );
    return output.exitCode === 0;
  }

  async tryGetFetchUrl(): Promise<string> {
    const output: GitExecOutput = await this.execGit(
      ['config', '--local', '--get', 'remote.origin.url'],
      true
    );

    if (output.exitCode !== 0) {
      return '';
    }

    const stdout: string = output.getStdout().trim();
    if (stdout.includes('\n')) {
      return '';
    }

    return stdout;
  }

  async tryReset(): Promise<boolean> {
    const output: GitExecOutput = await this.execGit(
      ['reset', '--hard', 'HEAD'],
      true
    );
    return output.exitCode === 0;
  }

  static async createGitCommandManager(
    workingDirectory: string,
    lfs: boolean,
    doSparseCheckout: boolean
  ): Promise<GitCommandManager> {
    const result: GitCommandManager = new GitCommandManager();
    await result.initializeCommandManager(
      workingDirectory,
      lfs,
      doSparseCheckout
    );
    return result;
  }

  async execGit(
    args: string[],
    allowAllExitCodes: boolean = false,
    silent: boolean = false,
    customListeners = {}
  ): Promise<GitExecOutput> {
    fshelper.directoryExistsSync(this._workingDirectory, true);

    const result: GitExecOutput = new GitExecOutput();

    const env: { [key: string]: string } = {};
    for (const key of Object.keys(process.env)) {
      const envVal: string | undefined = process.env[key];
      if (envVal !== undefined) {
        env[key] = envVal;
      }
    }
    for (const key of Object.keys(this._gitEnv)) {
      env[key] = this._gitEnv[key];
    }

    const defaultListener: {
      stderr: (data: Buffer) => void;
      stdout: (data: Buffer) => void;
      debug: (data: string) => void;
    } = {
      stdout: (data: Buffer): void => {
        result.addStdoutLine(data.toString());
      },
      stderr: (data: Buffer): void => {
        result.addStderrLine(data.toString());
      },
      debug: (data: string): void => {
        result.addDebugLine(data);
      }
    };

    const mergedListeners: {
      stderr: (data: Buffer) => void;
      stdout: (data: Buffer) => void;
      debug: (data: string) => void;
    } = { ...defaultListener, ...customListeners };

    const options: ExecOptions = {
      cwd: this._workingDirectory,
      env,
      silent,
      ignoreReturnCode: allowAllExitCodes,
      listeners: mergedListeners
    };

    result.exitCode = await exec.exec(`"${this._gitPath}"`, args, options);

    core.debug(result.exitCode.toString());
    core.debug(result.getDebug());
    core.debug(result.getStdout());
    core.debug(result.getStderr());

    return result;
  }

  private async initializeCommandManager(
    workingDirectory: string,
    lfs: boolean,
    doSparseCheckout: boolean
  ): Promise<void> {
    this._workingDirectory = workingDirectory;

    // Git-lfs will try to pull down assets if any of the local/user/system setting exist.
    // If the user didn't enable `LFS` in their pipeline definition, disable LFS fetch/checkout.
    this._lfs = lfs;
    if (!this._lfs) {
      this._gitEnv['GIT_LFS_SKIP_SMUDGE'] = '1';
    }

    this._gitPath = await io.which('git', true);

    // Git version
    core.debug('Getting git version');
    let gitVersion: GitVersion = new GitVersion();
    let gitOutput: GitExecOutput = await this.execGit(['version']);
    let stdout: string = gitOutput.getStdout().trim();
    if (!stdout.includes('\n')) {
      const match: RegExpMatchArray | null = stdout.match(/\d+\.\d+(\.\d+)?/);
      if (match) {
        gitVersion = new GitVersion(match[0]);
      }
    }
    if (!gitVersion.isValid()) {
      throw new Error('Unable to determine git version');
    }

    // Minimum git version
    if (!gitVersion.checkMinimum(MinimumGitVersion)) {
      throw new Error(
        `Minimum required git version is ${MinimumGitVersion}. Your git ('${this._gitPath}') is ${gitVersion}`
      );
    }

    if (this._lfs) {
      // Git-lfs version
      core.debug('Getting git-lfs version');
      let gitLfsVersion: GitVersion = new GitVersion();
      const gitLfsPath: string = await io.which('git-lfs', true);
      gitOutput = await this.execGit(['lfs', 'version']);
      stdout = gitOutput.getStdout().trim();
      if (!stdout.includes('\n')) {
        const match: RegExpMatchArray | null = stdout.match(/\d+\.\d+(\.\d+)?/);
        if (match) {
          gitLfsVersion = new GitVersion(match[0]);
        }
      }
      if (!gitLfsVersion.isValid()) {
        throw new Error('Unable to determine git-lfs version');
      }

      // Minimum git-lfs version
      // Note:
      // - Auth header not supported before 2.1
      const minimumGitLfsVersion: GitVersion = new GitVersion('2.1');
      if (!gitLfsVersion.checkMinimum(minimumGitLfsVersion)) {
        throw new Error(
          `Minimum required git-lfs version is ${minimumGitLfsVersion}. Your git-lfs ('${gitLfsPath}') is ${gitLfsVersion}`
        );
      }
    }

    this._doSparseCheckout = doSparseCheckout;
    if (this._doSparseCheckout) {
      // The `git sparse-checkout` command was introduced in Git v2.25.0
      const minimumGitSparseCheckoutVersion: GitVersion = new GitVersion(
        '2.25'
      );
      if (!gitVersion.checkMinimum(minimumGitSparseCheckoutVersion)) {
        throw new Error(
          `Minimum Git version required for sparse checkout is ${minimumGitSparseCheckoutVersion}. Your git ('${this._gitPath}') is ${gitVersion}`
        );
      }
    }
    // Set the user agent
    const gitHttpUserAgent: string = `git/${gitVersion} (github-actions-checkout)`;
    core.debug(`Set git useragent to: ${gitHttpUserAgent}`);
    this._gitEnv['GIT_HTTP_USER_AGENT'] = gitHttpUserAgent;
  }

  private async revList(
    commitExpression: string[],
    args?: string[],
    options?: string[]
  ): Promise<string> {
    const argArr: string[] = ['rev-list'];
    if (args) {
      argArr.push(...args);
    }
    argArr.push(...commitExpression);
    if (options) {
      argArr.push(...options);
    }
    const output: GitExecOutput = await this.execGit(argArr);
    return output.getStdout().trim();
  }

  private githubHttpsUrlValidator(
    githubUrl: string,
    remoteUrl: string
  ): IRemoteDetail {
    const githubUrlMatchArray: RegExpMatchArray = this.urlMatcher(githubUrl);
    const host: string = githubUrlMatchArray[1];
    const githubHttpsMatchArray: RegExpMatchArray | null =
      this.githubHttpsUrlMatcher(host, remoteUrl);
    if (githubHttpsMatchArray) {
      return {
        hostname: host,
        protocol: 'HTTPS',
        repository: githubHttpsMatchArray[1]
      };
    }
    throw new Error(
      `The format of '${remoteUrl}' is not a valid GitHub repository URL`
    );
  }

  private urlMatcher(url: string): RegExpMatchArray {
    const matches: RegExpMatchArray | null = /^https?:\/\/(.+)$/i.exec(url);
    if (!matches) {
      throw new Error(ErrorMessages.URL_MATCHER_FAILED);
    }
    return matches;
  }

  private githubHttpsUrlPattern(host: string): RegExp {
    return new RegExp(`^https?://.*@?${host}/(.+/.+?)(\\.git)?$`, 'i');
  }

  private githubHttpsUrlMatcher(
    host: string,
    url: string
  ): RegExpMatchArray | null {
    const ghHttpsUrlPattern: RegExp = this.githubHttpsUrlPattern(host);
    return url.match(ghHttpsUrlPattern);
  }

  get gitEnv(): { [p: string]: string } {
    return this._gitEnv;
  }

  get gitPath(): string {
    return this._gitPath;
  }

  get lfs(): boolean {
    return this._lfs;
  }

  get doSparseCheckout(): boolean {
    return this._doSparseCheckout;
  }

  get workingDirectory(): string {
    return this._workingDirectory;
  }

  get retryHelper(): IRetryHelper {
    return this._retryHelper;
  }
}
