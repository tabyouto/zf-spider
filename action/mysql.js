'use strict';

const configInfo = {
    host: '192.168.79.132',
    user: 'root',
    password: 'root',
    database: 'school_slg',
    port: '3306'
}


var mysql = require('mysql');
var pool = mysql.createPool(configInfo);

var sqlAction = {
    query: function (sql, x, callback) {
        pool.getConnection(function (err, conn) {
            if (err) {
                callback(err, null, null);
            } else {
                conn.query(sql, x, function (qerr, vals, fields) {
                    //释放连接
                    conn.release();
                    //事件驱动回调
                    var _res = JSON.parse(JSON.stringify(vals));
                    callback(qerr, _res, fields);
                });
            }
        })
    },
    insert: function (sql, x, callback) {
        console.log('sql-语句:',sql);
        pool.getConnection(function (err, conn) {
            if (err) {
                callback(err, null, null);
            } else {
                conn.query(sql, x, function (qerr, vals, fields) {
                    conn.release();
                    console.log(vals);
                    var _res = vals ? JSON.parse(JSON.stringify(vals)) : '';
                    callback(qerr, _res, fields);
                });
            }
        })
    }
};


module.exports = sqlAction;

