const axios = require("axios");
const fs = require("fs");
const express = require("express");
const WebSocket = require("ws");
const router = express.Router();

// 处理特定路径的路由
router.get("/", (req, res) => {
  res.send("用户列表 " + Date.now());
});

router.get("/download", (req, res) => {
  const ARTIFACTS_USERNAME = "wangshiyuan";
  const ARTIFACTS_PASSWORD = "zhito26@#";
  const ARTIFACTS_API_KEY =
    "AKCp8nzqQaRKVZGfYHimkQh9FK3FHq2mkaaRtgJZhjaeYL71aUXU3RTJbFBjNTT9CqNoMTdru";
  const ARTIFACTS_BUILD_JSON = "zhito-ai-module/";
  const DOWNLOAD_DIR = "/Users/wangshiyuan/code/work/deploy-server/demo/";
  const EXTRACT_DIR = "/home/wangshiyuan/code/vehicle-server/app/demo/extract";
  const ARTIFACTS_BASE_URL = "https://artifactory.zhito.com/artifactory";
  // const url = "https://artifactory.zhito.com:443/artifactory/GSL4_X86/cicd/GSL4_X86-20230606-144811-v0.1.4.tar.gz"
  const url =
    "https://desktop.docker.com/mac/main/amd64/Docker.dmg?utm_source=docker&utm_medium=webreferral&utm_campaign=dd-smartbutton&utm_location=module&_gl=1*12hgluw*_ga*MTkxNjYyMTAxMy4xNjg3OTk1NDU4*_ga_XJWPQMJYHQ*MTY4Nzk5NTQ1OC4xLjEuMTY4Nzk5NTQ2MS41Ny4wLjA.";
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
        fs.writeFile(
          DOWNLOAD_DIR + time + ".dmg",
          Buffer.from(response.data, "binary"),
          console.info
        );
        console.log("文件下载成功" + time);
        // 发送消息给所有连接的WebSocket客户端
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send("文件下载成功 " + time);
          }
        });
      } else {
        console.log("文件下载失败");
      }
    })
    .catch((error) => {
      console.error("发生错误:", error);
    });
  res.send("下载中 " + Date.now());
});

module.exports = router;
