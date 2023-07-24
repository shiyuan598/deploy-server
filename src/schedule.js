const cron = require("node-cron");
const dayjs = require("dayjs");
const {removeExpiredDownloads} = require("./business")
// 定时任务
const runScheduleTask = () => {
    // 定期清理下载的文件,每周六晚24时执行
    // 秒 分 时 日 月 星期
    cron.schedule("0 0 * * * 6", () => {
        console.log("定时任务：每周六晚24时执行");
    });
    cron.schedule("* * * * * ", () => {
        console.log("定时任务：每半分钟执行一次", dayjs().format("YYYY-MM-DD HH:mm:ss"));
        // TODO: 按实际情况修改日期
        const date = dayjs().subtract(3, "day").format("YYYY-MM-DD HH:mm:ss");
        removeExpiredDownloads(date);
    });
};

module.exports = {
    runScheduleTask
};
