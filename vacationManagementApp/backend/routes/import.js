const express = require("express");
const router = express.Router();
const pool = require("../db");
const XLSX = require("xlsx");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const upload = multer({ dest: "uploads/" });
const { authMiddleware } = require("../middleware/auth");

// ==============================
// Helper: Convert Excel date to MySQL YYYY-MM-DD
// ==============================
function excelDateToJSDate(excelDate) {
    if (!excelDate) return null;

    if (typeof excelDate === "number") {
        // Excel serial date
        const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
        return date.toISOString().split("T")[0]; // YYYY-MM-DD
    } else if (typeof excelDate === "string") {
        // Already string, try parsing
        const parsed = new Date(excelDate);
        if (!isNaN(parsed)) return parsed.toISOString().split("T")[0];
    }

    return null;
}

// ==============================
// Sample Excel Download
// ==============================
router.get("/download-sample", authMiddleware, async(req, res) => {
    try {
        const sampleData = [{
            "პირადი №": "",
            "გვარი": "",
            "სახელი": "",
            "პაროლი": "123456",
            "დაბ. თარიღი": "",
            "პოზიცია": "",
            "დაწყება": "",
            "დასრულება": "",
            "შვ. დღეები": "24",
            "უფასო შვ.": "15",
            "ბიულეტენი": "60",
            "სტატუსი": "აქტიური",
            "როლი": "client"
        }];

        const worksheet = XLSX.utils.json_to_sheet(sampleData);
        const headers = Object.keys(sampleData[0]);
        worksheet["!cols"] = headers.map(() => ({ wch: 20 }));

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "UsersSample");

        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        res.setHeader("Content-Disposition", "attachment; filename=users_sample.xlsx");
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.end(buffer);
    } catch (err) {
        console.error("Download sample failed:", err);
        res.status(500).json({ message: "Sample download failed" });
    }
});

// ==============================
// Upload & Preview
// ==============================
router.post("/preview-clients", authMiddleware, upload.single("file"), async(req, res) => {
    if (!req.file) return res.status(400).json({ message: "ფაილი არ აირჩიეთ" });

    try {
        const workbook = XLSX.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);

        // Clean up uploaded file
        fs.unlink(req.file.path, () => {});

        const [dbRows] = await pool.query("SELECT personal_id FROM users");
        const existingIds = dbRows.map(u => u.personal_id);

        const preview = [];
        const duplicateCheck = new Set();

        rows.forEach((row, i) => {
            const personal_id = row["პირადი №"];
            const first_name = row["სახელი"];
            const last_name = row["გვარი"];
            const passwordPlain = row["პაროლი"] || "123456";
            const date_of_birth = excelDateToJSDate(row["დაბ. თარიღი"]);
            const position_id = row["პოზიცია"] || null;
            const start_date = excelDateToJSDate(row["დაწყება"]);
            const end_date = excelDateToJSDate(row["დასრულება"]);
            const leave_days = parseFloat(row["შვ. დღეები"]) || 0;
            const unpaid_leave_days = parseInt(row["უფასო შვ."]) || 0;
            const sick_leave_days = parseInt(row["ბიულეტენი"]) || 0;
            const status = row["სტატუსი"] || "აქტიური";
            const role = row["როლი"] || "user";

            const errors = [];

            if (!personal_id || !first_name || !last_name || !start_date) errors.push("სავალდებულო ველი ცარიელია");
            if (existingIds.includes(personal_id)) errors.push("პირადი ნომერი უკვე არსებობს ბაზაში");
            if (duplicateCheck.has(personal_id)) errors.push("დუბლიკატი იმავე ფაილში");

            duplicateCheck.add(personal_id);

            preview.push({
                rowNumber: i + 2,
                personal_id,
                first_name,
                last_name,
                passwordPlain,
                date_of_birth,
                position_id,
                start_date,
                end_date,
                leave_days,
                unpaid_leave_days,
                sick_leave_days,
                status,
                role,
                errors
            });
        });

        res.json({ preview });
    } catch (err) {
        console.error("Preview error:", err);
        res.status(500).json({ message: "პრევიუს შექმნა ვერ მოხერხდა" });
    }
});

// ==============================
// Commit to Database
// ==============================
router.post("/commit-clients", authMiddleware, async(req, res) => {
    const clients = req.body.clients;
    if (!clients || !Array.isArray(clients)) return res.status(400).json({ message: "არასწორი მონაცემები" });

    let successCount = 0;
    let failCount = 0;

    for (const client of clients) {
        if (client.errors && client.errors.length > 0) {
            failCount++;
            continue;
        }

        try {
            const passwordHash = await bcrypt.hash(client.passwordPlain || "123456", 10);

            await pool.query(
                `INSERT INTO users 
                (personal_id, first_name, last_name, password, date_of_birth, position_id, start_date, end_date, leave_days, unpaid_leave_days, sick_leave_days, status, role, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`, [
                    client.personal_id,
                    client.first_name,
                    client.last_name,
                    passwordHash,
                    client.date_of_birth,
                    client.position_id,
                    client.start_date,
                    client.end_date,
                    client.leave_days,
                    client.unpaid_leave_days,
                    client.sick_leave_days,
                    client.status,
                    client.role
                ]
            );

            successCount++;
        } catch (err) {
            console.error("Insert error:", err);
            failCount++;
        }
    }

    res.json({ message: `დამატდა ${successCount} ჩანაწერი, ვერ დაემატა ${failCount}` });
});

module.exports = router;