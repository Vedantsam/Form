// Step 1: Import required modules
const express = require('express');
const path = require('path');
const cors = require('cors');

// Step 2: Initialize Express app FIRST
const app = express();
const PORT = process.env.PORT || 3000;

// Step 3: Configure EJS as templating engine AFTER app initialization
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Custom middleware for logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// In-memory data stores
let registrations = [
    {
        id: 1,
        fullName: 'John Doe',
        email: 'john@example.com',
        country: 'us',
        gender: 'male',
        interests: ['technology', 'sports'],
        registeredAt: new Date().toISOString()
    },
    {
        id: 2,
        fullName: 'Jane Smith',
        email: 'jane@example.com',
        country: 'uk',
        gender: 'female',
        interests: ['reading', 'music'],
        registeredAt: new Date().toISOString()
    }
];

let contacts = [
    {
        id: 1,
        name: 'Alice Johnson',
        email: 'alice@example.com',
        subject: 'General Inquiry',
        message: 'I would like to know more about your services.',
        status: 'pending',
        submittedAt: new Date().toISOString()
    }
];

// Temporary server-side storage for validated registrations (TTL-based, in-memory)
const TEMP_TTL_MS = 60 * 60 * 1000; // 1 hour
const tempRegistrations = new Map(); // id -> { data, expiresAt }

function pruneTempRegistrations() {
    const now = Date.now();
    for (const [id, entry] of tempRegistrations.entries()) {
        if (!entry || !entry.expiresAt || entry.expiresAt <= now) {
            tempRegistrations.delete(id);
        }
    }
}

// Periodic cleanup
setInterval(pruneTempRegistrations, 5 * 60 * 1000).unref();

// Utility function to generate unique ID
function generateId(array) {
    return array.length > 0 ? Math.max(...array.map(item => item.id)) + 1 : 1;
}

// ==================== SERVER-SIDE RENDERED PAGES ====================

// Home page
app.get('/', (req, res) => {
    const stats = {
        totalRegistrations: registrations.length,
        totalContacts: contacts.length,
        pendingContacts: contacts.filter(c => c.status === 'pending').length
    };
    
    res.render('home', { 
        title: 'Home',
        stats: stats,
        currentYear: new Date().getFullYear()
    });
});

// Registration form page
app.get('/register', (req, res) => {
    res.render('register', { 
        title: 'Register',
        error: null,
        success: null
    });
});

// Display all registrations
app.get('/users', (req, res) => {
    res.render('users', { 
        title: 'Registered Users',
        users: registrations,
        totalUsers: registrations.length
    });
});

// Display single user details
app.get('/users/:id', (req, res) => {
    const userId = parseInt(req.params.id);
    const user = registrations.find(r => r.id === userId);
    
    if (!user) {
        return res.render('error', {
            title: 'Error',
            message: 'User not found',
            errorCode: 404
        });
    }
    
    res.render('user-detail', {
        title: `User: ${user.fullName}`,
        user: user
    });
});

// Contact form page
app.get('/contact', (req, res) => {
    res.render('contact', { 
        title: 'Contact Us',
        error: null,
        success: null
    });
});

// Display all contacts
app.get('/contacts', (req, res) => {
    res.render('contacts', { 
        title: 'Contact Submissions',
        contacts: contacts,
        totalContacts: contacts.length
    });
});

// Dashboard page
app.get('/dashboard', (req, res) => {
    const recentRegistrations = registrations.slice(-5).reverse();
    const recentContacts = contacts.slice(-5).reverse();
    
    const stats = {
        totalUsers: registrations.length,
        totalContacts: contacts.length,
        pendingContacts: contacts.filter(c => c.status === 'pending').length,
        reviewedContacts: contacts.filter(c => c.status === 'reviewed').length
    };
    
    res.render('dashboard', {
        title: 'Dashboard',
        stats: stats,
        recentRegistrations: recentRegistrations,
        recentContacts: recentContacts
    });
});

// ==================== FORM SUBMISSION ENDPOINTS ====================

