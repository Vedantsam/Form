// Step 1: Load environment variables
require('dotenv').config();

// Step 2: Import required modules
const express = require('express');
const path = require('path');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const NodeCache = require('node-cache');
const emailQueue = require('./jobs/emailQueue');
const { v4: uuidv4 } = require('uuid');

// Step 3: Import database connection and models
const connectDB = require('./config/database');
const Registration = require('./models/Registration');
const Contact = require('./models/Contact');
const User = require('./models/User');

// Step 3.1: Import authentication middleware and routes
const { authenticate, isAdmin, optionalAuth } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const externalRoutes = require('./routes/external');

// Step 4: Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Step 5: Connect to MongoDB
connectDB();

// Step 6: Configure rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many login attempts, please try again later.'
    }
});

// Step 7: Configure EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Initialize cache
const responseCache = new NodeCache({ stdTTL: 120, checkperiod: 240, useClones: false });

// Cache helper functions
function cacheResponse(keyGenerator, ttl = 120) {
    return (req, res, next) => {
        try {
            const key = typeof keyGenerator === 'function' ? keyGenerator(req) : keyGenerator;
            const cachedResponse = responseCache.get(key);
            
            if (cachedResponse) {
                console.log(`📦 Cache hit for key: ${key}`);
                return res.json(cachedResponse);
            }
            
            // Store original res.json
            const originalJson = res.json.bind(res);
            
            // Override res.json
            res.json = function(data) {
                responseCache.set(key, data, ttl);
                console.log(`💾 Cached response for key: ${key}`);
                return originalJson(data);
            };
            
            next();
        } catch (error) {
            console.error('Cache middleware error:', error);
            next();
        }
    };
}

function invalidateCacheKeys(...keys) {
    keys.forEach(key => {
        if (key) {
            responseCache.del(key);
            console.log(`🗑️ Invalidated cache key: ${key}`);
        }
    });
}

// Request ID middleware
const requestIdMiddleware = (req, res, next) => {
    const headerName = 'X-Request-Id';
    const existingId = req.get(headerName);
    const id = existingId || uuidv4();
    res.set(headerName, id);
    req.id = id;
    next();
};

// Morgan tokens
morgan.token('id', (req) => req.id);
morgan.token('user', (req) => (req.user ? req.user.username || req.user.email : 'guest'));
const morganFormat = ':id [:date[iso]] :method :url :status :res[content-length] - :response-time ms user=:user';

app.use(requestIdMiddleware);
app.use(morgan(morganFormat));

