import * as assert from 'assert';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as promises from 'fs/promises';
import * as io from '@actions/io';
import * as os from 'os';
import * as path from 'path';
import { IGitCommandManager } from './git-command-manager';
import { IGitSourceSettings } from './git-source-settings';
import { URL } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { Constants } from './constants';

export interface IGitAuthHelper {
  readonly IS_WINDOWS: boolean;
  readonly SSH_COMMAND_KEY: string;
  readonly git: IGitCommandManager;
  readonly settings: IGitSourceSettings;
  readonly tokenConfigKey: string;
  readonly tokenConfigValue: string;
  readonly insteadOfKey: string;
  readonly insteadOfValues: string[];
  readonly sshCommand: string;
  readonly sshKeyPath: string;
  readonly sshKnownHostsPath: string;
  configureAuth(): Promise<void>;
  removeAuth(): Promise<void>;
}

export class GitAuthHelper implements IGitAuthHelper {
  private readonly _IS_WINDOWS: boolean = process.platform === 'win32';
  private readonly _SSH_COMMAND_KEY: string = 'core.sshCommand';
  private readonly _git: IGitCommandManager;
  private readonly _settings: IGitSourceSettings;
  private readonly _tokenConfigKey: string;
  private readonly _tokenConfigValue: string;
  private readonly _insteadOfKey: string;
  private readonly _insteadOfValues: string[] = [];
  private _sshCommand: string = '';
  private _sshKeyPath: string = '';
  private _sshKnownHostsPath: string = '';

  constructor(
    gitCommandManager: IGitCommandManager,
    gitSourceSettings: IGitSourceSettings
  ) {
    core.startGroup('Starting Git Auth Helper');
    this._git = gitCommandManager;
    this._settings = gitSourceSettings;

    // Token auth header
    const serverUrl: URL = this.getServerUrl(this.settings.githubServerUrl);
    this._tokenConfigKey = `http.${serverUrl.origin}/.extraheader`; // "origin" is SCHEME://HOSTNAME[:PORT]
    const basicCredential: string = Buffer.from(
      `x-access-token:${this.settings.authToken}`,
      'utf8'
    ).toString('base64');
    core.setSecret(basicCredential);
    this._tokenConfigValue = `AUTHORIZATION: basic ${basicCredential}`;

    // Instead of SSH URL
    this._insteadOfKey = `url.${serverUrl.origin}/.insteadOf`; // "origin" is SCHEME://HOSTNAME[:PORT]
    this.insteadOfValues.push(`git@${serverUrl.hostname}:`);
    if (this.settings.workflowOrganizationId) {
      this.insteadOfValues.push(
        `org-${this.settings.workflowOrganizationId}@github.com:`
      );
    }
    core.endGroup();
  }

  async configureAuth(): Promise<void> {
    // Remove possible previous values
    await this.removeAuth();

    // Configure new values
    await this.configureSsh();
    await this.configureToken();
  }

  async removeAuth(): Promise<void> {
    await this.removeSsh();
    await this.removeToken();
  }

