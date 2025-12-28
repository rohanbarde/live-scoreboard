// Initialize Firebase
let database;
let referees = [];
let filteredReferees = [];

// DOM Elements
const refereesTableBody = document.getElementById('refereesTableBody');
const searchBox = document.querySelector('.search-box');
const searchInput = document.getElementById('searchInput');
const printButton = document.getElementById('printButton');
const totalRefereesEl = document.getElementById('totalReferees');
const verifiedRefereesEl = document.getElementById('verifiedReferees');
const pendingRefereesEl = document.getElementById('pendingReferees');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Firebase
    try {
        const firebaseConfig = window.firebaseConfig;
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        database = firebase.database();
        
        // Load referees
        loadReferees();
        
        // Set up event listeners
        setupEventListeners();
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        showError('Failed to initialize the application. Please check your internet connection.');
    }
});

// Load referees from Firebase
function loadReferees() {
    showLoading(true);
    
    const refereesRef = database.ref('registrations').orderByChild('userType').equalTo('referee');
    
    refereesRef.on('value', (snapshot) => {
        referees = [];
        
        snapshot.forEach((childSnapshot) => {
            const referee = childSnapshot.val();
            referee.id = childSnapshot.key;
            
            // Only add referees
            if (referee.userType === 'referee') {
                referees.push(referee);
            }
        });
        
        // Sort referees by name
        referees.sort((a, b) => {
            const nameA = a.fullName?.toLowerCase() || '';
            const nameB = b.fullName?.toLowerCase() || '';
            return nameA.localeCompare(nameB);
        });
        
        // Apply current filters and render
        filterAndRenderReferees();
        
        // Update stats
        updateStats();
        
        showLoading(false);
    }, (error) => {
        console.error('Error loading referees:', error);
        showError('Failed to load referees. Please try again.');
        showLoading(false);
    });
}

// Set up event listeners
function setupEventListeners() {
    // Search input
    searchInput.addEventListener('input', debounce(() => {
        filterAndRenderReferees();
    }, 300));
    
    // Print button
    if (printButton) {
        printButton.addEventListener('click', handlePrint);
    }
}

// Handle print functionality
function handlePrint() {
    const printWindow = window.open('', '_blank');
    const currentDate = new Date().toLocaleDateString();
    
    const refereesToPrint = filteredReferees.length > 0 ? filteredReferees : referees;
    
    let printHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Referee List - ${currentDate}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; padding: 18px; color: #000; }
            .tournament-header { 
                background: #fff; 
                border-radius: 12px; 
                padding: 10px 14px; 
                box-shadow: 0 4px 14px rgba(0,0,0,0.2); 
                margin-bottom: 20px; 
            }
            .logo-container { 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                gap: 44px; 
                margin-bottom: 10px;
            }
            .logo-container img { 
                width: 54px; 
                height: 54px; 
                border-radius: 12px; 
                box-shadow: 0 2px 8px rgba(0,0,0,0.12); 
            }
            .tournament-title { 
                font-size: 1.5rem; 
                font-weight: 700; 
                line-height: 1.3; 
                text-align: center; 
                color: #000; 
                margin: 16px 0 0 0; 
            }
            h1 { text-align: center; margin: 20px 0 10px 0; font-size: 1.3em; }
            .print-header { margin-bottom: 20px; text-align: center; }
            .print-header p { margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .verified { color: green; font-weight: bold; }
            .pending { color: orange; font-weight: bold; }
            .print-footer { 
                margin-top: 36px; 
                font-size: 1.09rem; 
                text-align: center; 
                color: #222; 
                opacity: 0.82; 
                letter-spacing: 1px; 
                padding: 8px 0; 
            }
            @media print { 
                body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } 
            }
        </style>
    </head>
    <body>
        <div class="tournament-header">
            <div class="logo-container">
                <img src="/public/assets/Backdrop%5B1%5D%20mja%20logooooo.png" alt="Logo1">
                <img src="/public/assets/punitBalan.png" alt="Logo2">
                <img src="/public/assets/mum_m%20copy%2001.png" alt="Logo3">
            </div>
            <h1 class="tournament-title">52th SENIOR STATE & NATIONAL SELECTION JUDO CHAMPIONSHIP 2025-26, MUMBAI</h1>
        </div>
        <div class="print-header">
            <h1>Referee List</h1>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            <p>Total Referees: ${refereesToPrint.length}</p>
        </div>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>License Number</th>
                    <th>Status</th>
                    <th>Contact</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    refereesToPrint.forEach((referee, index) => {
        const status = referee.licenseInfo?.verified ? 'Verified' : 'Pending';
        const statusClass = referee.licenseInfo?.verified ? 'verified' : 'pending';
        printHTML += `
        <tr>
            <td>${index + 1}</td>
            <td>${referee.fullName || 'N/A'}</td>
            <td>${referee.licenseInfo?.licenseNumber || 'N/A'}</td>
            <td class="${statusClass}">${status}</td>
            <td>${referee.phone || referee.email || 'N/A'}</td>
        </tr>
        `;
    });
    
    printHTML += `
            </tbody>
        </table>
        <footer class="print-footer">MAHAJUDO &copy; BLACKTROUNCE STUDIO</footer>
    </body>
    </html>`;
    
    printWindow.document.open();
    printWindow.document.write(printHTML);
    printWindow.document.close();
    
    printWindow.onload = function() {
        setTimeout(() => {
            printWindow.print();
            printWindow.onafterprint = function() {
                printWindow.close();
            };
        }, 500);
    };
}