// Custom middleware for logging
app.use((req, res, next) => {
    console.log(`[${req.id}] [${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Apply general API rate limiter
app.use('/api', apiLimiter);

// Authentication routes (public)
app.use('/api/auth', authLimiter, authRoutes);

// External API routes (optional authentication)
app.use('/api/external', optionalAuth, externalRoutes);

// ==================== SERVER-SIDE RENDERED PAGES ====================

// Home page
app.get('/', async (req, res) => {
    try {
        const totalRegistrations = await Registration.countDocuments();
        const totalContacts = await Contact.countDocuments();
        const pendingContacts = await Contact.countDocuments({ status: 'pending' });
        
        const stats = {
            totalRegistrations,
            totalContacts,
            pendingContacts
        };
        
        res.render('home', { 
            title: 'Home',
            stats: stats,
            currentYear: new Date().getFullYear()
        });
    } catch (error) {
        console.error('Error loading home page:', error);
        res.render('home', { 
            title: 'Home',
            stats: { totalRegistrations: 0, totalContacts: 0, pendingContacts: 0 },
            currentYear: new Date().getFullYear()
        });
    }
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
app.get('/users', async (req, res) => {
    try {
        const users = await Registration.find().sort({ registeredAt: -1 });
        res.render('users', { 
            title: 'Registered Users',
            users: users,
            totalUsers: users.length
        });
    } catch (error) {
        console.error('Error loading users:', error);
        res.render('users', { 
            title: 'Registered Users',
            users: [],
            totalUsers: 0
        });
    }
});

// Display single user details
app.get('/users/:id', async (req, res) => {
    try {
        const user = await Registration.findById(req.params.id);
        
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
    } catch (error) {
        console.error('Error loading user:', error);
        res.render('error', {
            title: 'Error',
            message: 'Error loading user details',
            errorCode: 500
        });
    }
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
app.get('/contacts', async (req, res) => {
    try {
        const contactsList = await Contact.find().sort({ submittedAt: -1 });
        res.render('contacts', { 
            title: 'Contact Submissions',
            contacts: contactsList,
            totalContacts: contactsList.length
        });
    } catch (error) {
        console.error('Error loading contacts:', error);
        res.render('contacts', { 
            title: 'Contact Submissions',
            contacts: [],
            totalContacts: 0
        });
    }
});

// Dashboard page
app.get('/dashboard', async (req, res) => {
    try {
        const recentRegistrations = await Registration.find()
            .sort({ registeredAt: -1 })
            .limit(5);
        const recentContacts = await Contact.find()
            .sort({ submittedAt: -1 })
            .limit(5);
        
        const stats = {
            totalUsers: await Registration.countDocuments(),
            totalContacts: await Contact.countDocuments(),
            pendingContacts: await Contact.countDocuments({ status: 'pending' }),
            reviewedContacts: await Contact.countDocuments({ status: 'reviewed' })
        };
        
        res.render('dashboard', {
            title: 'Dashboard',
            stats: stats,
            recentRegistrations: recentRegistrations,
            recentContacts: recentContacts
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.render('dashboard', {
            title: 'Dashboard',
            stats: { totalUsers: 0, totalContacts: 0, pendingContacts: 0, reviewedContacts: 0 },
            recentRegistrations: [],
            recentContacts: []
        });
    }
});

// ==================== FORM SUBMISSION ENDPOINTS ====================

// Handle registration form submission
app.post('/register', async (req, res) => {
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

        // Check if email already exists in database
        const existingUser = await Registration.findOne({ email: email.toLowerCase() });
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

        // Create new registration in database
        const newRegistration = new Registration({
            fullName,
            email: email.toLowerCase(),
            phone: phone || undefined,
            dob: dob || undefined,
            age: age ? parseInt(age) : undefined,
            country,
            gender: gender || undefined,
            interests: Array.isArray(interests) ? interests : (interests ? [interests] : []),
            bio: bio || undefined
        });

        await newRegistration.save();

        try {
            await emailQueue.add('welcomeEmail', {
                email: newRegistration.email,
                fullName: newRegistration.fullName || fullName
            }, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000
                }
            });
        } catch (queueError) {
            console.error('Queue error (welcome email):', queueError.message);
        }

        invalidateCacheKeys('registrations_all');

        console.log('✅ New registration saved to database:', newRegistration._id);

        // Redirect to success page
        res.redirect(`/users/${newRegistration._id}?success=true`);

    } catch (error) {
        console.error('Registration error:', error);
        
        // Handle duplicate key error (MongoDB)
        if (error.code === 11000) {
            return res.render('register', {
                title: 'Register',
                error: 'Email already registered',
                success: null
            });
        }
        
        res.render('register', {
            title: 'Register',
            error: 'Server error during registration',
            success: null
        });
    }
});

// Handle contact form submission
app.post('/contact', async (req, res) => {
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

        // Create new contact in database
        const newContact = new Contact({
            name,
            email: email.toLowerCase(),
            subject: subject || 'No subject',
            message,
            status: 'pending'
        });

        await newContact.save();

        invalidateCacheKeys('contacts_all', `contact_${newContact._id}`);

        console.log('✅ New contact submission saved to database:', newContact._id);

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

// API endpoint for advanced registration form
app.post('/api/register', async (req, res) => {
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

        // Check if email already exists in database
        const existingUser = await Registration.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Check if username already exists in database
        if (username) {
            const existingUsername = await Registration.findOne({ username: username });
            if (existingUsername) {
                return res.status(409).json({
                    success: false,
                    message: 'Username already taken'
                });
            }
        }

        // Create new registration in database with all fields
        const newRegistration = new Registration({
            // Personal Info
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`,
            email: email.toLowerCase(),
            phone: phone || undefined,
            dob: dob || undefined,
            gender: gender || undefined,
            
            // Account Info
            username: username || undefined,
            
            // Professional Info
            occupation: occupation || undefined,
            company: company || undefined,
            experience: experience ? parseInt(experience) : 0,
            skills: Array.isArray(skills) ? skills : (skills ? [skills] : []),
            linkedin: linkedin || undefined,
            portfolio: portfolio || undefined,
            education: education || undefined,
            
            // Preferences
            interests: Array.isArray(interests) ? interests : (interests ? [interests] : []),
            bio: bio || undefined,
            newsletter: Array.isArray(newsletter) ? newsletter : (newsletter ? [newsletter] : [])
        });

        await newRegistration.save();

        try {
            await emailQueue.add('welcomeEmail', {
                email: newRegistration.email,
                fullName: newRegistration.fullName
            }, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000
                }
            });
        } catch (queueError) {
            console.error('Queue error (welcome email):', queueError.message);
        }

        invalidateCacheKeys('registrations_all', `registration_${newRegistration._id}`);

        console.log('✅ New advanced registration created:', newRegistration._id);

        // Return success response
        res.status(201).json({
            success: true,
            message: 'Registration successful! Welcome aboard!',
            data: {
                id: newRegistration._id,
                fullName: newRegistration.fullName,
                email: newRegistration.email,
                username: newRegistration.username,
                registeredAt: newRegistration.registeredAt
            }
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        if (error.code === 11000) {
            // Duplicate key error
            const field = Object.keys(error.keyPattern)[0];
            return res.status(409).json({
                success: false,
                message: `${field === 'email' ? 'Email' : 'Username'} already exists`
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
            error: error.message
        });
    }
});

