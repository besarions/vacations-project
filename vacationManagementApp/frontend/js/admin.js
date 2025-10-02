//frontend/js/admin.js
const API_URL = "http://192.168.41.101:5000/api";
const token = localStorage.getItem("token");

// ========================
// Pagination Config
// ========================
let clientsData = [];
let leavesData = [];
let delaysData = [];

let clientsPage = 1;
let leavesPage = 1;
let delaysPage = 1;

const PAGE_SIZE = 15;

/* Helpers */
function formatDateFull(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
}

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

////მოდალი თანამშრომლის დამატება
const clientModal = document.getElementById("clientModal");
clientModal.style.display = "none";
const clientForm = document.querySelector("#clientForm");

function openClientModal() {
    clientModal.style.display = "block";
    clearForm()
    document.getElementById("password").style.display = "block";
}

function closeClientModal() {
    clientModal.style.display = "none";
}
////მოდალი თანამსრომლის სიის დამატება
const clientsDataModal = document.getElementById("clientsDataModal");
clientsDataModal.style.display = "none";
const clientsDataForm = document.querySelector("#clientsDataForm");

function openClientsDataModal() {
    clientsDataModal.style.display = "block";
    clearForm()
    document.getElementById("password").style.display = "block";
}

function closeClientsDataModal() {
    clientsDataModal.style.display = "none";
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

/* ======================== */
/* USERS */
async function loadUsers() {
    const res = await fetch(`${API_URL}/admin/users`, { headers: { "Authorization": "Bearer " + token } });
    const users = await res.json();
    const tbody = document.querySelector("#usersTable tbody");
    tbody.innerHTML = "";

    clientsData = users;

    const start = (clientsPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = users.slice(start, end);

    pageItems.forEach(user => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="row-number"></td>
            <td>${user.personal_id}</td>
            <td>${user.last_name}</td>
            <td>${user.first_name}</td>
            <td>${formatDateFull(user.date_of_birth)}</td>
            <td>${user.position_name || ''}</td>
            <td>${formatDateFull(user.start_date)}</td>
            <td>${formatDateFull(user.end_date)}</td>
            <td>${user.leave_days != null ? Number(user.leave_days).toFixed(2) : '0.00'}</td>
            <td>${user.unpaid_leave_days || 0}</td>
            <td>${user.sick_leave_days || 0}</td>
            <td>${user.status}</td>
            <td>${user.role}</td>
            <td>${formatDateTime(user.created_at)}</td>
            <td>${formatDateTime(user.updated_at)}</td>
            <td>
                <button onclick="editUser(${user.id})">შეცვლა</button>
                <button onclick="deleteUser(${user.id})">წაშლა</button>
                <button onclick="openPasswordModal(${user.id})">პაროლის შეცვლა</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    updateRowNumbers("usersTable", clientsPage); // ყველა გვერდისთვის დანომვრა
    renderPagination("usersPagination", users.length, clientsPage, (p) => {
        clientsPage = p;
        loadUsers();
    });
}

function editUser(id) {
    clientModal.style.display = "block";
    document.getElementById("password").style.display = "none"
    fetch(`${API_URL}/admin/users/${id}`, { headers: { "Authorization": "Bearer " + token } })
        .then(res => res.json())
        .then(user => {
            document.getElementById("userId").value = user.id;
            document.getElementById("personal_id").value = user.personal_id || "";
            document.getElementById("last_name").value = user.last_name || "";
            document.getElementById("first_name").value = user.first_name || "";
            document.getElementById("password").value = user.password || "";
            document.getElementById("date_of_birth").value = formatDateFull(user.date_of_birth);
            document.getElementById("position_id").value = user.position_id || "";
            document.getElementById("start_date").value = formatDateFull(user.start_date);
            document.getElementById("end_date").value = formatDateFull(user.end_date);
            document.getElementById("leave_days").value = user.leave_days != null ? Number(user.leave_days).toFixed(2) : "0.00";
            document.getElementById("unpaid_leave_days").value = user.unpaid_leave_days != null ? parseInt(user.unpaid_leave_days) : 0;
            document.getElementById("sick_leave_days").value = user.sick_leave_days != null ? parseInt(user.sick_leave_days) : 0;
            document.getElementById("status").value = user.status;
            document.getElementById("role").value = user.role;
        });
}

async function deleteUser(id) {
    if (!confirm("წაშლა კლიენტი?")) return;
    const res = await fetch(`${API_URL}/admin/users/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
    if (res.ok) loadUsers();
}

document.getElementById("userForm").addEventListener("submit", async e => {
    e.preventDefault();
    const id = document.getElementById("userId").value;
    const data = {
        personal_id: document.getElementById("personal_id").value,
        last_name: document.getElementById("last_name").value,
        first_name: document.getElementById("first_name").value,
        password: document.getElementById("password").value,
        date_of_birth: document.getElementById("date_of_birth").value,
        position_id: document.getElementById("position_id").value,
        start_date: document.getElementById("start_date").value,
        end_date: document.getElementById("end_date").value || null,
        leave_days: parseFloat(document.getElementById("leave_days").value) || 0.00,
        unpaid_leave_days: parseInt(document.getElementById("unpaid_leave_days").value) || 0,
        sick_leave_days: parseInt(document.getElementById("sick_leave_days").value) || 0,
        status: document.getElementById("status").value,
        role: document.getElementById("role").value
    };
    const res = await fetch(`${API_URL}/admin/users${id ? "/" + id : ""}`, {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify(data)
    });
    if (res.ok) {
        e.target.reset();
        document.getElementById("userId").value = "";
        loadUsers();
    }
    clientModal.style.display = "none";
});

function clearForm() {
    document.getElementById("userForm").reset();
    document.getElementById("userId").value = "";
}

/* ======================== */
/* password modal */
document.getElementById("passwordModal").style.display = "none";

function openPasswordModal(userId) {
    document.getElementById("passwordUserId").value = userId;
    document.getElementById("passwordModal").style.display = "block";
}

function closePasswordModal() {
    document.getElementById("passwordModal").style.display = "none";
}

document.getElementById("passwordForm").addEventListener("submit", async e => {
    e.preventDefault();
    const userId = document.getElementById("passwordUserId").value;
    const newPassword = document.getElementById("newPassword").value;

    const res = await fetch(`${API_URL}/admin/users/${userId}/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ password: newPassword })
    });

    if (res.ok) {
        alert("პაროლი წარმატებით შეიცვალა");
        closePasswordModal();
        document.getElementById("passwordForm").reset();
    } else {
        alert("პაროლის შეცვლის შეცდომა");
    }
});


