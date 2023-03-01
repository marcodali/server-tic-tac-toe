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
            { ...game, you_play_with: 'O', rival: player1 },
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
                console.log('notifying GAME_CAN_START to', res.game.player1, res.game.player2);
                
                // player 1 is always X
                io.to(res.game.player1.socketID).emit(
                    'GAME_CAN_START',
                    { ...res.game, you_play_with: 'X', rival: res.game.player2 },
                );
                io.to(res.game.player2.socketID).emit(
                    'GAME_CAN_START',
                    { ...res.game, you_play_with: 'O', rival: res.game.player1 },
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
        emails[data.winner].winStrike += 1;
        emails[data.looser].winStrike = 0;
        leaderBoard = [];
        Object.keys(emails).forEach(key => leaderBoard.push(emails[key]));
        leaderBoard
            .sort((a, b) => b.winStrike - a.winStrike)
            .splice(10);
        io.emit('leaderBoard', { leaderBoard });
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
        } else {
            // sign up
            emails[data.email] = {
                isActive: true,
                winStrike: 0,
                email: data.email,
                status: 'WAITING',
                socketID: socket.id,
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
        emails[email].socketID = socket.id;
        delete matchSocketWithEmails[oldSocketID];
        matchSocketWithEmails[socket.id] = emails[email];
    });
});

server.listen(process.env.PORT || 3000, () => {
  console.log(`listening on http://localhost:${process.env.PORT || 3000}`);
});