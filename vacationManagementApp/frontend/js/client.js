//frontend/js/client.js
// ========================
// API + Token
const API_URL = "http://192.168.41.101:5000/api";
const token = localStorage.getItem("token");

////მოდალი

const leaveModal = document.getElementById("leaveModal");
leaveModal.style.display = "none";
const leaveForm = document.querySelector("#leaveForm");

function openLeaveModal() {
    leaveModal.style.display = "block";
    clearLeaveForm()
}

function closeLeaveModal() {
    leaveModal.style.display = "none";
}

// ტაბების გადართვა
const navButtons = document.querySelectorAll("nav button");
const tabs = document.querySelectorAll("section.tab-content");

navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        navButtons.forEach(b => b.classList.remove("active"));
        tabs.forEach(tab => tab.classList.remove("active"));

        btn.classList.add("active");
        document.getElementById(btn.dataset.tab).classList.add("active");
    });
});


// ========================
// Global variables
let totalLeave = 0,
    usedPaidLeave = 0,
    usedUnpaidLeave = 0,
    usedBulletin = 0;
let allHolidays = [],
    allLeaves = [],
    allLeaveTypes = [],
    lockedDates = [];
let delaysData = [];



//////////////////
// Debug helper
function debugLog(title, obj) {
    console.group(`DEBUG: ${title}`);
    console.table(obj);
    console.groupEnd();

    const debugEl = document.getElementById("debugOutput");
    if (debugEl) {
        debugEl.innerHTML = `<strong>${title}</strong><pre>${JSON.stringify(obj, null, 2)}</pre>`;
    }
}

//////////////////
// ========================
// ✅ DEBUG ADDED
function getLeaveFormValues() {
    const leaveId = document.getElementById("leaveId").value;
    const leaveTypeId = document.getElementById("leave_type_select").value;
    const comment = document.getElementById("comment").value;
    const usedDays = document.getElementById("used_days").value;
    const remainingDays = document.getElementById("remaining_days").textContent;
    const usedHolidays = document.getElementById("used_holidays").textContent;
    const leaveStartDate = document.getElementById("leave_start_date").value;
    const leaveEndDate = document.getElementById("leave_end_date").value;

    const leaveTypeObj = allLeaveTypes.find(t => t.id == leaveTypeId);
    const leaveTypeName = leaveTypeObj ? leaveTypeObj.name : null;

    return {
        leaveId,
        leaveTypeId,
        leaveTypeName,
        comment,
        usedDays,
        remainingDays,
        usedHolidays,
        leaveStartDate,
        leaveEndDate
    };
}

// ========================
// ✅ DEBUG ADDED
function debugLeaveForm() {
    const formValues = getLeaveFormValues();
    debugLog("Current Leave Form Values", formValues);
}
//////////////////////

// ========================
// Alert helper
function showAlert(message, type = "error") {
    const el = document.createElement("div");
    el.textContent = message;
    el.style.cssText = `
        position:fixed; top:20px; right:20px; padding:10px 15px;
        border-radius:5px; font-weight:bold; z-index:9999;
        background:${type==="error"?"#f8d7da":"#d4edda"};
        color:${type==="error"?"#721c24":"#155724"}; box-shadow:0 2px 6px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

// ========================
// Logout
function logout() {
    localStorage.removeItem("token");
    window.location.href = "index.html";
}
document.getElementById("logoutBtn").addEventListener("click", logout);

// ========================
// Row numbering - უნივერსალური ფუნქცია
function updateRowNumbers(tableId) {
    const rows = document.querySelectorAll(`#${tableId} tbody tr`);
    rows.forEach((tr, i) => {
        const td = tr.querySelector(".row-number");
        if (td) td.textContent = i + 1;
    });
}

// ========================
// Helpers
function formatDateFull(d) { return d ? d.split("T")[0] : ""; }

