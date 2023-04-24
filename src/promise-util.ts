/*
Author: Alexey Usov (dax@xdax.ru, https://github.com/doubleaxe)
Please don't remove this comment if you use unmodified file
*/

export function promiseTimeout<T>(ms: number, promise?: Promise<T>, noThrow?: boolean) {
    let id: NodeJS.Timeout;
    const timeout = new Promise<undefined>(function(resolve, reject) {
        id = setTimeout(function() {
            noThrow ? resolve(undefined) : reject(new Error('Timeout'));
        }, ms);
    });
    return Promise.race([
        promise,
        timeout,
    ]).then(function(result) {
        clearTimeout(id);
        return result;
    });
}
