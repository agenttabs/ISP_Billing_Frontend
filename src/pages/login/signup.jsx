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
  Alert,
  CircularProgress,
  Fade,
  useTheme,
  alpha,
  Avatar,
  Grid,
  Card,
  CardContent,
  RadioGroup,
  Radio,
  FormLabel,
  FormControl,
  Link
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  LockOutlined,
  PersonOutline,
  AdminPanelSettings,
  PointOfSale,
  CheckCircleOutline
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Signup = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    role: 'cashier' // 'admin' or 'cashier'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const validateForm = () => {
    if (!formData.username.trim()) {
      setError('Username is required');
      return false;
    }
    if (formData.username.length < 3) {
      setError('Username must be at least 3 characters');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:5000/api/auth/signup', {
        username: formData.username,
        password: formData.password,
        role: formData.role
      });

      if (response.data) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Box sx={styles.container}>
        <Container maxWidth="sm">
          <Paper sx={styles.paper}>
            <Box sx={{ textAlign: 'center' }}>
              <Avatar sx={styles.successAvatar}>
                <CheckCircleOutline sx={{ fontSize: 40 }} />
              </Avatar>
              <Typography variant="h5" gutterBottom fontWeight="bold">
                Registration Successful!
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Your account has been created successfully. Redirecting to login...
              </Typography>
              <CircularProgress size={30} />
            </Box>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={styles.container}>
      <Container maxWidth="md">
        <Fade in timeout={800}>
          <Paper elevation={24} sx={styles.paper}>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Avatar sx={styles.logoAvatar}>
                <LockOutlined sx={{ fontSize: 40 }} />
              </Avatar>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                Create Account
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Join ISP Billing System for seamless internet management
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  helperText="Username must be at least 3 characters"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonOutline color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  required
                  helperText="Password must be at least 6 characters"
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
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Confirm Password"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlined color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end">
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <FormControl component="fieldset">
                  <FormLabel component="legend" sx={{ mb: 2, color: 'text.primary' }}>
                    Select User Role
                  </FormLabel>
                  <RadioGroup
                    row
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                  >
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Card
                          sx={{
                            cursor: 'pointer',
                            border: formData.role === 'admin' ? `2px solid ${theme.palette.primary.main}` : '1px solid #e0e0e0',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              transform: 'translateY(-4px)',
                              boxShadow: 3
                            }
                          }}
                          onClick={() => setFormData(prev => ({ ...prev, role: 'admin' }))}
                        >
                          <CardContent sx={{ textAlign: 'center' }}>
                            <Radio
                              checked={formData.role === 'admin'}
                              value="admin"
                              name="role"
                              onChange={handleChange}
                              sx={{ mb: 1 }}
                            />
                            <AdminPanelSettings sx={{ fontSize: 48, color: theme.palette.primary.main, mb: 1 }} />
                            <Typography variant="h6" gutterBottom>
                              Administrator
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Full access to all pages and features
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Card
                          sx={{
                            cursor: 'pointer',
                            border: formData.role === 'cashier' ? `2px solid ${theme.palette.secondary.main}` : '1px solid #e0e0e0',
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              transform: 'translateY(-4px)',
                              boxShadow: 3
                            }
                          }}
                          onClick={() => setFormData(prev => ({ ...prev, role: 'cashier' }))}
                        >
                          <CardContent sx={{ textAlign: 'center' }}>
                            <Radio
                              checked={formData.role === 'cashier'}
                              value="cashier"
                              name="role"
                              onChange={handleChange}
                              sx={{ mb: 1 }}
                            />
                            <PointOfSale sx={{ fontSize: 48, color: theme.palette.secondary.main, mb: 1 }} />
                            <Typography variant="h6" gutterBottom>
                              Cashier
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Limited access to client pages only
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    </Grid>
                  </RadioGroup>
                </FormControl>
              </Grid>
            </Grid>

            <Box sx={{ mt: 4 }}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleSubmit}
                disabled={loading}
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  '&:hover': {
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign Up'}
              </Button>
            </Box>

            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Already have an account?{' '}
                <Link
                  component="button"
                  variant="body2"
                  onClick={() => navigate('/login')}
                  underline="hover"
                  sx={{ fontWeight: 'bold' }}
                >
                  Login here
                </Link>
              </Typography>
            </Box>
          </Paper>
        </Fade>
      </Container>
    </Box>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: (theme) => `linear-gradient(135deg, ${alpha(theme.palette.primary.dark, 0.95)} 0%, ${alpha(theme.palette.secondary.dark, 0.9)} 100%)`,
    position: 'relative',
    overflow: 'hidden',
  },
  paper: {
    p: { xs: 3, sm: 5 },
    borderRadius: 4,
    background: (theme) => alpha(theme.palette.background.paper, 0.95),
    backdropFilter: 'blur(10px)',
    border: (theme) => `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
    position: 'relative',
    zIndex: 1
  },
  logoAvatar: {
    width: 70,
    height: 70,
    mx: 'auto',
    mb: 2,
    background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
    boxShadow: (theme) => `0 8px 32px ${alpha(theme.palette.primary.main, 0.3)}`
  },
  successAvatar: {
    width: 80,
    height: 80,
    mx: 'auto',
    mb: 2,
    bgcolor: 'success.main',
    boxShadow: (theme) => `0 8px 32px ${alpha(theme.palette.success.main, 0.3)}`
  }
};

export default Signup;