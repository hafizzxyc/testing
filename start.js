const path = require('path');
const { spawn, exec } = require('child_process');
const readline = require('readline');
const pm2 = require('pm2');

function start() {
    let args = [path.join(__dirname, 'index.js'), ...process.argv.slice(2)];
    let p = spawn(process.argv[0], args, {
        stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    }).on('message', data => {
        if (data === 'reset') {
            console.log('Restarting Bot...');
            p.kill();
            start();
            delete p;
        } else if (data === 'uptime') {
            p.send(process.uptime());
        }
    }).on('exit', code => {
        if (code !== 0) {
            console.error('Exited with code: ', code);
            start();
        } else if (code === 0) {
            start();
        }
    });

    // Setup readline to accept commands from console
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.on('line', (input) => {
        // Execute the command entered in the console
        exec(input, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`Stderr: ${stderr}`);
                return;
            }
            console.log(`Output: ${stdout}`);
        });
    });
}

start();