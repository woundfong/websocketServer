const express = require('express');
const http = require('http');
const url = require('url');
const WebSocket = require('ws');
const router = express.Router();
const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
let clients = {}, locks = {};
let verifyClient = function(info) {
  if(info.req.headers.authorization != "wx.huanfeng.site") {
    return false;
  }
  return true;
}
app.post('/endParking', (req, res, next) => {
  console.log(req.body)
  res.send(req.body)
})
app.get('/endParking', (req, res, next) => {
  console.log(req.query)
  res.send(req.query)
})
const server = http.createServer(app);
const wss = new WebSocket.Server({
  server: server,
  verifyClient: verifyClient
});

function heartbeat(buffer) {
  console.log(buffer.toString())
  this.isAlive = true;
}
wss.on('connection', function connection(ws, req) {
  ws.isAlive = true;
  ws.on('pong', heartbeat);
  let location = url.parse(req.url, true);
  let parkingUnitId = location.query.parkingUnitId, type = location.query.type;
  console.log(location.query.parkingUnitId);
  if(type == "client") {
    clients[parkingUnitId] = {};
    clients[parkingUnitId].ws = ws;
    clients[parkingUnitId].user = location.query.user;
    ws.on('message', function incoming(message) {
      console.log('received from client: %s', message);
    });
  } else if(type == "lock") {
    locks[parkingUnitId] = ws;
    ws.on('message', function incoming(message) {
      console.log('received from lock: %s', message);
      if(message.status == 0) {
        let options = {
          port: 2000,
          method: "POST",
          path: "/api/parking?user=" + clients[parkingUnitId].user + "&parkingUnitId=" + parkingUnitId,
          auth: "wx.huanfeng.site"
        }
        let httpReq = http.request(options, res => {
          let data = "";
          res.on('data', (chunk)=>{
              data += chunk;
          });
          res.on('end', ()=>{
            console.log(JSON.parse(data));
            //callback(result);   websocket.send(data[, options][, callback]) data:any, options: Object, callback: Function
          })
        })
        httpReq.on('error', error => {
            throw error;
        });
        httpReq.end();
      }
      
    });
  }
  
  ws.on("close", (code, reason) => {
    console.log("-----------------------------websocket close----------------------------" + reason);
    if(type == "client") {
      delete clients[parkingUnitId]
    }
  })
});

const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate();

    ws.isAlive = false;
    ws.ping("ping"); //每隔一段时间检测是否有已失效的connection
    ws.send("ping"); //发送心跳包
  });
}, 540000);
server.listen(8480, function listening() {
  console.log('Listening on %d', server.address().port);
});
