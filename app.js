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

app.get('/:idRoom', (req, res) => {
	res.render("buzz.ejs");
});

app.post('/app', (req,res)=>{
	let admin = isAdmin(req.body.idRoom, req.body.playerId);
	res.render('buzz.ejs', {admin: admin});
});

var salle = {};

var wsL = [];

var servId = "28720a12s5c1gfar1fg0g0jira2fp";
var wsSelf = new WebSocket("ws://127.0.0.1:" + PORT);

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
			case 'reset':
					{
						let idRoom = data.idRoom;
						let playerId = data.playerId;
						if (isAdmin(idRoom, playerId)) {
							salle[idRoom].temps = data.temps;
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
			case 'buzz':
				{
					let idRoom = data.idRoom;
					let playerId = data.playerId;

					
					let score = Date.now() - salle[idRoom].players[playerId].time;
					score /= 1000;
					
					salle[idRoom].players[playerId].score = score;
					msg = {
						type: 'buzz'
					}
					wss.clients.forEach(function each(client) {
						if (client.readyState === WebSocket.OPEN && client.idRoom == ws.idRoom) {
							client.send(JSON.stringify(msg));
						}
					});
				}
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
		score: -1
	}
	return id;
}

function resetPlayersScore(idRoom)
{
	let players = salle[idRoom].players;
	for(let id in players)
	{
		let player = players[id];
		player.score = -1;
		player.time = Date.now(); 
	}
}

function getListSalleId() {
	let result = [];
	for (let id in salle)
		result.push(id);
	return result;
}

function isAdmin(idRoom, playerId) {
	return ( playerId == servId ||  salle[idRoom].players[playerId].role == 'admin');
}


function generateId() {
	return Math.floor(Math.random() * 1000000);
}