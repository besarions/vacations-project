//backend/routes/export.js
const express = require("express");
const router = express.Router();
const pool = require("../db"); // assume mysql2/promise pool
const XLSX = require("xlsx");

// Generic Excel export
function generateExcel(data, headers, sheetName = "Sheet1") {
    const mapped = data.map(item => {
        const row = {};
        for (const key in headers) {
            const value = item[key];
            if (value === null || value === undefined) row[headers[key]] = "";
            else if (value instanceof Date) row[headers[key]] = value.toISOString().split("T")[0];
            else row[headers[key]] = value;
        }
        return row;
    });
    const ws = XLSX.utils.json_to_sheet(mapped, { header: Object.values(headers) });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}


// ==========================
// Clients
// ==========================
router.get("/export-clients", async(req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT u.personal_id, u.first_name, u.last_name, p.name as position,
                    u.start_date, u.end_date, u.leave_days, u.unpaid_leave_days, u.sick_leave_days,
                    u.status, u.created_at
             FROM users u
             LEFT JOIN positions p ON u.position_id = p.id`
        );

        const headers = {
            personal_id: "პირადი №",
            first_name: "სახელი",
            last_name: "გვარი",
            position: "პოზიცია",
            start_date: "დაწყების თარიღი",
            end_date: "დასრულების თარიღი",
            leave_days: "ფასიანი შვ. დღეები",
            unpaid_leave_days: "უფასო შვ. დღეები",
            sick_leave_days: "სავარაუდო დაავადების დღეები",
            status: "სტატუსი",
            created_at: "დამატების თარიღი"
        };

        const buf = generateExcel(rows, headers, "Clients");
        res.setHeader("Content-Disposition", "attachment; filename=clients.xlsx");
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.send(buf);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Export failed" });
    }
});

// ==========================
// Leaves
// ==========================
router.get("/export-leaves", async(req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT lr.id, u.personal_id as client_personal_id, u.first_name as client_first_name, u.last_name as client_last_name,
                    lr.start_date, lr.end_date, lr.used_days, lr.status, lr.comment,
                    lt.name as leave_type_name, lr.created_at
             FROM leave_requests lr
             LEFT JOIN users u ON lr.client_id = u.id
             LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id`
        );

        const headers = {
            client_personal_id: "პირადი №",
            client_first_name: "სახელი",
            client_last_name: "გვარი",
            start_date: "დაწყების თარიღი",
            end_date: "დასასრულის თარიღი",
            used_days: "გამოყენებული დღეები",
            leave_type_name: "შვ. ტიპი",
            status: "სტატუსი",
            comment: "კომენტარი",
            created_at: "შექმნა"
        };

        const buf = generateExcel(rows, headers, "Leaves");
        res.setHeader("Content-Disposition", "attachment; filename=leaves.xlsx");
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.send(buf);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Export failed" });
    }
});

// ==========================
// Delays
// ==========================
router.get("/export-delays", async(req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT d.id, u.personal_id, u.first_name, u.last_name,
                    d.work_date, d.scheduled_start_time, d.check_in_time,
                    d.late_minutes, d.scheduled_end_time, d.check_out_time,
                    d.early_leave_minutes, d.comment, d.violation_notice,
                    d.created_at
             FROM delays d
             LEFT JOIN users u ON d.user_id = u.id`
        );

        const headers = {
            personal_id: "პირადი №",
            first_name: "სახელი",
            last_name: "გვარი",
            work_date: "სამუშაო თარიღი",
            scheduled_start_time: "დაგეგმილი მოსვლა",
            check_in_time: "ფაქტობრივი მოსვლა",
            late_minutes: "დაგვიანება",
            scheduled_end_time: "დაგეგმილი წასვლა",
            check_out_time: "ფაქტობრივი წასვლა",
            early_leave_minutes: "ადრიანი წასვლა",
            comment: "კომენტარი",
            violation_notice: "დარღვევის გაფრთხილება",
            created_at: "შეიქმნა"
        };

        const buf = generateExcel(rows, headers, "Delays");
        res.setHeader("Content-Disposition", "attachment; filename=delays.xlsx");
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.send(buf);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Export failed" });
    }
});

module.exports = router;