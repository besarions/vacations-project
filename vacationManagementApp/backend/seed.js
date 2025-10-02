const pool = require("./db");
const bcrypt = require("bcryptjs");

async function run() {
  try {
    // create positions if not exists
    await pool.query("CREATE TABLE IF NOT EXISTS positions (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50) NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)");
    await pool.query("CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, personal_id VARCHAR(50) UNIQUE NOT NULL, first_name VARCHAR(50) NOT NULL, last_name VARCHAR(50) NOT NULL, password VARCHAR(255) NOT NULL, date_of_birth DATE, position_id INT, start_date DATE, end_date DATE, leave_days INT DEFAULT 0, status VARCHAR(20) DEFAULT 'აქტიური', role VARCHAR(20) NOT NULL DEFAULT 'Client', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)");
    await pool.query("CREATE TABLE IF NOT EXISTS leave_requests (id INT AUTO_INCREMENT PRIMARY KEY, client_id INT, start_date DATE, end_date DATE, used_days INT, status VARCHAR(20), state VARCHAR(20), comment VARCHAR(255), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE SET NULL)");

    // insert positions
    var [p] = await pool.query("SELECT id FROM positions WHERE name IN ('Administrator','Validator','Engineer')");
    if (p.length === 0) {
      await pool.query("INSERT INTO positions (name) VALUES ('Administrator'), ('Validator'), ('Engineer')");
    }

    var [rows] = await pool.query("SELECT id, name FROM positions");
    var adminPos = null, validatorPos = null, engineerPos = null;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].name === "Administrator") adminPos = rows[i].id;
      if (rows[i].name === "Validator") validatorPos = rows[i].id;
      if (rows[i].name === "Engineer") engineerPos = rows[i].id;
    }

    var users = [
      { personal_id: "admin001", first_name: "Admin", last_name: "User", password: "Admin@123", role: "Admin", position_id: adminPos },
      { personal_id: "validator001", first_name: "Val", last_name: "Idator", password: "Validator@123", role: "Validator", position_id: validatorPos },
      { personal_id: "client001", first_name: "Client", last_name: "User", password: "Client@123", role: "Client", position_id: engineerPos }
    ];

    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      var [exists] = await pool.query("SELECT id FROM users WHERE personal_id = ?", [u.personal_id]);
      if (exists.length === 0) {
        var hash = bcrypt.hashSync(u.password, 10);
        await pool.query("INSERT INTO users (personal_id, first_name, last_name, password, date_of_birth, position_id, start_date, leave_days, status, role) VALUES (?,?,?,?,?,?,?,?,?,?)", [u.personal_id, u.first_name, u.last_name, hash, "1990-01-01", u.position_id, "2022-01-01", 24, "აქტიური", u.role]);
        console.log("Inserted user:", u.personal_id);
      } else {
        console.log("User exists:", u.personal_id);
      }
    }

    console.log("Seed finished");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