function formatDateTime(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleString("ka-GE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

function getLeaveGroup(name) {
    switch (name) {
        case "ფასიანი შვებულება":
        case "დეიოფი":
        case "გათავისუფლება":
            return "ფასიანი";
        case "უფასო შვებულება":
            return "უფასო";
        case "ბიულეტენი":
            return "ბიულეტენი";
            // ✅ ახალი ჯგუფი დეკრეტისთვის
        case "დეკრეტი 126":
        case "დეკრეტი 143":
        case "დეკრეტი 604":
            return "დეკრეტი";
        default:
            return "ფასიანი";
    }
}


// ========================
// Fetch Leave Requests
async function fetchAndDisplayLeaveRequests() {
    if (!API_URL || !token) return;
    try {
        const res = await fetch(`${API_URL}/client/leave-requests`, { headers: { "Authorization": "Bearer " + token } });
        let data = [];
        try { data = await res.json(); } catch (e) { data = []; }
        if (!res.ok) return;
        allLeaves = data;
        lockedDates = [];
        allLeaves.forEach(l => {
            if (l.status === "უარყოფილი") return;
            const start = new Date(l.start_date),
                end = l.end_date ? new Date(l.end_date) : start;
            let current = new Date(start);
            while (current <= end) {
                lockedDates.push(current.toISOString().split("T")[0]);
                current.setDate(current.getDate() + 1);
            }
        });

        // ✨ Flatpickr-ის განახლება უკვე არსებული lockedDates-ით
        if (picker) {
            picker.set('disable', lockedDates);
        }

    } catch (err) { showAlert("შვებულების მონაცემების ჩატვირთვა ვერ მოხერხდა"); }
}


// ========================
// Flatpickr
let picker = flatpickr("#calendarContainer", {
    mode: "range",
    inline: true,
    dateFormat: "Y-m-d",
    showMonths: 1,
    minDate: null, // აქედან იწყება მონიშვნა
    disable: lockedDates,
    onChange: function(selectedDates) {
        if (selectedDates.length === 2) {
            const formatLocal = d => {
                const date = new Date(d.getTime());
                return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
            };

            document.getElementById("leave_start_date").value = formatLocal(selectedDates[0]);
            document.getElementById("leave_end_date").value = formatLocal(selectedDates[1]);
            const editingId = document.getElementById("leaveId").value || null;

            calculateUsedDays(editingId);
        }
    }
});

// ========================
// 📌 Leave Type Change Event
document.getElementById("leave_type_select").addEventListener("change", function() {
    const leaveTypeId = this.value;
    const leaveType = allLeaveTypes.find(t => t.id == leaveTypeId);
    const group = leaveType ? getLeaveGroup(leaveType.name) : null;

    if (group === "ბიულეტენი") {
        picker.set("minDate", null);
    } else {
        picker.set("minDate", "today");
    }
});

// ========================
// Load Personal Info
async function loadPersonalInfo() {
    try {
        const res = await fetch(`${API_URL}/client/me`, { headers: { "Authorization": "Bearer " + token } });
        const user = await res.json();
        ["userId", "personal_id", "first_name", "last_name", "date_of_birth", "position_name", "start_date", "leave_days", "unpaid_leave_days", "sick_leave_days"]
        .forEach(id => { if (document.getElementById(id)) document.getElementById(id).value = user[id] || ""; });
        totalLeave = parseFloat(user.leave_days) || 0;
        usedPaidLeave = parseFloat(user.used_paid_leave_days) || 0;
        usedUnpaidLeave = parseFloat(user.used_unpaid_leave_days) || 0;
        usedBulletin = parseFloat(user.used_bulletin_days) || 0;
        // როცა მონაცემებს ტვირთავ:
        document.getElementById("full_name").value = `${user.last_name} ${user.first_name}`;

        calculateRemainingLeave();
    } catch (err) { console.error(err); }
}

// ========================
// Load Holidays
async function loadHolidays() {
    try {
        const res = await fetch(`${API_URL}/holidays`, { headers: { "Authorization": "Bearer " + token } });
        allHolidays = await res.json();
        const tbody = document.querySelector("#holidaysTable tbody");
        if (tbody) tbody.innerHTML = allHolidays.map(h => `<tr><td>${h.date}</td><td>${h.name}</td></tr>`).join("");
    } catch (err) { console.error(err); }
}

// ========================
// Check overlap
function checkDateOverlap(startDate, endDate, editingId = null) {
    return allLeaves.some(l => {
        if (l.status === "უარყოფილი") return false;
        if (editingId && l.id == editingId) return false;
        const s = new Date(l.start_date),
            e = l.end_date ? new Date(l.end_date) : s;
        return (startDate >= s && startDate <= e) ||
            (endDate >= s && endDate <= e) ||
            (startDate <= s && endDate >= e);
    });
}

// ========================
// Calculate Remaining Leave

function calculateRemainingLeave(editingId = null) {
    const leaveTypeSelect = document.getElementById("leave_type_select");
    const leaveTypeId = leaveTypeSelect.value;
    let leaveBalance = totalLeave,
        usedLeaveDays = usedPaidLeave;
    const leaveType = allLeaveTypes.find(t => t.id == leaveTypeId);
    const group = leaveType ? getLeaveGroup(leaveType.name) : "ფასიანი";

    switch (group) {
        case "უფასო":
            leaveBalance = parseFloat(document.getElementById("unpaid_leave_days").value) || 0;
            usedLeaveDays = usedUnpaidLeave;
            break;
        case "ბიულეტენი":
            leaveBalance = parseFloat(document.getElementById("sick_leave_days").value) || 0;
            usedLeaveDays = usedBulletin;
            break;
        case "დეკრეტი":
            // ✅ დეკრეტისთვის ფიქსირებული დღეები
            if (leaveType && leaveType.name === "დეკრეტი 126") leaveBalance = 126;
            else if (leaveType && leaveType.name === "დეკრეტი 143") leaveBalance = 143;
            else if (leaveType && leaveType.name === "დეკრეტი 604") leaveBalance = 604;
            else leaveBalance = 0;
            usedLeaveDays = 0; // დეკრეტის გამოყენებული დღეები ცალკე არ ითვლება
            break;
        default:
            leaveBalance = totalLeave;
            usedLeaveDays = usedPaidLeave;
    }

    const newUsedDays = parseFloat(document.getElementById("used_days").value) || 0;
    let sumOtherLeaves = 0;

    allLeaves.forEach(l => {
        if (editingId && l.id == editingId) return;
        if (!["მოლოდინში", "რედაქტირებული"].includes(l.status)) return;
        const lType = allLeaveTypes.find(t => t.id == l.leave_type_id);
        if (!lType) return;
        if (getLeaveGroup(lType.name) !== group) return;
        sumOtherLeaves += parseFloat(l.used_days || 0);
    });

    let remaining = leaveBalance - newUsedDays - sumOtherLeaves;

    if (editingId) {
        const editingLeave = allLeaves.find(l => l.id == editingId);
        if (editingLeave) {
            const oldUsed = parseFloat(editingLeave.used_days || 0);
            const today = new Date();
            const startDateOld = new Date(editingLeave.start_date);
            const endDateOld = editingLeave.end_date ? new Date(editingLeave.end_date) : startDateOld;
            const currentStatusUI = today < startDateOld ? "გასასვლელი" : (today >= startDateOld && today <= endDateOld ? "აქტიური" : "დასრულებული");

            if (editingLeave.status === "აქტიური") {
                remaining = leaveBalance + oldUsed - sumOtherLeaves - newUsedDays;
            }
        }
    }

    displayRemainingLeave(remaining);

    const saveBtn = document.getElementById("saveLeaveBtn");
    if (saveBtn) {
        saveBtn.disabled = remaining < 0;
        saveBtn.classList.toggle("opacity-50", remaining < 0);
        saveBtn.classList.toggle("cursor-not-allowed", remaining < 0);
    }
}


// ========================
// Display Remaining
function displayRemainingLeave(value) {
    const el = document.getElementById("remaining_days");
    if (el) el.textContent = value;
    if (value < 0) {
        showAlert("მოთხოვნილი შვებულება აჭარბებს დარჩენილ დღეებს!");
        document.getElementById("leave_start_date").value = "";
        document.getElementById("leave_end_date").value = "";
        document.getElementById("used_days").value = "";
        if (el) el.textContent = 0;
    }
}


// ========================
// Calculate Used Days
function calculateUsedDays(editingLeaveId = null) {
    const start = document.getElementById("leave_start_date").value;
    const end = document.getElementById("leave_end_date").value;

    if (!start) {
        document.getElementById("used_days").value = "";
        document.getElementById("used_holidays").textContent = "";
        calculateRemainingLeave(editingLeaveId);
        return;
    }

    const startDate = new Date(start);
    const endDateObj = end ? new Date(end) : startDate;


    // ✅ ჯერ leaveType და group გამოვთვალოთ
    const leaveType = allLeaveTypes.find(
        t => t.id == document.getElementById("leave_type_select").value
    );
    const group = leaveType ? getLeaveGroup(leaveType.name) : "ფასიანი";
    const position = document.getElementById("position_name").value || "";

    if (group !== "ბიულეტენი" && checkDateOverlap(startDate, endDateObj, editingLeaveId)) {
        showAlert("ამ თარიღებში უკვე არსებობს სხვა მოთხოვნა!");
        document.getElementById("leave_start_date").value = "";
        document.getElementById("leave_end_date").value = "";
        document.getElementById("used_days").value = "";
        return;
    }



    let usedDays = 0;
    let current = new Date(startDate);

    // ⬅️ ახალი ლოგიკა: მოლარე დღე-ღამის სპეციფიკური დათვლა

    const holidaysInRange = []; // ✅ აქ ვქმნით სიას არდადეგებისთვის

    while (current <= endDateObj) {
        const day = current.getDay();
        const formatted = current.toISOString().split("T")[0];

        const holiday = allHolidays.find(h => h.date === formatted);
        if (holiday) holidaysInRange.push(`${formatted} ${holiday.name}`); // ✅ არდადეგის შეტანა სიაში

        const isLockedByOtherLeave = allLeaves.some(l => {
            if (editingLeaveId && l.id == editingLeaveId) return false;
            if (l.status === "უარყოფილი") return false;
            const s = new Date(l.start_date),
                e = l.end_date ? new Date(l.end_date) : s;
            return current >= s && current <= e;
        });

        // ✅ ახალი პირობები მოლარისთვის
        if (position === "მოლარე დღე-ღამის" && (group === "ფასიანი" || group === "უფასო")) {
            const year = formatted.substring(0, 4); // პირველი 4 სიმბოლო ანუ წელი
            if (formatted !== `${year}-01-01` && formatted !== `${year}-01-02`) usedDays++;
        } else if (leaveType && (leaveType.name === "დეკრეტი 126" || leaveType.name === "დეკრეტი 143" || leaveType.name === "დეკრეტი 604")) {
            usedDays++;
        } else {
            // ჩვეულებრივი შვებულება
            if (!holiday && day !== 0 && !isLockedByOtherLeave) usedDays++;
        }
        current.setDate(current.getDate() + 1);
    }

    // ⬅️ ახალი alert: თუ მოლარის პირობაა, უნდა იყოს 3-ის ჯერადი
    // ⬅️ ახალი alert: თუ მოლარის პირობაა, უნდა იყოს 3-ის ჯერადი
    if (position === "მოლარე დღე-ღამის" && (group === "ფასიანი" || group === "უფასო")) {
        if (leaveType) {
            if (leaveType.name === "გათავისუფლება") {
                // ❌ მოლარე დღე-ღამისისთვის გათავისუფლება არ შეიძლება
                showAlert("მოლარე დღე-ღამის პოზიციისთვის გათავისუფლება არ არის დაშვებული.");
                usedDays = 0;
                document.getElementById("leave_start_date").value = "";
                document.getElementById("leave_end_date").value = "";
            } else if (leaveType.name === "დეიოფი") {
                const startInput = document.getElementById("leave_start_date");
                const endInput = document.getElementById("leave_end_date");
                const startDateObj = new Date(startInput.value);
                const endDateObj = new Date(endInput.value);

                if (!isNaN(startDateObj) && !isNaN(endDateObj)) {
                    const diffTime = endDateObj - startDateObj;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                    if (diffDays !== 3) {
                        showAlert("დეიოფი აუცილებლად უნდა იყოს 3 დღის პერიოდი!");
                        document.getElementById("leave_start_date").value = "";
                        document.getElementById("leave_end_date").value = "";
                        document.getElementById("used_days").value = "";
                        return;
                    } else {
                        usedDays = 3; // სწორად მონიშნულ პერიოდში
                    }
                }
            } else {
                // ❗ ჩვეულებრივი შვებულება უნდა იყოს 3-ის ჯერადი
                if (usedDays % 3 !== 0) {
                    showAlert("თქვენ არასწორად მიუთითეთ პერიოდი");
                    usedDays = 0;
                    document.getElementById("leave_start_date").value = "";
                    document.getElementById("leave_end_date").value = "";
                }
            }
        }
    } else if (leaveType && (leaveType.name === "გათავისუფლება" || leaveType.name === "დეიოფი")) {
        const startInput = document.getElementById("leave_start_date");
        const endInput = document.getElementById("leave_end_date");
        const startDateObj = new Date(startInput.value);
        const endDateObj = new Date(endInput.value);

        if (!isNaN(startDateObj)) {
            // მომხმარებელმა ერთი დღე უნდა მონიშნოს
            const diffDays = endDateObj ? Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1 : 1;

            if (diffDays !== 1) {
                showAlert(leaveType.name === "დეიოფი" ?
                    "დეიოფი აუცილებლად უნდა იყოს 1 დღის პერიოდი!" :
                    "გათავისუფლება აუცილებლად უნდა იყოს 1 დღის პერიოდი!");
                startInput.value = "";
                endInput.value = "";
                document.getElementById("used_days").value = "";
                return;
            }

            // usedDays განსაზღვრა: დეიოფი = 1, გათავისუფლება = 0.5
            usedDays = leaveType.name === "გათავისუფლება" ? 0.5 : 1;

            // დასასრული = დაწყების თარიღი
            endInput.value = startInput.value;
        }
        // **თუ კვირა ან არდადეგია, usedDays = 0**
        const day = startDate.getDay(); // 0 = კვირა
        const formatted = startDate.toISOString().split("T")[0];
        const isHoliday = allHolidays.some(h => h.date === formatted);

        if (day === 0 || isHoliday) usedDays = 0;

    }

    document.getElementById("used_days").value = usedDays;

    // არდადეგების გამოტანა
    document.getElementById("used_holidays").textContent = holidaysInRange.length ? holidaysInRange.join(", ") : "-";

    calculateRemainingLeave(editingLeaveId);
}



// ========================
// Clear Form
function clearLeaveForm() {
    document.getElementById("leaveForm").reset();
    ["leave_start_date", "leave_end_date", "used_days", "leaveId"].forEach(id => { if (document.getElementById(id)) document.getElementById(id).value = ""; });
    displayRemainingLeave(totalLeave);
    calculateRemainingLeave();

    // Reset lockedDates
    lockedDates = [];
    allLeaves.forEach(l => {
        if (l.status === "უარყოფილი") return;
        const s = new Date(l.start_date),
            e = l.end_date ? new Date(l.end_date) : s;
        let cur = new Date(s);
        while (cur <= e) {
            lockedDates.push(cur.toISOString().split("T")[0]);
            cur.setDate(cur.getDate() + 1);
        }
    });
    if (picker) picker.clear();
    if (picker) picker.set('disable', lockedDates);
}

// ========================
// Submit Form
async function submitLeaveForm() {
    const id = document.getElementById("leaveId").value;
    const start = document.getElementById("leave_start_date").value;
    const end = document.getElementById("leave_end_date").value;
    const used_days = parseFloat(document.getElementById("used_days").value);
    const comment = document.getElementById("comment").value;
    const leave_type_id = document.getElementById("leave_type_select").value;
    const remaining_days = parseFloat(document.getElementById("remaining_days").textContent);

    if (remaining_days < 0) return showAlert("დარჩენილი დღეები ნულზე ნაკლებია!");

    const leaveType = allLeaveTypes.find(t => t.id == leave_type_id);
    const group = leaveType ? getLeaveGroup(leaveType.name) : "ფასიანი";

    // დეკრეტის შემთხვევაში არ ვამოწმებთ remaining_days-ს
    if (group !== "დეკრეტი" && parseFloat(document.getElementById("remaining_days").textContent) < 0) {
        return showAlert("დარჩენილი დღეები ნულზე ნაკლებია!");
    }


    const body = { start_date: start, end_date: end, used_days, comment, leave_type_id };

    // ========================
    // ACTIVITY: Only for editing ACTIVE leaves
    if (id) { // რედაქტირება
        const editingLeave = allLeaves.find(l => l.id == id);
        if (editingLeave && editingLeave.status === "აქტიური") {
            // არსებული users.xxx ველები
            const leave_days = parseFloat(document.getElementById("leave_days").value) || 0;
            const unpaid_leave_days = parseFloat(document.getElementById("unpaid_leave_days").value) || 0;
            const sick_leave_days = parseFloat(document.getElementById("sick_leave_days").value) || 0;

            // რედაქტირებამდე used_days
            const oldUsedDays = parseFloat(editingLeave.used_days || 0);

            // განახლებული მნიშვნელობები – ყველა ტიპის სწორი გაგზავნა
            const editingLeaveType = allLeaveTypes.find(t => t.name === editingLeave.leave_type);
            const group = editingLeaveType ? getLeaveGroup(editingLeave.leave_type) : "ფასიანი";

            switch (group) {
                case "ფასიანი":
                    body.leave_days = leave_days - oldUsedDays + used_days;
                    break;
                case "უფასო":
                    body.unpaid_leave_days = unpaid_leave_days - oldUsedDays + used_days;
                    break;
                case "ბიულეტენი":
                    body.sick_leave_days = sick_leave_days - oldUsedDays + used_days;
                    break;
            }

            // დეიოფი და გათავისუფლება – ასევე აქ if აუცილებელია
            if (editingLeaveType && (editingLeaveType.name === "დეიოფი" || editingLeaveType.name === "გათავისუფლება")) {
                // დეიოფი = 1, გათავისუფლება = 0.5
                const delta = editingLeaveType.name === "გათავისუფლება" ? 0.5 : 1;
                if (group === "ფასიანი") {
                    body.leave_days = leave_days - oldUsedDays + delta;
                }
                // დასასრული = დაწყების თარიღი
                body.end_date = start;
            }
        }
    }
    // ========================


    // API-სთვის ფორმატის შედგენა
    const payload = {
        leave_type_id,
        start_date: start,
        end_date: end,
        used_days,
        comment
    };


    const url = id ? `${API_URL}/client/leave-requests/${id}` : `${API_URL}/client/leave-requests`;
    const method = id ? "PUT" : "POST";

    try {
        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) return showAlert(data.message || "შეცდომა მოხდა");
        await loadPersonalInfo();
        await loadLeaves();
        clearLeaveForm();
    } catch (err) {
        console.error(err);
        showAlert("შეცდომა მოხდა, სცადეთ თავიდან");
    }
}



// ========================
// Load Leaves
async function loadLeaves() {
    try {
        const res = await fetch(`${API_URL}/client/leave-requests`, { headers: { "Authorization": "Bearer " + token } });
        allLeaves = await res.json();

        const tables = {
            "ფასიანი": document.querySelector("#paidLeavesTable tbody"),
            "უფასო": document.querySelector("#unpaidLeavesTable tbody"),
            "ბიულეტენი": document.querySelector("#bulletinTable tbody"),
            "დეკრეტი": document.querySelector("#dekretTable tbody")
        };

        Object.values(tables).forEach(t => t.innerHTML = "");
        const today = new Date();
        allLeaves.forEach(l => {
            const startDate = new Date(l.start_date),
                endDate = l.end_date ? new Date(l.end_date) : startDate;
            const currentStatus = today < startDate ? "გასასვლელი" : (today >= startDate && today <= endDate ? "მიმდინარე" : "დასრულებული");
            const canEdit = currentStatus === "გასასვლელი" || (l.leave_group === "დეკრეტი" && currentStatus === "მიმდინარე");
            // ✅ ახალი კოდი: სტატუსის ფერი
            let statusColor = "";
            switch (l.status) {
                case "მოლოდინში":
                case "რედაქტირებული":
                    rowColor = "background-color:#fff3cd; color:#856404;"; // ყვითელი
                    break;
                case "აქტიური":
                    rowColor = "background-color:#d4edda; color:#155724;"; // მწვანე
                    break;
                case "უარყოფილი":
                    rowColor = "background-color:#f8d7da; color:#721c24;"; // წითელი
                    break;
                default:
                    rowColor = "";
            }

            // ✅ მხოლოდ canEdit-ის მიხედვით ღილაკის დამატება
            const editButton = canEdit ? `<button class="btn btn-edit" onclick="editLeave(${l.id})">რედაქტირება</button>` : "";



            const tr = `
                    
                    <tr data-leave-type-id="${l.leave_type_id}" style="${rowColor}">
                        <td>${l.leave_type||"-"}</td>
                        <td>${formatDateFull(l.start_date)}</td>
                        <td>${formatDateFull(l.end_date)||""}</td>
                        <td>${l.used_days}</td>
                        <td style="${statusColor}">${l.status}</td>
                        <td>${currentStatus}</td>
                        <td>${l.comment||""}</td>
                        <td>${formatDateTime(l.created_at)}</td>
                        <td>${formatDateTime(l.updated_at)}</td>
                        <td>${editButton}</td>
                    </tr>
                    `;


            switch (l.leave_group) {
                case "ფასიანი":
                    tables["ფასიანი"].innerHTML += tr;
                    break;
                case "უფასო":
                    tables["უფასო"].innerHTML += tr;
                    break;
                case "ბიულეტენი":
                    tables["ბიულეტენი"].innerHTML += tr;
                    break;
                case "დეკრეტი": // ✅ ახალი დამატება

                    tables["დეკრეტი"].innerHTML += tr;
                    break;
                default:

            }



        });
        // 🔹 რიცხვის ავტომატური განახლება ყველა ცხრილისთვის
        ["paidLeavesTable", "unpaidLeavesTable", "bulletinTable", "dekretTable"].forEach(updateRowNumbers);

        calculateRemainingLeave();
    } catch (err) { console.error(err); }
}


// ✅ updateRowNumbers ფუნქცია, რომ row-number ყველა ცხრილში დალაგდეს
function updateRowNumbers(tableId) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    Array.from(tbody.querySelectorAll("tr")).forEach((tr, i) => {
        const td = tr.querySelector(".row-number");
        if (td) td.textContent = i + 1;
    });
}
// ========================
// Edit Leave
async function editLeave(id) {
    leaveModal.style.display = "block";
    //const tr = btn.closest("tr");
    // const leaveId = tr.querySelector("td").textContent;
    const leave = allLeaves.find(l => l.id == id);
    if (!leave) {
        return;
    }

    // დროებით ამოვიღოთ რედაქტირებადი leave-ს დღეები
    lockedDates = allLeaves
        .filter(l => l.id != leave.id && l.status != "უარყოფილი")
        .flatMap(l => {
            const s = new Date(l.start_date);
            const e = l.end_date ? new Date(l.end_date) : s;
            const dates = [];
            let cur = new Date(s);
            while (cur <= e) {
                dates.push(cur.toISOString().split("T")[0]);
                cur.setDate(cur.getDate() + 1);
            }
            return dates;
        });

    document.getElementById("leaveId").value = leave.id;
    document.getElementById("leave_type_select").value = leave.leave_type_id;
    document.getElementById("leave_start_date").value = formatDateFull(leave.start_date);
    document.getElementById("leave_end_date").value = formatDateFull(leave.end_date);
    document.getElementById("used_days").value = leave.used_days;
    document.getElementById("comment").value = leave.comment || "";

    if (picker) {
        picker.set('disable', lockedDates);
        picker.setDate([formatDateFull(leave.start_date), formatDateFull(leave.end_date)], true, "Y-m-d");
    }

    calculateUsedDays(leave.id);
}

