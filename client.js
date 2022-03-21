let grpc = require("grpc");
var protoLoader = require("@grpc/proto-loader");
var readline = require("readline");
const { exit } = require("process");

//Read terminal Lines
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

var proto = grpc.loadPackageDefinition(
  protoLoader.loadSync("protos/chat.proto", {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  })
);

const REMOTE_SERVER = "0.0.0.0:5001";//"192.168.43.229:5001";

let username;

//Create gRPC client
let client = new proto.Chat(
  REMOTE_SERVER,
  grpc.credentials.createInsecure()
);

//Start the stream between server and client
function startChat() {
  let channel = client.join({ user: username });

  channel.on("data", onData);

  rl.on("line", function(text) {
    client.send({ user: username, text: text, hour: new Date().getHours()+":"+new Date().getMinutes() }, res => {});
  });
}

//When server send a message
function onData(message) {
  if (message.user == username) {
    return;
  }
  if (message.user == "Server" && message.text == "Sala cheia") {
    console.log(`||${message.user}||\n (${message.hour}): ${message.text} `);
    client = {};
    exit(0);
  }
  console.log(` ||${message.user}||\n (${message.hour}): ${message.text} `);
}

//Ask user name than start the chat
rl.question("What's ur name? ", answer => {
  username = answer;

  startChat();
});