// Get all registrations (API) - Requires authentication
app.get('/api/registrations', authenticate, cacheResponse(() => 'registrations_all', 60), async (req, res) => {
    try {
        const registrations = await Registration.find().sort({ registeredAt: -1 });
        res.json({
            success: true,
            count: registrations.length,
            data: registrations
        });
    } catch (error) {
        console.error('Error fetching registrations:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching registrations',
            error: error.message
        });
    }
});

// Get single registration by ID (API) - Requires authentication
app.get('/api/registrations/:id', authenticate, cacheResponse((req) => `registration_${req.params.id}`, 120), async (req, res) => {
    try {
        const registration = await Registration.findById(req.params.id);

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
    } catch (error) {
        console.error('Error fetching registration:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid registration ID'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Error fetching registration',
            error: error.message
        });
    }
});

// ==================== CONTACTS CRUD API ====================

// Get all contacts (READ) - Requires authentication
app.get('/api/contacts', authenticate, cacheResponse(() => 'contacts_all', 60), async (req, res) => {
    try {
        const contacts = await Contact.find().sort({ submittedAt: -1 });
        res.json({
            success: true,
            count: contacts.length,
            data: contacts
        });
    } catch (error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching contacts',
            error: error.message
        });
    }
});

// Get single contact by ID (READ) - Requires authentication
app.get('/api/contacts/:id', authenticate, cacheResponse((req) => `contact_${req.params.id}`, 120), async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id);

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        res.json({
            success: true,
            data: contact
        });
    } catch (error) {
        console.error('Error fetching contact:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid contact ID'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Error fetching contact',
            error: error.message
        });
    }
});

// Create a new contact (CREATE) - Public endpoint
app.post('/api/contacts', async (req, res) => {
    try {
        const { name, email, subject, message, status } = req.body;

        // Validation
        if (!name || !email || !message) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and message are required'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        const newContact = new Contact({
            name,
            email: email.toLowerCase(),
            subject: subject || 'No subject',
            message,
            status: status || 'pending'
        });

        await newContact.save();

        invalidateCacheKeys('contacts_all', `contact_${newContact._id}`);

        console.log('✅ New contact created via API:', newContact._id);

        res.status(201).json({
            success: true,
            message: 'Contact created successfully',
            data: newContact
        });

    } catch (error) {
        console.error('❌ Contact creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during contact creation',
            error: error.message
        });
    }
});

// Update contact by ID (UPDATE - PUT) - Requires authentication
app.put('/api/contacts/:id', authenticate, async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id);

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        const { name, email, subject, message, status } = req.body;

        // Email validation if provided
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email format'
                });
            }
            contact.email = email.toLowerCase();
        }

        if (name) contact.name = name;
        if (subject !== undefined) contact.subject = subject || 'No subject';
        if (message) contact.message = message;
        if (status) contact.status = status;

        await contact.save();

        invalidateCacheKeys('contacts_all', `contact_${contact._id}`);

        console.log('✅ Contact updated:', contact._id);

        res.json({
            success: true,
            message: 'Contact updated successfully',
            data: contact
        });

    } catch (error) {
        console.error('❌ Contact update error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid contact ID'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error during contact update',
            error: error.message
        });
    }
});

// Update contact by ID (PATCH - partial update) - Requires authentication
app.patch('/api/contacts/:id', authenticate, async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id);

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }
        
        // Only update provided fields
        Object.keys(req.body).forEach(key => {
            if (key !== 'id' && key !== 'submittedAt' && key !== '_id') {
                if (key === 'email' && req.body[key]) {
                    contact[key] = req.body[key].toLowerCase();
                } else {
                    contact[key] = req.body[key];
                }
            }
        });

        await contact.save();

        invalidateCacheKeys('contacts_all', `contact_${contact._id}`);

        console.log('✅ Contact patched:', contact._id);

        res.json({
            success: true,
            message: 'Contact updated successfully',
            data: contact
        });

    } catch (error) {
        console.error('❌ Contact patch error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid contact ID'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error during contact update',
            error: error.message
        });
    }
});

