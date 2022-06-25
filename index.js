const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require('cors');
const { localValidation } = require("./validator");

const app = express();
app.use(cors());
app.use(express.json())
const PORT = 8000;
const availableCommands = [
    "switch-off",
    "switch-on"
]

// const server = http.createServer(app);
const server = app.listen(PORT, () => console.log("Server Started at port: " + PORT));

const wss = new WebSocket.Server({ server: app, path: '/sockets' });

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, socket => {
        wss.emit('connection', socket, request);
    });
});

const getActualRequestDurationInMilliseconds = start => {
    const NS_PER_SEC = 1e9; // convert to nanoseconds
    const NS_TO_MS = 1e6; // convert to milliseconds
    const diff = process.hrtime(start);
    return (diff[0] * NS_PER_SEC + diff[1]) / NS_TO_MS;
};

const logger = (req, res, next) => {
    next();
    let current_datetime = new Date();
    let formatted_date =
        current_datetime.getFullYear() +
        "-" +
        (current_datetime.getMonth() + 1) +
        "-" +
        current_datetime.getDate() +
        " " +
        current_datetime.getHours() +
        ":" +
        current_datetime.getMinutes() +
        ":" +
        current_datetime.getSeconds();
    let method = req.method;
    let url = req.url;
    let requestedBy = req.socket?.remoteAddress;
    let status = res.statusCode;
    const start = process.hrtime();
    const durationInMilliseconds = getActualRequestDurationInMilliseconds(start);
    let log = `${requestedBy.replace(/^[^0-9]+/, "")} -> [${formatted_date}] %s${method}\x1b[0m: ${url} %s${status}\x1b[0m ${durationInMilliseconds.toLocaleString()} ms`;
    console.log(log, getColor(method), getColor(status));
}

const getColor = (method) => {
    if (method === "GET" || method === 200 || method === 201)
        return "\x1b[32m";
    else if (method === "POST" || method === 301 || method === 302)
        return "\x1b[33m";
    else if (method === 404 || method === "DELETE" || method === 400 || method === 422 || method === 401 || method === 409 || method === 403)
        return "\x1b[31m";
    else
        return "\x1b[32m";
}

app.use(logger)

function hearbeat() {
    this.isAlive = true;
}

let connections = new Map();
let clients = [];

wss.on("connection", (ws, req) => {

    ws.isAlive = true;
    // ws.on("pong", hearbeat)

    let [_path, params] = req.url && req.url.split('?');

    if (params) {
        let _params = params && params.split('&');
        let object = {};
        buildParamObject(_params, object)
        if (object) {
            let { device } = object;
            connections.set(ws, { device });
            ws.send(JSON.stringify({ message: `Welcome client ${device} to my world` }))
            if (!clients.includes(device)) {
                clients.push(device)
            }
        } else {
            ws.send(JSON.stringify({ message: "Identify yourself fool..." }))
        }
    }
});

const buildParamObject = (_params, object) => {
    _params && _params.length > 0 && _params.forEach((param) => {
        if (param) {
            let keyVal = param.split("=");
            if (keyVal[1] === 'true') {
                keyVal[1] = true;
            } else if (keyVal[1] === 'false') {
                keyVal[1] = false;
            } else if (/^\d+$/.test(keyVal[1])) {
                keyVal[1] = parseFloat(keyVal[1])
            }
            Object.assign(object, { [keyVal[0]]: keyVal[1] })
        }
    })
}

const interval = setInterval(() => {
    wss.clients.forEach((client) => {
        let { device } = connections.get(client);
        if (client.isAlive === false) {
            disconnectClient(client, () => { }, true, device);
            return client.terminate();
        }
        client.ping();
    });
}, 10000);

wss.on("close", () => {
    clearInterval(interval);
})

const disconnectClient = (client, callback, processing, device) => {
    if (processing) {
        let idx = clients.findIndex(x => x === device);
        if (idx > -1) {
            connections.delete(client);
            clients.splice(idx, 1);
            processing = false;
            callback({ code: 400, message: `The requested client(${device}) has disconnected.` }, null);
            console.log("Removing Dormant/Inactive device: %d", device);
        }
    }
}

