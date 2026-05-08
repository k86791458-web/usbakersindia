"""
Security Improvements for USBakersIndia CRM
Rate limiting, password policies, session management
"""
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timedelta
from collections import defaultdict
import re
from typing import Dict
import secrets

# ==================== RATE LIMITING ====================

class RateLimiter:
    """Simple in-memory rate limiter"""
    
    def __init__(self):
        self.requests: Dict[str, list] = defaultdict(list)
    
    def is_rate_limited(self, key: str, max_requests: int = 100, window_seconds: int = 60) -> bool:
        """
        Check if key is rate limited
        key: IP address or user ID
        max_requests: Maximum requests allowed
        window_seconds: Time window in seconds
        """
        now = datetime.utcnow()
        cutoff = now - timedelta(seconds=window_seconds)
        
        # Clean old requests
        self.requests[key] = [
            req_time for req_time in self.requests[key]
            if req_time > cutoff
        ]
        
        # Check if limit exceeded
        if len(self.requests[key]) >= max_requests:
            return True
        
        # Add current request
        self.requests[key].append(now)
        return False

# Global rate limiter instance
rate_limiter = RateLimiter()

async def check_rate_limit(request: Request, max_requests: int = 100, window: int = 60):
    """Rate limit middleware"""
    client_ip = request.client.host
    
    if rate_limiter.is_rate_limited(client_ip, max_requests, window):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later."
        )

# ==================== PASSWORD POLICY ====================

class PasswordPolicy:
    """Enforce strong password requirements"""
    
    @staticmethod
    def validate_password(password: str) -> tuple[bool, list]:
        """
        Validate password strength
        Returns: (is_valid, list_of_errors)
        """
        errors = []
        
        # Minimum length
        if len(password) < 8:
            errors.append("Password must be at least 8 characters long")
        
        # Maximum length
        if len(password) > 128:
            errors.append("Password must not exceed 128 characters")
        
        # Must contain uppercase
        if not re.search(r'[A-Z]', password):
            errors.append("Password must contain at least one uppercase letter")
        
        # Must contain lowercase
        if not re.search(r'[a-z]', password):
            errors.append("Password must contain at least one lowercase letter")
        
        # Must contain digit
        if not re.search(r'\d', password):
            errors.append("Password must contain at least one number")
        
        # Must contain special character
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            errors.append("Password must contain at least one special character (!@#$%^&*...)")
        
        # Check common passwords
        common_passwords = [
            'password', '12345678', 'qwerty', 'abc123', 'password123',
            'admin', 'letmein', 'welcome', 'monkey', '1234567890'
        ]
        if password.lower() in common_passwords:
            errors.append("Password is too common. Please choose a stronger password")
        
        return (len(errors) == 0, errors)

# ==================== SESSION MANAGEMENT ====================

class SessionManager:
    """Manage user sessions with timeout"""
    
    def __init__(self):
        self.sessions: Dict[str, dict] = {}
        self.session_timeout_minutes = 60  # 1 hour
    
    def create_session(self, user_id: str, token: str) -> str:
        """Create new session"""
        session_id = secrets.token_urlsafe(32)
        
        self.sessions[session_id] = {
            'user_id': user_id,
            'token': token,
            'created_at': datetime.utcnow(),
            'last_activity': datetime.utcnow(),
            'ip_address': None
        }
        
        return session_id
    
    def validate_session(self, session_id: str) -> tuple[bool, str]:
        """
        Validate session is active and not expired
        Returns: (is_valid, error_message)
        """
        if session_id not in self.sessions:
            return (False, "Invalid session")
        
        session = self.sessions[session_id]
        last_activity = session['last_activity']
        
        # Check if session expired
        if datetime.utcnow() - last_activity > timedelta(minutes=self.session_timeout_minutes):
            del self.sessions[session_id]
            return (False, "Session expired. Please login again")
        
        # Update last activity
        session['last_activity'] = datetime.utcnow()
        return (True, "")
    
    def invalidate_session(self, session_id: str):
        """Logout - invalidate session"""
        if session_id in self.sessions:
            del self.sessions[session_id]
    
    def cleanup_expired_sessions(self):
        """Remove expired sessions"""
        now = datetime.utcnow()
        expired = [
            sid for sid, sess in self.sessions.items()
            if now - sess['last_activity'] > timedelta(minutes=self.session_timeout_minutes)
        ]
        for sid in expired:
            del self.sessions[sid]