// Delete contact by ID (DELETE) - Requires admin authentication
app.delete('/api/contacts/:id', authenticate, isAdmin, async (req, res) => {
    try {
        const contact = await Contact.findByIdAndDelete(req.params.id);

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        invalidateCacheKeys('contacts_all', `contact_${contact._id}`);

        res.json({
            success: true,
            message: 'Contact deleted successfully',
            data: contact
        });

    } catch (error) {
        console.error('Error deleting contact:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid contact ID'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Error deleting contact',
            error: error.message
        });
    }
});

// Update registration by ID (PUT - full update) - Requires authentication
app.put('/api/registrations/:id', authenticate, async (req, res) => {
    try {
        const registration = await Registration.findById(req.params.id);

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        const {
            fullName,
            email,
            phone,
            dob,
            age,
            country,
            gender,
            interests,
            bio,
            firstName,
            lastName,
            username,
            occupation,
            company,
            experience,
            skills,
            linkedin,
            portfolio,
            education,
            newsletter
        } = req.body;

        // Email validation if provided
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email format'
                });
            }

            // Check if email is already taken by another user
            const existingUser = await Registration.findOne({ 
                email: email.toLowerCase(), 
                _id: { $ne: req.params.id } 
            });
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: 'Email already registered to another user'
                });
            }
            registration.email = email.toLowerCase();
        }

        // Update fields
        if (fullName) registration.fullName = fullName;
        if (phone !== undefined) registration.phone = phone || undefined;
        if (dob !== undefined) registration.dob = dob || undefined;
        if (age !== undefined) registration.age = age ? parseInt(age) : undefined;
        if (country) registration.country = country;
        if (gender !== undefined) registration.gender = gender || undefined;
        if (interests !== undefined) {
            registration.interests = Array.isArray(interests) ? interests : (interests ? [interests] : []);
        }
        if (bio !== undefined) registration.bio = bio || undefined;
        if (firstName) registration.firstName = firstName;
        if (lastName) registration.lastName = lastName;
        if (firstName && lastName) registration.fullName = `${firstName} ${lastName}`;
        if (username) registration.username = username;
        if (occupation !== undefined) registration.occupation = occupation || undefined;
        if (company !== undefined) registration.company = company || undefined;
        if (experience !== undefined) registration.experience = experience ? parseInt(experience) : 0;
        if (skills !== undefined) {
            registration.skills = Array.isArray(skills) ? skills : (skills ? [skills] : []);
        }
        if (linkedin !== undefined) registration.linkedin = linkedin || undefined;
        if (portfolio !== undefined) registration.portfolio = portfolio || undefined;
        if (education !== undefined) registration.education = education || undefined;
        if (newsletter !== undefined) {
            registration.newsletter = Array.isArray(newsletter) ? newsletter : (newsletter ? [newsletter] : []);
        }

        await registration.save();

        invalidateCacheKeys('registrations_all', `registration_${registration._id}`);

        console.log('✅ Registration updated:', registration._id);

        res.json({
            success: true,
            message: 'Registration updated successfully',
            data: registration
        });

    } catch (error) {
        console.error('❌ Update error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid registration ID'
            });
        }
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Email or username already exists'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error during update',
            error: error.message
        });
    }
});

// Update registration by ID (PATCH - partial update) - Requires authentication
app.patch('/api/registrations/:id', authenticate, async (req, res) => {
    try {
        const registration = await Registration.findById(req.params.id);

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }
        
        // Only update provided fields
        Object.keys(req.body).forEach(key => {
            if (key !== 'id' && key !== 'registeredAt' && key !== '_id') {
                if (key === 'interests' || key === 'skills' || key === 'newsletter') {
                    registration[key] = Array.isArray(req.body[key]) 
                        ? req.body[key] 
                        : (req.body[key] ? [req.body[key]] : []);
                } else if (key === 'experience' || key === 'age') {
                    registration[key] = req.body[key] ? parseInt(req.body[key]) : undefined;
                } else if (key === 'email' && req.body[key]) {
                    registration[key] = req.body[key].toLowerCase();
                } else {
                    registration[key] = req.body[key];
                }
            }
        });

        // Update fullName if firstName or lastName changed
        if (req.body.firstName || req.body.lastName) {
            const firstName = req.body.firstName || registration.firstName || '';
            const lastName = req.body.lastName || registration.lastName || '';
            if (firstName || lastName) {
                registration.fullName = `${firstName} ${lastName}`.trim();
            }
        }

        await registration.save();

        invalidateCacheKeys('registrations_all', `registration_${registration._id}`);

        console.log('✅ Registration patched:', registration._id);

        res.json({
            success: true,
            message: 'Registration updated successfully',
            data: registration
        });

    } catch (error) {
        console.error('❌ Patch error:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid registration ID'
            });
        }
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Email or username already exists'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error during update',
            error: error.message
        });
    }
});

