//backend/routes/delays.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { auth } = require("../middleware/auth");

// ==============================
// დამხმარე ფუნქცია სხვაობის (წუთებში) გამოსათვლელად
// ==============================
function diffMinutes(start, end) {
    if (!start || !end) return 0;
    const startDate = new Date(`1970-01-01T${start}Z`);
    const endDate = new Date(`1970-01-01T${end}Z`);
    const diff = (endDate - startDate) / (1000 * 60);
    return diff;
}


// ==============================
// ყველა ჩანაწერის წამოღება
// ==============================
router.get("/", auth(["Validator", "Admin"]), async(req, res, next) => {
    try {
        const [rows] = await pool.query(`
            SELECT d.*, u.personal_id, u.first_name, u.last_name
            FROM delays d
            JOIN users u ON u.id = d.user_id
            ORDER BY d.work_date DESC, d.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// ==============================
// ყველა ჩანაწერის წამოღება კონკრეტული თანამშრომლისთვის
// ==============================
router.get("/me", auth("Client"), async(req, res, next) => {
    try {
        const userId = req.user.id;

        const [rows] = await pool.query(`
            SELECT id, user_id, work_date, scheduled_start_time, check_in_time, 
                   late_minutes, scheduled_end_time, check_out_time, early_leave_minutes,
                   violation_notice, comment, created_at, updated_at
            FROM delays
            WHERE user_id = ?
            ORDER BY work_date DESC, created_at DESC
        `, [userId]);

        res.json(rows);
    } catch (err) {
        console.error("❌ Error fetching delays for /me:", err);
        res.status(500).json({ error: true, message: "Server error" });
    }
});




// ==============================
// ახალი ჩანაწერის დამატება
// ==============================
router.post("/", auth("Validator"), async(req, res, next) => {
    try {
        let {
            user_id,
            work_date,
            scheduled_start_time,
            check_in_time,
            scheduled_end_time,
            check_out_time,
            violation_notice = false,
            comment = ""
        } = req.body;

        // 🔹 work_date პირდაპირ წავა DB-ში
        const work_date_mysql = work_date;

        // გამოთვლები
        let late_minutes = 0;
        let early_leave_minutes = 0;

        if (scheduled_start_time && check_in_time) {
            late_minutes = Math.max(
                0,
                diffMinutes(scheduled_start_time, check_in_time)
            );
        }

        if (scheduled_end_time && check_out_time) {
            early_leave_minutes = Math.max(
                0,
                diffMinutes(check_out_time, scheduled_end_time)
            );
        }

        const [result] = await pool.query(`
            INSERT INTO delays
            (user_id, work_date, scheduled_start_time, check_in_time, scheduled_end_time, check_out_time, violation_notice, comment, late_minutes, early_leave_minutes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [user_id, work_date_mysql, scheduled_start_time, check_in_time, scheduled_end_time, check_out_time, violation_notice, comment, late_minutes, early_leave_minutes]);

        const [rows] = await pool.query(`
            SELECT d.*, u.first_name, u.last_name
            FROM delays d
            JOIN users u ON u.id = d.user_id
            WHERE d.id = ?
        `, [result.insertId]);

        res.json(rows[0]);
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
            return res.status(400).json({ message: "ამ თანამშრომელს უკვე აქვს ჩანაწერი ამ დღეს" });
        }
        next(err);
    }
});

// ==============================
// დაგვიანების განახლება
// ==============================
router.put("/:id", auth("Validator"), async(req, res, next) => {
    try {
        const id = req.params.id;
        const {
            user_id,
            work_date,
            scheduled_start_time,
            check_in_time,
            scheduled_end_time,
            check_out_time,
            violation_notice = false,
            comment = ""
        } = req.body;

        // ✅ ჯერ ვამოწმებთ დუბლიკატს
        const [exists] = await pool.query(
            `SELECT id FROM delays WHERE user_id = ? AND work_date = ? AND id <> ?`, [user_id, work_date, id]
        );
        if (exists.length > 0) {
            return res.status(400).json({ message: "ამ თანამშრომელს უკვე აქვს ჩანაწერი ამ დღეს" });
        }

        // გამოთვლები თავიდან
        let late_minutes = 0;
        let early_leave_minutes = 0;

        if (scheduled_start_time && check_in_time) {
            late_minutes = Math.max(0, diffMinutes(scheduled_start_time, check_in_time));
        }
        if (scheduled_end_time && check_out_time) {
            early_leave_minutes = Math.max(0, diffMinutes(check_out_time, scheduled_end_time));
        }

        await pool.query(
            `UPDATE delays
             SET work_date = ?, scheduled_start_time = ?, check_in_time = ?,
                 scheduled_end_time = ?, check_out_time = ?, violation_notice = ?,
                 comment = ?, late_minutes = ?, early_leave_minutes = ?, updated_at = NOW()
             WHERE id = ?`, [work_date, scheduled_start_time, check_in_time, scheduled_end_time, check_out_time, violation_notice, comment, late_minutes, early_leave_minutes, id]
        );

        const [rows] = await pool.query(`
            SELECT d.*, u.first_name, u.last_name
            FROM delays d
            JOIN users u ON u.id = d.user_id
            WHERE d.id = ?
        `, [id]);

        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});


module.exports = router;