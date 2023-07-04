const targz = require('targz');
const { exec } = require('child_process');

const src = "/home/wangshiyuan/code/00deploy/download/HWL4_ORIN-20230627-092902-v0.1.33.tar.gz";
const dest = "/home/wangshiyuan/code/00deploy/download/result";

// targz.decompress({
//     src,
//     dest
// }, function(err){
//     if(err) {
//         console.log(err);
//     } else {
//         console.log("Done!");
//     }
// });


console.info("开始解压");

exec(`tar -xzf ${src} -C ${dest}`, (error, stdout, stderr) => {
  if (error) {
    console.error("解压过程中发生错误:", error);
  } else {
    console.log("解压完成。");
    console.info("程序结束");
  }
});