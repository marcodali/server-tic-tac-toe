import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const players = {};

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
        }

        const playersArr = Object.keys(players)
        if (playersArr.length >= 2) {
            const p1 = players[playersArr.pop()];
            const p2 = players[playersArr.pop()];
            io
                .to(p1.socketID)
                .emit('START_GAME', {
                    id: p2.id,
                    name: p2.name,
                    myRol: 'player1',
                    totalQuestions: 10,
                });
            io
                .to(p2.socketID)
                .emit('START_GAME', {
                    id: p1.id,
                    name: p1.name,
                    myRol: 'player2',
                    totalQuestions: 5,
                });
            delete players[p1.id];
            delete players[p2.id];
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
