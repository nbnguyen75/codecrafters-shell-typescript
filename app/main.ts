import { exit } from "process";
import { createInterface } from "readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "$ ",
});

// TODO: Uncomment the code below to pass the first stage
rl.prompt();

rl.on('line', (command) => {
  if (command === "exit")
    exit(0);
  
  console.log(`${command}: command not found`)

  rl.prompt()
})
