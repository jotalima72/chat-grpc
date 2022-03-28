let grpc = require("grpc");
var protoLoader = require("@grpc/proto-loader");

const server = new grpc.Server();
const SERVER_ADDRESS = "0.0.0.0:5001";

//Load protobuf
let proto = grpc.loadPackageDefinition(
  protoLoader.loadSync("protos/chat.proto", {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  })
);

let users = [];

let numplayers = 0;
//Receive message from client joining
function join(call, callback) {
  if (users.length >= 2) {
    call.write({ user: "Server", text: `Sala cheia`})
    return;
  }
  let user = {
    nome: call.request.user,
    palavra: call.request.text
  };
  users.push(user);
  console.log(user);
  user.call.write({ user: "Server", text: `New user joined... total ${users.length}`})
}

//Receive message from client
function send(call, callback) {
  if(call.request.text.trim().length !== 0)
  notifyChat(call.request);
}

//Send message to all connected clients
function notifyChat(message) {
  users.forEach(user => {
    user.call.write(message);
  });
}

//Define server with the methods and start it
server.addService(proto.Chat.service, { join: join, send: send });

server.bind(SERVER_ADDRESS, grpc.ServerCredentials.createInsecure());

server.start();

console.log("Server started");