/* ======================== */
/* POSITIONS */
async function loadPositions() {
    const res = await fetch(`${API_URL}/admin/positions`, { headers: { "Authorization": "Bearer " + token } });
    const positions = await res.json();
    const tbody = document.querySelector("#positionsTable tbody");
    const select = document.getElementById("position_id");
    tbody.innerHTML = "";
    select.innerHTML = "";
    positions.forEach(pos => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${pos.id}</td><td>${pos.name}</td><td>
            <button onclick="editPosition(${pos.id}, '${pos.name}')">შეცვლა</button>
            <button onclick="deletePosition(${pos.id})">წაშლა</button>
        </td>`;
        tbody.appendChild(tr);
        const option = document.createElement("option");
        option.value = pos.id;
        option.textContent = pos.name;
        select.appendChild(option);
    });
}

function editPosition(id, name) {
    document.getElementById("positionId").value = id;
    document.getElementById("positionName").value = name;
}

async function deletePosition(id) {
    if (!confirm("წაშლა პოზიცია?")) return;
    const res = await fetch(`${API_URL}/admin/positions/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
    if (res.ok) loadPositions();
}

document.getElementById("positionForm").addEventListener("submit", async e => {
    e.preventDefault();
    const id = document.getElementById("positionId").value;
    const data = { name: document.getElementById("positionName").value };
    const res = await fetch(`${API_URL}/admin/positions${id ? "/" + id : ""}`, {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify(data)
    });
    if (res.ok) {
        e.target.reset();
        document.getElementById("positionId").value = "";
        loadPositions();
    }
});

/* ======================== */
/* HOLIDAYS */
async function loadHolidays() {
    const res = await fetch(`${API_URL}/holidays`, { headers: { "Authorization": "Bearer " + token } });
    const holidays = await res.json();
    const tbody = document.querySelector("#holidaysTable tbody");
    tbody.innerHTML = "";

    const start = (leavesPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = holidays.slice(start, end);

    pageItems.forEach(h => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="row-number"></td>
            <td>${h.date}</td>
            <td>${h.name}</td>
            <td>
                <button onclick="editHoliday(${h.id},'${h.date}','${h.name}')">შეცვლა</button>
                <button onclick="deleteHoliday(${h.id})">წაშლა</button>
            </td>`;
        tbody.appendChild(tr);
    });

    updateRowNumbers("holidaysTable", leavesPage);
    renderPagination("holidaysPagination", holidays.length, leavesPage, (p) => {
        leavesPage = p;
        loadHolidays();
    });
}

function editHoliday(id, date, name) {
    document.getElementById("holidayId").value = id;
    document.getElementById("holidayDate").value = date;
    document.getElementById("holidayName").value = name;
}

function clearHolidayForm() {
    document.getElementById("holidayForm").reset();
    document.getElementById("holidayId").value = "";
}

document.getElementById("holidayForm").addEventListener("submit", async e => {
    e.preventDefault();
    const id = document.getElementById("holidayId").value;
    const date = document.getElementById("holidayDate").value;
    const name = document.getElementById("holidayName").value;
    const data = { date, name };
    const res = await fetch(`${API_URL}/holidays${id ? "/" + id : ""}`, {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify(data)
    });
    if (res.ok) {
        clearHolidayForm();
        loadHolidays();
    }
});

/* ======================== */
/* LEAVE REQUESTS */
async function loadRequests() {
    const res = await fetch(`${API_URL}/admin/leave-requests`, { headers: { "Authorization": "Bearer " + token } });
    const requests = await res.json();
    const tbody = document.querySelector("#requestsTable tbody");
    tbody.innerHTML = "";
    const today = new Date();

    leavesData = requests;

    const start = (leavesPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = requests.slice(start, end);

    pageItems.forEach(req => {
        const startDate = new Date(req.start_date);
        const endDate = req.end_date ? new Date(req.end_date) : startDate;
        const currentStatus = today < startDate ? "გასასვლელი" : (today <= endDate ? "მიმდინარე" : "დასრულებული");

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="row-number"></td>
            <td>${req.client_personal_id || ''}</td>
            <td>${req.client_last_name || ''}</td>
            <td>${req.client_first_name || ''}</td>
            <td>${req.start_date || ''}</td>
            <td>${req.end_date || ''}</td>
            <td>${req.used_days || 0}</td>
            <td>${req.comment || ''}</td>
            <td>${req.status || ''}</td>
            <td>${currentStatus}</td>
            <td>${formatDateTime(req.created_at)}</td>
            <td>${formatDateTime(req.updated_at)}</td>
            `;
        tbody.appendChild(tr);
    });

    updateRowNumbers("requestsTable", leavesPage);
    renderPagination("requestsPagination", requests.length, leavesPage, (p) => {
        leavesPage = p;
        loadRequests();
    });
}

// ========================
// Pagination & Filters
// ========================
function updateRowNumbers(tableId, currentPage = 1) {
    const rows = document.querySelectorAll(`#${tableId} tbody tr`);
    rows.forEach((tr, i) => {
        const td = tr.querySelector(".row-number");
        if (td) td.textContent = i + 1 + ((currentPage - 1) * PAGE_SIZE);
    });
}

function renderPagination(containerId, totalItems, currentPage, onPageChange) {
    let container = document.getElementById(containerId);
    if (!container) {
        container = document.createElement("div");
        container.id = containerId;
        container.className = "pagination";
        const tableId = containerId.replace("Pagination", "Table");
        document.getElementById(tableId).after(container);
    }

    const totalPages = Math.ceil(totalItems / PAGE_SIZE);
    container.innerHTML = "";

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement("button");
        btn.textContent = i;
        btn.className = (i === currentPage) ? "active" : "";
        btn.addEventListener("click", () => onPageChange(i));
        container.appendChild(btn);
    }
}

