export type SinkCategory =
  | 'FILE_SYSTEM'
  | 'PROCESS_SPAWN'
  | 'DYNAMIC_CODE'
  | 'ENVIRONMENT_ESCAPE'
  | 'NETWORK_SOCKET'
  | 'PROTOTYPE_POLLUTION';

export interface DangerousSinkDefinition {
  identifier: string;
  category: SinkCategory;
  severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
  languages: Array<'javascript' | 'typescript' | 'python' | 'cpp'>;
  description: string;
}

export const DANGEROUS_SINKS: DangerousSinkDefinition[] = [
  // Process spawning
  { identifier: 'child_process', category: 'PROCESS_SPAWN', severity: 'CRITICAL', languages: ['javascript', 'typescript'], description: 'Spawns OS child process' },
  { identifier: 'exec', category: 'PROCESS_SPAWN', severity: 'CRITICAL', languages: ['javascript', 'typescript', 'python', 'cpp'], description: 'Executes arbitrary shell command' },
  { identifier: 'spawn', category: 'PROCESS_SPAWN', severity: 'CRITICAL', languages: ['javascript', 'typescript'], description: 'Spawns shell process' },
  { identifier: 'fork', category: 'PROCESS_SPAWN', severity: 'CRITICAL', languages: ['javascript', 'typescript', 'cpp'], description: 'Forks system process' },
  { identifier: 'os.system', category: 'PROCESS_SPAWN', severity: 'CRITICAL', languages: ['python'], description: 'Executes operating system shell command' },
  { identifier: 'subprocess', category: 'PROCESS_SPAWN', severity: 'CRITICAL', languages: ['python'], description: 'Spawns sub-process with system privileges' },
  { identifier: 'system', category: 'PROCESS_SPAWN', severity: 'CRITICAL', languages: ['cpp'], description: 'C/C++ system() shell command invocation' },
  { identifier: 'popen', category: 'PROCESS_SPAWN', severity: 'CRITICAL', languages: ['cpp', 'python'], description: 'Opens OS pipe to process' },

  // File system
  { identifier: 'fs', category: 'FILE_SYSTEM', severity: 'CRITICAL', languages: ['javascript', 'typescript'], description: 'Node.js file system access' },
  { identifier: 'open', category: 'FILE_SYSTEM', severity: 'HIGH', languages: ['python'], description: 'File open handle' },
  { identifier: 'fopen', category: 'FILE_SYSTEM', severity: 'HIGH', languages: ['cpp'], description: 'C standard file open' },
  { identifier: 'ifstream', category: 'FILE_SYSTEM', severity: 'HIGH', languages: ['cpp'], description: 'C++ file stream read' },
  { identifier: 'ofstream', category: 'FILE_SYSTEM', severity: 'HIGH', languages: ['cpp'], description: 'C++ file stream write' },

  // Dynamic code evaluation
  { identifier: 'eval', category: 'DYNAMIC_CODE', severity: 'CRITICAL', languages: ['javascript', 'typescript', 'python'], description: 'Direct evaluation of arbitrary dynamic code string' },
  { identifier: 'Function', category: 'DYNAMIC_CODE', severity: 'CRITICAL', languages: ['javascript', 'typescript'], description: 'Dynamic Function constructor evaluation' },
  { identifier: 'vm.runInContext', category: 'DYNAMIC_CODE', severity: 'CRITICAL', languages: ['javascript', 'typescript'], description: 'Node.js VM execution context' },
  { identifier: 'compile', category: 'DYNAMIC_CODE', severity: 'HIGH', languages: ['python'], description: 'Python dynamic compile() call' },

  // Environment & native escape
  { identifier: 'process.binding', category: 'ENVIRONMENT_ESCAPE', severity: 'CRITICAL', languages: ['javascript', 'typescript'], description: 'Internal Node.js C++ binding access' },
  { identifier: 'process.dlopen', category: 'ENVIRONMENT_ESCAPE', severity: 'CRITICAL', languages: ['javascript', 'typescript'], description: 'Dynamic library loader escape' },
  { identifier: '__import__', category: 'ENVIRONMENT_ESCAPE', severity: 'HIGH', languages: ['python'], description: 'Python dynamic import escape' },
  { identifier: 'importlib', category: 'ENVIRONMENT_ESCAPE', severity: 'HIGH', languages: ['python'], description: 'Dynamic Python module loader' },

  // Network access
  { identifier: 'net.Socket', category: 'NETWORK_SOCKET', severity: 'CRITICAL', languages: ['javascript', 'typescript'], description: 'Raw TCP socket connection' },
  { identifier: 'socket', category: 'NETWORK_SOCKET', severity: 'CRITICAL', languages: ['python', 'cpp'], description: 'Raw networking socket creation' },
  { identifier: 'urllib', category: 'NETWORK_SOCKET', severity: 'HIGH', languages: ['python'], description: 'Outbound HTTP network connection' },
];

export const OBFUSCATION_PATTERNS = [
  { pattern: /window\s*\[\s*['"`][a-zA-Z0-9_]+['"`]\s*\+\s*['"`]/, description: 'Concatenated string property lookup on window' },
  { pattern: /global(?:This)?\s*\[\s*['"`][a-zA-Z0-9_]+['"`]\s*\+\s*['"`]/, description: 'Concatenated string property lookup on global' },
  { pattern: /process\s*\[\s*['"`][a-zA-Z0-9_]+['"`]\s*\+\s*['"`]/, description: 'Concatenated string property lookup on process' },
  { pattern: /\\x[0-9a-fA-F]{2}\\x[0-9a-fA-F]{2}/, description: 'Hexadecimal escape sequence obfuscation' },
  { pattern: /atob\s*\(|Buffer\.from\s*\([^,]+,\s*['"`]base64['"`]\)/, description: 'Base64 decoded dynamic payload execution' },
  { pattern: /base64\.b64decode\s*\(/, description: 'Python base64 payload decode' },
  { pattern: /__proto__|constructor\s*\[\s*['"`]prototype['"`]\s*\]/, description: 'Prototype pollution payload' },
];
