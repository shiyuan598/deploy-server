const mysql = require("mysql2");
const config = require("../config");

// 创建数据库连接池
const pool = mysql.createPool(config.database);

// 封装执行查询的方法
function executeQuery(sql, params, callback) {
    // 执行查询操作
    pool.execute(sql, params, (err, results) => {
        // connection.release(); // 释放连接

        if (err) {
            console.error("执行查询时发生错误:", err);
            callback(err, null);
        } else {
            callback(null, results);
        }
    });
}

// SELECT 查询
function select(table, columns, condition, params, callback) {
    const sql = `SELECT ${columns} FROM ${table} WHERE ${condition}`;
    executeQuery(sql, params, callback);
}

// UPDATE 操作
function update(table, values, condition, callback) {
    const sql = `UPDATE ${table} SET ? WHERE ${condition}`;
    executeQuery(sql, values, callback);
}

// DELETE 操作
function remove(table, condition, callback) {
    const sql = `DELETE FROM ${table} WHERE ${condition}`;
    executeQuery(sql, [], callback);
}

module.exports = {
    executeQuery,
    select,
    update,
    remove
};
