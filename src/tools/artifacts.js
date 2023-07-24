const axios = require("axios");
const fs = require("fs");
const targz = require("targz");
const config = require("../../config");
const util = require("../tools/util");

const { USERNAME, PASSWORD, API_KEY, BASE_URL, BUILD_JSON, DOWNLOAD_DIR, EXTRACT_DIR } = config.artifacts;

// 查询一个目录下的所有文件
const getAllFiles = (path) => {
    const url = util.joinPaths(BASE_URL, "/api/storage", path);
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
    const url = util.joinPaths(BASE_URL, BUILD_JSON, project, jsonName);
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
                resolve(data);
            })
            .catch((error) => {
                console.error("获取JSON失败:", error);
                reject("获取JSON失败");
            });
    });
};

// 下载包
const downloadPackage = (projectArtifacts, packageName) => {
    console.info("开始下载:", packageName);
    const url = util.joinPaths(BASE_URL, projectArtifacts, packageName);
    return new Promise((resolve, reject) => {
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
                
                console.info("下载完成！");
                const writeRes = await writeFile(data, fileDir);
                if (writeRes === "ok") {
                    const extractRes = await extractFile(fileDir, extractDir);
                    if (extractRes === "ok") {
                        console.info("下载并解压完成:", packageName);
                        resolve(extractDir);
                    } else {
                        console.error("解压文件失败:", error);
                        reject("解压文件失败");
                    }
                } else {
                    console.error("写入文件失败:", error);
                    reject("写入文件失败");
                }
            })
            .catch((error) => {
                console.error("下载文件失败:", error);
                reject("下载文件失败");
            });
    });
};

// 写文件
const writeFile = (data, path) => {
    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(path);
  
      writeStream.on('error', (error) => {
        console.info('writeFile error:', error);
        reject(error);
      });
  
      writeStream.on('finish', () => {
        console.log('文件写入成功！');
        resolve('ok');
      });
  
      // 将数据逐块写入文件
      const chunkSize = 1024 * 16; // 设置每次写入的块大小（字节）
      let offset = 0;
  
      const writeNextChunk = () => {
        if (offset >= data.length) {
          writeStream.end(); // 写入完成后结束写入流
          return;
        }
  
        const chunk = data.slice(offset, offset + chunkSize);
        offset += chunkSize;
  
        writeStream.write(chunk, 'utf8', writeNextChunk);
      };
  
      writeNextChunk();
    });
  };

// 解压包
const extractFile = (filePath, extractDir) => {
    return new Promise((resolve, reject) => {
        try {
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
                        reject(err);
                    } else {
                        resolve("ok");
                    }
                }
            );
        } catch (error) {
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
