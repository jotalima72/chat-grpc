let grpc = require("grpc");
let Redis = require("ioredis");
var protoLoader = require("@grpc/proto-loader");

const server = new grpc.Server();
const SERVER_ADDRESS = "0.0.0.0:3000";

const redis = new Redis({
  host: "redis-server",
  port: 6379
});

//Load protobuf
let proto = grpc.loadPackageDefinition(
  protoLoader.loadSync("protos/jogo.proto", {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  })
);


let users = [];
let rodada = 1;
redis.set('rodada', rodada);
//Receive message from client joining
function join(call, callback) {
  if (users.length >= 2) {
    call.write({ user: "Server", palavra: `Sala cheia` })
    return;
  }
  let user = {
    nome: call.request.user,
    palavra: call.request.palavra,
    call: call,
    alvo: undefined,
    acertos: [],
    tentativas: [],
    vitoria: false,
    rodada: false
  };
  users.push(user);
  notifyChat({ user: "Server", palavra: `New user joined... total ${users.length}` })
  if (users.length === 2) {
    users[0].alvo = users[1].palavra;
    users[1].alvo = users[0].palavra;
    startGame();
  }
}

//Receive message from client
function send(call, callback) {
  if (call.request.palavra.trim().length === 1) {

    rodarRodada(call.request);
    return true;
  }
  let index = users.findIndex((user) => { return user.nome == call.request.user });
  users[index].call.write({ user: "Server", palavra: "Envie apenas uma letra por rodada" });

}

async function startGame() {
  
  notifyChat({ user: "Server", palavra: "Começou o nosso jogo" });
  let r = await redis.get('rodada');
  users.forEach(user => {
    user.call.write({ user: 'Server', palavra: `Sua palavra tem ${user.alvo.length} letras \t rodada: ${r}\n ${imprimePalavra(user.alvo, user.acertos)}` })
  });
}


async function fimDeRodada() {
  let fimRodada = users.filter(user => user.rodada === true).length;
  if (fimRodada === 2) {
    users.forEach(user => user.rodada = false);
    await redis.incrby('rodada', 1);
    r = await redis.get('rodada');
    notifyChat({ user: "Server", palavra: `Os dois jogaram. vamos novamente!\t rodada: ${r}` })
  }
}

function getAllIndexes(alvo, letra) {
  var indexes = [], i;
  for (i = 0; i < alvo.length; i++)
    if (alvo[i] === letra)
      indexes.push(i);
  return indexes;
}


function imprimePalavra(alvo, acertos) {
  let mensagem = alvo.split('').map(av => {
    return '_';
  })

  alvo.split('').map((a, index) => {
    if (acertos.includes(index)) {
      mensagem[index] = a;
    }

  });
  let mensagemRetornada = mensagem.join(' ')
  return mensagemRetornada;
}

function rodarRodada(message) {
  var acertos = [];
  let index = users.findIndex((user) => { return user.nome == message.user });
  if (users[index].rodada === true) {
    users[index].call.write({ user: "Server", palavra: "aguarde a sua vez de jogar" });
    return;
  }
  else {
    if (!users[index].tentativas.includes(message.palavra)) {
      users[index].tentativas.push(message.palavra);
      acertos = getAllIndexes(users[index].alvo, message.palavra);
      if (acertos.length === 0) {
        users[index].call.write({ user: "Server", palavra: `ERROUUUUU\n ${imprimePalavra(users[index].alvo, users[index].acertos)}` });
      }
      else {
        users[index].acertos = users[index].acertos.concat(acertos);
        users[index].call.write({ user: "Server", palavra: `voce acertou ${acertos.length} letras!\t total: ${users[index].acertos.length}/ ${users[index].alvo.length}\n ${imprimePalavra(users[index].alvo, users[index].acertos)}` });

        if (temosVitoria(users[index])) {
          notifyChat({ user: "Server", palavra: `O jogador ${users[index].nome} foi o grande vitorioso! GG easy!\n ${imprimePalavra(users[index].alvo, users[index].acertos)}` });
        }
      }
    }
    else {
      users[index].call.write({ user: "Server", palavra: `letra já utilizada, seja mais esperto na próxima\n ${imprimePalavra(users[index].alvo, users[index].acertos)}` });
    }
    users[index].rodada = true;
    notifyChat({ user: users[index].nome, palavra: `terminei minha rodada e acertei ${acertos.length} letras` });
    fimDeRodada();
  }
}

function temosVitoria(user) {
  return user.acertos.length === user.alvo.length ? true : false;
}

//Send message to all connected clients
function notifyChat(message) {
  users.forEach(user => {
    user.call.write(message);
  });
}

function exitClient(call, callback) {
  users.splice(users.indexOf({ user: call.request.user }));
  notifyChat({ user: 'Server', palavra: 'Seu oponente saiu' });
}

//Define server with the methods and start it
server.addService(proto.Jogo.service, { join: join, send: send, exit: exitClient });

server.bind(SERVER_ADDRESS, grpc.ServerCredentials.createInsecure());

server.start();

console.log("Server started");
