import { escape } from '../../src/git/regexp-helper';

describe('Test regexp-helper.ts', (): void => {
  describe('Test escape function', (): void => {
    it('Should replace characters with a backslash except alphanumeric and underscore', (): void => {
      const result: string = escape('a1b2c3_!@#');
      expect(result).toBe('a1b2c3_\\!\\@\\#');
    });
  });
});