// Handle registration form submission
app.post('/register', (req, res) => {
    try {
        const {
            fullName,
            email,
            password,
            phone,
            dob,
            age,
            country,
            gender,
            interests,
            bio,
            terms
        } = req.body;

        // Validation
        if (!fullName || !email || !password || !country) {
            return res.render('register', {
                title: 'Register',
                error: 'Please fill all required fields',
                success: null
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.render('register', {
                title: 'Register',
                error: 'Invalid email format',
                success: null
            });
        }

        // Check if email already exists
        const existingUser = registrations.find(r => r.email === email);
        if (existingUser) {
            return res.render('register', {
                title: 'Register',
                error: 'Email already registered',
                success: null
            });
        }

        // Password validation
        if (password.length < 8) {
            return res.render('register', {
                title: 'Register',
                error: 'Password must be at least 8 characters long',
                success: null
            });
        }

        // Create new registration
        const newRegistration = {
            id: generateId(registrations),
            fullName,
            email,
            phone: phone || null,
            dob: dob || null,
            age: age ? parseInt(age) : null,
            country,
            gender: gender || null,
            interests: Array.isArray(interests) ? interests : (interests ? [interests] : []),
            bio: bio || null,
            registeredAt: new Date().toISOString()
        };

        registrations.push(newRegistration);

        console.log('✅ New registration:', newRegistration);

        // Redirect to success page
        res.redirect(`/users/${newRegistration.id}?success=true`);

    } catch (error) {
        console.error('Registration error:', error);
        res.render('register', {
            title: 'Register',
            error: 'Server error during registration',
            success: null
        });
    }
});

// Handle contact form submission
app.post('/contact', (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        // Validation
        if (!name || !email || !message) {
            return res.render('contact', {
                title: 'Contact Us',
                error: 'Name, email, and message are required',
                success: null
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.render('contact', {
                title: 'Contact Us',
                error: 'Invalid email format',
                success: null
            });
        }

        const newContact = {
            id: generateId(contacts),
            name,
            email,
            subject: subject || 'No subject',
            message,
            submittedAt: new Date().toISOString(),
            status: 'pending'
        };

        contacts.push(newContact);

        console.log('✅ New contact submission:', newContact);

        res.render('contact', {
            title: 'Contact Us',
            error: null,
            success: 'Thank you for contacting us! We will get back to you soon.'
        });

    } catch (error) {
        console.error('Contact form error:', error);
        res.render('contact', {
            title: 'Contact Us',
            error: 'Server error during submission',
            success: null
        });
    }
});

// ==================== API ENDPOINTS (JSON) ====================

// Helper validators for API payloads
function isValidEmail(email) {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(String(email || '').toLowerCase());
}

function isValidUsername(username) {
	return /^[a-zA-Z0-9_]{3,20}$/.test(String(username || ''));
}

function isStrongPassword(password) {
	// At least 8 chars, 1 lowercase, 1 uppercase, 1 number
	return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(String(password || ''));
}

function isValidPhone(phone) {
	// Allow optional +, digits, spaces, parentheses and dashes; 10-15 digits when stripped
	if (!phone) return true;
	const digits = String(phone).replace(/\D/g, '');
	return digits.length >= 10 && digits.length <= 15;
}

function isValidUrl(url) {
	if (!url) return true;
	try {
		const u = new URL(String(url));
		return u.protocol === 'http:' || u.protocol === 'https:';
	} catch (_) {
		return false;
	}
}

function isAdult(dob) {
	if (!dob) return true; // optional; if provided ensure >= 18
	const birthDate = new Date(dob);
	if (Number.isNaN(birthDate.getTime())) return false;
	const today = new Date();
	let age = today.getFullYear() - birthDate.getFullYear();
	const m = today.getMonth() - birthDate.getMonth();
	if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
		age--;
	}
	return age >= 18;
}

function validateAdvancedRegistrationPayload(body) {
	const errors = {};

	const requiredFields = ['firstName', 'lastName', 'email', 'username', 'password'];
	requiredFields.forEach((f) => {
		if (!body[f] || String(body[f]).trim() === '') {
			errors[f] = 'This field is required';
		}
	});

	if (body.email && !isValidEmail(body.email)) {
		errors.email = 'Invalid email format';
	}

	if (body.username && !isValidUsername(body.username)) {
		errors.username = '3-20 chars; letters, numbers, underscore only';
	}

	if (body.password && !isStrongPassword(body.password)) {
		errors.password = 'Min 8 chars with upper, lower, and number';
	}

	if (!isValidPhone(body.phone)) {
		errors.phone = 'Invalid phone number';
	}

	if (body.dob && !isAdult(body.dob)) {
		errors.dob = 'You must be at least 18 years old';
	}

	if (body.linkedin && !isValidUrl(body.linkedin)) {
		errors.linkedin = 'Invalid URL';
	}

	if (body.portfolio && !isValidUrl(body.portfolio)) {
		errors.portfolio = 'Invalid URL';
	}

	if (body.experience !== undefined) {
		const exp = parseInt(body.experience, 10);
		if (Number.isNaN(exp) || exp < 0 || exp > 50) {
			errors.experience = 'Experience must be between 0 and 50';
		} else {
			body.experience = exp;
		}
	}

	if (body.bio && String(body.bio).length > 500) {
		errors.bio = 'Bio must be 500 characters or fewer';
	}

	// Normalize/validate collections
	if (body.interests !== undefined) {
		const list = Array.isArray(body.interests) ? body.interests : (body.interests ? [body.interests] : []);
		if (list.length === 0) {
			errors.interests = 'Select at least one interest';
		} else {
			body.interests = list;
		}
	}

	body.newsletter = Array.isArray(body.newsletter) ? body.newsletter : (body.newsletter ? [body.newsletter] : []);
	body.skills = Array.isArray(body.skills) ? body.skills : (body.skills ? [body.skills] : []);

	// Terms must be accepted if provided
	if (body.terms !== undefined) {
		const accepted = body.terms === true || body.terms === 'true' || body.terms === 'on' || body.terms === '1';
		if (!accepted) {
			errors.terms = 'You must accept the terms';
		}
	}

	return { valid: Object.keys(errors).length === 0, errors };
}

// NEW: API endpoint for advanced registration form (from your HTML)
app.post('/api/register', (req, res) => {
    try {
        console.log('📥 Received registration data:', req.body);

        const {
            firstName,
            lastName,
            email,
            phone,
            dob,
            gender,
            username,
            password,
            occupation,
            company,
            experience,
            skills,
            linkedin,
            portfolio,
            education,
            interests,
            bio,
            newsletter,
            terms
        } = req.body;

        // Validate payload thoroughly
        const { valid, errors } = validateAdvancedRegistrationPayload(req.body);
        if (!valid) {
            return res.status(400).json({ success: false, message: 'Validation failed', errors });
        }

        // Check if email already exists
        const existingUser = registrations.find(r => r.email === email);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Check if username already exists
        const existingUsername = registrations.find(r => r.username === username);
        if (existingUsername) {
            return res.status(409).json({
                success: false,
                message: 'Username already taken'
            });
        }

        // Password strength already validated above

        // Create new registration with all fields
        const newRegistration = {
            id: generateId(registrations),
            // Personal Info
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`,
            email,
            phone: phone || null,
            dob: dob || null,
            gender: gender || null,
            
            // Account Info
            username,
            // Note: In production, NEVER store plain text passwords!
            // Use bcrypt or similar to hash passwords
            
            // Professional Info
            occupation: occupation || null,
            company: company || null,
            experience: experience ? parseInt(experience) : 0,
            skills: Array.isArray(skills) ? skills : (skills ? [skills] : []),
            linkedin: linkedin || null,
            portfolio: portfolio || null,
            education: education || null,
            
            // Preferences
            interests: Array.isArray(interests) ? interests : (interests ? [interests] : []),
            bio: bio || null,
            newsletter: Array.isArray(newsletter) ? newsletter : (newsletter ? [newsletter] : []),
            
            // Metadata
            registeredAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        registrations.push(newRegistration);

        // Store validated data in temporary storage (auto-expires)
        tempRegistrations.set(newRegistration.id, {
            data: newRegistration,
            expiresAt: Date.now() + TEMP_TTL_MS
        });

        console.log('✅ New advanced registration created:', newRegistration);
        console.log(`📊 Total registrations: ${registrations.length}`);

        // Return success response
        res.status(201).json({
            success: true,
            message: 'Registration successful! Welcome aboard!',
            data: {
                id: newRegistration.id,
                fullName: newRegistration.fullName,
                email: newRegistration.email,
                username: newRegistration.username,
                registeredAt: newRegistration.registeredAt
            }
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
            error: error.message
        });
    }
});

// Get all registrations (API)
app.get('/api/registrations', (req, res) => {
    res.json({
        success: true,
        count: registrations.length,
        data: registrations
    });
});

// Get single registration by ID (API)
app.get('/api/registrations/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const registration = registrations.find(r => r.id === id);

    if (!registration) {
        return res.status(404).json({
            success: false,
            message: 'Registration not found'
        });
    }

    res.json({
        success: true,
        data: registration
    });
});

app.get('/api/contacts', (req, res) => {
    res.json({
        success: true,
        count: contacts.length,
        data: contacts
    });
});

// Get non-expired temporary registrations (API)
app.get('/api/temp-registrations', (req, res) => {
    pruneTempRegistrations();
    const items = [];
    for (const [id, entry] of tempRegistrations.entries()) {
        if (entry && entry.expiresAt > Date.now()) {
            items.push(entry.data);
        }
    }
    res.json({ success: true, count: items.length, data: items });
});

// Delete a temporary registration (API)
app.delete('/api/temp-registrations/:id', (req, res) => {
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) {
        return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const existed = tempRegistrations.delete(id);
    if (!existed) {
        return res.status(404).json({ success: false, message: 'Temp registration not found' });
    }
    res.json({ success: true, message: 'Temp registration removed' });
});

app.delete('/api/registrations/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = registrations.findIndex(r => r.id === id);

    if (index === -1) {
        return res.status(404).json({
            success: false,
            message: 'Registration not found'
        });
    }

    const deleted = registrations.splice(index, 1)[0];
    res.json({
        success: true,
        message: 'Registration deleted successfully',
        data: deleted
    });
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
    // Check if it's an API request
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            message: 'API endpoint not found',
            path: req.path
        });
    }
    
    res.status(404).render('error', {
        title: 'Page Not Found',
        message: 'The page you are looking for does not exist.',
        errorCode: 404
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    
    // Check if it's an API request
    if (req.path.startsWith('/api/')) {
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
    
    res.status(500).render('error', {
        title: 'Server Error',
        message: 'Something went wrong on our end.',
        errorCode: 500
    });
});

// Start server
app.listen(PORT, () => {
    console.log('═══════════════════════════════════════════════════');
    console.log(`✅ Server is running on http://localhost:${PORT}`);
    console.log(`🎨 EJS templating engine is configured`);
    console.log(`📝 Visit http://localhost:${PORT} to get started`);
    console.log('═══════════════════════════════════════════════════');
    console.log('\nAvailable Pages:');
    console.log(`  • http://localhost:${PORT}/          - Home`);
    console.log(`  • http://localhost:${PORT}/register  - Registration Form`);
    console.log(`  • http://localhost:${PORT}/contact   - Contact Form`);
    console.log(`  • http://localhost:${PORT}/users     - View All Users`);
    console.log(`  • http://localhost:${PORT}/contacts  - View All Contacts`);
    console.log(`  • http://localhost:${PORT}/dashboard - Dashboard`);
    console.log('\nAPI Endpoints:');
    console.log(`  • POST http://localhost:${PORT}/api/register       - Advanced registration`);
    console.log(`  • GET  http://localhost:${PORT}/api/registrations  - Get all registrations`);
    console.log(`  • GET  http://localhost:${PORT}/api/registrations/:id - Get single registration`);
    console.log(`  • DELETE http://localhost:${PORT}/api/registrations/:id - Delete registration`);
    console.log('═══════════════════════════════════════════════════');
});