// Create a simple registration (POST /api/registrations) - Public endpoint
app.post('/api/registrations', async (req, res) => {
    try {
        const {
            fullName,
            email,
            phone,
            dob,
            age,
            country,
            gender,
            interests,
            bio
        } = req.body;

        // Validation
        if (!fullName || !email || !country) {
            return res.status(400).json({
                success: false,
                message: 'Full name, email, and country are required'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Check if email already exists in database
        const existingUser = await Registration.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Create new registration in database
        const newRegistration = new Registration({
            fullName,
            email: email.toLowerCase(),
            phone: phone || undefined,
            dob: dob || undefined,
            age: age ? parseInt(age) : undefined,
            country,
            gender: gender || undefined,
            interests: Array.isArray(interests) ? interests : (interests ? [interests] : []),
            bio: bio || undefined
        });

        await newRegistration.save();

        try {
            await emailQueue.add('welcomeEmail', {
                email: newRegistration.email,
                fullName: newRegistration.fullName || fullName
            }, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 5000
                }
            });
        } catch (queueError) {
            console.error('Queue error (welcome email):', queueError.message);
        }

        invalidateCacheKeys('registrations_all', `registration_${newRegistration._id}`);

        console.log('✅ New registration created via API:', newRegistration._id);

        res.status(201).json({
            success: true,
            message: 'Registration created successfully',
            data: newRegistration
        });

    } catch (error) {
        console.error('❌ Create error:', error);
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Email already registered'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Server error during creation',
            error: error.message
        });
    }
});

// Delete registration - Requires admin authentication
app.delete('/api/registrations/:id', authenticate, isAdmin, async (req, res) => {
    try {
        const registration = await Registration.findByIdAndDelete(req.params.id);

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        invalidateCacheKeys('registrations_all', `registration_${registration._id}`);

        res.json({
            success: true,
            message: 'Registration deleted successfully',
            data: registration
        });

    } catch (error) {
        console.error('Error deleting registration:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid registration ID'
            });
        }
        res.status(500).json({
            success: false,
            message: 'Error deleting registration',
            error: error.message
        });
    }
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
            error: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
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
    console.log('\nAPI Endpoints (CRUD Operations):');
    console.log('\n📝 Registrations API:');
    console.log(`  • POST   http://localhost:${PORT}/api/registrations     - Create registration`);
    console.log(`  • GET    http://localhost:${PORT}/api/registrations     - Get all registrations (Auth)`);
    console.log(`  • GET    http://localhost:${PORT}/api/registrations/:id - Get single registration (Auth)`);
    console.log(`  • PUT    http://localhost:${PORT}/api/registrations/:id - Update registration (Auth)`);
    console.log(`  • PATCH  http://localhost:${PORT}/api/registrations/:id - Partial update (Auth)`);
    console.log(`  • DELETE http://localhost:${PORT}/api/registrations/:id - Delete registration (Admin)`);
    console.log('\n📧 Contacts API:');
    console.log(`  • POST   http://localhost:${PORT}/api/contacts     - Create contact`);
    console.log(`  • GET    http://localhost:${PORT}/api/contacts     - Get all contacts (Auth)`);
    console.log(`  • GET    http://localhost:${PORT}/api/contacts/:id - Get single contact (Auth)`);
    console.log(`  • PUT    http://localhost:${PORT}/api/contacts/:id - Update contact (Auth)`);
    console.log(`  • PATCH  http://localhost:${PORT}/api/contacts/:id - Partial update (Auth)`);
    console.log(`  • DELETE http://localhost:${PORT}/api/contacts/:id - Delete contact (Admin)`);
    console.log('\n🔐 Authentication API:');
    console.log(`  • POST   http://localhost:${PORT}/api/auth/register - Register user`);
    console.log(`  • POST   http://localhost:${PORT}/api/auth/login    - Login user`);
    console.log('═══════════════════════════════════════════════════');
});