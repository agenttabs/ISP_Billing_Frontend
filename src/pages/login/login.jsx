// Updated pages/login/login.js - Complete working version
import React, { useState } from 'react';
import {
  Container,
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  IconButton,
  InputAdornment,
  Checkbox,
  FormControlLabel,
  Divider,
  Alert,
  CircularProgress,
  Fade,
  useTheme,
  alpha,
  Avatar,
  Stack,
  Link
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  LockOutlined,
  PersonOutline,
  Google,
  Facebook
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Login = ({ onLoginSuccess }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    rememberMe: false
  });

  const handleChange = (e) => {
    const { name, value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'rememberMe' ? checked : value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('Attempting login...');
      
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        username: formData.username,
        password: formData.password
      });

      console.log('Full response:', response);
      console.log('Response data:', response.data);

      if (response.data && response.data.token) {
        // Store token
        localStorage.setItem('token', response.data.token);
        
        // Create user object
        const userData = {
          username: formData.username,
          userType: response.data.role || 'cashier' // Default to cashier if role missing
        };
        
        console.log('Storing user data:', userData);
        localStorage.setItem('user', JSON.stringify(userData));
        
        if (formData.rememberMe) {
          localStorage.setItem('rememberMe', 'true');
        }
        
        // Call the callback
        if (onLoginSuccess) {
          onLoginSuccess(userData);
        }
        
        // Redirect based on role
        console.log('Redirecting based on role:', response.data.role);
        if (response.data.role === 'admin') {
          navigate('/dashboard');
        } else {
          navigate('/clients');
        }
      } else {
        console.error('No token in response:', response.data);
        setError('Invalid response from server');
      }
    } catch (err) {
      console.error('Login error:', err);
      console.error('Error response:', err.response);
      
      if (err.response) {
        setError(err.response.data?.error || 'Login failed. Please check your credentials.');
      } else if (err.request) {
        setError('Cannot connect to server. Please make sure the backend is running.');
      } else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.95)} 0%, ${alpha(theme.palette.secondary.dark, 0.9)} 100%)`,
      }}
    >
      <Container maxWidth="sm">
        <Fade in timeout={800}>
          <Paper
            elevation={24}
            sx={{
              p: { xs: 3, sm: 5 },
              borderRadius: 4,
              background: alpha(theme.palette.background.paper, 0.95),
              backdropFilter: 'blur(10px)',
            }}
          >
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Avatar
                sx={{
                  width: 70,
                  height: 70,
                  mx: 'auto',
                  mb: 2,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                }}
              >
                <LockOutlined sx={{ fontSize: 40 }} />
              </Avatar>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                ISP Billing System
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Welcome back! Please login to your account
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <TextField
                fullWidth
                label="Username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutline color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                fullWidth
                label="Password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleChange}
                required
                sx={{ mb: 1 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onChange={handleChange}
                      color="primary"
                    />
                  }
                  label="Remember me"
                />
                <Link href="#" variant="body2" underline="hover">
                  Forgot password?
                </Link>
              </Box>

              <Button
                fullWidth
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Login'}
              </Button>
            </form>

            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Don't have an account?{' '}
                <Link
                  component="button"
                  variant="body2"
                  onClick={() => navigate('/signup')}
                  underline="hover"
                  sx={{ fontWeight: 'bold' }}
                >
                  Sign up
                </Link>
              </Typography>
            </Box>
          </Paper>
        </Fade>
      </Container>
    </Box>
  );
};

export default Login;