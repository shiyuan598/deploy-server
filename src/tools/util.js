const fs = require("fs").promises;
const { exec } = require("child_process");

// 拼接两个路径，正确处理路径间的斜线
const joinPath = (pre, sub) => {
    return `${pre.replace(/\/$/, "")}/${sub.replace(/^\//, "")}`;
};

// 拼接多个路径，正确处理路径间的斜线
const joinPaths = (...paths) => {
    const pathStr = paths.map((item) => item.replace(/^\/|\/$/g, "")).join("/");
    if (paths[0].startsWith("/")) {
        return "/" + pathStr;
    }
    return pathStr;
};

const deleteFileOrDirectory = async (path) => {
    try {
        // Check if the file or directory exists
        try {
            await fs.stat(path);
        } catch (err) {
            console.error("路径不存在！");
            return;
        }

        if ((await fs.lstat(path)).isDirectory()) {
            // If it's a directory, recursively delete its contents
            const files = await fs.readdir(path);
            for (const file of files) {
                const curPath = path + "/" + file;
                await deleteFileOrDirectory(curPath);
            }
            await fs.rmdir(path);
            console.log("目录删除成功：", path);
        } else {
            // If it's a file, directly delete it
            await fs.unlink(path);
            console.log("文件删除成功：", path);
        }
    } catch (err) {
        console.error("删除时出错：", err);
    }
};

const deleteFileAsync = (filePath) => {
    return new Promise((resolve, reject) => {
        exec(`rm -rf ${filePath}`, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(`执行命令时出错：${error.message}`));
            } else if (stderr) {
                reject(new Error(`命令输出错误：${stderr}`));
            } else {
                resolve("文件删除成功！");
            }
        });
    });
};

module.exports = {
    joinPath,
    joinPaths,
    deleteFileOrDirectory,
    deleteFileAsync
};
