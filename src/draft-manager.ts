/**
 * Draft Manager for Gmail MCP Server
 * Provides draft listing, reading, updating, and sending functionality.
 */

import { createEmailMessage, createEmailWithNodemailer } from "./utl.js";

/**
 * Lists drafts in the user's mailbox.
 */
export async function listDrafts(gmail: any, maxResults?: number) {
  try {
    const response = await gmail.users.drafts.list({
      userId: 'me',
      maxResults: maxResults || 20,
    });

    const drafts = response.data.drafts || [];

    // Fetch metadata for each draft
    const results = await Promise.all(
      drafts.map(async (draft: any) => {
        try {
          const detail = await gmail.users.drafts.get({
            userId: 'me',
            id: draft.id,
            format: 'metadata',
          });
          const headers = detail.data.message?.payload?.headers || [];
          return {
            id: draft.id,
            messageId: detail.data.message?.id,
            threadId: detail.data.message?.threadId,
            subject: headers.find((h: any) => h.name === 'Subject')?.value || '(no subject)',
            to: headers.find((h: any) => h.name === 'To')?.value || '',
            date: headers.find((h: any) => h.name === 'Date')?.value || '',
          };
        } catch {
          return {
            id: draft.id,
            messageId: draft.message?.id,
            subject: '(unable to fetch)',
            to: '',
            date: '',
          };
        }
      })
    );

    return results;
  } catch (error: any) {
    throw new Error(`Failed to list drafts: ${error.message}`);
  }
}

/**
 * Gets a specific draft by ID, returning full content.
 */
export async function getDraft(gmail: any, draftId: string) {
  try {
    const response = await gmail.users.drafts.get({
      userId: 'me',
      id: draftId,
      format: 'full',
    });
    return response.data;
  } catch (error: any) {
    if (error.code === 404) {
      throw new Error(`Draft with ID "${draftId}" not found.`);
    }
    throw new Error(`Failed to get draft: ${error.message}`);
  }
}

/**
 * Updates (replaces) an existing draft's content.
 * Uses gmail.users.drafts.update which replaces the draft's message.
 */
export async function updateDraft(
  gmail: any,
  draftId: string,
  validatedArgs: any
) {
  try {
    let encodedMessage: string;

    if (validatedArgs.attachments && validatedArgs.attachments.length > 0) {
      const message = await createEmailWithNodemailer(validatedArgs);
      encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    } else {
      const message = createEmailMessage(validatedArgs);
      encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    }

    const messageRequest: any = {
      raw: encodedMessage,
    };
    if (validatedArgs.threadId) {
      messageRequest.threadId = validatedArgs.threadId;
    }

    const response = await gmail.users.drafts.update({
      userId: 'me',
      id: draftId,
      requestBody: {
        message: messageRequest,
      },
    });

    return response.data;
  } catch (error: any) {
    if (error.code === 404) {
      throw new Error(`Draft with ID "${draftId}" not found.`);
    }
    throw new Error(`Failed to update draft: ${error.message}`);
  }
}

/**
 * Sends an existing draft.
 */
export async function sendDraft(gmail: any, draftId: string) {
  try {
    const response = await gmail.users.drafts.send({
      userId: 'me',
      requestBody: {
        id: draftId,
      },
    });
    return response.data;
  } catch (error: any) {
    if (error.code === 404) {
      throw new Error(`Draft with ID "${draftId}" not found.`);
    }
    throw new Error(`Failed to send draft: ${error.message}`);
  }
}

/**
 * Deletes a draft permanently.
 */
export async function deleteDraft(gmail: any, draftId: string) {
  try {
    await gmail.users.drafts.delete({
      userId: 'me',
      id: draftId,
    });
    return { success: true, message: `Draft "${draftId}" deleted successfully.` };
  } catch (error: any) {
    if (error.code === 404) {
      throw new Error(`Draft with ID "${draftId}" not found.`);
    }
    throw new Error(`Failed to delete draft: ${error.message}`);
  }
}
