import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

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
