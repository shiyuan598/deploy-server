const axios = require("axios");
const config = require("../config");
const util = require("../tools/util");
const { json } = require("express");

const { USERNAME, PASSWORD, API_KEY, BASE_URL, BUILD_JSON, DOWNLOAD_DIR, EXTRACT_DIR } = config.artifacts;

// 查询一个目录下的所有文件
const getAllFiles = (path) => {
    const url = BASE_URL + "/api/storage" + path;
    return new Promise((resolve, reject) => {
        axios
            .get(url, {
                timeout: 1000 * 10,
                auth: {
                    username: USERNAME,
                    password: PASSWORD
                }
            })
            .then((response) => {
                const files = response.data.children
                    .map((child) => {
                        if (child.uri.startsWith("/")) {
                            return child.uri.slice(1);
                        }
                        return child.uri;
                    })
                    .sort((a, b) => (b > a ? 1 : -1));
                resolve(files);
            })
            .catch((error) => {
                console.error("获取文件列表失败:", error);
                reject("获取文件列表失败");
            });
    });
};

// 下载包对应的json描述文件
const findJsonByName = (project, name) => {
    const jsonName = name.replace(project, "build_list").replace(".tar.gz", ".json");
    console.info(jsonName);
    const url = util.joinPaths(BASE_URL, BUILD_JSON, project, jsonName);
    console.info(url);
    return new Promise((resolve, reject) => {
        axios
            .get(url, {
                timeout: 1000 * 10,
                auth: {
                    username: USERNAME,
                    password: PASSWORD
                }
            })
            .then((response) => {
                data = response.data;
                console.info(data);
                resolve(data);
            })
            .catch((error) => {
                console.error("获取文件失败:", error);
                reject("获取文件失败");
            });
    });
};

module.exports = {
    getAllFiles,
    findJsonByName
};
