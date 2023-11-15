import { IInputs, prepareInputValues } from '../src/inputs';

describe('Test inputs.ts', (): void => {
  describe('Test prepareInputValues function', (): void => {
    /* eslint-disable jest/expect-expect */
    it('should return IInputs with default values', (): void => {
      setRequiredProcessEnvValues();
      const inputs: IInputs = prepareInputValues();
      verifyRequiredValues(inputs);
      verifyOptionalDefaultValues(inputs);
    });
    /* eslint-enable */

    it('should return IInputs with overriding values', (): void => {
      setRequiredProcessEnvValues();
      setOptionalProcessEnvValues();
      setValidOptionalProcessEnvValues();
      const inputs: IInputs = prepareInputValues();
      verifyRequiredValues(inputs);
      verifyOptionalOverrideValues(inputs);
      expect(inputs.MERGE_METHOD).toBe('squash');
    });

    it('should throw exception when invalid value passed in', (): void => {
      setRequiredProcessEnvValues();
      setOptionalProcessEnvValues();
      setInvalidOptionalProcessEnvValues();
      const inputs: IInputs = prepareInputValues();
      verifyRequiredValues(inputs);
      verifyOptionalOverrideValues(inputs);
      expect(inputs.MERGE_METHOD).toBe('merge');
    });

    it('should be able to reset PR_BODY value', (): void => {
      setRequiredProcessEnvValues();
      setOptionalProcessEnvValues();
      setValidOptionalProcessEnvValues();
      const inputs: IInputs = prepareInputValues();
      const existingPRBody: string = inputs.PR_BODY;
      expect(existingPRBody).toBe('pr-body');
      inputs.PR_BODY = 'new-pr-body';
      expect(inputs.PR_BODY).toBe('new-pr-body');
    });
  });
});

function setRequiredProcessEnvValues(): void {
  process.env['INPUT_GITHUB_TOKEN'] = 'git-token';
  process.env['INPUT_REPO_OWNER'] = '3dwardch3ng';
  process.env['INPUT_REPO_NAME'] = 'git-pull-request';
  process.env['INPUT_SOURCE_BRANCH'] = 'source-branch';
  process.env['INPUT_TARGET_BRANCH'] = 'target-branch';
  process.env['INPUT_PR_TITLE'] = 'pr-title';
}

function setOptionalProcessEnvValues(): void {
  process.env['INPUT_REMOTE_NAME'] = 'remote-name';
  process.env['INPUT_PR_BODY'] = 'pr-body';
  process.env['INPUT_DRAFT'] = 'true';
  process.env['INPUT_REQUIRE_MIDDLE_BRANCH'] = 'true';
  process.env['INPUT_AUTO_MERGE'] = 'true';
  process.env['INPUT_MAX_MERGE_RETRIES'] = '30';
  process.env['INPUT_MERGE_RETRY_INTERVAL'] = '30';
  process.env['INPUT_MILESTONE'] = '2';
  process.env['INPUT_ASSIGNEES'] = '3dwardch3ng';
  process.env['INPUT_REVIEWERS'] = '3dwardch3ng';
  process.env['INPUT_TEAM_REVIEWERS'] = '3dwardch3ng';
  process.env['INPUT_LABELS'] = 'label';
  process.env['INPUT_SIGNOFF'] = 'true';
}

function setValidOptionalProcessEnvValues(): void {
  process.env['INPUT_MERGE_METHOD'] = 'squash';
}

function setInvalidOptionalProcessEnvValues(): void {
  process.env['INPUT_MERGE_METHOD'] = 'unknown';
}

function verifyRequiredValues(inputs: IInputs): void {
  expect(inputs.GITHUB_TOKEN).toBe('git-token');
  expect(inputs.REPO_OWNER).toBe('3dwardch3ng');
  expect(inputs.REPO_NAME).toBe('git-pull-request');
  expect(inputs.SOURCE_BRANCH_NAME).toBe('source-branch');
  expect(inputs.TARGET_BRANCH_NAME).toBe('target-branch');
  expect(inputs.PR_TITLE).toBe('pr-title');
}

function verifyOptionalDefaultValues(inputs: IInputs): void {
  expect(inputs.REMOTE_NAME).toBe('origin');
  expect(inputs.PR_BODY).toBe('');
  expect(inputs.DRAFT).toBe(false);
  expect(inputs.REQUIRE_MIDDLE_BRANCH).toBe(false);
  expect(inputs.AUTO_MERGE).toBe(false);
  expect(inputs.MERGE_METHOD).toBe('merge');
  expect(inputs.MAX_MERGE_RETRIES).toBe(60);
  expect(inputs.MERGE_RETRY_INTERVAL).toBe(60);
  expect(inputs.MILESTONE).toBe(undefined);
  expect(inputs.ASSIGNEES).toBe(undefined);
  expect(inputs.REVIEWERS).toBe(undefined);
  expect(inputs.TEAM_REVIEWERS).toBe(undefined);
  expect(inputs.LABELS).toBe(undefined);
  expect(inputs.SIGNOFF).toBe(false);
}

function verifyOptionalOverrideValues(inputs: IInputs): void {
  expect(inputs.REMOTE_NAME).toBe('remote-name');
  expect(inputs.PR_BODY).toBe('pr-body');
  expect(inputs.DRAFT).toBe(true);
  expect(inputs.REQUIRE_MIDDLE_BRANCH).toBe(true);
  expect(inputs.AUTO_MERGE).toBe(true);
  expect(inputs.MAX_MERGE_RETRIES).toBe(30);
  expect(inputs.MERGE_RETRY_INTERVAL).toBe(30);
  expect(inputs.MILESTONE).toBe(2);
  expect(inputs.ASSIGNEES).toStrictEqual(['3dwardch3ng']);
  expect(inputs.REVIEWERS).toStrictEqual(['3dwardch3ng']);
  expect(inputs.TEAM_REVIEWERS).toStrictEqual(['3dwardch3ng']);
  expect(inputs.LABELS).toStrictEqual(['label']);
  expect(inputs.SIGNOFF).toBe(true);
}
