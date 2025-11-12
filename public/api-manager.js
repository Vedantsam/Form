// API Base URL
const API_BASE = '';

// ==================== UTILITY FUNCTIONS ====================

function showAlert(message, type = 'success') {
    const alertDiv = document.getElementById('alertMessage');
    alertDiv.textContent = message;
    alertDiv.className = `alert alert-${type} show`;
    
    setTimeout(() => {
        alertDiv.classList.remove('show');
    }, 5000);
}

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(`${tabName}-tab`).classList.add('active');
    event.target.classList.add('active');

    // Load data for the selected tab
    if (tabName === 'registrations') {
        loadRegistrations();
    } else if (tabName === 'contacts') {
        loadContacts();
    }
}

// ==================== REGISTRATIONS CRUD ====================

// Load all registrations
async function loadRegistrations() {
    const listDiv = document.getElementById('registrationsList');
    listDiv.innerHTML = '<div class="loading">Loading registrations...</div>';

    try {
        const response = await fetch(`${API_BASE}/api/registrations`);
        const result = await response.json();

        if (result.success) {
            displayRegistrations(result.data);
        } else {
            listDiv.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>Failed to load registrations</p></div>';
        }
    } catch (error) {
        console.error('Error loading registrations:', error);
        listDiv.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❌</div><p>Error loading registrations</p></div>';
        showAlert('Failed to load registrations', 'error');
    }
}

// Display registrations
function displayRegistrations(registrations) {
    const listDiv = document.getElementById('registrationsList');

    if (!registrations || registrations.length === 0) {
        listDiv.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div><p>No registrations found</p><p style="font-size: 14px;">Create a new registration using the form on the left</p></div>';
        return;
    }

    listDiv.innerHTML = registrations.map(reg => `
        <div class="data-card" data-id="${reg.id}">
            <div class="data-card-header">
                <h3 class="data-card-title">${reg.fullName || 'Unknown'}</h3>
                <div class="data-card-actions">
                    <button class="btn btn-success btn-sm" onclick="editRegistration(${reg.id})">✏️ Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteRegistration(${reg.id})">🗑️ Delete</button>
                </div>
            </div>
            <div class="data-card-body">
                <p><strong>Email:</strong> ${reg.email || 'N/A'}</p>
                <p><strong>Phone:</strong> ${reg.phone || 'N/A'}</p>
                <p><strong>Country:</strong> ${reg.country || 'N/A'}</p>
                <p><strong>Gender:</strong> ${reg.gender || 'N/A'}</p>
                ${reg.bio ? `<p><strong>Bio:</strong> ${reg.bio}</p>` : ''}
                ${reg.interests && reg.interests.length > 0 ? `<p><strong>Interests:</strong> ${reg.interests.join(', ')}</p>` : ''}
                <p style="font-size: 12px; color: #999; margin-top: 10px;">
                    Registered: ${reg.registeredAt ? new Date(reg.registeredAt).toLocaleString() : 'N/A'}
                </p>
            </div>
        </div>
    `).join('');
}

