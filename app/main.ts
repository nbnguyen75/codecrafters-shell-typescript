import path from "node:path";
import { homedir } from "node:os";
import { existsSync, constants, accessSync, openSync, appendFileSync, closeSync, readdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { spawnSync, type StdioOptions } from "node:child_process";
import { parse } from "./parser.js";
import { Trie } from "./data-structures/trie.js";

// ==========================================
// 1. TYPES & INTERFACES
// ==========================================

type StandardStream = 'stdout' | 'stderr';

interface RedirectOutput {
   file: string | null;
   type: StandardStream | null;
   append: boolean;
}

type CommandHandler = (args: string[], redirect: RedirectOutput) => void;

// ==========================================
// 2. CONFIGURATION & ENVIRONMENT
// ==========================================

const BELL_RING = '\x07'

const PATH_DIRECTORIES = (process.env.PATH || "").split(path.delimiter);

// ==========================================
// 3. UTILITY FUNCTIONS
// ==========================================

function scanPathCommands(trie: Trie) {
   for (const dir of PATH_DIRECTORIES) {
      try {
         for (const entry of readdirSync(dir)) {
            try {
               accessSync(path.join(dir, entry), constants.X_OK);
               trie.insert(entry);
            } catch { }
         }
      } catch { }
   }
}

function findExternalCommand(command: string) {
   for (const dir of PATH_DIRECTORIES) {
      const fullPath = path.join(dir, command);

      try {
         accessSync(fullPath, constants.X_OK);
         return fullPath;
      } catch { }
   }

   return null;
}

function createFile(filePath: string) {
   closeSync(openSync(filePath, 'w'));
}

function writeToStream(content: string, stream: StandardStream, redirect: RedirectOutput) {
   const { file: filePath, type: stdType } = redirect;

   if (stdType === stream && filePath) {
      appendFileSync(filePath, content + '\n');
      return;
   }

   if (stream === 'stdout') {
      console.log(content);
   } else {
      console.error(content);
   }
}

function writeOutput(content: string, redirect: RedirectOutput) {
   writeToStream(content, 'stdout', redirect);
}

function writeError(content: string, redirect: RedirectOutput) {
   writeToStream(content, 'stderr', redirect);
}

const REDIRECT_RE = /^(>>?|1>>?|2>>?)$/;

function extractRedirection(args: string[]) {
   const redirect: RedirectOutput = { file: null, type: null, append: false };
   const cleanArgs = [...args];

   const redirectIndex = cleanArgs.findIndex(arg => REDIRECT_RE.test(arg));

   if (redirectIndex !== -1) {
      const operator = cleanArgs[redirectIndex];
      redirect.file = cleanArgs[redirectIndex + 1];

      if (operator === '2>' || operator === '2>>') {
         redirect.type = 'stderr';
      } else {
         redirect.type = 'stdout';
      }

      redirect.append = operator.endsWith('>>');
      cleanArgs.splice(redirectIndex, 2);
   }

   return { cleanArgs, redirect };
}

// ==========================================
// 4. COMMAND HANDLERS
// ==========================================

const builtins: Record<string, CommandHandler> = {
   exit: () => {
      rl.close();
      process.exit(0);
   },
   echo: (args, redirect) => {
      writeOutput(args.join(' '), redirect)
   },
   type: (args, redirect) => {
      const targetCommand = args[0];

      if (!targetCommand) {
         return;
      }

      if (targetCommand in builtins) {
         writeOutput(`${targetCommand} is a shell builtin`, redirect)
         return;
      }

      const commandPath = findExternalCommand(targetCommand)

      if (commandPath) {
         writeOutput(`${targetCommand} is ${commandPath}`, redirect)
         return;
      }

      writeError(`${targetCommand}: not found`, redirect)
   },
   pwd: (_args, redirect) => {
      writeOutput(process.cwd(), redirect)
   },
   cd: (args, redirect) => {
      if (args[0] === "~") {
         process.chdir(homedir())
         return;
      }

      if (existsSync(args[0])) {
         process.chdir(args[0])
         return;
      }

      writeError(`cd: ${args[0]}: No such file or directory`, redirect);
   }
}

function executeExternalCommand(command: string, args: string[] = [], redirect: RedirectOutput) {
   const exePath = findExternalCommand(command);

   if (!exePath) {
      writeError(`${command}: command not found`, redirect);
      return
   }

   let fd: number | null = null;

   try {
      const stdio: StdioOptions = ['inherit', 'inherit', 'inherit'];

      if (redirect.file) {
         fd = openSync(redirect.file, redirect.append ? 'a' : 'w');

         if (redirect.type === "stdout") {
            stdio[1] = fd;
         } else if (redirect.type === "stderr") {
            stdio[2] = fd;
         }
      }

      spawnSync(command, args, { stdio });
   } catch {
      console.error('The command failed to execute');
   } finally {
      if (fd !== null) {
         closeSync(fd);
      }
   }
}

const builtinCommands = Object.keys(builtins);
const commandTrie = new Trie();

commandTrie.insert(...builtinCommands);
scanPathCommands(commandTrie);

let tabState: { prefix: string; matches: string[]; index: number } | null = null;

const rl = createInterface({
   input: process.stdin,
   output: process.stdout,
   prompt: "$ ",
   completer: (line: string) => {
      const firstWord = line.trim().split(/\s+/)[0] || "";

      if (!tabState || !firstWord.startsWith(tabState.prefix)) {
         tabState = null;
         const matches = commandTrie.findWordsWithPrefix(firstWord);

         if (!matches.length) {
            process.stdout.write(BELL_RING);
            return [[], firstWord];
         }

         if (matches.length === 1) {
            return [[matches[0] + " "], firstWord];
         }

         tabState = { prefix: firstWord, matches, index: 0 };
         return [[matches[0]], firstWord];
      }

      tabState.index = (tabState.index + 1) % tabState.matches.length;
      const match = tabState.matches[tabState.index];
      // process.stdout.write(`\n${matches.toSorted().join("  ")}\n$ ${firstWord}`);
      return [[match + (tabState.index !== tabState.matches.length ? " " : "")], firstWord];
   },
});

rl.prompt();

rl.on('line', (line) => {
   const trimmedLine = line.trim();

   if (!trimmedLine) {
      rl.prompt();
      return;
   }

   const parsedInput = parse(trimmedLine);
   if (parsedInput.length === 0) {
      rl.prompt();
      return;
   }

   const [command, ...rawArgs] = parsedInput;

   const { cleanArgs: args, redirect } = extractRedirection(rawArgs);

   if (command in builtins) {
      if (redirect.file && !redirect.append) createFile(redirect.file);
      builtins[command](args, redirect);
   } else {
      executeExternalCommand(command, args, redirect);
   }

   rl.prompt();
})
