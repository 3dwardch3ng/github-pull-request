import * as core from '@actions/core';
import * as stateHelper from '../../src/github/state-helper';
import {
  setSshKeyPath,
  setSshKnownHostsPath
} from '../../src/github/state-helper';

describe('Test state-helper.ts', (): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let saveStateSpy: jest.SpyInstance<void, [name: string, value: any]>;

  beforeAll((): void => {
    saveStateSpy = jest
      .spyOn(core, 'saveState')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((name: string, value: any): void => {
        process.env[`STATE_${name}`] = value;
      });
  });

  it('should set isPost state to true', (): void => {
    const currentSSHKeyPathValue: string = stateHelper.SshKeyPath;
    const currentSSHKnownHostsPathValue: string = stateHelper.SshKnownHostsPath;

    setSshKeyPath('newSSHKeyPath');
    setSshKnownHostsPath('newSSHKnownHostsPath');

    expect(saveStateSpy).toHaveBeenCalledTimes(2);
    expect(saveStateSpy).toHaveBeenCalledWith('sshKeyPath', 'newSSHKeyPath');
    expect(saveStateSpy).toHaveBeenCalledWith(
      'sshKnownHostsPath',
      'newSSHKnownHostsPath'
    );
    const newSSHKeyPathValue: string = core.getState('sshKeyPath');
    expect(newSSHKeyPathValue).not.toEqual(currentSSHKeyPathValue);
    expect(newSSHKeyPathValue).toEqual('newSSHKeyPath');
    const newSSHKnownHostsPathValue: string =
      core.getState('sshKnownHostsPath');
    expect(newSSHKnownHostsPathValue).not.toEqual(
      currentSSHKnownHostsPathValue
    );
    expect(newSSHKnownHostsPathValue).toEqual('newSSHKnownHostsPath');
  });
});
