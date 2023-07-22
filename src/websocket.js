const WebSocket = require("ws");
const { updateVehicleInfo, getPackageList, getProjectInfo, sendMsgToAll, upgrade } = require("./business");

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
                const { carName: vehicle, pageNo, pageSize } = message;
                switch (type) {
                    case "GetPackages":
                        getPackageList(vehicle, pageNo, pageSize).then((v) => {
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
                    case "Task":
                        console.info("vehicle:", vehicle, message);
                        getProjectInfo(vehicle).then((v) => {
                            console.info("projectInfo:", v);
                            // TODO: 参数格式
                            const params = {
                                project: v.id,
                                project_artifacts: v.artifacts_url,
                                creator: 1,
                                vehicles: vehicle,
                                package_on_artifacts: undefined,
                                package_on_vehicle: "HWL4_X86-20230608-110818-v1.0.28.tar.gz",
                                cur_package: "HWL4_X86-20230609-155310-v1.0.31.tar.gz"
                            };
                            upgrade(params, wsServer).then(console.info);
                        });

                        break;
                    default:
                        break;
                }
            } catch (error) {}
        });

        // setInterval(() => {
        //     ws.send(
        //         JSON.stringify({
        //             type: "HeartBeat",
        //             message: {
        //                 timestamp: Date.now()
        //             }
        //         })
        //     );
        // }, 1000 * 5);
    });
    // 返回WebSocket Server实例
    return wsServer;
}

module.exports = { startWebSocketServer };
