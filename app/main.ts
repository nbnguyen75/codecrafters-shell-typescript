import path from "node:path";
import { existsSync, constants, accessSync } from "node:fs";
import { createInterface } from "node:readline";
import { exec } from "node:child_process";

const commands = ['exit', 'echo', 'type']

const processPaths = (process.env.PATH || "").split(path.delimiter)

function findCommandInDirs(command: string) {
  let foundPath = undefined;
  for (const processPath of processPaths) {
    if (!existsSync(processPath))
      continue

    const fullPath = path.join(processPath, command);

    try {
      accessSync(fullPath, constants.X_OK);
      foundPath = fullPath;
    } catch {
      continue
    }
  }

  return foundPath;
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "$ ",
});

// TODO: Uncomment the code below to pass the first stage
rl.prompt();

rl.on('line', (command) => {
  if (command.startsWith('exit'))
  {
    rl.close();
    return process.exit(0);
  }
  else if (command.startsWith('echo '))
    console.log(command.slice(5))
  else if (command.startsWith('type '))
  {
    const givenCommand = command.slice(5).trim()
    if (commands.includes(givenCommand))
      console.log(`${givenCommand} is a shell builtin`)
    else 
    {
      const commandPath = findCommandInDirs(givenCommand);
      if (commandPath)
        console.log(`${givenCommand} is ${commandPath}`)
      else
        console.log(`${givenCommand}: not found`)
    }
  }
  else {
    const [exeFile, ...args] = command.trim().split(/\s+/)
    const exePath = findCommandInDirs(exeFile);
    if (!exePath)
      console.log(`${command}: command not found`)
    else {
      // console.log(`Program was passed ${args.length + 1} args (including program name).`);
      // console.log(`Arg #0 (program name): ${exeFile}`);
      // for (let index = 0; index < args.length; index++) {
      //   const element = args[index];
      //   console.log(`Arg #${index + 1}: ${element}`)
      // }
      const { stdout } = exec(command)
      console.log(stdout)
    }
  }

  rl.prompt()
})
