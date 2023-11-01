import {
  GitSourceSettings,
  IGitSourceSettings
} from '../src/git/git-source-settings';

const repositoryPath: string = 'repositoryPath';
const repositoryOwner: string = 'repositoryOwner';
const repositoryName: string = 'repositoryName';
const authToken: string = 'authToken';
const githubServerUrl: string | undefined = 'githubServerUrl';
const workflowOrganizationId: string | undefined = '1234567890';
const sshKey: string | undefined = 'sshKey';
const sshKnownHosts: string | undefined = 'sshKnownHosts';
const sshStrict: boolean | undefined = true;
const persistCredentials: boolean | undefined = true;

describe('Test git-source-settings.ts', (): void => {
  describe('Test constructor', (): void => {
    it('should create a new GitSourceSettings object', (): void => {
      const gitSourceSettings: IGitSourceSettings = new GitSourceSettings(
        repositoryPath,
        repositoryOwner,
        repositoryName,
        authToken,
        githubServerUrl,
        workflowOrganizationId,
        sshKey,
        sshKnownHosts,
        sshStrict,
        persistCredentials
      );
      expect(gitSourceSettings).toBeDefined();
      expect(gitSourceSettings.repositoryPath).toEqual(repositoryPath);
      expect(gitSourceSettings.repositoryOwner).toEqual(repositoryOwner);
      expect(gitSourceSettings.repositoryName).toEqual(repositoryName);
      expect(gitSourceSettings.authToken).toEqual(authToken);
      expect(gitSourceSettings.githubServerUrl).toEqual(githubServerUrl);
      expect(gitSourceSettings.workflowOrganizationId).toEqual(
        workflowOrganizationId
      );
      expect(gitSourceSettings.sshKey).toEqual(sshKey);
      expect(gitSourceSettings.sshKnownHosts).toEqual(sshKnownHosts);
      expect(gitSourceSettings.sshStrict).toEqual(sshStrict);
      expect(gitSourceSettings.persistCredentials).toEqual(persistCredentials);
    });

    it('should create a new GitSourceSettings object with undefined githubServerUrl', (): void => {
      const gitSourceSettings: IGitSourceSettings = new GitSourceSettings(
        repositoryPath,
        repositoryOwner,
        repositoryName,
        authToken,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined
      );
      expect(gitSourceSettings).toBeDefined();
      expect(gitSourceSettings.repositoryPath).toEqual(repositoryPath);
      expect(gitSourceSettings.repositoryOwner).toEqual(repositoryOwner);
      expect(gitSourceSettings.repositoryName).toEqual(repositoryName);
      expect(gitSourceSettings.authToken).toEqual(authToken);
      expect(gitSourceSettings.githubServerUrl).not.toBeDefined();
      expect(gitSourceSettings.workflowOrganizationId).not.toBeDefined();
      expect(gitSourceSettings.sshKey).not.toBeDefined();
      expect(gitSourceSettings.sshKnownHosts).not.toBeDefined();
      expect(gitSourceSettings.sshStrict).not.toBeDefined();
      expect(gitSourceSettings.persistCredentials).not.toBeDefined();
    });
  });
});