/* ======================== */
/* FILTERS */
["searchUsers", "searchPositions", "searchRequests", "searchHolidays", "searchDelays"].forEach(id => {
    document.getElementById(id).addEventListener("input", function() {
        const filter = this.value.toLowerCase();
        const tableId = id.replace("search", "").toLowerCase() + "Table";
        document.querySelectorAll(`#${tableId} tbody tr`).forEach(row => {
            const text = Array.from(row.cells).map(cell => cell.textContent.toLowerCase()).join(" ");
            row.style.display = text.includes(filter) ? "" : "none";
        });
    });
});


/* ======================== */
/* LOGOUT */
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "index.html";
});

/* ======================== */
/* LEAVE TYPES */
async function loadLeaveTypes() {
    try {
        const res = await fetch(`${API_URL}/admin/leave-types`, { headers: { "Authorization": "Bearer " + token } });
        if (!res.ok) throw new Error("Failed to fetch leave types");
        const types = await res.json();
        const tbody = document.querySelector("#leaveTypesTable tbody");
        tbody.innerHTML = "";
        types.forEach(t => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${t.id}</td>
                <td>${t.name}</td>
                <td>${t.description || ''}</td>
                <td>${t.is_active ? "აქტიური" : "არააქტიური"}</td>
                <td>
                    <button onclick="editLeaveType(${t.id},'${t.name.replace(/'/g, "\\'")}','${(t.description||"").replace(/'/g, "\\'")}','${t.is_active}')">შეცვლა</button>
                    <button onclick="deleteLeaveType(${t.id})">წაშლა</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
    }
}

