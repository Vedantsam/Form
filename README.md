# 🎨 Advanced Multi-Step Registration Form

A modern, feature-rich registration form with **5-step navigation**, **real-time validation**, and **RESTful API integration**. Built with HTML5, CSS3, Inline JavaScript, and Node.js/Express.

![Status](https://img.shields.io/badge/Status-Complete-success)
![Node](https://img.shields.io/badge/Node-%3E%3D14.0.0-green)

---

## ✨ Features

- **Multi-Step Navigation** - 5 steps with progress bar and smooth transitions
- **Inline JavaScript Validation** - Real-time email, password, phone, and age validation
- **Password Strength Meter** - Visual indicator (Weak/Medium/Strong)
- **Dynamic Components** - Tag input for skills, drag-and-drop file upload, range slider
- **Auto-Formatting** - Phone numbers format to (XXX) XXX-XXXX automatically
- **RESTful API** - Express backend with CORS support and JSON responses
- **Review Page** - Summary of all data before submission
- **Modern UI** - Gradient backgrounds, animations, and hover effects

---

## 🛠️ Technologies

**Frontend:** HTML5, CSS3, Vanilla JavaScript (Inline)  
**Backend:** Node.js, Express.js, CORS, EJS  
**Storage:** In-memory (for demo purposes)

---

## 📦 Installation

```bash
# Clone repository
git clone https://github.com/yourusername/advanced-registration-form.git
cd advanced-registration-form

# Install dependencies
npm install express cors ejs

# Start server
node server.js

# Access at http://localhost:3000
```

---

## 🔌 API Endpoints

### `POST /api/register`
Register new user with complete profile data

**Request:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "username": "johndoe",
  "password": "SecurePass123",
  "occupation": "Developer",
  "skills": ["JavaScript", "Node.js"],
  "interests": ["technology"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Registration successful!",
  "data": { "id": 3, "fullName": "John Doe", "username": "johndoe" }
}
```

### Other Endpoints
- `GET /api/registrations` - Get all registrations
- `GET /api/registrations/:id` - Get single registration
- `DELETE /api/registrations/:id` - Delete registration

---

## ✅ Form Validation

| Field | Rules |
|-------|-------|
| Name | Required, non-empty |
| Email | Valid email format with real-time check |
| Phone | Auto-formats, required |
| Age | Must be 18+ |
| Username | 3-20 characters |
| Password | Min 8 characters, strength indicator |
| Interests | At least one required |

---

## 🎯 Key Features

**Skills Tag System** - Type and press Enter to add, click × to remove  
**File Upload** - Drag & drop or click, shows file size and preview  
**Password Strength** - Checks length, uppercase, lowercase, numbers, special chars  
**Character Counter** - Real-time tracking for bio field (500 max)  
**Age Verification** - Automatically calculates age from date of birth

---

## 🚀 Usage

1. **Open form** at `http://localhost:3000` or open `form.html` directly
2. **Fill 5 steps**: Personal Info → Account Setup → Professional Details → Preferences → Review
3. **Submit** - Data sent to `/api/register` endpoint
4. **View data** at `/api/registrations` or check browser console

---

## 🔧 Customization

**Change Colors:**
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

**Change Port:**
```javascript
const PORT = process.env.PORT || 3000;
```

**Add Database:** Replace in-memory `registrations` array with MongoDB/PostgreSQL

---

## ⚠️ Notes

- Passwords stored in plain text (use bcrypt in production)
- In-memory storage resets on server restart
- File uploads handled client-side only
- CORS enabled for development

---

## 👤 Author

**Vedant**  
GitHub: [@Vedantsam](https://github.com/Vedantsam)  
Email: vedantvtst@gmail.com

---

⭐ **Star this repo if you found it helpful!**
