const mysql = require("mysql2/promise");
const config = require("../../config");

// 创建数据库连接池
const pool = mysql.createPool(config.database);

// 封装执行查询的方法
async function execute(sql, params) {
    try {
        // 执行查询操作
        const [result] = await pool.execute(sql, params);
        return result;
    } catch (error) {
        console.error("执行查询时发生错误:", sql, params, error);
        throw error;
    }
}

// 事务执行函数
async function executeTransaction(callback) {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        await callback(connection);

        await connection.commit();
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

module.exports = {
    executeTransaction,
    execute
};
