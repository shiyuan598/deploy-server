const cron = require("node-cron");
const dayjs = require("dayjs");
const {removeExpiredDownloads} = require("./business")
// 定时任务
const runScheduleTask = () => {
    // 定期清理下载的文件,每周六晚24时执行
    // 秒 分 时 日 月 星期
    cron.schedule("0 1 * * 6", () => {
        console.log("定时任务：每周六早1点时执行", dayjs().format("YYYY-MM-DD HH:mm:ss"));
        // 清理一天前的记录
        const date = dayjs().subtract(1, "day").format("YYYY-MM-DD HH:mm:ss");
        removeExpiredDownloads(date);
    });
    cron.schedule("* * * * * ", () => {
        console.log("定时任务：每半分钟执行一次", dayjs().format("YYYY-MM-DD HH:mm:ss"));
    });
};

module.exports = {
    runScheduleTask
};
