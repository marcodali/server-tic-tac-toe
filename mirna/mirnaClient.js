import { io } from "socket.io-client";

const socket = io.connect('http://localhost:3000/miKasa', {reconnect: true});

socket.on('connect', function () {
    console.log('Connected with socket.id', socket.id);
});

socket.emit('list', { bruja: 'Miruca' }, (response) => {
    console.log('response from server', response);
    console.log('BTW mi socket.id es', socket.id);
});
