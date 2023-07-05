const targz = require("targz");
const { exec } = require("child_process");

const src = "/home/wangshiyuan/code/00deploy/download/HWL4_ORIN-20230627-092902-v0.1.33.tar.gz";
const dest = "/home/wangshiyuan/code/00deploy/download/result";

console.info("开始解压");

exec(`tar -xzf ${src} -C ${dest}`, (error, stdout, stderr) => {
    if (error) {
        console.error("解压过程中发生错误:", error);
    } else {
        console.log("解压完成。");
        console.info("程序结束");
    }
});
const url = "http://localhost:3001/deploy/projects";
const arr1 = [1, 2, 3];
const arr2 = ["a", "b", "c"];
const arr3 = ["x", "y", "z"];
arr1.forEach((i) => {
    arr2.forEach((v) => {
        fetch(`${url}?n=${v}c=${i}`).then(console.info);
    });
    arr3.forEach((v) => {
      fetch(`${url}?m=${v}c=${i}`).then(console.info);
  });
});
