const express = require("express");
const sqlUtil = require("./tools/sqlUtil");
const artifacts = require("./tools/artifacts");
const {upgrade, sendMsgToAll} = require("./business")

const router = express.Router();

const getWsServer = (request) => request.app.get("wsServer");

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
    console.info(6, err);
    response &&
        response.status(500).json({
            code: 1,
            msg: err.toString()
        });
};

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
        errorHandler(response, error);
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
        const { projectName, packageName } = request.query;
        if (!projectName || !packageName) {
            response.status(500).json({
                code: 1,
                msg: "参数错误"
            });
        }
        artifacts.findJsonByName(projectName, packageName).then(
            (value) => fullFilled(response, value),
            (error) => errorHandler(response, error)
        );
    } catch (error) {
        errorHandler(response, error);
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
        errorHandler(response, error);
    }
});

// 查询任务组
router.get("/group/list", async (request, response) => {
    try {
        const { pageNo = 1, pageSize = 10, name = "", order:orderField = "id", seq:orderSeq = "descend" } = request.query;
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
        const total = queryTotal[0]?.total;
        if (!total) {
            fullFilled(response, [], { current: num, pageSize: size, total });
        } else {
            // 查询分页的数据
            const sql = `
                SELECT task_group.id, project.name as project, task_group.creator, 
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
        errorHandler(response, error);
    }
});

// 查询升级任务
router.get("/task/list", async (request, response) => {
    try {
        const {
            pageNo = 1,
            pageSize = 10,
            group = "",
            vehicle = "",
            project = "",
            name = "",
            order:orderField = "id",
            seq:orderSeq = "descend"
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
                ${group ? "AND task.group = ?" : ""}
                ${vehicle ? "AND task.vehicle = ?" : ""}
                ${project ? "AND sub_g.project = ?" : ""}
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
            if (group) {
                params.push(group);
            }
            if (vehicle) {
                params.push(vehicle);
            }
            if (project) {
                params.push(project);
            }
            return {
                sql,
                params
            };
        };
        const fields = "COUNT(task.id) AS total";
        const { sql, params } = getSqlAndParams(fields);
        const queryTotal = await sqlUtil.execute(sql, params);
        const total = queryTotal[0]?.total;
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
        errorHandler(response, error);
    }
});

// 测试事务原子性
router.get("/task/delete", (request, response) => {
    try {
        const sql = `DELETE FROM deploy_upgrade_task WHERE id = ?`;
        const query = sqlUtil.execute(sql, [2]);
        query.then(
            (value) => fullFilled(response, value),
            (error) => errorHandler(response, error)
        );
    } catch (error) {
        errorHandler(response, error);
    }
});

// 测试下载、解压
router.get("/downloadPackage", (request, response) => {
    try {
        const projectArtifacts = "/GSL4_X86/cicd/";
        const packageName = "GSL4_X86-20230609-210913-v0.1.7.tar.gz";
        artifacts.downloadPackage(projectArtifacts, packageName).then(
            (value) => fullFilled(response, value),
            (error) => errorHandler(response, error)
        );
    } catch (error) {
        errorHandler(response, error);
    }
});

// 测试解压
router.get("/extract", (request, response) => {
    try {
        const file = "HWL4_ORIN-20230627-092902-v0.1.33.tar.gz";
        artifacts.extractFile(file).then(
            (value) => fullFilled(response, value),
            (error) => errorHandler(response, error)
        );
    } catch (error) {
        errorHandler(response, error);
    }
});

router.post("/task/upgrade", (request, response) => {
    try {
        upgrade(request.body, getWsServer(request)).then(
            (value) => fullFilled(response, value),
            (error) => errorHandler(response, error)
        );
    } catch(error) {
        errorHandler(response, error);
    }
});

// 升级
router.post("/task/upgrade2", async (request, response) => {
    try {
        const { project, project_artifacts, creator, vehicles, package_on_artifacts, package_on_vehicle, cur_package } =
            request.body;

        if ((package_on_artifacts.length === 0 && package_on_vehicle.length === 0) || vehicles.length === 0) {
            response.status(500).json({
                code: 1,
                msg: "参数错误"
            });
        }
        // 创建任务组
        const result = await sqlUtil.execute(
            "INSERT INTO deploy_task_group (project, creator, vehicles, packages, cur_package) VALUES (?, ?, ?, ?, ?)",
            [project, creator, vehicles, [package_on_artifacts, package_on_vehicle].join(","), cur_package]
        );
        const groupId = result.insertId;
        console.info("创建升级任务组:", result.insertId);
        // 创建升级任务
        const vehicleArr = vehicles.split(",");
        const packageOnArtifactsArr = package_on_artifacts.split(",");
        const packageOnVehicleArr = package_on_vehicle.split(",");
        console.info("开始创建升级任务：");
        const allPromises = [];
        vehicleArr.forEach((vehicle) => {
            const promises1 = packageOnArtifactsArr.map(async (packageName) => {
                console.info("packageOnArtifactsArr package：", packageName);
                const isCur = cur_package === packageName ? 1 : 0;
                // 创建升级任务
                const result = await sqlUtil.execute(
                    "INSERT INTO deploy_upgrade_task (`group`, vehicle, package, package_type, set_current) VALUES (?, ?, ?, ?, ?)",
                    [groupId, vehicle, packageName, 0, isCur]
                );
                const taskId = result.insertId;
                console.info(3);
                // 下载文件 解压文件
                sqlUtil.executeTransaction(async (connection) => {
                    let params = [packageName];
                    // 1.查询是否已经下载过该包
                    let sql = `SELECT state, file_dir FROM deploy_download_task WHERE package = ? AND state != 2 ORDER BY id DESC LIMIT 1`;
                    const [rows] = await connection.execute(sql, params);
                    console.info("查询下载任务：", rows);
                    if (rows.length) {
                        if (rows[0].state == 1) {
                            console.info("已经下载好了，立马可用...");
                            sendMsgToAll(
                                getWsServer(request),
                                JSON.stringify({
                                    type: "Task",
                                    message: {
                                        taskId: taskId,
                                        carName: vehicle,
                                        package: packageName,
                                        package_type: 0,
                                        storagePath: rows[0].file_dir,
                                        set_current: isCur,
                                        action: "START"
                                    }
                                })
                            );
                        } else {
                            // 已经有相同任务了，稍等即可
                            console.info("已经有相同任务了，稍等即可...");
                        }
                    } else {
                        console.info("创建下载任务，并开始下载", packageName);
                        // 创建下载任务
                        sql = `INSERT INTO deploy_download_task (package) VALUES (?)`;
                        params = [packageName];
                        await connection.execute(sql, params);

                        artifacts.downloadPackage(project_artifacts, packageName).then(
                            async (path) => {
                                console.info("下载成功后的处理", packageName);

                                // 放入事务里面
                                sqlUtil.executeTransaction(async (connection) => {
                                    // 修改下载任务的状态及文件存放地址
                                    console.info("更新下载状态", packageName);
                                    let params = [1, path, packageName];
                                    let sql = `UPDATE deploy_download_task SET state = ?, file_dir = ? WHERE package = ?`;
                                    await connection.execute(sql, params);
                                    // 修改升级任务的状态,先查出来需要更新的任务id
                                    sql = `SELECT id FROM deploy_upgrade_task WHERE package = ? AND state = 0 AND package_type = 0`;
                                    params = [packageName];
                                    const [rows] = await connection.execute(sql, params);
                                    console.info("更新任务状态", packageName);
                                    sql = `UPDATE deploy_upgrade_task set state = ?, file_dir = ? WHERE package = ? AND state = 0 AND package_type = 0`;
                                    params = [1, path, packageName];
                                    await connection.execute(sql, params);
                                    console.info("通知车端：升级远程版本", packageName);
                                    rows.forEach((id) => {
                                        sendMsgToAll(
                                            getWsServer(request),
                                            JSON.stringify({
                                                type: "Task",
                                                message: {
                                                    taskId: id,
                                                    carName: vehicle,
                                                    package: packageName,
                                                    package_type: 0,
                                                    storagePath: path,
                                                    set_current: isCur,
                                                    action: "START"
                                                }
                                            })
                                        );
                                    });
                                });
                            },
                            (error) => {
                                console.info("下载失败后的处理", packageName);
                                // 修改下载任务的状态
                                let params = [2, packageName];
                                let sql = `UPDATE deploy_download_task SET state = ? WHERE package = ?`;
                                connection.execute(sql, params);
                                // 修改升级任务的状态
                                sql = `UPDATE deploy_upgrade_task set state = ? WHERE package = ? AND state = 0 AND package_type = 0`;
                                params = [5, packageName];
                                connection.execute(sql, params);
                            }
                        );
                    }
                });
            });
            // 升级车端版本时不需要下载
            const promises2 = packageOnVehicleArr.map(async (packageName) => {
                console.info("packageOnVehicleArr package：", packageName);
                const isCur = cur_package === packageName ? 1 : 0;
                // 创建升级任务
                const result = await sqlUtil.execute(
                    "INSERT INTO deploy_upgrade_task (`group`, vehicle, package, package_type, set_current, state) VALUES (?, ?, ?, ?, ?, 1)",
                    [groupId, vehicle, packageName, 1, isCur]
                );
                console.info("通知车端：升级车端版本", packageName);
                const taskId = result.insertId;
                sendMsgToAll(
                    getWsServer(request),
                    JSON.stringify({
                        type: "Task",
                        message: {
                            taskId: taskId,
                            carName: vehicle,
                            package: packageName,
                            package_type: 1,
                            set_current: isCur,
                            action: "START"
                        }
                    })
                );
            });
            allPromises.push(...promises1, ...promises2);
            console.info(5);
        });
        console.info(allPromises);
        Promise.all(allPromises)
            .then(() => {
                console.info("******* Done all! ******");
                response.json({
                    code: 0,
                    data: result,
                    msg: "成功"
                });
            })
            .catch((error) => {
                errorHandler(response, error);
            });
    } catch (error) {
        errorHandler(response, error);
    }
});

// 取消，停止，重启升级任务
router.post("/task/operate", (request, response) => {
    try {
        const opt = request.body.opt; // CANCEL, STOP, RESTART
        const groupIds = request.body.group_ids || null;
        const taskIds = request.body.task_ids || null;
        if (!groupIds && !taskIds) {
            response.status(500).json({
                code: 1,
                msg: "参数错误"
            });
        }

        if (opt === "CANCEL") {
            state = 6;
        } else if (opt === "STOP" || opt === "RESTART") {
            state = 4;
        } else {
            state = 2;
        }

        sqlUtil.executeTransaction(async (connection) => {
            const ids = groupIds ? groupIds.split(",") : taskIds.split(",").map((item) => parseInt(item));
            let params = [state, ...ids];
            let sql = `UPDATE deploy_upgrade_task SET state = ? WHERE deploy_upgrade_task.${
                groupIds ? "group" : "id"
            } IN (${ids.map(() => "?").join(",")})`; // 注意需要生成和id个数匹配的多个占位符
            await connection.execute(sql, params);
            sql = `SELECT id FROM deploy_upgrade_task WHERE deploy_upgrade_task.${groupIds ? "group" : "id"} IN (${ids
                .map(() => "?")
                .join(",")})`; // 注意需要生成和id个数匹配的多个占位符
            params = [...ids];
            const [rows] = await connection.execute(sql, params);
            sendMsgToAll(
                getWsServer(request),
                JSON.stringify({
                    type: "Task",
                    message: {
                        taskId: rows.map((i) => i.id).toString(),
                        action: opt
                    }
                })
            );
            response.json({
                code: 0,
                data: rows,
                msg: "成功"
            });
        });
    } catch (error) {
        errorHandler(response, error);
    }
});

module.exports = router;
