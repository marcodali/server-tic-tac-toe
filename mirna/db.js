import { createClient } from 'redis';

export const redis = createClient({
    password: 'csSxASWydUs5n9WNoCjRRx8sD4vYqSBC',
    socket: {
        host: 'redis-19340.c1.us-west-2-2.ec2.cloud.redislabs.com',
        port: 19340
    }
});