// Handle registration form submit
async function handleRegistrationSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // Remove empty fields
    Object.keys(data).forEach(key => {
        if (data[key] === '' && key !== 'bio') {
            delete data[key];
        }
    });

    const id = document.getElementById('registrationId').value;
    const submitBtn = document.getElementById('regSubmitBtn');
    const originalText = submitBtn.textContent;
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    try {
        let response;
        if (id) {
            // Update existing
            response = await fetch(`${API_BASE}/api/registrations/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        } else {
            // Create new
            response = await fetch(`${API_BASE}/api/registrations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        }

        const result = await response.json();

        if (result.success) {
            showAlert(id ? 'Registration updated successfully!' : 'Registration created successfully!');
            resetRegistrationForm();
            loadRegistrations();
        } else {
            showAlert(result.message || 'Operation failed', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('An error occurred. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// Edit registration
async function editRegistration(id) {
    try {
        const response = await fetch(`${API_BASE}/api/registrations/${id}`);
        const result = await response.json();

        if (result.success) {
            const reg = result.data;
            document.getElementById('registrationId').value = reg.id;
            document.getElementById('regFullName').value = reg.fullName || '';
            document.getElementById('regEmail').value = reg.email || '';
            document.getElementById('regPhone').value = reg.phone || '';
            document.getElementById('regCountry').value = reg.country || '';
            document.getElementById('regGender').value = reg.gender || '';
            document.getElementById('regBio').value = reg.bio || '';
            
            document.getElementById('regSubmitBtn').textContent = 'Update';
            
            // Scroll to form
            document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth' });
            showAlert('Registration loaded. Make changes and click Update.');
        } else {
            showAlert('Failed to load registration', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to load registration', 'error');
    }
}

// Delete registration
async function deleteRegistration(id) {
    if (!confirm('Are you sure you want to delete this registration?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/registrations/${id}`, {
            method: 'DELETE'
        });
        const result = await response.json();

        if (result.success) {
            showAlert('Registration deleted successfully!');
            loadRegistrations();
        } else {
            showAlert(result.message || 'Failed to delete registration', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to delete registration', 'error');
    }
}

// Reset registration form
function resetRegistrationForm() {
    document.getElementById('registrationForm').reset();
    document.getElementById('registrationId').value = '';
    document.getElementById('regSubmitBtn').textContent = 'Create';
}

// Filter registrations
function filterRegistrations() {
    const searchTerm = document.getElementById('regSearch').value.toLowerCase();
    const cards = document.querySelectorAll('#registrationsList .data-card');
    
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(searchTerm) ? 'block' : 'none';
    });
}

// ==================== CONTACTS CRUD ====================

// Load all contacts
async function loadContacts() {
    const listDiv = document.getElementById('contactsList');
    listDiv.innerHTML = '<div class="loading">Loading contacts...</div>';

    try {
        const response = await fetch(`${API_BASE}/api/contacts`);
        const result = await response.json();

        if (result.success) {
            displayContacts(result.data);
        } else {
            listDiv.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><p>Failed to load contacts</p></div>';
        }
    } catch (error) {
        console.error('Error loading contacts:', error);
        listDiv.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❌</div><p>Error loading contacts</p></div>';
        showAlert('Failed to load contacts', 'error');
    }
}

// Display contacts
function displayContacts(contacts) {
    const listDiv = document.getElementById('contactsList');

    if (!contacts || contacts.length === 0) {
        listDiv.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📧</div><p>No contacts found</p><p style="font-size: 14px;">Create a new contact using the form on the left</p></div>';
        return;
    }

    listDiv.innerHTML = contacts.map(contact => {
        const statusClass = contact.status === 'responded' ? 'badge-success' : 
                           contact.status === 'reviewed' ? 'badge-info' : 'badge-warning';
        
        return `
        <div class="data-card" data-id="${contact.id}">
            <div class="data-card-header">
                <h3 class="data-card-title">${contact.name || 'Anonymous'}</h3>
                <div class="data-card-actions">
                    <button class="btn btn-success btn-sm" onclick="editContact(${contact.id})">✏️ Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteContact(${contact.id})">🗑️ Delete</button>
                </div>
            </div>
            <div class="data-card-body">
                <p><strong>Email:</strong> ${contact.email || 'N/A'}</p>
                <p><strong>Subject:</strong> ${contact.subject || 'No subject'}</p>
                <p><strong>Message:</strong> ${contact.message || 'N/A'}</p>
                <p><strong>Status:</strong> <span class="badge ${statusClass}">${contact.status || 'pending'}</span></p>
                <p style="font-size: 12px; color: #999; margin-top: 10px;">
                    Submitted: ${contact.submittedAt ? new Date(contact.submittedAt).toLocaleString() : 'N/A'}
                </p>
            </div>
        </div>
    `;
    }).join('');
}

// Handle contact form submit
async function handleContactSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // Remove empty fields except message
    Object.keys(data).forEach(key => {
        if (data[key] === '' && key !== 'message' && key !== 'subject') {
            delete data[key];
        }
    });

    const id = document.getElementById('contactId').value;
    const submitBtn = document.getElementById('contactSubmitBtn');
    const originalText = submitBtn.textContent;
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    try {
        let response;
        if (id) {
            // Update existing
            response = await fetch(`${API_BASE}/api/contacts/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        } else {
            // Create new
            response = await fetch(`${API_BASE}/api/contacts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
        }

        const result = await response.json();

        if (result.success) {
            showAlert(id ? 'Contact updated successfully!' : 'Contact created successfully!');
            resetContactForm();
            loadContacts();
        } else {
            showAlert(result.message || 'Operation failed', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('An error occurred. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// Edit contact
async function editContact(id) {
    try {
        const response = await fetch(`${API_BASE}/api/contacts/${id}`);
        const result = await response.json();

        if (result.success) {
            const contact = result.data;
            document.getElementById('contactId').value = contact.id;
            document.getElementById('contactName').value = contact.name || '';
            document.getElementById('contactEmail').value = contact.email || '';
            document.getElementById('contactSubject').value = contact.subject || '';
            document.getElementById('contactMessage').value = contact.message || '';
            document.getElementById('contactStatus').value = contact.status || 'pending';
            
            document.getElementById('contactSubmitBtn').textContent = 'Update';
            
            // Scroll to form
            document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth' });
            showAlert('Contact loaded. Make changes and click Update.');
        } else {
            showAlert('Failed to load contact', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to load contact', 'error');
    }
}

// Delete contact
async function deleteContact(id) {
    if (!confirm('Are you sure you want to delete this contact?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/contacts/${id}`, {
            method: 'DELETE'
        });
        const result = await response.json();

        if (result.success) {
            showAlert('Contact deleted successfully!');
            loadContacts();
        } else {
            showAlert(result.message || 'Failed to delete contact', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Failed to delete contact', 'error');
    }
}

// Reset contact form
function resetContactForm() {
    document.getElementById('contactForm').reset();
    document.getElementById('contactId').value = '';
    document.getElementById('contactStatus').value = 'pending';
    document.getElementById('contactSubmitBtn').textContent = 'Create';
}

// Filter contacts
function filterContacts() {
    const searchTerm = document.getElementById('contactSearch').value.toLowerCase();
    const cards = document.querySelectorAll('#contactsList .data-card');
    
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(searchTerm) ? 'block' : 'none';
    });
}

// ==================== INITIALIZE ====================

// Load data when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadRegistrations();
});

