import { Box, Typography, Paper, Link, Avatar, useTheme, Chip, Stack } from '@mui/material';
import { ChatMessage, FileAttachment } from './types/types'; // Adjust path
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/atom-one-dark.css'; // Or your preferred theme
import { motion } from 'framer-motion';
import SmartToyIcon from '@mui/icons-material/SmartToy';
// Icons for file types
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import ImageIcon from '@mui/icons-material/Image';
import VideocamIcon from '@mui/icons-material/Videocam';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import AssessmentIcon from '@mui/icons-material/Assessment'; // for CSV, Excel
import FolderIcon from '@mui/icons-material/Folder';
import { alpha } from '@mui/material/styles';


interface Props {
  message: ChatMessage;
}

// Original markdownComponents
const markdownComponents = {
  p: ({node, ...props}: any) => <Typography variant="body2" paragraph sx={{ mb: 1, '&:last-child': { mb: 0 } }} {...props} />,
  h1: ({node, ...props}: any) => <Typography variant="h5" gutterBottom {...props} />,
  h2: ({node, ...props}: any) => <Typography variant="h6" gutterBottom {...props} />,
  h3: ({node, ...props}: any) => <Typography variant="subtitle1" gutterBottom {...props} />,
  ul: ({node, ...props}: any) => <Box component="ul" sx={{ pl: 2.5, my: 0.5 }} {...props} />,
  ol: ({node, ...props}: any) => <Box component="ol" sx={{ pl: 2.5, my: 0.5 }} {...props} />,
  li: ({node, ...props}: any) => <Typography component="li" variant="body2" sx={{ my: 0.5 }} {...props} />,
  a: ({node, ...props}: any) => <Link target="_blank" rel="noopener noreferrer" {...props} />,
  pre: ({node, ...props}: any) => <Box component="pre" sx={{ overflowX: 'auto', p: 1.5, my: 1, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1, fontSize: '0.85rem' }} {...props} />,
  code: ({node, inline, className, children, ...props}: any) => {
    return !inline ? (
       <code className={className} {...props}>{children}</code>
    ) : (
      <Typography
        component="code"
        sx={{
          fontFamily: 'monospace',
          fontSize: '0.9em',
          bgcolor: 'action.hover', // Original
          p: '0.1em 0.3em', // Original
          borderRadius: '4px', // Original
        }}
        {...props}
      >{children}</Typography>
    )
  },
   blockquote: ({node, ...props}: any) => (
     <Box
       component="blockquote"
       sx={{ // Original
         borderLeft: (theme) => `4px solid ${theme.palette.divider}`,
         pl: 1.5,
         my: 1,
         fontStyle: 'italic',
         color: 'text.secondary',
         '& p': {
            m: 0,
         }
       }}
       {...props}
     />
   ),
   hr: ({node, ...props}: any) => <Box component="hr" sx={{ my: 2, border: 'none', borderTop: (theme) => `1px solid ${theme.palette.divider}` }} {...props} />,
};


const getFileIcon = (fileName: string, fileType: string): JSX.Element => {
  // Special case for Linux Helper screenshots - show folder icon to indicate it opens folder
  if (fileName.startsWith('linux-helper-') && fileType.startsWith('image/')) {
    return <FolderIcon fontSize="small" />;
  }
  
  if (fileType.startsWith('image/')) return <ImageIcon fontSize="small" />;
  if (fileType.startsWith('audio/')) return <AudiotrackIcon fontSize="small" />;
  if (fileType.startsWith('video/')) return <VideocamIcon fontSize="small" />;
  if (fileType === 'application/pdf') return <PictureAsPdfIcon fontSize="small" />;
  if (fileType === 'text/csv' || fileType.includes('spreadsheet') || fileType.includes('excel')) return <AssessmentIcon fontSize="small" />;
  if (fileType.includes('word') || fileType === 'text/plain') return <DescriptionIcon fontSize="small" />;
  if (fileType.includes('zip') || fileType.includes('tar') || fileType.includes('gzip')) return <FolderZipIcon fontSize="small" />;
  return <InsertDriveFileIcon fontSize="small" />;
};

