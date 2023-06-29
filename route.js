const axios = require("axios");
const fs = require("fs");
const express = require("express");
const WebSocket = require("ws");
const sqlUtil = require("./sqlUtil");

const router = express.Router();

const ARTIFACTS_USERNAME = "wangshiyuan";
const ARTIFACTS_PASSWORD = "zhito26@#";
const ARTIFACTS_API_KEY = "AKCp8nzqQaRKVZGfYHimkQh9FK3FHq2mkaaRtgJZhjaeYL71aUXU3RTJbFBjNTT9CqNoMTdru";
const ARTIFACTS_BUILD_JSON = "zhito-ai-module/";
const DOWNLOAD_DIR = "/home/wangshiyuan/code/00deploy/download/";
const EXTRACT_DIR = "/home/wangshiyuan/code/00deploy/download/";
const ARTIFACTS_BASE_URL = "https://artifactory.zhito.com/artifactory";

// 处理特定路径的路由
router.get("/", (req, res) => {
    res.send("测试 " + Date.now());
});

router.get("/projects", (req, res) => {
    const sql = `SELECT id, name, platform, artifacts_url, vehicles, date_format(date_add(create_time, INTERVAL 8 Hour), '%Y-%m-%d %H:%i:%S') AS create_time FROM deploy_project`;
    sqlUtil.executeQuery(sql, [], (err, results) => {
        console.info("projects查询结果：", err, results);
        if (err) {
            res.status(500).send("服务器内部错误");
        } else {
            res.json(results);
        }
    });
});

router.get("/packages", (req, res) => {
    const base = "https://artifactory.zhito.com/artifactory/api/storage";
    const url = base + "/GSL4_X86/cicd";
    axios
        .get(url, {
            timeout: 6000 * 5,
            auth: {
                username: ARTIFACTS_USERNAME,
                password: ARTIFACTS_PASSWORD
            }
        })
        .then((response) => {
            const files = response.data.children.map((child) => child.uri);
            res.json(files);
        })
        .catch((error) => {
            console.error("获取文件列表失败:", error);
            res.status(500).send("获取文件列表失败");
        });
});

router.get("/download", (req, res) => {
    const packageName = "GSL4_X86-20230606-144811-v0.1.4.tar.gz";
    const url = ARTIFACTS_BASE_URL + "/GSL4_X86/cicd/" + packageName;
    const time = Date.now();

    console.info("开始下载 " + time);
    // 获取 WebSocket 实例
    const wss = req.app.get("wss");
    // 发送消息给所有连接的WebSocket客户端
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send("开始下载 " + time);
        }
    });
    axios
        .get(url, {
            timeout: 6000 * 5,
            auth: {
                username: ARTIFACTS_USERNAME,
                password: ARTIFACTS_PASSWORD
            },
            responseType: "arraybuffer"
        })
        .then((response) => {
            if (response.status === 200) {
                // fs.writeFileSync(DOWNLOAD_DIR, Buffer.from(response.data, 'binary'));
                const fileDir = DOWNLOAD_DIR + time + ".tar.gz";
                fs.writeFile(fileDir, Buffer.from(response.data, "binary"), console.info);
                console.log("文件下载成功" + time);
                // 发送消息给所有连接的WebSocket客户端
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send("文件下载成功 " + time);
                    }
                });
                // 写入数据库
                sqlUtil.executeQuery(
                    `insert into deploy_download_task (package, file_dir, state)
                             values(?, ?, 1)`,
                    [packageName, fileDir],
                    (err, results) => {
                        if (err) {
                            console.info("服务器内部错误");
                        } else {
                            console.info("文件下载完成了");
                        }
                    }
                );
            } else {
                console.log("文件下载失败");
            }
        })
        .catch((error) => {
            console.error("发生错误:", error);
        });
    res.send("下载中 " + Date.now());
});

// 使用示例
router.get("/users", (req, res) => {
    sqlUtil.executeQuery("select id, name, telephone, role from user where role = ?", [1], (err, results) => {
        console.info("查询结果：", err, results);
        if (err) {
            res.status(500).send("服务器内部错误");
        } else {
            res.json(results);
        }
    });
});

module.exports = router;
