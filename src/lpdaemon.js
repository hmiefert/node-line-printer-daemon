const net		= require('net');
const EventEmitter	= require('events');
const Binary		= require('binary');

const ZERO	= new Buffer([0]);
const NEWLINE	= new Buffer('\n');

class LPDaemon extends EventEmitter {

	constructor(ip, port) {
		super();

		this._tcpPort	= port	|| 515;
		this._ipAddress	= ip	|| '127.0.0.1';

		this.daemon = net.createServer(socket => {
			let stream = Binary.stream(socket);
			let metadata = {};

			stream
			.scan('RecievePrintJob', NEWLINE)
			.tap(data => {
				metadata.queue = _extractQueueName(data.RecievePrintJob);
				socket.write(ZERO);
			
				stream
				.scan('RecieveControlFile', NEWLINE)
				.tap(data => {
					metadata.cFileLength = _extractFileLength(data.RecieveControlFile);
					metadata.cFileName = _extractFileName(data.RecieveControlFile);
					socket.write(ZERO);
						
					stream
					.buffer('cFile', metadata.cFileLength)
					.buffer('zero', 1)
					.tap(cfile => {
						socket.write(ZERO);
						
						stream
						.scan('RecieveDataFile', NEWLINE)
						.tap(data => {
							metadata.dFileLength = _extractFileLength(data.RecieveDataFile);
							metadata.dFileName = _extractFileName(data.RecieveDataFile);
							socket.write(ZERO);

							stream
							.buffer('dFile', metadata.dFileLength)
							.buffer('zero', 1)
							.tap(data => {
								socket.write(ZERO);
								this.emit('job', {
									jobInfo: metadata,
								       	files: {
										cFile: data.cFile,
									       	dFile: data.dFile
									}
								});
							});
						});				
					});
				});
			});

			
			socket.on('close', () => {
				stream.flush();
				console.log("Connection closed");
			});

			socket.on('error', err => {
				stream.flush();
				console.log(`An error occured. ErrorObj: ${JSON.stringify(err)}`);
			});
		});		
	}

	listen(cb) {
		this.daemon.listen(this._tcpPort, this._ipAddress, cb);
	};
};

function _extractQueueName(data) {
	let queueName = data.slice(1).toString() || "unknown";
	return queueName;
};

function _extractFileLength(data) {
	let digits = data.slice(1).toString('utf-8').split(' ')[0]
	let fileLength = parseInt(digits, 10);
	return fileLength;
};

function _extractFileName(data) {
        return data.slice(1).toString('utf-8').split(' ')[1] || "unknown";
};

module.exports = {
	LPDaemon : LPDaemon
};
