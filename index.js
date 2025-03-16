require('./settings');
const fs = require('fs');
const pino = require('pino');
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');
const { Boom } = require('@hapi/boom');
const NodeCache = require('node-cache');
const { exec, spawn, execSync } = require('child_process');
const { parsePhoneNumber } = require('awesome-phonenumber');
const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason, makeInMemoryStore, makeCacheableSignalKeyStore, fetchLatestBaileysVersion, proto, getAggregateVotesInPollMessage } = require('@whiskeysockets/baileys');

const pairingCode = process.argv.includes('--qr') ? false : process.argv.includes('--pairing-code') || global.pairing_code;
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (text) => new Promise((resolve) => rl.question(text, resolve))

global.api = (name, path = '/', query = {}, apikeyqueryname) => (name in global.APIs ? global.APIs[name] : name) + path + (query || apikeyqueryname ? '?' + decodeURIComponent(new URLSearchParams(Object.entries({ ...query, ...(apikeyqueryname ? { [apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name] } : {}) }))) : '')

const DataBase = require('./src/database');
const database = new DataBase(global.tempatDB);
const msgRetryCounterCache = new NodeCache();
const groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false });


(async () => {
	const loadData = await database.read()
	if (loadData && Object.keys(loadData).length === 0) {
		global.db = {
			set: {},
			users: {},
			game: {},
			groups: {},
			database: {},
			...(loadData || {}),
		}
		await database.write(global.db)
	} else {
		global.db = loadData
	}
	
	setInterval(async () => {
		if (global.db) await database.write(global.db)
	}, 30000)
})();

const { GroupUpdate, GroupParticipantsUpdate, MessagesUpsert, Solving } = require('./src/message');
const { isUrl, generateMessageTag, getBuffer, getSizeMedia, fetchJson, sleep } = require('./lib/function');

