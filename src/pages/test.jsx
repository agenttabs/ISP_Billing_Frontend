// pages/TestApi.js - Test your API connection
import React, { useState, useEffect } from 'react';
import { Box, Paper, Typography, Button, Alert, CircularProgress } from '@mui/material';
import axios from 'axios';

export default function TestApi() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const testApi = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      console.log('Testing API with token:', token);
      
      const response = await axios.get('http://localhost:5000/api/clients', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('API Response:', response);
      setResult(response.data);
    } catch (err) {
      console.error('API Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkAuth = () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    console.log('Token:', token);
    console.log('User:', user);
    alert(`Token: ${token ? 'Present' : 'Missing'}\nUser: ${user || 'Missing'}`);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>API Test</Typography>
      <Paper sx={{ p: 3, mb: 2 }}>
        <Box display="flex" gap={2} mb={2}>
          <Button variant="contained" onClick={testApi} disabled={loading}>
            Test API Connection
          </Button>
          <Button variant="outlined" onClick={checkAuth}>
            Check Auth Status
          </Button>
        </Box>
        
        {loading && <CircularProgress />}
        
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Error: {error}
          </Alert>
        )}
        
        {result && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6">API Response:</Typography>
            <pre style={{ background: '#f5f5f5', padding: 10, borderRadius: 4, overflow: 'auto' }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </Box>
        )}
      </Paper>
    </Box>
  );
}