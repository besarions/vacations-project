//backend/routes/client.js
const express = require("express");
const router = express.Router();
const pool = require("../db");
const { auth } = require("../middleware/auth");
const bcrypt = require("bcryptjs");

router.use(auth("Client"));

// ========================
// პირადი ინფორმაციის წამოღება
// ========================
router.get("/me", async(req, res) => {
    try {
        const [userRows] = await pool.query(
            `SELECT 
                u.id, 
                u.personal_id, 
                u.first_name, 
                u.last_name, 
                DATE_FORMAT(u.date_of_birth, '%Y-%m-%d') AS date_of_birth,
                DATE_FORMAT(u.start_date, '%Y-%m-%d') AS start_date,
                u.leave_days, 
                u.unpaid_leave_days, 
                u.sick_leave_days,
                p.name AS position_name
            FROM users u
            LEFT JOIN positions p ON u.position_id = p.id
            WHERE u.id = ?
            `, [req.user.id]
        );

        if (!userRows.length) return res.status(404).json({ message: "User not found" });
        const user = userRows[0];

        const [usedLeaves] = await pool.query(
            `SELECT lt.leavetypegroup AS leave_group, SUM(lr.used_days) AS total_used
             FROM leave_requests lr
             LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
             WHERE lr.client_id = ? AND lr.status NOT IN ('მოლოდინში','რედაქტირებული')
             GROUP BY lt.leavetypegroup`, [req.user.id]
        );

        let usedPaidLeave = 0;
        let usedUnpaidLeave = 0;
        let usedBulletin = 0;

        usedLeaves.forEach(row => {
            switch (row.leave_group) {
                case "ფასიანი":
                    usedPaidLeave += parseFloat(row.total_used);
                    break;
                case "უფასო":
                    usedUnpaidLeave += parseFloat(row.total_used);
                    break;
                case "ბიულეტენი":
                    usedBulletin += parseFloat(row.total_used);
                    break;
            }
        });

        res.json({
            ...user,
            used_paid_leave_days: usedPaidLeave,
            used_unpaid_leave_days: usedUnpaidLeave,
            used_bulletin_days: usedBulletin
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
});

// ========================
// ყველა შვებულების დღის წამოღება
// ========================
router.get("/holidays", async(req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, DATE_FORMAT(date, '%Y-%m-%d') AS date, name FROM holidays ORDER BY date ASC`
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
});

// ========================
// პაროლის განახლება
// ========================
router.put("/me", async(req, res) => {
    try {
        const { password } = req.body;
        if (!password) return res.status(400).json({ message: "Password is required" });

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, req.user.id]);

        res.json({ message: "Password updated successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
});

// ========================
// ახალი შვებულების მოთხოვნა
// ========================
router.post("/leave-requests", async(req, res) => {
    try {
        const { start_date, end_date, used_days, comment, leave_type_id } = req.body;



        if (!start_date || !leave_type_id)
            return res.status(400).json({ message: "გთხოვთ შეავსოთ სავალდებულო ველები" });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = new Date(start_date);
        const end = end_date ? new Date(end_date) : start;

        if (start < today)
            return res.status(400).json({ message: "წარსულ თარიღზე ვერ აირჩევთ" });

        if (end < start)
            return res.status(400).json({ message: "დასრულების თარიღი ვერ იქნება დაწყებაზე ადრე" });

        // გადაკვეთის შემოწმება
        const [overlapRows] = await pool.query(`
            SELECT id FROM leave_requests 
            WHERE client_id = ? 
              AND status NOT IN ('უარყოფილი') 
              AND (
                (start_date <= ? AND end_date >= ?) OR 
                (start_date <= ? AND end_date >= ?)
              )
        `, [req.user.id, end, start, start, end]);

        if (overlapRows.length > 0)
            return res.status(400).json({ message: "ამ თარიღებში უკვე არსებობს სხვა მოთხოვნა" });

        // ➡️ [FIX] balance მხოლოდ დეკრეტის გარდა ვალიდაცია
        const [userRows] = await pool.query("SELECT leave_days, unpaid_leave_days, sick_leave_days FROM users WHERE id = ?", [req.user.id]);
        if (!userRows.length) return res.status(404).json({ message: "მომხმარებელი ვერ მოიძებნა" });


        const user = userRows[0];
        const [leaveTypeRows] = await pool.query("SELECT leavetypegroup FROM leave_types WHERE id = ?", [leave_type_id]);
        if (!leaveTypeRows.length)
            return res.status(400).json({ message: "არასწორი შვებულების ტიპი" });

        const group = leaveTypeRows[0].leavetypegroup;
        let balance = 0;

        switch (group) {
            case "ფასიანი":
                balance = user.leave_days;
                break;
            case "უფასო":
                balance = user.unpaid_leave_days;
                break;
            case "ბიულეტენი":
                balance = user.sick_leave_days;
                break;
            case "დეკრეტი":
                balance = Infinity; // ➡️ [FIX] დეკრეტის ვალიდაცია გამორთულია
                break;
        }

        // უკვე გამოყენებული დღეების გამოთვლა
        const [usedRows] = await pool.query(`
            SELECT SUM(used_days) as total_used FROM leave_requests 
            WHERE client_id = ? AND status IN ('მოლოდინში','რედაქტირებული') 
              AND leave_type_id IN (SELECT id FROM leave_types WHERE leavetypegroup = ?)
        `, [req.user.id, group]);
        const alreadyUsed = parseFloat(usedRows[0].total_used || 0);

        // ➡️ [DEBUG] ფრონტიდან მიღებული მონაცემები

        console.log("🔹 FRONTEND DATA RECEIVED:", { start_date, end_date, used_days, comment, leave_type_id });

        console.log("🔹 DATA TYPES RECEIVED:", {
            start_date_type: typeof start_date,
            end_date_type: typeof end_date,
            used_days_type: typeof used_days,
            comment_type: typeof comment,
            leave_type_id_type: typeof leave_type_id
        });

        // ვალიდაცია მხოლოდ ფასიან, უფასო და ბიულეტენისთვის
        if (group !== "დეკრეტი" && (balance - alreadyUsed - used_days) < 0) {
            return res.status(400).json({ message: "მოთხოვნილი დღეები აჭარბებს დარჩენილ ბალანსს" });
        }

        // ჩაწერა
        await pool.query(`
            INSERT INTO leave_requests (client_id, leave_type_id, start_date, end_date, used_days, comment, status)
            VALUES (?, ?, ?, ?, ?, ?, 'მოლოდინში')
        `, [req.user.id, leave_type_id, start_date, end_date || start_date, used_days, comment || null]);

        // ➡️ [FIX] ჩაწერა პირდაპირ, აღარ არის insertQuery ცვლადი
        const insertValues = [req.user.id, leave_type_id, start_date, end_date || start_date, used_days, comment || null];

        // ➡️ [DEBUG] ბაზაში ჩასაწერი მონაცემები და ტიპები
        console.log("🔹 DATA TO INSERT INTO DB:", insertValues);
        console.log("🔹 DATA TO INSERT INTO DB TYPES:", {
            client_id_type: typeof req.user.id,
            leave_type_id_type: typeof leave_type_id,
            start_date_type: typeof start_date,
            end_date_type: typeof end_date,
            used_days_type: typeof used_days,
            comment_type: typeof comment
        });


        await pool.query(insertQuery, insertValues);


        res.status(201).json({ message: "მოთხოვნა წარმატებით დაემატა" });

    } catch (err) {
        console.error("Leave request error:", err);
        res.status(500).json({ message: "სერვერის შეცდომა" });
    }
});


// ========================
// საკუთარი მოთხოვნების ნახვა
// ========================
router.get("/leave-requests", async(req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT lr.id, lr.client_id,
                    DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS start_date,
                    DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS end_date,
                    lr.used_days, lr.comment, lr.status,
                    lr.created_at , lr.updated_at,
                    lt.id AS leave_type_id,
                    lt.name AS leave_type,
                    lt.leavetypegroup AS leave_group
             FROM leave_requests lr
             LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
             WHERE lr.client_id = ?
             ORDER BY lr.start_date DESC`, [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
});

// ========================
// რედაქტირება მხოლოდ „გასასვლელ“ მოთხოვნებზე
// ========================
router.put("/leave-requests/:id", async(req, res) => {
    try {
        const requestId = req.params.id;
        const { start_date, end_date, used_days, comment, leave_type_id } = req.body;

        // ვალიდაცია
        if (!start_date || !leave_type_id)
            return res.status(400).json({ message: "გთხოვთ შეავსოთ სავალდებულო ველები" });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = new Date(start_date);
        const end = end_date ? new Date(end_date) : start;

        if (end < start)
            return res.status(400).json({ message: "დასრულების თარიღი ვერ იქნება დაწყებაზე ადრე" });

        // ამ მოთხოვნის წამოღება
        const [rows] = await pool.query(
            "SELECT * FROM leave_requests WHERE id = ? AND client_id = ?", [requestId, req.user.id]
        );

        if (!rows.length)
            return res.status(404).json({ message: "მოთხოვნა ვერ მოიძებნა" });

        const existing = rows[0]; // 🎯 უნდა იყოს try-ის შიგნით

        if (new Date(existing.start_date) < today)
            return res.status(400).json({ message: "უკვე დაწყებული მოთხოვნა ვერ რედაქტირდება" });

        // თუ მოთხოვნა აქტიურია, პირველ რიგში დაბრუნე used_days
        if (existing.status === "აქტიური") {
            const leaveTypeId = existing.leave_type_id;

            // აქ გინდა რომ დეიოფი და გათავისუფლება ფასიანად მიიჩნეოდეს
            const leaveTypeRows = await pool.query("SELECT leavetypegroup FROM leave_types WHERE id = ?", [leaveTypeId]);
            const group = leaveTypeRows[0][0].leavetypegroup;

            switch (group) {
                case "ფასიანი":
                    await pool.query("UPDATE users SET leave_days = leave_days + ? WHERE id = ?", [existing.used_days, req.user.id]);
                    break;
                case "უფასო":
                    await pool.query("UPDATE users SET unpaid_leave_days = unpaid_leave_days + ? WHERE id = ?", [existing.used_days, req.user.id]);
                    break;
                case "ბიულეტენი":
                    await pool.query("UPDATE users SET sick_leave_days = sick_leave_days + ? WHERE id = ?", [existing.used_days, req.user.id]);
                    break;
            }
        }

        // გადაკვეთის შემოწმება, ვალიდაციები და ბოლოს განახლება
        const [userRows] = await pool.query("SELECT leave_days, unpaid_leave_days, sick_leave_days FROM users WHERE id = ?", [req.user.id]);
        if (!userRows.length) return res.status(404).json({ message: "მომხმარებელი ვერ მოიძებნა" });

        const user = userRows[0];

        const [leaveTypeRows] = await pool.query("SELECT leavetypegroup FROM leave_types WHERE id = ?", [leave_type_id]);
        if (!leaveTypeRows.length) return res.status(400).json({ message: "არასწორი შვებულების ტიპი" });

        const group = leaveTypeRows[0].leavetypegroup;

        const [usedRows] = await pool.query(
            `SELECT SUM(used_days) as total_used FROM leave_requests 
             WHERE client_id = ? AND status IN ('მოლოდინში','რედაქტირებული') 
             AND id != ? AND leave_type_id IN (SELECT id FROM leave_types WHERE leavetypegroup = ?)`, [req.user.id, requestId, group]
        );
        const alreadyUsed = parseFloat(usedRows[0].total_used || 0);

        let balance = 0;
        switch (group) {
            case "ფასიანი":
                balance = user.leave_days;
                break;
            case "უფასო":
                balance = user.unpaid_leave_days;
                break;
            case "ბიულეტენი":
                balance = user.sick_leave_days;
                break;
            case "დეკრეტი":
                balance = Infinity; // ✅ დეკრეტის შემთხვევაში ვალიდაცია არ ბლოკავს
                break;
        }

        // ✅ ვალიდაცია მხოლოდ იმ ტიპებისთვის, რომლებიც ბალანსს იყენებენ
        if (group !== "დეკრეტი" && (balance - alreadyUsed - used_days) < 0) {
            return res.status(400).json({ message: "მოთხოვნილი დღეები აჭარბებს დარჩენილ ბალანსს" });
        }

        await pool.query(
            `UPDATE leave_requests 
             SET leave_type_id = ?, start_date = ?, end_date = ?, used_days = ?, comment = ?, status = 'რედაქტირებული'
             WHERE id = ? AND client_id = ?`, [leave_type_id, start_date, end_date || start_date, used_days, comment || null, requestId, req.user.id]
        );

        res.status(200).json({ message: "მოთხოვნა წარმატებით განახლდა" });

    } catch (err) {
        console.error("Update leave request error:", err);
        res.status(500).json({ message: "სერვერის შეცდომა" });
    }
});



// ========================
// შვებულების ტიპები (test, auth-ვერ მოითხოვს)
// ========================
// ========================
// Get All Leave Types (ყველა მონაცემი, ფილტრის გარეშე)
// ========================
router.get("/leave-types", async(req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, name, description, is_active, created_at, updated_at, leavetypegroup
             FROM leave_types
             ORDER BY name ASC`
        );
        res.json(rows);
    } catch (err) {
        console.error("Failed to fetch leave types:", err);
        res.status(500).json({ message: "Server Error" });
    }
});




module.exports = router;