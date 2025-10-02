//backend/routes/admin.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const bcrypt = require("bcryptjs");
const { auth } = require("../middleware/auth");

// Middleware for Admin only
const adminAuth = auth("Admin");

// ---------------- Users CRUD ----------------

// Get all users (with position name, formatted dates)
router.get("/users", adminAuth, async(req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT u.id, u.personal_id, u.first_name, u.last_name,
                   DATE_FORMAT(u.date_of_birth,'%Y-%m-%d') AS date_of_birth,
                   u.position_id, p.name AS position_name,
                   DATE_FORMAT(u.start_date,'%Y-%m-%d') AS start_date,
                   DATE_FORMAT(u.end_date,'%Y-%m-%d') AS end_date,
                   u.leave_days, u.unpaid_leave_days, u.sick_leave_days,
                   u.status, u.role,
                   DATE_FORMAT(u.created_at,'%Y-%m-%d') AS created_at,
                   DATE_FORMAT(u.updated_at,'%Y-%m-%d') AS updated_at
            FROM users u
            LEFT JOIN positions p ON u.position_id = p.id
            ORDER BY u.last_name, u.first_name   ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Get single user by ID
router.get("/users/:id", adminAuth, async(req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query(`
            SELECT u.id, u.personal_id, u.first_name, u.last_name,
                   DATE_FORMAT(u.date_of_birth,'%Y-%m-%d') AS date_of_birth,
                   u.position_id, p.name AS position_name,
                   DATE_FORMAT(u.start_date,'%Y-%m-%d') AS start_date,
                   DATE_FORMAT(u.end_date,'%Y-%m-%d') AS end_date,
                   u.leave_days, u.unpaid_leave_days, u.sick_leave_days,
                   u.status, u.role,
                   DATE_FORMAT(u.created_at,'%Y-%m-%d') AS created_at,
                   DATE_FORMAT(u.updated_at,'%Y-%m-%d') AS updated_at
            FROM users u
            LEFT JOIN positions p ON u.position_id = p.id
            WHERE u.id = ?
        `, [id]);
        if (rows.length === 0) return res.status(404).json({ message: "User not found" });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Create user
router.post("/users", adminAuth, async(req, res) => {
    try {
        let { personal_id, first_name, last_name, password, role, status, position_id, start_date, end_date, leave_days, unpaid_leave_days, sick_leave_days, date_of_birth } = req.body;

        if (!personal_id || !first_name || !last_name || !password || !role) {
            return res.status(400).json({ message: "All required fields must be provided" });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);

        if (!date_of_birth) date_of_birth = null;
        if (!start_date) start_date = null;
        if (!end_date) end_date = null;
        if (!leave_days) leave_days = 0;
        if (!unpaid_leave_days) unpaid_leave_days = 0;
        if (!sick_leave_days) sick_leave_days = 0;

        await pool.query(
            `INSERT INTO users 
            (personal_id, first_name, last_name, password, role, status, position_id, start_date, end_date, leave_days, unpaid_leave_days, sick_leave_days, date_of_birth, created_at, updated_at) 
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())`, [personal_id, first_name, last_name, hashedPassword, role, status, position_id || null, start_date, end_date, leave_days, unpaid_leave_days, sick_leave_days, date_of_birth]
        );

        res.json({ message: "User added successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// Update user
router.put("/users/:id", adminAuth, async(req, res) => {
    try {
        const { id } = req.params;
        let {
            personal_id,
            first_name,
            last_name,
            //password,
            date_of_birth,
            position_id,
            start_date,
            end_date,
            leave_days,
            unpaid_leave_days,
            sick_leave_days,
            status,
            role
        } = req.body;

        // გადააქციოს string → number სადაც საჭიროა
        leave_days = leave_days ? parseFloat(leave_days) : 0.00;
        unpaid_leave_days = unpaid_leave_days ? parseInt(unpaid_leave_days) : 0;
        sick_leave_days = sick_leave_days ? parseInt(sick_leave_days) : 0;

        if (!date_of_birth) date_of_birth = null;
        if (!start_date) start_date = null;
        if (!end_date) end_date = null;

        let query = `
            UPDATE users 
            SET personal_id=?, first_name=?, last_name=?, date_of_birth=?, position_id=?, start_date=?, end_date=?,
                leave_days=?, unpaid_leave_days=?, sick_leave_days=?, status=?, role=?, updated_at=NOW()`;
        let params = [
            personal_id, first_name, last_name, date_of_birth, position_id || null,
            start_date, end_date,
            leave_days, unpaid_leave_days, sick_leave_days,
            status, role
        ];

        //    if (password && password.trim() !== "") {
        //        const hashedPassword = bcrypt.hashSync(password, 10);
        //       query += `, password=?`;
        //       params.push(hashedPassword);
        //   }

        query += ` WHERE id=?`;
        params.push(id);

        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ message: "User not found" });

        res.json({ message: "User updated successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
});

/* ===========================
   პაროლის შეცვლის როუტი
   =========================== */
router.put("/users/:id/password", auth(["Admin"]), async(req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;

        if (!password || password.trim() === "") {
            return res.status(400).json({ message: "ახალი პაროლი აუცილებელია" });
        }

        // პაროლის ჰეშირება
        const hashedPassword = await bcrypt.hash(password, 10);

        // განახლება
        const [result] = await pool.query(
            "UPDATE users SET password = ? WHERE id = ?", [hashedPassword, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "მომხმარებელი ვერ მოიძებნა" });
        }

        res.json({ message: "პაროლი წარმატებით შეიცვალა" });
    } catch (err) {
        console.error("Password update error:", err);
        res.status(500).json({ message: "სერვერის შეცდომა" });
    }
});


// ========================
// მომხმარებლის წაშლა (DELETE)
// ========================
router.delete("/users/:id", adminAuth, async(req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query("DELETE FROM users WHERE id = ?", [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: "User not found" });

        res.json({ message: "User deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
});

// ---------------- Positions CRUD ----------------

router.get("/positions", adminAuth, async(req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM positions ORDER By name");
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

router.post("/positions", adminAuth, async(req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: "Position name required" });

        await pool.query("INSERT INTO positions (name, created_at, updated_at) VALUES (?, NOW(), NOW())", [name]);
        res.json({ message: "Position added successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

router.put("/positions/:id", adminAuth, async(req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        await pool.query("UPDATE positions SET name = ?, updated_at = NOW() WHERE id = ?", [name, id]);
        res.json({ message: "Position updated successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// ---------------- Leave Requests ----------------

// Get all leave requests (with client details, formatted dates)
router.get("/leave-requests", adminAuth, async(req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT lr.*, 
                   u.personal_id AS client_personal_id,
                   u.first_name AS client_first_name, 
                   u.last_name AS client_last_name,
                   DATE_FORMAT(lr.start_date,'%Y-%m-%d') AS start_date,
                   DATE_FORMAT(lr.end_date,'%Y-%m-%d') AS end_date
            FROM leave_requests lr
            LEFT JOIN users u ON lr.client_id = u.id
            ORDER BY updated_at DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// ---------------- Leave Types CRUD ----------------
router.get("/leave-types", adminAuth, async(req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM leave_types");
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});



router.post("/leave-types", adminAuth, async(req, res) => {
    try {
        const { name, description, is_active } = req.body;
        if (!name) return res.status(400).json({ message: "Name is required" });

        await pool.query(
            "INSERT INTO leave_types (name, description, is_active, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())", [name, description || "", is_active ? 1 : 0]
        );
        res.json({ message: "Leave type added successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

router.put("/leave-types/:id", adminAuth, async(req, res) => {
    try {
        const { id } = req.params;
        const { name, description, is_active } = req.body;

        await pool.query(
            "UPDATE leave_types SET name = ?, description = ?, is_active = ?, updated_at = NOW() WHERE id = ?", [name, description || "", is_active ? 1 : 0, id]
        );

        res.json({ message: "Leave type updated successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

router.delete("/leave-types/:id", adminAuth, async(req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM leave_types WHERE id = ?", [id]);
        res.json({ message: "Leave type deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});



module.exports = router;