// ========================
// Load Leave Types
async function loadLeaveTypes() {
    try {
        const res = await fetch(`${API_URL}/client/leave-types`, { headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" } });
        if (!res.ok) { console.error(await res.text()); return; }
        const types = await res.json();
        allLeaveTypes = types.map(t => ({ id: t.id, name: t.name, description: t.description }));
        const tbody = document.querySelector("#leaveTypesTable tbody");
        if (tbody) tbody.innerHTML = allLeaveTypes.map(t => `<tr><td>${t.name}</td><td>${t.description||""}</td></tr>`).join("");
        const select = document.getElementById("leave_type_select");
        if (select) select.innerHTML = `<option value="">აირჩიეთ ტიპი</option>` + allLeaveTypes.map(t => `<option value="${t.id}">${t.name}</option>`).join("");

    } catch (err) { console.error(err); }
}

// ========================
// Render Delays Table
// ========================
function renderDelays() {
    const tbody = document.querySelector("#delaysTable tbody");
    tbody.innerHTML = "";

    if (!delaysData || delaysData.length === 0) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="12" style="text-align:center">ჩანაწერები ვერ მოიძებნა</td>`;
        tbody.appendChild(tr);
        return;
    }

    delaysData.forEach((d, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="row-number"></td>
            <td>${d.work_date}</td>
            <td>${d.scheduled_start_time || ""}</td>
            <td>${d.check_in_time || ""}</td>
            <td>${d.late_minutes || 0}</td>
            <td>${d.scheduled_end_time || ""}</td>
            <td>${d.check_out_time || ""}</td>
            <td>${d.early_leave_minutes || 0}</td>
            <td>${d.comment || ""}</td>
            <td>${d.violation_notice ? "✔" : ""}</td>
            <td>${d.created_at || ""}</td>
            <td>${d.updated_at || ""}</td>
        `;
        tbody.appendChild(tr);
    });

    updateRowNumbers("delaysTable");
}

