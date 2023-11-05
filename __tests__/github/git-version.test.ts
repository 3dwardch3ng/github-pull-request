import { GitVersion } from '../../src/github/git-version';

jest.mock('../../src/github/git-version');

describe('Test git-version.ts', (): void => {
  describe('Test constructor', (): void => {
    it('should create an instance of GitVersion', (): void => {
      const result: GitVersion = new GitVersion('1.2.3');

      expect(result).toBeInstanceOf(GitVersion);
      expect(GitVersion).toHaveBeenCalledTimes(1);
      expect(GitVersion).toHaveBeenCalledWith('1.2.3');
    });
  });

  describe('Test checkMinimum function', (): void => {
    let GitVersionModule: typeof import('../../src/github/git-version');
    let minimal: GitVersion;

    beforeAll((): void => {
      GitVersionModule = jest.requireActual('../../src/github/git-version');
      minimal = new GitVersionModule.GitVersion('1.2.3');
    });

    it('should return false when minimum is not a valid version', (): void => {
      const minimum: GitVersion = new GitVersionModule.GitVersion(
        'ONE.TWO.THREE'
      );
      const current: GitVersion = new GitVersionModule.GitVersion('2.39.3');
      expect(() => current.checkMinimum(minimum)).toThrow(
        new Error('Arg minimum is not a valid version')
      );
    });

    it('should return false when major is insufficient', (): void => {
      const current: GitVersion = new GitVersionModule.GitVersion('0.0.1');
      const result: boolean = current.checkMinimum(minimal);
      expect(result).toBe(false);
    });

    it('should return false when major is equal and minor is insufficient', (): void => {
      const current: GitVersion = new GitVersionModule.GitVersion('1.1.1');
      const result: boolean = current.checkMinimum(minimal);
      expect(result).toBe(false);
    });

    it('should return false when major and minor are equal and patch is insufficient', (): void => {
      const current: GitVersion = new GitVersionModule.GitVersion('1.2.2');
      const result: boolean = current.checkMinimum(minimal);
      expect(result).toBe(false);
    });

    it('should return true', (): void => {
      const current: GitVersion = new GitVersionModule.GitVersion('2.0.0');
      const result: boolean = current.checkMinimum(minimal);
      expect(result).toBe(true);
    });
  });

  describe('Test toString function', (): void => {
    let GitVersionModule: typeof import('../../src/github/git-version');

    beforeAll((): void => {
      GitVersionModule = jest.requireActual('../../src/github/git-version');
    });

    it('should throw error when current version is invalid', (): void => {
      const version: GitVersion = new GitVersionModule.GitVersion(
        'ONE.TWO.THREE'
      );
      const result: string = version.toString();
      expect(result).toEqual('');
    });

    it('should display the version', (): void => {
      const version: GitVersion = new GitVersionModule.GitVersion('1.2.3');
      const result: string = version.toString();
      expect(result).toEqual('1.2.3');
    });

    it('should display the major and minor version when patch version is invalid', (): void => {
      const version: GitVersion = new GitVersionModule.GitVersion('1.2');
      const result: string = version.toString();
      expect(result).toEqual('1.2');
    });
  });
});
