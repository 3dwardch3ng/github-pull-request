import * as core from '@actions/core';

/**
 * Indicates whether the POST action is running
 */
export const IsPost: boolean = !!core.getState('isPost');

/**
 * The SSH key path for the POST action. The value is empty during the MAIN action.
 */
export const SshKeyPath: string = core.getState('sshKeyPath');

/**
 * The SSH known hosts path for the POST action. The value is empty during the MAIN action.
 */
export const SshKnownHostsPath: string = core.getState('sshKnownHostsPath');

/**
 * Save the SSH key path so the POST action can retrieve the value.
 */
export function setSshKeyPath(sshKeyPath: string): void {
  core.saveState('sshKeyPath', sshKeyPath);
}

/**
 * Save the SSH known hosts path so the POST action can retrieve the value.
 */
export function setSshKnownHostsPath(sshKnownHostsPath: string): void {
  core.saveState('sshKnownHostsPath', sshKnownHostsPath);
}

// Publish a variable so that when the POST action runs, it can determine it should run the cleanup logic.
// This is necessary since we don't have a separate entry point.
if (!IsPost) {
  core.saveState('isPost', 'true');
}
