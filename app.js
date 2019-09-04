"use strict";

var express = require('express');
var http = require('http');
const WebSocket = require('ws');
const PORT = /*process.env.PORT ||*/ 5000;

var app = express();

const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
	res.render("index.ejs");
});

app.get('/:idRoom', (req, res) => {
	res.render("buzz.ejs");
});

var salle = {};

var wsL = [];

wss.on("connection", function conncetion(ws) {
	ws.on('message', function message(raw) {
		let data = JSON.parse(raw);
		let msg = {};
		switch (data.type) {
			case 'create':
				if (salleExist(data.id)) {
					msg = {
						type: 'create',
						id: data.id,
						result: 'exist'
					}
					ws.send(JSON.stringify(msg));
				}
				else {
					salle[data.id] = {
						nbPlayer: 0,
						nbPlayerMax: 4,
						players: {},
						etat: 'stop',
						temps: 0,
						interval: undefined,
					};
					let playerId = 0;
					playerId = createPlayer(data.id, 'admin', 'admin');
					msg = {
						type: 'create',
						id: data.id,
						result: 'ok',
						playerId: playerId
					}
					ws.idRoom = data.id;
					ws.send(JSON.stringify(msg));
				}
				break;
			case 'join':
				let result = 'nop';
				let playerId = 0;
				if (canJoin(data.id)) {
					result = 'ok';
					playerId = createPlayer(data.id, data.pseudo, 'player');
					//salle[data.id].wsArr.push(ws);
				}
				msg = {
					type: 'join',
					id: data.id,
					result: result,
					playerId: playerId
				}
				ws.idRoom = data.id;
				ws.send(JSON.stringify(msg));
				break;
			case 'getPlayersAll':
				{
					let idRoom = data.idRoom;
					let playerId = data.playerId;
					if (salle[idRoom] != undefined && isAdmin(idRoom, playerId)) {
						msg = {
							type: 'getPlayersAll',
							players: salle[idRoom].players
						}
						ws.send(JSON.stringify(msg));
					}
				}
				break;

			case 'start':
				{
					let idRoom = data.idRoom;
					let playerId = data.playerId;
					if (isAdmin(idRoom, playerId)) {
						salle[idRoom].temps = data.temps;
						salle[idRoom].etat = 'start';
						if (data.temps != -1)
							salle[idRoom].interval = setInterval((param) => {
								if (param.temps > 0) {
									param.temps--;
									console.log(param.temps);
								}
								else {
									param.etat = 'stop';
									clearInterval(param.interval);
								}
							}, 1000, salle[idRoom]);
						msg = {
							type: 'start',
							temps: salle[idRoom].temps
						}
						wss.clients.forEach(function each(client) {
							if (client.readyState === WebSocket.OPEN && client.idRoom == ws.idRoom) {
								client.send(JSON.stringify(msg));
							}
						});
					}
				}
				break;
			case 'stop':
				{
					let idRoom = data.idRoom;
					let playerId = data.playerId;
					if (isAdmin(idRoom, playerId)) {
						salle[idRoom].etat = 'stop';
						clearInterval(salle[idRoom].interval);
						msg = {
							type: 'stop',
							temps: salle[idRoom].temps
						}
						wss.clients.forEach(function each(client) {
							if (client.readyState === WebSocket.OPEN && client.idRoom == ws.idRoom) {
								client.send(JSON.stringify(msg));
							}
						});
					}
				}
				break;
			case 'restart':
				break;
		}
	});
});

server.listen(PORT, () => {
	console.log("server started on " + PORT);
});

function salleExist(id) {
	let result = false;
	for (let idRoom in salle)
		if (idRoom == id) {
			result = true;
			break;
		}
	return result;
}

function canJoin(id) {
	let result = false;
	if (salleExist(id))
		if (salle[id].nbPlayer < salle[id].nbPlayerMax)
			result = true;
	return result;
}

function createPlayer(idRoom, pseudo, role) {
	let id = generateId();
	salle[idRoom].players[id] = {
		pseudo: pseudo,
		role: role
	}
	return id;
}

function getListSalleId() {
	let result = [];
	for (let id in salle)
		result.push(id);
	return result;
}

function isAdmin(idRoom, playerId) {
	return salle[idRoom].players[playerId].role == 'admin';
}

function broadcastRoom(idRoom, msg) {
	/*for (let id in salle[idRoom].players) {
		//console.log(salle[idRoom].players[id].ws.send == undefined);
		salle[idRoom].players[id].ws.send("test");
	}*/

	wsL.forEach(ws => {
		console.log(ws.readyState = WebSocket.OPEN);
		if (ws.readyState === WebSocket.OPEN && ws.idRoom == idRoom)
			ws.send(JSON.stringify(msg));
	});
}

function generateId() {
	return Math.floor(Math.random() * 1000000);
}