import type { TransactionAttachment } from '@/types';

import { useSupabase } from './useSupabase';

const BUCKET_NAME = 'transaction-attachments';

export function useTransactionAttachments() {
    const { supabase } = useSupabase();

    /**
     * Upload an attachment to storage and create a database record
     */
    async function uploadAttachment(
        groupId: string,
        transactionId: string,
        blob: Blob,
        fileName: string,
    ): Promise<TransactionAttachment | null> {
        try {
            // Generate unique path: {groupId}/{transactionId}/{uuid}.jpg
            const uuid = crypto.randomUUID();
            const storagePath = `${groupId}/${transactionId}/${uuid}.jpg`;

            // Upload to storage
            const { error: uploadError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(storagePath, blob, {
                    contentType: 'image/jpeg',
                    upsert: false,
                });

            if (uploadError) {
                console.error('Error uploading attachment:', uploadError);
                return null;
            }

            // Create database record
            const { data, error: dbError } = await supabase
                .from('transaction_attachments')
                .insert({
                    transaction_id: transactionId,
                    group_id: groupId,
                    storage_path: storagePath,
                    file_name: fileName,
                    file_size: blob.size,
                })
                .select()
                .single();

            if (dbError) {
                console.error('Error creating attachment record:', dbError);
                // Try to clean up the uploaded file
                await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
                return null;
            }

            return data;
        } catch (error) {
            console.error('Error in uploadAttachment:', error);
            return null;
        }
    }

    /**
     * Delete an attachment from storage and database
     */
    async function deleteAttachment(
        attachmentId: string,
        storagePath: string,
    ): Promise<boolean> {
        try {
            // Delete from storage
            const { error: storageError } = await supabase.storage
                .from(BUCKET_NAME)
                .remove([storagePath]);

            if (storageError) {
                console.error('Error deleting from storage:', storageError);
                // Continue to delete DB record anyway
            }

            // Delete database record
            const { error: dbError } = await supabase
                .from('transaction_attachments')
                .delete()
                .eq('id', attachmentId);

            if (dbError) {
                console.error('Error deleting attachment record:', dbError);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error in deleteAttachment:', error);
            return false;
        }
    }

    /**
     * Get all attachments for a transaction
     */
    async function getAttachments(
        transactionId: string,
    ): Promise<TransactionAttachment[]> {
        try {
            const { data, error } = await supabase
                .from('transaction_attachments')
                .select('*')
                .eq('transaction_id', transactionId)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error fetching attachments:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('Error in getAttachments:', error);
            return [];
        }
    }

    /**
     * Get public URL for an attachment
     */
    function getAttachmentUrl(storagePath: string): string {
        const { data } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(storagePath);
        return data.publicUrl;
    }

    return {
        uploadAttachment,
        deleteAttachment,
        getAttachments,
        getAttachmentUrl,
    };
}
