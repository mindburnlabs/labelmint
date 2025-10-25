import { EmailService } from '../services/EmailService';

// Re-export EmailService invitation functionality as sendInviteEmail
export const sendInviteEmail = async (
  email: string,
  options: {
    organizationId: string;
    invitationToken: string;
    inviterName: string;
    organizationName: string;
    role?: string;
  }
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  const {
    organizationId,
    invitationToken,
    inviterName,
    organizationName,
    role = 'MEMBER'
  } = options;

  return await EmailService.sendInvitation(
    organizationId,
    email,
    invitationToken,
    inviterName,
    organizationName,
    role
  );
};

// Export other useful email functions
export {
  EmailService,
  type EmailConfig,
  type EmailData,
  type EmailResult,
  type EmailTemplate
} from '../services/EmailService';