const MessageItem = ({ message }: Props) => {
  const theme = useTheme();
  const isUser = message.role === 'user';
  const isModel = message.role === 'model';
  const isSystem = message.role === 'system';

  // Handle file click - open screenshots folder for Linux Helper screenshots
  const handleFileClick = async (fileName: string, fileType: string) => {
    if (fileName.startsWith('linux-helper-') && fileType.startsWith('image/')) {
      try {
        await (window as any).api.openScreenshotsFolder();
        console.log('📁 Opened screenshots folder');
      } catch (error) {
        console.error('Failed to open screenshots folder:', error);
      }
    }
  };

  const justify = isUser ? 'flex-end' : 'flex-start';

  // Original bubble color logic
  const bubbleColor = isUser
    ? theme.palette.userBubble?.main || theme.palette.primary.light
    : isModel
    ? theme.palette.modelBubble?.main || theme.palette.grey[200]
    : theme.palette.grey[400];

  const textColor = isUser
    ? theme.palette.userBubble?.contrastText || theme.palette.primary.contrastText
    : isModel
    ? theme.palette.modelBubble?.contrastText || theme.palette.getContrastText(theme.palette.grey[200] || '#000')
    : theme.palette.getContrastText(theme.palette.grey[400]);

  const borderRadius = isUser
    ? '20px 20px 5px 20px'
    : '20px 20px 20px 5px';

  const messageText = message.parts.map(p => p.text).join('\n');
  const hasText = messageText.trim().length > 0;
  const hasFiles = message.files && message.files.length > 0;

  const variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  if (isSystem) {
      return (
          <motion.div initial="hidden" animate="visible" variants={variants} style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: theme.spacing(1), marginBottom: theme.spacing(1) }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic', textAlign: 'center', maxWidth: '80%' }}>
                {messageText}
            </Typography>
          </motion.div>
      )
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants}
      style={{ display: 'flex', justifyContent: justify, width: '100%' }}
      layout
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, maxWidth: '80%' /* Original maxWidth */ }}>
        {isModel && (
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', mb: 0.5 /* Original */ }}>
            <SmartToyIcon fontSize="small" />
          </Avatar>
        )}

        <Paper
          elevation={1}
          sx={{
            // width:"100%", // This might cause issues if not handled well with maxWidth, let it be content-driven
            p: '10px 14px', // Original padding
            bgcolor: bubbleColor,
            color: textColor,
            borderRadius: borderRadius,
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
            hyphens: 'auto',
             '& .MuiTypography-paragraph:last-child': { // Original
                mb: 0,
             },
            minWidth: hasFiles && !hasText ? '180px' : 'auto', // Give some minWidth for file-only messages
          }}
        >
          {hasFiles && (
            <Stack spacing={0.75} sx={{ mb: hasText ? 1.25 : 0, mt: hasText && message.files && message.files.length > 1 ? 0.5 : 0 }}>
              {message.files!.map((file: FileAttachment) => (
                <Chip
                  key={file.name}
                  icon={getFileIcon(file.name, file.type)}
                  label={
                    <Typography variant="caption" sx={{ display: 'block', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                      📁 {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </Typography>
                  }
                  size="small"
                  variant="outlined"
                  clickable={file.name.startsWith('linux-helper-') && file.type.startsWith('image/')}
                  sx={{
                    backgroundColor: alpha(textColor === theme.palette.common.white ? theme.palette.common.black : theme.palette.common.white, 0.12),
                    borderColor: alpha(textColor === theme.palette.common.white ? theme.palette.common.black : theme.palette.common.white, 0.25),
                    color: textColor,
                    maxWidth: '100%', // Ensure chip fits
                    height: 'auto', // Allow chip to grow for multiline label if needed (though current label is single line)
                    cursor: file.name.startsWith('linux-helper-') && file.type.startsWith('image/') ? 'pointer' : 'default',
                    '&:hover': file.name.startsWith('linux-helper-') && file.type.startsWith('image/') ? {
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      borderColor: theme.palette.primary.main,
                    } : {},
                    '& .MuiChip-icon': {
                        color: textColor,
                        ml: '6px',
                    },
                    '& .MuiChip-label': {
                      paddingLeft: '8px',
                      paddingRight: '8px',
                    }
                  }}
                  onClick={() => handleFileClick(file.name, file.type)}
                />
              ))}
            </Stack>
          )}

          {hasText && (
            <ReactMarkdown
              components={markdownComponents}
              rehypePlugins={[rehypeHighlight]}
            >
              {messageText}
            </ReactMarkdown>
          )}
        </Paper>
      </Box>
    </motion.div>
  );
};

export default MessageItem;