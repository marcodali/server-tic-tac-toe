import { promises as fs } from 'fs';

export const createNewNamespace = (rombit, name, events) => ({
    connection: (socket) => {
        // default events
        console.log(`anonymous connected to namespace ${name}`);
        socket.on("disconnecting", () => {
            console.log(`${
                [...socket.rooms].join('')
            } is disconnecting from namespace ${name}`);
        });

        // make socket variable accessible inside eventCode
        rombit[name] = socket;

        // custom events
        for (const [eventName, eventCode] of events) {
            const [params, functionBody] = eventCode.split(' => ');
            socket.on(eventName, new Function(params.slice(1, -1), functionBody));
        }
    }
});

const isValidVariableName = (param) => param.match(/^[a-zA-Z_$][a-zA-Z_$0-9]*$/);

export const translatorFromFile = async (filename) => {
    const data = (await fs.readFile(filename)).toString();
    let [params] = data.split('=>');
    params = params.trim();
    if (params[0] == '(' && params.at(-1) == ')') {
        params = params.slice(1, -1);
    }
    params = params.split(',').map(x => x.trim());
    if (params.length != params.filter(x => isValidVariableName(x)).length) {
        throw new Error(`function params malformed ${params}`)
    }
    console.log('params ready', params.join(','));
    return str;
}