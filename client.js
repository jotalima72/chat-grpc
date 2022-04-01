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
let palavra;
//Create gRPC client
let client = new proto.Chat(
  REMOTE_SERVER,
  grpc.credentials.createInsecure()
);

//Start the stream between server and client
function startChat() {
  let channel
  rl.question("Qual palavra você quer que o outro jogador adivinhe?", answer => {
    palavra = answer;
    console.log("palavra", palavra)
    channel = client.join({ user: username, palavra: palavra });
    channel.on("data", onData);
  });




  rl.on("line", function (text) {
    if (text === 'exit') {
      client.exit({ user: username });
    }
    else {
      client.send({ user: username, palavra: text }, res => { });
    }
  });
}

//When server send a message
function onData(message) {
  if (message.user == username) {
    return;
  }
  if (message.user == "Server" && message.palavra == "Sala cheia") {
    console.log(`||${message.user}|| ${message.palavra} `);
    client = {};
    exit(0);
  }
  if (message.user == "Server" && message.palavra.includes("O jogador") ) {
    console.log(`||${message.user}|| ${message.palavra} `);
    client = {};
    exit(0);
  }
  console.log(` ||${message.user}|| ${message.palavra} `);
}

//Ask user name than start the chat
rl.question("Qual é teu nome? ", answer => {
  username = answer;
  startChat();
}
);
//