  private async configureSsh(): Promise<void> {
    if (!this.settings.sshKey) {
      return;
    }

    // Write key
    const runnerTemp: string | undefined = process.env['RUNNER_TEMP'];
    assert.ok(runnerTemp, 'RUNNER_TEMP is not defined');
    const uniqueId: string = uuidv4();
    this._sshKeyPath = path.join(runnerTemp, uniqueId);
    this.setState('sshKeyPath', this.sshKeyPath);
    await promises.mkdir(runnerTemp, { recursive: true });
    await promises.writeFile(
      this.sshKeyPath,
      `${this.settings.sshKey.trim()}\n`,
      { mode: 0o600 }
    );

    // Remove inherited permissions on Windows
    if (this.IS_WINDOWS) {
      const icacls: string = await io.which('icacls.exe');
      await exec.exec(
        `"${icacls}" "${this.sshKeyPath}" /grant:r "${process.env['USERDOMAIN']}\\${process.env['USERNAME']}:F"`
      );
      await exec.exec(`"${icacls}" "${this.sshKeyPath}" /inheritance:r`);
    }

    // Write known hosts
    const userKnownHostsPath: string = path.join(
      os.homedir(),
      '.ssh',
      'known_hosts'
    );
    let userKnownHosts: string = '';
    try {
      userKnownHosts = (await promises.readFile(userKnownHostsPath)).toString();
    } catch (err) {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      if ((err as any)?.code !== 'ENOENT') {
        throw err;
      }
    }
    let knownHosts: string = '';
    if (userKnownHosts) {
      knownHosts += `# Begin from ${userKnownHostsPath}\n${userKnownHosts}\n# End from ${userKnownHostsPath}\n`;
    }
    if (this.settings.sshKnownHosts) {
      knownHosts += `# Begin from input known hosts\n${this.settings.sshKnownHosts}\n# end from input known hosts\n`;
    }
    knownHosts += `# Begin implicitly added github.com\ngithub.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCj7ndNxQowgcQnjshcLrqPEiiphnt+VTTvDP6mHBL9j1aNUkY4Ue1gvwnGLVlOhGeYrnZaMgRK6+PKCUXaDbC7qtbW8gIkhL7aGCsOr/C56SJMy/BCZfxd1nWzAOxSDPgVsmerOBYfNqltV9/hWCqBywINIR+5dIg6JTJ72pcEpEjcYgXkE2YEFXV1JHnsKgbLWNlhScqb2UmyRkQyytRLtL+38TGxkxCflmO+5Z8CSSNY7GidjMIZ7Q4zMjA2n1nGrlTDkzwDCsw+wqFPGQA179cnfGWOWRVruj16z6XyvxvjJwbz0wQZ75XK5tKSb7FNyeIEs4TT4jk+S4dhPeAUC5y+bDYirYgM4GC7uEnztnZyaVWQ7B381AK4Qdrwt51ZqExKbQpTUNn+EjqoTwvqNj4kqx5QUCI0ThS/YkOxJCXmPUWZbhjpCg56i+2aB6CmK2JGhn57K5mj0MNdBXA4/WnwH6XoPWJzK5Nyu2zB3nAZp+S5hpQs+p1vN1/wsjk=\n# End implicitly added github.com\n`;
    this._sshKnownHostsPath = path.join(runnerTemp, `${uniqueId}_known_hosts`);
    this.setState('sshKnownHostsPath', this.sshKnownHostsPath);
    await promises.writeFile(this.sshKnownHostsPath, knownHosts);

    // Configure GIT_SSH_COMMAND
    const sshPath: string = await io.which('ssh', true);
    this._sshCommand = `"${sshPath}" -i "$RUNNER_TEMP/${path.basename(
      this.sshKeyPath
    )}"`;
    if (this.settings.sshStrict) {
      this._sshCommand += ' -o StrictHostKeyChecking=yes -o CheckHostIP=no';
    }
    this._sshCommand += ` -o "UserKnownHostsFile=$RUNNER_TEMP/${path.basename(
      this.sshKnownHostsPath
    )}"`;
    core.info(`Temporarily overriding GIT_SSH_COMMAND=${this.sshCommand}`);
    this.git.setEnvironmentVariable('GIT_SSH_COMMAND', this.sshCommand);

    // Configure core.sshCommand
    if (this.settings.persistCredentials) {
      await this.git.config(this.SSH_COMMAND_KEY, this.sshCommand);
    }
  }