async function startApiisBot() {
	let lastMessageTime = Date.now();
	const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) })
	const { state, saveCreds } = await useMultiFileAuthState('Session');
	const { version, isLatest } = await fetchLatestBaileysVersion();
	const level = pino({ level: 'silent' })
	
	const getMessage = async (key) => {
		if (store) {
			const msg = await store.loadMessage(key.remoteJid, key.id);
			return msg?.message || ''
		}
		return {
			conversation: 'Halo Saya Apiis Bot'
		}
	}
	
	const Apiis = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true,
        fireInitQueries: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: true,
        markOnlineOnConnect: true,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });
	
	if (pairingCode && !Apiis.authState.creds.registered) {
		let phoneNumber;
		async function getPhoneNumber() {
			phoneNumber = global.number_bot ? global.number_bot : await question('Please type your WhatsApp number : ');
			phoneNumber = phoneNumber.replace(/[^0-9]/g, '')
			
			if (!parsePhoneNumber(phoneNumber).valid && phoneNumber.length < 6) {
				console.log(chalk.bgBlack(chalk.redBright('Start with your Country WhatsApp code') + chalk.whiteBright(',') + chalk.greenBright(' Example : 62xxx')));
				await getPhoneNumber()
			}
		}
		
		setTimeout(async () => {
			await getPhoneNumber()
			await exec('rm -rf ./Session/*')
			console.log('Requesting Pairing Code...')
			await new Promise(resolve => setTimeout(resolve, 2000));
			let code = await Apiis.requestPairingCode(phoneNumber);
			console.log(`Your Pairing Code : ${code}`);
		}, 3000)
	}
	
    /*const SESSION_DIR = path.join(__dirname, "Session"); // Ubah sesuai lokasi session

// Fungsi untuk menghapus file yang lebih dari 1 jam
function deleteOldSessions() {
    if (!fs.existsSync(SESSION_DIR)) return;

    fs.readdir(SESSION_DIR, (err, files) => {
        if (err) return console.error("Gagal membaca sesi:", err);

        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(SESSION_DIR, file);
            fs.stat(filePath, (err, stats) => {
                if (err) return console.error("Gagal mendapatkan info file:", err);

                if (now - stats.mtimeMs > 60 * 60 * 1000) { // Lebih dari 1 jam
                    fs.unlink(filePath, err => {
                        if (!err) console.log(`Session ${file} dihapus`);
                    });
                }
            });
        });
    });
}
setInterval(deleteOldSessions, 60 * 1000);

 const SESSION_DIR = path.join(__dirname, "Session"); // Ubah sesuai lokasi session
const EXCLUDED_FILES = ["creds.json"]; // File yang tidak boleh dihapus

// Fungsi untuk menghapus semua file kecuali yang dikecualikan
function deleteSessions() {
    if (!fs.existsSync(SESSION_DIR)) return;

    fs.readdir(SESSION_DIR, (err, files) => {
        if (err) return console.error("Gagal membaca sesi:", err);

        files.forEach(file => {
            if (EXCLUDED_FILES.includes(file)) return; // Lewati file yang dikecualikan

            const filePath = path.join(SESSION_DIR, file);
            fs.unlink(filePath, err => {
                if (!err) console.log(`Session ${file} dihapus`);
            });
        });
    });
}

// Jalankan setiap **1 menit**
setInterval(deleteSessions, 60 * 60 * 1000);

// Jalankan saat bot mulai

const cluster = require('cluster');
const http = require('http');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  // Fork worker processes
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
  });
} else {
  // Worker processes have a HTTP server
  http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Hello World');
  }).listen(7030);
}*/
    
    
	store.bind(Apiis.ev)
	
	await Solving(Apiis, store)
	
	Apiis.ev.on('creds.update', saveCreds)
	
	Apiis.ev.on('connection.update', async (update) => {
		const { connection, lastDisconnect, receivedPendingNotifications } = update
		if (connection === 'close') {
			const reason = new Boom(lastDisconnect?.error)?.output.statusCode
			if (reason === DisconnectReason.connectionLost) {
				console.log('Connection to Server Lost, Attempting to Reconnect...');
				await startApiisBot()
			} else if (reason === DisconnectReason.connectionClosed) {
				console.log('Connection closed, Attempting to Reconnect...');
				await startApiisBot()
			} else if (reason === DisconnectReason.restartRequired) {
				console.log('Restart Required...');
				await startApiisBot()
			} else if (reason === DisconnectReason.timedOut) {
				console.log('Connection Timed Out, Attempting to Reconnect...');
				await startApiisBot()
			} else if (reason === DisconnectReason.badSession) {
				console.log('Delete Session and Scan again...');
				await startApiisBot()
			} else if (reason === DisconnectReason.connectionReplaced) {
				console.log('Close current Session first...');
				await startApiisBot()
			} else if (reason === DisconnectReason.loggedOut) {
				console.log('Scan again and Run...');
				exec('rm -rf ./Session/*')
				process.exit(1)
			} else if (reason === DisconnectReason.Multidevicemismatch) {
				console.log('Scan again...');
				exec('rm -rf ./Session/*')
				process.exit(0)
			} else {
				Apiis.end(`Unknown DisconnectReason : ${reason}|${connection}`)
			}
		}
		if (connection == 'open') {
			console.log('Connected to : ' + JSON.stringify(Apiis.user, null, 2));
			let botNumber = await Apiis.decodeJid(Apiis.user.id);
			if (db.set[botNumber] && !db.set[botNumber]?.join) {
				if (my.ch.length > 0 && my.ch.includes('@newsletter')) {
					if (my.ch) await Apiis.newsletterMsg(my.ch, { type: 'follow' }).catch(e => {})
					db.set[botNumber].join = true
				}
			}
		}
		if (receivedPendingNotifications == 'true') {
			console.log('Please wait About 1 Minute...')
			Apiis.ev.flush()
		}
	});
	
	Apiis.ev.on('contacts.update', (update) => {
		for (let contact of update) {
			let id = Apiis.decodeJid(contact.id)
			if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
		}
	});
	
	Apiis.ev.on('call', async (call) => {
		let botNumber = await Apiis.decodeJid(Apiis.user.id);
		if (db.set[botNumber].anticall) {
			for (let id of call) {
				if (id.status === 'offer') {
					let msg = await Apiis.sendMessage(id.from, { text: `Saat Ini, Kami Tidak Dapat Menerima Panggilan ${id.isVideo ? 'Video' : 'Suara'}.\nJika @${id.from.split('@')[0]} Memerlukan Bantuan, Silakan Hubungi Owner :)`, mentions: [id.from]});
					await Apiis.sendContact(id.from, global.owner, msg);
					await Apiis.rejectCall(id.id, id.from)
				}
			}
		}
	});
	
let lastOwnerMessageTime = 0; // Simpan waktu terakhir owner mengirim pesan
Apiis.ev.on('messages.upsert', async (message) => {
    lastMessageTime = Date.now();
    
    let msg = message.messages[0];
    if (!msg.message) return;
    
    let sender = msg.key.participant || msg.key.remoteJid;
    let isGroup = msg.key.remoteJid.endsWith('@g.us');
    let ownerBots = '628151666922@s.whatsapp.net'; // Ganti dengan nomor owner
    let now = Date.now();

    if (isGroup && sender === ownerBots) {
        if (now - lastOwnerMessageTime >= 3600000) { // 1 jam delay
            await Apiis.sendMessage(msg.key.remoteJid, { text: "halo ownerku" }, { quoted: msg });
            lastOwnerMessageTime = now; // Update waktu terakhir pesan owner
        }
    }

    await MessagesUpsert(Apiis, message, store, groupCache);
});

	
	Apiis.ev.on('groups.update', async (update) => {
		await GroupUpdate(Apiis, update, store, groupCache);
	});
	
	Apiis.ev.on('group-participants.update', async (update) => {
		await GroupParticipantsUpdate(Apiis, update, store, groupCache);
	});
	
	setInterval(() => {
		if (Date.now() - lastMessageTime > 30 * 60 * 1000) {
			console.log('No messages received for 30 minutes, restarting bot...');
			process.exit(0);
		}
	}, 30 * 60 * 1000);

	return Apiis
}

startApiisBot()

let file = require.resolve(__filename)
fs.watchFile(file, () => {
	fs.unwatchFile(file)
	console.log(chalk.redBright(`Update ${__filename}`))
	delete require.cache[file]
	require(file)
});