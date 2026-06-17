import path from "node:path";
import { homedir } from "node:os";
import { existsSync, constants, accessSync, openSync, appendFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { spawnSync, type StdioOptions } from "node:child_process";
import { parse } from "./parser.js";

const PATH_DIRECTORIES = (process.env.PATH || "").split(path.delimiter)

function findExternalCommand(command: string) {
   for (const dir of PATH_DIRECTORIES) {
      if (!existsSync(dir)) continue;

      const fullPath = path.join(dir, command);
      try {
         accessSync(fullPath, constants.X_OK);
         return fullPath;
      } catch {
         continue;
      }
   }

   return null;
}

function writeOutput(content: string, filePath: string | null = null) {
   if (!filePath) {
      console.log(content);
      return
   }

   appendFileSync(filePath, content + '\n')
}

type CommandHandler = (args: string[], outputRedir?: string | null) => void;

const builtins: Record<string, CommandHandler> = {
   exit: () => {
      rl.close();
      process.exit(0);
   },
   echo: (args, outputRedir) => {
      writeOutput(args.join(' '), outputRedir)
   },
   type: (args, outputRedir) => {
      const targetCommand = args[0];

      if (!targetCommand) {
         return;
      }

      if (targetCommand in builtins) {
         writeOutput(`${targetCommand} is a shell builtin`, outputRedir)
         return;
      }

      const commandPath = findExternalCommand(targetCommand)

      if (commandPath) {
         writeOutput(`${targetCommand} is ${commandPath}`, outputRedir)
         return;
      }

      console.error(`${targetCommand}: not found`);
   },
   pwd: () => {
      writeOutput(process.cwd())
   },
   cd: (args, outputRedir) => {
      if (args[0] === "~") {
         process.chdir(homedir())
         return;
      }

      if (existsSync(args[0])) {
         process.chdir(args[0])
         return;
      }

      console.error(`cd: ${args[0]}: No such file or directory`)
   }
}

function handleExternalCommand(command: string, args: string[] = [], outputRedir: string | null = null) {
   const exePath = findExternalCommand(command);

   if (!exePath) {
      console.error(`${command}: command not found`);
      return
   }

   try {
      const stdio: StdioOptions = ['inherit', 'inherit', 'inherit'];

      if (outputRedir) {
         const found = openSync(outputRedir, 'w')
         stdio[1] = found
      }

      spawnSync(command, args, { stdio, shell: true, encoding: 'utf-8' });
   } catch (err) {
      const error = err as Error;
      console.error('The command failed to execute:', error.message);
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

   const redirIndex = args.findIndex(arg => arg === '>' || arg === '1>');
   let outputRedir: string | null = null;

   if (redirIndex !== -1) {
      outputRedir = args[redirIndex + 1];
      args.splice(redirIndex, 2);
   }

   if (command in builtins) {
      builtins[command](args, outputRedir);
   } else {
      handleExternalCommand(command, args, outputRedir);
   }

   rl.prompt();
})
