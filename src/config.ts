/*
Author: Alexey Usov (dax@xdax.ru, https://github.com/doubleaxe)
Please don't remove this comment if you use unmodified file
*/
import fs from 'node:fs';
import defaults from '../etc/config-default.json';

export interface ConfigType {
    host: string;
    port: number;
    db: string;
    proxy: string;
    secret: string;
    hashid: string;
}

export function loadConfig(path: string | undefined, overrides: Partial<ConfigType>): ConfigType {
    let config: Partial<ConfigType> | undefined = undefined;
    if(path) {
        try {
            config = JSON.parse(fs.readFileSync(path, 'utf8'));
        } catch(err) {
            if((err as NodeJS.ErrnoException).code != 'ENOENT')
                throw err;
            console.error(`No config file found at ${path}, using defaults`);
        }
    } else {
        console.error('No config file specified, using defaults');
    }

    const result: ConfigType = {
        ...defaults as ConfigType,
        ...config,
        ...overrides,
    };
    console.log(`Loaded config: ${JSON.stringify(result)}`);
    return result;
}
