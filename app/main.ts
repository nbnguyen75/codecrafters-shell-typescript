import path from "node:path";
import { homedir } from "node:os";
import { existsSync, constants, accessSync, openSync, appendFileSync, closeSync } from "node:fs";
import { createInterface } from "node:readline";
import { spawnSync, type StdioOptions } from "node:child_process";
import { parse } from "./parser.js";

// ==========================================
// 1. TYPES & INTERFACES
// ==========================================

type StandardStream = 'stdout' | 'stderr';

interface RedirectOutput {
   file: string | null;
   type: StandardStream | null;
}

type CommandHandler = (args: string[], redirect: RedirectOutput) => void;

// ==========================================
// 2. CONFIGURATION & ENVIRONMENT
// ==========================================

const PATH_DIRECTORIES = (process.env.PATH || "").split(path.delimiter);

// ==========================================
// 3. UTILITY FUNCTIONS
// ==========================================

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

function writeOutput(content: string, redirect: RedirectOutput) {
   const { file: filePath, type: stdType } = redirect;

   if (stdType === "stdout" && filePath) {
      appendFileSync(filePath, content + '\n')
      return
   }

   console.log(content);
}

function writeError(content: string, redirect: RedirectOutput) {
   const { file: filePath, type: stdType } = redirect;

   if (stdType === "stderr" && filePath) {
      appendFileSync(filePath, content + '\n')
      return
   }

   console.error(content);
}

function executeExternalCommand(command: string, args: string[] = [], redirect: RedirectOutput) {
   const exePath = findExternalCommand(command);

   if (!exePath) {
      writeError(`${command}: command not found`, redirect);
      return
   }

   let fd: number | null = null; // Tạo biến để giữ File Descriptor

   try {
      const stdio: StdioOptions = ['inherit', 'inherit', 'inherit'];

      if (redirect.file) {
         fd = openSync(redirect.file, 'w')

         if (redirect.type === "stdout")
            stdio[1] = fd;
         else if (redirect.type === "stderr")
            stdio[2] = fd
      }

      spawnSync(exePath, args, { stdio });
   } catch (err) {
      const error = err as Error;
      writeError('The command failed to execute:' + error.message, redirect);
   } finally {
      if (fd !== null) {
         closeSync(fd);
      }
   }
}

function extractRedirection(args: string[]) {
   const redirect: RedirectOutput = { file: null, type: null };
   const cleanArgs = [...args];

   const outIndex = cleanArgs.findIndex(arg => arg === '>' || arg === '1>');
   const errIndex = cleanArgs.findIndex(arg => arg === '2>');

   if (outIndex !== -1) {
      redirect.file = cleanArgs[outIndex + 1];
      redirect.type = "stdout";
      cleanArgs.splice(outIndex, 2);
   } else if (errIndex !== -1) {
      redirect.file = cleanArgs[errIndex + 1];
      redirect.type = "stderr";
      cleanArgs.splice(errIndex, 2);
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
      const targetPath = args[0] === "~" ? homedir() : args[0];

      try {
         process.chdir(targetPath);
      } catch {
         writeError(`cd: ${targetPath}: No such file or directory`, redirect);
      }
   }
}

const rl = createInterface({
   input: process.stdin,
   output: process.stdout,
   prompt: "$ ",
});

rl.prompt();

rl.on('line', (line) => {
   const trimmedLine = line.trim();
   if (!trimmedLine) {
      rl.prompt();
      return;
   }

   const parsedInput = parse(trimmedLine);
   if (!parsedInput.length) {
      rl.prompt();
      return;
   }

   const [command, ...rawArgs] = parsedInput;
   const { cleanArgs: args, redirect } = extractRedirection(rawArgs);

   if (redirect.file) {
      closeSync(openSync(redirect.file, 'w'));
   }

   if (command in builtins) {
      builtins[command](args, redirect);
   } else {
      executeExternalCommand(command, args, redirect);
   }

   rl.prompt();
})
