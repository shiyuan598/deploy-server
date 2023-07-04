const axios = require("axios");
const fs = require("fs");
const targz = require("targz");
const config = require("../config");
const util = require("../tools/util");
const { error } = require("console");

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

// 下载包
const downloadPackage = (projectArtifacts, packageName) => {
    const url = util.joinPaths(BASE_URL, projectArtifacts, packageName);
    console.info("url:", url);
    return new Promise((resolve, reject) => {
        console.info("开始下载了", packageName);
        axios
            .get(url, {
                timeout: 6000 * 5,
                auth: {
                    username: USERNAME,
                    password: PASSWORD
                },
                responseType: "arraybuffer"
            })
            .then(async (response) => {
                data = response.data;
                // 保存文件
                console.info("下载完成， 准备保存包");
                const fileDir = `${DOWNLOAD_DIR}${packageName}`;
                const extractDir = `${EXTRACT_DIR}${packageName.replace(".tar.gz", "")}`;
                writeFile(data, fileDir)
                    .then((v) => {
                        console.info("写入文件完成, 准备解压");
                        extractFile(fileDir, extractDir)
                            .then((v) => {
                                console.info("解压文件完成", v);
                                resolve("ok");
                            })
                            .catch((error) => {
                                console.error("解压文件失败:", error);
                                reject("解压文件失败");
                            });
                    })
                    .catch((error) => {
                        console.error("写入文件失败:", error);
                        reject("写入文件失败");
                    });
            })
            .catch((error) => {
                console.error("下载文件失败:", error);
                reject("下载文件失败");
            });
    });
};

// 写文件
const writeFile = (data, path) => {
    try {
        return new Promise((resolve, reject) => {
            fs.writeFile(path, data, (error) => {
                if (error) {
                    console.info("写入文件失败！");
                    reject(error);
                }
                console.info("写入文件成功！");
                resolve("写入成功！");
            });
        });
    } catch (error) {
        throw error;
    }
};

// 解压包
const extractFile = (filePath, extractDir) => {
    return new Promise((resolve, reject) => {
        try {
            console.info("开始解压");
            if (!fs.existsSync(extractDir)) {
                fs.mkdirSync(extractDir, { recursive: true });
            }
            targz.decompress(
                {
                    src: filePath,
                    dest: extractDir
                },
                function (err) {
                    if (err) {
                        console.log(err);
                        reject(err);
                    } else {
                        console.log("Done!");
                        resolve("ok");
                    }
                }
            );
        } catch (error) {
            console.info("解压失败！");
            throw error;
        }
    });
};

module.exports = {
    getAllFiles,
    findJsonByName,
    downloadPackage,
    extractFile
};
