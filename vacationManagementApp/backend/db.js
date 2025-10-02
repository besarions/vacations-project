const mysql = require("mysql2/promise");

const pool = mysql.createPool({
    host: "192.168.41.101",
    user: "root",
    password: "root1234",
    database: "vacation_db", // შენი ბაზის სახელი
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true
});

module.exports = pool;