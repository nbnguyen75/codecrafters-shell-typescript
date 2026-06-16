import path from "node:path";
import { homedir } from "node:os";
import { existsSync, constants, accessSync } from "node:fs";
import { createInterface } from "node:readline";
import { spawnSync } from "node:child_process";
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

type CommandHandler = (args: string[], rawLine: string) => void;

const builtins: Record<string, CommandHandler> = {
  exit: () => {
    rl.close();
    process.exit(0);
  },
  echo: (args) => {
    console.log(args.join(' '))
  },
  type: (args) => {
    const targetCommand = args[0];

    if (!targetCommand) {
      return;
    }

    if (targetCommand in builtins) {
      console.log(`${targetCommand} is a shell builtin`)
      return;
    }

    const commandPath = findExternalCommand(targetCommand)

    if (commandPath)
      console.log(`${targetCommand} is ${commandPath}`)
    else
      console.log(`${targetCommand}: not found`)
  },
  pwd: () => {
   //  execSync('pwd', { stdio: 'inherit' });
   console.log(process.cwd())
  },
  cd: (args) => {
   if (args[0] === "~")
      return process.chdir(homedir())

   return existsSync(args[0]) ? process.chdir(args[0]) : console.log(`cd: ${args[0]}: No such file or directory`)
  }
}

function handleExternalCommand(command: string, args: string[] = []) {
  const exePath = findExternalCommand(command);

  if (!exePath) {
    console.log(`${command}: command not found`)
    return
  }
  
  try {
    spawnSync(command, args, { stdio: 'inherit' });
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

  if (command in builtins) {
    builtins[command](args, line);
  } else {
    handleExternalCommand(command, args);
  }

  rl.prompt();
})
