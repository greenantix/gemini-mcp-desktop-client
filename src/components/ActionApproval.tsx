import React from 'react';
import { 
  Paper, 
  Typography, 
  Box, 
  Button, 
  Chip, 
  List, 
  ListItem, 
  ListItemText, 
  ListItemSecondaryAction,
  IconButton,
  Divider,
  useTheme
} from '@mui/material';
import { 
  CheckCircle as ApproveIcon, 
  Cancel as DenyIcon, 
  Visibility as PreviewIcon 
} from '@mui/icons-material';

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';

interface SmartAction {
  type: 'read_file' | 'write_file' | 'replace_in_file' | 'search_files' | 'execute_command';
  description: string;
  params: Record<string, unknown>; // More specific than any
  safety: 'safe' | 'requires_approval' | 'dangerous';
  target?: string;
}

interface ActionApprovalProps {
  actions: SmartAction[];
  onApprove: (actionIndex: number) => void;
  onDeny: (actionIndex: number) => void;
  onPreview: (actionIndex: number) => void;
  onApproveAll: () => void;
  onDenyAll: () => void;
}

const ActionApproval: React.FC<ActionApprovalProps> = ({ 
  actions, 
  onApprove, 
  onDeny, 
  onPreview,
  onApproveAll,
  onDenyAll 
}) => {
  const theme = useTheme();
  
  if (actions.length === 0) {
    return null;
  }

  const getSafetyColor = (safety: string): ChipColor => {
    switch (safety) {
      case 'safe': return 'success';
      case 'requires_approval': return 'warning';
      case 'dangerous': return 'error';
      default: return 'default';
    }
  };

  const getSafetyIcon = (safety: string) => {
    switch (safety) {
      case 'safe': return '✅';
      case 'requires_approval': return '⚠️';
      case 'dangerous': return '🚨';
      default: return '❓';
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'read_file': return '📖';
      case 'write_file': return '✏️';
      case 'replace_in_file': return '🔄';
      case 'search_files': return '🔍';
      case 'execute_command': return '⚡';
      default: return '🛠️';
    }
  };

  return (
    <Paper sx={{ p: 2, mt: 2, backgroundColor: 'background.paper', border: `1px solid ${theme.palette.divider}` }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6" sx={{ color: 'primary.main' }}>
          🛠️ Proposed Actions ({actions.length})
        </Typography>
        <Box>
          <Button 
            size="small" 
            variant="contained" 
            color="success" 
            onClick={onApproveAll}
            sx={{ mr: 1 }}
          >
            Approve All
          </Button>
          <Button 
            size="small" 
            variant="outlined" 
            color="error" 
            onClick={onDenyAll}
          >
            Deny All
          </Button>
        </Box>
      </Box>

      <List>
        {actions.map((action, index) => (
          <React.Fragment key={index}>
            <ListItem
              sx={{
                backgroundColor: action.safety === 'dangerous' ? theme.palette.action.hover : 
                                action.safety === 'requires_approval' ? 'rgba(250, 164, 26, 0.1)' : 
                                'rgba(115, 196, 143, 0.1)',
                borderRadius: 1,
                mb: 1
              }}
            >
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" component="span">
                      {getActionIcon(action.type)}
                    </Typography>
                    <Typography variant="body1" component="span" sx={{ color: 'text.primary' }}>
                      {action.description}
                    </Typography>
                    <Chip
                      label={action.type}
                      size="small"
                      variant="outlined"
                      sx={{ color: 'text.secondary', borderColor: theme.palette.divider }}
                    />
                    <Chip
                      label={`${getSafetyIcon(action.safety)} ${action.safety}`}
                      size="small"
                      color={getSafetyColor(action.safety)}
                    />
                  </Box>
                }
                secondary={
                  action.target && (
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                      Target: {action.target}
                    </Typography>
                  )
                }
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  onClick={() => onPreview(index)}
                  sx={{ color: 'secondary.main', mr: 1 }}
                  title="Preview"
                >
                  <PreviewIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  onClick={() => onApprove(index)}
                  sx={{ color: 'success.main', mr: 1 }}
                  title="Approve"
                >
                  <ApproveIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  onClick={() => onDeny(index)}
                  sx={{ color: 'error.main' }}
                  title="Deny"
                >
                  <DenyIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
            {index < actions.length - 1 && <Divider sx={{ backgroundColor: theme.palette.divider }} />}
          </React.Fragment>
        ))}
      </List>

      <Box mt={2} p={1} sx={{ backgroundColor: 'rgba(250, 164, 26, 0.1)', borderRadius: 1 }}>
        <Typography variant="body2" sx={{ color: 'primary.main' }}>
          💡 <strong>Smart Actions</strong> will be executed in sequence. Actions marked as "requires_approval" or "dangerous" need your explicit approval.
        </Typography>
      </Box>
    </Paper>
  );
};

export default ActionApproval;