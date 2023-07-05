const express = require("express");
const cors = require('cors');
const bodyParser = require('body-parser');
const { startWebSocketServer } = require('./src/websocket');

const app = express();

// 设置基本配置和中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// 解析 URL 编码的请求体
app.use(bodyParser.urlencoded({ extended: false }));
// 解析 JSON 请求体
app.use(bodyParser.json());

// 启用跨域请求
app.use(cors());

// 引入不同的模块
const deployRoute = require('./src/route');
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
// 启动WebSocket服务器
const wsServer = startWebSocketServer(server);

// 将 WebSocket 实例保存在 Express 应用程序中
app.set('wsServer', wsServer);
