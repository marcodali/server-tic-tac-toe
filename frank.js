import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const sessions = {};

try {

io.on('connection', (socket) => {
    console.log('anonymous connected');

    socket.on('PROF_START_CLASS', (res) => {
        console.log('inside PROF_START_CLASS', res.session, res.status);
        if (res.session in sessions) {
            // do nothing
        } else {
            // create class with empty student list
            sessions[res.session] = [];
        }
    });

    socket.on('STUDENT_ENTER_CLASS', (res, callback) => {
        console.log('inside STUDENT_ENTER_CLASS', res);
        if (res.session in sessions) {
            /**
             * find the student in the list,
             * if not present then add it
             */
            const student = sessions[res.session]
                .find(student => student.user === res.user);
            if (!student) {
                sessions[res.session].push({
                    user: res.user,
                    raisedHand: false,
                })
            }
            callback(sessions[res.session]);
        } else {
            const msg = `ERROR: el alumno ${
                res.user
            } esta en una session que no existe ${
                res.session
            }`;
            console.error(msg);
            callback(msg);
        }
    });

    socket.on("disconnecting", () => {
        // the Set contains at least the socket ID
        console.log('anonymous is disconnecting', socket.rooms,);
    });
});

} catch (err) {
    console.error(err);
}

server.listen(process.env.PORT || 3000, () => {
  console.log(`running frank on http://localhost:${process.env.PORT || 3000}`);
});