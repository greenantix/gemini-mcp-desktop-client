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
  Divider
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
    <Paper sx={{ p: 2, mt: 2, backgroundColor: '#1e1e1e', border: '1px solid #3a3a3a' }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6" sx={{ color: '#ff6b35' }}>
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
                backgroundColor: action.safety === 'dangerous' ? 'rgba(244, 67, 54, 0.1)' : 
                                action.safety === 'requires_approval' ? 'rgba(255, 152, 0, 0.1)' : 
                                'rgba(76, 175, 80, 0.1)',
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
                    <Typography variant="body1" component="span" sx={{ color: '#ffffff' }}>
                      {action.description}
                    </Typography>
                    <Chip
                      label={action.type}
                      size="small"
                      variant="outlined"
                      sx={{ color: '#cccccc', borderColor: '#666666' }}
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
                    <Typography variant="body2" sx={{ color: '#bbbbbb', mt: 0.5 }}>
                      Target: {action.target}
                    </Typography>
                  )
                }
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  onClick={() => onPreview(index)}
                  sx={{ color: '#00bcd4', mr: 1 }}
                  title="Preview"
                >
                  <PreviewIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  onClick={() => onApprove(index)}
                  sx={{ color: '#4caf50', mr: 1 }}
                  title="Approve"
                >
                  <ApproveIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  onClick={() => onDeny(index)}
                  sx={{ color: '#f44336' }}
                  title="Deny"
                >
                  <DenyIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
            {index < actions.length - 1 && <Divider sx={{ backgroundColor: '#3a3a3a' }} />}
          </React.Fragment>
        ))}
      </List>

      <Box mt={2} p={1} sx={{ backgroundColor: 'rgba(255, 107, 53, 0.1)', borderRadius: 1 }}>
        <Typography variant="body2" sx={{ color: '#ff6b35' }}>
          💡 <strong>Smart Actions</strong> will be executed in sequence. Actions marked as "requires_approval" or "dangerous" need your explicit approval.
        </Typography>
      </Box>
    </Paper>
  );
};

export default ActionApproval;