// Filter referees based on search
function filterAndRenderReferees() {
    const searchTerm = searchInput.value.toLowerCase();
    
    filteredReferees = referees.filter(referee => {
        const matchesSearch = !searchTerm || 
            (referee.fullName && referee.fullName.toLowerCase().includes(searchTerm)) ||
            (referee.email && referee.email.toLowerCase().includes(searchTerm)) ||
            (referee.phone && referee.phone.includes(searchTerm)) ||
            (referee.licenseInfo?.licenseNumber && referee.licenseInfo.licenseNumber.toLowerCase().includes(searchTerm));
        
        return matchesSearch;
    });
    
    renderReferees();
    updateStats();
}

// Render referees in the table
function renderReferees() {
    if (!refereesTableBody) return;
    
    if (filteredReferees.length === 0) {
        refereesTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <i class="fas fa-user-slash" style="font-size: 2rem; opacity: 0.3; margin-bottom: 10px; display: block;"></i>
                    <p>No referees found matching your criteria</p>
                </td>
            </tr>
        `;
        return;
    }
    
    refereesTableBody.innerHTML = filteredReferees.map((referee, index) => {
        const editBtn = `<button class='btn btn-sm btn-outline-primary' onclick='editReferee("${referee.id}")'>Edit</button>`;
        const deleteBtn = `<button class='btn btn-sm btn-outline-danger' onclick='deleteReferee("${referee.id}")' style='background-color: #dc3545; color: white;'>Delete</button>`;
        
        const verified = referee.licenseInfo?.verified;
        const statusBadge = verified 
            ? '<span class="badge bg-success">Verified</span>' 
            : '<span class="badge bg-warning text-dark">Pending</span>';
        
        return `
            <tr>
                <td>${index + 1}</td>
                <td>
                    <div class="d-flex align-items-center">
                        <div>
                            <div class="fw-500">${referee.fullName || 'N/A'}</div>
                            <small class="text-muted">${referee.email || ''}</small>
                        </div>
                    </div>
                </td>
                <td>${referee.licenseInfo?.licenseNumber || 'N/A'}</td>
                <td>${statusBadge}</td>
                <td>${referee.phone || 'N/A'}</td>
                <td>${editBtn}</td>
                <td>${deleteBtn}</td>
            </tr>
        `;
    }).join('');
}

// Update statistics
function updateStats() {
    const hasActiveFilters = searchInput.value;
    totalRefereesEl.textContent = hasActiveFilters ? filteredReferees.length : referees.length;
    
    const verified = referees.filter(r => r.licenseInfo?.verified).length;
    const pending = referees.length - verified;
    
    verifiedRefereesEl.textContent = verified;
    pendingRefereesEl.textContent = pending;
}

// Show loading state
function showLoading(show) {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
        loadingElement.style.display = show ? 'block' : 'none';
    }
}

// Show error message
function showError(message) {
    console.error(message);
    alert(message);
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Delete referee logic
window.deleteReferee = function(refereeId) {
    const referee = referees.find(r => r.id === refereeId);
    if (!referee) return alert('Referee not found');
    
    const confirmDelete = confirm(`Are you sure you want to delete ${referee.fullName}? This action cannot be undone.`);
    if (!confirmDelete) return;
    
    const updates = {};
    updates[`/registrations/${refereeId}`] = null;
    updates[`/users/${refereeId}`] = null;
    
    database.ref().update(updates)
        .then(() => {
            alert('Referee deleted successfully');
            loadReferees();
        })
        .catch(err => {
            console.error('Delete failed:', err);
            alert('Failed to delete referee: ' + err.message);
        });
};

// Edit referee logic
window.editReferee = function(refereeId) {
    const referee = referees.find(r => r.id === refereeId);
    if (!referee) return alert('Referee not found');
    
    document.getElementById('editRefereeId').value = referee.id;
    document.getElementById('editFirstName').value = referee.firstName || '';
    document.getElementById('editMiddleName').value = referee.middleName || '';
    document.getElementById('editLastName').value = referee.lastName || '';
    document.getElementById('editEmail').value = referee.email || '';
    document.getElementById('editPhone').value = referee.phone || '';
    document.getElementById('editLicenseNumber').value = referee.licenseInfo?.licenseNumber || '';
    document.getElementById('editVerified').value = referee.licenseInfo?.verified ? 'true' : 'false';
    
    const modal = new bootstrap.Modal(document.getElementById('editRefereeModal'));
    modal.show();
};

// Save edit
const saveEditBtn = document.getElementById('saveEditRefereeBtn');
if (saveEditBtn) {
    saveEditBtn.onclick = async function() {
        const refereeId = document.getElementById('editRefereeId').value;
        const referee = referees.find(r => r.id === refereeId);
        if (!referee) return alert('Referee not found');
        
        saveEditBtn.disabled = true;
        saveEditBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        try {
            const firstName = document.getElementById('editFirstName').value.trim();
            const middleName = document.getElementById('editMiddleName').value.trim();
            const lastName = document.getElementById('editLastName').value.trim();
            
            const fullName = middleName 
                ? `${firstName} ${middleName} ${lastName}`
                : `${firstName} ${lastName}`;
            
            referee.firstName = firstName;
            referee.middleName = middleName;
            referee.lastName = lastName;
            referee.fullName = fullName;
            referee.email = document.getElementById('editEmail').value;
            referee.phone = document.getElementById('editPhone').value;
            
            if (!referee.licenseInfo) referee.licenseInfo = {};
            referee.licenseInfo.licenseNumber = document.getElementById('editLicenseNumber').value;
            referee.licenseInfo.verified = document.getElementById('editVerified').value === 'true';
            
            const updates = {};
            updates[`/registrations/${refereeId}`] = referee;
            updates[`/users/${refereeId}`] = referee;
            
            await database.ref().update(updates);
            bootstrap.Modal.getInstance(document.getElementById('editRefereeModal')).hide();
            loadReferees();
        } catch (err) {
            alert('Update failed: ' + err.message);
        } finally {
            saveEditBtn.disabled = false;
            saveEditBtn.innerHTML = 'Save';
        }
    };
}

// Add CSS
const style = document.createElement('style');
style.textContent = `
    .fw-500 {
        font-weight: 500;
    }
    
    .d-flex {
        display: flex;
    }
    
    .align-items-center {
        align-items: center;
    }
    
    .text-center {
        text-align: center;
    }
    
    .text-muted {
        color: #6c757d;
    }
    
    .badge {
        display: inline-block;
        padding: 0.35em 0.65em;
        font-size: 0.75em;
        font-weight: 700;
        line-height: 1;
        color: #fff;
        text-align: center;
        white-space: nowrap;
        vertical-align: baseline;
        border-radius: 0.25rem;
    }
    
    .bg-success {
        background-color: #198754;
    }
    
    .bg-warning {
        background-color: #ffc107;
    }
    
    .text-dark {
        color: #212529;
    }
`;
document.head.appendChild(style);

// Add loading indicator
const loadingElement = document.createElement('div');
loadingElement.id = 'loading';
loadingElement.className = 'loading';
loadingElement.innerHTML = '<i class="fas fa-spinner"></i><p>Loading referees...</p>';
document.querySelector('.player-list-container').prepend(loadingElement);

// Show loading initially
showLoading(true);
