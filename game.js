import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

const totalQuestions = 10;
const superTotalQuestions = 100;
const randomIntFromInterval = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

const question = {
    id: null,
    questionNumber: null,
    correctAnswer: null,
    selectedAnswer: null,
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
};

const qs = [...Array(superTotalQuestions)].map((_, index) => ({
    ...question,
    id: uuidv4(),
    correctAnswer: ['A', 'B', 'C', 'D'][randomIntFromInterval(0, 3)],
    questionNumber: index + 1,
    selectedAnswer: '',
}));

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
            const x = players[playersArr.pop()];
            const y = players[playersArr.pop()];
            const [p1, p2] = x.name == 'Antonio' ? [x, y] : [y, x];
            const gameID = Math.random();
            const randIndex = randomIntFromInterval(0 , superTotalQuestions - totalQuestions);
            games[gameID] = {
                p1,
                p2,
                questionnaire: {
                    currentQuestion: 0,
                    winner: null,
                    scoreP1: 0,
                    scoreP2: 0,
                    questions: qs.slice(randIndex, randIndex + totalQuestions).map(q => ({
                        answeredP1: null,
                        answeredP2: null,
                        winner: null,
                        question: q,
                        option: ['One', 'Two', 'Three', 'Four']
                            .map((val, index) => ({
                                id: String.fromCharCode(65+index),
                                label: q[`option${val}`],
                                value: String.fromCharCode(65+index),
                                selected: false
                            }))
                    }))
                },
            };
            console.log(
                'game created',
                `p1 = ${JSON.stringify(games[gameID].p1)}`,
                `p2 = ${JSON.stringify(games[gameID].p2)}`,
                'START_GAME is being emmited...',
            );
            io
                .to(p1.socketID)
                .emit('START_GAME', {
                    id: p2.id,
                    name: p2.name,
                    myRol: 'player1',
                    totalQuestions,
                    gameID,
                });
            io
                .to(p2.socketID)
                .emit('START_GAME', {
                    id: p1.id,
                    name: p1.name,
                    myRol: 'player2',
                    totalQuestions,
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
            res?.gameID,
            socket.id,
        );
        const myGame = games[res?.gameID];
        if (myGame && [myGame.p1.socketID, myGame.p2.socketID].includes(socket.id)) {
            const { currentQuestion, questions } = myGame.questionnaire;
            const dataToSend = {
                question: questions[currentQuestion].question,
                option: questions[currentQuestion].option,
            }
            console.info(
                'game found',
                JSON.stringify(myGame),
                socket.id,
                'is p1 || p2 so emmiting NEW_QUESTION with this data',
                JSON.stringify(dataToSend),
            );
            io
                .to(myGame.p1.socketID)
                .emit('NEW_QUESTION', dataToSend);
            io
                .to(myGame.p2.socketID)
                .emit('NEW_QUESTION', dataToSend);
        } else {
            const msg = `ERROR: el user=${
                socket.id
            } con player=${
                JSON.stringify(playersSockets[socket.id])
            } no pertenece al game ${
                res?.gameID
            }`;
            console.error(msg);
        }
    });

    socket.on('USER_ANSWERED', (res) => {
        console.log(
            'inside USER_ANSWERED',
            res.idQuestion,
            //res.idUser,
            res.optionSelected,
            res.gameID,
            socket.id,
        );
        const myGame = games[res?.gameID];
        if (myGame && [myGame.p1.socketID, myGame.p2.socketID].includes(socket.id)) {
            const [me, oponent] = myGame.p1.socketID == socket.id ? [myGame.p1, myGame.p2] : [myGame.p2, myGame.p1];
            const { currentQuestion, questions } = myGame.questionnaire;
            console.info(
                'game found',
                JSON.stringify(myGame),
                socket.id,
                'is',
                JSON.stringify(me),
                'currentQuestion',
                currentQuestion,
                questions[currentQuestion],
            );
            if (res.idQuestion == questions[currentQuestion].id) {
                const isCorrect = res.optionSelected == questions[currentQuestion].correctAnswer;
                io
                    .to(me.socketID)
                    .emit('ANSWER_CHECKED', { isCorrect });
            } else {
                const msg = `ERROR: el user=${
                    socket.id
                } con player=${
                    JSON.stringify(playersSockets[socket.id])
                } no esta en sync con las preguntas current=${
                    currentQuestion
                } ${questions[currentQuestion].id} vs recibida=${
                    res.idQuestion
                }`;
                console.error(msg);
            }
        } else {
            const msg = `ERROR: el user=${
                socket.id
            } con player=${
                JSON.stringify(playersSockets[socket.id])
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
