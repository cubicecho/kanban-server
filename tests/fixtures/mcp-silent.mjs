/**
 * A stdio child that starts and then says nothing at all.
 *
 * Not a broken server — a slow one, standing in for the case `connectTimeoutMs` is for: a `uvx`
 * package downloading itself before it answers, or a server wedged on something. It never speaks,
 * so the only thing that ends the handshake is the bound the pool was given.
 */
process.stdin.resume();
setInterval(() => {}, 1000);
