import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createNewNamespace, translatorFromFile } from './commonMirna.js'
import { redis } from './db.js';

/**
 * Initialize the express server and
 * bind it to the socket io library
 */
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

/**
 * All socket connections are saved here and are
 * global accesible so that new dinamically
 * created functions have access to it
 */
const rombit = {};

/**
 * Start redis connection to retrieve
 * the functions from the namespaces
 */
const namespacesEventsFunctions = {};
redis.on('error', err => console.error('Redis Client Error', err));
await redis.connect();
translatorFromFile('./list.js');

/**
 * Retrieve the functions events listeners
 * and emits from redis for every namespace
 */
const namespaces = await redis.keys('namespace:*');
for (const fullname of namespaces) {
    const [,name] = fullname.split(':');
    const methods = await redis.hGetAll(fullname);
    namespacesEventsFunctions[name] = createNewNamespace(
        rombit,
        name,
        Object.entries(methods),
    );
}

/**
 * Once the namespaces names and bodyfunctions are loaded from redis
 * we have to dynamically create these namespaces into socket.io
 * and attach the functions listeners and emit events
 */
try {

    for (const key of Object.keys(namespacesEventsFunctions)) {
        io.of(`/${key}`).on("connection", namespacesEventsFunctions[key].connection);
    }
    
} catch (err) {
    console.error(err);
}

/**
 * Put the server working hard
 */
server.listen(process.env.PORT || 3000, () => {
    console.log(`running mirna on http://localhost:${
        process.env.PORT || 3000
    }`);
});