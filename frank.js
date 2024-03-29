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

    socket.on('PROF_START_CLASS', (res, callback) => {
        console.log(
            'inside PROF_START_CLASS',
            res.session,
            res.status,
            res.user,
            socket.id,
        );
        if (res.session in sessions) {
            // do nothing
        } else if (res.status === 'on') {
            // create class with a hacked student list
            sessions[res.session] = [{
                user: res.user,
                raisedHand: false,
                socketID: socket.id,
            }];
            console.log(
                'nueva clase con 1 persona (el profesor) empieza...',
            );
            callback(sessions[res.session]);

            // avisar a otros estudiantes que la clase empezo
            let firstTime = true;
            for (const student of sessions[res.session]) {
                console.log(`sending to ${
                    firstTime ? 'teacher' : 'student'
                }`, student.socketID);
                io.to(student.socketID)
                    .emit('STUDENTS_LIST', sessions[res.session]);
                firstTime = false;
            }
        }
    });

    socket.on('PROF_END_CLASS', (res) => {
        console.log(
            'inside PROF_END_CLASS',
            res.session,
            res.status,
            socket.id,
        );
        if (res.session in sessions && res.status === 'off') {
            // delete the key from the sessions object
            console.log(
                'clase con',
                sessions[res.session].length,
                'students eliminando...',
            );
            delete sessions[res.session];
        } else {
            console.error(
                'No puedo terminar la clase por que',
                res, 'y tambien por que',
                Object.keys(sessions),
            );
        }
    });

    socket.on('STUDENT_END_CLASS', (res, callback) => {
        console.log(
            'inside STUDENT_END_CLASS',
            res.session,
            res.user,
            socket.id,
        );
        if (res.session in sessions) {
            // delete the student from the session array
            const studentIndex = sessions[res.session]
                .findIndex(student => student.user === res.user);
            if (studentIndex !== -1) {
                sessions[res.session].splice(studentIndex, 1);
                console.log(
                    'se salio 1 estudiante de la clase',
                    res.session,
                    'ahora solo hay',
                    sessions[res.session].length,
                );
                callback(sessions[res.session]);

                // avisar a otros estudiantes que un estudiante se fue
                let firstTime = true;
                for (const student of sessions[res.session]) {
                    console.log(`sending to ${
                        firstTime ? 'teacher' : 'student'
                    }`, student.socketID);
                    io.to(student.socketID)
                        .emit('STUDENTS_LIST', sessions[res.session]);
                    firstTime = false;
                }
            } else {
                const msg = `ERROR: el alumno ${
                    res.user
                } quiere irse de una clase que si existe ${
                    res.session
                } pero que nunca entro`;
                console.error(msg);
                callback(msg);
            }
        } else {
            const msg = `ERROR: el alumno ${
                res.user
            } quiere irse de una clase que no existe ${
                res.session
            }`;
            console.error(msg);
            callback(msg);
        }
    });

    socket.on('STUDENT_ENTER_CLASS', (res, callback) => {
        console.log(
            'inside STUDENT_ENTER_CLASS',
            res.session,
            res.user,
            socket.id,
        );
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
                    socketID: socket.id,
                });
            }
            console.log(
                'la clase ahora tiene',
                sessions[res.session].length,
                'students',
            );
            callback(sessions[res.session]);

            // avisar a otros estudiantes que un estudiante entro
            let firstTime = true;
            for (const student of sessions[res.session]) {
                console.log(`sending to ${
                    firstTime ? 'teacher' : 'student'
                }`, student.socketID);
                io.to(student.socketID)
                    .emit('STUDENTS_LIST', sessions[res.session]);
                firstTime = false;
            }
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

    socket.on('STUDENT_HAND', (res, callback) => {
        console.log(
            'inside STUDENT_HAND',
            res.user,
            res.session,
            res.raisedHand,
            socket.id,
        );
        if (res.session in sessions) {
            const student = sessions[res.session]
                .find(student => student.user === res.user);
            if (student) {
                console.log(
                    'el alumno',
                    res.user,
                    'de la session',
                    res.session,
                    `esta ${
                        res.raisedHand ? 'levantando' : 'bajando'
                    } la mano`,
                );
                student.raisedHand = res.raisedHand;
                callback(sessions[res.session]);
                /**
                 * avisar a otros estudiantes que un
                 * estudiante hizo algo con su mano
                 */
                let firstTime = true;
                for (const student of sessions[res.session]) {
                    console.log(`sending to ${
                        firstTime ? 'teacher' : 'student'
                    }`, student.socketID);
                    io.to(student.socketID)
                        .emit('STUDENTS_LIST', sessions[res.session]);
                    firstTime = false;
                }
                return;
            }
        }

        const msg = `ERROR: el alumno ${
            res.user
        } no puede ${
            res.raisedHand ? 'levantar' : 'bajar'
        } la mano de la session ${
            res.session
        } por que ${
            Object.keys(sessions)
        } ademas ${
            sessions[res.session]
        }`;
        console.error(msg);
        callback(msg);
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
    console.log(`running frank on http://localhost:${
        process.env.PORT || 3000
    }`);
});
