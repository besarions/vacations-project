//backend/routes/validator.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { auth } = require("../middleware/auth");
const bcrypt = require("bcryptjs");

// Validator მხოლოდ კლიენტებს და შვებულებებს ხედავს
router.use(auth("Validator"));

// 🔹 ყველა კლიენტის წამოღება სრული ინფორმაციისთვის (პოზიციის სახელით)
router.get("/clients", async(req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT u.id, u.personal_id, u.first_name, u.last_name, u.date_of_birth,
                   u.status, u.role, u.start_date, u.end_date,
                   u.leave_days, u.unpaid_leave_days, u.sick_leave_days,
                   u.created_at, u.updated_at,
                   p.name AS position_name
            FROM users u
            LEFT JOIN positions p ON u.position_id = p.id
            WHERE u.role='Client'
            ORDER BY u.last_name, u.first_name ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
});

// 🔹 შვებულების მოთხოვნების ნახვა სრული ინფორმაციისთვის
router.get("/leave-requests", async(req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT lr.*, 
                   u.personal_id AS client_personal_id,
                   u.first_name AS client_first_name,
                   u.last_name AS client_last_name,
                   u.status AS client_status,
                   u.role AS client_role,
                   u.date_of_birth AS client_dob,
                   u.position_id AS client_position_id,
                   u.start_date AS client_start_date,
                   u.end_date AS client_end_date,
                   u.leave_days AS client_leave_days,
                   u.unpaid_leave_days AS client_unpaid_leave_days,
                   u.sick_leave_days AS client_sick_leave_days,
                   lt.name AS leave_type_name   -- აქ მოვაქვს ტიპის სახელი
            FROM leave_requests lr
            JOIN users u ON lr.client_id = u.id
            LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
            ORDER BY
                CASE lr.status
                    WHEN 'მოლოდინში' THEN 1
                    WHEN 'რედაქტირებული' THEN 1
                    WHEN 'აქტიური' THEN 2
                    WHEN 'უარყოფილი' THEN 3
                    ELSE 4
                END,
                lr.updated_at DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
});

// 🔹 შვებულების მოთხოვნის დადასტურება/უარყოფა + leave_days / unpaid_leave_days გამოკლება
// 🔹 შვებულების მოთხოვნის დადასტურება/უარყოფა + leave_days გამოკლება ტიპის მიხედვით
router.put("/leave-requests/:id", async(req, res) => {
    const conn = await pool.getConnection();
    try {
        const { status } = req.body;
        const { id } = req.params;

        if (!["აქტიური", "უარყოფილი"].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        await conn.beginTransaction();

        // მოთხოვნის წამოღება leave_type–ის სახელით
        const [reqRows] = await conn.query(
            `SELECT lr.client_id, lr.used_days, lr.leave_type_id, lt.name AS leave_type_name
             FROM leave_requests lr
             LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
             WHERE lr.id = ?`, [id]
        );

        if (reqRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: "Request not found" });
        }

        const { client_id, used_days, leave_type_name } = reqRows[0];

        // სტატუსის განახლება
        await conn.query(
            "UPDATE leave_requests SET status = ?, updated_at = NOW() WHERE id = ?", [status, id]
        );

        // თუ დადასტურებულია ("აქტიური") → აკლდება შესაბამის ველს
        if (status === "აქტიური") {
            let updateQuery = "";
            switch (leave_type_name) {
                case "ფასიანი შვებულება":
                case "დეიოფი":
                case "გათავისუფლება":
                    // ყველა ეს ტიპი აკლებს leave_days
                    updateQuery = `
                UPDATE users
                SET leave_days = GREATEST(leave_days - ?, 0)
                WHERE id = ?`;
                    await conn.query(updateQuery, [used_days, client_id]);
                    break;

                case "უფასო შვებულება":
                    updateQuery = `
                UPDATE users
                SET unpaid_leave_days = GREATEST(unpaid_leave_days - ?, 0)
                WHERE id = ?`;
                    await conn.query(updateQuery, [used_days, client_id]);
                    break;

                case "ბიულეტენი":
                    updateQuery = `
                UPDATE users
                SET sick_leave_days = GREATEST(sick_leave_days - ?, 0)
                WHERE id = ?`;
                    await conn.query(updateQuery, [used_days, client_id]);
                    break;

                default:
                    console.warn("Unknown leave type:", leave_type_name);
                    break;
            }
        }


        await conn.commit();
        res.json({ message: "Leave request updated successfully" });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    } finally {
        conn.release();
    }
});



// 🔹 ყველა პოზიციის წამოღება Validator-ისთვის
router.get("/positions", async(req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT id, name, created_at, updated_at
            FROM positions
            ORDER BY name ASC
        `);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
});

module.exports = router;