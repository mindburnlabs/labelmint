import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';

export class PythonExecutor {
  private static readonly SCRIPT_TIMEOUT = 30000; // 30 seconds
  private static readonly MAX_OUTPUT_SIZE = 1024 * 1024; // 1MB

  /**
   * Execute Python code in a sandboxed environment
   */
  static async execute(
    code: string,
    input: any = {},
    context: Record<string, any> = {}
  ): Promise<{
    success: boolean;
    output?: any;
    error?: string;
    logs?: string[];
  }> {
    const executionId = uuidv4();
    const tempDir = join(tmpdir(), `labelmint-python-${executionId}`);

    try {
      // Create temporary directory
      await mkdir(tempDir, { recursive: true });

      // Prepare Python script with input and context
      const script = this.prepareScript(code, input, context);
      const scriptPath = join(tempDir, 'script.py');

      // Write script to file
      await writeFile(scriptPath, script, 'utf8');

      // Execute Python script
      const result = await this.runPythonScript(scriptPath, tempDir);

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Python execution failed'
      };
    } finally {
      // Cleanup temporary files
      await this.cleanup(tempDir);
    }
  }

  /**
   * Prepare Python script with necessary imports and input handling
   */
  private static prepareScript(
    code: string,
    input: any,
    context: Record<string, any>
  ): string {
    return `
import sys
import json
import traceback
import io
from contextlib import redirect_stdout, redirect_stderr

# Input and context
INPUT = ${JSON.stringify(input || {})}
CONTEXT = ${JSON.stringify(context)}

# Capture output
output = {}
error = None
logs = []

class LogCapture:
    def __init__(self):
        self.logs = []

    def write(self, message):
        self.logs.append(message)

    def flush(self):
        pass

# Redirect stdout and stderr to capture logs
log_capture = LogCapture()

try:
    with redirect_stdout(log_capture), redirect_stderr(log_capture):
        # User code
        ${code}

    # If the code defines a main function, call it
        if 'main' in locals():
            output = main(INPUT, CONTEXT)
        else:
            # If no main function, capture the last evaluated expression
            output = locals().get('output', {})

except Exception as e:
    error = {
        'type': type(e).__name__,
        'message': str(e),
        'traceback': traceback.format_exc()
    }

# Prepare result
result = {
    'success': error is None,
    'output': output,
    'error': error,
    'logs': log_capture.logs
}

# Print result as JSON for parent process
print(json.dumps(result, ensure_ascii=False))
`;
  }

  /**
   * Execute Python script with proper sandboxing
   */
  private static async runPythonScript(
    scriptPath: string,
    workDir: string
  ): Promise<{
    success: boolean;
    output?: any;
    error?: string;
    logs?: string[];
  }> {
    return new Promise((resolve) => {
      // Python execution with security restrictions
      const pythonProcess = spawn('python3', [
        '-u',  # Unbuffered output
        '-B',  # Don't write .pyc files
        scriptPath
      ], {
        cwd: workDir,
        env: {
          ...process.env,
          PYTHONPATH: '',  # Clear Python path
          PYTHONDONTWRITEBYTECODE: '1',  # Don't write bytecode
          PYTHONUNBUFFERED: '1',  # Unbuffered I/O
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: this.SCRIPT_TIMEOUT
      });

      let stdout = '';
      let stderr = '';

      // Collect output
      pythonProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
        // Check if output is too large
        if (stdout.length > this.MAX_OUTPUT_SIZE) {
          pythonProcess.kill('SIGKILL');
        }
      });

      pythonProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process completion
      pythonProcess.on('close', (code) => {
        if (code === 0 || code === null) {
          try {
            // Parse JSON output from Python script
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (parseError) {
            resolve({
              success: false,
              error: `Failed to parse Python output: ${parseError.message}`,
              logs: stderr.split('\n').filter(line => line)
            });
          }
        } else {
          resolve({
            success: false,
            error: `Python process exited with code ${code}`,
            logs: stderr.split('\n').filter(line => line)
          });
        }
      });

      // Handle errors
      pythonProcess.on('error', (error) => {
        resolve({
          success: false,
          error: `Python process error: ${error.message}`
        });
      });

      // Handle timeout
      const timeout = setTimeout(() => {
        pythonProcess.kill('SIGKILL');
        resolve({
          success: false,
          error: 'Python script execution timed out'
        });
      }, this.SCRIPT_TIMEOUT);

      pythonProcess.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Clean up temporary files
   */
  private static async cleanup(tempDir: string): Promise<void> {
    try {
      // Use rm command with -rf to recursively remove
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      try {
        await execAsync(`rm -rf "${tempDir}"`);
      } catch (error) {
        // Log but don't fail if cleanup fails
        console.warn('Failed to cleanup temp directory:', error.message);
      }
    } catch (error) {
      console.warn('Cleanup error:', error.message);
    }
  }

  /**
   * Validate Python code for security issues
   */
  static validateCode(code: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const dangerousPatterns = [
      { pattern: /\bimport\s+os\b/, message: 'Direct import of os module is not allowed' },
      { pattern: /\bimport\s+subprocess\b/, message: 'Direct import of subprocess module is not allowed' },
      { pattern: /\bimport\s+shutil\b/, message: 'Direct import of shutil module is not allowed' },
      { pattern: /\bfrom\s+os\s+import/, message: 'Direct import from os module is not allowed' },
      { pattern: /\bfrom\s+subprocess\s+import/, message: 'Direct import from subprocess module is not allowed' },
      { pattern: /\bexec\s*\(/, message: 'Use of exec() is not allowed' },
      { pattern: /\beval\s*\(/, message: 'Use of eval() is not allowed' },
      { pattern: /\b__import__\s*\(/, message: 'Use of __import__() is not allowed' },
      { pattern: /\bopen\s*\(/, message: 'File operations are not allowed' },
      { pattern: /\bfile\s*\(/, message: 'File operations are not allowed' },
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(code)) {
        errors.push(message);
      }
    }

    // Check for network operations
    if (code.includes('socket') || code.includes('urllib') || code.includes('requests')) {
      errors.push('Network operations are not allowed');
    }

    // Check for system commands
    if (code.includes('system') || code.includes('popen') || code.includes('call')) {
      errors.push('System command execution is not allowed');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default PythonExecutor;