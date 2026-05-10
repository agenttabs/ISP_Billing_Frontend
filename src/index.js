import React from 'react';
import ReactDOM from 'react-dom/client';
import { createTheme, CssBaseline, responsiveFontSizes, ThemeProvider } from '@mui/material';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { AuthProvider } from './context/auth.context';
import { ClientProvider } from './context/client.context';

let theme = createTheme({
  typography: {
    fontFamily: '"Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
    fontSize: 10.5,
    h3: {
      fontSize: '1.48rem',
      fontWeight: 700
    },
    h4: {
      fontSize: '1.22rem',
      fontWeight: 700
    },
    h5: {
      fontSize: '1rem',
      fontWeight: 700
    },
    h6: {
      fontSize: '0.86rem',
      fontWeight: 700
    },
    subtitle1: {
      fontSize: '0.78rem'
    },
    body1: {
      fontSize: '0.74rem'
    },
    body2: {
      fontSize: '0.69rem'
    },
    button: {
      fontSize: '0.72rem',
      fontWeight: 600,
      textTransform: 'none'
    }
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontSize: '10.5px',
          color: '#0f172a'
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        size: 'small'
      }
    },
    MuiFormControl: {
      defaultProps: {
        size: 'small'
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 10
        }
      }
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 14,
          '&:last-child': {
            paddingBottom: 14
          }
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 10
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '0.7rem',
          paddingTop: 6,
          paddingBottom: 6
        },
        head: {
          fontSize: '0.63rem',
          fontWeight: 700
        }
      }
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          minHeight: 30
        },
        input: {
          fontSize: '0.72rem'
        }
      }
    },
    MuiFormLabel: {
      styleOverrides: {
        root: {
          fontSize: '0.67rem'
        }
      }
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: '0.67rem'
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontSize: '0.63rem',
          height: 22
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          paddingTop: 5,
          paddingBottom: 5,
          minHeight: 30
        }
      }
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          padding: '10px 14px',
          fontSize: '0.82rem',
          fontWeight: 700
        }
      }
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: 14,
          fontSize: '0.82rem',
          overflowY: 'auto'
        }
      }
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '8px 14px 14px',
          gap: 8
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          width: '100%',
          maxWidth: 'min(980px, calc(100vw - 24px))',
          maxHeight: 'calc(100vh - 24px)',
          margin: 12,
          borderRadius: 14,
          '& .MuiTypography-root': {
            fontSize: '0.72rem !important',
            lineHeight: 1.45
          },
          '& .MuiTypography-h6': {
            fontSize: '0.84rem !important',
            lineHeight: 1.2
          },
          '& .MuiTypography-h5': {
            fontSize: '0.91rem !important',
            lineHeight: 1.2
          },
          '& .MuiTypography-h4': {
            fontSize: '0.99rem !important',
            lineHeight: 1.15
          },
          '& .MuiInputLabel-root, & .MuiFormLabel-root': {
            fontSize: '0.65rem !important'
          },
          '& .MuiInputBase-root': {
            minHeight: '30px !important'
          },
          '& .MuiInputBase-input': {
            fontSize: '0.69rem !important',
            paddingTop: '6px !important',
            paddingBottom: '6px !important'
          },
          '& .MuiFormHelperText-root': {
            fontSize: '0.61rem !important',
            marginTop: '3px !important'
          },
          '& .MuiButton-root': {
            fontSize: '0.67rem !important',
            paddingTop: '5px !important',
            paddingBottom: '5px !important'
          },
          '& .MuiChip-root': {
            fontSize: '0.59rem !important',
            height: '21px !important'
          },
          '& .MuiTableCell-root': {
            fontSize: '0.67rem !important',
            paddingTop: '5px !important',
            paddingBottom: '5px !important'
          },
          '& .MuiTableCell-head': {
            fontSize: '0.6rem !important'
          },
          '& .MuiPaper-root': {
            borderRadius: '8px !important'
          }
        },
        paperScrollPaper: {
          overflow: 'hidden'
        }
      }
    },
    MuiModal: {
      styleOverrides: {
        root: {
          '& .MuiBackdrop-root': {
            backdropFilter: 'blur(2px)'
          }
        }
      }
    },
    MuiListItemText: {
      styleOverrides: {
        primary: {
          fontSize: '0.72rem'
        },
        secondary: {
          fontSize: '0.65rem'
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          padding: 6
        }
      }
    },
    MuiDataGrid: {
      styleOverrides: {
        root: {
          fontSize: '0.7rem',
          '& .MuiDataGrid-columnHeaderTitle': {
            fontSize: '0.63rem',
            fontWeight: 700
          },
          '& .MuiDataGrid-cell': {
            fontSize: '0.7rem'
          }
        }
      }
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          '&.MuiDialogContentText-root': {
            fontSize: '0.7rem'
          }
        }
      }
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            paddingTop: 7,
            paddingBottom: 7
          }
        }
      }
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          minHeight: 34,
          fontSize: '0.7rem'
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '&.MuiInputBase-sizeSmall': {
            minHeight: 34
          }
        }
      }
    }
  }
});

theme = responsiveFontSizes(theme, {
  factor: 2.2
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <AuthProvider>
      <ClientProvider>
        <App />
      </ClientProvider>
    </AuthProvider>
  </ThemeProvider>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