// ========================
// Load Delays from API
// ========================
async function loadDelays() {
    if (!token) {
        console.warn("❌ No auth token found");
        return;
    }

    try {
        const res = await fetch(`${API_URL}/delays/me`, {
            headers: { "Authorization": "Bearer " + token }
        });

        const text = await res.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (err) {
            console.error("❌ JSON parse error:", err);
            return;
        }

        if (data.error) {
            console.error("❌ Server returned error:", data.message);
            alert("დაგვიანებების წამოღება შეზღუდულია: " + data.message);
            return;
        }

        // შენახვა გლობალურ ცვლადში
        delaysData = data;

        // გამოიტანე HTML-ში
        renderDelays();

    } catch (err) {
        console.error("❌ Error loading delays:", err);
        alert("დაგვიანებების სია ვერ ჩაიტვირთა");
    }
}

// ========================
// Init
// ========================
document.addEventListener("DOMContentLoaded", () => {
    loadDelays();
});



// ========================
// Event listeners
document.getElementById("leave_start_date").addEventListener("change", () => calculateUsedDays(document.getElementById("leaveId").value));
document.getElementById("leave_end_date").addEventListener("change", () => calculateUsedDays(document.getElementById("leaveId").value));
document.getElementById("leave_type_select").addEventListener("change", () => calculateUsedDays(document.getElementById("leaveId").value));
document.querySelector("#leaveForm .btn-save").addEventListener("click", submitLeaveForm);
document.querySelector("#leaveForm .btn-clear").addEventListener("click", clearLeaveForm);

// ========================
// Initial Load
document.addEventListener("DOMContentLoaded", async() => {
    await loadLeaveTypes();
    await loadPersonalInfo();
    await loadHolidays();
    await loadLeaves();
    await fetchAndDisplayLeaveRequests();
});