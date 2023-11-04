import { GitExecOutput } from '../../src/git/git-exec-output';

describe('Test git-exec-output.ts', (): void => {
  let gitExecOutputs: GitExecOutput;

  beforeEach((): void => {
    gitExecOutputs = new GitExecOutput();
  });

  it('should create a new GitExecOutputs object', (): void => {
    expect(gitExecOutputs).toBeDefined();
    expect(gitExecOutputs.stdout).toEqual([]);
    expect(gitExecOutputs.stderr).toEqual([]);
    expect(gitExecOutputs.exitCode).toEqual(0);
    expect(gitExecOutputs.debug).toEqual([]);
  });

  it('should set stdout', (): void => {
    gitExecOutputs.stdout = ['stdout'];
    expect(gitExecOutputs.stdout).toEqual(['stdout']);
    gitExecOutputs.addStdoutLine('stdout1');
    expect(gitExecOutputs.stdout).toEqual(['stdout', 'stdout1']);
  });

  it('should set stderr', (): void => {
    gitExecOutputs.stderr = ['stderr'];
    expect(gitExecOutputs.stderr).toEqual(['stderr']);
    gitExecOutputs.addStderrLine('stderr1');
    expect(gitExecOutputs.stderr).toEqual(['stderr', 'stderr1']);
  });

  it('should set exitCode', (): void => {
    gitExecOutputs.exitCode = 1;
    expect(gitExecOutputs.exitCode).toEqual(1);
  });

  it('should set debug', (): void => {
    gitExecOutputs.debug = ['debug'];
    expect(gitExecOutputs.debug).toEqual(['debug']);
    gitExecOutputs.addDebugLine('debug1');
    expect(gitExecOutputs.debug).toEqual(['debug', 'debug1']);
  });

  it('should get stdout', (): void => {
    gitExecOutputs.stdout = ['stdout'];
    expect(gitExecOutputs.getStdout()).toEqual('stdout');
    gitExecOutputs.addStdoutLine('stdout1');
    expect(gitExecOutputs.getStdout()).toEqual('stdout\nstdout1');
  });

  it('should get stderr', (): void => {
    gitExecOutputs.stderr = ['stderr'];
    expect(gitExecOutputs.getStderr()).toEqual('stderr');
    gitExecOutputs.addStderrLine('stderr1');
    expect(gitExecOutputs.getStderr()).toEqual('stderr\nstderr1');
  });

  it('should get debug', (): void => {
    gitExecOutputs.debug = ['debug'];
    expect(gitExecOutputs.getDebug()).toEqual('debug');
    gitExecOutputs.addDebugLine('debug1');
    expect(gitExecOutputs.getDebug()).toEqual('debug\ndebug1');
  });
});