function editLeaveType(id, name, description, is_active) {
    document.getElementById("leaveTypeId").value = id;
    document.getElementById("leaveTypeName").value = name;
    document.getElementById("leaveTypeDescription").value = description;
    document.getElementById("leaveTypeActive").checked = is_active == 1;
}

async function deleteLeaveType(id) {
    if (!confirm("წაშლა შვ. ტიპი?")) return;
    const res = await fetch(`${API_URL}/admin/leave-types/${id}`, { method: "DELETE", headers: { "Authorization": "Bearer " + token } });
    if (res.ok) loadLeaveTypes();
}

document.getElementById("leaveTypeForm").addEventListener("submit", async e => {
    e.preventDefault();
    const id = document.getElementById("leaveTypeId").value;
    const name = document.getElementById("leaveTypeName").value;
    const description = document.getElementById("leaveTypeDescription").value;
    const is_active = document.getElementById("leaveTypeActive").checked;

    const res = await fetch(`${API_URL}/admin/leave-types${id ? "/" + id : ""}`, {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ name, description, is_active })
    });

    if (res.ok) {
        clearLeaveTypeForm();
        loadLeaveTypes();
    }
});

function clearLeaveTypeForm() {
    document.getElementById("leaveTypeForm").reset();
    document.getElementById("leaveTypeId").value = "";
}

