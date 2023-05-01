import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const question = {
    questionNumber: 4,
    id: '29n3cxfy7228dl',
    signature: 'Ciencias Sociales',
    area: 'Filosofia',
    topic: 'Marxismo',
    subtopic: 'Marxismo subtopic',
    type: 'justification',
    difficulty: 'easy',
    text: 'Edson y Edwin charlan en su casa. Los dos han tenido dificultades en la vida, no les ha ido bien últimamente en ningún aspecto. Edson dice que tal vez se deba a la posición de los astros, pues al ser del signo de cáncer, no es un buen momento del año para él. Edwin responde que se debe más a las decisiones que ha tomado, y que, si hay algo ajeno que influye en la toma de sus decisiones, se trata de la propia estructura social que beneficia a unos y perjudica a demasiados.',
    subtext: '¿A qué noción ética corresponde la discusión de Edwin y Edson?',
    optionOne: 'Autonomía y heteronomía',
    optionTwo: 'Capitalismo y Socialismo',
    optionThree: 'Determinismo y libertad',
    optionFour: 'Marxismo y Leninismo',
    correctAnswer: 3,
    selectedAnswer: ''
};

const option = [
    {
      id: 'A',
      label: 'Autonomía y heteronomía',
      value: 'A',
      selected: false
    },
    {
      id: 'B',
      label: 'Capitalismo y Socialismo',
      value: 'B',
      selected: false
    },
    {
      id: 'C',
      label: 'Determinismo y libertad',
      value: 'C',
      selected: false
    },
    {
      id: 'D',
      label: 'Marxismo y Leninismo',
      value: 'D',
      selected: true
    }
  ];

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const players = {};
const playersSockets = {};
const games = {};

try {

io.on('connection', (socket) => {
    console.log('anonymous connected');

    socket.on('WANNA_PLAY', (res) => {
        console.log(
            'inside WANNA_PLAY',
            res.id,
            res.name,
            socket.id,
        );
        if (!(res.id in players)) {
            players[res.id] = {
                id: res.id,
                name: res.name,
                socketID: socket.id,
            }
            playersSockets[socket.id] = {
                id: res.id,
                name: res.name,
            }
        }

        const playersArr = Object.keys(players)
        if (playersArr.length >= 2) {
            console.info('playersArr.length DO IS bigger than 2, matching...');
            const p1 = players[playersArr.pop()];
            const p2 = players[playersArr.pop()];
            const gameID = Math.random();
            games[gameID] = { p1, p2};
            console.log('game created', gameID, JSON.stringify(games[gameID]));
            io
                .to(p1.socketID)
                .emit('START_GAME', {
                    id: p2.id,
                    name: p2.name,
                    myRol: 'player1',
                    totalQuestions: 10,
                    gameID,
                });
            io
                .to(p2.socketID)
                .emit('START_GAME', {
                    id: p1.id,
                    name: p1.name,
                    myRol: 'player2',
                    totalQuestions: 5,
                    gameID,
                });
            delete players[p1.id];
            delete players[p2.id];
        } else {
            console.error(
                'playersArr.length is not bigger than 2 so I cannot match',
                playersArr.length
            );
        }
    });

    socket.on('GIVE_ME_QUESTION', (res) => {
        console.log(
            'inside GIVE_ME_QUESTION',
            res.gameID,
            socket.id,
        );
        const myGame = games[res?.gameID]
        if (myGame && [myGame.p1.socketID, myGame.p2.socketID].includes(socket.id)) {
            console.info(
                'game found',
                JSON.stringify(myGame),
                socket.id,
                'is p1 || p2 so emmiting NEW_QUESTION...',
            );
            io
                .to(myGame.p1.socketID)
                .emit('NEW_QUESTION', {
                    question,
                    option,
                });
            io
                .to(myGame.p2.socketID)
                .emit('NEW_QUESTION', {
                    question,
                    option,
                });
        } else {
            const msg = `ERROR: el user=${
                socket.id
            } con player=${
                playersSockets[socket.id]
            } no pertenece al game ${
                res?.gameID
            }`;
            console.error(msg);
        }
    });

    socket.on("disconnecting", () => {
        // the Set contains at least the socket ID
        console.log(
            'anonymous is disconnecting',
            socket.rooms,
        );
    });
});

} catch (err) {
    console.error(err);
}

server.listen(process.env.PORT || 3000, () => {
    console.log(`running game on http://localhost:${
        process.env.PORT || 3000
    }`);
});