  private async configureToken(
    configPath?: string,
    globalConfig?: boolean
  ): Promise<void> {
    // Validate args
    assert.ok(
      (configPath && globalConfig) || (!configPath && !globalConfig),
      'Unexpected configureToken parameter combinations'
    );

    // Default config path
    if (!configPath && !globalConfig) {
      configPath = path.join(this.git.workingDirectory, '.git', 'config');
    }

    // Configure a placeholder value. This approach avoids the credential being captured
    // by process creation audit events, which are commonly logged. For more information,
    // refer to https://docs.microsoft.com/en-us/windows-server/identity/ad-ds/manage/component-updates/command-line-process-auditing
    await this.git.config(
      this.tokenConfigKey,
      Constants.TOKEN_PLACEHOLDER_CONFIG_VALUE,
      globalConfig
    );

    // Replace the placeholder
    await this.replaceTokenPlaceholder(configPath);
  }

  private async replaceTokenPlaceholder(
    configPath: string | undefined
  ): Promise<void> {
    assert.ok(configPath, 'configPath is not defined');
    let content: string = (await promises.readFile(configPath)).toString();
    const placeholderIndex: number = content.indexOf(
      Constants.TOKEN_PLACEHOLDER_CONFIG_VALUE
    );
    if (
      placeholderIndex < 0 ||
      placeholderIndex !==
        content.lastIndexOf(Constants.TOKEN_PLACEHOLDER_CONFIG_VALUE)
    ) {
      throw new Error(`Unable to replace auth placeholder in ${configPath}`);
    }
    assert.ok(this.tokenConfigValue, 'tokenConfigValue is not defined');
    content = content.replace(
      Constants.TOKEN_PLACEHOLDER_CONFIG_VALUE,
      this.tokenConfigValue
    );
    await promises.writeFile(configPath, content);
  }

  private async removeSsh(): Promise<void> {
    // SSH key
    const keyPath: string = this.sshKeyPath || this.getState('sshKeyPath');
    if (keyPath) {
      try {
        await io.rmRF(keyPath);
      } catch (err) {
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        core.debug(`${(err as any)?.message ?? err}`);
        core.warning(`Failed to remove SSH key '${keyPath}'`);
      }
    }

    // SSH known hosts
    const knownHostsPath: string =
      this.sshKnownHostsPath || this.getState('sshKnownHostsPath');
    if (knownHostsPath) {
      try {
        await io.rmRF(knownHostsPath);
      } catch {
        // Intentionally empty
      }
    }

    // SSH command
    await this.removeGitConfig(this.SSH_COMMAND_KEY);
  }

  private async removeToken(): Promise<void> {
    // HTTP extra header
    await this.removeGitConfig(this.tokenConfigKey);
  }

  private async removeGitConfig(configKey: string): Promise<void> {
    if (
      (await this.git.configExists(configKey)) &&
      !(await this.git.unsetConfig(configKey))
    ) {
      // Load the config contents
      core.warning(`Failed to remove '${configKey}' from the git config`);
    }
  }

  private setState(key: string, value: string): void {
    core.saveState(key, value);
  }

  private getState(key: string): string {
    return core.getState(key);
  }

  private getServerUrl(url?: string): URL {
    const urlValue: string =
      url && url.trim().length > 0
        ? url
        : process.env['GITHUB_SERVER_URL'] ?? 'https://github.com';
    core.debug(`Server URL: "${urlValue}"`);
    return new URL(urlValue);
  }

  get IS_WINDOWS(): boolean {
    return this._IS_WINDOWS;
  }

  get SSH_COMMAND_KEY(): string {
    return this._SSH_COMMAND_KEY;
  }

  get git(): IGitCommandManager {
    return this._git;
  }

  get settings(): IGitSourceSettings {
    return this._settings;
  }

  get tokenConfigKey(): string {
    return this._tokenConfigKey;
  }

  get tokenConfigValue(): string {
    return this._tokenConfigValue;
  }

  get insteadOfKey(): string {
    return this._insteadOfKey;
  }

  get insteadOfValues(): string[] {
    return this._insteadOfValues;
  }

  get sshCommand(): string {
    return this._sshCommand;
  }

  get sshKeyPath(): string {
    return this._sshKeyPath;
  }

  get sshKnownHostsPath(): string {
    return this._sshKnownHostsPath;
  }
}
