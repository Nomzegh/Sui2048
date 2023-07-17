const sui = require('@mysten/sui.js');
const Ed25519Keypair = sui.Ed25519Keypair;
const JsonRpcProvider = sui.JsonRpcProvider;
const RawSigner = sui.RawSigner;
const Connection = sui.Connection;
const SequenceNumber = sui.SequenceNumber;
const TransactionBlock = sui.TransactionBlock;
const fromB64 = sui.fromB64;

const fs = require('fs');


//Install Node.js: https://nodejs.org/en/download | Скачайте и установите Node.js
//Install sui.js with the command: "npm install @mysten/sui.js" | Установите sui.js с помощью команды "npm install @mysten/sui.js"
//Before starting the script, paste your game object addresses in objects.txt | Перед тем как запускать скрипт, создайте файл objects.txt и внесите туда адреса контрактов своих NFT-игр
//-------CONFIG--------
const packageObjectId = '0x225a5eb5c580cb6b6c44ffd60c4d79021e79c5a6cea7eb3e60962ee5f9bc6cb2'; // general SUI 8192 contract (8192 package object id).
const privateKeyHex = 'PRIVATE_KEY'; // private key WITHOUT 0x | Приватный ключ без 0x
const connection = new Connection({
    fullnode: 'https://sui-rpc.publicnode.com', // highly recommended to set Sui RPC from https://www.ankr.com/rpc/sui/ | Можете поставить рпс с Ankr, или оставить как есть
});
//----------------

const privateKeyBase64 = Buffer.from(privateKeyHex, 'hex').toString('base64');
const keypair = Ed25519Keypair.fromSecretKey(fromB64(privateKeyBase64));
const provider = new JsonRpcProvider(connection);
const signer = new RawSigner(keypair, provider);


function loadTransactionObjects() {
    return new Promise((resolve, reject) => {
        let transactionObjects = [];
        fs.readFile('objects.txt', 'utf8', (err, data) => {
            if (err) {
                reject(err);
                return;
            }

            const lines = data.split('\n');

            lines.forEach(line => {
                if (line.trim() !== '') {
                    transactionObjects.push(line.trim());
                }
            });

            resolve(transactionObjects);
        });
    });
}


async function transactMoveCall(transactionObjects, txObjectIndex = 0, retryCount = 0) {
    let tx = new TransactionBlock();

    tx.moveCall({
        target: `${packageObjectId}::game_8192::make_move`,
        arguments: [
            tx.object(transactionObjects[txObjectIndex]), // Transaction object id (NFT game contract)
            tx.pure(Math.floor(Math.random() * 4)), // Chooses a random move
        ],
        typeArguments: [],
    });

    try {
        const result = await signer.signAndExecuteTransactionBlock({ // Send transaction
            transactionBlock: tx,
        });
        console.log('Successfully sent tx')
    } catch (error) {
        if (error.message.includes("could not automatically determine a budget")) {
            if (retryCount < 10) {
                console.log('Picked impossible random move', retryCount);
                await transactMoveCall(transactionObjects, txObjectIndex, retryCount + 1);
            } else if (txObjectIndex < transactionObjects.length - 1) {
                console.log('Switching transaction object due to the lack of legal moves'); // Switch to the next game if current has ended
                transactionObjects.splice(txObjectIndex, 1);  // Remove exhausted transaction object
                await transactMoveCall(transactionObjects, txObjectIndex);
            } else {
                console.error('Exhausted all transaction objects and retries, still facing issue. ENDING THE SCRIPT', error); // If no more fresh games available, end the script
                process.exit(1);
            }
        } else {
            console.error('Error signing transaction block'); // Regular error, ignore 
        }
    }
}


(async () => {
    let transactionObjects = await loadTransactionObjects();
    for (let i = 0; i < 100000; i++) {
        if (transactionObjects.length === 0) {
            console.error('No more transaction objects left');
            break;
        }
        await transactMoveCall(transactionObjects).catch(console.error);
    }
})();
