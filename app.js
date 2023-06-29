const express = require("express");
const WebSocket = require("ws");
const cors = require('cors');

const app = express();

// 设置基本配置和中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// 启用跨域请求
app.use(cors());

// 引入不同的模块
const deployRoute = require('./route');

// 注册模块路由
app.use('/deploy', deployRoute);

// 处理根路径的HTTP请求
app.get("/", (req, res) => {
    res.send("Hello, World!");
});

// 创建HTTP服务器
const server = app.listen(3001, () => {
    console.log("HTTP server is running on port 3001");
});
// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

// 将 WebSocket 实例保存在 Express 应用程序中
app.set('wss', wss);

// 处理WebSocket连接
wss.on("connection", (ws) => {
    console.log("New WebSocket connection");

    // 接收WebSocket消息
    ws.on("message", (message) => {
        const msg = message.toString("utf-8");

        console.log("Received:", msg);

        // 发送消息给所有连接的WebSocket客户端
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(msg);
            }
        });
    });
    ws.send("Hello client");
    setInterval(() => {
        ws.send("Hello client " + Date.now());
    }, 1000 * 60);
});