# Global session manager
session_manager = SessionManager()

# ==================== INPUT SANITIZATION ====================

def sanitize_string(input_str: str, max_length: int = 255) -> str:
    """
    Sanitize user input to prevent XSS and injection attacks
    """
    if not input_str:
        return ""
    
    # Remove null bytes
    cleaned = input_str.replace('\x00', '')
    
    # Limit length
    cleaned = cleaned[:max_length]
    
    # Remove dangerous characters for XSS
    dangerous_chars = ['<', '>', '"', "'", '&', '`']
    for char in dangerous_chars:
        cleaned = cleaned.replace(char, '')
    
    # Remove SQL injection patterns (basic)
    sql_patterns = ['--', ';--', '/*', '*/', 'xp_', 'sp_', 'UNION', 'SELECT', 'DROP', 'INSERT', 'DELETE', 'UPDATE']
    for pattern in sql_patterns:
        cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
    
    return cleaned.strip()

def sanitize_phone(phone: str) -> str:
    """Extract only digits from phone number"""
    return re.sub(r'\D', '', phone)

def sanitize_email(email: str) -> str:
    """Basic email sanitization"""
    if not email:
        return ""
    
    email = email.lower().strip()
    
    # Basic email validation
    if not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
        raise ValueError("Invalid email format")
    
    return email

# ==================== CSRF PROTECTION ====================

def generate_csrf_token() -> str:
    """Generate CSRF token"""
    return secrets.token_urlsafe(32)

def validate_csrf_token(token: str, stored_token: str) -> bool:
    """Validate CSRF token"""
    return secrets.compare_digest(token, stored_token)

# ==================== IP WHITELISTING ====================

class IPWhitelist:
    """IP whitelisting for admin panel"""
    
    def __init__(self):
        # Add your office/VPN IPs here
        self.whitelisted_ips = [
            '127.0.0.1',  # Localhost
            '::1',        # IPv6 localhost
            # Add more IPs as needed
        ]
    
    def is_whitelisted(self, ip: str) -> bool:
        """Check if IP is whitelisted"""
        return ip in self.whitelisted_ips or not self.whitelisted_ips
    
    def add_ip(self, ip: str):
        """Add IP to whitelist"""
        if ip not in self.whitelisted_ips:
            self.whitelisted_ips.append(ip)
    
    def remove_ip(self, ip: str):
        """Remove IP from whitelist"""
        if ip in self.whitelisted_ips:
            self.whitelisted_ips.remove(ip)

# Global IP whitelist
ip_whitelist = IPWhitelist()

async def check_ip_whitelist(request: Request):
    """Check if request IP is whitelisted for admin actions"""
    client_ip = request.client.host
    
    if not ip_whitelist.is_whitelisted(client_ip):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. IP not whitelisted."
        )

# ==================== AUDIT LOGGING ====================

async def log_security_event(
    event_type: str,
    user_id: str,
    ip_address: str,
    details: dict
):
    """Log security events for audit"""
    # This would write to database or security log file
    log_entry = {
        'timestamp': datetime.utcnow().isoformat(),
        'event_type': event_type,  # login_failed, password_changed, suspicious_activity
        'user_id': user_id,
        'ip_address': ip_address,
        'details': details
    }
    
    # Log to database (implement as needed)
    # await db.security_logs.insert_one(log_entry)
    
    print(f"🔒 Security Event: {event_type} - User: {user_id} - IP: {ip_address}")
