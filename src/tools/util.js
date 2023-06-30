// 拼接两个路径，正确处理路径间的斜线
const joinPath = (pre, sub) => {
    return `${pre.replace(/\/$/, "")}/${sub.replace(/^\//, "")}`;
};

// 拼接多个路径，正确处理路径间的斜线
const joinPaths = (...paths) => {
    const pathStr = paths.map((item) => item.replace(/^\/|$\//g, "")).join("/");
    if (paths[0].startsWith("/")) {
        return "/" + pathStr;
    }
    return pathStr;
};

module.exports = {
    joinPath,
    joinPaths
}