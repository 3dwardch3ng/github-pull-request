import { IWorkflowUtils, WorkflowUtils } from './workflow-utils';
import * as core from '@actions/core';
import { createService, IService } from './service';
import { Pull } from './github-client';
import { IInputs, prepareInputValues } from './inputs';

export const run: () => Promise<void> = async (): Promise<void> => {
  const workflowUtils: IWorkflowUtils = new WorkflowUtils();

  try {
    const inputs: IInputs = prepareInputValues();
    const service: IService = createService(inputs);
    core.startGroup('Starting to create pull request');
    let pullRequest: Pull = await service.createPullRequest();
    core.endGroup();
    if (pullRequest.number !== 0 && inputs.AUTO_MERGE) {
      core.startGroup('Starting to merge pull request');
      pullRequest = await service.mergePullRequestWithRetries(pullRequest);
      core.endGroup();
    }

    core.startGroup('Setting outputs');
    core.setOutput('pull-request-number', pullRequest.number);
    core.setOutput('pull-request-url', pullRequest.html_url);
    core.setOutput('pull-request-operation', pullRequest.action);
    core.setOutput('pull-request-created', pullRequest.created);
    core.setOutput('pull-request-head-sha', pullRequest.sha);
    core.setOutput('pull-request-merged', pullRequest.merged);
    core.endGroup();
  } catch (error) {
    core.setFailed(workflowUtils.getErrorMessage(error));
  }
};

// eslint-disable-next-line github/no-then
run().then(() => core.info('Action finished successfully'));
