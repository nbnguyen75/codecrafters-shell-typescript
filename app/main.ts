import path from "node:path";
import { homedir } from "node:os";
import { existsSync, constants, accessSync, openSync, appendFileSync, closeSync } from "node:fs";
import { createInterface } from "node:readline";
import { spawnSync, type StdioOptions } from "node:child_process";
import { parse } from "./parser.js";

interface RedirectOutput {
   file: string | null,
   type: 'stdout' | 'stderr' | null
}

const PATH_DIRECTORIES = (process.env.PATH || "").split(path.delimiter)

function findExternalCommand(command: string) {
   for (const dir of PATH_DIRECTORIES) {
      if (!existsSync(dir)) continue;

      const fullPath = path.join(dir, command);
      try {
         accessSync(fullPath, constants.X_OK);
         return fullPath;
      } catch { }
   }

   return null;
}

function writeOutput(content: string, redirectOutput: RedirectOutput) {
   const { file: filePath, type: stdType } = redirectOutput;

   if (!filePath) {
      console.log(content);
      return
   }

   if (stdType === "stdout")
      appendFileSync(filePath, content + '\n')
}

function writeError(content: string, redirectOutput: RedirectOutput) {
   const { file: filePath, type: stdType } = redirectOutput;

   if (!filePath) {
      console.error(content);
      return
   }

   if (stdType === "stderr")
      appendFileSync(filePath, content + '\n')
}

type CommandHandler = (args: string[], redirectOutput: RedirectOutput) => void;

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
   pwd: (_args, redirectOutput) => {
      writeOutput(process.cwd(), redirectOutput)
   },
   cd: (args, redirectOutput) => {
      if (args[0] === "~") {
         process.chdir(homedir())
         return;
      }

      if (existsSync(args[0])) {
         process.chdir(args[0])
         return;
      }

      writeError(`cd: ${args[0]}: No such file or directory`, redirectOutput);
   }
}

function handleExternalCommand(command: string, args: string[] = [], redirectOutput: RedirectOutput) {
   const exePath = findExternalCommand(command);

   if (!exePath) {
      writeError(`${command}: command not found`, redirectOutput);
      return
   }

   let fd: number | null = null; // Tạo biến để giữ File Descriptor

   try {
      const stdio: StdioOptions = ['inherit', 'inherit', 'inherit'];

      if (redirectOutput.file) {
         fd = openSync(redirectOutput.file, 'w')

         if (redirectOutput.type === "stdout")
            stdio[1] = fd;
         else if (redirectOutput.type === "stderr")
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

   if (command in builtins) {
      builtins[command](args, redirectOutput);
   } else {
      handleExternalCommand(command, args, redirectOutput);
   }

   rl.prompt();
})
