"use strict";

var express = require('express');
var http = require('http');
const WebSocket = require('ws');
const PORT = /*process.env.PORT ||*/ 5000;

var app = express();

const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

app.use(express.static(__dirname + '/public'));

app.use(express.json());
app.use(express.urlencoded());

app.get('/', (req, res) => {
	res.render("index.ejs");
});

app.post('/app', (req, res) => {
	let admin = isAdmin(req.body.idRoom, req.body.playerId);
	res.render('buzz.ejs', { admin: admin });
});

var salle = {};

var wsL = [];

var servId = "28720a12s5c1gfar1fg0g0jira2fp";
var wsSelf = new WebSocket("ws://127.0.0.1:" + PORT);

wss.on("connection", function conncetion(ws) {
	ws.on('message', function message(raw) {
		let data = JSON.parse(raw);
		let msg = {};
		let idRoom = "";
		let playerId;
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
					playerId = 0;
					playerId = createPlayer(data.id, 'admin', 'admin');
					msg = {
						type: 'create',
						id: data.id,
						result: 'ok',
						playerId: playerId
					}
					ws.send(JSON.stringify(msg));
				}
				break;
			case 'join':
				let result = 'nop';
				playerId = 0;
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
				ws.send(JSON.stringify(msg));
				break;
			case 'joined':
				idRoom = data.idRoom;
				playerId = data.playerId;
				ws.idRoom = idRoom;
				break;
			case 'getPlayersAll':
				idRoom = data.idRoom;
				playerId = data.playerId;
				if (salle[idRoom] != undefined && isAdmin(idRoom, playerId)) {
					msg = {
						type: 'getPlayersAll',
						players: salle[idRoom].players
					}
					ws.send(JSON.stringify(msg));
				}
				break;
			case 'sendPlayersAll':
				idRoom = data.idRoom;
				playerId = data.playerId;
				if (salle[idRoom] != undefined && isAdmin(idRoom, playerId)) {
					msg = {
						type: 'getPlayersAll',
						players: salle[idRoom].players
					}
					wss.clients.forEach(function each(client) {
						if (client.readyState === WebSocket.OPEN && client.idRoom == ws.idRoom) {
							client.send(JSON.stringify(msg));
						}
					});
				}
				break;
			case 'start':
				idRoom = data.idRoom;
				playerId = data.playerId;
				if (isAdmin(idRoom, playerId)) {
					salle[idRoom].temps = data.temps;
					salle[idRoom].etat = 'start';
					clearInterval(salle[idRoom].interval);
					if (data.temps != -1)
						salle[idRoom].interval = setInterval((param) => {
							if (param.temps > 0) {
								param.temps--;
							}
							else {
								param.etat = 'stop';
								clearInterval(param.interval);
							}
						}, 1000, salle[idRoom]);
					resetPlayersScore(idRoom);
					msg = {
						type: 'start',
						temps: salle[idRoom].temps
					}
					ws.idRoom = idRoom;
					wss.clients.forEach(function each(client) {
						if (client.readyState === WebSocket.OPEN && client.idRoom == ws.idRoom) {
							client.send(JSON.stringify(msg));
						}
					});
				}
				break;
			case 'stop':
				idRoom = data.idRoom;
				playerId = data.playerId;
				if (isAdmin(idRoom, playerId)) {
					salle[idRoom].etat = 'stop';
					clearInterval(salle[idRoom].interval);
					msg = {
						type: 'stop',
						temps: salle[idRoom].temps
					}
					ws.idRoom = idRoom;
					wss.clients.forEach(function each(client) {
						if (client.readyState === WebSocket.OPEN && client.idRoom == ws.idRoom) {
							client.send(JSON.stringify(msg));
						}
					});
				}
				break;
			case 'reset':
				idRoom = data.idRoom;
				playerId = data.playerId;
				if (isAdmin(idRoom, playerId)) {
					salle[idRoom].temps = data.temps;
					salle[idRoom].etat = 'stop';
					clearInterval(salle[idRoom].interval);

					msg = {
						type: 'stop',
						temps: salle[idRoom].temps
					}
					ws.idRoom = idRoom;
					wss.clients.forEach(function each(client) {
						if (client.readyState === WebSocket.OPEN && client.idRoom == ws.idRoom) {
							client.send(JSON.stringify(msg));
						}
					});
				}
				break;
			case 'buzz':
				idRoom = data.idRoom;
				playerId = data.playerId;


				let score = Date.now() - salle[idRoom].players[playerId].time;
				score /= 1000;

				salle[idRoom].players[playerId].score = score;
				msg = {
					type: 'buzz'
				}
				ws.idRoom = idRoom;
				wss.clients.forEach(function each(client) {
					if (client.readyState === WebSocket.OPEN && client.idRoom == ws.idRoom) {
						client.send(JSON.stringify(msg));
					}
				});
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
		role: role,
		score: -1,
		point: 0
	}
	return id;
}

function addPlayerPoint(idRoom, playerId, point)
{
	salle[idRoom].players[playerId].point += point;
}

function setPlayerPoint(idRoom, playerId, point)
{
	salle[idRoom].players[playerId].point = point;
}

function resetPlayersScore(idRoom) {
	let players = salle[idRoom].players;
	for (let id in players) {
		let player = players[id];
		player.score = -1;
		player.time = Date.now();
		player.point = 0;
	}
}

function getListSalleId() {
	let result = [];
	for (let id in salle)
		result.push(id);
	return result;
}

function isAdmin(idRoom, playerId) {
	return (playerId == servId || salle[idRoom].players[playerId].role == 'admin');
}


function generateId() {
	return Math.floor(Math.random() * 1000000);
}