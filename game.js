import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { Mutex } from 'async-mutex';

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
const mutexUserAnswered = new Mutex();

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
        const userInGame = [myGame?.p1?.socketID, myGame?.p2?.socketID].includes(socket.id);
        const { currentQuestion, questions } = myGame?.questionnaire;
        if (myGame && userInGame && currentQuestion == 0) {
            const dataToSend = {
                question: questions[currentQuestion].question,
                option: questions[currentQuestion].option,
            }
            console.info(
                'game found',
                JSON.stringify(myGame),
                socket.id,
                'is p1 || p2 so emmiting NEW_QUESTION to p1 && p2 with this data',
                JSON.stringify(dataToSend),
            );
            io
                .to(myGame.p1.socketID)
                .emit('NEW_QUESTION', dataToSend);
            io
                .to(myGame.p2.socketID)
                .emit('NEW_QUESTION', dataToSend);
        } else {
            if (!myGame) {
                const msg = `ERROR: game not found ${
                    res?.gameID
                }`;
                console.error(msg);
            } else if (!userInGame) {
                const msg = `ERROR: el user=${
                    socket.id
                } con player=${
                    JSON.stringify(playersSockets[socket.id])
                } no pertenece al game ${
                    res?.gameID
                }`;
                console.error(msg);
            } else if (currentQuestion != 0) {
                const msg = `ERROR: la currentQuestion=${
                    currentQuestion
                } deberia ser 0`;
                console.error(msg);
            }
        }
    });

    socket.on('USER_ANSWERED', async (res) => {
        console.log(
            'inside USER_ANSWERED',
            res.idQuestion,
            //res.idUser,
            res.optionSelected,
            res.gameID,
            socket.id,
        );
        const release = await mutexUserAnswered.acquire();
        try {
            /**
             * Critical Path [START]
             */
            const myGame = games[res?.gameID];
            const { currentQuestion, questions } = myGame.questionnaire;
            const userInGame = [myGame.p1.socketID, myGame.p2.socketID].includes(socket.id);
            const gameContinues = currentQuestion < totalQuestions;
            if (myGame && userInGame && gameContinues) {
                let me, oponent;
                if (myGame.p1.socketID == socket.id) {
                    [me, oponent] = [myGame.p1, myGame.p2];
                    me.myRol = 'player1';
                    oponent.myRol = 'player2';
                } else {
                    [me, oponent] = [myGame.p2, myGame.p1];
                    me.myRol = 'player2';
                    oponent.myRol = 'player1';
                }
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

                const sameQID = res.idQuestion == questions[currentQuestion].id
                const questionDoesNotHaveAWinnerYet = !questions[currentQuestion].winner;
                const isCorrect = res.optionSelected == questions[currentQuestion].correctAnswer;
                if (sameQID && questionDoesNotHaveAWinnerYet && isCorrect) {
                    // set game flags
                    const playerNum = me.myRol == 'player1' ? 1 : 2;
                    questions[currentQuestion][`answeredP${playerNum}`] = res.optionSelected;
                    myGame.questionnaire[`scoreP${playerNum}`] += 1
                    questions[currentQuestion].winner = `p${playerNum}`;
                    if (currentQuestion == totalQuestions - 1) {
                        // es la pregunta final
                        const { scoreP1, scoreP2 } = myGame.questionnaire;
                        myGame.questionnaire.winner = scoreP1 > scoreP2 ? 'p1' : scoreP2 > scoreP1 ? 'p2' : 'draw';
                    }
                    // warn both players about the mistake
                    io.to(me.socketID).emit('ANSWER_CHECKED', { isCorrect });
                    io.to(oponent.socketID).emit('OPONENT_ANSWERED_CORRECTLY', {});
                } else {
                    if (!sameQID) {
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
                    } else if (!questionDoesNotHaveAWinnerYet) {
                        const msg = `ERROR: la currentQuestion=${
                            currentQuestion
                        } ya tiene ganador y es ${
                            questions[currentQuestion].winner
                        }`;
                        console.error(msg);
                    } else if (!isCorrect) {
                        // set game flags
                        const propName = 'answeredP' + me.myRol == 'player1' ? '1' : '2';
                        questions[currentQuestion][propName] = res.optionSelected;
                        // warn both players about the mistake
                        io.to(me.socketID).emit('ANSWER_CHECKED', { isCorrect });
                        io.to(oponent.socketID).emit('OPONENT_ANSWERED_INCORRECTLY', {});
                    }
                }
            } else {
                if (!myGame) {
                    const msg = `ERROR: game not found ${
                        res?.gameID
                    }`;
                    console.error(msg);
                } else if (!userInGame) {
                    const msg = `ERROR: el user=${
                        socket.id
                    } con player=${
                        JSON.stringify(playersSockets[socket.id])
                    } no pertenece al game ${
                        res?.gameID
                    }`;
                    console.error(msg);
                } else if (!gameContinues) {
                    const msg = `ERROR: la currentQuestion=${
                        currentQuestion
                    } debe ser menor que las totalQuestions=${
                        totalQuestions
                    }`;
                    console.error(msg);
                }
            }
            /**
             * Critical Path [END]
             */
        } finally {
            release();
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
