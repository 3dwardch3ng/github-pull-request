# github-pull-request

Github Actions for the create (and merge) Github Pull Request

### Status
![GitHub](https://img.shields.io/github/license/3dwardch3ng/github-pull-request)
![GitHub release (with filter)](https://img.shields.io/github/v/release/3dwardch3ng/github-pull-request)
![GitHub contributors](https://img.shields.io/github/contributors/3dwardch3ng/github-pull-request)
#### Release
![GitHub release (with filter)](https://img.shields.io/github/v/release/3dwardch3ng/github-pull-request)
![CI](https://github.com/3dwardCh3nG/github-pull-request/actions/workflows/ci.yml/badge.svg?branch=main)
[![GitHub Super-Linter](https://github.com/3dwardCh3nG/github-pull-request/actions/workflows/linter.yml/badge.svg?branch=main)](https://github.com/super-linter/super-linter)
#### Next
![GitHub release (with filter)](https://img.shields.io/github/v/release/3dwardch3ng/github-pull-request?filter=*-next*)
![CI](https://github.com/3dwardCh3nG/github-pull-request/actions/workflows/ci.yml/badge.svg?branch=next)
[![GitHub Super-Linter](https://github.com/3dwardCh3nG/github-pull-request/actions/workflows/linter.yml/badge.svg?branch=next)](https://github.com/super-linter/super-linter)
#### Develop
![GitHub release (with filter)](https://img.shields.io/github/v/release/3dwardch3ng/github-pull-request?filter=*-develop*)
![CI](https://github.com/3dwardCh3nG/github-pull-request/actions/workflows/ci.yml/badge.svg?branch=develop)
[![GitHub Super-Linter](https://github.com/3dwardCh3nG/github-pull-request/actions/workflows/linter.yml/badge.svg?branch=develop)](https://github.com/super-linter/super-linter)
[![Dependency Review](https://github.com/3dwardCh3nG/github-pull-request/actions/workflows/dependency-review.yml/badge.svg)](https://github.com/3dwardCh3nG/github-pull-request/actions/workflows/dependency-review.yml)
![Unit Test](badges/coverage.svg)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=3dwardCh3nG_github-pull-request&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=3dwardCh3nG_github-pull-request)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=3dwardCh3nG_github-pull-request&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=3dwardCh3nG_github-pull-request)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=3dwardCh3nG_github-pull-request&metric=sqale_index)](https://sonarcloud.io/summary/new_code?id=3dwardCh3nG_github-pull-request)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=3dwardCh3nG_github-pull-request&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=3dwardCh3nG_github-pull-request)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=3dwardCh3nG_github-pull-request&metric=bugs)](https://sonarcloud.io/summary/new_code?id=3dwardCh3nG_github-pull-request)

## Usage

### `workflow.yml` Example

Place in a `.yml` file such as this one in your `.github/workflows` folder. [Refer to the documentation on workflow YAML syntax here.](https://help.github.com/en/articles/workflow-syntax-for-github-actions)

```yaml
name: Create and Merge Github Pull Request

on:
  push:
    branches:
      - master

jobs:
  delete-s3:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@master
    - uses: 3dwardCh3nG/github-pull-request@v1
      with:
        github_token: ${{ secrets.GH_TOKEN }}
        repo_owner: '3dwardch3ng'
        repo_name: 'github-pull-request'
        source_branch: 'master'
        target_branch: 'develop'
        pr_title: 'Merge PR from Master to Develop'
        require_middle_branch: true
        auto_merge: true
        max_merge_retries: 60
        merge_retry_interval: 60
```

## Action inputs
Please follow below to see all the inputs for the action.

| name                          | description                                                                                           | Default Value           |
|-------------------------------|-------------------------------------------------------------------------------------------------------|-------------------------|
| `github_token`                | The GitHub Token                                                                                      |                         |
| `repo_owner`                  | The repository owner                                                                                  |                         | 
| `repo_name`                   | The repository name                                                                                   |                         |
| `remote_name`                 | (Optional) The remote name, default is origin if not provided                                         |                         |
| `source_branch`               | The name of the branch that the new Pull Request will be merged from                                  |                         |
| `target_branch`               | The name of the branch that the new Pull Request will be merged to                                    |                         |
| `pr_title`                    | The title of the Pull Request                                                                         |                         |
| `pr_body`                     | (Optional) The body content of the Pull Request, will use the value of the title if not provided      |                         |
| `draft`                       | (Optional) A draft PR will be created if set to true                                                  | Default value: false.   |
| `require_middle_branch`       | (Optional) Will create a branch named SOURCE_BRANCH-merge-to-TARGET_BRANCH to create the Pull Request | Default value: false.   |
| `auto_merge`                  | (Optional) Once the Pull Request has been created, whether to merge this Pull Request automatically   | Default value: false.   |
| `merge_method`                | (Optional) The merge method when merging the Pull Request, can be 'merge', 'squash' or 'rebase'       | Default value: 'merge'. |
| `max_merge_retries`           | (Optional) When merge the Pull Request fails, the maximum number of the retry times.                  | Default value: 60.      |
| `merge_retry_interval`        | (Optional) The interval between each retry, in seconds                                                | Default value: 60.      |
| `milestone`                   | (Optional) The milestone value of the Pull Request                                                    |                         |
| `assignees`                   | (Optional) The assignees value of the Pull Request, seperated by comma                                |                         |
| `reviewers`                   | (Optional) The reviewers value of the Pull Request, seperated by comma                                |                         |
| `team_reviewers`              | (Optional) The team reviewers value of the Pull Request, seperated by comma                           |                         |
| `labels`                      | (Optional) The labels value of the Pull Request, seperated by comma                                   |                         |
| `signoff`                     | (Optional) The sign off value of the Pull Request                                                     | Default value: false.   |

## Logs
In order to enable to debug logs, you need to enable to Step Debug Logs by setting the secret `ACTIONS_STEP_DEBUG` to `true`. (see: [Step Debug Logs](https://github.com/actions/toolkit/blob/master/docs/action-debugging.md#step-debug-logs))

## License
MIT License
