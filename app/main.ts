import { createInterface } from "readline";

const commands = ['exit', 'echo', 'type']

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
      console.log(`${givenCommand}: not found`)
  }
  else
    console.log(`${command}: command not found`)

  rl.prompt()
})
