export class GitExecOutput {
  private _exitCode: number;
  private _stdout: string[];
  private _stderr: string[];
  private _debug: string[];

  constructor() {
    this._exitCode = 0;
    this._stdout = [];
    this._stderr = [];
    this._debug = [];
  }

  get exitCode(): number {
    return this._exitCode;
  }

  set exitCode(value: number) {
    this._exitCode = value;
  }

  get stdout(): string[] {
    return this._stdout;
  }

  set stdout(value: string[]) {
    this._stdout = value;
  }

  get stderr(): string[] {
    return this._stderr;
  }

  set stderr(value: string[]) {
    this._stderr = value;
  }

  get debug(): string[] {
    return this._debug;
  }

  set debug(value: string[]) {
    this._debug = value;
  }

  addStdoutLine(line: string): void {
    this._stdout.push(line);
  }

  getStdout(): string {
    return this._stdout.join('\n');
  }

  addStderrLine(line: string): void {
    this._stderr.push(line);
  }

  getStderr(): string {
    return this._stderr.join('\n');
  }

  addDebugLine(line: string): void {
    this._debug.push(line);
  }

  getDebug(): string {
    return this._debug.join('\n');
  }
}
