# WhatsApp Clone - Real-time Messaging System

A comprehensive real-time messaging application built with Node.js, Socket.IO, PostgreSQL, and Redis. This project demonstrates modern system design principles including real-time communication, message queuing, user authentication, and scalable architecture.

## 🚀 Features

### Core Messaging Features
- ✅ **Real-time messaging** with Socket.IO
- ✅ **User authentication** with JWT tokens
- ✅ **Direct messages** and **group chats**
- ✅ **Message history** with pagination
- ✅ **Message delivery status** (sent, delivered, read)
- ✅ **Read receipts** and **typing indicators**
- ✅ **Message reactions** and **replies**
- ✅ **Message editing** and **deletion**
- ✅ **Message forwarding**
- ✅ **Search functionality** across messages
- ✅ **User status** (online, offline, away)

### System Design Features
- ✅ **Scalable architecture** with Redis pub/sub
- ✅ **Message queuing** with Bull queues
- ✅ **Database optimization** with proper indexing
- ✅ **Rate limiting** and security middleware
- ✅ **Graceful error handling**
- ✅ **Comprehensive logging**
- ✅ **Docker containerization**
- ✅ **Health monitoring**

### Frontend Features
- ✅ **Modern responsive UI** with CSS Grid/Flexbox
- ✅ **Real-time updates** without page refresh
- ✅ **Progressive Web App** capabilities
- ✅ **Mobile-first design**
- ✅ **Smooth animations** and transitions

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (HTML/JS)     │◄──►│   (Node.js)     │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Socket.IO     │◄──►│   Redis Cache   │
                       │   (WebSockets)  │    │   & Pub/Sub     │
                       └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Message       │
                       │   Queues        │
                       │   (Bull/Redis)  │
                       └─────────────────┘
```

## 🛠️ Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Socket.IO** - Real-time communication
- **PostgreSQL** - Primary database
- **Sequelize** - ORM for database operations
- **Redis** - Caching and message queuing
- **Bull** - Job queue management
- **JWT** - Authentication tokens
- **bcrypt** - Password hashing
- **Winston** - Logging
- **Helmet** - Security middleware

### Frontend
- **HTML5** - Markup
- **CSS3** - Styling with modern features
- **Vanilla JavaScript** - Client-side logic
- **Socket.IO Client** - Real-time communication
- **Font Awesome** - Icons
- **Google Fonts** - Typography

### DevOps & Tools
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **Adminer** - Database administration
- **ESLint** - Code linting
- **Jest** - Testing framework

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

1. **Clone the repository**
```bash
git clone <repository-url>
cd whatsapp-clone
```

2. **Copy environment variables**
```bash
cp .env.example .env
```

3. **Start with Docker Compose**
```bash
docker-compose up -d
```

4. **Access the application**
- Application: http://localhost:3000
- Database Admin: http://localhost:8080

### Option 2: Manual Setup

1. **Install dependencies**
```bash
npm install
```

2. **Set up PostgreSQL database**
```sql
CREATE DATABASE whatsapp_clone;
CREATE USER postgres WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE whatsapp_clone TO postgres;
```

3. **Start Redis server**
```bash
redis-server
```

4. **Copy and configure environment**
```bash
cp .env.example .env
# Edit .env with your database and Redis configurations
```

5. **Run database migrations**
```bash
npm run migrate
```

6. **Start the application**
```bash
# Development
npm run dev

# Production
npm start
```

## 📁 Project Structure

```
whatsapp-clone/
├── src/
│   ├── config/           # Configuration files
│   │   ├── database.js   # Database configuration
│   │   └── redis.js      # Redis configuration
│   ├── controllers/      # Route controllers
│   │   ├── authController.js
│   │   ├── chatController.js
│   │   └── messageController.js
│   ├── middleware/       # Custom middleware
│   │   └── auth.js       # Authentication middleware
│   ├── models/           # Database models
│   │   ├── User.js
│   │   ├── Chat.js
│   │   ├── Message.js
│   │   ├── ChatMember.js
│   │   └── index.js
│   ├── routes/           # API routes
│   │   ├── auth.js
│   │   ├── chats.js
│   │   └── messages.js
│   ├── services/         # Business logic services
│   │   └── messageQueue.js
│   ├── socket/           # Socket.IO handlers
│   │   ├── socketAuth.js
│   │   └── socketHandlers.js
│   ├── utils/            # Utility functions
│   │   └── logger.js
│   └── server.js         # Main server file
├── public/               # Static files
│   ├── index.html        # Frontend HTML
│   └── js/
│       └── app.js        # Frontend JavaScript
├── logs/                 # Application logs
├── uploads/              # File uploads
├── docker-compose.yml    # Docker configuration
├── Dockerfile           # Container definition
├── package.json         # Dependencies
└── README.md            # Documentation
```

## 🔐 Authentication & Security

### JWT Authentication
- **Access tokens** (7 days expiry)
- **Refresh tokens** (30 days expiry)
- **Automatic token refresh**
- **Secure password hashing** with bcrypt

### Security Features
- **Rate limiting** (100 requests per 15 minutes)
- **CORS protection**
- **Helmet security headers**
- **Input validation** with express-validator
- **SQL injection prevention**
- **XSS protection**

## 📡 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepassword"
}
```

#### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "login": "john@example.com",
  "password": "securepassword"
}
```

### Chat Endpoints

#### Get User Chats
```http
GET /api/chats
Authorization: Bearer <token>
```

#### Create Chat
```http
POST /api/chats
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My Group Chat",
  "type": "group",
  "memberIds": ["user-id-1", "user-id-2"]
}
```

### Message Endpoints

#### Get Chat Messages
```http
GET /api/messages/{chatId}?page=1&limit=50
Authorization: Bearer <token>
```

#### Search Messages
```http
GET /api/messages/search?query=hello&page=1&limit=20
Authorization: Bearer <token>
```

## 🔌 WebSocket Events

### Client to Server Events

#### Send Message
```javascript
socket.emit('send_message', {
  chatId: 'chat-id',
  content: 'Hello world!',
  type: 'text'
});
```

#### Typing Indicators
```javascript
socket.emit('typing_start', { chatId: 'chat-id' });
socket.emit('typing_stop', { chatId: 'chat-id' });
```

### Server to Client Events

#### New Message
```javascript
socket.on('new_message', (message) => {
  // Handle new message
});
```

#### User Typing
```javascript
socket.on('user_typing', (data) => {
  // Handle typing indicator
});
```

## 🗄️ Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  avatar VARCHAR(500),
  status ENUM('online', 'offline', 'away') DEFAULT 'offline',
  last_seen TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  bio TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Messages Table
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id),
  sender_id UUID NOT NULL REFERENCES users(id),
  content TEXT,
  type ENUM('text', 'image', 'video', 'audio', 'file') DEFAULT 'text',
  metadata JSONB DEFAULT '{}',
  reply_to_id UUID REFERENCES messages(id),
  status ENUM('sending', 'sent', 'delivered', 'read') DEFAULT 'sending',
  reactions JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🚦 Performance & Scaling

### Database Optimization
- **Proper indexing** on frequently queried columns
- **Connection pooling** with Sequelize
- **Query optimization** with eager loading
- **Soft deletes** for data integrity

### Redis Caching
- **Session storage** for user authentication
- **Pub/Sub** for real-time message broadcasting
- **Job queues** for background processing
- **Rate limiting** storage

### Message Queuing
- **Bull queues** for message delivery
- **Retry mechanisms** with exponential backoff
- **Dead letter queues** for failed jobs
- **Queue monitoring** and statistics

## 🧪 Testing

### Run Tests
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Test coverage
npm run test:coverage
```

### Test Structure
```
tests/
├── unit/
│   ├── models/
│   ├── controllers/
│   └── services/
├── integration/
│   ├── auth.test.js
│   ├── chats.test.js
│   └── messages.test.js
└── fixtures/
    └── testData.js
```

## 📊 Monitoring & Logging

### Application Logs
- **Winston** for structured logging
- **Log levels**: error, warn, info, debug
- **Log rotation** and archival
- **Centralized logging** support

### Health Monitoring
```http
GET /health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2023-12-07T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

## 🔧 Configuration

### Environment Variables
```bash
# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_clone
DB_USER=postgres
DB_PASSWORD=password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🚀 Deployment

### Docker Production Deployment
```bash
# Build production image
docker build -t whatsapp-clone:latest .

# Run with production environment
docker run -d \
  --name whatsapp-clone \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e DB_HOST=your-db-host \
  -e REDIS_HOST=your-redis-host \
  whatsapp-clone:latest
```

### Manual Production Deployment
```bash
# Install production dependencies
npm ci --only=production

# Build assets (if applicable)
npm run build

# Start with PM2
pm2 start src/server.js --name whatsapp-clone

# Enable startup script
pm2 startup
pm2 save
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow ESLint configuration
- Write tests for new features
- Update documentation
- Use conventional commit messages

## 📈 Future Enhancements

- [ ] **File sharing** and media messages
- [ ] **Voice messages** and video calls
- [ ] **Push notifications** (Firebase/APNs)
- [ ] **Message encryption** (end-to-end)
- [ ] **User presence** with last seen
- [ ] **Chat backup** and export
- [ ] **Admin dashboard** and analytics
- [ ] **Mobile app** (React Native)
- [ ] **Desktop app** (Electron)
- [ ] **Message translation**
- [ ] **Chat bots** and integrations

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Socket.IO** team for real-time communication
- **Express.js** community for the web framework
- **PostgreSQL** team for the robust database
- **Redis** team for caching and queuing
- **Node.js** community for the runtime

## 📞 Support

For support, email support@example.com or join our Slack channel.

---

**Built with ❤️ for learning modern system design and real-time applications.**