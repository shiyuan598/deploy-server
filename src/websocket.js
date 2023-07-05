const WebSocket = require("ws");
const { updateVehicleInfo, getPackageList } = require("./business");

// 向所有客户端发送消息
const sendMsgToAll = (wsServer, msg) => {
    // 发送消息给所有连接的WebSocket客户端
    wsServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
};

function startWebSocketServer(server) {
    const wsServer = new WebSocket.Server({ server });

    // 处理WebSocket连接
    wsServer.on("connection", (ws) => {
        console.log("New WebSocket connection");

        // 接收WebSocket消息
        ws.on("message", (message) => {
            const msg = message.toString("utf-8");

            console.log("Received:", msg, typeof msg);

            try {
                const data = JSON.parse(msg);
                const { type, message } = data;
                switch (type) {
                    case "GetPackages":
                        const { carName: vehicle, pageNo, pageSize } = message;
                        getPackageList(vehicle, pageNo, pageSize).then((v) => {
                            console.info("getPackageList:", v);
                            sendMsgToAll(
                                wsServer,
                                JSON.stringify({
                                    type: "PackageInfo",
                                    message: {
                                        packageList: v.data,
                                        pagination: v.pagination
                                    }
                                })
                            );
                        });
                        // 发送消息给所有连接的WebSocket客户端
                        sendMsgToAll(wsServer, msg);
                        break;
                    case "CarInfo":
                        updateVehicleInfo(message);
                        break;
                    default:
                        break;
                }
            } catch (error) {}
        });

        setInterval(() => {
            ws.send(
                JSON.stringify({
                    type: "HeartBeat",
                    message: {
                        timestamp: Date.now()
                    }
                })
            );
        }, 1000 * 5);
    });
    // 返回WebSocket Server实例
    return wsServer;
}

module.exports = { startWebSocketServer };
