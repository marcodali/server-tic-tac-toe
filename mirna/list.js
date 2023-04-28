a,b => {
    console.log('las propiedades que recibi del socket son', payload);
    console.log('mi socket.id es', socket.id);
    callback('HELLO_WORLD!');
}