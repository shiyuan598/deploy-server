const sqlUtil = require("./tools/sqlUtil");
const artifacts = require("./tools/artifacts");

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

const getPackageList = (vehicle, pageNo, pageSize=10) => {
    try {
        return new Promise(async (resolve, reject) => {
            let params = [`%${vehicle}%`];
            // 1.查询是否已经下载过该包
            let sql = `SELECT name, artifacts_url FROM deploy_project WHERE vehicles like ? LIMIT 1`;
            const [result] = await sqlUtil.execute(sql, params);
            if (result) {
                const packages = await artifacts.getAllFiles("/" +  result.artifacts_url)
                resolve({
                    data: packages.slice((pageNo - 1) * pageSize, pageNo * pageSize),
                    pagination: { current: pageNo, pageSize, total: packages.length }
                })
            } else {
                reject("车辆编号不存在");
            }
        });
    } catch (error) {
        return Promise.reject(error);
    }
};

module.exports = {
    updateVehicleInfo,
    getPackageList
};
