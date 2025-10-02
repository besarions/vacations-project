// frontend/js/validator.js
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

// ========================
// Logout
// ========================
function logout() {
    localStorage.removeItem("token");
    window.location.href = "index.html";
}
document.getElementById("logoutBtn").addEventListener("click", logout);

// ========================
// Helpers
// ========================
function formatDateFull(d) {
    return d ? d.split("T")[0] : "";
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

// Validate 24h time format HH:MM
function validateTime24(value) {
    if (!value) return true;
    const pattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    return pattern.test(value);
}

// ========================
// Generic Fetch Loader
// ========================
async function fetchAndRender(url, renderFn, errorMsg) {
    try {
        const res = await fetch(url, {
            headers: { "Authorization": "Bearer " + token }
        });
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();
        renderFn(data);
    } catch (err) {
        console.error(`Error loading ${url}:`, err);
        alert(errorMsg);
    }
}

// ========================
// Clients
// ========================
function renderClients(filtered = null) {
    const data = filtered || clientsData;
    const tbody = document.querySelector("#clientsTable tbody");
    tbody.innerHTML = "";

    const start = (clientsPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = data.slice(start, end);

    pageItems.forEach(client => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="row-number"></td>
            <td>${client.personal_id}</td>
            <td>${client.last_name}</td>
            <td>${client.first_name}</td>
            <td>${formatDateFull(client.date_of_birth)}</td>
            <td>${client.position_name || ""}</td>
            <td>${formatDateFull(client.start_date)}</td>
            <td>${formatDateFull(client.end_date)}</td>
            <td>${client.leave_days || 0}</td>
            <td>${client.unpaid_leave_days || 0}</td>
            <td>${client.sick_leave_days || 0}</td>
            <td>${client.status}</td>
            <td>${formatDateTime(client.created_at)}</td>
            <td>${formatDateTime(client.updated_at)}</td>
            <td>
                <button onclick="openDelayForm('${client.personal_id}', '${client.last_name}', '${client.first_name}')">
                    დაგვიანების დამატება
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    updateRowNumbers("clientsTable", clientsPage);
    renderPagination("clientsPagination", data.length, clientsPage, (p) => {
        clientsPage = p;
        renderClients(filtered);
    });
}

async function loadClients() {
    await fetchAndRender(`${API_URL}/validator/clients`, data => {
        clientsData = data;
        renderClients();
    }, "კლიენტების სია ვერ ჩაიტვირთა");
}

// ========================
// Leaves
// ========================
function renderLeaves(filtered = null) {
    const data = filtered || leavesData;
    const tbody = document.querySelector("#leavesTable tbody");
    tbody.innerHTML = "";
    const today = new Date();

    const start = (leavesPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageItems = data.slice(start, end);

    pageItems.forEach(req => {
        let currentStatus = "";
        const startDate = new Date(req.start_date);
        const endDate = req.end_date ? new Date(req.end_date) : startDate;

        if (today < startDate) currentStatus = "გასასვლელი";
        else if (today >= startDate && today <= endDate) currentStatus = "მიმდინარე";
        else currentStatus = "დასრულებული";

        let rowClass = "";
        if (req.status === "აქტიური") rowClass = "status-active";
        else if (req.status === "უარყოფილი") rowClass = "status-rejected";
        else if (req.status === "მოლოდინში" || req.status === "რედაქტირებული")
            rowClass = "status-pending";

        let actionButtons = "";
        if (req.status !== "აქტიური" && req.status !== "უარყოფილი") {
            actionButtons = `
                <button onclick="updateLeave(${req.id}, 'აქტიური')">დადასტურება</button>
                <button onclick="updateLeave(${req.id}, 'უარყოფილი')">უარყოფა</button>
            `;
        }

        const tr = document.createElement("tr");
        tr.className = rowClass;
        tr.innerHTML = `
            <td class="row-number"></td>
            <td>${req.client_personal_id || ""}</td>
            <td>${req.client_last_name || ""}</td>
            <td>${req.client_first_name || ""}</td>
            <td>${formatDateFull(req.start_date)}</td>
            <td>${formatDateFull(req.end_date)}</td>
            <td>${req.used_days || 0}</td>
            <td>${req.leave_type_name || ""}</td>
            <td>${req.comment || ""}</td>
            <td>${req.status || ""}</td>
            <td>${currentStatus}</td>
            <td>${formatDateTime(req.created_at)}</td>
            <td>${formatDateTime(req.updated_at)}</td>
            <td>${actionButtons}</td>
        `;
        tbody.appendChild(tr);
    });

    updateRowNumbers("leavesTable", leavesPage);
    renderPagination("leavesPagination", data.length, leavesPage, (p) => {
        leavesPage = p;
        renderLeaves(filtered);
    });
}

async function loadLeaves() {
    await fetchAndRender(`${API_URL}/validator/leave-requests`, data => {
        leavesData = data;
        renderLeaves();
    }, "შვებულებების სია ვერ ჩაიტვირთა");
}

/* ======================== */
/* Positions                */
/* ======================== */
function renderPositionsWrapper(data) {
    const tbody = document.querySelector("#positionsTable tbody");
    tbody.innerHTML = "";
    data.forEach(pos => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="row-number"></td>
            <td>${pos.name}</td>
        `;
        tbody.appendChild(tr);
    });
    updateRowNumbers("positionsTable");
}

async function loadPositions() {
    await fetchAndRender(`${API_URL}/validator/positions`, renderPositionsWrapper, "პოზიციების სია ვერ ჩაიტვირთ");
}

/* ======================== */
/* Holidays                 */
/* ======================== */
function renderHolidaysWrapper(data) {
    const tbody = document.querySelector("#holidaysTable tbody");
    tbody.innerHTML = "";
    data.forEach((h, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="row-number">${i + 1}</td>
            <td>${formatDateFull(h.date)}</td>
            <td>${h.name}</td>
        `;
        tbody.appendChild(tr);
    });
}


async function loadHolidays() {
    await fetchAndRender(`${API_URL}/holidays`, renderHolidaysWrapper, "დღეების სია ვერ ჩაიტვირთა");
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

    pageItems.forEach(d => {
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
             <td>
                 <button onclick="editDelay(${d.id})">რედაქტირება</button>
             </td>
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
    await fetchAndRender(`${API_URL}/delays`, data => {
        delaysData = data;
        renderDelays();
    }, "დაგვიანებების სია ვერ ჩაიტვირთა");
}

function openDelayForm(personalId, lastName, firstName) {
    document.getElementById("delayForm").reset(); // ✅ ფორმის სრული გასუფთავება
    document.getElementById("delayPersonalId").value = personalId;
    document.getElementById("delayFullName").value = lastName + " " + firstName;
    document.getElementById("delayForm").removeAttribute("data-edit-id");
    const saveBtn = document.getElementById("saveBtn");
    if (saveBtn) saveBtn.textContent = "შენახვა";
    document.getElementById("delayModal").style.display = "flex";
}


function editDelay(id) {
    const delay = delaysData.find(d => d.id === id);
    if (!delay) return alert("ჩანაწერი ვერ მოიძებნა!");

    document.getElementById("delayForm").reset(); // ✅ ფორმის გასუფთავება რედაქტირების წინ
    document.getElementById("delayPersonalId").value = delay.personal_id || "";
    document.getElementById("delayFullName").value = (delay.last_name || "") + " " + (delay.first_name || "");
    document.getElementById("work_date").value = delay.work_date || "";
    document.getElementById("scheduled_start_time").value = delay.scheduled_start_time || "";
    document.getElementById("check_in_time").value = delay.check_in_time || "";
    document.getElementById("scheduled_end_time").value = delay.scheduled_end_time || "";
    document.getElementById("check_out_time").value = delay.check_out_time || "";
    document.getElementById("comment").value = delay.comment || "";
    document.getElementById("violation_notice").checked = delay.violation_notice || false;

    document.getElementById("delayForm").setAttribute("data-edit-id", id);
    const saveBtn = document.getElementById("saveBtn");
    if (saveBtn) saveBtn.textContent = "რედაქტირება";
    document.getElementById("delayModal").style.display = "flex";
}

function closeDelayForm() {
    document.getElementById("delayForm").reset(); // ✅ დახურვისასაც გასუფთავება
    document.getElementById("delayForm").removeAttribute("data-edit-id");
    const saveBtn = document.getElementById("saveBtn");
    if (saveBtn) saveBtn.textContent = "შენახვა";
    document.getElementById("delayModal").style.display = "none";
}

// ========================
// Submit Delay
// ========================
document.getElementById("delayForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    const personalId = document.getElementById("delayPersonalId").value;
    const client = clientsData.find(c => c.personal_id === personalId);
    if (!client) return alert("მომხმარებელი ვერ მოიძებნა!");

    const payload = {
        user_id: client.id,
        work_date: document.getElementById("work_date").value,
        scheduled_start_time: document.getElementById("scheduled_start_time").value,
        check_in_time: document.getElementById("check_in_time").value,
        scheduled_end_time: document.getElementById("scheduled_end_time").value,
        check_out_time: document.getElementById("check_out_time").value,
        comment: document.getElementById("comment").value,
        violation_notice: document.getElementById("violation_notice") && document.getElementById("violation_notice").checked
    };

    const editId = document.getElementById("delayForm").getAttribute("data-edit-id");

    try {
        let res = await fetch(
            editId ? `${API_URL}/delays/${editId}` : `${API_URL}/delays`, {
                method: editId ? "PUT" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + token
                },
                body: JSON.stringify(payload)
            }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || (editId ? "რედაქტირება ვერ შესრულდა" : "შეცდომა დამატებისას"));

        alert(editId ? "ჩანაწერი წარმატებით რედაქტირებულია ✅" : "ჩანაწერი წარმატებით დაემატა ✅");

        closeDelayForm();
        document.getElementById("delayForm").removeAttribute("data-edit-id");
        document.getElementById("saveBtn").textContent = "შენახვა";
        loadDelays();
    } catch (err) {
        console.error("Error saving delay:", err);
        alert(err.message || "სერვერთან კავშირი ვერ მოხერხდა");
    }
});


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

// ========================
// Filter Inputs
// ========================
const searchClients = document.getElementById("searchClients");
if (searchClients) {
    searchClients.addEventListener("input", function() {
        const filter = this.value.toLowerCase();
        clientsPage = 1;
        renderClients(clientsData.filter(c =>
            c.personal_id.toLowerCase().includes(filter) ||
            c.first_name.toLowerCase().includes(filter) ||
            c.last_name.toLowerCase().includes(filter)
        ));
    });
}

const searchLeaves = document.getElementById("searchLeaves");
if (searchLeaves) {
    searchLeaves.addEventListener("input", function() {
        const filter = this.value.toLowerCase();
        leavesPage = 1;
        renderLeaves(leavesData.filter(req =>
            req.client_personal_id.toLowerCase().includes(filter) ||
            req.client_first_name.toLowerCase().includes(filter) ||
            req.client_last_name.toLowerCase().includes(filter)
        ));
    });
}

const searchDelays = document.getElementById("searchDelays");
if (searchDelays) {
    searchDelays.addEventListener("input", function() {
        const filter = this.value.toLowerCase();
        delaysPage = 1;
        renderDelays(delaysData.filter(d =>
            (d.personal_id || "").toLowerCase().includes(filter) ||
            (d.first_name || "").toLowerCase().includes(filter) ||
            (d.last_name || "").toLowerCase().includes(filter)
        ));
    });
}


// ========================
// Approve / Reject Leave
// ========================
async function updateLeave(id, status) {
    const res = await fetch(`${API_URL}/validator/leave-requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message);
    reloadAll();
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

// ==========================
// Export Excel via Backend
// ==========================
async function downloadExcel(url, fileName) {
    try {
        const res = await fetch(url, {
            headers: { "Authorization": "Bearer " + token }
        });

        if (!res.ok) throw new Error(`HTTP error ${res.status}`);

        const blob = await res.blob();
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (err) {
        console.error("Excel download failed:", err);
        alert("Excel ფაილის გადმოწერა ვერ მოხერხდა!");
    }
}

// ==========================
// Buttons Event Listeners
// ==========================
const exportClientsBtn = document.getElementById("exportClientsBtn");
if (exportClientsBtn) {
    exportClientsBtn.addEventListener("click", () => {
        downloadExcel(`${API_URL}/export/export-clients`, "clients.xlsx");
    });
}

const exportLeavesBtn = document.getElementById("exportLeavesBtn");
if (exportLeavesBtn) {
    exportLeavesBtn.addEventListener("click", () => {
        downloadExcel(`${API_URL}/export/export-leaves`, "leaves.xlsx");
    });
}

const exportDelaysBtn = document.getElementById("exportDelaysBtn");
if (exportDelaysBtn) {
    exportDelaysBtn.addEventListener("click", () => {
        downloadExcel(`${API_URL}/export/export-delays`, "delays.xlsx");
    });
}





// ========================
// Reload All
// ========================
async function reloadAll() {
    await loadClients();
    await loadLeaves();
    await loadDelays();
    await loadPositions();
    await loadHolidays();
}

// ========================
// Init
// ========================
reloadAll();