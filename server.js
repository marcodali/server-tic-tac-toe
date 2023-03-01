import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import EventEmitter from 'events';

const eventEmitter = new EventEmitter();
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
let totalParticipants = 0;
let leaderBoard;
const emails = {};
const matchSocketWithEmails = {};
const wannaPlayUsers = [];
const games = {};

try {

// event listener 'READY_TO_PLAY'
eventEmitter.on('READY_TO_PLAY', () => {
    console.log('listening...', wannaPlayUsers);
    if (wannaPlayUsers.length >= 2) {
        const player1 = wannaPlayUsers.shift();
        const player2 = wannaPlayUsers.shift();
        const game = {
            matchID: Math.round(Math.random() * (9999 - 10)) + 10,
            player1,
            player2,
        };
        games[game.matchID] = {
            acceptedInvitations: 0,
            ...game,
        };

        // player 1 is always X
        io.to(player1.socketID).emit(
            'GAME',
            { ...game, you_play_with: 'X', rival: player2 },
        );
        io.to(player2.socketID).emit(
            'GAME',
            { ...game, you_play_with: 'X', rival: player1 },
        );
    } else {
        console.log('not enough players online to match a game');
    }
});

io.on('connection', (socket) => {
    console.log('anonymous connected');

    socket.on('RESPUESTA_GAME', (res) => {
        console.log('inside RESPUESTA_GAME', res);
        console.log('games', games);
        if (res.answer === 'ACCEPTED_MATCH') {
            console.log('before sum', games[res.game.matchID].acceptedInvitations);
            games[res.game.matchID].acceptedInvitations += 1;
            console.log('after sum', games[res.game.matchID].acceptedInvitations);
            if (games[res.game.matchID].acceptedInvitations === 2) {
                console.log('entered here because 2 === ', games[res.game.matchID].acceptedInvitations);
                
                // player 1 is always X
                io.to(res.game.player1.socketID).emit(
                    'GAME_CAN_START',
                    {
                        ...res.game,
                        you_play_with: 'X',
                        rival: res.game.player2,
                        you_are: res.game.player1.email,
                    },
                );
                io.to(res.game.player2.socketID).emit(
                    'GAME_CAN_START',
                    {
                        ...res.game,
                        you_play_with: 'X',
                        rival: res.game.player1,
                        you_are: res.game.player2.email,
                    },
                );

                /**
                 * change status of both players to GAMING
                 */
                // player 1
                emails[matchSocketWithEmails[
                    res.game.player1.socketID
                ].email].status = 'GAMING';
                emails[matchSocketWithEmails[
                    res.game.player1.socketID
                ].email].matchID = res.game.matchID;
                // player 2
                emails[matchSocketWithEmails[
                    res.game.player2.socketID
                ].email].status = 'GAMING';
                emails[matchSocketWithEmails[
                    res.game.player2.socketID
                ].email].matchID = res.game.matchID;

                console.log(
                    'notifying GAME_CAN_START to both players',
                    emails[matchSocketWithEmails[
                        res.game.player1.socketID
                    ].email],
                    emails[matchSocketWithEmails[
                        res.game.player2.socketID
                    ].email]
                );
            }
        } else {
            /**
             * uno de los usuarios o los dos, no aceptaron
             * la invitacion para empezar a jugar, entonces
             * vamos a regresar a ambos al lobby a esperar
             * ser emparejados de nuevo
             */
            console.log('juego cancelado');
            emails[matchSocketWithEmails[
                res.game.player1.socketID
            ].email].status = 'WAITING';
            emails[matchSocketWithEmails[
                res.game.player2.socketID
            ].email].status = 'WAITING';
            io
                .to(res.game.player1.socketID)
                .to(res.game.player2.socketID)
                .emit('GAME_CANCELLED');
        }
    });

    socket.on("disconnecting", () => {
        // the Set contains at least the socket ID
        console.log('anonymous is disconnecting', socket.rooms,);

        if (matchSocketWithEmails[socket.id]) {
            console.log(
                "NO! it's not anonymous, the email is",
                matchSocketWithEmails[socket.id].email,
            );
            totalParticipants -= 1;
            console.log('totalParticipants', totalParticipants);
            io.emit('totalParticipants', totalParticipants);
            emails[matchSocketWithEmails[socket.id].email].isActive = false;
            emails[matchSocketWithEmails[socket.id].email].status = 'OFFLINE';
            console.log('emails', emails);
            delete matchSocketWithEmails[socket.id];
        }
    });

    socket.on('WANNA_PLAY', () => {
        if (matchSocketWithEmails[socket.id]) {
            emails[matchSocketWithEmails[socket.id].email].status = 'MATCHING';
            
            // emit event 'READY_TO_PLAY'
            wannaPlayUsers.push(matchSocketWithEmails[socket.id]);
            eventEmitter.emit('READY_TO_PLAY');
        }
    });

    socket.on('WIN', (data) => {
        console.log(data.winner, 'has just defeated', data.looser);
        emails[data.winner.email].winStrike += 1;
        emails[data.winner.email].status = 'WAITING';
        emails[data.looser.email].winStrike = 0;
        emails[data.looser.email].status = 'WAITING';
        leaderBoard = [];
        Object.keys(emails).forEach(key => leaderBoard.push(emails[key]));
        leaderBoard
            .sort((a, b) => b.winStrike - a.winStrike)
            .splice(10);
        io.emit('leaderBoard', { leaderBoard });
    });

    socket.on('TIRADA', (data) => {
        console.log('inside TIRADA');
        console.log('your socket id is', socket.id);
        console.log('matchSocketWithEmails', matchSocketWithEmails);
        const { player1, player2 } = games[emails[
            matchSocketWithEmails[socket.id].email
        ].matchID];
        const rivalSocketID = socket.id === player1.socketID ? player2.socketID : player1.socketID;
        io.to(rivalSocketID).emit('TIRADA_RIVAL', data);
    });

    socket.on('LOGIN', (data, callback) => {
        /**
         * login twice from the same session is not allowed
         * OR multi-session is not allowed
         */
        if (matchSocketWithEmails[socket.id]
            || emails[data.email]?.isActive
        ) {
            callback('REJECTED');
            return;
        } else if (emails[data.email]?.isActive === false) {
            // login
            emails[data.email].isActive = true;
            emails[data.email].status = 'WAITING';
            emails[data.email].socketID = socket.id;
            emails[data.email].matchID = null;
        } else {
            // sign up
            emails[data.email] = {
                isActive: true,
                winStrike: 0,
                email: data.email,
                status: 'WAITING',
                socketID: socket.id,
                matchID: null,
            };
        }

        matchSocketWithEmails[socket.id] = emails[data.email];

        totalParticipants += 1;
        console.log('totalParticipants', totalParticipants);
        console.log('matchSocketWithEmails', matchSocketWithEmails);
        io.emit('totalParticipants', totalParticipants);

        callback('WELCOME');
    });

    socket.on('UPDATE', (email) => {
        const oldSocketID = emails[email].socketID;
        console.log('inside UPDATE replacing old', oldSocketID, matchSocketWithEmails[oldSocketID]);
        emails[email].socketID = socket.id;
        delete matchSocketWithEmails[oldSocketID];
        matchSocketWithEmails[socket.id] = emails[email];
        console.log('with new socket id', socket.id, matchSocketWithEmails[socket.id]);
    });

    socket.on('GET_GAME_DATA', (_data, callback) => {
        if (matchSocketWithEmails[socket.id]) {
            const game = games[matchSocketWithEmails[socket.id].matchID];
            if (game.player1.socketID === socket.id) {
                // player1 has requested game info
                game.you_are = game.player1.email;
                game.you_play_with = 'X';
                game.rival = game.player2;
            } else {
                // player2 has requested game info
                game.you_are = game.player2.email;
                game.you_play_with = 'O';
                game.rival = game.player1;
            }
            callback({
                answer: 'OK',
                game,
            });
        } else {
            callback({ answer: 'This socket does not have an active game' });
        }
    });
});

} catch (err) {
    console.error(err);
}

server.listen(process.env.PORT || 3000, () => {
  console.log(`listening on http://localhost:${process.env.PORT || 3000}`);
});