const axios = require("axios");
const fs = require("fs");
const express = require("express");
const WebSocket = require("ws");
const sqlUtil = require("./tools/sqlUtil");
const artifacts = require("./tools/artifacts");

const router = express.Router();

// 响应处理
const fullFilled = (response, data, pagination) => {
    response.json({
        code: 0,
        data,
        pagination,
        msg: "成功"
    });
};

// route异常处理
const errorHandler = (response, err) => {
    response &&
        response.status(500).json({
            code: 1,
            msg: err.toString()
        });
};

// 向所有客户端发送消息
const sendMsgToAll = (request, msg) => {
    // 获取 WebSocket 实例
    const wss = request.app.get("wss");
    // 发送消息给所有连接的WebSocket客户端
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
}

// 处理特定路径的路由
router.get("/", (req, res) => {
    res.send("测试 " + Date.now());
});

// 查询所有项目
router.get("/projects", (request, response) => {
    try {
        const sql = `SELECT id, name, platform, artifacts_url, vehicles,
        date_format(date_add(create_time, INTERVAL 8 Hour), '%Y-%m-%d %H:%i:%S') AS create_time FROM deploy_project`;
        const query = sqlUtil.execute(sql, []);
        query.then(
            (value) => fullFilled(response, value),
            (error) => errorHandler(response, error)
        );
    } catch (error) {
        (error) => errorHandler(response, error);
    }
});

// 查询一个项目对应的包信息
router.get("/packages", (request, response) => {
    try {
        const artifacts_url = request.query.artifacts_url;
        if (!artifacts_url) {
            response.status(500).json({
                code: 1,
                msg: "参数错误"
            });
        }
        artifacts.getAllFiles(artifacts_url).then(
            (value) => fullFilled(response, value),
            (error) => errorHandler(response, error)
        );
    } catch (error) {
        errorHandler(error, response);
    }
});

// 查询一个包的JSON描述信息
router.get("/package/json", (request, response) => {
    try {
        const { project, package } = request.query;
        if (!project || !package) {
            response.status(500).json({
                code: 1,
                msg: "参数错误"
            });
        }
        artifacts.findJsonByName(project, package).then(
            (value) => fullFilled(response, value),
            (error) => errorHandler(response, error)
        );
    } catch (error) {
        (error) => errorHandler(response, error);
    }
});

// 查询一辆车信息
router.get("/vehicle/info", (request, response) => {
    try {
        const vehicle = request.query.vehicle;
        if (!vehicle) {
            response.status(500).json({
                code: 1,
                msg: "参数错误"
            });
        }
        const sql = `SELECT cur_package, local_packages, timestamp FROM deploy_vehicle_info WHERE vehicle = ?`;
        const query = sqlUtil.execute(sql, [vehicle]);
        query.then(
            (value) => fullFilled(response, value),
            (error) => errorHandler(response, error)
        );
    } catch (error) {
        (error) => errorHandler(response, error);
    }
});

// 查询任务组
router.get("/group/list", async (request, response) => {
    try {
        const { pageNo = 1, pageSize = 10, name = "", orderField = "id", orderSeq = "descend" } = request.query;
        const num = parseInt(pageNo);
        const size = parseInt(pageSize);
        const sql = `
            SELECT COUNT(DISTINCT task_group.id) AS total
            FROM deploy_task_group as task_group
            LEFT JOIN deploy_upgrade_task AS task ON task.group = task_group.id
            LEFT JOIN deploy_project AS project ON project.id = task_group.project
            WHERE task.state < ?
            AND (project.name LIKE ?
                OR task_group.creator LIKE ?
                OR task_group.create_time LIKE ?)
            HAVING COUNT(CASE WHEN task.state < ? THEN 1 ELSE NULL END) > 0
        `;
        // TODO:需要确定具体的状态值
        const finishedState = 4;
        const params = [finishedState, `%${name}%`, `%${name}%`, `${name}%`, finishedState];
        const queryTotal = await sqlUtil.execute(sql, params);
        const total = queryTotal[0].total;
        if (!total) {
            fullFilled(response, [], { current: num, pageSize: size, total });
        } else {
            // 查询分页的数据
            const sql = `
                SELECT task_group.id, project.name, task_group.creator, 
                DATE_FORMAT(DATE_ADD(task_group.create_time, INTERVAL 8 HOUR), '%Y-%m-%d %H:%i:%S') AS create_time,
                task_group.cur_package, task_group.vehicles, task_group.packages,
                COUNT(CASE WHEN task.state < ? THEN 1 ELSE NULL END) AS unfinished,
                COUNT(task.id) AS total
                FROM deploy_task_group as task_group
                LEFT JOIN deploy_upgrade_task AS task ON task.group = task_group.id
                LEFT JOIN deploy_project as project ON project.id = task_group.project
                WHERE project.name LIKE ?
                OR task_group.creator LIKE ?
                OR task_group.update_time LIKE ?
                GROUP BY task_group.id, project.name, task_group.creator, task_group.create_time,
                        task_group.cur_package, task_group.vehicles, task_group.packages
                HAVING COUNT(CASE WHEN task.state < ? THEN 1 ELSE NULL END) > 0
                ORDER BY task_group.${orderField} ${orderSeq === "ascend" ? "ASC" : "DESC"}
                LIMIT ${size} OFFSET ${(num - 1) * size}
            `;
            const params = [finishedState, `%${name}%`, `%${name}%`, `${name}%`, finishedState];
            const query = sqlUtil.execute(sql, params);
            query.then(
                (value) => fullFilled(response, value, { current: num, pageSize: size, total }),
                (error) => errorHandler(response, error)
            );
        }
    } catch (error) {
        (error) => errorHandler(response, error);
    }
});

