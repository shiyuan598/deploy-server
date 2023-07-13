# 远程部署后端

### 启动
```
node app.js
```
注：node v14.20.0


### 构建
```
ncc build app.js -m -o dist
```
需要@vercel/ncc 包
```
npm install -g @vercel/ncc
```

### 文档

mysql2:
https://www.npmjs.com/package/mysql2
https://github.com/mysqljs/mysql

artifactory rest api
https://artifactory.zhito.com/artifactory/api/repositories 查项目
https://artifactory.zhito.com/artifactory/api/storage 查目录文件
参数：
?list用于请求获取目录内容的列表
?deep=<number></number>指定递归的深度，用于获取目录及其子目录中的内容，默认0
?includeRoot=<boolean>：指定是否包含根目录，默认为 false
?listFolders=<boolean>：指定是否只返回文件夹。默认为 false