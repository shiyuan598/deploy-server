const axios = require("axios");
const fs = require("fs");
const tar = require("tar");
const zlib = require("zlib");
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

// 下载包
const downloadPackage = (projectArtifacts, packageName) => {
    const url = util.joinPaths(BASE_URL, projectArtifacts, packageName);
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
                const fileDir = `${DOWNLOAD_DIR}${packageName}`;
                const extractDir = `${EXTRACT_DIR}${packageName.replace(".tar.gz", "")}`;
                // if (!fs.existsSync(extractDir)) {
                //     fs.mkdirSync(extractDir, { recursive: true });
                // }
                console.info("准备写入文件", packageName);
                // await fs.writeFile(fileDir, Buffer.from(response.data, "binary"), (data) => {
                //     console.info("完成", packageName, data);
                // });

                // await tar.x({
                //     file: fileDir,
                //     cwd: extractDir
                // });
                const filePath = DOWNLOAD_DIR + "HWL4_X86-20230703-100541-v1.0.53.tar.gz";
                const extractPath = EXTRACT_DIR + "HWL4_X86-20230703-100541-v1.0.53";
                if (!fs.existsSync(extractPath)) {
                    fs.mkdirSync(extractPath, { recursive: true });
                }
                console.info("开始解压");
                fs.createReadStream(filePath)
                    .pipe(
                        tar.extract({
                            cwd: extractPath
                        })
                    )
                    .on("finish", () => {
                        console.log("解压完成！");
                    });
                resolve(data);
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
            fs.writeFile(path, data, resolve).catch((error) => {
                console.info("解压失败", error);
                reject(error);
            });
        });
    } catch (error) {
        throw error;
    }
};

// 解压包
const extractFile = (file) => {
    return new Promise((resolve, reject) => {
        try {
            const filePath = DOWNLOAD_DIR + file;
            const extractPath = EXTRACT_DIR + file;
            if (!fs.existsSync(extractPath)) {
                fs.mkdirSync(extractPath, { recursive: true });
            }
            console.info("开始解压");
            fs.createReadStream(filePath)
                .pipe(
                    tar.extract({
                        cwd: extractPath
                    })
                )
                .on("finish", () => {
                    console.log("解压完成！");
                    resolve("ok");
                })
                .on("error", reject);
        } catch (error) {
            console.info("解压失败！");
            reject(error);
        }
    });
};

module.exports = {
    getAllFiles,
    findJsonByName,
    downloadPackage,
    extractFile
};
