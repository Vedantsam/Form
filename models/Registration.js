const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
    // Personal Info
    firstName: {
        type: String,
        trim: true
    },
    lastName: {
        type: String,
        trim: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
    },
    phone: {
        type: String,
        trim: true
    },
    dob: {
        type: Date
    },
    age: {
        type: Number,
        min: 0,
        max: 150
    },
    country: {
        type: String,
        trim: true
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other', 'prefer-not-to-say'],
        trim: true
    },
    
    // Account Info
    username: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        minlength: 3,
        maxlength: 20
    },
    
    // Professional Info
    occupation: {
        type: String,
        trim: true
    },
    company: {
        type: String,
        trim: true
    },
    experience: {
        type: Number,
        default: 0,
        min: 0,
        max: 50
    },
    skills: [{
        type: String,
        trim: true
    }],
    linkedin: {
        type: String,
        trim: true
    },
    portfolio: {
        type: String,
        trim: true
    },
    education: {
        type: String,
        enum: ['high-school', 'bachelors', 'masters', 'phd'],
        trim: true
    },
    
    // Preferences
    interests: [{
        type: String,
        trim: true
    }],
    bio: {
        type: String,
        maxlength: 500,
        trim: true
    },
    newsletter: [{
        type: String,
        trim: true
    }],
    
    // Metadata
    registeredAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true // Automatically adds createdAt and updatedAt
});

// Update the updatedAt field before saving
registrationSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Registration', registrationSchema);

