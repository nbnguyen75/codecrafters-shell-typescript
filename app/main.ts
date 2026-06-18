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
   }

   console.log(content);
}

function writeError(content: string, redirect: RedirectOutput) {
   const { file: filePath, type: stdType } = redirect;

   if (stdType === "stderr" && filePath) {
      appendFileSync(filePath, content + '\n')
   }

   console.error(content);
}

// ==========================================
// 4. COMMAND HANDLERS
// ==========================================

const builtins: Record<string, CommandHandler> = {
   exit: () => {
      rl.close();
      process.exit(0);
   },
   echo: (args, redirectOutput) => {
      writeOutput(args.join(' '), redirectOutput)
   },
   type: (args, redirectOutput) => {
      const targetCommand = args[0];

      if (!targetCommand) {
         return;
      }

      if (targetCommand in builtins) {
         writeOutput(`${targetCommand} is a shell builtin`, redirectOutput)
         return;
      }

      const commandPath = findExternalCommand(targetCommand)

      if (commandPath) {
         writeOutput(`${targetCommand} is ${commandPath}`, redirectOutput)
         return;
      }

      writeError(`${targetCommand}: not found`, redirectOutput)
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

function handleExternalCommand(command: string, args: string[] = [], redirect: RedirectOutput) {
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

      spawnSync(command, args, { stdio });
   } catch (err) {
      const error = err as Error;
      console.error('The command failed to execute:', error.message);
   } finally {
      if (fd !== null) {
         closeSync(fd);
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

   const [command, ...args] = parse(trimmedLine);

   const redirectOutput: RedirectOutput = {
      file: null,
      type: null
   }

   const outputRedirIndex = args.findIndex(arg => arg === '>' || arg === '1>');
   const errorRedirIndex = args.findIndex(arg => arg === '2>');

   if (outputRedirIndex !== -1) {
      redirectOutput.file = args[outputRedirIndex + 1];
      redirectOutput.type = "stdout";
      args.splice(outputRedirIndex, 2);
   } else if (errorRedirIndex !== -1) {
      redirectOutput.file = args[errorRedirIndex + 1];
      redirectOutput.type = "stderr";
      args.splice(errorRedirIndex, 2);
   }

   // if (redirectOutput.file) {
   //    closeSync(openSync(redirectOutput.file, 'w'));
   // }

   if (command in builtins) {
      builtins[command](args, redirectOutput);
   } else {
      handleExternalCommand(command, args, redirectOutput);
   }

   rl.prompt();
})