// 查询升级任务
router.get("/task/list", async (request, response) => {
    try {
        const {
            pageNo = 1,
            pageSize = 10,
            group_id = "",
            vehicle = "",
            project_id = "",
            name = "",
            orderField = "id",
            orderSeq = "descend"
        } = request.query;
        const num = parseInt(pageNo);
        const size = parseInt(pageSize);
        // 注意查询总量时不要传递page参数
        const getSqlAndParams = (fields, order, page) => {
            let sql = `
                SELECT ${fields}
                FROM deploy_upgrade_task AS task
                LEFT JOIN (
                    SELECT task_group.id, task_group.project, task_group.creator, project.name FROM deploy_task_group AS task_group
                        LEFT JOIN deploy_project AS project ON project.id = task_group.project
                ) AS sub_g ON task.group = sub_g.id
                LEFT JOIN deploy_task_state AS task_state ON task.state = task_state.state
                WHERE (
                        task.vehicle LIKE ? OR
                        task.package LIKE ? OR
                        sub_g.name LIKE ? OR
                        task_state.name LIKE ? OR
                        task.create_time LIKE ?
                    )
                ${group_id ? "AND task.group = ?" : ""}
                ${vehicle ? "AND task.vehicle = ?" : ""}
                ${project_id ? "AND sub_g.project = ?" : ""}
            `;
            if (order) {
                const { field, seq } = order;
                if (field && seq) {
                    sql += ` ORDER BY task.${field} ${seq === "ascend" ? "ASC" : "DESC"}`;
                }
            }
            if (page) {
                const { size, num } = page;
                if (num) {
                    sql += ` LIMIT ${size} OFFSET ${(num - 1) * size}`;
                }
            }
            const params = [`%${name}%`, `%${name}%`, `%${name}%`, `%${name}%`, `${name}%`];
            if (group_id) {
                params.push(group_id);
            }
            if (vehicle) {
                params.push(vehicle);
            }
            if (project_id) {
                params.push(project_id);
            }
            return {
                sql,
                params
            };
        };
        const fields = "COUNT(task.id) AS total";
        const { sql, params } = getSqlAndParams(fields);
        const queryTotal = await sqlUtil.execute(sql, params);
        const total = queryTotal[0].total;
        if (!total) {
            fullFilled(response, [], { current: num, pageSize: size, total });
        } else {
            // 查询分页的数据
            const fields = `task.id, sub_g.name AS project,sub_g.creator, task.vehicle, task.package, task.state, task_state.name AS state_name,
            date_format(date_add(task.create_time, INTERVAL 8 Hour), '%Y-%m-%d %H:%i:%S') AS create_time`;
            const { sql, params } = getSqlAndParams(fields, { field: orderField, seq: orderSeq }, { size, num });
            const query = sqlUtil.execute(sql, params);
            query.then(
                (value) => fullFilled(response, value, { current: num, pageSize: size, total }),
                (error) => errorHandler(response, error)
            );
        }
    } catch (error) {
        (error) => errorHandler(response, error);
    }
});

// 取消，停止，重启升级任务
router.post("/task/operate", (request, response) => {
    try {
        const opt = req.body.opt; // CANCEL, STOP, RESTART
        const groupIds = req.body.group_ids || null;
        const taskIds = req.body.task_ids || null;

        if (opt === "CANCEL") {
            state = 2;
          } else if (opt === "STOP" || opt === "RESTART") {
            state = 4;
          } else {
            state = 2;
          }
          console.info(groupIds, taskIds);
          response.json({
            code: 0,
            data: "",
            pagination,
            msg: "成功"
        });
        
    } catch (error) {
        (error) => errorHandler(response, error);
    }
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

module.exports = router;
