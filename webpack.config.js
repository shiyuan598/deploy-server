const path = require("path");

module.exports = {
    mode: "development",
    entry: "./app.js", // 入口文件路径
    output: {
        path: path.resolve(__dirname, "dist"), // 输出路径
        filename: "bundle.js" // 输出文件名
    },
    target: "node", // 设置目标为 Node.js 环境
    module: {
        rules: [
            {
                test: /\.js$/, // 匹配 JavaScript 文件
                exclude: /node_modules|demo/, // 排除 node_modules 目录
                use: {
                    loader: "babel-loader", // 使用 Babel 加载器处理 JavaScript 文件
                    options: {
                        presets: ["@babel/preset-env"] // 使用预设 @babel/preset-env 进行转译
                    }
                }
            }
        ]
    },
};
