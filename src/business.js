const WebSocket = require("ws");
const sqlUtil = require("./tools/sqlUtil");
const artifacts = require("./tools/artifacts");

// 向所有客户端发送消息
const sendMsgToAll = (wsServer, msg) => {
    // 发送消息给所有连接的WebSocket客户端
    wsServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
};

const updateVehicleInfo = async (info) => {
    try {
        console.info("更新车辆信息");
        // 更新车辆信息
        const { carName: vehicle, version, timestamp, lonlat, currentPackage, localPackageList, taskInfo } = info;
        let params = [version, timestamp, lonlat[0], lonlat[1], currentPackage, localPackageList.join(","), vehicle];
        let sql = `UPDATE deploy_vehicle_info
            SET version = ?, timestamp = ?, lon = ?, lat = ?, cur_package = ?, local_packages = ?
            WHERE deploy_vehicle_info.vehicle = ?`;
        const result = await sqlUtil.execute(sql, params);
        if (!result.affectedRows) {
            // 不存在就新建记录
            sql = `INSERT INTO deploy_vehicle_info (version, timestamp, lon, lat, cur_package, local_packages, vehicle) values(?, ?, ?, ?, ?, ?, ?)`;
            sqlUtil.execute(sql, params);
        }
        // 更新升级任务状态
        if (taskInfo) {
            const { taskId, status, desc } = taskInfo;
            let state;
            //  TODO:需要确定具体的状态值
            switch (status) {
                case "RUNNING":
                    state = 2;
                    break;
                case "STOP":
                    state = 4;
                    break;
                case "FINISH":
                    state = 5;
                    break;
                default:
                    state = 2;
                    break;
            }
            params = [state, desc, taskId];
            console.info(params);
            sql = `UPDATE deploy_upgrade_task SET state = ?, \`desc\` = ? WHERE deploy_upgrade_task.id = ?`;
            const result = await sqlUtil.execute(sql, params);
            console.info(result);
        }
    } catch (error) {
        console.info("updateVehicleInfo错误：", error);
    }
};

const getPackageList = (vehicle, pageNo, pageSize = 10) => {
    try {
        return new Promise(async (resolve, reject) => {
            let params = [`%${vehicle}%`];
            // 1.查询是否已经下载过该包
            let sql = `SELECT name, artifacts_url FROM deploy_project WHERE vehicles like ? LIMIT 1`;
            const [result] = await sqlUtil.execute(sql, params);
            if (result) {
                const packages = await artifacts.getAllFiles("/" + result.artifacts_url);
                resolve({
                    data: packages.slice((pageNo - 1) * pageSize, pageNo * pageSize),
                    pagination: { current: pageNo, pageSize, total: packages.length }
                });
            } else {
                reject("车辆编号不存在");
            }
        });
    } catch (error) {
        return Promise.reject(error);
    }
};

const getProjectInfo = async (vehicle) => {
    try {
        const sql = `SELECT id, name, artifacts_url FROM deploy_project where vehicles like ?`;
        const [result] = await sqlUtil.execute(sql, [`%${vehicle}%`]);
        return result;
    } catch (error) {
        throw error;
    }
};

// 升级
const upgrade = async (params, wsServer) => {
    try {
        return new Promise(async (resolve, reject) => {
            const {
                project,
                project_artifacts,
                creator,
                vehicles,
                package_on_artifacts,
                package_on_vehicle,
                cur_package
            } = params;

            if ((package_on_artifacts?.length === 0 && package_on_vehicle?.length === 0) || vehicles.length === 0) {
                reject({
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
        const packageOnArtifactsArr = package_on_artifacts?.split(",");
        const packageOnVehicleArr = package_on_vehicle?.split(",");
        console.info(packageOnArtifactsArr, packageOnArtifactsArr.length);
        const allPromises = [];
        vehicleArr.forEach((vehicle) => {
            const promises1 = !packageOnArtifactsArr ? [] : packageOnArtifactsArr.map(async (packageName) => {
                const isCur = cur_package === packageName ? 1 : 0;
                // 创建升级任务
                const result = await sqlUtil.execute(
                    "INSERT INTO deploy_upgrade_task (`group`, vehicle, package, package_type, set_current) VALUES (?, ?, ?, ?, ?)",
                    [groupId, vehicle, packageName, 0, isCur]
                );
                const taskId = result.insertId;
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
                                wsServer,
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
                                            wsServer,
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
            const promises2 = !packageOnVehicleArr ? [] : packageOnVehicleArr.map(async (packageName) => {
                const isCur = cur_package === packageName ? 1 : 0;
                // 创建升级任务
                const result = await sqlUtil.execute(
                    "INSERT INTO deploy_upgrade_task (`group`, vehicle, package, package_type, set_current, state) VALUES (?, ?, ?, ?, ?, 1)",
                    [groupId, vehicle, packageName, 1, isCur]
                );
                console.info("通知车端：升级车端版本", packageName);
                const taskId = result.insertId;
                sendMsgToAll(
                    wsServer,
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
        });
        Promise.all(allPromises)
            .then(() => {
                console.info("******* Done all! ******");
                resolve({
                    code: 0,
                    data: result,
                    msg: "成功"
                })
            })
            .catch((error) => {
                reject(error);
            });
        });
    } catch (error) {
        return Promise.reject(error);
    }
};

// 清理过期的下载记录及文件
const removeExpiredDownloads = async (date) => {
    // 放入事务里面
    sqlUtil.executeTransaction(async (connection) => {
        let sql = `SELECT package, file_dir FROM deploy_download_task WHERE update_time < ?`;
        
        let params = [date];
        const [rows] = await connection.execute(sql, params);
        console.info(rows);
        rows.forEach(item => {

        })
    });
}

module.exports = {
    updateVehicleInfo,
    getPackageList,
    getProjectInfo,
    upgrade,
    sendMsgToAll,
    removeExpiredDownloads
};
