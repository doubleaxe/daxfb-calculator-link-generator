/*
Author: Alexey Usov (dax@xdax.ru, https://github.com/doubleaxe)
Please don't remove this comment if you use unmodified file
*/

import readline from 'readline';
import {promiseTimeout} from './promise-util';

type TerminateListener = () => Promise<unknown> | undefined;
const terminateListeners: TerminateListener[] = [];

if(process.platform === 'win32') {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.on('SIGINT', function() {
        process.emit('SIGINT');
    });
}

process.on('SIGINT', function() {
    terminate('stop');
});

process.on('beforeExit', function() {
    terminate('exit');
});

let terminating = false;
export function terminate(reason: string) {
    if(terminating) {
        return;
    }
    terminating = true;

    console.log(`terminating ${reason} ...`);
    (async() => {
        for(const listener of terminateListeners) {
            try {
                await promiseTimeout(60000, listener());
            } catch(e) {
                const _e = e as Error;
                console.error(_e.stack ? _e.stack : _e);
            }
        }
    })().finally(() => {
        process.exit(0);
    });
}

export function onTerminate(listener: TerminateListener) {
    terminateListeners.push(listener);
}
