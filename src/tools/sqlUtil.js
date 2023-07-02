const mysql = require("mysql2/promise");
const config = require("../config");

// 创建数据库连接池
const pool = mysql.createPool(config.database);

// 封装执行查询的方法
async function execute(sql, params) {
    try {
        // 执行查询操作
        const [result] = await pool.execute(sql, params);
        return result;
    } catch (error) {
        console.error("执行查询时发生错误:", error);
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
    executeTransaction,
    execute,
    executeQuery,
    select,
    update,
    remove
};
