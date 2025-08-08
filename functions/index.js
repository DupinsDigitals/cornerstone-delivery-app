const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const crypto = require('crypto');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Cloud Function that triggers when a new delivery document is created
// This function is create-only and idempotent (won't send duplicate webhooks)
exports.onDeliveryCreated_sendWebhook = functions.firestore
  .document('deliveries/{id}')
  .onCreate(async (snap, context) => {
    const deliveryId = context.params.id;
    const reqId = crypto.randomUUID();
    const docRef = snap.ref;
    
    functions.logger.info('START onDeliveryCreated', { deliveryId, reqId });
    
    try {
      // Transaction-locked duplicate prevention
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(docRef);
        
        if (!snap.exists) {
          functions.logger.warn(`Document ${deliveryId} no longer exists, skipping webhook`);
          throw new Error('DOCUMENT_NOT_FOUND');
        }
        
        const data = snap.data();
        
        // Check if already sent or locked
        if (data.scheduledWebhookSent === true || data.sendLock != null) {
          functions.logger.info(`Webhook already sent or locked for delivery ${deliveryId}`, { 
            scheduledWebhookSent: data.scheduledWebhookSent, 
            sendLock: data.sendLock,
            reqId 
          });
          throw new Error('ALREADY_SENT');
        }
        
        // Pre-check: If status exists and is not PENDING, skip
        if (data.status && data.status !== 'PENDING') {
          functions.logger.info(`Delivery ${deliveryId} status is not PENDING (${data.status}), skipping webhook`, { reqId });
          throw new Error('STATUS_NOT_PENDING');
        }
        
        // Set lock to prevent concurrent sends
        transaction.update(docRef, {
          sendLock: admin.firestore.FieldValue.serverTimestamp()
        });
        
        functions.logger.info(`Transaction completed: set send lock for delivery ${deliveryId}`, { reqId });
      });
      
      // Get fresh data after transaction
      const freshSnap = await docRef.get();
      const deliveryData = freshSnap.data();
      
      // Extract fields with sensible fallbacks
      const customerName = deliveryData.customerName || deliveryData.clientName || '';
      const customerPhone = deliveryData.customerPhone || deliveryData.destinationPhone || deliveryData.phone || '';
      const address = deliveryData.address || deliveryData.deliveryAddress || '';
      const scheduledDateTime = deliveryData.scheduledDateTime || deliveryData.scheduledAt || `${deliveryData.scheduledDate || ''} ${deliveryData.scheduledTime || ''}`.trim();
      const invoiceNumber = deliveryData.invoiceNumber || deliveryData.invoice || '';
      const store = deliveryData.store || deliveryData.location || deliveryData.originStore || '';
      
      // Validate required fields
      if (!customerPhone || !address || !scheduledDateTime) {
        functions.logger.warn(`Missing required fields for delivery ${deliveryId}:`, {
          customerPhone: !!customerPhone,
          address: !!address,
          scheduledDateTime: !!scheduledDateTime,
          reqId
        });
        
        // Remove lock on validation failure
        await docRef.update({
          sendLock: admin.firestore.FieldValue.delete()
        });
        
        return null;
      }
      
      // Prepare exact webhook payload
      const webhookPayload = {
        event: 'delivery_scheduled',
        deliveryId,
        customerName,
        customerPhone,
        address,
        scheduledDateTime,
        invoiceNumber,
        store,
        idempotencyKey: reqId
      };
      
      functions.logger.info(`Sending webhook for delivery ${deliveryId}`, { ...webhookPayload, reqId });
      
      // Send webhook using axios with 8s timeout
      const webhookUrl = 'https://services.leadconnectorhq.com/hooks/mBFUGtg8hdlP23JhMe7J/webhook-trigger/a7c21c87-6ac3-45db-9d67-7eab83d43ba1';
      
      const response = await axios.post(webhookUrl, webhookPayload, {
        timeout: 8000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status >= 200 && response.status < 300) {
        // Mark as successfully sent and remove lock
        await docRef.update({
          scheduledWebhookSent: true,
          scheduledWebhookSentAt: admin.firestore.FieldValue.serverTimestamp(),
          sendLock: admin.firestore.FieldValue.delete(),
          webhookId: reqId
        });
        
        functions.logger.info(`Webhook sent successfully for delivery ${deliveryId}`, { reqId });
      } else {
        functions.logger.error('WEBHOOK_FAIL', { 
          deliveryId, 
          reqId, 
          status: response.status, 
          response: response.data 
        });
        
        // Remove lock on failure to allow retry
        await docRef.update({
          sendLock: admin.firestore.FieldValue.delete()
        });
      }
      
    } catch (error) {
      // Handle specific transaction errors
      if (error.message === 'ALREADY_SENT' || error.message === 'STATUS_NOT_PENDING' || error.message === 'DOCUMENT_NOT_FOUND') {
        functions.logger.info(`Skipping webhook for delivery ${deliveryId}: ${error.message}`, { reqId });
        return null;
      }
      
      // Handle HTTP and other errors
      if (error.code === 'ECONNABORTED') {
        functions.logger.error('WEBHOOK_FAIL', { deliveryId, reqId, error: 'timeout', message: error.message });
      } else if (error.response) {
        functions.logger.error('WEBHOOK_FAIL', { 
          deliveryId, 
          reqId, 
          status: error.response.status, 
          response: error.response.data 
        });
      } else {
        functions.logger.error('WEBHOOK_FAIL', { deliveryId, reqId, error: error.message });
      }
      
      // Remove lock on error to allow manual retry
      try {
        await docRef.update({
          sendLock: admin.firestore.FieldValue.delete()
        });
      } catch (unlockError) {
        functions.logger.error('Failed to remove send lock', { deliveryId, reqId, unlockError: unlockError.message });
      }
    }
    
    return null;
  });