const handleClientEvents = (client, device, method, callback) => {
    let timeout = 5;
    let processing = false;
    const timer = setTimeout(() => {
        if (processing) disconnectClient(client, callback, processing, device);
    }, timeout * 1000)
    let metadata = connections.get(client);
    switch (client.readyState * 1) {
        case WebSocket.OPEN:
            if (device === metadata.device) {
                processing = true;
                client.send(method);
                client.ping();
                client.on("message", (data, isBinary) => {
                    callback(null, { data, isBinary });
                    processing = false;
                    clearTimeout(timer);
                })
            }
            break;
        case WebSocket.CLOSED:
            console.log("Closing Socket for: ", metadata.device);
            if (metadata.device === device) {
                processing = true;
                client.send('check-alive');
                client.on("message", (data, isBinary) => {
                    let message = isBinary ? data : JSON.parse(data.toString());
                    if (message === true || message === 'true') {
                        callback(null, { data, isBinary })
                        processing = false;
                        clearTimeout(timer);
                    } else {
                        client.terminate();
                        processing = false;
                        disconnectClient(client, callback, processing, device);
                        clearTimeout(timer);
                    }
                })
            }
            break;
        default:
            console.log("Unknown Status of WS for: %d, with Socket Code: %d", metadata.device, client.readyState);
    }
}

app.get("/api/clients", (req, res) => {
    [...connections.keys()].map((client) => {
        let { device } = connections.get(client);
        handleClientEvents(client, device, "check-alive", (error, response) => {
            if (error) {
                console.log("error occured checking alive clients", error);
            } else if (response) {
                console.log("Client response", response);
            }
        })
    })
    if (clients.length > 0) {
        res.status(200).json({
            message: "List of connected clients",
            clients: clients,
            requestedBy: req.socket.remoteAddress.replace(/^[^0-9]+/, ""),
            success: true,
        })
    } else {
        res.status(400).json({
            message: "No connected clients found.",
            requestedBy: req.socket.remoteAddress.replace(/^[^0-9]+/, ""),
            error: true
        })
    }
})

app.get("/api/flush-clients", (req, res) => {
    [...connections.keys()].map((client) => {
        client.terminate();
        clients = [];
    })
    res.status(200).json({
        message: "All clients connections flushed."
    })
})

// app.get("/", (req, res) => {
//     res.sendFile(`${__dirname}/index.html`)
// })

app.post("/api/notify-client", (req, res) => {
    let data = req.body;
    let validationRule = {
        device: ["required"],
        payload: ["required", "string"]
    }
    const validation = localValidation(data, validationRule, {}, false);
    if (validation.localvalidationerror) {
        res.status(422).json({
            message: validation.error,
            error: true
        })
    } else {
        if (!availableCommands.includes(data.payload)) {
            res.status(400).json({
                message: `(${data.payload}) did not match any of our available commands, please try again!`,
                commands: availableCommands,
                error: true
            })
        } else {
            if (!clients.includes(data['device'])) {
                res.status(400).json({ message: "Device not connected or found on network.", error: true })
            } else {
                [...connections.keys()].map((client) => {
                    handleClientEvents(client, data['device'], data['payload'], (error, response) => {
                        if (error) {
                            if (!res.headersSent) {
                                res.status(error.code).json({
                                    message: error.message,
                                    error: true
                                })
                            }
                        } else {
                            let { data, isBinary } = response;
                            let message = isBinary ? data : JSON.parse(data.toString());
                            message["transaction_time"] = Date.now();
                            if (!res.headersSent) {
                                res.status(200).json({
                                    data: message,
                                    success: true
                                })
                            }
                        }
                    })
                })
            }
        }
    }
})

app.get("/api/client", (req, res) => {
    let _params = req.url && req.url.split('?')[1] && req.url.split('?')[1].split('&');
    let object = {};
    buildParamObject(_params, object);
    if (!object.device) {
        res.status(422).json({
            message: 'Please specify device id to get details.'
        })
    } else if (!clients.includes(object.device)) {
        res.status(400).json({ message: "Client not connected or found on network" })
    } else {
        try {
            if (object) {
                let { device } = object;
                if (!clients.includes(device)) {
                    res.status(404).json({
                        message: `No client with device id: ${device} connected found!`,
                        success: false
                    })
                }
                [...connections.keys()].map((client) => {
                    handleClientEvents(client, device, 'get-data', (error, response) => {
                        if (error) {
                            if (!res.headersSent) {
                                res.status(error.code).json({
                                    message: error.message,
                                    success: false
                                })
                            }
                        } else {
                            let { data, isBinary } = response;
                            let message = isBinary ? data : JSON.parse(data.toString());
                            if (!res.headersSent) {
                                res.status(200).json({
                                    data: message,
                                    clients: clients,
                                    type: client.protocol,
                                })
                            }
                        }
                    })
                })
            }
        } catch (e) {
            console.log("error", e);
            if (!res.headersSent) {
                res.status(500).json({
                    message: 'No Clients Connected',
                    clients_list: wss.clients,
                    error: true
                })
            }
        }
    }
})