// ========================
// Delays
// ========================
function renderDelays(filtered = null) {
    const data = filtered || delaysData;
    const tbody = document.querySelector("#delaysTable tbody");
    tbody.innerHTML = "";

    const start = (delaysPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = data.slice(start, end);

    pageItems.forEach((d, index) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
             <td class="row-number"></td>
             <td>${d.personal_id || ""}</td>
             <td>${d.last_name || ""}</td>
             <td>${d.first_name || ""}</td>
             <td>${formatDateFull(d.work_date)}</td>
             <td>${d.scheduled_start_time || ""}</td>
             <td>${d.check_in_time || ""}</td>
             <td>${d.late_minutes || ""}</td>
             <td>${d.scheduled_end_time || ""}</td>
             <td>${d.check_out_time || ""}</td>
             <td>${d.early_leave_minutes || ""}</td>
             <td>${d.comment || ""}</td>
             <td>${d.violation_notice ? "✔" : ""}</td>
             <td>${formatDateTime(d.created_at)}</td>
             <td>${formatDateTime(d.updated_at)}</td>
        `;
        tbody.appendChild(tr);
    });

    updateRowNumbers("delaysTable", delaysPage);
    renderPagination("delaysPagination", data.length, delaysPage, (p) => {
        delaysPage = p;
        renderDelays(filtered);
    });
}

async function loadDelays() {
    try {
        const res = await fetch(`${API_URL}/delays`, {
            headers: {
                "Authorization": "Bearer " + token
            }
        });

        const text = await res.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (err) {
            console.error("❌ JSON parse error:", err);
            alert("დაგვიანებების სია ვერ ჩაიტვირთა (JSON error)");
            return;
        }

        if (data.error) {
            console.error("❌ Server returned error:", data.message);
            alert("დაგვიანებების წამოღება შეზღუდულია: " + data.message);
            return;
        }

        delaysData = data; // store globally
        renderDelays(); // render table

    } catch (err) {
        console.error("❌ Error loading delays:", err);
        alert("დაგვიანებების სია ვერ ჩაიტვირთა");
    }
}

//// CLIENT IMPORT MODAL
// Global variables
let previewData = [];
let existingPersonalIds = new Set();
const fileInput = document.getElementById("importClientsFile");
const previewTableBody = document.querySelector("#previewTable tbody");
const previewModal = document.getElementById("previewModal");
const previewBtn = document.getElementById("previewClientsBtn");
const commitBtn = document.getElementById("commitClientsBtn");
const closePreviewModalBtn = document.getElementById("closePreviewModal");

// Load existing clients from DB
async function loadExistingClients() {
    try {
        const res = await fetch(`${API_URL}/admin/users`, { headers: { "Authorization": "Bearer " + token } });
        const users = await res.json();
        existingPersonalIds = new Set(users.map(u => u.personal_id.toString()));
    } catch (err) {
        console.error("Failed to load existing clients:", err);
        existingPersonalIds = new Set();
    }
}

// Preview button
previewBtn.addEventListener("click", async() => {
    if (!fileInput.files.length) return alert("აირჩიე ფაილი!");
    previewModal.style.display = "block";
    previewTableBody.innerHTML = "<tr><td colspan='14'>ჩატვირთვა...</td></tr>";

    await loadExistingClients();

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    try {
        const res = await fetch(`${API_URL}/import/preview-clients`, {
            method: "POST",
            headers: { "Authorization": "Bearer " + token },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "პრევიუ ვერ მოიტანა");

        previewData = (data.preview || []).map(user => {
            const isDuplicate = existingPersonalIds.has(user.personal_id.toString());
            return {...user, isDuplicate };
        });

        // Populate table
        previewTableBody.innerHTML = "";
        if (!previewData.length) {
            previewTableBody.innerHTML = "<tr><td colspan='14'>პრევიუ ცარიელია</td></tr>";
        } else {
            previewData.forEach(user => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${user.personal_id || ""}</td>
                    <td>${user.last_name || ""}</td>
                    <td>${user.first_name || ""}</td>
                    <td>${user.passwordPlain || ""}</td>
                    <td>${user.date_of_birth || ""}</td>
                    <td>${user.position_id || ""}</td>
                    <td>${user.start_date || ""}</td>
                    <td>${user.end_date || ""}</td>
                    <td>${user.leave_days != null ? Number(user.leave_days).toFixed(2) : "0.00"}</td>
                    <td>${user.unpaid_leave_days || 0}</td>
                    <td>${user.sick_leave_days || 0}</td>
                    <td>${user.status || ""}</td>
                    <td>${user.role || ""}</td>
                    <td style="color:${user.isDuplicate ? 'orange' : ((user.errors && user.errors.length) ? 'red' : 'green')}">
                        ${user.isDuplicate ? 'დუბლიკატი ბაზაში' : (user.errors || []).join(", ")}
                    </td>
                `;
                previewTableBody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error("Preview failed:", err);
        previewTableBody.innerHTML = `<tr><td colspan="14" style="color:red;">პრევიუ ვერ მოიტანა: ${err.message}</td></tr>`;
    }
});

// Commit button
commitBtn.addEventListener("click", async() => {
    const toCommit = previewData.filter(u => !u.isDuplicate);
    if (!toCommit.length) return alert("პრევიუ ცარიელია ან ყველა ჩანაწერი დუბლიკატია!");

    try {
        const res = await fetch(`${API_URL}/import/commit-clients`, {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ clients: toCommit })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "იმპორტი ვერ შესრულდა");

        alert("კლიენტები წარმატებით იმპორტირდა!");
        previewModal.style.display = "none";
        previewTableBody.innerHTML = "";

        // აქ დაიწეროს სია დაუყოვნებლივ განახლდეს
        await loadUsers();

    } catch (err) {
        console.error("Commit failed:", err);
        alert("პრობლემა იმპორტის დროს: " + err.message);
    }
});


// Close modal
closePreviewModalBtn.addEventListener("click", () => {
    previewModal.style.display = "none";
});



// ========================
// Reload All
// ========================
async function reloadAll() {
    await loadUsers();
    await loadPositions();
    await loadHolidays();
    await loadRequests();
    await loadLeaveTypes();
    await loadDelays();
}

// ========================
// Init
// ========================
reloadAll();